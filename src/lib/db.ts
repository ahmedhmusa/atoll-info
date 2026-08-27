// ---------------------------------------------------------------------------
// db.ts
//
// IndexedDB persistence. Every operational record is stored as an opaque
// AES-GCM ciphertext blob — the raw IndexedDB store never contains a
// plaintext name, note, or any other case detail. This file performs no
// network requests; it is purely local, on-device storage.
// ---------------------------------------------------------------------------

import { openDB, type IDBPDatabase, type DBSchema } from 'idb';
import type { CryptoConfigRecord, AppSettingsRecord } from '../types';

export const DB_NAME = 'atoll-info';
export const DB_VERSION = 1;

export interface EncryptedRecord {
  id: string;
  ct: string;
  iv: string;
  updatedAt: string;
}

interface AtollDBSchema extends DBSchema {
  islands: { key: string; value: EncryptedRecord };
  persons: { key: string; value: EncryptedRecord };
  informants: { key: string; value: EncryptedRecord };
  reports: { key: string; value: EncryptedRecord };
  tasks: { key: string; value: EncryptedRecord };
  cryptoConfig: { key: string; value: CryptoConfigRecord };
  settingsMeta: { key: string; value: AppSettingsRecord };
}

const ALL_STORES = ['islands', 'persons', 'informants', 'reports', 'tasks', 'cryptoConfig', 'settingsMeta'] as const;

let dbPromise: Promise<IDBPDatabase<AtollDBSchema>> | null = null;

export function getDB(): Promise<IDBPDatabase<AtollDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<AtollDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        for (const name of ALL_STORES) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export type EncryptedStoreName = 'islands' | 'persons' | 'informants' | 'reports' | 'tasks';

export async function getAllEncrypted(store: EncryptedStoreName): Promise<EncryptedRecord[]> {
  const db = await getDB();
  return db.getAll(store);
}

export async function putEncrypted(store: EncryptedStoreName, record: EncryptedRecord): Promise<void> {
  const db = await getDB();
  await db.put(store, record);
}

export async function deleteEncrypted(store: EncryptedStoreName, id: string): Promise<void> {
  const db = await getDB();
  await db.delete(store, id);
}

export async function clearOperationalData(): Promise<void> {
  const db = await getDB();
  const stores: EncryptedStoreName[] = ['persons', 'informants', 'reports', 'tasks'];
  const tx = db.transaction(stores, 'readwrite');
  await Promise.all(stores.map((s) => tx.objectStore(s).clear()));
  await tx.done;
}

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const stores: EncryptedStoreName[] = ['islands', 'persons', 'informants', 'reports', 'tasks'];
  const tx = db.transaction(stores, 'readwrite');
  await Promise.all(stores.map((s) => tx.objectStore(s).clear()));
  await tx.done;
}

export async function clearIslands(): Promise<void> {
  const db = await getDB();
  await db.clear('islands');
}

export async function getCryptoConfig(): Promise<CryptoConfigRecord | undefined> {
  const db = await getDB();
  return db.get('cryptoConfig', 'crypto-config');
}

export async function putCryptoConfig(cfg: CryptoConfigRecord): Promise<void> {
  const db = await getDB();
  await db.put('cryptoConfig', cfg);
}

export async function getSettings(): Promise<AppSettingsRecord | undefined> {
  const db = await getDB();
  return db.get('settingsMeta', 'settings');
}

export async function putSettings(settings: AppSettingsRecord): Promise<void> {
  const db = await getDB();
  await db.put('settingsMeta', settings);
}
