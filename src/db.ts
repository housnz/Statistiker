// Lokale Datenbank im Browser (IndexedDB). Nichts verlässt das Gerät.
import Dexie, { Table } from 'dexie';
import type { Action, Match, Player, Team } from './model';

export interface Setting {
  key: string;
  value: unknown;
}

class StatistikerDB extends Dexie {
  teams!: Table<Team, number>;
  players!: Table<Player, number>;
  matches!: Table<Match, number>;
  actions!: Table<Action, number>;
  settings!: Table<Setting, string>;

  constructor() {
    super('statistiker');
    this.version(1).stores({
      teams: '++id',
      players: '++id, teamId',
      matches: '++id, teamId, date',
      actions: '++id, matchId, [matchId+set], [matchId+seq]',
      settings: 'key',
    });
  }
}

export const db = new StatistikerDB();

/** Bittet den Browser, die Daten nicht automatisch zu löschen. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* nicht unterstützt */
  }
  return false;
}

export async function ensureTeam(): Promise<Team> {
  const first = await db.teams.toCollection().first();
  if (first) return first;
  const id = await db.teams.add({ name: 'Meine Mannschaft', kategorie: 'damen', color1: '#1f5fbf', color2: '#f5c518' });
  return (await db.teams.get(id))!;
}

// ---------- Backup ----------

export interface Backup {
  app: 'statistiker';
  version: 1;
  created: string;
  teams: Team[];
  players: Player[];
  matches: Match[];
  actions: Action[];
  settings: Setting[];
}

export async function exportBackup(): Promise<Backup> {
  return {
    app: 'statistiker',
    version: 1,
    created: new Date().toISOString(),
    teams: await db.teams.toArray(),
    players: await db.players.toArray(),
    matches: await db.matches.toArray(),
    actions: await db.actions.toArray(),
    settings: await db.settings.toArray(),
  };
}

export async function importBackup(b: Backup) {
  if (b?.app !== 'statistiker') throw new Error('Das ist keine Statistiker-Sicherung.');
  await db.transaction('rw', [db.teams, db.players, db.matches, db.actions, db.settings], async () => {
    await Promise.all([db.teams.clear(), db.players.clear(), db.matches.clear(), db.actions.clear(), db.settings.clear()]);
    await db.teams.bulkAdd(b.teams);
    await db.players.bulkAdd(b.players);
    await db.matches.bulkAdd(b.matches);
    await db.actions.bulkAdd(b.actions);
    await db.settings.bulkAdd(b.settings);
  });
}

export function downloadFile(name: string, content: BlobPart, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
