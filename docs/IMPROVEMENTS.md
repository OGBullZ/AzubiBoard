# AzubiBoard — Verbesserungs-Backlog

> Stand: 13. Juni 2026 · lebende Liste. Erledigtes wird abgehakt (✅).
> Legende: **[hier]** = ohne Server baubar · **[Server]** = braucht Ubuntu-Tier-1 (Richtung A).
> Strategie steht in `ROADMAP-v2.md` (Richtung A: echtes Multi-User, Server kommt auf Signal).

## ⭐ Optimierungsplan (15. Juni 2026) — Reihenfolge nach ROI/Risiko, alles [hier]

1. **P1 Korrektheit** (höchster ROI, belegt) — **Bug-Hunt 5** (→ Abschnitt A, AKTIV) + Property-Tests Datum.
2. **P2 UX & Politur** — Design-Graduierung (v1 deprecaten, braucht User-Go) · Berichtsheft-Editor-UX · company/department ins Onboarding · a11y Pass 3.
3. **P3 Architektur** — App.tsx Root-Handler → Hooks + Page-Wrapper · PHPUnit-Suite-Overlap.
4. **P4 Performance** (geringe Marge, Chunk 154 KB) — Lighthouse-Schwellen als Gate (→ Abschnitt G).
> [Server]-Items (any-Tightening, Dual-Mode, Server-Tier) bewusst zurückgestellt bis Server-Signal.

## A · Korrektheit & Robustheit
Die wiederkehrende Bug-Klasse — bisher fand jede Hunt-Runde 12–14 echte Bugs, allein heute 7 latente.

- [x] **Bug-Hunt 5** (P1, 15.06., `534df65`/`501604f`/`dbf6d67`/`21f2810`) — 7 verifizierte Funde gefixt: ID-Typ-Vergleiche→sameId (heroSuggestion/useNotifications/AzubiProfile), Stale-data-Race in 13 App.tsx-Handlern→funktionale setData, Print-XSS MonthReportModal, PHP ai-rate-limit/goals-RLS/reports-cross-group. Vitest 110, PHPUnit 133, Boot-Smoke 5/5.
- [x] **Bug-Hunt 4** (`c86ae29`) — 3 UTC-Off-by-one (WeekProgress/CalWidget/MonthReportModal) gefixt
- [x] **ID-Mismatch-Tiefensweep** — keine offenen aliased Vergleiche mehr (welcomeNewsData `me` in `c54c501`, useNotifications/Dashboard in `d490c9c`)
- [x] **Boot-Smoke vertiefen** (`c38132b`) — Interaktions-Test für CommandDialogs (Ctrl+K-Suche + ?-Shortcuts). Editor-Open zurückgestellt (Preview-Overlay-Flakiness).
- [x] **Property-Tests Datum** (P1, 15.06.) — `tests/date-properties.test.js` (fast-check): DST-Stabilität als Invariante in Europe/Berlin. dayDiffLocal = Kalendertag-Delta unabhängig von Uhrzeit/Zeitumstellung; alle 7 Tage einer ISO-Woche = selbe KW; fmtLocalDate-Round-Trip; +explizite DST-Grenztage 2026 + Fail-Loud-TZ-Guard.
- [ ] **PHPUnit-Suite-Overlap** beheben (phpunit.xml `all` vs `routes`) · [hier]

## B · Kernzweck: Berichtsheft & IHK
- [x] **M5a IHK-Recherche-Spike** (`docs/IHK-Spike.md`) — **Ergebnis: Export, keine API.** Einreichung = signierte Gesamt-PDF ins IHK-Prüfungsportal; offizielles IHK-Digital-Berichtsheft wird 31.12.2026 abgeschaltet → Drittanbieter (AzubiBoard passt). M5c (Direkt-API) entfällt.
- [x] **M5: Kompletter Ausbildungsnachweis als eine PDF** (`6f60503`) — Deckblatt + alle KW chronologisch (lfd. Nr., Tages-Tabelle, Unterschriftszeile/Woche). Azubi-Button „📑 Kompletter Nachweis".
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
- [ ] **Lighthouse-Schwellen als CI-Gate** (P4, Q2) — feste Mindestwerte + ggf. Route-Prefetch für lazy Chunks · [hier]

## H · Betrieb & Server (Richtung A — auf Signal)
- [ ] **Server-Tier** Migration/RLS/Dual-Write/Schema-Reads/AI/N1 live (`docs/Server-Tier-Checkliste.md`) · [Server]
- [ ] **SEC1** Fail2ban + UFW · **Backup/Restore live-verify** · [Server]
