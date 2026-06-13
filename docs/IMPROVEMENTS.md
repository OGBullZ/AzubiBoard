# AzubiBoard — Verbesserungs-Backlog

> Stand: 13. Juni 2026 · lebende Liste. Erledigtes wird abgehakt (✅).
> Legende: **[hier]** = ohne Server baubar · **[Server]** = braucht Ubuntu-Tier-1 (Richtung A).
> Strategie steht in `ROADMAP-v2.md` (Richtung A: echtes Multi-User, Server kommt auf Signal).

## A · Korrektheit & Robustheit
Die wiederkehrende Bug-Klasse — bisher fand jede Hunt-Runde 12–14 echte Bugs, allein heute 7 latente.

- [ ] **Bug-Hunt 4** — adversarische 4. Fehleranalyse · [hier]
- [ ] **ID-Mismatch-Tiefensweep** — alle aliased `currentUser.id`-Vergleiche (nicht nur `me`), stored-ids gegen Login-ids · [hier]
- [ ] **Boot-Smoke vertiefen** — Interaktionen (Editor/Druck/AI/Modals), nicht nur Routen-Load · [hier]
- [ ] **Property-Tests Datum** — DST-Stabilität als Invariante · [hier]
- [ ] **PHPUnit-Suite-Overlap** beheben (phpunit.xml `all` vs `routes`) · [hier]

## B · Kernzweck: Berichtsheft & IHK
- [ ] **M5a IHK-Recherche-Spike** — BLok / Online-Berichtsheft / Import-Formate: Anbindung oder Export? · [hier]
- [ ] **Tages-Struktur Mo–Fr + Stunden** — strukturierte Tageseinträge statt Freitext · [hier]
- [ ] **Berichtsheft-Editor-UX** — KW prominent, Pflichtfeld-Hinweise, Vorschau · [hier]
- [ ] **company/department ins Onboarding** (bisher nur Profil) · [hier]
- [x] IHK-Export: Ausbildungsbetrieb/Abteilung/laufende Nachweis-Nr (`d4a154a`)

## C · KI-Features
⚠️ Alles server-seitig → aktiv erst mit Server-Tier.
- [ ] **AI3 KI-Prüfungsvorbereitung** — Quiz/Karten aus Thema · bauen [hier], aktiv [Server]
- [ ] **AI-Lernpfad-Generator** aus Berufsbild · [hier]/[Server]
- [x] AI4 KI-Feedback auf Berichte (`717ef64`)

## D · Ausbilder-Werkzeuge
- [ ] **Azubi-Detail Drill-down** — welche KW genau fehlen · [hier]
- [ ] **Prüfungs-Readiness-Score** pro Azubi · [hier]
- [ ] **Lernziel-Quote** pro Azubi im Cockpit · [hier]
- [x] Berichtsheft-Vollständigkeit pro Azubi im Cockpit (`c63e8bd`)

## E · Architektur & Wartbarkeit
- [ ] **App.tsx weiter entflechten** (1612 Z.) — GlobalSearch/ShortcutsHelp/Sidebar/Root-Handler → Module/Hooks · [hier]
- [ ] **Dual-Mode-Schuld** — wird durch Richtung A an der Wurzel aufgelöst · [Server]
- [ ] **Blob↔Schema-`any` tightening** nach Schema-Read-Verifikation · [Server]
- [x] Notification-UI extrahiert (`8a24a09`) · sameId/isoWeekMonday zentralisiert · firstName zentralisiert

## F · UX & Politur
- [ ] **Design-Graduierung** — v1 deprecaten (zwei Designs = Wartungslast) · [hier]
- [ ] **a11y-Audit Pass 3** · [hier]

## G · Performance
- [ ] **Bundle bei 169.76/170 gz** — Chunk-Audit, Luft schaffen · [hier]

## H · Betrieb & Server (Richtung A — auf Signal)
- [ ] **Server-Tier** Migration/RLS/Dual-Write/Schema-Reads/AI/N1 live (`docs/Server-Tier-Checkliste.md`) · [Server]
- [ ] **SEC1** Fail2ban + UFW · **Backup/Restore live-verify** · [Server]
