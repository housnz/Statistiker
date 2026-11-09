import { db } from '../db';
import { Logo } from '../logo';
import { fmtDate, go, team, useLive, words } from '../state';
import { TeamBar } from './Teams';
import type { Match } from '../model';

export function setsWon(m: Match): [number, number] {
  let us = 0, them = 0;
  for (const s of m.sets) {
    if (!s.final) continue;
    if (s.final[0] > s.final[1]) us++;
    else if (s.final[1] > s.final[0]) them++;
  }
  return [us, them];
}

export function Home() {
  const t = team.value;
  const matches = useLive(
    async () => (t?.id ? (await db.matches.where('teamId').equals(t.id).toArray()).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt) : []),
    [t?.id],
    [] as Match[],
  );
  const playerCount = useLive(async () => (t?.id ? db.players.where('teamId').equals(t.id).filter((p) => p.active).count() : 0), [t?.id], 0);
  const running = matches.find((m) => !m.finished);

  return (
    <div class="page">
      <div class="hero">
        <div class="logo-wrap"><Logo size={92} /></div>
        <div>
          <h1>Statistiker</h1>
          <div style={{ opacity: 0.9, fontWeight: 600 }}>{t?.name}{t?.liga ? ` · ${t.liga}` : ''}</div>
        </div>
        <div style={{ flex: 1 }} />
        {t?.logo && <img src={t.logo} alt="" style={{ height: 72, maxWidth: 140, objectFit: 'contain', background: '#fff', borderRadius: 12, padding: 6 }} />}
      </div>

      <TeamBar />

      <div class="tiles">
        {running ? (
          <button class="tile primary" onClick={() => go({ name: 'scout', matchId: running.id! })}>
            <span class="ic">▶</span><b>Spiel fortsetzen</b><span class="small">gegen {running.opponent}</span>
          </button>
        ) : (
          <button class="tile primary" onClick={() => go({ name: 'newMatch' })} disabled={!playerCount}>
            <span class="ic">＋</span><b>Neues Spiel</b><span class="small">{playerCount ? 'live erfassen' : 'zuerst Kader anlegen'}</span>
          </button>
        )}
        <button class="tile" onClick={() => go({ name: 'roster' })}>
          <span class="ic">👥</span><b>Kader</b><span class="small muted">{playerCount} {words().many}</span>
        </button>
        <button class="tile" disabled title="kommt im nächsten Schritt" style={{ opacity: 0.55 }}>
          <span class="ic">📝</span><b>Bogen nachtragen</b><span class="small muted">kommt bald</span>
        </button>
        <button class="tile" onClick={() => go({ name: 'settings' })}>
          <span class="ic">⚙︎</span><b>Einstellungen</b><span class="small muted">Farben, Backup, PDF</span>
        </button>
      </div>

      <div class="card">
        <h2>Spiele</h2>
        {!matches.length && <div class="muted">Noch keine Spiele erfasst.</div>}
        <div class="matchlist">
          {matches.map((m) => {
            const [a, b] = setsWon(m);
            return (
              <div class="matchrow" key={m.id}>
                <div class="res">{a}:{b}</div>
                <div style={{ flex: 1 }}>
                  <b>gegen {m.opponent}</b>
                  <div class="small muted">
                    {fmtDate(m.date)}{m.place ? ` · ${m.place}` : ''}{m.league ? ` · ${m.league}` : ''} · {m.mode === 'profi' ? 'Profi' : 'Simpel'}
                  </div>
                </div>
                {!m.finished && <span class="badge">läuft</span>}
                {!m.finished && <button class="btn" onClick={() => go({ name: 'scout', matchId: m.id! })}>Erfassen</button>}
                <button class="btn" onClick={() => go({ name: 'report', matchId: m.id! })}>Auswertung</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
