# AzubiBoard – Roadmap

> Priorisierte Verbesserungen vom aktuellen Prototyp zur produktionsfähigen App.

---

## Phase 1 — Fundament (kurzfristig)
*Ziel: Kritische Bugs & Sicherheit beheben, App stabil machen*

### 1.1 Authentifizierung & Sicherheit
- [ ] Passwörter gehasht speichern (bcrypt / Argon2) — aktuell Plaintext
- [ ] Auto-Login (`anna@azubi.de`) entfernen
- [ ] Demo-Zugangsdaten aus dem UI-Code heraushalten (ENV-Variable oder separates Seed-File)
- [ ] Session-Ablauf & Logout-Timeout einführen

### 1.2 Datenpersistenz
- [ ] Datenverlust durch Browser-Clear beheben: Backup-/Export-Funktion (JSON-Download)
- [ ] JSON-Import zum Wiederherstellen von Daten
- [ ] Fehlende Standardwerte absichern (Tasks ohne `status`, Projekte ohne `assignees`-Array)

### 1.3 Fehlerbehebung & UX
- [ ] Error Boundary einbauen (App darf nicht komplett abstürzen)
- [ ] Leere Zustände für alle Listen einheitlich gestalten
- [ ] `confirm()` durch echte Bestätigungs-Dialoge ersetzen
- [ ] Formular-Validierung überall vereinheitlichen

---

## Phase 2 — Kernfunktionen ausbauen (mittelfristig)
*Ziel: Die täglich genutzten Features vollständig und robust machen*

### 2.1 Aufgabenverwaltung
- [ ] **Kanban-Board** — Drag & Drop zwischen Status-Spalten
- [ ] Aufgaben kommentieren (Verlauf sichtbar)
- [ ] Zeitschätzung vs. tatsächlicher Aufwand erfassen
- [ ] Aufgaben filtern & sortieren (nach Priorität, Deadline, Zugewiesenem)
- [ ] Wiederkehrende Aufgaben (täglich / wöchentlich)

### 2.2 Berichtswesen
- [ ] **PDF-Export** für Wochenberichte (html2pdf oder Puppeteer)
- [ ] Strukturierte Berichtsfelder statt freie Textfelder (Tätigkeiten, Lernziele, Probleme)
- [ ] Ausbilder-Kommentarfunktion direkt im Bericht
- [ ] Benachrichtigung wenn Bericht eingereicht wurde
- [ ] Berichts-Statusübersicht für Ausbilder (alle Azubis auf einen Blick)

### 2.3 Lernmodul
- [ ] Quiz-Fragen aus Datei laden statt hardcoded (JSON/Markdown)
- [ ] Ausbilder kann eigene Fragen & Aufgaben erstellen
- [ ] Lernfortschritt pro Themenbereich tracken
- [ ] Lerninhalte: Dokumente, Links, Dateien hochladen
- [ ] Verschiedene Themenbereiche (nicht nur Java)

### 2.4 Kalender
- [ ] Wiederkehrende Termine
- [ ] Eventdetail-Ansicht (Klick auf Termin → vollständige Info)
- [ ] Termine löschen & bearbeiten
- [ ] Monats- vs. Wochenansicht umschalten

### 2.5 Gruppen & Nutzerverwaltung
- [ ] Ausbilder kann Azubi-Profile anlegen, bearbeiten, deaktivieren
- [ ] Lehrjahr automatisch hochzählen
- [ ] Gruppenmitglieder bearbeiten (nicht nur beim Erstellen)
- [ ] Azubi-Profil-Seite (Übersicht aller Projekte, Berichte, Lernstand)

---

## Phase 3 — Collaboration & Workflow (mittelfristig)
*Ziel: Zusammenarbeit zwischen Azubis und Ausbilder verbessern*

### 3.1 Benachrichtigungen
- [ ] In-App Benachrichtigungen (Deadline morgen, Bericht ausstehend, Kommentar erhalten)
- [ ] Notification-Center mit Gelesen/Ungelesen-Status
- [ ] Optional: Browser-Push-Notifications

### 3.2 Team-Kommunikation
- [ ] Kommentare auf Projektebene (einfaches Message-Board)
- [ ] @Erwähnungen in Kommentaren
- [ ] "Team Chat"-Feature fertigstellen (aktuell als "Bald" markiert)

### 3.3 Projekttemplates
- [ ] Projekte duplizieren
- [ ] Templates für Standardprojekte (z.B. Abschlussprojekt, Schulprojekt)
- [ ] Projektarchiv mit Suchfunktion

### 3.4 Netzplan / Gantt
- [ ] Kritischen Pfad farblich hervorheben (CPM-Berechnung vorhanden, Visualisierung fehlt)
- [ ] Gantt-Balken per Drag & Drop verschieben
- [ ] Abhängigkeiten grafisch einzeichnen
- [ ] Export als Bild/PDF

---

## Phase 4 — Backend & Mehrbenutzer (langfristig)
*Ziel: Mehrere Nutzer können gleichzeitig arbeiten, Daten liegen sicher auf einem Server*

### 4.1 Backend-API
- [ ] REST-API aufbauen (Node.js/Express oder PHP — bestehende PHP-Dateien als Basis)
- [ ] Datenbank einrichten (SQLite für Einstieg, später PostgreSQL/MySQL)
- [ ] Bestehende PHP-API-Routen (`api_routes_*.php`) fertigstellen & verbinden
- [ ] JWT-Authentifizierung

### 4.2 Echtzeit-Sync
- [ ] Dateiänderungen zwischen mehreren Tabs synchronisieren (BroadcastChannel API — ohne Backend möglich)
- [ ] Mit Backend: WebSocket für Live-Updates (z.B. wenn Ausbilder Bericht kommentiert)

### 4.3 Datei-Uploads
- [ ] Dateianhänge bei Berichten (PDF, Bilder)
- [ ] Projektdokumente verwalten
- [ ] Speicherplatz-Limit pro Nutzer

### 4.4 Datensicherheit
- [ ] HTTPS erzwingen
- [ ] Input-Sanitization serverseitig
- [ ] Rate-Limiting für Login
- [ ] DSGVO-konformes Nutzer-Daten-Löschen

---

## Phase 5 — Qualität & Skalierung (dauerhaft)
*Ziel: Code-Qualität und langfristige Wartbarkeit sichern*

### 5.1 TypeScript
- [ ] Schrittweise Migration von `.jsx` → `.tsx`
- [ ] Typen für Datenmodelle: `Project`, `Task`, `User`, `Report`
- [ ] Zod-Schemas für Formular-Validierung

### 5.2 Tests
- [ ] Unit-Tests für Utility-Funktionen (`utils.js`: CPM, uid, fmtDate)
- [ ] Komponenten-Tests mit Vitest + Testing Library
- [ ] E2E-Tests für kritische Flows (Login, Projekt erstellen, Bericht einreichen)

### 5.3 Performance
- [ ] `React.memo` / `useMemo` für teure Berechnungen (Dashboard-Statistiken)
- [ ] Virtualisierung für lange Listen (z.B. react-window)
- [ ] Code-Splitting per Route (React.lazy)

### 5.4 Responsives Design
- [ ] Mobile-Layout (Sidebar als Drawer auf kleinen Bildschirmen)
- [ ] Touch-Gesten für Kalender & Kanban
- [ ] Progressive Web App (PWA) — installierbar auf dem Handy

### 5.5 Barrierefreiheit
- [ ] Keyboard-Navigation überall
- [ ] ARIA-Labels vollständig
- [ ] Farbkontrast WCAG AA-konform prüfen
- [ ] Screen-Reader-Tests

---

## Schnellgewinne (jederzeit umsetzbar)
*Klein, hoher Effekt, kein Umbau nötig*

- [ ] Dark/Light-Mode Toggle — Schalter ist da, CSS-Variablen fehlen für Light
- [ ] Sidebar einklappbar machen (nur Icons, kein Text)
- [ ] Globale Suche (Projekte + Aufgaben + Berichte durchsuchen)
- [ ] Tastaturkürzel: `N` = neues Projekt, `Esc` = Modal schließen
- [ ] Seitentitel (`<title>`) je nach aktiver Route setzen
- [ ] Lesezeichen / Favoriten für Projekte
- [ ] Sortierung in Projektliste (nach Deadline, Status, Titel)
- [ ] Massenaktionen: mehrere Aufgaben gleichzeitig abschließen

---

## Technologien (Empfehlungen)

| Bereich | Aktuell | Empfehlung |
|---|---|---|
| State | Custom Store | Zustand (bereits installiert) |
| Validierung | — | Zod |
| Typen | JS | TypeScript |
| Tests | — | Vitest + Testing Library |
| Backend | PHP (unfertig) | Express.js oder Hono |
| Datenbank | localStorage | SQLite → PostgreSQL |
| PDF-Export | — | @react-pdf/renderer |
| Drag & Drop | — | @dnd-kit/core |
| Charts | — | Recharts |
| Animationen | CSS | Framer Motion |

---

*Zuletzt aktualisiert: Mai 2026*
