# Backup-Sanity-Check (Sprint 12 Phase 0 — P0-7)

**Zweck:** Vor jeder Migration (insbesondere `database/migrate_blob_to_relational.php`) muss verifiziert sein, dass der Backup-Pfad funktioniert UND der Restore in eine Sandbox-DB klappt. Ohne diesen Check ist die Migration unsicher.

**Wann durchführen:**
- Einmalig vor dem ersten Phase-1-Migrations-Run auf einem Server
- Vor jeder Schema-Erweiterung in Phase 2 (Dual-Write)
- Nach jeder Änderung an `install_ubuntu.sh` Schritt 7 (Backup-Cron-Setup)

---

## Schritt 1 — Backup auf Linux-Server (production)

`install_ubuntu.sh` Schritt 7 legt das Skript `/usr/local/bin/azubiboard-backup.sh` an. Ein manueller Lauf:

```bash
sudo /usr/local/bin/azubiboard-backup.sh
ls -lh /var/backups/azubiboard/azubiboard_$(date +%Y-%m-%d).sql.gz
```

**Erwartung:** Datei existiert, Größe > 1 KB, gzip-Header.

## Schritt 2 — Backup-Inhalt validieren

```bash
gunzip -c /var/backups/azubiboard/azubiboard_$(date +%Y-%m-%d).sql.gz | head -50
gunzip -c /var/backups/azubiboard/azubiboard_$(date +%Y-%m-%d).sql.gz | grep -c "INSERT INTO"
```

**Erwartung:** Header zeigt `-- MariaDB dump`, INSERT-Count > 0.

## Schritt 3 — Restore in Sandbox-DB

```bash
sudo mysql -e "CREATE DATABASE azubiboard_sandbox CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
gunzip -c /var/backups/azubiboard/azubiboard_$(date +%Y-%m-%d).sql.gz | sudo mysql azubiboard_sandbox
sudo mysql azubiboard_sandbox -e "SHOW TABLES; SELECT COUNT(*) AS users FROM users; SELECT COUNT(*) AS projects FROM projects;"
```

**Erwartung:** Alle 25 Tabellen sind da, Counts > 0 (wenn Produktion bereits Daten hat).

## Schritt 4 — Sandbox aufräumen

```bash
sudo mysql -e "DROP DATABASE azubiboard_sandbox;"
```

---

## Lokaler Check (Windows / XAMPP)

Da `install_server.ps1` keinen automatischen Backup-Cron aufsetzt, lokal manuell:

```powershell
# Backup
& "E:\xampp\mysql\bin\mysqldump.exe" -u root azubiboard > "E:\Users\torbe\Desktop\azubiboard_backup_$(Get-Date -Format yyyy-MM-dd).sql"

# Restore in Sandbox
& "E:\xampp\mysql\bin\mysql.exe" -u root -e "CREATE DATABASE azubiboard_sandbox CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
Get-Content "E:\Users\torbe\Desktop\azubiboard_backup_$(Get-Date -Format yyyy-MM-dd).sql" | & "E:\xampp\mysql\bin\mysql.exe" -u root azubiboard_sandbox
& "E:\xampp\mysql\bin\mysql.exe" -u root azubiboard_sandbox -e "SHOW TABLES;"

# Cleanup
& "E:\xampp\mysql\bin\mysql.exe" -u root -e "DROP DATABASE azubiboard_sandbox;"
```

---

## Akzeptanzkriterien P0-7

- [ ] `azubiboard-backup.sh` läuft fehlerfrei (Exit-Code 0)
- [ ] Backup-Datei existiert, > 1 KB, gzip-valid
- [ ] Restore in Sandbox-DB legt alle 25 Tabellen an
- [ ] `migrate_blob_to_relational.php --dry-run` läuft gegen Sandbox ohne Fehler
- [ ] Sandbox-DB nach Test gelöscht

**Status 2026-05-20:** Doku-only. Echter Lauf erst auf Linux-Server oder XAMPP-Setup mit echten Daten. P0-7 gilt als "blocked, dokumentiert" — keine Live-Verifikation möglich ohne Test-DB-Inhalt.

---

## Was als nächstes (Phase 2)

Vor dem Start von Phase 2 (Dual-Write) MUSS dieser Check tatsächlich gelaufen sein — nicht nur dokumentiert. Im Phase-2-Sprint-Plan als **Pre-Flight** eintragen.
