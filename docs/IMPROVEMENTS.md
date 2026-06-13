# AzubiBoard — Verbesserungs-Backlog

> Stand: 13. Juni 2026 · lebende Liste. Erledigtes wird abgehakt (✅).
> Legende: **[hier]** = ohne Server baubar · **[Server]** = braucht Ubuntu-Tier-1 (Richtung A).
> Strategie steht in `ROADMAP-v2.md` (Richtung A: echtes Multi-User, Server kommt auf Signal).

## A · Korrektheit & Robustheit
Die wiederkehrende Bug-Klasse — bisher fand jede Hunt-Runde 12–14 echte Bugs, allein heute 7 latente.

- [x] **Bug-Hunt 4** (`c86ae29`) — 3 UTC-Off-by-one (WeekProgress/CalWidget/MonthReportModal) gefixt
- [x] **ID-Mismatch-Tiefensweep** — keine offenen aliased Vergleiche mehr (welcomeNewsData `me` in `c54c501`, useNotifications/Dashboard in `d490c9c`)
- [ ] **Boot-Smoke vertiefen** — Interaktionen (Editor/Druck/AI/Modals/Ctrl+K), nicht nur Routen-Load · [hier]
- [ ] **Property-Tests Datum** — DST-Stabilität als Invariante · [hier]
- [ ] **PHPUnit-Suite-Overlap** beheben (phpunit.xml `all` vs `routes`) · [hier]

## B · Kernzweck: Berichtsheft & IHK
- [ ] **M5a IHK-Recherche-Spike** — BLok / Online-Berichtsheft / Import-Formate: Anbindung oder Export? · [hier]
- [x] **Tages-Struktur Mo–Fr + Stunden** (`b0cd2c3`) — optionale Tageseinträge + IHK-Tages-Tabelle im Druck
- [ ] **Berichtsheft-Editor-UX** — KW prominent, Pflichtfeld-Hinweise, Vorschau · [hier]
- [ ] **company/department ins Onboarding** (bisher nur Profil) · [hier]
- [x] IHK-Export: Ausbildungsbetrieb/Abteilung/laufende Nachweis-Nr (`d4a154a`)

## C · KI-Features
⚠️ Alles server-seitig → aktiv erst mit Server-Tier.
- [x] **AI3 KI-Prüfungsvorbereitung** (`93fdce2`) — Quiz aus Thema generieren (Ausbilder, server-seitig)
- [ ] **AI-Lernpfad-Generator** aus Berufsbild · [hier]/[Server]
- [x] AI4 KI-Feedback auf Berichte (`717ef64`)

## D · Ausbilder-Werkzeuge
- [x] **Azubi-Detail Drill-down** (`be0b466`) — fehlende Berichtswochen (KW-Chips) + Heft-Quote
- [x] **Prüfungs-Readiness-Score** (`6d34f88`) — Composite (Heft 40/Lernziele 35/Aufgaben 25) auf Azubi-Detailseite
- [ ] **Lernziel-Quote** pro Azubi im Cockpit (Detail zeigt Kompetenz-Ring bereits) · [hier]
- [x] Berichtsheft-Vollständigkeit pro Azubi im Cockpit (`c63e8bd`)

## E · Architektur & Wartbarkeit
- [~] **App.tsx weiter entflechten** (1757→1273 Z.) — NotificationBell + GlobalSearch/ShortcutsHelp + Sidebar raus (`8a24a09`,`71ec792`,`00e7ea2`); offen: Root-Handler → Hooks, Page-Wrapper · [hier]
- [ ] **Dual-Mode-Schuld** — wird durch Richtung A an der Wurzel aufgelöst · [Server]
- [ ] **Blob↔Schema-`any` tightening** nach Schema-Read-Verifikation · [Server]
- [x] Notification-UI extrahiert (`8a24a09`) · sameId/isoWeekMonday zentralisiert · firstName zentralisiert

## F · UX & Politur
- [ ] **Design-Graduierung** — v1 deprecaten (zwei Designs = Wartungslast) · [hier]
- [ ] **a11y-Audit Pass 3** · [hier]

## G · Performance
- [x] **Bundle-Headroom** (`68006f8`) — Dashboard+ProjectPool lazy → Haupt-Chunk 169.83 → **154.53 KB gz** (~9 % Luft)

## H · Betrieb & Server (Richtung A — auf Signal)
- [ ] **Server-Tier** Migration/RLS/Dual-Write/Schema-Reads/AI/N1 live (`docs/Server-Tier-Checkliste.md`) · [Server]
- [ ] **SEC1** Fail2ban + UFW · **Backup/Restore live-verify** · [Server]
