# AzubiBoard — Verbesserungs-Backlog

> Stand: 1. Juli 2026 · lebende Liste. Erledigtes wird abgehakt (✅).
> Legende: **[hier]** = ohne Server baubar · **[Server]** = braucht Ubuntu-Tier-1 (Richtung A).
> Strategie steht in `ROADMAP-v2.md` (Richtung A: echtes Multi-User, Server kommt auf Signal).

## ⭐ Optimierungsplan (15. Juni 2026) — Reihenfolge nach ROI/Risiko, alles [hier]

1. **P1 Korrektheit** (höchster ROI, belegt) — **Bug-Hunt 5** (→ Abschnitt A, AKTIV) + Property-Tests Datum.
2. **P2 UX & Politur** — Design-Graduierung (v1 deprecaten, braucht User-Go) · Berichtsheft-Editor-UX · company/department ins Onboarding · a11y Pass 3.
3. ~~**P3 Architektur** — App.tsx Root-Handler → Hooks + Page-Wrapper · PHPUnit-Suite-Overlap.~~ ✅ (02.07., `be34081` + `917d016`)
4. **P4 Performance** (geringe Marge, Chunk 154 KB) — Lighthouse-Schwellen als Gate (→ Abschnitt G).
> [Server]-Items (any-Tightening, Dual-Mode, Server-Tier) bewusst zurückgestellt bis Server-Signal.

## ⭐ UX-Roadmap 2 — Bedienbarkeit (03.07.2026, alles [hier])

> Quellen: Bug-Hunt 8 (Delta sauber, 0 Korrektheits-Funde), Code-Heuristik-Review (11 belegte Funde),
> visueller Walkthrough beide Rollen Desktop+Mobile (8 Funde). Reihenfolge nach Schadenspotenzial.

### U-P1 · Datenverlust-Schutz (User verliert Arbeit/Daten)
- [ ] **U1 Lösch-Konsistenz** — ConfirmDialog+Toast auf alle 7 nackten Lösch-Stellen: LernpfadeView-Node (`deleteNode` räumt auch fremde prereqs!), Task/Material/Requirement/Step (ProjectTabs), Kommentar (ProjectDetail), Link (LinksManager). Pattern existiert (LabelsManager/CalendarView/GroupsView) — nur nachziehen. · M
- [ ] **U2 Berichtsheft-Editor Dirty-Check** — „Zurück" (ReportsPage:447) verwirft ungespeicherte Wochenberichte kommentarlos → isDirty-Vergleich + Rückfrage. · S/M
- [ ] **U3 Modal-Verwerfen-Schutz** — Backdrop-Klick/Esc schließt jedes Modal sofort (UI.tsx Modal); bei NewProjectModal (3 Schritte) Totalverlust → optionaler `onBeforeClose`-Hook + Rückfrage bei dirty. · M
- [ ] **U4 Papierkorb-Ehrlichkeit** — Trash deckt nur projects/reports/goals; Gruppen/Tasks/Kommentare/Material sind permanent → Coverage erweitern ODER Versprechen im UI präzisieren. · M/L

### U-P2 · Mobile (drei Kernseiten ohne useIsMobile)
- [ ] **U5 Projektliste mobil** — Listen-(Tabellen-)Ansicht wird rechts abgeschnitten → unter Breakpoint Cards/Grid erzwingen. · S
- [ ] **U6 Berichtsheft-Editor mobil** — feste 220px-Metaspalte quetscht Editor → stapeln (column). · M
- [ ] **U7 Ausbildungsplan-Formular mobil** — GoalForm-Grid mit Fixbreiten bricht <400px → stapeln. · S
- [ ] **U8 Kalender mobil** — Wochen-/Monatsraster für Desktop gebaut → Agenda-/Listenmodus unter Breakpoint. · M/L
- [ ] **U9 Projekt-Detail Scroll-Affordance** — Aktions-/Tab-Leiste läuft mobil unsichtbar aus dem Bild → Fade-Kante/Chevron. · S
- [ ] **U10 Kalender-Hover auf Touch** — „Aktiv an diesem Tag"-Popup ist hover-basiert (rendert auf Touch statisch) → Tap-Toggle oder mobil aus. · S

### U-P3 · Konsistenz & Politur
- [ ] **U11 Rollenfremde Shortcuts** — Command-Palette zeigt Azubi „N Neues Projekt" → Shortcut-Liste rollenfiltern. · S
- [ ] **U12 Lehrjahr 1–4 vereinheitlichen** — Ausbildungsplan-Filter kennt nur LJ 1–3, Onboarding/KI-Lernpfad bieten 1–4. · S
- [ ] **U13 Speichern-Beschriftung** — drei Varianten (`✓` ohne Label / „✓ Speichern" / „Speichern") → vereinheitlichen. · S
- [ ] **U14 Pflichtfeld-Marker NewProjectModal** — Titel erst nach Fehlversuch als Pflicht erkennbar → `*` wie TrainingPlanPage. · S
- [ ] **U15 Header-Uhr ohne Sekunden** — sekündliches Ticken = Unruhe + Re-Renders. · S
- [ ] **U16 Sidebar „Verwalten" für Azubi** — Sektion enthält für Azubis nur Gruppen-Beitritt; Label passt nicht zur Rolle. · S
- [ ] **U17 Kategorie-Select Ausbildungsplan** — leeres Select in voller Breite wirkt unfertig. · S
- [ ] **U18 Share-Einstieg für Projekte?** — ShareLinkModal ist generisch (`kind`-Prop), aber nur aus Berichten erreichbar; bewusstes Scope-Limit oder Lücke? → User-Entscheid. · S

## A · Korrektheit & Robustheit
Die wiederkehrende Bug-Klasse — bisher fand jede Hunt-Runde 12–14 echte Bugs, allein heute 7 latente.

- [x] **Bug-Hunt 5** (P1, 15.06., `534df65`/`501604f`/`dbf6d67`/`21f2810`) — 7 verifizierte Funde gefixt: ID-Typ-Vergleiche→sameId (heroSuggestion/useNotifications/AzubiProfile), Stale-data-Race in 13 App.tsx-Handlern→funktionale setData, Print-XSS MonthReportModal, PHP ai-rate-limit/goals-RLS/reports-cross-group. Vitest 110, PHPUnit 133, Boot-Smoke 5/5.
- [x] **Bug-Hunt 4** (`c86ae29`) — 3 UTC-Off-by-one (WeekProgress/CalWidget/MonthReportModal) gefixt
- [x] **ID-Mismatch-Tiefensweep** — keine offenen aliased Vergleiche mehr (welcomeNewsData `me` in `c54c501`, useNotifications/Dashboard in `d490c9c`)
- [x] **Boot-Smoke vertiefen** (`c38132b`) — Interaktions-Test für CommandDialogs (Ctrl+K-Suche + ?-Shortcuts). Editor-Open zurückgestellt (Preview-Overlay-Flakiness).
- [x] **Property-Tests Datum** (P1, 15.06.) — `tests/date-properties.test.js` (fast-check): DST-Stabilität als Invariante in Europe/Berlin. dayDiffLocal = Kalendertag-Delta unabhängig von Uhrzeit/Zeitumstellung; alle 7 Tage einer ISO-Woche = selbe KW; fmtLocalDate-Round-Trip; +explizite DST-Grenztage 2026 + Fail-Loud-TZ-Guard.
- [x] **PHPUnit-Suite-Overlap** behoben (01.07., `917d016`) — `defaultTestSuite="all"`: bare phpunit läuft jede Datei genau 1× (133 Tests, Exit 0), Named-Suites bleiben.
- [x] **Bug-Hunt 8** (03.07.) — Delta seit Hunt 7 (`9ebc8cd`/`ce5c043`/`04401f9`) zeilenweise reviewt: alle 21 sameId-Konvertierungen semantikerhaltend, TaskCard-Tastatur-Semantik korrekt verlagert, ST.cT additiv. Repo-Greps ohne Fund: stale Spreads 0, ungültige var()-CSS 0, Print-Fenster vollständig escaped. `.includes()`-auf-ID-Arrays-Klasse geprüft (Lint-Regel blind dafür): alle ~20 Stellen hängen an der Boundary-Invariante „getUsers/getMe/schemaMap normalisieren IDs zu String" — kein belegbarer Mix-Fall, bewusst belassen. **0 neue Korrektheits-Funde.**
- [x] **Bug-Hunt 7 / große Fehleranalyse** (02.07., `7caa6eb`) — 9 sameId-Nachzügler über Alias-Vergleiche (`a.id`/`u.id` statt `currentUser.id` → Lint-Regel blind): Cockpit/MonthReportModal/CalendarView; 4 T-Token-Verstöße in ProjectTabs (a11y-Gate öffnet keine Projekt-Tabs). Geprüft ohne Fund: stale Spreads, Print-XSS, UTC-Mix (Burndown/LearnPage in sich UTC-konsistent, bewusst belassen). Bekannte Gate-Lücken: Lint-Regel matcht keine Aliase; axe-Audit öffnet Detail-Tabs nicht.

## B · Kernzweck: Berichtsheft & IHK
- [x] **M5a IHK-Recherche-Spike** (`docs/IHK-Spike.md`) — **Ergebnis: Export, keine API.** Einreichung = signierte Gesamt-PDF ins IHK-Prüfungsportal; offizielles IHK-Digital-Berichtsheft wird 31.12.2026 abgeschaltet → Drittanbieter (AzubiBoard passt). M5c (Direkt-API) entfällt.
- [x] **M5: Kompletter Ausbildungsnachweis als eine PDF** (`6f60503`) — Deckblatt + alle KW chronologisch (lfd. Nr., Tages-Tabelle, Unterschriftszeile/Woche). Azubi-Button „📑 Kompletter Nachweis".
- [x] **Tages-Struktur Mo–Fr + Stunden** (`b0cd2c3`) — optionale Tageseinträge + IHK-Tages-Tabelle im Druck
- [x] **Berichtsheft-Editor-UX** (01.07., `799f43d`) — KW+ISO-Jahr prominent im Header (inkl. Jahreswechsel-Fix), Pflicht-Tag am Tätigkeitsbericht, Vorschau-Tab (Druck-Ansicht inline)
- [x] **company/department ins Onboarding** (01.07., `50f3a57`) — im Azubi-Profil-Schritt erfassbar
- [x] IHK-Export: Ausbildungsbetrieb/Abteilung/laufende Nachweis-Nr (`d4a154a`)

## C · KI-Features
⚠️ Alles server-seitig → aktiv erst mit Server-Tier.
- [x] **AI3 KI-Prüfungsvorbereitung** (`93fdce2`) — Quiz aus Thema generieren (Ausbilder, server-seitig)
- [x] **AI5 AI-Lernpfad-Generator** aus Berufsbild (03.07.) — `POST /api/ai/generate-learning-path` (Ausbilder/Mentor, 10/h) + „🤖 KI-Lernpfad"-Modal in LernpfadeView; prereq-Indizes→Node-IDs via `generatedPath.ts` (pure, getestet). Aktiv erst mit Server-Tier.
- [x] AI4 KI-Feedback auf Berichte (`717ef64`)

## D · Ausbilder-Werkzeuge
- [x] **Azubi-Detail Drill-down** (`be0b466`) — fehlende Berichtswochen (KW-Chips) + Heft-Quote
- [x] **Prüfungs-Readiness-Score** (`6d34f88`) — Composite (Heft 40/Lernziele 35/Aufgaben 25) auf Azubi-Detailseite
- [x] **Lernziel-Quote** pro Azubi im Cockpit (01.07., `a1c166f`) — 🎯 x/y-Chip in den Azubi-Reihen (Semantik = Kompetenz-Ring)
- [x] Berichtsheft-Vollständigkeit pro Azubi im Cockpit (`c63e8bd`)

## E · Architektur & Wartbarkeit
- [x] **App.tsx entflochten** (1757→**262** Z., 02.07., 3 Commits bis `be34081`) — Page-Wrapper → `src/pages/` (8 Route-Wrapper + DesignSwitch), AppLayout → `components/AppLayout.tsx`, useTheme/useIsMobile/useToast → `lib/`, Root-Handler/Effects → `src/app/`-Hooks (useAuthSession/useConflict/useOnboardingFlow/useAuditForward/useGlobalShortcuts/useBackupExport). App.tsx = Store-Bindung + Modal-State + Routing.
- [ ] **Dual-Mode-Schuld** — wird durch Richtung A an der Wurzel aufgelöst · [Server]
- [ ] **Blob↔Schema-`any` tightening** nach Schema-Read-Verifikation · [Server]
- [x] Notification-UI extrahiert (`8a24a09`) · sameId/isoWeekMonday zentralisiert · firstName zentralisiert

## F · UX & Politur
- [x] ~~**Design-Graduierung** — v1 deprecaten~~ **ENTFÄLLT per User-Entscheid (02.07.):** beide Designs bleiben wählbar (1.0 + 1.1 „Werkbank" als Default). Wartungslast bewusst akzeptiert.
- [x] **a11y-Audit Pass 3** (02.07., `181c937`) — axe-core WCAG A+AA über alle Routen/Themes/Rollen: 20 Violation-Gruppen → **0**. Text-Token-System (--c-*-text, --c-on-ac), --c-mu-AA, Label-Fixes, dunkle Schrift auf Akzent-Buttons (User-Entscheid). **Neues CI-Gate `e2e/a11y.spec.js`** hält den Stand.

## G · Performance
- [x] **Bundle-Headroom** (`68006f8`) — Dashboard+ProjectPool lazy → Haupt-Chunk 169.83 → **154.53 KB gz** (~9 % Luft)
- [x] **Lighthouse-Schwellen als CI-Gate** (02.07., `66a3691`) — alle 4 Kategorien blocking (perf 0.90 / a11y 0.95 / bp 0.95 / seo 0.90), 3 Runs/Median gegen Runner-Varianz, Meta-Description ergänzt. Baseline 1.0/1.0/1.0/1.0. Route-Prefetch unnötig (perf schon 1.0).

## H · Betrieb & Server (Richtung A — auf Signal)
- [ ] **Server-Tier** Migration/RLS/Dual-Write/Schema-Reads/AI/N1 live (`docs/Server-Tier-Checkliste.md`) · [Server]
- [ ] **SEC1** Fail2ban + UFW · **Backup/Restore live-verify** · [Server]
