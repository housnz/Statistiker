# Statistiker

Volleyball-Statistik für das iPad: live erfassen, nach dem Spiel auswerten. Web-App (PWA), alle Daten bleiben auf dem Gerät.

## Entwickeln

```bash
npm install
npm run dev      # lokale Vorschau
npm run build    # fertige App in dist/ (für GitHub Pages)
```

## Aufbau

- `src/model.ts`: Elemente, Ergebnis-Buttons und Zählregeln (was ist Punkt, was ist Fehler)
- `src/stats.ts`: Kennzahlen wie in den bisherigen PDF-Auswertungen
- `src/db.ts`: lokale Datenbank (IndexedDB über Dexie), Sicherung als JSON-Datei
- `src/screens/`: Startseite, Kader, Neues Spiel, Erfassen, Auswertung, Einstellungen
- `src/logo.tsx`: Logo (Volleyball in Blau-Gelb mit Nerd-Brille)

Bibliotheken: Preact (MIT), Dexie (Apache-2.0), Vite (MIT). Versionen fest eingetragen.
