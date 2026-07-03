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

### U-P1 · Datenverlust-Schutz (User verliert Arbeit/Daten) — ✅ komplett (03.07., `a4e2f1f`)
- [x] **U1 Lösch-Konsistenz** — ConfirmDialog auf alle 7 nackten Lösch-Stellen (Task/Material/Requirement/Step/Kommentar/Link/Lernpfad-Node), Texte nennen Objekt + „landet nicht im Papierkorb"
- [x] **U2 Berichtsheft-Editor Dirty-Check** — Snapshot-Vergleich, „Zurück" fragt bei ungespeicherten Änderungen
- [x] **U3 Modal-Verwerfen-Schutz** — `guardClose`-Prop am Modal (Backdrop/Esc/× fragen bei dirty), NewProjectModal angebunden; abwärtskompatibel
- [x] **U4 Papierkorb-Ehrlichkeit** — TrashPage-Hinweis nennt die 3 abgedeckten Typen explizit (Coverage-Erweiterung bewusst zurückgestellt)

### U-P2 · Mobile — ✅ komplett (03.07., `2014bc1`; U6 schon in `a4e2f1f`)
- [x] **U5 Projektliste mobil** — Karten-Ansicht erzwungen, Tabellen-Toggle mobil ausgeblendet
- [x] **U6 Berichtsheft-Editor mobil** — stapelt via useIsMobile, Metaspalte volle Breite oben
- [x] **U7 Ausbildungsplan-Formular mobil** — GoalForm stapelt (1fr)
- [x] **U8 Kalender mobil** — Agenda-Modus ersetzt das Raster (vertikale Tagesliste, gleiche Klickpfade, heute immer sichtbar; Monat/Woche-Toggle steuert Zeitraum)
- [x] **U9 Projekt-Detail Scroll-Affordance** — Fade-Kante (CSS-Maske) an Kopf-/Tab-Leiste mobil
- [x] **U10 Kalender-Hover auf Touch** — „Azubi aktiv" in der Agenda inline (Avatar+Name+Status)

### U-P3 · Konsistenz & Politur — ✅ komplett (03.07.)
- [x] **U11 Rollenfremde Shortcuts** — Hilfe + Ctrl+K-Hinweise rollenfiltern (N/G+U nur Ausbilder; Handler waren schon gegated)
- [x] **U12 Lehrjahr 1–4 vereinheitlicht** — Filter/GoalForm/byYear/PathModal auf 1–4. **Bonus-Fund: LJ-4-Lernpfade (KI-Generator) waren in der UI unsichtbar** (byYear filterte 1–3) — behoben
- [x] **U13 Speichern-Beschriftung** — Prüfungsdatum-✓ → „✓ Speichern", Abbrechen-Button beschriftet
- [x] **U14 Pflichtfeld-Marker** — Hinweis am Projekttitel (war in `a4e2f1f`)
- [x] **U15 Header-Uhr** — HH:MM statt HH:MM:SS, 30s-Intervall
- [x] **U16 Sidebar-Sektion** — Azubi sieht „Mehr" statt „Verwalten"
- [x] **U17 Kategorie-Select** — kompakt in der Filterzeile, „Alle Kategorien"
- [x] **U18 Projekt-Share** (User-Entscheid: ja) — „Teilen"-Button im Projekt-Kopf, ShareLinkModal kind='project', localStorage-Modus graceful. **Folge-Item [Server]:** ShareView rendert kind='project' bisher als generischen JSON-Fallback → hübsche Projekt-Ansicht bauen, sobald Share-Links live getestet werden

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
