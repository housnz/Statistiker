import { render } from 'preact';
import { useEffect } from 'preact/hooks';
import './fonts';
import './styles.css';
import { requestPersistence } from './db';
import { loadPrefs, prefs } from './prefs';
import { applyTeamColors, reloadTeam, route, team, toastMsg } from './state';
import { Home } from './screens/Home';
import { Roster } from './screens/Roster';
import { NewMatch } from './screens/NewMatch';
import { Scout } from './screens/Scout';
import { Report } from './screens/Report';
import { Settings } from './screens/Settings';
import { AskDialog } from './AskDialog';

function App() {
  const p = prefs.value;
  useEffect(() => {
    document.documentElement.dataset.look = p.theme;
    document.documentElement.dataset.size = p.buttonSize;
  }, [p.theme, p.buttonSize]);
  useEffect(() => applyTeamColors(team.value), [team.value]);

  const r = route.value;
  return (
    <>
      {r.name === 'home' && <Home />}
      {r.name === 'roster' && <Roster />}
      {r.name === 'newMatch' && <NewMatch />}
      {r.name === 'scout' && <Scout matchId={r.matchId} />}
      {r.name === 'report' && <Report matchId={r.matchId} />}
      {r.name === 'settings' && <Settings />}
      <AskDialog />
      {toastMsg.value && <div class="toast">{toastMsg.value}</div>}
    </>
  );
}

async function start() {
  await loadPrefs();
  await reloadTeam();
  requestPersistence();
  render(<App />, document.getElementById('app')!);
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !location.hostname.endsWith('claude.ai')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

start();
