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
