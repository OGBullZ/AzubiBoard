# Server-Tier — Live-Verifikations-Checkliste (v1.0-Abschluss)

> Ziel: alle [Server]-Punkte aus `ZIELE-v1.md` in **einer** Sitzung abhaken.
> Voraussetzung: Ubuntu-Server (z. B. `10.14.99.10`) mit SSH-Zugang.
> Stand: 12.06.2026 · install_ubuntu.sh importiert jetzt das volle relationale Schema.

## 0 — Installation (≈15 min)

```bash
git clone https://github.com/OGBullZ/AzubiBoard.git && cd AzubiBoard
chmod +x install_ubuntu.sh && sudo bash install_ubuntu.sh
```

Danach prüfen:
- [ ] App lädt: `http://<IP>/azubiboard/` (Login-Seite, keine Konsole-Fehler)
- [ ] Alle 3 Schema-Dateien „importiert: OK" (setup / azubiboard / sprint12_phase2)
- [ ] `mysql azubiboard -e "SHOW TABLES;"` → ~27 Tabellen inkl. `projects`, `reports`, `learning_paths`, `group_members`
- [ ] Account registrieren → Rolle setzen: `UPDATE users SET role='ausbilder' WHERE email='…';`
- [ ] Backup-Skript einmal manuell: `sudo /usr/local/bin/azubiboard-backup.sh` → .sql.gz in `/var/backups/azubiboard/` **und** `gunzip -t` ok (GRANT hat jetzt LOCK TABLES + --single-transaction)

## 1 — Migration Blob → relational (ZIELE #2)

Erst Testdaten anlegen (per UI: 2–3 Projekte mit Tasks, 2 Reports, 1 Quiz, 1 Lernpfad, Kalender-Events, Trainingsplan-Ziele). Dann:

```bash
cd /pfad/zum/repo
php database/migrate_blob_to_relational.php --dry-run   # Stats ansehen
php database/migrate_blob_to_relational.php             # echt
```

- [ ] Count-Check: Stats des Scripts == Zählung im Blob (projects/tasks/reports/requirements/quizzes/learning_paths/calendar_events)
- [ ] SQL-Gegenprobe: `SELECT COUNT(*) FROM projects;` etc.
- [ ] `group_id` der migrierten Projekte NICHT NULL (resolve_group_for_user) — sofern Ersteller in Gruppe
- [ ] **Re-Run idempotent:** Script nochmal → alle Stats 0 neu / nur skips, keine Duplikate
- [ ] Fix-Verify `46fc26a`: kein Halbzustand bei trainingPlan/learning_path_progress (Transaktionen)

## 2 — Schema-Read-Pfad (ZIELE #1)

`VITE_USE_SCHEMA` ist **Build-Zeit**-Flag → eigener Build:

```bash
VITE_BASE_PATH=/azubiboard/ VITE_USE_API=true VITE_USE_SCHEMA=true npm run build
sudo cp -r dist/. /var/www/html/azubiboard/
```

- [ ] Alle 6 Feature-Pfade laden korrekt (Overlay: projects+reports relational, Rest Blob): Projekte · Berichte · Kalender · Lernpfade · Quiz · Trainingsplan
- [ ] Browser-Konsole ohne Fehler; Fallback greift (kein Hard-Fail wenn eine Route leer)
- [ ] Danach normalen Build (ohne Flag) wieder deployen, wenn Test fertig

## 3 — RLS live (ZIELE #3)

Setup: 2 Ausbilder-Accounts, 2 Gruppen, je 1 Projekt pro Gruppe. **`group_members` muss befüllt sein** (Migration macht das; sonst manuell INSERTen).

- [ ] Ausbilder A sieht Projekte/Users von Gruppe B **nicht** (Liste + By-ID via `/api/projects/<fremdeID>` → 403)
- [ ] Ausbilder ohne Gruppen-Mitgliedschaft sieht alles (1=1-Klausel, kein Regress)
- [ ] Fix-Verify `92ac3e0` (#8): POST /api/projects mit fremder `group_id` → wird genullt. ⚠️ Merkposten: Guard hängt an `group_members` — bei leerer Tabelle wird group_id immer genullt (FE nutzt diesen POST-Pfad derzeit nicht)

## 4 — Dual-Write live (ZIELE #4)

```bash
sudo sed -i 's/BACKEND_DUAL_WRITE=false/BACKEND_DUAL_WRITE=true/' /var/www/html/azubiboard/.env
```

- [ ] In der App speichern (Projekt anlegen) → neue Rows in relationalen Tabellen
- [ ] `SELECT * FROM audit_log WHERE type='data.dual_write' ORDER BY id DESC LIMIT 3;` → Row mit Stats
- [ ] Zweiter identischer Save → keine neuen Rows (idempotent), keine neue audit-Row

## 5 — Nur-unit-getestete PHP-Fixes live gegenprüfen

| Fix | Test | Erwartung |
|---|---|---|
| Server-Gruppen-Guard (`c7058c8`) | Als Azubi Raw-POST /api/data mit sich selbst in `group.members` | 403 |
| Mentor-Server-Guard (`46fc26a`) | Als Mentor Raw-POST /api/data mit geändertem Projekt | 403 „nur Lesezugriff" |
| Restore-Routing (`0578b92` #1) | GET /api/data/backups + /backups/{day} + POST /restore | korrekte Antworten, kein Verschlucken |
| Pre-Restore-Snapshot (`46fc26a` #14) | Restore ausführen → heutiger history-Eintrag = Stand VOR Restore | 2. Restore = Undo |
| 2FA-Downgrade (`0578b92` #3) | /2fa/setup bei aktivem 2FA | 409/Block |
| Reports-RLS (`0578b92` #4) | Ausbilder A fragt Report von Azubi aus Gruppe B | nicht sichtbar |
| signed-Terminalität | Als Azubi signed-Report per POST ändern | 403 (Ausbilder DARF umstufen — Entscheid 12.06) |

## 6 — N1 SMTP-Live-Versand (ZIELE #5)

`.env`: SMTP_HOST/PORT/USER/PASS/SECURE/FROM einkommentieren + setzen. Dann:

```bash
php cron/weekly_digest.php
```

- [ ] Mail kommt an (Spam-Ordner prüfen) · [ ] mailer-Guard: User mit kaputter E-Mail (`a\r\nb@x.de`) wird übersprungen, kein Crash

## 7 — SEC1 (ZIELE #6) — macht install_ubuntu.sh schon mit

- [ ] `sudo ufw status` → 22/80/443 allow, Rest deny
- [ ] `sudo fail2ban-client status sshd` → aktiv
- [ ] 6× falsches SSH-Passwort → Ban greift (aus 2. Netz/Handy testen!)

## 8 — Abschluss

- [ ] Cron-Checks: Auto-Deploy-Log (`/var/log/azubiboard-deploy.log`) + Backup nach 03:00 vorhanden
- [ ] `ZIELE-v1.md`: Tier 1–3 abhaken, S12-Akzeptanzkriterien (#10) abhaken
- [ ] ROADMAP.md: v1.0 für **fertig** erklären 🎉
