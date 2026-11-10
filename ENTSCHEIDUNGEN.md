# Entscheidungen

Stand 9. November 2026, erster Prototyp.

- **Technik:** Preact, TypeScript, Vite, Dexie (IndexedDB). Kein Server, keine Cloud, kein Tracking.
- **Eingabe-Reihenfolge:** Spielerin, Element, Ergebnis, dann Position bzw. Zone. Gespeichert wird automatisch, sobald alles Nötige getippt ist. Reihenfolge ist frei (Position kann auch vor dem Ergebnis kommen).
- **Pflichtangaben:** Angriff braucht immer eine Position (4, 3, 2, 5, 6, 1), Annahme eine Position (5, 6, 1). Profi: Angriff und Aufschlag zusätzlich Zielzone 1 bis 6 im gegnerischen Feld, mit Knopf „ohne Zone“.
- **Gegnerfeld (Profi):** Zonen 1 bis 6 (Momo, 9.11.2026: statt 1 bis 9). Von unserer Seite gesehen hinten 1 6 5, vorne am Netz 2 3 4.
- **Spielstand live:** eigene Punkte = Angriffspunkt, Ass, Blockpunkt, Gegner-Aufschlagfehler, Gegnerfehler. Gegnerpunkte = alle eigenen Fehler (inkl. geblockt) plus optional „Punkt Gegner (sonstiger)“.
- **Zusatzknopf „Punkt Gegner (sonstiger)“** beim Gegner: freiwillig, damit der Spielstand in der App mitläuft. Zählt nicht als eigener Fehler.
- **Satzende-Prüfung:** wie in den PDFs. Eigene Punkte laut Endstand minus erfasste eigene Punkte = „nicht notiert“.
- **Schritt zurück** (10.11.2026, Wunsch von Momo): nimmt immer nur die letzte Eingabe zurück. Bei laufender Eingabe die zuletzt getippte Angabe (Zone, Ergebnis, Element, Person). Ist nichts angefangen, holt der Knopf die zuletzt gespeicherte Aktion zurück, ohne ihre letzte Angabe. Beispiel: falsche Angriffszone, einmal zurück, richtige Zone tippen. „Abbrechen“ verwirft die zurückgeholte Aktion ganz.
- **Korrektur:** Eintrag im Verlauf antippen, neu wählen, wird ersetzt. Oder löschen.
- **Rückfragen** als eigene Dialoge in der App (keine Browser-Popups).
- **Demo-Daten** nur mit erfundenen Namen. Die echten Testdaten (Minderjährige) kommen nicht ins öffentliche Repository (`testdaten/` steht in `.gitignore`).
- **Farben Zuspielverteilung:** 4 blau, 3 türkis, 2 violett, hinten orange. Bewusst kein Grün/Rot, weil keine Wertung.

- **Logo:** Bild von Momo (mit ChatGPT erstellt, 9.11.2026): weißer Volleyball mit schwarzer Nerd-Brille und Statistik-Klemmbrett auf rotem Grund. Ersetzt den eigenen SVG-Entwurf in Blau-Gelb.

- **Mehrere Mannschaften** (9.11.2026): jede Mannschaft hat eigenen Kader, eigene Spiele, Farben und Logo. Wechsel über die Mannschafts-Leiste auf Startseite und im Kader. Personen lassen sich als Kopie aus einer anderen Mannschaft übernehmen (z. B. Jugend spielt bei den Damen mit), ihre Statistiken bleiben pro Mannschaft getrennt. Mannschaft löschen in den Einstellungen.
- **Kategorie Damen, Herren, Mixed** pro Mannschaft, dazu optional Liga oder Altersklasse. Steuert vorerst die Anrede (Spielerin bzw. Spieler, Top-Scorerin bzw. Top-Scorer). Mixed nutzt „Spieler“.
- **Vergleichswerte:** Die App bewertet nicht. Es gibt keine geprüften Referenzwerte für Damen-Mannschaften auf Regionalniveau. Mögliche spätere Lösung: eigene Vergleichswerte aus den eigenen Spielen derselben Mannschaft (offen, Momo entscheidet).

## Nächste Schritte

1. GitHub-Repository anlegen und über GitHub Pages veröffentlichen.
2. PDF-Report im Layout der bisherigen Auswertungen.
3. Excel-Export.
4. Bogen nachtragen (digitale Bogen-Ansicht zum Abtippen).
