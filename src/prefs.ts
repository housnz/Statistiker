// Einstellungen (Darstellung). Gespeichert in der lokalen Datenbank.
import { signal } from '@preact/signals';
import { db } from './db';
import type { ElementKey, Mode } from './model';

export interface Prefs {
  theme: 'auto' | 'hell' | 'dunkel';
  buttonSize: 'normal' | 'gross';
  defaultMode: Mode;
  hidden: ElementKey[]; // ausgeblendete Elemente
  teamId: number | null;
}

export const DEFAULT_PREFS: Prefs = {
  theme: 'auto',
  buttonSize: 'normal',
  defaultMode: 'simpel',
  hidden: [],
  teamId: null,
};

export const prefs = signal<Prefs>(DEFAULT_PREFS);

export async function loadPrefs() {
  const row = await db.settings.get('prefs');
  prefs.value = { ...DEFAULT_PREFS, ...((row?.value as Partial<Prefs>) ?? {}) };
}

export async function savePrefs(patch: Partial<Prefs>) {
  prefs.value = { ...prefs.value, ...patch };
  await db.settings.put({ key: 'prefs', value: prefs.value });
}
