// Navigation, Team-Auswahl und kleine Hilfen.
import { signal } from '@preact/signals';
import { liveQuery } from 'dexie';
import { useEffect, useState } from 'preact/hooks';
import type { Kategorie, Team } from './model';
import { db, ensureTeam } from './db';
import { prefs, savePrefs } from './prefs';

export type Route =
  | { name: 'home' }
  | { name: 'roster' }
  | { name: 'newMatch' }
  | { name: 'scout'; matchId: number }
  | { name: 'report'; matchId: number }
  | { name: 'settings' };

export const route = signal<Route>({ name: 'home' });
export const team = signal<Team | null>(null);
export const toastMsg = signal<string | null>(null);

export function go(r: Route) {
  route.value = r;
  window.scrollTo(0, 0);
}

let toastTimer: number | undefined;
export function toast(msg: string) {
  toastMsg.value = msg;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toastMsg.value = null), 2600);
}

/** Liest Daten aus der Datenbank und aktualisiert die Ansicht bei jeder Änderung. */
export function useLive<T>(query: () => Promise<T> | T, deps: unknown[], initial: T): T {
  const [val, setVal] = useState<T>(initial);
  useEffect(() => {
    const sub = liveQuery(query).subscribe({ next: setVal, error: (e) => console.error(e) });
    return () => sub.unsubscribe();
  }, deps);
  return val;
}

export function applyTeamColors(t: Team | null) {
  const r = document.documentElement;
  r.style.setProperty('--brand', t?.color1 || '#1f5fbf');
  r.style.setProperty('--brand2', t?.color2 || '#f5c518');
}

export function fmtDate(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function todayIso() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export async function reloadTeam() {
  let t = prefs.value.teamId != null ? await db.teams.get(prefs.value.teamId) : undefined;
  if (!t) {
    t = await ensureTeam();
    await savePrefs({ teamId: t.id! });
  }
  team.value = t;
}

// ---------- Eigene Rückfrage-Dialoge (statt confirm/prompt des Browsers) ----------
export interface AskState {
  text: string;
  ok: string;
  input?: { placeholder: string };
  resolve: (v: string | null) => void;
}
export const askState = signal<AskState | null>(null);

/** Ja/Nein-Rückfrage. */
export function ask(text: string, ok = 'Ja'): Promise<boolean> {
  return new Promise((res) => (askState.value = { text, ok, resolve: (v) => res(v !== null) }));
}
/** Frage mit Texteingabe. Ergibt null bei Abbrechen. */
export function askText(text: string, placeholder = '', ok = 'OK'): Promise<string | null> {
  return new Promise((res) => (askState.value = { text, ok, input: { placeholder }, resolve: res }));
}

// ---------- Mannschaften ----------

/** Anrede passend zur Mannschaft: Damen "Spielerin", Herren und Mixed "Spieler". */
export function words(t: Team | null = team.value) {
  const m = t?.kategorie === 'herren' || t?.kategorie === 'mixed';
  return {
    one: m ? 'Spieler' : 'Spielerin',
    many: m ? 'Spieler' : 'Spielerinnen',
    top: m ? 'Top-Scorer' : 'Top-Scorerin',
  };
}

export async function switchTeam(id: number) {
  await savePrefs({ teamId: id });
  await reloadTeam();
}

export async function createTeam(name: string, kategorie: Kategorie, liga: string): Promise<number> {
  const cur = team.value;
  const id = await db.teams.add({
    name, kategorie, liga, color1: cur?.color1 ?? '#1f5fbf', color2: cur?.color2 ?? '#f5c518', logo: cur?.logo,
  });
  await switchTeam(id);
  return id;
}

/** Löscht eine Mannschaft mit Kader, Spielen und allen Aktionen. */
export async function deleteTeam(id: number) {
  await db.transaction('rw', [db.teams, db.players, db.matches, db.actions], async () => {
    const matchIds = (await db.matches.where('teamId').equals(id).toArray()).map((m) => m.id!);
    await db.actions.where('matchId').anyOf(matchIds).delete();
    await db.matches.where('teamId').equals(id).delete();
    await db.players.where('teamId').equals(id).delete();
    await db.teams.delete(id);
  });
  const next = await db.teams.toCollection().first();
  await savePrefs({ teamId: next?.id ?? null });
  await reloadTeam();
}
