// Erfundene Beispieldaten zum Ausprobieren. Keine echten Namen.
import { db } from './db';
import type { Action, Player } from './model';
import { todayIso } from './state';

const NAMES: [string, number, Player['position']][] = [
  ['Anna', 4, 'Außen'], ['Bea', 7, 'Außen'], ['Clara', 11, 'Mitte'], ['Dana', 9, 'Mitte'],
  ['Eva', 2, 'Zuspiel'], ['Fiona', 13, 'Diagonal'], ['Greta', 1, 'Libero'], ['Hanna', 5, 'Außen'],
];

export async function createDemoTeam(): Promise<number> {
  const teamId = await db.teams.add({ name: 'Demo-Team', kategorie: 'damen', liga: 'Testliga', color1: '#1f5fbf', color2: '#f5c518' });
  const ids: number[] = [];
  for (let i = 0; i < NAMES.length; i++) {
    const [name, number, position] = NAMES[i];
    ids.push(await db.players.add({ teamId, name, number, position, order: i + 1, active: true }));
  }
  // Ein erfundenes Spiel über drei Sätze, zufällig, aber stimmig.
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const attackers = [ids[0], ids[1], ids[2], ids[3], ids[5], ids[7]];
  const receivers = [ids[0], ids[1], ids[6], ids[7]];
  const servers = ids.filter((_, i) => i !== 6); // Libero schlägt nicht auf
  const matchId = await db.matches.add({
    teamId, date: todayIso(), opponent: 'TSV Musterstadt', place: 'Sporthalle', league: 'Testspiel', mode: 'simpel',
    playerIds: ids, sets: [{ nr: 1, final: [25, 21] }, { nr: 2, final: [23, 25] }, { nr: 3, final: [25, 18] }], currentSet: 3, finished: true, createdAt: Date.now(),
  });
  const acts: Action[] = [];
  let seq = 0;
  const add = (set: number, a: Partial<Action>) => acts.push({ matchId, set, seq: ++seq, ts: Date.now(), playerId: null, element: 'opp', result: 'P', ...a } as Action);
  for (const [set, [us, them]] of [[1, [25, 21]], [2, [23, 25]], [3, [25, 18]]] as [number, [number, number]][]) {
    let u = 0, t = 0;
    while (u < us || t < them) {
      const weWin = u < us && (t >= them || rnd() < us / (us + them));
      if (rnd() < 0.5) add(set, { playerId: pick(receivers), element: 'rec', result: pick(['P', 'G', 'G', 'O', 'S']), pos: pick([1, 5, 6]) });
      if (rnd() < 0.45) add(set, { playerId: pick(attackers), element: 'att', result: 'N', pos: pick([4, 4, 4, 3, 2, 2, 6, 1]) });
      if (rnd() < 0.3) add(set, { playerId: pick(servers), element: 'srv', result: pick(['G', 'O', 'S']) });
      if (weWin) {
        const r = rnd();
        if (r < 0.55) add(set, { playerId: pick(attackers), element: 'att', result: 'K', pos: pick([4, 4, 4, 3, 3, 2, 2, 6, 1]) });
        else if (r < 0.68) add(set, { playerId: pick(servers), element: 'srv', result: 'A' });
        else if (r < 0.78) add(set, { playerId: pick([ids[2], ids[3], ids[5]]), element: 'blk', result: 'K' });
        else if (r < 0.9) add(set, { element: 'opp', result: 'SE' });
        else add(set, { element: 'opp', result: 'F' });
        u++;
      } else {
        const r = rnd();
        if (r < 0.15) add(set, { playerId: pick(attackers), element: 'att', result: 'E', pos: pick([4, 3, 2]) });
        else if (r < 0.25) add(set, { playerId: pick(attackers), element: 'att', result: 'B', pos: pick([4, 2]) });
        else if (r < 0.37) add(set, { playerId: pick(servers), element: 'srv', result: 'E' });
        else if (r < 0.45) add(set, { playerId: pick(receivers), element: 'rec', result: 'E', pos: pick([1, 5, 6]) });
        else if (r < 0.5) add(set, { playerId: pick([ids[2], ids[3]]), element: 'blk', result: 'E' });
        else if (r < 0.55) add(set, { playerId: pick(ids), element: 'oth', result: 'E' });
        else add(set, { element: 'opp', result: 'P' });
        t++;
      }
    }
  }
  // Satz 3: zwei Punkte "vergessen", damit die Prüfung etwas zeigt.
  const s3 = acts.filter((a) => a.set === 3 && a.element === 'opp' && a.result === 'SE').slice(0, 2);
  await db.actions.bulkAdd(acts.filter((a) => !s3.includes(a)));
  return teamId;
}
