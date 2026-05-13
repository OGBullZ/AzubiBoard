# Datenbank — Übersicht

| Datei | Zweck |
|---|---|
| **`azubiboard.sql`** | **Vollständiges Schema** (Export aus laufender MariaDB 10.4). Empfohlen für neue Installationen. Enthält alle Tabellen incl. FKs, Indizes, Constraints. Auch das Ziel-Schema für Sprint-9-Refactor (L5 — siehe HANDOVER.md). |
| `setup.sql` | Minimaler Bootstrap (User-Tabelle + Berechtigungen). Wird vom aktuellen Code (Sprint 1-8) **nicht aktiv** genutzt — App.jsx legt benötigte Tabellen via `CREATE TABLE IF NOT EXISTS` selbst an (`app_data`, `app_data_history`, `share_links`, `audit_log`). |
| `seed.php` | Test-Daten-Generator (Demo-Projekte, Demo-User). |
| `.htaccess` | Sperrt direkten Web-Zugriff (Dateien sind im Web-Root, sollen aber nicht auslieferbar sein). |

## Setup auf neuem Laptop

### Option A — Komplettes Schema (empfohlen)

```bash
# 1. Datenbank anlegen
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS azubiboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2. Schema importieren
mysql -u root -p azubiboard < database/azubiboard.sql

# 3. App-User mit minimalen Rechten anlegen (root NICHT in der App verwenden)
mysql -u root -p -e "
  CREATE USER IF NOT EXISTS 'azubiboard_user'@'localhost' IDENTIFIED BY 'DEIN_PASSWORT';
  GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP
    ON azubiboard.* TO 'azubiboard_user'@'localhost';
  FLUSH PRIVILEGES;
"
```

`.env` mit `DB_USER=azubiboard_user`, `DB_PASS=DEIN_PASSWORT` setzen.

### Option B — Lokaler Modus (kein DB nötig)

In `.env` einfach `VITE_USE_API=false` setzen. Die App speichert dann alles in localStorage —
ideal für reine Frontend-Entwicklung oder einen Demo-Test ohne Backend-Setup.

## Aktuelle Schreibvorgänge

Der aktuelle Backend-Code (Sprint 1-8) nutzt nur einen Bruchteil der Tabellen:

| Tabelle | Genutzt? | Wie? |
|---|---|---|
| `users` | ✅ | Auth + 2FA |
| `app_data` | ✅ | JSON-Blob (komplette App-Daten) |
| `app_data_history` | ✅ | Tägliche Snapshots (30 Tage) |
| `share_links` | ✅ | Public Read-Tokens |
| `audit_log` | ✅ | Server-Side Audit-Trail |
| `projects`, `tasks`, `reports`, … | ⏳ | Vorbereitet, aber aktuell via JSON-Blob abgebildet. Wartet auf L5-Refactor. |

`CREATE TABLE IF NOT EXISTS` in den jeweiligen PHP-Routes legt die *aktiv genutzten*
Tabellen beim ersten Aufruf an, falls sie noch nicht existieren.
