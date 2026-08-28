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

export type PersonCategory = 'Dealer' | 'Drug User' | 'Person of Interest';
export type DrugType = 'Cocaine' | 'Heroin' | 'Cannabis' | 'Party Drugs' | 'Alcohol' | 'Meth';
export type FlagStatus = 'None' | 'Jailed' | 'Faruvaa' | 'On-Watch' | 'On Investigation';

export interface Person extends AuditFields {
  id: ID;
  fullName: string;
  nickname?: string;
  idCardNumber?: string;
  dateOfBirth?: string; // ISO date
  address?: string;
  contactNumber?: string;
  islandId: ID;
  categories: PersonCategory[]; // multi-select
  drugTypes: DrugType[]; // multi-select
  networkConnections?: string; // free text — known associates/supply chain links
  notes?: string;
  flagStatus: FlagStatus;
  photoDataUrl?: string; // full/reference photo
  idPhotoDataUrl?: string; // ID card photo
}

export type Level = 'Low' | 'Medium' | 'High';

export interface Informant extends AuditFields {
  id: ID;
  codeName: string; // never a real name — that's the whole point of a code name
  islandId: ID;
  reliability: Level;
  notes?: string;
  photoDataUrl?: string; // optional — e.g. a covert reference photo, if the officer has one
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
