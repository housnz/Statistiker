import { useState } from 'preact/hooks';
import { db, saveBackupFile } from '../db';
import { Logo } from '../logo';
import { fmtDate, go, switchTeam, team, useLive, words } from '../state';
import { NewTeamDialog } from './Teams';
import type { Match, Team } from '../model';

export function setsWon(m: Match): [number, number] {
  let us = 0, them = 0;
  for (const s of m.sets) {
    if (!s.final) continue;
    if (s.final[0] > s.final[1]) us++;
    else if (s.final[1] > s.final[0]) them++;
  }
  return [us, them];
}

const KAT = { damen: 'Damen', herren: 'Herren', mixed: 'Mixed' } as const;

export function Home() {
  const t = team.value;
  const W = words();
  const matches = useLive(
    async () => (t?.id ? (await db.matches.where('teamId').equals(t.id).toArray()).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt) : []),
    [t?.id],
    [] as Match[],
  );
  const teams = useLive(async () => {
    const ts = await db.teams.toArray();
    const ps = await db.players.filter((p) => p.active).toArray();
    return ts.map((x) => ({ team: x, count: ps.filter((p) => p.teamId === x.id).length }));
  }, [], [] as { team: Team; count: number }[]);
  const [newOpen, setNewOpen] = useState(false);
  const playerCount = teams.find((x) => x.team.id === t?.id)?.count ?? 0;
  const running = matches.find((m) => !m.finished);

  const backup = async () => {
    await saveBackupFile();
  };

  return (
    <div class="home">
      <aside class="side">
        <div class="brand">
          <Logo size={76} />
          <div><b>Statistiker</b><span>Volleyball-Statistik</span></div>
        </div>
        <span class="label">Mannschaften</span>
        <nav class="tlist" aria-label="Mannschaften" data-testid="teambar">
          {teams.map(({ team: x, count }) => (
            <button class={`tbtn ${x.id === t?.id ? 'on' : ''}`} onClick={() => switchTeam(x.id!)}>
              <span class="mark" />
              <span class="tx">
                <b>{x.name}</b>
                <span>{KAT[x.kategorie ?? 'damen']}{x.liga ? ` · ${x.liga}` : ''}</span>
              </span>
              <span class="cnt">{count}</span>
            </button>
          ))}
          <button class="tbtn add" onClick={() => setNewOpen(true)}>＋ Mannschaft anlegen</button>
        </nav>
        <div class="foot">
          <button onClick={() => go({ name: 'settings' })}>Einstellungen</button>
          <button onClick={backup}>Sicherung speichern</button>
        </div>
      </aside>

      <main class="hmain">
        <div class="htiles">
          {running ? (
            <button class="htile new" onClick={() => go({ name: 'scout', matchId: running.id! })}>
              <span class="kicker">{t?.name}</span>
              <span><span class="t">Spiel fortsetzen</span><br /><span class="sub">gegen {running.opponent}</span></span>
            </button>
          ) : (
            <button class="htile new" onClick={() => go({ name: 'newMatch' })} disabled={!playerCount}>
              <span class="kicker">{t?.name}</span>
              <span><span class="t">Neues Spiel</span><br /><span class="sub">{playerCount ? 'neuen Bogen anlegen und live erfassen' : 'zuerst den Kader anlegen'}</span></span>
            </button>
          )}
          <button class="htile" onClick={() => go({ name: 'roster' })}>
            <span class="big">{playerCount}</span>
            <span><b>Kader</b><br /><span class="sub">{W.many} verwalten</span></span>
          </button>
          <button class="htile" disabled title="kommt in einem der nächsten Schritte">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V2.8h6V4M8.5 10h7M8.5 14h7M8.5 18h4" /></svg>
            <span><b>Bogen nachtragen</b><br /><span class="sub">kommt bald</span></span>
          </button>
        </div>

        <section class="card mlist">
          <div class="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <h2 style={{ margin: 0 }}>Spiele</h2>
            <span class="small muted">{matches.length} {matches.length === 1 ? 'Spiel' : 'Spiele'}</span>
          </div>
          {!matches.length ? (
            <div class="muted">Noch keine Spiele erfasst.</div>
          ) : (
            <>
              <div class="mhead"><span>DATUM</span><span>GEGNER</span><span>ERGEBNIS</span><span>SÄTZE</span><span>MODUS</span><span /></div>
              {matches.map((m) => {
                const [a, b] = setsWon(m);
                return (
                  <div class="mrow" key={m.id}>
                    <span class="num small muted">{fmtDate(m.date)}</span>
                    <span style={{ fontWeight: 600 }}>{m.opponent}</span>
                    <span class="res">{a}:{b}</span>
                    <span class="num small muted">{m.sets.filter((s) => s.final).map((s) => `${s.final![0]}:${s.final![1]}`).join(' ')}</span>
                    <span class="small muted">{m.mode === 'profi' ? 'Profi' : 'Simpel'}</span>
                    <span class="acts">
                      {!m.finished && <button class="btn primary" onClick={() => go({ name: 'scout', matchId: m.id! })}>Erfassen</button>}
                      <button class="btn" onClick={() => go({ name: 'report', matchId: m.id! })}>Auswertung</button>
                    </span>
                  </div>
                );
              })}
            </>
          )}
        </section>
      </main>
      {newOpen && <NewTeamDialog onClose={() => setNewOpen(false)} />}
    </div>
  );
}
