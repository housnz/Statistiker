# Statistiker: Hinweise für Claude

Volleyball-Statistik-App für das iPad (Querformat 1180 × 820). Web-App mit Preact, TypeScript, Vite, Dexie (IndexedDB). Veröffentlicht über GitHub Pages: jeder Push auf `main` baut und deployt (`.github/workflows/pages.yml`). Alle Entscheidungen stehen in `ENTSCHEIDUNGEN.md`. Bitte vor Änderungen lesen und neue Entscheidungen dort ergänzen.

## Zusammenarbeit
- Der Nutzer programmiert nicht. Antworten auf Deutsch, in Alltagssprache, **ohne Gedankenstriche** (– oder —). Kleine Schritte, danach Screenshots in iPad-Größe zeigen.
- Datenschutz: Es spielen Minderjährige mit. Spieldaten bleiben nur auf dem Gerät. Keine Cloud-Dienste, kein Tracking, keine externen Abrufe (auch keine Google Fonts). Echte Namen nie ins Repository, Demo-Daten nur erfunden (`src/demo.ts`).
- Bibliotheken mit fester Version (`npm i -E`) und freier Lizenz.

## Befehle
```bash
npm install
npm run build              # Typprüfung und Build nach dist/
npm run build:single       # eine einzelne HTML-Datei (dist-single/), nur für Vorschauen
npx vite preview --port 4173
```
Tests laufen mit Playwright (in Cloud-Sitzungen vorinstalliert, `require('playwright')`, Viewport 1180 × 820). Es gibt keine festen Testdateien im Repository. Szenarien: Demo-Team anlegen (Einstellungen), Simpel-Spiel über Bogen-Zellen erfassen (`[data-cell="Name:att"]`, `.rbtn`, `[data-zone="own-4"]`), Profi-Spiel mit Aufstellung (`#slot-0` bis `#slot-5`), Spielstand `[data-testid=score] .n`, Exporte über `[data-testid=file-ready]`.

## Aufbau
- `src/model.ts`: Datentypen, Elemente und Ergebnis-Knöpfe mit Wirkung (point, error, opppoint, none).
- `src/stats.ts`: Kennzahlen pro Person und Satz. `src/rally.ts`: Profi-Logik (Ballwechsel aus der Reihenfolge, Rotation, Läufer, Profi-Kennzahlen, Zielzonen).
- `src/draft.ts`: Eingabe-Entwurf, „Schritt zurück“, Bogen-Zeichen.
- `src/screens/Scout.tsx` (Simpel, Bogen), `ProScout.tsx` (Profi mit Video, Aufstellung, Wechsel), `Report.tsx` + `ProReport.tsx` (Auswertung, immer dunkel), `Home.tsx`, `Roster.tsx`, `NewMatch.tsx`, `Settings.tsx`, `Teams.tsx`.
- `src/columns.ts`: Spalten-Gruppen und Kategorie-Farben für „Alle Werte“ (gemeinsam für App, PDF, Excel).
- `src/pdf.ts` (jsPDF + jspdf-autotable, Schriften als TTF in `src/assets/pdf-fonts/`, erzeugt mit `scripts/woff2ttf.py`), `src/xlsx.ts` (write-excel-file), `src/exporting.ts`, `src/share.tsx` (Teilen-Menü, Download, Download-Funktion von claude.ai-Vorschauen).
- `src/video.tsx`: Video nur im Speicher, gespeichert werden Name und Videozeit pro Aktion.
- `src/db.ts`: Dexie-Schema (Version 2), Sicherung als JSON.
- `src/styles.css`: Design „Klemmbrett“ (Variablen auf `:root`, dunkel über `data-look`), Auswertung `.rep` im Stil „Anzeigetafel“.

## Zählregeln (Kurzfassung)
Eigene Punkte = Angriffspunkt + Ass + Blockpunkt + Gegnerfehler. Eigene Fehler = Angriff Fehler und geblockt, Aufschlag, Annahme, Block, Sonstiges, Zuspiel, vermeidbare Abwehrfehler. „Gegner punktet (unhaltbar)“ und „Punkt Gegner (sonstiger)“ sind Gegnerpunkte ohne eigenen Fehler. Fazit- und Feedbacktexte neutral, Grün und Rot nur in Grafiken.
