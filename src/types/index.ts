// ---------------------------------------------------------------------------
// Domain types — deliberately minimal. Every record has just the fields an
// officer needs to fill in quickly on a phone; nothing here is hard-coded
// per-island since Island is just a lookup list.
// ---------------------------------------------------------------------------

export type ID = string;

export interface AuditFields {
  createdAt: string;
  updatedAt: string;
}

export interface Island {
  id: ID;
  name: string;
}

export type PersonCategory = 'Person of Interest' | 'Suspected User' | 'Suspected Dealer' | 'Cleared';

export interface Person extends AuditFields {
  id: ID;
  name: string;
  alias?: string;
  islandId: ID;
  category: PersonCategory;
  notes?: string;
}

export type Level = 'Low' | 'Medium' | 'High';

export interface Informant extends AuditFields {
  id: ID;
  codeName: string; // never a real name — that's the whole point of a code name
  islandId: ID;
  reliability: Level;
  notes?: string;
}

export type ReportStatus = 'Open' | 'Closed';

export interface Report extends AuditFields {
  id: ID;
  title: string;
  islandId: ID;
  date: string; // ISO date
  confidence: Level;
  description?: string;
  status: ReportStatus;
}

export type TaskPriority = 'Low' | 'Medium' | 'High';

export interface TaskItem extends AuditFields {
  id: ID;
  title: string;
  due?: string; // ISO date
  priority: TaskPriority;
  done: boolean;
}

export interface AppSettingsRecord {
  id: 'settings';
  officerCallsign: string;
  agencyLabel: string;
  inactivityTimeoutMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface CryptoConfigRecord {
  id: 'crypto-config';
  salt: number[];
  verifier: string;
  verifierIv: number[];
  iterations: number;
  createdAt: string;
}
