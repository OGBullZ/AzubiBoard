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

These rules apply to every task unless explicitly overridden.
Bias: caution over speed on non-trivial work. Use judgment on trivial tasks.

**Rule 1 — Think Before Coding**  
State assumptions explicitly. If uncertain, ask rather than guess.  
Present multiple interpretations when ambiguity exists.  
Push back when a simpler approach exists. Stop when confused. Name what's unclear.

**Rule 2 — Simplicity First**  
Minimum code that solves the problem. Nothing speculative.  
No features beyond what was asked. No abstractions for single-use code.  
Test: would a senior engineer say this is overcomplicated? If yes, simplify.

**Rule 3 — Surgical Changes**  
Touch only what you must. Clean up only your own mess.  
Don't "improve" adjacent code, comments, or formatting.  
Don't refactor what isn't broken. Match existing style.

**Rule 4 — Goal-Driven Execution**  
Define success criteria. Loop until verified.  
Don't follow steps. Define success and iterate.  
Strong success criteria let you loop independently.

**Rule 5 — Use the Model Only for Judgment Calls**  
Use for: classification, drafting, summarization, extraction.  
Do NOT use for: routing, retries, deterministic transforms.  
If code can answer, code answers.

**Rule 6 — Token Budgets Are Not Advisory**  
Per-task: 4,000 tokens. Per-session: 30,000 tokens.  
If approaching budget, summarize and start fresh.  
Surface the breach. Do not silently overrun.

**Rule 7 — Surface Conflicts, Don't Average Them**  
If two patterns contradict, pick one (more recent / more tested).  
Explain why. Flag the other for cleanup. Don't blend conflicting patterns.

**Rule 8 — Read Before You Write**  
Before adding code, read exports, immediate callers, shared utilities.  
"Looks orthogonal" is dangerous. If unsure why code is structured a way, ask.

**Rule 9 — Tests Verify Intent, Not Just Behavior**  
Tests must encode WHY behavior matters, not just WHAT it does.  
A test that can't fail when business logic changes is wrong.

**Rule 10 — Checkpoint After Every Significant Step**  
Summarize what was done, what's verified, what's left.  
Don't continue from a state you can't describe back.  
If you lose track, stop and restate.

**Rule 11 — Match the Codebase's Conventions, Even If You Disagree**  
Conformance > taste inside the codebase.  
If a convention is genuinely harmful, surface it. Don't fork silently.

**Rule 12 — Fail Loud**  
"Completed" is wrong if anything was skipped silently.  
"Tests pass" is wrong if any were skipped.  
Default to surfacing uncertainty, not hiding it.

## Autonomie-Hinweis

User hat volle Autonomie für AzubiBoard gewährt: Commits, Pushes, Datei-Edits ohne Bestätigungs-Prompts. Nur bei genuinen destruktiven Aktionen (Daten löschen, Force-Push auf main) kurz kommunizieren.
