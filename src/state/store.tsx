import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createNewKeyMaterial, createVerifier, deriveKey, testVerifier, encryptJSON, decryptJSON, bytesToBase64, base64ToBytes } from '../lib/crypto';
import * as db from '../lib/db';
import { seedIslands } from '../lib/seed';
import { newId, nowISO } from '../lib/util';
import type { Island, Person, Informant, Report, TaskItem, AppSettingsRecord, CryptoConfigRecord } from '../types';

type EntityMap = { islands: Island; persons: Person; informants: Informant; reports: Report; tasks: TaskItem };
type Collections = { [K in keyof EntityMap]: EntityMap[K][] };
const empty: Collections = { islands: [], persons: [], informants: [], reports: [], tasks: [] };

interface StoreState {
  ready: boolean;
  hasPin: boolean;
  locked: boolean;
  unlocking: boolean;
  data: Collections;
  settings: AppSettingsRecord | null;
  error: string | null;
}

interface StoreContextValue extends StoreState {
  setupPin: (pin: string) => Promise<void>;
  unlock: (pin: string) => Promise<boolean>;
  lock: () => void;
  changePin: (oldPin: string, newPin: string) => Promise<boolean>;
  touchActivity: () => void;
  upsert: <K extends keyof EntityMap>(store: K, record: EntityMap[K]) => Promise<void>;
  remove: <K extends keyof EntityMap>(store: K, id: string) => Promise<void>;
  updateSettings: (patch: Partial<AppSettingsRecord>) => Promise<void>;
  wipeAllData: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);
const DEFAULT_TIMEOUT_MIN = 5;

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<StoreState>({
    ready: false, hasPin: false, locked: true, unlocking: false, data: empty, settings: null, error: null,
  });
  const keyRef = useRef<CryptoKey | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      const cfg = await db.getCryptoConfig();
      const settings = await db.getSettings();
      setState((s) => ({ ...s, ready: true, hasPin: !!cfg, settings: settings ?? null }));
    })();
  }, []);

  const lock = useCallback(() => {
    keyRef.current = null;
    setState((s) => ({ ...s, locked: true, data: empty }));
  }, []);

  useEffect(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setState((s) => {
        if (s.locked || !s.settings) return s;
        if (Date.now() - lastActivityRef.current > s.settings.inactivityTimeoutMinutes * 60_000) {
          keyRef.current = null;
          return { ...s, locked: true, data: empty };
        }
        return s;
      });
    }, 5000);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, []);

  const touchActivity = useCallback(() => { lastActivityRef.current = Date.now(); }, []);

  const loadAll = useCallback(async (key: CryptoKey): Promise<Collections> => {
    const stores: (keyof EntityMap)[] = ['islands', 'persons', 'informants', 'reports', 'tasks'];
    const result = {} as Collections;
    for (const s of stores) {
      const rows = await db.getAllEncrypted(s);
      const decrypted = await Promise.all(rows.map((r) => decryptJSON<EntityMap[typeof s]>(key, r.ct, r.iv)));
      // @ts-expect-error mapped-type assignment
      result[s] = decrypted;
    }
    return result;
  }, []);

  const setupPin = useCallback(async (pin: string) => {
    const { key, saltBytes, iterations } = await createNewKeyMaterial(pin);
    const verifier = await createVerifier(key);
    const cfg: CryptoConfigRecord = {
      id: 'crypto-config', salt: Array.from(saltBytes), verifier: verifier.ct,
      verifierIv: Array.from(base64ToBytes(verifier.iv)), iterations, createdAt: nowISO(),
    };
    await db.putCryptoConfig(cfg);
    const settings: AppSettingsRecord = {
      id: 'settings', officerCallsign: 'Officer', agencyLabel: 'Tha Atoll Narcotics Intelligence Unit',
      inactivityTimeoutMinutes: DEFAULT_TIMEOUT_MIN, createdAt: nowISO(), updatedAt: nowISO(),
    };
    await db.putSettings(settings);
    keyRef.current = key;

    for (const island of seedIslands()) {
      const enc = await encryptJSON(key, island);
      await db.putEncrypted('islands', { id: island.id, ct: enc.ct, iv: enc.iv, updatedAt: nowISO() });
    }
    const result = await loadAll(key);
    lastActivityRef.current = Date.now();
    setState((s) => ({ ...s, hasPin: true, locked: false, data: result, settings }));
  }, [loadAll]);

  const unlock = useCallback(async (pin: string): Promise<boolean> => {
    setState((s) => ({ ...s, unlocking: true, error: null }));
    const cfg = await db.getCryptoConfig();
    if (!cfg) { setState((s) => ({ ...s, unlocking: false, error: 'No PIN configured yet.' })); return false; }
    const key = await deriveKey(pin, new Uint8Array(cfg.salt), cfg.iterations);
    const ok = await testVerifier(key, cfg.verifier, bytesToBase64(new Uint8Array(cfg.verifierIv)));
    if (!ok) { setState((s) => ({ ...s, unlocking: false, error: 'Incorrect PIN.' })); return false; }
    keyRef.current = key;
    const settings = (await db.getSettings()) ?? null;
    const result = await loadAll(key);
    lastActivityRef.current = Date.now();
    setState((s) => ({ ...s, unlocking: false, locked: false, data: result, settings, error: null }));
    return true;
  }, [loadAll]);

  const changePin = useCallback(async (oldPin: string, newPin: string): Promise<boolean> => {
    const cfg = await db.getCryptoConfig();
    if (!cfg) return false;
    const oldKey = await deriveKey(oldPin, new Uint8Array(cfg.salt), cfg.iterations);
    const ok = await testVerifier(oldKey, cfg.verifier, bytesToBase64(new Uint8Array(cfg.verifierIv)));
    if (!ok) return false;
    const { key: newKey, saltBytes, iterations } = await createNewKeyMaterial(newPin);
    const stores: (keyof EntityMap)[] = ['islands', 'persons', 'informants', 'reports', 'tasks'];
    for (const s of stores) {
      const rows = await db.getAllEncrypted(s);
      for (const row of rows) {
        const plain = await decryptJSON<any>(oldKey, row.ct, row.iv);
        const enc = await encryptJSON(newKey, plain);
        await db.putEncrypted(s, { id: row.id, ct: enc.ct, iv: enc.iv, updatedAt: row.updatedAt });
      }
    }
    const verifier = await createVerifier(newKey);
    await db.putCryptoConfig({
      id: 'crypto-config', salt: Array.from(saltBytes), verifier: verifier.ct,
      verifierIv: Array.from(base64ToBytes(verifier.iv)), iterations, createdAt: cfg.createdAt,
    });
    keyRef.current = newKey;
    const result = await loadAll(newKey);
    setState((s) => ({ ...s, data: result }));
    return true;
  }, [loadAll]);

  const requireKey = (): CryptoKey => {
    if (!keyRef.current) throw new Error('Application is locked.');
    return keyRef.current;
  };

  const upsert = useCallback(async <K extends keyof EntityMap>(storeName: K, record: EntityMap[K]) => {
    const key = requireKey();
    const enc = await encryptJSON(key, record);
    await db.putEncrypted(storeName, { id: (record as any).id, ct: enc.ct, iv: enc.iv, updatedAt: (record as any).updatedAt ?? nowISO() });
    setState((s) => {
      const list = s.data[storeName] as EntityMap[K][];
      const idx = list.findIndex((r: any) => r.id === (record as any).id);
      const next = [...list];
      if (idx >= 0) next[idx] = record; else next.unshift(record);
      return { ...s, data: { ...s.data, [storeName]: next } };
    });
  }, []);

  const remove = useCallback(async <K extends keyof EntityMap>(storeName: K, id: string) => {
    await db.deleteEncrypted(storeName, id);
    setState((s) => ({ ...s, data: { ...s.data, [storeName]: (s.data[storeName] as any[]).filter((r) => r.id !== id) } }));
  }, []);

  const updateSettings = useCallback(async (patch: Partial<AppSettingsRecord>) => {
    setState((s) => {
      if (!s.settings) return s;
      const next = { ...s.settings, ...patch, updatedAt: nowISO() };
      db.putSettings(next);
      return { ...s, settings: next };
    });
  }, []);

  const wipeAllData = useCallback(async () => {
    await db.clearOperationalData();
    setState((s) => ({ ...s, data: { ...empty, islands: s.data.islands } }));
  }, []);

  const value: StoreContextValue = {
    ...state, setupPin, unlock, lock, changePin, touchActivity, upsert, remove, updateSettings, wipeAllData,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

export function newRecord() {
  return { id: newId(), createdAt: nowISO(), updatedAt: nowISO() };
}
export function touchRecord<T extends { updatedAt: string }>(rec: T): T {
  return { ...rec, updatedAt: nowISO() };
}
