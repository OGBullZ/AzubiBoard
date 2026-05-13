# AzubiBoard – Roadmap

> Stand: Mai 2026 · Letzter Sprint: **8** (`8b07bbd`) + Hotfixes

---

## ✅ Abgeschlossen

| Sprint | Commit | Inhalt |
|---|---|---|
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

## 🔜 Sprint 9 — Server-Deployment & Infrastruktur
> **Aufwand:** 1-2 Tage · **Ziel:** Produktionsbetrieb auf physischem LAMP-Server

| | Item | Details |
|---|---|---|
| **OPS2** | Auto-Deploy via Cron-Job | `git fetch` + Change-Detection + `npm build` + `rsync` alle 5 min |
| **OPS3** | Deploy-Key auf Server einrichten | Read-only SSH-Key für GitHub-Repo auf dem Server |
| **OPS4** | `.env` Produktions-Config | JWT_SECRET, DB-Zugangsdaten, ALLOWED_ORIGIN für Live-Server |
| **OPS5** | Fail2ban + UFW Firewall | Brute-Force-Schutz, Ports absichern |
| **OPS6** | Deploy-Log Monitoring | `tail -f /var/log/azubiboard-deploy.log`, ggf. Mail bei Fehler |

---

## 🔜 Sprint 10 — Adoption & Kommunikation
> **Aufwand:** 2-3 Tage · **Ziel:** App nützlicher für den Betriebsalltag machen

| | Item | Details |
|---|---|---|
| **M3** | Wöchentliche Ausbilder-Mail | PHP-Cron + SMTP: „X Berichte zu prüfen, Y Aufgaben überfällig" |
| **M2** | Mentor-Rolle | 3. Rolle (lesen + kommentieren, keine Approval-Rechte) |
| **K2** | Field-Level Permissions | Azubi darf eigene Berichte nicht löschen nach Einreichung; Ausbilder-only Felder |
| **K4** | Upload-Härtung | MIME-Validierung per Magic-Bytes + ClamAV-Hook für Datei-Uploads |

---

## 🔜 Sprint 11 — Power-Features
> **Aufwand:** 4-5 Tage · **Ziel:** Differenzierung, Lernbereich ausbauen

| | Item | Details |
|---|---|---|
| **M1** | PDF-OCR Import | Tesseract.js clientseitig — handschriftliche Berichte → vorausgefülltes Formular |
| **C1** | Quiz-Editor | Ausbilder kann eigene Fragen erstellen (aktuell statisch in `src/data/quiz.json`) |
| **C3** | Spaced-Repetition | SM-2 Algorithmus für Karteikarten, Lernfortschritt pro Thema tracken |
| **C2** | Lernpfade | Strukturierte Reihenfolge von Lernzielen pro Lehrjahr/Quartal |

---

## 🔜 Sprint 12 — MySQL-Schema-Refactor (L5)
> **Aufwand:** 3-5 Tage · **Ziel:** Basis für Multi-Tenant und Volltextsuche

| | Item | Details |
|---|---|---|
| **L5** | JSON-Blob → relationale Tabellen | `projects`, `tasks`, `reports`, `goals` als eigene MySQL-Tabellen (Schema in `database/azubiboard.sql`) |
| | Migrations-Script | Bestehenden Blob-Inhalt in neue Tabellen überführen |
| | Feature-Flag | `VITE_USE_SCHEMA=true` für schrittweise Migration ohne Downtime |
| | Row-Level Security | Ausbilder sieht nur Azubis seiner Gruppe |

---

## 🔮 Sprint 13+ — Skalierung & Vision

| | Item | Aufwand |
|---|---|---|
| **M4** | Multi-Tenant | Eigene Firmen/Schulen mit isolierten Daten — nur nach L5 sinnvoll | L |
| **M5** | IHK-Direktanbindung | Sofern öffentliche API verfügbar | XL |
| **P1** | HTTPS / Let's Encrypt | Wenn Server öffentlich → `certbot --apache` | S |
| **P2** | Öffentlicher Zugriff | VPN oder SSH-Härtung (Port-Änderung, Fail2ban) für Remote-Arbeit | M |
| **I1** | i18n Vollmigration | ~300 verbleibende Strings auf DE/EN-Keys umstellen | M |
| **T1** | TypeScript Migration | Schrittweise `.jsx` → `.tsx`, Zod-Schemas | XL |

---

## 🐞 Offene Bugs / Kleinigkeiten

| Priorität | Item |
|---|---|
| Medium | i18n-Scaffold unvollständig (~50 von ~350 Strings übersetzt) |
| Low | Lighthouse-Schwellen (non-blocking in CI) |
| Low | `ROADMAP.md` in `HANDOVER.md` referenzieren (Duplikat bereinigen) |

---

## Aufwands-Legende

| Symbol | Bedeutung |
|---|---|
| S | < 2 Stunden |
| M | halber Tag |
| L | 1-2 Tage |
| XL | 3-5 Tage |
