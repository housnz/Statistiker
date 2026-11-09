// Feldgrafik. Unten unser Feld (Netz oben), oben das gegnerische Feld (nur Profi).

interface Props {
  /** Positionen auf unserer Seite, die gewählt werden können (leer = Seite ausgegraut). */
  ownZones: number[];
  ownValue?: number;
  onOwn?: (z: number) => void;
  /** Gegnerseite zeigen (Profi). */
  showOpp: boolean;
  oppActive: boolean;
  oppValue?: number;
  onOpp?: (z: number) => void;
  askOwn?: boolean;
  askOpp?: boolean;
}

const OWN_ROWS = [[4, 3, 2], [5, 6, 1]];
// Gegnerfeld von unserer Seite gesehen: hinten 1 6 5, vorne am Netz 2 3 4.
const OPP_ROWS = [[1, 6, 5], [2, 3, 4]];

export function Court(p: Props) {
  const W = 300;
  const oppH = p.showOpp ? 200 : 0;
  const gap = p.showOpp ? 22 : 18;
  const ownH = 200;
  const H = oppH + gap + ownH;
  const ownTop = oppH + gap;
  const cellW = W / 3;

  return (
    <div class="court">
      <svg viewBox={`-2 -2 ${W + 4} ${H + 4}`} role="group" aria-label="Spielfeld">
        {p.showOpp &&
          OPP_ROWS.map((row, r) =>
            row.map((z, c) => {
              const cls = !p.oppActive ? 'z off' : p.oppValue === z ? 'z on' : p.askOpp ? 'z ask' : 'z';
              return (
                <g class={cls} onClick={() => p.oppActive && p.onOpp?.(z)} data-zone={`opp-${z}`}>
                  <rect x={c * cellW} y={r * 100} width={cellW} height={100} rx={4} />
                  <text x={c * cellW + cellW / 2} y={r * 100 + 50}>{z}</text>
                </g>
              );
            }),
          )}
        <line class="net" x1={-2} x2={W + 2} y1={oppH + gap / 2} y2={oppH + gap / 2} />
        {OWN_ROWS.map((row, r) =>
          row.map((z, c) => {
            const active = p.ownZones.includes(z);
            const cls = !active ? 'z off' : p.ownValue === z ? 'z on' : p.askOwn ? 'z ask' : 'z';
            return (
              <g class={cls} onClick={() => active && p.onOwn?.(z)} data-zone={`own-${z}`}>
                <rect x={c * cellW} y={ownTop + r * 100} width={cellW} height={100} rx={4} />
                <text x={c * cellW + cellW / 2} y={ownTop + r * 100 + 50}>{z}</text>
              </g>
            );
          }),
        )}
      </svg>
    </div>
  );
}
