# AzubiBoard — Roadmap

> Stand: 8. Juni 2026 · `main = 9d4a000` · Schema v5
> Sprint-Historie (Details) → `HANDOVER.md` · Restliste bis v1.0 → `ZIELE-v1.md`
> Aktive Design-Spec → `WELCOME-FENSTER-DESIGN.md` · abgeschlossene UX-Arbeit → `UX-ROADMAP.md`

**Lage in einem Satz:** Code-seitig ist v1.0 nahezu fertig; die UX-/Design-Roadmap ist abgearbeitet, der aktuelle Arbeitsstrang ist das **Willkommens-/News-Fenster**, und die letzten v1.0-Lücken sind überwiegend **Live-Verifikation am Ubuntu-Server** (kein Dev-Env dafür).

---

## 🎯 Aktiv jetzt — Willkommens-/News-Fenster beim Login

> Design-Spec: `WELCOME-FENSTER-DESIGN.md` (Multi-Agent Design-Workflow). Umsetzung **branch-only bis Freigabe** (harte Regel: keine UI live ohne User-OK).

| Phase | Inhalt | Status |
|---|---|---|
| **0** | `useNotifications`-Hook aus App.tsx extrahieren (geteilte Aggregation, Fundament gg. Drift) | ✅ Branch `welcome-news` (`efcb183`) |
| **1** | News-Fenster MVP: Login-Marker (1×/Tag, nicht bei Reload), `WelcomeNews.tsx` + `NewsCard.tsx`, Rollen-Switch Azubi/Staff, „Alles gut"-Leerzustand | ✅ Branch `welcome-news` (`efcb183`) |
| **2** | Neue Item-Typen: Berichtsheft-offen, Lernziele learned/confirmed (Delta), Prüfungs-Countdown, kritische Azubis, Azubis-ohne-Bericht, Projekte-rot, Gruppen-Deadlines | ⏳ offen |
| **3** | Onboarding-Ausbau rollenspezifisch (Profil/Gruppe/Setup-Schritte + News-Vorschau im Wizard) | ⏳ offen · ⚠️ Blocker Q4 (Azubi-Self-Join + Ausbilder-„Azubi anlegen" existiert?) |

**Cadence = 1×/Tag, Leerzustand zeigen** (User-Entscheid 08.06). Offene Spec-Fragen: Q3 Delta-Persistenz, Q5 manuelles Wiederöffnen.
**Nächster Schritt:** Phase 0+1 im Browser reviewen (`git checkout welcome-news && npm run dev`) → Freigabe → Merge+Push → Phase 2.

---

## ✅ Abgeschlossen

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
| **4** | Housekeeping: ~30 silent-catches durchgehen · `nwtgck/actions-netlify@v3` vor **16.06** Node-24-fähig bumpen · S12-Akzeptanzkriterien final abhaken nach Tier 1 | [hier] |

**Engpass:** Tier 1 + SEC1 brauchen den echten Ubuntu-Server (`10.14.99.10`). Vom Dev-PC bewegbar: Welcome-News, N1, Housekeeping.

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
