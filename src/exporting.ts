// PDF und Excel für ein Spiel erstellen und zum Teilen anbieten.
import { db } from './db';
import type { Player } from './model';
import { offerFile, withBusy } from './share';

async function load(matchId: number) {
  const match = await db.matches.get(matchId);
  if (!match) throw new Error('Spiel nicht gefunden');
  const team = await db.teams.get(match.teamId);
  const actions = await db.actions.where('matchId').equals(matchId).sortBy('seq');
  const players = ((await db.players.bulkGet(match.playerIds)).filter(Boolean) as Player[]).sort((a, b) => a.order - b.order);
  return { match, actions, players, team: team! };
}

export function exportPdf(matchId: number) {
  return withBusy('PDF wird erstellt …', async () => {
    const [{ buildPdf, pdfName }, data] = await Promise.all([import('./pdf'), load(matchId)]);
    offerFile(await buildPdf(data), pdfName(data.match), 'Die PDF');
  });
}

export function exportXlsx(matchId: number) {
  return withBusy('Excel-Datei wird erstellt …', async () => {
    const [{ buildXlsx, xlsxName }, data] = await Promise.all([import('./xlsx'), load(matchId)]);
    offerFile(await buildXlsx(data), xlsxName(data.match), 'Die Excel-Datei');
  });
}
