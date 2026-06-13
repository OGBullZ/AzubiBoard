# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Projekt

**AzubiBoard** — Ausbildungs-Management-Tool. React 19 + Vite 7 + PHP 8.2 + MariaDB. PWA mit 2FA, Multi-User-Sync, Conflict-Detection und Audit-Log.

Repository: https://github.com/OGBullZ/AzubiBoard  
Deployment-Server: Ubuntu LAMP, IP `10.14.99.10`, App unter `/azubiboard/`

## Aktueller Stand

**Letzter Commit:** `a26e779` (4. Juni 2026) — typecheck+lint als CI-Gates  
**Abgeschlossen:** Sprint 11–14 — u.a. Sprint 12 (L5 MySQL-Refactor: Phasen 0–3, Dual-Write/RLS/Audit, Schema-Read-Layer hinter `VITE_USE_SCHEMA`), Sprint 13 (i18n 227 Keys, TS-Setup), Sprint 14 (AI1/AI2/UX1, **vollständige TS-Migration: src/ 100% .ts/.tsx, strict-clean, 0 @ts-nocheck**, Schema-Schärfung).  
**Schema-Version:** v5 (`data.learningPaths`, `data.pathProgress`)  
**Typen:** Zod-Schemas in `src/lib/schemas.ts` → `z.infer` in `src/types.ts`. Boundary-`any` (store/trash/dataService, Blob↔Schema, Consumer-Typen) ist bewusst+dokumentiert; `tsc --noEmit` (strict) ist das Typ-Gate, `no-explicit-any` ist daher aus.

Vollständige Sprint-Historie → `HANDOVER.md`  
Cloud-Deploy-Anleitung → `DEPLOY.md`

## Build / Test

```bash
npm install
npm run dev        # Vite Dev-Server → http://localhost:5173/azubiboard/
npm run typecheck  # tsc --noEmit (strict) — CI-Gate
npm run lint       # eslint . (deckt .js/.jsx UND .ts/.tsx ab) — CI-Gate
npm test           # Vitest (78 Tests)
npm run e2e        # Playwright (alle E2E, braucht Chromium)
npm run e2e:smoke  # Boot-Smoke-Gate: bootet App + sweept alle Routen eingeloggt (kein Blackscreen)
npm run build      # Produktions-Bundle → dist/ (vite build, prüft KEINE Typen → typecheck separat!)
```

**Boot-Smoke vor „review-ready":** `e2e/smoke.spec.js` fängt Laufzeit-/Router-Crashes („Blackscreen"),
die typecheck/lint/test/build NICHT sehen. Lokal ohne den (auf Windows hängenden) Playwright-Browser-Download:
`PW_CHANNEL=msedge npm run e2e:smoke` nutzt das installierte Edge. CI nutzt gebündeltes Chromium.

CI (`ci.yml`, unit-Job) fährt: `typecheck → lint → test → build`. PHPUnit/E2E/Lighthouse als eigene Jobs.

## Wichtige Coding-Patterns

**Pflicht beim State-Update:**
```js
setData({ ...data, foo: newValue })  // ✅ IMMER spreaden
setData({ foo: newValue })           // ❌ löscht projects/users/etc.
```

**Neue Routes immer lazy:**
```ts
const NewPage = lazy(() => import('./features/xyz/NewPage.tsx'))
// + Suspense-Fallback in App.tsx
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

Behavioral guidelines to reduce common LLM coding mistakes.
Bias: caution over speed on non-trivial work. Use judgment on trivial tasks.

### Rule 1 — Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### Rule 2 — Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### Rule 3 — Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### Rule 4 — Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

### Rule 5 — Use the Model Only for Judgment Calls

Use for: classification, drafting, summarization, extraction from unstructured text.  
Do NOT use for: routing, retries, status-code handling, deterministic transforms.  
If a status code already answers the question, plain code answers the question.

### Rule 6 — Token Budgets Are Not Advisory

Per-task: 4,000 tokens. Per-session: 30,000 tokens.  
If approaching budget, summarize and start fresh.  
Surface the breach. Do not silently overrun.

### Rule 7 — Surface Conflicts, Don't Average Them

If two existing patterns in the codebase contradict, don't blend them.  
Pick one (the more recent / more tested), explain why, flag the other for cleanup.  
"Average" code that satisfies both rules is the worst code.

### Rule 8 — Read Before You Write

Before adding code in a file, read the file's exports, the immediate caller, and any obvious shared utilities.  
"Looks orthogonal to me" is the most dangerous phrase in this codebase.  
If you don't understand why existing code is structured a way, ask before adding to it.

### Rule 9 — Tests Verify Intent, Not Just Behavior

Every test must encode WHY the behavior matters, not just WHAT it does.  
If you can't write a test that would fail when business logic changes, the function is wrong.

### Rule 10 — Checkpoint After Every Significant Step

After each step in a multi-step task: summarize what was done, what's verified, what's left.  
Don't continue from a state you can't describe back.  
If you lose track, stop and restate.

### Rule 11 — Match the Codebase's Conventions, Even If You Disagree

Conformance > taste inside the codebase.  
If you genuinely think a convention is harmful, surface it. Don't fork silently.

### Rule 12 — Fail Loud

"Completed" is wrong if anything was skipped silently.  
"Tests pass" is wrong if any were skipped.  
Default to surfacing uncertainty, not hiding it.

## Autonomie-Hinweis

User hat volle Autonomie für AzubiBoard gewährt: Commits, Pushes, Datei-Edits ohne Bestätigungs-Prompts. Nur bei genuinen destruktiven Aktionen (Daten löschen, Force-Push auf main) kurz kommunizieren.
