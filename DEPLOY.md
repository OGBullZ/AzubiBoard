# 🚀 AzubiBoard — Cloud-Deploy-Anleitung

Drei Optionen, sortiert von **schnell+kostenlos** zu **vollständig+kostenpflichtig**.

| Option | Backend? | Kosten | Setup-Dauer | Geeignet für |
|---|---|---|---|---|
| **A — Netlify (Frontend-only)** | ❌ localStorage | 0 € | 5 min | Live-Demo, eigene Nutzung, keine Multi-User |
| **B — Cloudflare Pages** | ❌ localStorage | 0 € | 5 min | wie A, schnelleres CDN |
| **C — Klassisches Webhosting** | ✅ PHP + MySQL | ~3-5 €/Mon | 30-60 min | Production, Multi-User, IHK-konform |

---

## 🅰️ Option A — Netlify (kostenlos, schnellster Start)

**Was du bekommst:** Frontend läuft komplett im Browser, Daten landen im localStorage des Browsers. Kein Backend, keine User-Verwaltung, keine Sync zwischen Geräten — aber die App ist online unter einer schönen URL wie `azubiboard-xyz.netlify.app`.

### One-Click-Setup

1. Bei [netlify.com](https://app.netlify.com/signup) registrieren (GitHub-Login).
2. **"Add new site"** → **"Import an existing project"** → GitHub auswählen → `AzubiBoard`-Repo wählen.
3. **Build-Settings** werden aus `netlify.toml` automatisch übernommen:
   ```
   Build command:    npm ci && npm run build
   Publish dir:      dist
   Base directory:   .
   ```
4. **"Deploy"** klicken. Nach ~2 min ist die App live.

### Mit manuellem Workflow-Trigger

Wenn du Deploys aus GitHub-Actions heraus triggern willst (z.B. um eine `VITE_API_BASE_URL` mitzugeben):

1. In Netlify: **User Settings → Applications → Personal Access Tokens** → neuen Token erzeugen.
2. In Netlify: **Site Settings → Site Information** → `API ID` (= `NETLIFY_SITE_ID`) kopieren.
3. In GitHub: **Repo → Settings → Secrets and Variables → Actions** → folgende Secrets anlegen:
   - `NETLIFY_AUTH_TOKEN` ← Personal Access Token
   - `NETLIFY_SITE_ID` ← API ID
   - `VITE_SENTRY_DSN` (optional) ← deine Sentry-DSN
4. In GitHub: **Actions** → **"Deploy → Netlify"** → **"Run workflow"** → Inputs wählen → Run.

### Custom-Domain einrichten

In Netlify: **Site Settings → Domain Management → Add custom domain** → deine Domain eintragen → DNS-Anweisungen folgen (CNAME oder A-Record). Netlify managed automatisch HTTPS via Let's Encrypt.

---

## 🅱️ Option B — Cloudflare Pages (kostenlos, schnellstes CDN)

Genauso wie Option A, aber bei Cloudflare. Vorteile: **schnelleres globales CDN**, **bessere Analytics**, **unlimited bandwidth** auf Free-Tier.

1. Bei [pages.cloudflare.com](https://pages.cloudflare.com) registrieren.
2. **"Create a project"** → **"Connect to Git"** → GitHub-Repo wählen.
3. **Build-Settings manuell** (Cloudflare liest `netlify.toml` nicht):
   ```
   Framework preset:    None
   Build command:       npm ci && npm run build
   Build output:        dist
   Root directory:      /
   ```
4. **Environment Variables:**
   ```
   NODE_VERSION    = 20
   VITE_BASE_PATH  = /
   VITE_USE_API    = false
   VITE_SENTRY_DSN = (optional)
   ```
5. **"Save and Deploy"**.

Cloudflare übernimmt die `_headers`/`_redirects`-Konventionen — die CSP-Header aus `netlify.toml` werden hier **nicht** automatisch angewendet. Bei Bedarf eine `public/_headers`-Datei anlegen mit dem CSP-Block aus `netlify.toml`.

---

## 🅲 Option C — Klassisches Webhosting (PHP + MySQL)

Empfohlene Hoster (alle mit PHP 8.2+ und MariaDB/MySQL):

| Hoster | Preis/Mon | Kommentar |
|---|---|---|
| **Hostinger Premium** | ~2.99 €  | Sehr günstig, gutes Panel, deutscher Server möglich |
| **all-inkl PrivatPlus** | ~4.95 € | DE-Server, schneller Support, eigene Domain inklusive |
| **IONOS Hosting M** | ~5 €     | DE-Konzern, sehr stabil |
| **Strato BasicWeb** | ~4 €     | DE-Konzern, einfacher Einstieg |

### Setup-Schritte

1. **Hosting + Domain buchen.** SSL-Zertifikat (Let's Encrypt) sollte inklusive sein — falls nicht, im Panel aktivieren.

2. **Datenbank anlegen.** Im Hoster-Panel (meist Plesk oder cPanel): MySQL → "Neue Datenbank" → User + Passwort + Datenbank-Name. **Werte merken**.

3. **Schema importieren.** In phpMyAdmin (vom Hoster bereitgestellt):
   - Datenbank auswählen
   - **Importieren** → `database/azubiboard.sql` (32 KB) hochladen
   - Importieren-Button → fertig.

4. **GitHub-Secrets eintragen.** Repo → **Settings → Secrets and Variables → Actions** → folgende Secrets anlegen:

   | Secret | Wert | Beispiel |
   |---|---|---|
   | `SFTP_HOST` | SFTP-Host vom Hoster | `ftp.example.com` |
   | `SFTP_PORT` | meist 22 | `22` |
   | `SFTP_USERNAME` | SFTP-User | `u123456789` |
   | `SFTP_PASSWORD` | SFTP-Passwort | (vom Hoster) |
   | `SFTP_REMOTE_DIR` | Web-Root | `/public_html/` oder `/htdocs/` |
   | `VITE_BASE_PATH` | URL-Pfad | `/` (eigene Domain) oder `/azubiboard/` (Subdir) |
   | `DB_HOST` | DB-Host | meist `localhost` |
   | `DB_NAME` | DB-Name | `u123456789_azubi` |
   | `DB_USER` | DB-User | `u123456789_azubi` |
   | `DB_PASS` | DB-Passwort | (selbst gewählt) |
   | `JWT_SECRET` | 64 hex-Zeichen | `openssl rand -hex 32` in Terminal |
   | `ALLOWED_ORIGIN` | exakte URL | `https://azubiboard.deinedomain.de` |
   | `VITE_SENTRY_DSN` | optional | von sentry.io |

5. **Deploy auslösen.** GitHub → **Actions** → **"Deploy → Klassisches Webhosting (SFTP)"** → **"Run workflow"** → Confirm-Feld: `DEPLOY` eintippen → **Run**.

6. **Erstes Login.** Browse zu `https://deinedomain.de` → Register-Tab → ersten Account anlegen. Dieser bekommt automatisch die Rolle "azubi". Um ihn zum Ausbilder zu machen:
   ```sql
   UPDATE users SET role='ausbilder' WHERE email='deine@email.de';
   ```

### Wichtige Hoster-Settings (falls Probleme)

- **PHP-Version:** mindestens 8.0, ideal 8.2+. In den meisten Panels umstellbar.
- **PHP-Module:** `pdo_mysql`, `mbstring`, `fileinfo`, `openssl` müssen aktiv sein (sind meist Default).
- **upload_max_filesize / post_max_size:** mind. `10M` für Avatar-Uploads.
- **`.htaccess`-Override** muss erlaubt sein (mod_rewrite, mod_headers).

---

## 🔄 Continuous Deployment

| Trigger | Was passiert |
|---|---|
| `git push` auf `main` | Netlify deployed automatisch (siehe `deploy-netlify.yml`) |
| Manueller Click in GitHub-Actions | Beide Workflows haben `workflow_dispatch` für manuellen Trigger |
| SFTP-Deploy | **Nur** manuell — schützt vor versehentlichem Production-Push |

---

## 🩺 Health-Check nach Deploy

1. **Frontend:** Lade die URL — siehst du den Login-Screen?
2. **PWA:** F12 → Application → Manifest → keine Errors?
3. **Service Worker:** F12 → Application → Service Workers → registriert?
4. **CSP:** F12 → Console → keine `Refused to …`-Errors?
5. **API (nur Option C):** Browse zu `https://deinedomain.de/api/data/version` mit Auth-Header — sollte 401 zurückgeben (kein Token), das ist OK.
6. **DB-Connect (nur Option C):** Login versuchen — wenn `Datenbankfehler 500` kommt, sind die DB-Credentials in `.env` falsch.

---

## 🆘 Häufige Probleme

| Symptom | Ursache | Fix |
|---|---|---|
| **404 bei jeder Sub-Route** | SPA-Routing kaputt | `netlify.toml` redirect prüfen ODER `.htaccess` RewriteRule prüfen |
| **`Refused to connect …` in Console** | CSP zu strikt | `connect-src` in `netlify.toml`/`.htaccess` erweitern |
| **Service Worker lädt veraltete Daten** | `sw.js` wird gecacht | Cache-Header für `sw.js` MUSS `no-cache` sein |
| **CORS-Error bei API-Call** | `ALLOWED_ORIGIN` ≠ Frontend-Domain | exakte Domain in `.env` setzen, neu deployen |
| **`Datenbankfehler` (500)** | DB-Credentials falsch | `.env` prüfen, DB-User Berechtigungen testen |
| **2FA-QR-Code wird nicht generiert** | `qrcode` lazy-Chunk 404 | rebuild + redeploy |
| **`JWT_SECRET nicht gesetzt`** | `.env` fehlt oder Wert leer | Workflow-Secret `JWT_SECRET` setzen, redeploy |
| **`uploads/`-Ordner nicht beschreibbar** | Falsche Permissions | Hoster-Panel → chmod 750 für uploads/ |

---

## 🎓 Wichtig zu wissen

- **Sentry-DSN setzen** (in Netlify oder als GitHub-Secret) ist optional aber **dringend empfohlen** für Production — sonst siehst du keine Crashes von echten Usern.
- **2FA für Ausbilder-Accounts aktivieren** sobald die App live ist (Profil → Sicherheit → 2FA).
- **Backups prüfen**: Nach dem ersten produktiven Save automatisch ein Daily-Snapshot in `app_data_history`. Im Profil → "💾 Server-Backups" anschauen.
- **GitHub-Repo private machen** falls du sensible `.env`-Werte direkt eingeloggt hast (eigentlich nicht — nur Secrets).
