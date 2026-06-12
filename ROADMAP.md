# AzubiBoard — Roadmap

> Stand: 12. Juni 2026 · `main = bd39d17` · Schema v5
> Sprint-Historie (Details) → `HANDOVER.md` · Restliste bis v1.0 → `ZIELE-v1.md`
> Design-Spec → `DESIGN-VISION.md` / `WELCOME-FENSTER-DESIGN.md` · abgeschlossene UX-Arbeit → `UX-ROADMAP.md`

**Lage in einem Satz:** Code-seitig ist v1.0 fertig; UX-/Design-Roadmap, Welcome-/News-Fenster, „Digitale Werkbank"-Design (D1–D6 + Animationen + Erst-Login, Beta = Version 1.1 = Default) und ein voller Bug-Hunt sind live — die **einzige verbleibende v1.0-Lücke ist die Live-Verifikation am Ubuntu-Server** (kein Dev-Env dafür).

---

## 🎯 Aktiv jetzt — Server-Tier (einzige offene v1.0-Arbeit)

Alle Code-/UI-Stränge sind durch und live. Was bleibt, ist die Live-Verifikation gegen ein echtes Ubuntu-Deployment (`10.14.99.10`):

1. Migration `migrate_blob_to_relational.php` — Count-Check vor/nach, Re-Run idempotent
2. Schema-Reads (`VITE_USE_SCHEMA=true`) — alle 6 Feature-Pfade aus relationalen Routes
3. RLS live — 2 Ausbilder, Gruppen-Isolation greift
4. Dual-Write live (`BACKEND_DUAL_WRITE=true`) — relationale Tabellen + `audit_log` gefüllt
5. Nur unit-getestete PHP-Fixes live gegenprüfen (Server-Gruppen-Guard, Mentor-Server-Guard, Bug-Hunt-PHP-Routes)
6. N1 — eine echte Digest-Mail über den MTA · SEC1 — Fail2ban + UFW

**In einer Sitzung machbar, sobald das Deployment steht.**

---

## ✅ Abgeschlossen

### „Digitale Werkbank"-Design (`DESIGN-VISION.md`) — abgeschlossen 11.06
9-Ebenen-Design-System, beta-gated. D1–D6 + Animations-Drehbuch (Anhang C) + Erst-Login-Erlebnis („Werkbank einrichten" + Live-Werksausweis). **Beta zu Version 1.1 graduiert + Default**; 1.0 bleibt wählbar. Akzentfarbe/Theme/Werkstatt-Sound im Profil einstellbar.

### Willkommens-/News-Fenster (`WELCOME-FENSTER-DESIGN.md`) — abgeschlossen 11.06
Phase 0–3 live: News-Fenster 1×/Tag beim Login, rollenspezifische Aggregation (Berichtsheft/Lernziele/Prüfungs-Countdown/kritische Azubis), rollenspezifischer Onboarding-Wizard, Gruppen-Beitritt per Anfrage.

### Bug-Hunts — laufend, zuletzt 12.06
Adversarische Analysen: Bug-Hunt 1 (14 Funde), 2 (12), 3 (13 + Datum-Off-by-one-Follow-up) — alle gefixt + live. Vitest 99, PHPUnit 197.

### UX-/Design-Roadmap (`UX-ROADMAP.md`) — abgeschlossen 07.06
Multi-Agent-Review → 5 Phasen. **Phase 0 (Quick-Wins/Bugs), 1 (Theming eine Quelle), 2 (Rollen-IA), 4 (Interaktions-Primitive) live auf `main`.** Phase 3 (Mobile/Touch) **out-of-scope** — App nur PC/Laptop.

### Sprints (Details → `HANDOVER.md`)

| Sprint | Commit | Highlights |
|---|---|---|
| **14** | div. | AI1 (KI-Bericht), AI2 (KI-Lernziele), UX1 (Onboarding-Wizard); **TS-Migration src/ 100% .ts/.tsx strict-clean, 0 @ts-nocheck**; Schema-Schärfung; typecheck+lint als CI-Gates |
| **13** | div. | L5-7 FULLTEXT-Suche (`search.php`), i18n 227 Keys, TS-Setup, Lighthouse-Gates, LINT-Cleanup |
| **12 (L5)** | bis `2b1c325` | MySQL-Schema-Refactor — Phase 0–4: PHPUnit-Setup, Read-Routes, Dual-Write, RLS, Audit, Schema-Read-Layer (`VITE_USE_SCHEMA`), 410-Deprecation. 96 PHPUnit-Tests |
| **11 / 11.5** | `8945b72` / `ded875a` | Lernpfade (DAG, Schema v5), SM-2 Karteikarten, Quiz-Editor, a11y Pass 2, PDF-OCR (lazy) |
| **8–10** | div. | 2FA TOTP+Recovery, Audit-Log, CSP-Härtung, Mentor-Rolle, Field-Level-Permissions, JWT-Blocklist |
| **1–7** | div. | Backend-Hardening, Rate-Limit, Backups, Migrations, Conflict-Detection, Papierkorb, CI, Web-Push |
| **OPS** | div. | HTTPS/Let's Encrypt + Auto-Deploy-Cron (`install_ubuntu.sh`), Pre-commit-Hook, Slash-Commands |

---

## 📋 Offen bis v1.0 (Details + Verify → `ZIELE-v1.md`)

| Tier | Item | Wo |
|---|---|---|
| **1** | Live-Verifikation: Schema-Reads / Migration / RLS / Dual-Write gegen echte MariaDB (4 Punkte, 1 Sitzung sobald Deployment steht) | **[Server]** |
| **2** | N1 — ✅ code-complete (`api/mailer.php` PHPMailer/SMTP + Fallback, `weekly_digest.php` nutzt es, Inhalt in `digest_lib.php` unit-getestet). Nur noch SMTP-Versand live gegen echten MTA verifizieren | [Server] |
| **3** | SEC1 — Fail2ban + UFW | **[Server]** |
| **4** | Housekeeping: silent-catches ✅ · Netlify-Action v4 ✅ (16.06-Frist entschärft) · S12-Akzeptanzkriterien final abhaken nach Tier 1 (offen) | [hier] |

**Engpass:** Alle Code-Stränge sind durch. Was bleibt (Tier 1–3 + N1-Live-Versand) braucht den echten Ubuntu-Server (`10.14.99.10`).

---

## 🔮 Vision — explizit NICHT „v1.0"

| ID | Item |
|---|---|
| **M4** | Multi-Tenant |
| **M5** | IHK-Direktanbindung (öffentliche API) |
| **SEC2** | RBAC-Granularität (Permissions per Feature) |
| **MOB1** | Offline-PWA / Mobile (App ist PC-only → kein Mobile-Scope) |

---

## 📏 Aufwands-Legende

| XS < 1 Std · S 1–3 Std · M ½–1 Tag · L 1–2 Tage · XL 3–5 Tage |
|---|
