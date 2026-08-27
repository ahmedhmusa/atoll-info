import type { Island } from '../types';
import { newId } from './util';

const NAMES = [
  'Hulhumale', 'Maafushi', 'Thulusdhoo', 'Guraidhoo', 'Dhiffushi', 'Huraa',
  'Himmafushi', 'Gulhi', 'Kaashidhoo', 'Rasdhoo', 'Ukulhas', 'Mathiveri', 'Feridhoo',
];

export function seedIslands(): Island[] {
  return NAMES.map((name) => ({ id: newId(), name }));
}
