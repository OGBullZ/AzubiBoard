# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Projekt

**AzubiBoard** — Ausbildungs-Management-Tool. React 19 + Vite 7 + PHP 8.2 + MariaDB. PWA mit 2FA, Multi-User-Sync, Conflict-Detection und Audit-Log.

Repository: https://github.com/OGBullZ/AzubiBoard  
Deployment-Server: Ubuntu LAMP, IP `10.14.99.10`, App unter `/azubiboard/`

## Aktueller Stand

**Letzter Commit:** `b815659` (18. Mai 2026) — HANDOVER.md update  
**Abgeschlossen:** Sprint 11 + Fehleranalyse/Bugfixes (Hover-Actions-Fix, API-Routing-Fix, install_ubuntu.sh)  
**Schema-Version:** v5 (`data.learningPaths`, `data.pathProgress`)

Vollständige Sprint-Historie → `HANDOVER.md`  
Cloud-Deploy-Anleitung → `DEPLOY.md`

## Build / Test

```bash
npm install
npm run dev       # Vite Dev-Server → http://localhost:5173/azubiboard/
npm test          # Vitest (44 Tests)
npm run e2e       # Playwright (6 Tests, braucht Chromium)
npm run build     # Produktions-Bundle → dist/
```

## Wichtige Coding-Patterns

**Pflicht beim State-Update:**
```js
setData({ ...data, foo: newValue })  // ✅ IMMER spreaden
setData({ foo: newValue })           // ❌ löscht projects/users/etc.
```

**Neue Routes immer lazy:**
```js
const NewPage = lazy(() => import('./features/xyz/NewPage.jsx'))
// + Suspense-Fallback in App.jsx
```

**PHP-Routes:** Reihenfolge spezifisch → allgemein. Spezifischere Patterns (z.B. `/api/data/backups/{day}`) müssen VOR dem allgemeinen (`/api/data/backups`) stehen — `respond()` beendet die Ausführung sofort.

**Store-Pattern:** `src/lib/store.js` — pub/sub mit BroadcastChannel für Multi-Tab-Sync. Keine direkte Manipulation, immer über `setData`.

## Wiederkehrende Probleme (Gotchas)

**OneDrive-Clash-Files** — Vor jedem Push prüfen:
```bash
find . -name "*Name clash*" -not -path "./node_modules/*" -not -path "./dist/*"
```
Wenn vorhanden: prüfen ob byte-identisch zu HEAD, dann löschen.

**PHP-Auth-Header** — Apache mod_php vs CGI unterschiedlich: `api/config.php` hat Fallback via `getallheaders()` + `REDIRECT_HTTP_AUTHORIZATION`. Nicht vereinfachen.

**dist/ ist gitignored** — `install_ubuntu.sh` baut auf dem Server selbst (`npm run build`). Nie dist/ committen.

**MySQL Socket-Auth (Ubuntu)** — Root hat kein Passwort bei frischer Installation. `mysql` (ohne `-u root`) als OS-root reicht.

**CSP + Tesseract.js** — `.htaccess` CSP muss `https://cdn.jsdelivr.net` und `https://tessdata.projectnaptha.com` in `connect-src` enthalten. Worker braucht `blob:` in `worker-src`.

## Dateien die NICHT ohne explizite Aufforderung geändert werden

- `api/config.php` — Auth/JWT/TOTP-Core, Änderungen haben Sicherheits-Impact
- `database/azubiboard.sql` — Ziel-Schema für Sprint 12, kein Spielfeld
- `.env.server` — Produktions-Credentials, nie committen
- `src/lib/migrations.js` — Schema-Migrationen sind irreversibel; nur bei explizitem Sprint

## Wichtige Pfade

- `src/App.jsx` — Root, Routing, Bootstrap
- `src/lib/dataService.js` — API/Save-Queue/Conflict-Detection
- `src/lib/utils.js` — ISO-KW, Datums-Helfer, Farb-Konstanten (C, ST)
- `src/lib/migrations.js` — Schema-Migrations v1–v5
- `src/lib/roles.js` — `isStaff()`, `isAusbilder()`, `isMentor()`
- `api/config.php` — JWT, TOTP, Rate-Limit, CORS-Helfer
- `api/routes/data.php` — JSON-Blob CRUD + Backups
- `public/.htaccess` → wird nach `dist/.htaccess` kopiert (SPA-Routing + CSP)
- `install_ubuntu.sh` — Ubuntu LAMP Deployment-Skript

## Datenbank

- Aktiv genutzte Tabellen: `users`, `app_data`, `app_data_history`, `partial_tokens`, `jwt_blocklist`, `share_links`, `audit_log`
- `database/setup.sql` — Minimal-Setup für neue Server
- `database/azubiboard.sql` — vollständiges Ziel-Schema (Sprint 12 / L5)

## Was als Nächstes sinnvoll ist

| Sprint | Item | Aufwand |
|---|---|---|
| **12** ⚠️ | **L5** — MySQL-Schema-Refactor (JSON-Blob → relationale Tabellen) | 3–5 Tage |
| **12** | Row-Level Security, Volltextsuche | mit L5 |
| **später** | **M4** Multi-Tenant, **M5** IHK-API | groß |

## Arbeitsregeln

**Rule 1 — Think Before Coding**  
Keine stillen Annahmen. Annahmen benennen, Tradeoffs zeigen, vor dem Raten fragen. Zurückdrängen wenn ein einfacherer Ansatz existiert.

**Rule 2 — Simplicity First**  
Minimaler Code der das Problem löst. Keine spekulativen Features. Keine Abstraktionen für Einmal-Code. Wenn ein Senior Engineer es überkompliziert nennen würde — vereinfachen.

**Rule 3 — Surgical Changes**  
Nur das anfassen was nötig ist. Keinen angrenzenden Code, Kommentare oder Formatierung "verbessern". Nichts refactoren was nicht kaputt ist. Bestehenden Stil beibehalten.

**Rule 4 — Goal-Driven Execution**  
Erfolgskriterien definieren. Loop bis verifiziert. Nicht sagen welche Schritte zu folgen sind — sagen wie Erfolg aussieht und iterieren lassen.

**Rule 5 — Use the Model Only for Judgment Calls**  
Claude für: Klassifikation, Drafts, Zusammenfassung, Extraktion aus unstrukturiertem Text.  
Nicht für: Routing, Retries, Status-Code-Handling, deterministische Transforms.  
Wenn ein Status-Code die Frage schon beantwortet, beantwortet Plain-Code die Frage.

**Rule 6 — Token Budgets Are Not Advisory**  
Pro-Task-Budget: 4.000 Tokens. Pro-Session-Budget: 30.000 Tokens.  
Bei Annäherung: zusammenfassen und neu starten. Nicht still überschreiten.  
Überschreitung melden > still überziehen.

**Rule 7 — Surface Conflicts, Don't Average Them**  
Wenn zwei Muster im Code sich widersprechen: nicht mischen.  
Eines wählen (das neuere / besser getestete), erklären warum, das andere zur Bereinigung markieren.  
"Durchschnitts-Code" der beide Regeln erfüllt ist der schlechteste Code.

**Rule 8 — Read Before You Write**  
Vor Code-Hinzufügen in einer Datei: Exports der Datei lesen, unmittelbaren Aufrufer lesen, offensichtliche Shared Utilities prüfen.  
Wenn unklar warum bestehender Code so strukturiert ist: fragen bevor man hinzufügt.

**Rule 9 — Tests Verify Intent, Not Just Behavior**  
Jeder Test muss kodieren WARUM das Verhalten wichtig ist, nicht nur WAS es tut.  
Ein Test der beim Ändern der Business-Logik nicht fehlschlägt — die Funktion ist falsch.

**Rule 10 — Checkpoint After Every Significant Step**  
Nach jedem Schritt in einer Mehr-Schritt-Aufgabe: zusammenfassen was erledigt ist, was verifiziert ist, was noch fehlt.  
Nicht aus einem Zustand weitermachen den man nicht zurückbeschreiben kann.

## Autonomie-Hinweis

User hat volle Autonomie für AzubiBoard gewährt: Commits, Pushes, Datei-Edits ohne Bestätigungs-Prompts. Nur bei genuinen destruktiven Aktionen (Daten löschen, Force-Push auf main) kurz kommunizieren.
