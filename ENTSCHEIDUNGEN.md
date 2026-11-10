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

- **Design** (10.11.2026, Momos Wahl aus zwei Vorschlägen): Vorschlag B „Klemmbrett“ für die ganze App (hell, Rot und Schwarz wie das Logo, Schriften IBM Plex). Erfassen als Bogen wie auf Papier: Zeilen = Personen, Spalten = Elemente, ein Tipp auf die Zelle wählt beides. Zeichen im Bogen wie auf dem Papier (Positionsziffer, # Ass oder Blockpunkt, 0 gut, − ok, / schlecht, = Fehler), farbig nach Ergebnis, Punkte unterstrichen. Gegnerknöpfe speichern sofort. Verlauf zum Korrigieren über den Knopf „Verlauf“. Auswertung im Stil von Vorschlag A „Anzeigetafel“ (immer dunkel, große schmale Zahlen). Schriften sind in die App eingebaut, kein Abruf bei Google.
- **Standardfarben** neuer Mannschaften: Rot #d7262e und Schwarz #16181d. Mannschaften mit den alten Standardfarben (Blau, Gelb) wurden automatisch umgestellt, selbst gewählte Farben bleiben.

- **Profi-Modus neu** (10.11.2026, Momo): für die Videoanalyse eigener Spiele, wie DataVolley oder Click&Scout. Simpel bleibt für Live-Erfassung allein im unteren Ligabetrieb. Damit sind Rotation, Sideout, Break und Läufer jetzt doch enthalten, aber nur im Profi-Modus.
  - Jeder Ballwechsel komplett, nur eigenes Team. Vom Gegner nur das Ende des Ballwechsels (Gegner punktet, Gegnerfehler, Aufschlagfehler).
  - Ein Ballwechsel endet mit jeder Aktion, die einen Punkt entscheidet. Rotation, Aufschlagrecht und Spielstand werden daraus abgeleitet.
  - Pro Satz Startaufstellung (Position I bis VI), Libero, Zuspielerin für die Läufer und wer zuerst aufschlägt. Automatische Rotation bei Sideout. Wechsel über einen eigenen Knopf. Libero wird direkt angetippt, Libero-Wechsel muss man nicht eintragen.
  - Läufer = Position der Zuspielerin (1 bis 6).
  - Bei eigenem Aufschlag ist die Aufschlägerin vorgewählt. Diese Vorwahl zählt nicht als Schritt.
  - Die Vorwahl folgt immer der Person auf Position I (10.11.2026, Fehlerkorrektur): Nach einem Wechsel der Aufschlägerin (oder einem zurückgenommenen Wechsel) springt die Vorwahl auf die neue Person, auch wenn das Ergebnis schon getippt ist. Nach „Schritt zurück“ wird beim erneuten Erreichen des Ballwechsels wieder vorgewählt. „Abbrechen“ wählt nicht sofort wieder vor. Wer selbst eine andere Person antippt, behält seine Wahl.
  - Video läuft in der App. Die Datei bleibt auf dem Gerät und wird nur im Speicher geöffnet. Gespeichert werden der Dateiname und pro Aktion die Videozeit. Szenen starten 3 Sekunden vorher.
  - Profi-Auswertung: Sideout, Break, First-Ball-Sideout, Sideout und Break pro Läufer, Angriff nach Annahme oder im Konter, Verteilung nach guter oder schwacher Annahme, Zielzonen für Angriff und Aufschlag, Zuspiel pro Zuspielerin, Abwehr pro Person, Videoszenen mit Filter.

- **PDF und Excel** (10.11.2026): beides entsteht direkt auf dem Gerät, ohne Server. PDF mit jsPDF, Schriften IBM Plex und Barlow Condensed eingebettet (aus den App-Schriften umgewandelt, Skript `scripts/woff2ttf.py`). Aufbau: 1 Überblick (Ergebnis, Einleitung, 8 Kacheln, Fazit mit 8 neutralen Punkten, Satz für Satz), 2 Sätze und Spielerinnen, 3 Positionen, Aufschlag, So wurde gezählt, Datenqualität, 4 pro Satz (bei Profi mit Aufstellung), 5 nur Profi (Sideout und Break, Läufer, Phasen, Zielzonen, Zuspiel, Abwehr). Excel mit den Blättern Übersicht, Alle Werte, Läufer (nur Profi), Pro Satz, Aktionen (jede Aktion einzeln, bei Profi mit Ballwechsel, Läufer, Spielstand und Videozeit).
- **Weitergeben:** fertige Datei im Dialog „ist fertig“. Auf dem iPad „Teilen oder sichern“ (Teilen-Menü: Dateien, WhatsApp, Mail), sonst Herunterladen. Gilt auch für die Sicherung. Export-Knöpfe in der Auswertung und in den Einstellungen.

- **Abwehr** (10.11.2026, Momo): zwei Arten verlorener Bälle. „Fehler (vermeidbar)“ (Ballkontrolle, Absprache) zählt als eigener Fehler und senkt die Bilanz. „Gegner punktet (unhaltbar)“ ist ein gut erzielter Gegnerpunkt: Punkt für den Gegner, kein eigener Fehler, zählt bei „vom Gegner erspielt“. Zeichen im Bogen: = und ×.
- **Texte und Vorzeichen** (10.11.2026): Einzahl wird ausgeschrieben („1 Punkt aus 1 Angriff“, „1 Ass“). Negative Werte stehen in App und PDF überall mit dem echten Minuszeichen (−). In Excel bleiben es Zahlen. Die Kachel „Eigene Fehler“ nennt im Profi-Spiel auch Zuspiel und Abwehr.
- **Bogen: wer spielt, steht oben** (10.11.2026, Wunsch von Momo): Im Simpel-Bogen öffnet der Knopf „Wer spielt?“ eine Auswahl. Namen antippen, die Gewählten stehen oben, der Rest unter der Trennzeile „Bank“. Bewusst Antippen statt Ziehen, das geht am iPad schneller und sicherer. Die Auswahl gilt für das ganze Spiel und bleibt gespeichert (`court` am Spiel). Im Profi-Modus sortiert der Bogen-Reiter von selbst nach der Aufstellung (Feld und Libero oben).
- **Spiel löschen** (10.11.2026, Wunsch von Momo): In der Spieleliste auf der Startseite hat jedes Spiel einen Knopf ✕. Nach einer Rückfrage werden das Spiel und alle seine Aktionen gelöscht. Nicht rückgängig zu machen, deshalb vorher Sicherung.
- **Veröffentlichung:** GitHub Pages über GitHub Actions (`.github/workflows/pages.yml`), baut bei jeder Änderung auf `main` neu.

## Nächste Schritte

1. Bogen nachtragen (digitale Bogen-Ansicht zum Abtippen).
