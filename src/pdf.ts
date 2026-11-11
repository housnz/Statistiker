// PDF-Matchstatistik, direkt im Browser erzeugt (jsPDF). Aufbau wie die bisherigen Auswertungen.
// Fazit und Feedback bleiben neutral (nur Zahlen). Grün/Rot nur in Grafiken.
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import fontRegular from './assets/pdf-fonts/PlexSans-Regular.ttf?url';
import fontSemi from './assets/pdf-fonts/PlexSans-SemiBold.ttf?url';
import fontCond from './assets/pdf-fonts/PlexCond-Bold.ttf?url';
import fontBarlow from './assets/pdf-fonts/BarlowCond-ExtraBold.ttf?url';
import appLogo from './assets/logo.webp';
import { Action, Match, Player, Team, distribution } from './model';
import { proStats, zoneStats } from './rally';
import { PlayerStats, pct, pctLabel, setSummary, statsByPlayer, teamStats } from './stats';
import { setsWon } from './screens/Home';

const W = 595.28, H = 841.89, M = 36; // A4, Rand etwa 13 mm
const CW = W - 2 * M;
const C = {
  ink: '#16181d', muted: '#5c6370', rule: '#d3d8e0', soft: '#f3f4f6', soft2: '#e9ecf1',
  att: '#1d8a4c', ace: '#57b97a', blk: '#0f9488', opp: '#8a94a6', err: '#d7262e', earned: '#c3c9d4',
  p4: '#3b82f6', p3: '#14b8a6', p2: '#a855f7', back: '#f97316', so: '#3b82f6', bp: '#14b8a6',
};

/** Farben der Kategorien in Tabellen. Bewusst kein Grün und Rot, weil keine Wertung. */
const CAT = {
  ges: '#16181d', att: '#2563eb', srv: '#0d9488', rec: '#7c3aed', blk: '#c2410c', oth: '#64748b',
};

async function b64(url: string): Promise<string> {
  const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

async function toPng(src: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement('canvas');
    const s = Math.min(1, 600 / Math.max(img.width, img.height));
    c.width = Math.round(img.width * s);
    c.height = Math.round(img.height * s);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return { data: c.toDataURL('image/png'), w: c.width, h: c.height };
  } catch {
    return null;
  }
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
const sgn = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
const pl = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export interface PdfInput { match: Match; actions: Action[]; players: Player[]; team: Team }

export async function buildPdf({ match, actions, players, team }: PdfInput): Promise<Blob> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  for (const [url, file, fam, style] of [
    [fontRegular, 'PlexSans-Regular.ttf', 'Plex', 'normal'], [fontSemi, 'PlexSans-SemiBold.ttf', 'Plex', 'bold'],
    [fontCond, 'PlexCond-Bold.ttf', 'Cond', 'bold'], [fontBarlow, 'BarlowCond-ExtraBold.ttf', 'Big', 'bold'],
  ] as const) {
    doc.addFileToVFS(file, await b64(url));
    doc.addFont(file, fam, style);
  }
  const accent = team.color1 || '#d7262e';
  const logo = await toPng(team.logo || appLogo);
  const male = team.kategorie === 'herren' || team.kategorie === 'mixed';
  const P1 = male ? 'Spieler' : 'Spielerin';
  const TOP = male ? 'Top-Scorer' : 'Top-Scorerin';

  // ---------- Daten ----------
  const pmap = new Map(players.map((p) => [p.id!, p]));
  const sets = match.sets.filter((s) => s.final || actions.some((a) => a.set === s.nr));
  const sums = sets.map((s) => setSummary(s.nr, s.final, actions.filter((a) => a.set === s.nr)));
  const byP = statsByPlayer(actions);
  const tot = teamStats(actions);
  const rows = players.filter((p) => byP.has(p.id!)).map((p) => ({ p, s: byP.get(p.id!)! }));
  const ranked = [...rows].sort((a, b) => b.s.points - a.s.points);
  const [won, lost] = setsWon(match);
  const oppSE = actions.filter((a) => a.element === 'opp' && a.result === 'SE').length;
  const oppF = actions.filter((a) => a.element === 'opp' && a.result === 'F').length;
  const ownPts = sums.reduce((n, s) => n + s.ownPoints.att + s.ownPoints.srv + s.ownPoints.blk + s.ownPoints.oppSrv + s.ownPoints.oppF, 0);
  const missing = sums.reduce((n, s) => n + Math.max(0, s.missing), 0);
  const dist = distribution(actions);
  const name = (p?: Player) => (p ? p.name : '');
  const title = `Matchstatistik gegen ${match.opponent}`;
  const resultWord = won > lost ? 'gewinnt' : won < lost ? 'verliert' : 'spielt';

  // ---------- Hilfen ----------
  const font = (f: 'Plex' | 'Cond' | 'Big', size: number, bold = false, color = C.ink) => {
    doc.setFont(f, f === 'Plex' && !bold ? 'normal' : 'bold');
    doc.setFontSize(size);
    doc.setTextColor(color);
  };
  const para = (text: string, x: number, y: number, w: number, size = 9, color = C.ink, lh = 1.4) => {
    font('Plex', size, false, color);
    const lines = doc.splitTextToSize(text, w) as string[];
    doc.text(lines, x, y, { baseline: 'top', lineHeightFactor: lh });
    return y + lines.length * size * lh;
  };
  const h2 = (text: string, y: number) => {
    font('Cond', 14);
    doc.text(text, M, y, { baseline: 'top' });
    return y + 22;
  };
  const kicker = (text: string, x: number, y: number, color = C.muted) => {
    font('Plex', 7, true, color);
    doc.setCharSpace(0.6);
    doc.text(text.toUpperCase(), x, y, { baseline: 'top' });
    doc.setCharSpace(0);
  };
  const rect = (x: number, y: number, w: number, h: number, color: string, r = 0) => {
    doc.setFillColor(color);
    r ? doc.roundedRect(x, y, w, h, r, r, 'F') : doc.rect(x, y, w, h, 'F');
  };
  const dashed = (x: number, y: number, w: number, h: number, color: string) => {
    doc.setDrawColor(color);
    doc.setLineWidth(0.8);
    doc.setLineDashPattern([2, 1.5], 0);
    doc.rect(x, y, w, h, 'S');
    doc.setLineDashPattern([], 0);
  };
  const legend = (items: [string, string, boolean?][], x: number, y: number) => {
    font('Plex', 7.5, false, C.muted);
    let cx = x;
    for (const [label, color, dash] of items) {
      dash ? dashed(cx, y, 8, 8, color) : rect(cx, y, 8, 8, color, 1.5);
      doc.text(label, cx + 11, y + 0.5, { baseline: 'top' });
      cx += 11 + doc.getTextWidth(label) + 14;
    }
  };
  const tableBase = {
    theme: 'plain' as const,
    margin: { left: M, right: M, bottom: M + 18 },
    styles: { font: 'Plex', fontStyle: 'normal' as const, fontSize: 8, cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 }, textColor: C.ink, lineColor: C.rule, lineWidth: { bottom: 0.5 } as never },
    headStyles: { font: 'Plex', fontStyle: 'bold' as const, fontSize: 7, textColor: C.muted, lineWidth: { bottom: 1 } as never, lineColor: C.ink },
  };
  /** Tabelle mit farbigen Kategorien: Kopf in der Kategorie-Farbe, Spalten leicht getönt, Trennlinie zwischen den Kategorien.
   *  Die letzte Zeile ist die Team-Zeile (fett). */
  const catTable = (startY: number, groups: [string, string, string[]][], body: (string | number)[][], firstW: number, size: number) => {
    const colCat: string[] = [''];
    const groupStart = new Set<number>();
    for (const [, col, subs] of groups) { groupStart.add(colCat.length); subs.forEach(() => colCat.push(col)); }
    const n = colCat.length;
    autoTable(doc, {
      ...tableBase, startY,
      styles: { ...tableBase.styles, fontSize: size, cellPadding: { top: 3, bottom: 3, left: 2.5, right: 3 } },
      head: [
        [{ content: '' }, ...groups.map(([lab, col, subs]) => ({ content: lab.toUpperCase(), colSpan: subs.length, styles: { halign: 'center' as const, fillColor: col, textColor: '#ffffff', fontSize: 7.5, lineWidth: 0 } }))],
        [P1, ...groups.flatMap(([, , subs]) => subs)],
      ],
      body,
      // Zahlen nie umbrechen. Die Namensspalte nimmt den Rest (firstW = 0) oder hat eine feste Breite.
      columnStyles: { 0: firstW ? { cellWidth: firstW } : { cellWidth: 'auto' as const }, ...Object.fromEntries([...Array(n).keys()].slice(1).map((i) => [i, { halign: 'right' as const, cellWidth: 'wrap' as const }])) },
      didParseCell: (d) => {
        alignHead(d as never);
        if (d.section === 'head' && d.row.index === 0) d.cell.styles.halign = 'center';
        const i = d.column.index;
        const team = d.section === 'body' && d.row.index === body.length - 1;
        if (team) d.cell.styles.fontStyle = 'bold';
        if (i === 0) { if (team) d.cell.styles.fillColor = C.soft2; return; }
        const col = colCat[i];
        if (d.section === 'head' && d.row.index === 1) { d.cell.styles.fillColor = mix(col, 0.16); d.cell.styles.textColor = col === CAT.ges ? C.ink : col; }
        if (d.section === 'body') d.cell.styles.fillColor = mix(col, team ? 0.16 : col === CAT.ges ? 0.02 : 0.06);
      },
      didDrawCell: (d) => {
        if (d.column.index === 0 || !groupStart.has(d.column.index)) return;
        doc.setDrawColor('#ffffff'); doc.setLineWidth(2);
        doc.line(d.cell.x, d.cell.y, d.cell.x, d.cell.y + d.cell.height);
      },
    });
  };
  // Überschriften wie die Spalte darunter ausrichten (Zahlen rechts).
  const alignHead = (d: { section: string; column: { index: number }; cell: { styles: { halign?: string } }; row: { raw: unknown } }) => {
    if (d.section === 'head' && d.column.index > 0 && ((d.cell as { colSpan?: number }).colSpan ?? 1) === 1) d.cell.styles.halign = 'right';
    if (d.section === 'head' && ((d.cell as { colSpan?: number }).colSpan ?? 1) > 1) d.cell.styles.halign = 'center';
  };
  const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // ================= Seite 1: Überblick =================
  kicker(`Spielauswertung ${team.name}`, M, M, accent);
  font('Cond', 24);
  doc.text(doc.splitTextToSize(title, CW - 90) as string[], M, M + 12, { baseline: 'top', lineHeightFactor: 1.1 });
  if (logo) {
    const lw = 64, lh = (logo.h / logo.w) * lw;
    doc.addImage(logo.data, 'PNG', W - M - lw, M - 4, lw, Math.min(lh, 64));
  }
  let y = M + 56;
  font('Big', 46);
  doc.text(`${won} : ${lost}`, M, y, { baseline: 'top' });
  let cx = M + doc.getTextWidth(`${won} : ${lost}`) + 16;
  for (const s of sums) {
    const t = s.final ? `${s.final[0]}:${s.final[1]}` : `Satz ${s.nr}`;
    font('Big', 15);
    const w = doc.getTextWidth(t) + 14;
    rect(cx, y + 12, w, 24, C.soft2, 5);
    doc.text(t, cx + 7, y + 17, { baseline: 'top' });
    cx += w + 6;
  }
  font('Plex', 8.5, false, C.muted);
  doc.text(`${fmtDate(match.date)}${match.place ? ` · ${match.place}` : ''}${match.league ? ` · ${match.league}` : ''}`, cx + 6, y + 21, { baseline: 'top' });
  y += 56;
  const intro = `${team.name} ${resultWord} ${won}:${lost} gegen ${match.opponent} (${sums.map((s) => (s.final ? `${s.final[0]}:${s.final[1]}` : '')).filter(Boolean).join(', ')}). ` +
    `Erfasst wurden ${actions.filter((a) => a.element !== 'sub').length} Aktionen im Modus ${match.mode === 'profi' ? 'Profi' : 'Simpel'}. ` +
    (missing ? `${pl(missing, 'eigener Punkt ist', 'eigene Punkte sind')} nicht notiert.` : 'Alle Sätze gehen auf.');
  y = para(intro, M, y, CW, 9.5, C.ink) + 10;

  // Kacheln
  const tiles: [string, string, string][] = [
    ['Ergebnis', `${won}:${lost}`, pl(sums.length, 'Satz', 'Sätze')],
    [TOP, ranked[0] ? String(ranked[0].s.points) : '0', ranked[0] ? name(ranked[0].p) : ''],
    ['Kill-Quote', pctLabel(tot.attK, tot.att), `${tot.attK} aus ${pl(tot.att, 'Angriff', 'Angriffen')}`],
    ['Asse', String(tot.srvA), `${tot.srvE} Fehler bei ${pl(tot.srv, 'Aufschlag', 'Aufschlägen')}`],
    ['Annahme positiv', pctLabel(tot.recP + tot.recG, tot.rec), `${tot.recP} perfekt, ${tot.recG} gut, ${tot.recE} Fehler`],
    ['Blockpunkte', String(tot.blkK), `${tot.blkT} gute Touches`],
    ['Eigene Fehler', String(tot.errors), 'alle Elemente zusammen'],
    ['Fehler des Gegners', String(oppSE + oppF), `${oppSE} Aufschlag, ${oppF} sonstige`],
  ];
  const tw = (CW - 3 * 8) / 4, th = 58;
  tiles.forEach(([l, v, s], i) => {
    const x = M + (i % 4) * (tw + 8), ty = y + Math.floor(i / 4) * (th + 8);
    rect(x, ty, tw, th, C.soft, 6);
    kicker(l, x + 9, ty + 8);
    font('Big', 22);
    doc.text(v, x + 9, ty + 18, { baseline: 'top' });
    font('Plex', 7, false, C.muted);
    doc.text(doc.splitTextToSize(s, tw - 18)[0] as string, x + 9, ty + 44, { baseline: 'top' });
  });
  y += 2 * th + 8 + 18;

  // Fazit (neutral, nur Zahlen)
  y = h2('Fazit', y);
  const eff = tot.att ? Math.round(((tot.attK - tot.attE - tot.attB) / tot.att) * 100) : 0;
  const top3 = ranked.slice(0, 3).map((r) => `${name(r.p)} ${r.s.points}`).join(', ');
  const fazit: [string, string][] = [
    ['Angriff', `${pl(tot.attK, 'Punkt', 'Punkte')} aus ${pl(tot.att, 'Angriff', 'Angriffen')} (Kill-Quote ${pctLabel(tot.attK, tot.att)}), ${tot.attB} geblockt, ${tot.attE} Fehler, Effizienz ${String(eff).replace('-', '−')} %.`],
    ['Aufschlag', `${pl(tot.srvA, 'Ass', 'Asse')} und ${tot.srvE} Fehler bei ${pl(tot.srv, 'Aufschlag', 'Aufschlägen')}.`],
    ['Annahme', `${pl(tot.rec, 'Annahme', 'Annahmen')}, davon ${pctLabel(tot.recP + tot.recG, tot.rec)} positiv (${tot.recP} perfekt, ${tot.recG} gut) und ${tot.recE} Fehler.`],
    ['Block', `${pl(tot.blkK, 'Blockpunkt', 'Blockpunkte')}, ${pl(tot.blkT, 'guter Touch', 'gute Touches')}, ${pl(tot.blkE, 'Blockfehler', 'Blockfehler')}.`],
    ['Eigene Fehler', `${tot.errors} gesamt (Angriff ${tot.attE + tot.attB}, Aufschlag ${tot.srvE}, Annahme ${tot.recE}, Block ${tot.blkE}, Sonstiges ${tot.othE}${tot.setE + tot.digE ? `, Zuspiel und Abwehr ${tot.setE + tot.digE}` : ''}).`],
    ['Gegnerfehler', `${oppSE + oppF}, das sind ${pct(oppSE + oppF, ownPts)} % der eigenen Punkte.`],
    ['Meiste Punkte', `${top3 || 'keine'}.`],
    ['Zuspielverteilung', `über 4 ${pctLabel(dist.p4, dist.total)}, über 3 ${pctLabel(dist.p3, dist.total)}, über 2 ${pctLabel(dist.p2, dist.total)}, hinten ${pctLabel(dist.back, dist.total)}.`],
  ];
  // Eine Zeile pro Thema: links das Thema fett, rechts der Text. So steht alles bündig untereinander.
  const labW = 104;
  doc.setDrawColor(C.ink); doc.setLineWidth(1); doc.line(M, y - 4, M + CW, y - 4);
  for (const [lab, t] of fazit) {
    font('Plex', 8.5, true); doc.text(lab, M, y + 2, { baseline: 'top' });
    const ny = para(t, M + labW, y + 2, CW - labW, 8.5, C.ink, 1.35);
    y = ny + 5;
    doc.setDrawColor(C.rule); doc.setLineWidth(0.5); doc.line(M, y - 1, M + CW, y - 1);
    y += 3;
  }
  y += 14;

  // Satz für Satz: woher die Punkte kamen
  y = h2('Satz für Satz: woher die Punkte kamen', y);
  const maxPts = Math.max(25, ...sums.map((s) => (s.final ? Math.max(s.final[0], s.final[1]) : Math.max(...s.counted))));
  const half = (CW - 70) / 2, unit = half / maxPts, mid = M + 70 + half;
  font('Plex', 7, true, C.muted);
  doc.text('PUNKTE GEGNER', mid - 6, y, { align: 'right', baseline: 'top' });
  doc.text('EIGENE PUNKTE', mid + 6, y, { baseline: 'top' });
  y += 12;
  for (const s of sums) {
    const o = s.ownPoints;
    font('Plex', 8.5, true);
    doc.text(`Satz ${s.nr}`, M, y + 2, { baseline: 'top' });
    font('Plex', 7.5, false, C.muted);
    doc.text(s.final ? `${s.final[0]}:${s.final[1]}` : 'läuft', M, y + 12, { baseline: 'top' });
    let x = mid + 1;
    for (const [v, col, dash] of [[o.att, C.att], [o.srv, C.ace], [o.blk, C.blk], [o.oppSrv + o.oppF, C.opp], [Math.max(0, s.missing), C.opp, true]] as [number, string, boolean?][]) {
      if (!v) continue;
      dash ? dashed(x, y, v * unit - 1, 20, col) : rect(x, y, v * unit - 1, 20, col);
      if (v * unit > 12) { font('Plex', 7, true, dash ? C.muted : '#ffffff'); doc.text(String(v), x + (v * unit - 1) / 2, y + 6.5, { align: 'center', baseline: 'top' }); }
      x += v * unit;
    }
    const oppTotal = s.final ? s.final[1] : s.counted[1];
    const errs = Math.min(s.ownErrors, oppTotal), earned = Math.max(0, oppTotal - errs);
    let lx = mid - 1;
    for (const [v, col] of [[errs, C.err], [earned, C.earned]] as [number, string][]) {
      if (!v) continue;
      rect(lx - v * unit + 1, y, v * unit - 1, 20, col);
      if (v * unit > 12) { font('Plex', 7, true, col === C.err ? '#ffffff' : C.ink); doc.text(String(v), lx - (v * unit) / 2, y + 6.5, { align: 'center', baseline: 'top' }); }
      lx -= v * unit;
    }
    y += 28;
  }
  doc.setDrawColor(C.ink); doc.setLineWidth(1); doc.line(mid, y - 28 * sums.length - 4, mid, y - 6);
  legend([['eigene Fehler', C.err], ['vom Gegner erspielt', C.earned], ['Angriff', C.att], ['Ass', C.ace], ['Block', C.blk], ['Gegnerfehler', C.opp], ['nicht notiert', C.opp, true]], M + 70, y);

  // ================= Seite 2: Sätze und Spielerinnen =================
  doc.addPage();
  y = h2('Die Sätze in Zahlen', M);
  autoTable(doc, {
    ...tableBase, startY: y,
    head: [['Satz', 'Ergebnis', 'Angriff', 'Asse', 'Block', 'Gegnerfehler', 'nicht notiert', 'eigene Fehler', 'vom Gegner erspielt', 'Fehleranteil']],
    body: sums.map((s) => {
      const opp = s.final ? s.final[1] : s.counted[1];
      return [`Satz ${s.nr}`, s.final ? `${s.final[0]}:${s.final[1]}` : 'läuft', s.ownPoints.att, s.ownPoints.srv, s.ownPoints.blk, s.ownPoints.oppSrv + s.ownPoints.oppF, s.missing, s.ownErrors, s.oppEarned, pctLabel(Math.min(s.ownErrors, opp), opp)];
    }),
    columnStyles: Object.fromEntries([...Array(10).keys()].slice(1).map((i) => [i, { halign: 'right' as const }])),
      didParseCell: (d) => alignHead(d as never),
    });
  y = lastY() + 22;

  y = h2(`Punkte und Fehler pro ${P1}`, y);
  const maxBar = Math.max(1, ...rows.map((r) => Math.max(r.s.points, r.s.errors)));
  const bw = (CW - 170) / 2, bu = bw / maxBar, bmid = M + 100 + bw;
  for (const { p, s } of rows) {
    font('Plex', 8.5, true);
    doc.text(`${p.number ?? ''} ${p.name}`.trim(), M, y + 2, { baseline: 'top' });
    if (s.errors) { rect(bmid - s.errors * bu, y, s.errors * bu, 13, C.err); }
    if (s.points) { rect(bmid, y, s.points * bu, 13, C.att); }
    font('Plex', 7.5, false, C.muted);
    doc.text(String(s.errors), bmid - s.errors * bu - 4, y + 2.5, { align: 'right', baseline: 'top' });
    doc.text(String(s.points), bmid + s.points * bu + 4, y + 2.5, { baseline: 'top' });
    font('Big', 11);
    doc.text(sgn(s.balance), W - M, y + 1, { align: 'right', baseline: 'top' });
    y += 17;
  }
  doc.setDrawColor(C.ink); doc.setLineWidth(1); doc.line(bmid, y - 17 * rows.length - 2, bmid, y - 2);
  legend([['Fehler', C.err], ['Punkte', C.att]], M + 100, y + 2);
  font('Plex', 7, true, C.muted); doc.text('BILANZ', W - M, y + 2, { align: 'right', baseline: 'top' });
  y += 22;

  y = h2(`Alle Werte pro ${P1}`, y);
  const row = (n: string, s: PlayerStats) => [n, s.points, s.errors, sgn(s.balance), s.att, s.attK, s.attB, s.attE, pctLabel(s.attK, s.att),
    pctLabel(s.attK - s.attE - s.attB, s.att), s.srv, s.srvA, s.srvE, s.rec, pctLabel(s.recP + s.recG, s.rec), s.recE, s.blkK, s.blkT, s.blkE, s.othE];
  catTable(y, [
    ['Gesamt', CAT.ges, ['Pkt', 'Fehl.', 'Bil.']],
    ['Angriff', CAT.att, ['Ges.', 'Pkt', 'geb.', 'Fehl.', 'Kill', 'Eff.']],
    ['Aufschlag', CAT.srv, ['Ges.', 'Ass', 'Fehl.']],
    ['Annahme', CAT.rec, ['Ges.', 'pos.', 'Fehl.']],
    ['Block', CAT.blk, ['Pkt', 'Touch', 'Fehl.']],
    ['Sonst.', CAT.oth, ['Fehl.']],
  ], [...rows.map(({ p, s }) => row(`${p.number ?? ''} ${p.name}`.trim(), s)), row('Team', tot)], 0, 7);
  para('Pkt = Punkte, Fehl. = Fehler, Bil. = Bilanz, Ges. = gesamt, geb. = geblockt, pos. = positiv (perfekt + gut). Kill = Angriffspunkte / Angriffe. Eff. = (Punkte minus Fehler minus geblockt) / Angriffe.', M, lastY() + 6, CW, 7, C.muted);

  // ================= Seite 3: Positionen und Aufschlag =================
  doc.addPage();
  y = h2('Positionen', M);
  y = para('Spielfeld von unserer Seite, Netz oben. Vorne 4, 3, 2, hinten 5, 6, 1. Angriff: Anteil aller Angriffe, Kill-Quote und Effizienz. Annahme: Anteil positiv (perfekt und gut) und Fehler.', M, y, CW, 8, C.muted) + 8;
  const courtW = (CW - 20) / 2;
  const drawCourt = (x: number, top: number, label: string, cells: Record<number, string[]>, shade: Record<number, number>) => {
    font('Cond', 12); doc.text(label, x, top, { baseline: 'top' });
    const cy = top + 18, cw = courtW / 3, ch = 58;
    doc.setDrawColor(C.ink); doc.setLineWidth(2.5); doc.line(x, cy, x + courtW, cy);
    [4, 3, 2, 5, 6, 1].forEach((z, i) => {
      const zx = x + (i % 3) * cw, zy = cy + 4 + Math.floor(i / 3) * (ch + 3);
      const a = shade[z] ?? 0;
      rect(zx + 1.5, zy, cw - 3, ch, a ? mix(C.p4, a) : C.soft, 4);
      font('Plex', 7, true, C.muted); doc.text(String(z), zx + 7, zy + 5, { baseline: 'top' });
      const lines = cells[z] ?? [];
      if (lines.length) {
        font('Big', 17); doc.text(lines[0], zx + cw / 2, zy + 14, { align: 'center', baseline: 'top' });
        font('Plex', 7, false, C.ink);
        lines.slice(1).forEach((t, k) => doc.text(t, zx + cw / 2, zy + 34 + k * 9, { align: 'center', baseline: 'top' }));
      }
    });
    return cy + 4 + 2 * (ch + 3);
  };
  const atts = actions.filter((a) => a.element === 'att' && a.pos);
  const recs = actions.filter((a) => a.element === 'rec' && a.pos);
  const zoneAtt: Record<number, string[]> = {}, shAtt: Record<number, number> = {};
  const zoneRec: Record<number, string[]> = {}, shRec: Record<number, number> = {};
  for (const z of [1, 2, 3, 4, 5, 6]) {
    const za = atts.filter((a) => a.pos === z);
    if (za.length) {
      const k = za.filter((a) => a.result === 'K').length, e = za.filter((a) => a.result === 'E' || a.result === 'B').length;
      zoneAtt[z] = [`${pct(za.length, atts.length)} %`, pl(za.length, 'Angriff', 'Angriffe'), `Kill ${pct(k, za.length)} % · Eff. ${pctLabel(k - e, za.length)}`];
      shAtt[z] = za.length / Math.max(1, atts.length);
    }
    const zr = recs.filter((a) => a.pos === z);
    if (zr.length) {
      const g = zr.filter((a) => a.result === 'P' || a.result === 'G').length, e = zr.filter((a) => a.result === 'E').length;
      zoneRec[z] = [`${zr.length}`, `positiv ${pct(g, zr.length)} %`, `${pl(e, 'Fehler', 'Fehler')}`];
      shRec[z] = zr.length / Math.max(1, recs.length);
    }
  }
  const yA = drawCourt(M, y, 'Angriff', zoneAtt, shAtt);
  drawCourt(M + courtW + 20, y, 'Annahme', zoneRec, shRec);
  y = yA + 10;
  const whoList = (list: Action[], x: number, top: number) => {
    let yy = top;
    for (const z of [4, 3, 2, 1, 6, 5]) {
      const za = list.filter((a) => a.pos === z);
      if (!za.length) continue;
      const counts = new Map<number, number>();
      za.forEach((a) => counts.set(a.playerId!, (counts.get(a.playerId!) ?? 0) + 1));
      const txt = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => `${name(pmap.get(id))} ${n}`).join(', ');
      yy = para(`Pos. ${z}: ${txt}`, x, yy, courtW, 7.5, C.muted, 1.3) + 2;
    }
    return yy;
  };
  y = Math.max(whoList(atts, M, y), whoList(recs, M + courtW + 20, y)) + 14;

  y = h2(`Aufschlag pro ${P1}`, y);
  const servers = rows.filter((r) => r.s.srv > 0);
  autoTable(doc, {
    ...tableBase, startY: y,
    head: [[P1, 'Aufschläge', 'Ass', 'gut', 'ok', 'schlecht', 'Fehler', 'Druck', 'Fehlerquote']],
    body: [...servers.map(({ p, s }) => [`${p.number ?? ''} ${p.name}`.trim(), s.srv, s.srvA, s.srvG, s.srvO, s.srvS, s.srvE, pctLabel(s.srvA + s.srvG, s.srv), pctLabel(s.srvE, s.srv)]),
      ['Team', tot.srv, tot.srvA, tot.srvG, tot.srvO, tot.srvS, tot.srvE, pctLabel(tot.srvA + tot.srvG, tot.srv), pctLabel(tot.srvE, tot.srv)]],
    columnStyles: Object.fromEntries([...Array(9).keys()].slice(1).map((i) => [i, { halign: 'right' as const }])),
    didParseCell: (d) => { alignHead(d as never); if (d.section === 'body' && d.row.index === servers.length) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fillColor = C.soft; } },
  });
  y = lastY() + 20;
  if (y > H - 200) { doc.addPage(); y = M; }
  y = h2('So wurde gezählt', y);
  y = para('Punkte = Angriffspunkte + Asse + Blockpunkte. Fehler = Angriff (Fehler und geblockt) + Aufschlagfehler + Annahmefehler + Blockfehler + sonstige Fehler' + (match.mode === 'profi' ? ' + Zuspielfehler + vermeidbare Abwehrfehler (unhaltbare Bälle zählen als Gegnerpunkt)' : '') + '. Bilanz = Punkte minus Fehler. Kill-Quote = Angriffspunkte / Angriffe. Effizienz = (Punkte minus Fehler minus geblockt) / Angriffe. Aufschlagdruck = (Asse + gute Aufschläge) / alle Aufschläge. Annahme positiv = perfekt + gut. Vom Gegner erspielt = Gegnerpunkte minus eigene Fehler.', M, y, CW, 8, C.ink) + 10;
  font('Cond', 11); doc.text('Datenqualität', M, y, { baseline: 'top' }); y += 15;
  const dq = sums.map((s) => `Satz ${s.nr}: ${!s.final ? 'kein Endstand eingetragen' : s.missing === 0 ? 'geht auf' : s.missing > 0 ? `${pl(s.missing, 'eigener Punkt', 'eigene Punkte')} nicht notiert` : `${-s.missing} Punkte mehr erfasst als im Endstand`}`).join(' · ');
  y = para(`${dq}. Erfasst im Modus ${match.mode === 'profi' ? 'Profi' : 'Simpel'} mit der App Statistiker.`, M, y, CW, 8, C.muted);

  // ================= Seite 4: pro Satz =================
  doc.addPage();
  y = h2('Pro Satz', M);
  for (const s of sums) {
    const acts = actions.filter((a) => a.set === s.nr);
    const sp = statsByPlayer(acts);
    const setRows = players.filter((p) => sp.has(p.id!)).map((p) => ({ p, s: sp.get(p.id!)! }));
    const st = teamStats(acts);
    if (y > H - 160) { doc.addPage(); y = M; }
    font('Cond', 12);
    doc.text(`Satz ${s.nr} · ${s.final ? `${s.final[0]}:${s.final[1]}` : 'läuft'}`, M, y, { baseline: 'top' });
    const setInfo = match.sets.find((x) => x.nr === s.nr);
    if (setInfo?.lineup?.length === 6) {
      const roman = ['I', 'II', 'III', 'IV', 'V', 'VI'];
      font('Plex', 7.5, false, C.muted);
      doc.text(`Aufstellung: ${setInfo.lineup.map((id, i) => `${roman[i]} ${name(pmap.get(id))}`).join(', ')}${setInfo.liberos?.length ? ` · Libero ${setInfo.liberos.map((id) => name(pmap.get(id))).join(', ')}` : ''}`, M + 110, y + 3, { baseline: 'top', maxWidth: CW - 110 });
    }
    catTable(y + 18, [
      ['Gesamt', CAT.ges, ['Pkt', 'Fehler', 'Bilanz']],
      ['Angriff', CAT.att, ['Punkt', 'Ges.']],
      ['Aufschlag', CAT.srv, ['Ass', 'Fehler', 'Ges.']],
      ['Annahme', CAT.rec, ['positiv', 'Fehler', 'Ges.']],
      ['Block', CAT.blk, ['Punkt']],
      ['Sonst.', CAT.oth, ['Fehler']],
    ], [...setRows, { p: { name: 'Team', number: null } as unknown as Player, s: st }].map(({ p, s: x }) => [`${p.number ?? ''} ${p.name}`.trim(), x.points, x.errors, sgn(x.balance), x.attK, x.att, x.srvA, x.srvE, x.srv, x.recP + x.recG, x.recE, x.rec, x.blkK, x.othE]), 100, 7.5);
    const opp = acts.filter((a) => a.element === 'opp');
    y = para(`Gegner: ${opp.filter((a) => a.result === 'SE').length} Aufschlagfehler, ${opp.filter((a) => a.result === 'F').length} sonstige Fehler.${s.missing > 0 ? ` ${pl(s.missing, 'eigener Punkt', 'eigene Punkte')} nicht notiert.` : ''}`, M, lastY() + 5, CW, 7.5, C.muted) + 16;
  }

  // ================= Seite 5: Profi =================
  if (match.mode === 'profi') {
    const ps = proStats(match.sets, actions, pmap);
    doc.addPage();
    kicker('Profi-Auswertung', M, M, accent);
    y = h2('Sideout und Break', M + 12);
    const k4: [string, string, string][] = [
      ['Sideout', pctLabel(ps.sideout.won, ps.sideout.all), `${ps.sideout.won} von ${ps.sideout.all} mit Annahme`],
      ['Break', pctLabel(ps.breakp.won, ps.breakp.all), `${ps.breakp.won} von ${ps.breakp.all} mit Aufschlag`],
      ['First-Ball-Sideout', pctLabel(ps.fbso.won, ps.fbso.all), 'Punkt mit dem 1. Angriff'],
      ['Ballwechsel', String(ps.rallies), ps.missingLineup.length ? `ohne Aufstellung: Satz ${ps.missingLineup.join(', ')}` : 'alle mit Aufstellung'],
    ];
    k4.forEach(([l, v, s], i) => {
      const x = M + i * (tw + 8);
      rect(x, y, tw, th, C.soft, 6);
      kicker(l, x + 9, y + 8);
      font('Big', 22); doc.text(v, x + 9, y + 18, { baseline: 'top' });
      font('Plex', 7, false, C.muted); doc.text(doc.splitTextToSize(s, tw - 18)[0] as string, x + 9, y + 44, { baseline: 'top' });
    });
    y += th + 18;
    y = h2('Pro Läufer', y);
    y = para('Läufer = Position der Zuspielerin. Balken: Anteil gewonnener Ballwechsel.', M, y - 4, CW, 7.5, C.muted) + 6;
    const barW = 150;
    font('Plex', 7, true, C.muted);
    doc.text('LÄUFER', M, y, { baseline: 'top' }); doc.text('SIDEOUT', M + 50, y, { baseline: 'top' }); doc.text('BREAK', M + 50 + barW + 70, y, { baseline: 'top' }); doc.text('+/−', W - M, y, { align: 'right', baseline: 'top' });
    y += 13;
    for (const r of ps.perRot) {
      font('Big', 14); doc.text(String(r.rot), M + 8, y, { baseline: 'top' });
      const bar = (x: number, n: number, d: number, col: string) => {
        rect(x, y + 2, barW, 12, C.soft2, 3);
        if (d) rect(x, y + 2, (barW * n) / d, 12, col, 3);
        font('Plex', 7.5, true, C.ink); doc.text(`${n}/${d} · ${pctLabel(n, d)}`, x + barW + 6, y + 4, { baseline: 'top' });
      };
      bar(M + 50, r.soWon, r.soAll, C.so);
      bar(M + 50 + barW + 70, r.bpWon, r.bpAll, C.bp);
      font('Big', 12); doc.text(sgn(r.won - r.lost), W - M, y + 1, { align: 'right', baseline: 'top' });
      y += 19;
    }
    y += 10;
    y = h2('Angriff nach Annahme und im Konter', y);
    const ph = (l: string, x: { all: number; k: number; b: number; e: number }) => [l, x.all, x.k, x.b, x.e, pctLabel(x.k, x.all), pctLabel(x.k - x.e - x.b, x.all)];
    autoTable(doc, {
      ...tableBase, startY: y,
      head: [['', 'Angriffe', 'Punkte', 'geblockt', 'Fehler', 'Kill', 'Effizienz']],
      body: [ph('nach Annahme', ps.attAfterRec), ph('Konter', ps.attTransition)],
      columnStyles: Object.fromEntries([1, 2, 3, 4, 5, 6].map((i) => [i, { halign: 'right' as const }])),
      didParseCell: (d) => alignHead(d as never),
    });
    y = lastY() + 18;
    const zW = (CW - 20) / 2;
    const drawZones = (x: number, top: number, label: string, data: Record<number, { all: number; pts: number }>, ptl: string) => {
      font('Cond', 12); doc.text(label, x, top, { baseline: 'top' });
      const max = Math.max(1, ...Object.values(data).map((z) => z.all));
      const cw = zW / 3, ch = 40;
      [1, 6, 5, 2, 3, 4].forEach((z, i) => {
        const zx = x + (i % 3) * cw, zy = top + 18 + Math.floor(i / 3) * (ch + 3);
        rect(zx + 1.5, zy, cw - 3, ch, data[z].all ? mix(C.p4, data[z].all / max) : C.soft, 4);
        font('Plex', 7, true, C.muted); doc.text(String(z), zx + 6, zy + 4, { baseline: 'top' });
        font('Big', 15); doc.text(String(data[z].all), zx + cw / 2, zy + 9, { align: 'center', baseline: 'top' });
        font('Plex', 7, false, C.ink); doc.text(`${data[z].pts} ${data[z].pts === 1 ? ptl.replace(/e$/, '') : ptl}`, zx + cw / 2, zy + 27, { align: 'center', baseline: 'top' });
      });
      const ny = top + 18 + 2 * (ch + 3) + 1;
      doc.setDrawColor(C.ink); doc.setLineWidth(2.5); doc.line(x, ny, x + zW, ny);
      font('Plex', 6.5, true, C.muted); doc.text('NETZ', x + zW / 2, ny + 4, { align: 'center', baseline: 'top' });
      return ny + 14;
    };
    font('Cond', 14); doc.text('Zielzonen im Gegnerfeld', M, y, { baseline: 'top' }); y += 22;
    const zy = drawZones(M, y, 'Angriff', zoneStats(actions, 'att').zones, 'Punkte');
    drawZones(M + zW + 20, y, 'Aufschlag', zoneStats(actions, 'srv').zones, 'Asse');
    y = zy + 12;
    if (y > H - 180) { doc.addPage(); y = M; }
    const setters = rows.filter((r) => r.s.set > 0), diggers = rows.filter((r) => r.s.dig > 0);
    y = h2('Zuspiel', y);
    autoTable(doc, {
      ...tableBase, startY: y,
      head: [[P1, 'Zuspiele', 'gut angreifbar', 'eingeschränkt', 'nicht angreifbar', 'Fehler', 'gut %']],
      body: setters.length ? setters.map(({ p, s }) => [`${p.number ?? ''} ${p.name}`.trim(), s.set, s.setG, s.setL, s.setN, s.setE, pctLabel(s.setG, s.set)]) : [['keine Zuspiele erfasst', '', '', '', '', '', '']],
      columnStyles: Object.fromEntries([1, 2, 3, 4, 5, 6].map((i) => [i, { halign: 'right' as const }])),
      didParseCell: (d) => alignHead(d as never),
    });
    y = lastY() + 18;
    if (y > H - 140) { doc.addPage(); y = M; }
    y = h2('Abwehr', y);
    autoTable(doc, {
      ...tableBase, startY: y,
      head: [[P1, 'Abwehr', 'gut', 'ok', 'Fehler (vermeidbar)', 'unhaltbar', 'gut %']],
      body: diggers.length ? diggers.map(({ p, s }) => [`${p.number ?? ''} ${p.name}`.trim(), s.dig, s.digG, s.digO, s.digE, s.digU, pctLabel(s.digG, s.dig)]) : [['keine Abwehraktionen erfasst', '', '', '', '', '', '']],
      columnStyles: Object.fromEntries([1, 2, 3, 4, 5, 6].map((i) => [i, { halign: 'right' as const }])),
      didParseCell: (d) => alignHead(d as never),
    });
  }

  // ---------- Fußzeile ----------
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(C.rule); doc.setLineWidth(0.5); doc.line(M, H - M + 2, W - M, H - M + 2);
    font('Plex', 7, false, C.muted);
    doc.text(`${team.name} · ${title} · ${fmtDate(match.date)}`, M, H - M + 8, { baseline: 'top' });
    doc.text(`Seite ${i} von ${n}`, W - M, H - M + 8, { align: 'right', baseline: 'top' });
  }
  doc.setProperties({ title: `${title} (${fmtDate(match.date)})`, subject: `Spielauswertung ${team.name}`, creator: 'Statistiker' });
  return doc.output('blob');
}

/** Farbe mit Weiß mischen: a = 0 sehr hell, a = 1 volle Farbe. */
function mix(hex: string, a: number): string {
  const t = 0.18 + 0.62 * Math.min(1, Math.max(0, a));
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(255 - (255 - v) * t).toString(16).padStart(2, '0');
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}

export function pdfName(match: Match) {
  const safe = match.opponent.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
  return `Matchstatistik-${safe}-${match.date}.pdf`;
}
