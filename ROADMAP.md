# AzubiBoard – Roadmap

> Stand: 2026-05-16 · Letzter Sprint: **9-Quality** (Branch `sprint-9-quality`, gepusht, ungemerged) · Roadmap v4

---

## ✅ Abgeschlossen

| Sprint | Commit | Inhalt |
|---|---|---|
| **9-Quality** | `af5f26f` | ErrorBoundary pro Route (H2), Dashboard-Refactor 1236→373 Zeilen + 11 Widget-Files (H3), silent-catch fix (H4), BoundingRect-Cache NetzplanGantt (H5), migrations-Test auf v4 |
| **Hotfix** | `6267b47` | Status „Abgeschlossen" statt „In Ordnung", Material-Aufgaben-Zuordnung + Sortierung |
| **8** | `8b07bbd` | 2FA (TOTP + Recovery-Codes), Server-Audit-Log, CSP-Härtung |
| **7** | `115035c` | Sentry Error-Tracking, Server-Backups (30 Tage), Schema-Migrations, Background-Sync (PWA) |
| **6** | `d51fd3f` | Bulk-Import Lernziele, IHK-PDF, Public-Share-Links, Code-Splitting, GitHub-CI, Browser-Push |
| **5** | `f152826` | Conflict-Detection (ETag/If-Match), Papierkorb (Soft-Delete), Playwright E2E |
| **4** | `9d9e850` | Smart-Polling-Sync (ersetzt SSE, FastCGI-kompatibel) |
| **3** | `c4d7ea3` | PHP-Backend-Hardening, Rate-Limiting, Backup-Reminder, i18n-Scaffold |
| **2** | `e26a0e4` | Save-Queue mit Exponential-Backoff, Audit-Log Frontend, Vitest-Setup |
| **1** | `fd16443` | Kritische Datenverlust-Bugs, ISO-Kalenderwochen, Mobile-DnD, Toast-Undo |

---

## 🔜 Sprint 9-Merge — Quality nach main bringen (S, ~1 h)

> **Ziel:** `sprint-9-quality` (5 Commits, gepusht) sauber in `main` integrieren, bevor neuer Code dazukommt.

| | Item | Details |
|---|---|---|
| **M-1** | Lokale Verifikation | `git checkout sprint-9-quality && npm ci && npm test && npm run build` — 44/44 grün, Build OK |
| **M-2** | PR aufmachen | `gh pr create` von `sprint-9-quality` → `main`, Beschreibung aus Commit-Messages H2/H3/H4/H5 |
| **M-3** | CI grün abwarten | GitHub Actions `ci.yml` muss durchlaufen (Vitest + Playwright + Build) |
| **M-4** | Squash-Merge | Ein Commit auf `main`: „Sprint 9-Quality: ErrorBoundary, Dashboard-Refactor, perf, catch-fix" |
| **M-5** | Branch löschen | `git push origin --delete sprint-9-quality` + lokal `git branch -d` |

---

## 🔜 Sprint 9.5 — Security-Hot-Issues (M, ~1 Tag)

> **Ziel:** Drei in der Sprint-9-Audit gefundene Auth-/Session-Schwächen beheben, bevor produktiv deployed wird.

| | Item | Risiko | Fix |
|---|---|---|---|
| **B1** | Partial-Token bei 2FA hat 7d Expiry | Gestohlener Partial-Token = 7d Login-Fenster ohne TOTP | Expiry auf 5 min, Single-Use-Nonce in DB-Tabelle `partial_tokens` (id, user_id, used_at, expires_at) |
| **B2** | 2FA-Disable ohne TOTP-Bestätigung | Angreifer mit Session-Cookie kann 2FA abschalten | Endpoint `POST /api/2fa/disable` verlangt aktuelles TOTP **oder** Recovery-Code |
| **B5** | Kein Logout-Blocklist (JWT) | Logout invalidiert nur localStorage, JWT bleibt bis Expiry gültig | DB-Tabelle `jwt_blocklist` (jti, expires_at), Auth-Middleware prüft jti; Cleanup-Cron täglich |
| **B5+** | JWT um `jti`-Claim erweitern | Voraussetzung für B5 | `auth.php` setzt `jti = bin2hex(random_bytes(16))` bei Token-Issue |

**Tests:** Vitest-Unit für Token-Lifecycle, Playwright-E2E „Logout invalidiert Backend-Calls".

---

## 🔜 Sprint 9-DevOps — Auto-Deploy auf Linux-LAMP (L, 1–2 Tage)

> **Ziel:** Produktionsbetrieb auf eigenem Linux-Server (SSH + Cron + git pull), getrennt vom existierenden Netlify/SFTP-Workflow.

### Voraussetzungen (vor Sprint-Start abhaken)
- [ ] Server-Host steht (eigene Hardware / VPS / Hetzner / Strato-VServer)
- [ ] Domain auf Server-IP gezeigt (A-Record)
- [ ] Apache + PHP 8.2 + MySQL 8 + Node 20 installiert
- [ ] Non-root deploy-User `azubiboard` mit sudo nur für `systemctl reload apache2`

### Tasks

| | Item | Details |
|---|---|---|
| **OPS3** | Deploy-Key auf Server | `ssh-keygen -t ed25519 -C "deploy@azubiboard" -f ~/.ssh/azubiboard_deploy` als `azubiboard`-User; Public-Key als **Read-only** Deploy-Key in GitHub-Repo-Settings hinterlegen |
| **OPS4** | Prod-`.env` | `/var/www/azubiboard/.env.production` mit `JWT_SECRET` (32 random bytes), `DB_HOST/USER/PASS`, `ALLOWED_ORIGIN=https://<domain>`, `VITE_SENTRY_DSN`, Permissions `chmod 600`, Owner `azubiboard:www-data` |
| **OPS2** | Auto-Deploy via Cron | `/usr/local/bin/azubiboard-deploy.sh` (siehe unten), Cron `*/5 * * * * azubiboard /usr/local/bin/azubiboard-deploy.sh >> /var/log/azubiboard-deploy.log 2>&1` |
| **OPS5** | Fail2ban + UFW | UFW: nur 22/80/443 offen (22 idealerweise auf nicht-default-Port + SSH-Key-only); Fail2ban-Jail für `sshd` (5 fails / 10 min → 1h ban) und Custom-Jail für `/api/auth/login` (regex auf `auth.log` der App) |
| **OPS6** | Deploy-Log + Mail | `logrotate.d/azubiboard-deploy` (täglich, 14 Tage), bei Exit-Code ≠ 0 → `mail -s "AzubiBoard Deploy FAIL" admin@…` |
| **OPS7** *(neu)* | Apache-VHost + HTTPS | VHost mit `DocumentRoot /var/www/azubiboard/current/dist`, Alias `/api → /var/www/azubiboard/current/api`, `certbot --apache -d <domain>` |
| **OPS8** *(neu)* | DB-Backup-Cron | Tägliches `mysqldump --single-transaction azubiboard | gzip > /var/backups/azubiboard/db-$(date +%F).sql.gz`, 30 Tage Retention. **Hinweis:** Sprint 7 hat bereits App-Level-Snapshots — DB-Dump ist die Belt-und-Hosenträger-Variante. |

### `azubiboard-deploy.sh` (Skelett)
```bash
#!/usr/bin/env bash
set -euo pipefail
REPO=/var/www/azubiboard/repo
RELEASE=/var/www/azubiboard/releases/$(date +%Y%m%d-%H%M%S)
CURRENT=/var/www/azubiboard/current

cd "$REPO"
git fetch --quiet origin main
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
[ "$LOCAL" = "$REMOTE" ] && exit 0   # nichts zu tun

mkdir -p "$RELEASE"
git --work-tree="$RELEASE" checkout -f origin/main
cp /var/www/azubiboard/.env.production "$RELEASE/.env"
cd "$RELEASE"
npm ci --omit=dev --silent
npm run build --silent
ln -sfn "$RELEASE" "$CURRENT"
sudo systemctl reload apache2
# Retention: nur letzte 5 Releases behalten
ls -1dt /var/www/azubiboard/releases/* | tail -n +6 | xargs -r rm -rf
echo "[$(date)] deployed $REMOTE"
```

---

## 🔜 Sprint 10 — Adoption & Kommunikation (M, 2–3 Tage)

> **Ziel:** App nützlicher für den Betriebsalltag machen.

| | Item | Details |
|---|---|---|
| **M3** | Wöchentliche Ausbilder-Mail | PHP-Cron Mo 07:00 + PHPMailer/SMTP: „X Berichte zu prüfen, Y Aufgaben überfällig, Z Azubis ohne Aktivität ≥ 7 Tage". Opt-out pro User in Settings |
| **M2** | Mentor-Rolle | 3. Rolle `mentor` (lesen + kommentieren, **keine** Approval, keine Edits). DB: `users.role ENUM('azubi','mentor','ausbilder')`. UI: Approval-Buttons ausblenden für `mentor` |
| **K2** | Field-Level Permissions | Azubi darf eigene Berichte nicht löschen nach `submitted_at IS NOT NULL`; Ausbilder-only Felder (`approval_note`, `grade`) in Frontend ausblenden + Backend rejecten |
| **K4** | Upload-Härtung | MIME-Validierung per Magic-Bytes (`finfo_buffer`) statt nur `$_FILES['type']`, ClamAV-Hook (`clamdscan --stream` falls Daemon läuft, sonst skip mit Warn-Log), Größenlimit `upload_max_filesize=10M` |

---

## 🔜 Sprint 11 — Power-Features (L, 4–5 Tage)

> **Ziel:** Differenzierung, Lernbereich ausbauen.

| | Item | Details |
|---|---|---|
| **M1** | PDF-OCR Import | Tesseract.js clientseitig (lazy-loaded, ~10 MB Worker), handschriftliche Berichte → vorausgefülltes Formular. Genauigkeit ~70 % bei Druckschrift, Handschrift schwach — als „Vorschlag" labeln |
| **C2** | Lernpfade | Strukturierte Reihenfolge von Lernzielen pro Lehrjahr/Quartal, Voraussetzungs-Graph (DAG), gesperrte Inhalte bis Vorgänger abgeschlossen |
| **F-Quality** | Debouncing breit ausrollen (M1 aus Quality-Audit) | Search-Inputs, Editor-Saves auf 300 ms debouncen — derzeit teils per keystroke |
| **F-a11y** | a11y Pass 2 | Fokus-Reihenfolge, Skip-Links, Live-Regions für Toasts, Kontrast-Check |

---

## 🔜 Sprint 12 — MySQL-Schema-Refactor (XL, 3–5 Tage)

> **Ziel:** Basis für Multi-Tenant und Volltextsuche. Erst **nach** Sprint 9.5 + 10 — sonst kollidiert es mit B1/B2/M2-Schema-Änderungen.

| | Item | Details |
|---|---|---|
| **L5** | JSON-Blob → relationale Tabellen | `projects`, `tasks`, `reports`, `goals` als eigene MySQL-Tabellen (Schema in `database/azubiboard.sql`) |
| | Migrations-Script | Bestehenden Blob-Inhalt in neue Tabellen überführen, Backup vorher Pflicht |
| | Feature-Flag | `VITE_USE_SCHEMA=true` für schrittweise Migration ohne Downtime, Dual-Write während Übergang |
| | Row-Level Security | Ausbilder sieht nur Azubis seiner Gruppe (`groups.id`-Join in jedem Query) |
| | Volltextsuche | `FULLTEXT INDEX` auf `reports.content`, `tasks.title+description` |

---

## 🔮 Sprint 13+ — Skalierung & Vision

| | Item | Aufwand |
|---|---|---|
| **T1** | TypeScript Migration | Schrittweise `.jsx` → `.tsx`, Zod-Schemas für API-Boundaries zuerst | XL |
| **I1** | i18n Vollmigration | ~300 verbleibende Strings auf DE/EN-Keys umstellen | M |
| **M4** | Multi-Tenant | Eigene Firmen/Schulen mit isolierten Daten — nur nach L5 sinnvoll | L |
| **M5** | IHK-Direktanbindung | Sofern öffentliche API verfügbar | XL |
| **P2** | Öffentlicher Zugriff | SSH-Härtung (Port-Änderung, Fail2ban), optional WireGuard-VPN für Remote-Arbeit | M |

---

## 🐞 Offene Bugs / Kleinigkeiten

| Priorität | Item |
|---|---|
| Medium | i18n-Scaffold unvollständig (~50 von ~350 Strings übersetzt) — siehe I1 |
| Low | Lighthouse-Schwellen (non-blocking in CI) |
| Low | `HANDOVER.md` referenziert noch alte Sprint-9-Definition — nach 9-Merge anpassen |

---

## Reihenfolge-Empfehlung

```
Sprint 9-Merge   (1 h)   ← jetzt sofort, blockt nichts
Sprint 9.5       (1 Tag) ← vor Live-Deploy zwingend
Sprint 9-DevOps  (1-2 T) ← sobald Server-Host steht
Sprint 10        (2-3 T)
Sprint 11        (4-5 T)
Sprint 12        (3-5 T) ← großer Refactor, nicht parallel zu 10/11
Sprint 13+       offen
```

---

## Aufwands-Legende

| Symbol | Bedeutung |
|---|---|
| S | < 2 Stunden |
| M | halber Tag bis 1 Tag |
| L | 1–2 Tage |
| XL | 3–5 Tage |
