// ---------------------------------------------------------------------------
// backup.ts
//
// Encrypted local backup file. Export produces a Blob for the officer to
// save via the OS file picker/share sheet — Files, iCloud Drive, Google
// Drive, a USB drive, wherever. Nothing here ever performs network I/O;
// restore only ever reads a File the officer explicitly selected.
//
// File shape:
//   { format, backupFormatVersion, appVersion, dbVersion,   <- readable without a password
//     createdAt, recordCounts, checksum,
//     salt, iterations, ct, iv }                            <- AES-GCM ciphertext of everything else
// ---------------------------------------------------------------------------

import * as db from './db';
import { deriveKey, encryptJSON, decryptJSON, testVerifier, bytesToBase64, sha256Hex } from './crypto';
import { APP_VERSION, SCHEMA_VERSION } from './appMeta';
import type { CryptoConfigRecord, AppSettingsRecord, Island } from '../types';

export const BACKUP_FORMAT_VERSION = 1;
const STORES = ['islands', 'persons', 'informants', 'reports', 'tasks'] as const;
type StoreName = (typeof STORES)[number];

export interface RecordCounts {
  islands: number; persons: number; informants: number; reports: number; tasks: number;
}

export interface BackupFile {
  format: 'atoll-info-backup';
  backupFormatVersion: number;
  appVersion: string;
  dbVersion: number;
  createdAt: string;
  recordCounts: RecordCounts;
  checksum: string;
  salt: number[];
  iterations: number;
  ct: string;
  iv: string;
}

interface BackupBundle {
  cryptoConfig: CryptoConfigRecord;
  settings: AppSettingsRecord | undefined;
  stores: Record<StoreName, db.EncryptedRecord[]>;
}

/** Encrypts and packages everything currently in IndexedDB. Requires the current PIN to authorize. */
export async function createBackup(pin: string): Promise<Blob> {
  const cfg = await db.getCryptoConfig();
  if (!cfg) throw new Error('No PIN configured yet.');
  const key = await deriveKey(pin, new Uint8Array(cfg.salt), cfg.iterations);
  const ok = await testVerifier(key, cfg.verifier, bytesToBase64(new Uint8Array(cfg.verifierIv)));
  if (!ok) throw new Error('Incorrect PIN — cannot export.');

  const stores = {} as Record<StoreName, db.EncryptedRecord[]>;
  for (const s of STORES) stores[s] = await db.getAllEncrypted(s);
  const settings = await db.getSettings();

  const recordCounts: RecordCounts = {
    islands: stores.islands.length, persons: stores.persons.length, informants: stores.informants.length,
    reports: stores.reports.length, tasks: stores.tasks.length,
  };

  const bundle: BackupBundle = { cryptoConfig: cfg, settings, stores };
  const outer = await encryptJSON(key, bundle);
  const checksum = await sha256Hex(outer.ct);

  const fileObj: BackupFile = {
    format: 'atoll-info-backup', backupFormatVersion: BACKUP_FORMAT_VERSION, appVersion: APP_VERSION,
    dbVersion: SCHEMA_VERSION, createdAt: new Date().toISOString(), recordCounts, checksum,
    salt: cfg.salt, iterations: cfg.iterations, ct: outer.ct, iv: outer.iv,
  };
  return new Blob([JSON.stringify(fileObj)], { type: 'application/json' });
}

export type InspectResult =
  | { ok: true; file: BackupFile; checksumOk: boolean }
  | { ok: false; reason: 'unreadable' | 'not-atoll-backup' | 'unsupported-version' };

/** Reads a backup file's header — date, counts, versions, checksum — WITHOUT a password, so the officer can confirm it's the right file first. */
export async function inspectBackupFile(file: File): Promise<InspectResult> {
  let fileObj: any;
  try {
    fileObj = JSON.parse(await file.text());
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
  if (!fileObj || fileObj.format !== 'atoll-info-backup') return { ok: false, reason: 'not-atoll-backup' };
  if (typeof fileObj.backupFormatVersion !== 'number' || fileObj.backupFormatVersion > BACKUP_FORMAT_VERSION) {
    return { ok: false, reason: 'unsupported-version' };
  }
  const checksumOk = !fileObj.checksum || (await sha256Hex(fileObj.ct ?? '')) === fileObj.checksum;
  return { ok: true, file: fileObj as BackupFile, checksumOk };
}

export type DecryptResult = { ok: true; bundle: BackupBundle; key: CryptoKey } | { ok: false; reason: 'wrong-password' | 'corrupted' };

export async function decryptBackup(file: BackupFile, pin: string): Promise<DecryptResult> {
  try {
    const key = await deriveKey(pin, new Uint8Array(file.salt), file.iterations);
    const bundle = await decryptJSON<BackupBundle>(key, file.ct, file.iv);
    if (!bundle?.cryptoConfig || !bundle?.stores) return { ok: false, reason: 'corrupted' };
    return { ok: true, bundle, key };
  } catch {
    return { ok: false, reason: 'wrong-password' };
  }
}

export interface RestoreSummary {
  mode: 'replace' | 'merge';
  added: Partial<Record<StoreName, number>>;
  skipped: Partial<Record<StoreName, number>>;
}

/** FULL RESTORE: wipes the device and adopts the backup's PIN/crypto config wholesale. Only ever called after explicit confirmation. */
export async function restoreReplace(bundle: BackupBundle): Promise<RestoreSummary> {
  await db.clearAllData();
  await db.putCryptoConfig(bundle.cryptoConfig);
  if (bundle.settings) await db.putSettings(bundle.settings);
  const added: RestoreSummary['added'] = {};
  for (const s of STORES) {
    for (const row of bundle.stores[s] ?? []) await db.putEncrypted(s, row);
    added[s] = bundle.stores[s]?.length ?? 0;
  }
  return { mode: 'replace', added, skipped: {} };
}

/**
 * MERGE: never overwrites an existing record. Islands are matched by NAME
 * (not ID) since two separate installs seed the same 13 island names under
 * different random IDs — persons/informants/reports coming from the backup
 * get their islandId rewritten to whichever local island shares that name.
 */
export async function restoreMerge(bundle: BackupBundle, backupKey: CryptoKey, liveKey: CryptoKey): Promise<RestoreSummary> {
  const backupIslands = await Promise.all((bundle.stores.islands ?? []).map((r) => decryptJSON<Island>(backupKey, r.ct, r.iv)));
  const localIslandRows = await db.getAllEncrypted('islands');
  const localIslands = await Promise.all(localIslandRows.map((r) => decryptJSON<Island>(liveKey, r.ct, r.iv)));
  const localIdByName = new Map(localIslands.map((i) => [i.name, i.id]));
  const backupNameById = new Map(backupIslands.map((i) => [i.id, i.name]));
  const remapIsland = (islandId: string) => {
    const name = backupNameById.get(islandId);
    return (name && localIdByName.get(name)) || islandId;
  };

  const added: RestoreSummary['added'] = {};
  const skipped: RestoreSummary['skipped'] = {};

  // Islands themselves: add any name not already present locally.
  const existingNames = new Set(localIslands.map((i) => i.name));
  let islandsAdded = 0, islandsSkipped = 0;
  for (const isl of backupIslands) {
    if (existingNames.has(isl.name)) { islandsSkipped++; continue; }
    const enc = await encryptJSON(liveKey, isl);
    await db.putEncrypted('islands', { id: isl.id, ct: enc.ct, iv: enc.iv, updatedAt: new Date().toISOString() });
    islandsAdded++;
  }
  added.islands = islandsAdded; skipped.islands = islandsSkipped;

  const dataStores: Exclude<StoreName, 'islands'>[] = ['persons', 'informants', 'reports', 'tasks'];
  for (const s of dataStores) {
    const existingIds = new Set((await db.getAllEncrypted(s)).map((r) => r.id));
    let a = 0, sk = 0;
    for (const row of bundle.stores[s] ?? []) {
      if (existingIds.has(row.id)) { sk++; continue; }
      const plain = await decryptJSON<any>(backupKey, row.ct, row.iv);
      if ('islandId' in plain && plain.islandId) plain.islandId = remapIsland(plain.islandId);
      const enc = await encryptJSON(liveKey, plain);
      await db.putEncrypted(s, { id: row.id, ct: enc.ct, iv: enc.iv, updatedAt: row.updatedAt });
      a++;
    }
    added[s] = a; skipped[s] = sk;
  }

  return { mode: 'merge', added, skipped };
}
