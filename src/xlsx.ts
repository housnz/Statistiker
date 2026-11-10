// Excel-Export (.xlsx) mit mehreren Tabellenblättern, direkt im Browser erzeugt.
import writeExcelFile from 'write-excel-file/browser';
import { Action, EL, Match, Player, Team, effectOf, resultDef } from './model';
import { proStats, replaySet } from './rally';
import { PlayerStats, setSummary, statsByPlayer, teamStats } from './stats';
import { setsWon } from './screens/Home';

type Cell = { value: string | number | null; type?: typeof String | typeof Number; format?: string; fontWeight?: 'bold'; backgroundColor?: string; textColor?: string; align?: 'left' | 'right' | 'center'; columnSpan?: number } | null;
type Row = Cell[];

const head = (v: string): Cell => ({ value: v, type: String, fontWeight: 'bold', backgroundColor: '#16181D', textColor: '#FFFFFF' });
const txt = (v: string | null | undefined, bold = false): Cell => ({ value: v ?? '', type: String, ...(bold ? { fontWeight: 'bold' as const } : {}) });
const num = (v: number | null | undefined, bold = false): Cell => (v == null ? { value: null } : { value: v, type: Number, ...(bold ? { fontWeight: 'bold' as const } : {}) });
const pct = (n: number, d: number, bold = false): Cell => (d ? { value: n / d, type: Number, format: '0%', ...(bold ? { fontWeight: 'bold' as const } : {}) } : { value: null });
const title = (v: string): Cell => ({ value: v, type: String, fontWeight: 'bold', textColor: '#D7262E' });

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
function fmtTime(t?: number) {
  if (t == null) return '';
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
}

export async function buildXlsx({ match, actions, players, team }: { match: Match; actions: Action[]; players: Player[]; team: Team }): Promise<Blob> {
  const male = team.kategorie === 'herren' || team.kategorie === 'mixed';
  const P1 = male ? 'Spieler' : 'Spielerin';
  const pmap = new Map(players.map((p) => [p.id!, p]));
  const sets = match.sets.filter((s) => s.final || actions.some((a) => a.set === s.nr));
  const sums = sets.map((s) => setSummary(s.nr, s.final, actions.filter((a) => a.set === s.nr)));
  const [won, lost] = setsWon(match);
  const byP = statsByPlayer(actions);
  const tot = teamStats(actions);
  const rows = players.filter((p) => byP.has(p.id!)).map((p) => ({ p, s: byP.get(p.id!)! }));
  const profi = match.mode === 'profi';

  // ---------- Übersicht ----------
  const over: Row[] = [
    [title(`Matchstatistik gegen ${match.opponent}`)],
    [null],
    [txt('Mannschaft', true), txt(team.name)],
    [txt('Gegner', true), txt(match.opponent)],
    [txt('Datum', true), txt(fmtDate(match.date))],
    [txt('Ort', true), txt(match.place)],
    [txt('Liga', true), txt(match.league)],
    [txt('Modus', true), txt(profi ? 'Profi' : 'Simpel')],
    [txt('Ergebnis', true), txt(`${won}:${lost}`)],
    [null],
    ['Satz', 'Wir', 'Gegner', 'Angriffspunkte', 'Asse', 'Blockpunkte', 'Gegnerfehler', 'nicht notiert', 'eigene Fehler', 'vom Gegner erspielt'].map(head),
    ...sums.map((s) => [num(s.nr), num(s.final?.[0] ?? s.counted[0]), num(s.final?.[1] ?? s.counted[1]), num(s.ownPoints.att), num(s.ownPoints.srv), num(s.ownPoints.blk), num(s.ownPoints.oppSrv + s.ownPoints.oppF), num(s.missing), num(s.ownErrors), num(s.oppEarned)]),
  ];

  // ---------- Alle Werte ----------
  const statHead = ['Nr.', P1, 'Position', 'Punkte', 'Fehler', 'Bilanz',
    'Angriffe', 'Angriff Punkt', 'Angriff im Spiel', 'Angriff geblockt', 'Angriff Fehler', 'Kill-Quote', 'Effizienz',
    'Aufschläge', 'Ass', 'Aufschlag gut', 'Aufschlag ok', 'Aufschlag schlecht', 'Aufschlag Fehler',
    'Annahmen', 'Annahme perfekt', 'Annahme gut', 'Annahme ok', 'Annahme schlecht', 'Annahme Fehler', 'Annahme positiv',
    'Blockpunkte', 'Block Touch', 'Blockfehler', 'Sonstige Fehler',
    ...(profi ? ['Zuspiele', 'Zuspiel gut angreifbar', 'Zuspiel eingeschränkt', 'Zuspiel nicht angreifbar', 'Zuspielfehler', 'Abwehr', 'Abwehr gut', 'Abwehr ok', 'Abwehrfehler (vermeidbar)', 'Abwehr unhaltbar'] : [])];
  const statRow = (nr: number | null, name: string, pos: string, s: PlayerStats, b = false): Row => [
    num(nr, b), txt(name, b), txt(pos, b), num(s.points, b), num(s.errors, b), num(s.balance, b),
    num(s.att, b), num(s.attK, b), num(s.attN, b), num(s.attB, b), num(s.attE, b), pct(s.attK, s.att, b), pct(s.attK - s.attE - s.attB, s.att, b),
    num(s.srv, b), num(s.srvA, b), num(s.srvG, b), num(s.srvO, b), num(s.srvS, b), num(s.srvE, b),
    num(s.rec, b), num(s.recP, b), num(s.recG, b), num(s.recO, b), num(s.recS, b), num(s.recE, b), pct(s.recP + s.recG, s.rec, b),
    num(s.blkK, b), num(s.blkT, b), num(s.blkE, b), num(s.othE, b),
    ...(profi ? [num(s.set, b), num(s.setG, b), num(s.setL, b), num(s.setN, b), num(s.setE, b), num(s.dig, b), num(s.digG, b), num(s.digO, b), num(s.digE, b), num(s.digU, b)] : []),
  ];
  const all: Row[] = [statHead.map(head), ...rows.map(({ p, s }) => statRow(p.number, p.name, p.position, s)), statRow(null, 'Team', '', tot, true)];

  // ---------- Pro Satz ----------
  const perSet: Row[] = [['Satz', ...statHead].map(head)];
  for (const s of sums) {
    const acts = actions.filter((a) => a.set === s.nr);
    const sp = statsByPlayer(acts);
    for (const p of players) if (sp.has(p.id!)) perSet.push([num(s.nr), ...statRow(p.number, p.name, p.position, sp.get(p.id!)!)]);
    perSet.push([num(s.nr, true), ...statRow(null, 'Team', '', teamStats(acts), true)]);
  }

  // ---------- Aktionen ----------
  const rallyInfo = new Map<number, { rally: number; rot: number; score: string; server: string }>();
  if (profi) {
    for (const s of match.sets) {
      const st = replaySet(s, actions.filter((a) => a.set === s.nr), pmap);
      for (const r of [...st.rallies, st.current]) for (const a of r.actions) rallyInfo.set(a.id!, { rally: r.nr, rot: r.rot, score: r.winner ? `${r.score[0]}:${r.score[1]}` : '', server: r.server === 'us' ? 'wir' : 'Gegner' });
    }
  }
  const actHead = ['Nr.', 'Satz', ...(profi ? ['Ballwechsel', 'Läufer', 'Aufschlag', 'Stand danach'] : []), 'Nummer', 'Name', 'Element', 'Ergebnis', 'Position', 'Zielzone', 'Wirkung', ...(profi ? ['Videozeit', 'Videozeit (s)'] : [])];
  const acts: Row[] = [actHead.map(head)];
  actions.forEach((a, i) => {
    const p = a.playerId != null ? pmap.get(a.playerId) : undefined;
    const e = effectOf(a);
    const ri = rallyInfo.get(a.id!);
    const isSub = a.element === 'sub';
    acts.push([
      num(i + 1), num(a.set),
      ...(profi ? [num(ri?.rally), num(ri?.rot || null), txt(ri?.server), txt(ri?.score)] : []),
      num(p?.number ?? null), txt(isSub ? `${p?.name ?? ''} für ${pmap.get(a.out!)?.name ?? ''}` : p ? p.name : 'Gegner'),
      txt(EL[a.element]?.label ?? a.element), txt(isSub ? 'Wechsel' : resultDef(a)?.label ?? a.result),
      num(a.pos ?? null), num(a.to ?? null),
      txt(e === 'point' ? 'Punkt' : e === 'error' ? 'Fehler' : e === 'opppoint' ? 'Gegnerpunkt' : ''),
      ...(profi ? [txt(fmtTime(a.vt)), num(a.vt ?? null)] : []),
    ]);
  });

  const sheets: { data: Row[]; sheet: string; columns?: { width: number }[]; stickyRowsCount?: number; stickyColumnsCount?: number }[] = [
    { data: over, sheet: 'Übersicht', columns: [{ width: 14 }, { width: 22 }, ...Array(8).fill({ width: 13 })] },
    { data: all, sheet: 'Alle Werte', columns: [{ width: 6 }, { width: 18 }, { width: 11 }, ...Array(statHead.length - 3).fill({ width: 11 })], stickyRowsCount: 1, stickyColumnsCount: 2 },
    { data: perSet, sheet: 'Pro Satz', columns: [{ width: 6 }, { width: 6 }, { width: 18 }, { width: 11 }, ...Array(statHead.length - 3).fill({ width: 11 })], stickyRowsCount: 1, stickyColumnsCount: 3 },
    { data: acts, sheet: 'Aktionen', columns: actHead.map((h) => ({ width: h === 'Name' ? 22 : h.length > 9 ? 13 : 10 })), stickyRowsCount: 1 },
  ];

  if (profi) {
    const ps = proStats(match.sets, actions, pmap);
    const rot: Row[] = [
      ['Läufer', 'Sideout gewonnen', 'Sideout Ballwechsel', 'Sideout %', 'Break gewonnen', 'Break Ballwechsel', 'Break %', 'Punkte', 'Gegnerpunkte', '+/−'].map(head),
      ...ps.perRot.map((r) => [num(r.rot), num(r.soWon), num(r.soAll), pct(r.soWon, r.soAll), num(r.bpWon), num(r.bpAll), pct(r.bpWon, r.bpAll), num(r.won), num(r.lost), num(r.won - r.lost)]),
      [txt('Gesamt', true), num(ps.sideout.won, true), num(ps.sideout.all, true), pct(ps.sideout.won, ps.sideout.all, true), num(ps.breakp.won, true), num(ps.breakp.all, true), pct(ps.breakp.won, ps.breakp.all, true), null, null, null],
      [null],
      [txt('First-Ball-Sideout', true), num(ps.fbso.won), num(ps.fbso.all), pct(ps.fbso.won, ps.fbso.all)],
      [null],
      ['Angriff', 'Angriffe', 'Punkte', 'geblockt', 'Fehler', 'Kill-Quote', 'Effizienz'].map(head),
      ...([['nach Annahme', ps.attAfterRec], ['Konter', ps.attTransition]] as const).map(([l, x]) => [txt(l), num(x.all), num(x.k), num(x.b), num(x.e), pct(x.k, x.all), pct(x.k - x.e - x.b, x.all)]),
    ];
    sheets.splice(2, 0, { data: rot, sheet: 'Läufer', columns: Array(10).fill({ width: 15 }), stickyRowsCount: 1 });
  }

  return await writeExcelFile(sheets as never, { fontFamily: 'Calibri', fontSize: 11 } as never).toBlob();
}

export function xlsxName(match: Match) {
  const safe = match.opponent.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
  return `Statistik-${safe}-${match.date}.xlsx`;
}
