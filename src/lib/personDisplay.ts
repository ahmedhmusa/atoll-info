import type { Person, PersonCategory } from '../types';

// Defensive fallback for any record saved under a previous, simpler person
// shape (single `name`/`category`) so old data doesn't crash the UI.
export function displayName(p: any): string {
  return p.fullName || p.name || 'Unnamed';
}

export function displayCategories(p: any): PersonCategory[] {
  if (Array.isArray(p.categories)) return p.categories;
  if (p.category) return [p.category];
  return [];
}

export function primaryCategoryColor(p: Person | any): string {
  const cats = displayCategories(p);
  if (cats.includes('Dealer') || cats.includes('Street Dealer')) return 'var(--danger)';
  if (cats.includes('Carrier') || cats.includes('Theft')) return 'var(--warn)';
  if (cats.includes('Drug User')) return 'var(--accent)';
  return 'var(--text-dim)';
}

// One distinct color per category, used for the network map slices + legend.
export const CATEGORY_COLORS: Record<string, string> = {
  'Dealer': 'var(--danger)',
  'Street Dealer': '#ff7a59',
  'Carrier': 'var(--warn)',
  'Theft': '#8e7cd9',
  'Drug User': 'var(--accent)',
  'Person of Interest': 'var(--text-dim)',
};

export function categoryColor(c: string): string {
  return CATEGORY_COLORS[c] ?? 'var(--text-dim)';
}

/** Nickname when there is one, otherwise the full name — shortened for small labels. */
export function shortLabel(p: any, max = 14): string {
  const label = (p.nickname ?? '').trim() || displayName(p);
  return label.length > max ? label.slice(0, max - 1) + '…' : label;
}

// Rough position in the supply chain, used only to decide which way an
// arrow should point on the network map — lower number = further upstream
// (closer to the source of supply). Categories with no clear chain
// position (Theft, Person of Interest) return null, so links involving
// only those stay undirected.
const CHAIN_RANK: Partial<Record<string, number>> = {
  'Dealer': 0,
  'Street Dealer': 1,
  'Carrier': 1,
  'Drug User': 2,
};

export function personChainRank(p: any): number | null {
  const cats = displayCategories(p);
  const ranks = cats.map((c) => CHAIN_RANK[c]).filter((r): r is number => r !== undefined);
  return ranks.length ? Math.min(...ranks) : null;
}
