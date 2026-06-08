# AzubiBoard — UX-/Design-Roadmap · ✅ ABGESCHLOSSEN

> Stand: 5. Juni 2026 (erstellt) · ✅ abgearbeitet 07.06.2026 · Quelle: Multi-Agent Design-/Bedienbarkeits-Review (8 UX-Dimensionen + Synthese)
> Scope: Design & Bedienbarkeit.
> **Status: Phase 0, 1, 2, 4 umgesetzt + live auf `main`. Phase 3 (Mobile/Touch) out-of-scope (App ist PC-only).**
> Dieses Dokument ist Historie/Referenz — die aktuelle Roadmap steht in `ROADMAP.md`.

> **Erledigt:** Phase 0 (`38faa9d`) → Phase 1+2 (`843185c`) → Phase 4 (`9266fe7`), alle gemergt+live, CI+Netlify grün.
> Die beiden Verifikations-Bug-Behauptungen unten wurden geprüft (beide WAHR) und in Phase 0 gefixt
> (ConflictDialog eingehängt, Light-Mode-Farbquelle vereinheitlicht).

**Roter Faden des Reviews:** Die App ist funktional dicht, aber **ohne verbindliche Konvention** — Farben,
Status-Mappings, Nav-Pfade, Speicher-Semantiken, Dialog-/Tastatur-Verhalten existieren je in 2–4 Varianten.
Am teuersten: **Rolle & Kontext werden zu selten ins UI durchgereicht** — `isStaff`, `useIsMobile` und die
Konflikt-UI sind gebaut, aber an den entscheidenden Stellen nicht verdrahtet. Wer Theming, Rollen-Durchreichung
und Interaktions-Primitive an der Wurzel vereinheitlicht, räumt die Mehrzahl der Einzelbefunde mit ab.

Legende Severity: **[P1]** gravierend (Bug/Blocker für Rolle oder Gerät) · **[P2]** mittel · **[P3]** Politur.

---

## ⚠️ Zuerst verifizieren (starke, prüfbare Behauptungen)

Bevor Phase 1 startet — 2 Befunde sind echte Bug-Behauptungen, nicht Geschmack:
- [ ] **ConflictDialog wird nie gerendert** (`App.tsx` — Komponente importiert, JSX nicht eingehängt, Underscore-Vars). Wenn wahr → 409-Konflikt-Flow tot.
- [ ] **Light-Mode bricht** durch doppelte Farbquelle (`C`-Hex in `lib/utils.ts` Z.7–42 vs. CSS-Vars `--c-*`). Wenn wahr → Modal/StatCard/EmptyState/Avatar/ProjectCard bleiben im Light-Mode dunkel.

---

## Phase 0 — Quick-Wins & echte Bugs (klein, hohe Wirkung)

| # | Sev | Ort | Maßnahme |
|---|---|---|---|
| 0.1 | P1 | `index.css` | Globaler `:focus-visible`-Outline → Tastatur-Navigation überhaupt sichtbar |
| 0.2 | P1 | `App.tsx` | `ConflictDialog` ins JSX einhängen (`{conflict && <ConflictDialog/>}`), Underscores entfernen |
| 0.3 | P1 | `lib/utils.ts` Z.46 + `C.sf/bd/tx` | `ST.green.bg` + themebare `C`-Werte auf `var(--c-*)` → Light-Mode funktional |
| 0.4 | P2 | `NewProjectModal` / `ReportsPage` | `min={startDate}` an Deadline-Input, `max=heute` an Berichtswoche |
| 0.5 | P1 | `ReportsPage` (ReportEditor) | Ausbilder-Default-Filter `submitted` beim Mount |
| 0.6 | P1 | Sidebar-Footer + Dashboard-Header | „+ Neues Projekt" für Azubi/Mentor über `isStaff` ausblenden |
| 0.7 | P2 | `ProjectDetail` Z.77 | `window.confirm` → `ConfirmDialog` (danger) |
| 0.8 | P3 | `ReportsPage` (ReportEditor.save) | leeres `week_start` als **Inline-Fehler** statt stillem Default *(NaN bereits in `d848aab` gefixt → Rest = nur noch „still")* |
| 0.9 | P2 | `LernpfadeView`/`TrainingPlanPage` | Schnell-Toggle auf `confirmed`-Ziel läuft in `markLearned` → überschreibt Ausbilder-Bestätigung; bei `confirmed` Toggle sperren/Rückfrage *(separater Pfad zum `confirmUser`-Fix aus `d848aab`)* |

---

## Phase 1 — Theme-System auf EINE Quelle *(Design-Wette 1)*

Wurzel-Fix gegen die „zusammengestückelt"-Wirkung und kaputten Light-Mode.

- [P1] `C` (lib/utils.ts) trennen: nicht-themebare Konstanten bleiben, **alles Themebare strikt über `var(--c-*)`**.
- [P2] Status→Farbe/Label zentral: eine `statusMeta`-Map ersetzt `ST` / `ST_COLORS` / ProjectCard-`sc` (Duplikate Z.45/134/142).
- [P2] Sektionstitel auf **eine** `SectionHeader`-Komponente (mit `size`-Prop) konsolidieren; `Syne`-Font laden **oder** entfernen (aktuell nur in `Chip` referenziert, nirgends geladen).
- [P2] `IconBtn` Hover auf `var(--c-sf2)` (harte `rgba` ist im Dark-Mode unsichtbar).
- [P3] Radius- & Typo-Skala als Vars; willkürliche Radien (4–20) und 8px-Mikroschrift streichen.

## Phase 2 — Rollen-orientierte Informationsarchitektur *(Design-Wette 2)*

Räumt P1 aus Navigation + Rollen-Flows + Onboarding **gemeinsam** ab.

- [P1] **Navigation aus `isStaff`/`isAzubi`/`isMentor` kuratieren** (statt ad-hoc `role==='ausbilder'`, `App.tsx` Z.596). Staff bekommt **„Berichte prüfen"** als Default-Einstieg (Filter `submitted`, „wartet auf mich", Sortierung `submitted_at` aufsteigend, Empty-State „Keine Berichte zu prüfen").
- [P1] **Berichts-Bestätigung vereinheitlichen**: Karte = 1-Klick→`signed` vs. Editor = erzwungene 2 Stufen. Im Editor „Geprüft" **und** „Direkt unterschreiben" gleichzeitig anbieten.
- [P1] **Onboarding rollenrichtig**: leeres Azubi-Konto zeigt Startanleitung statt „Alles erledigt! ✓"; Wizard endet für Azubi mit CTA „Ersten Bericht anlegen"; „+ Neues Projekt" für Azubi/Mentor weg (Empty-State erklärt „Ausbilder weist zu").
- [P2] Sidebar gruppieren („Arbeiten"/„Verwalten"), Papierkorb in den Footer; Aktiv-Markierung für `/profile` & `/azubi/:id`; eine Nav-Konvention (immer absolute Pfade).
- [P2] Mentor read-only — keine Schreib-CTAs.
- [P2] Registrierung mit Minimal-Setup (Beruf/Lehrjahr/Gruppencode); Demo-Zugang nur im Login-Modus + in Prod per Env-Flag aus.
- [P3] Globale Suche um Berichte (nach KW/Jahr+Name)/Lernen/Kalender erweitern; G-Shortcut-Map rollenabhängig.

## Phase 3 — Mobile-fähige Inhalts-Views *(Design-Wette 3)*

Zielgruppe = 16-jährige Azubis → Handy ist Hauptgerät; Kern-Views sind dort aktuell unbenutzbar.

- [P1] **Dashboard** 3-Spalten-Grid (~900px min) bricht nicht um → rechte Spalte (Berichte/Deadlines) unerreichbar. `useIsMobile()` durchreichen, <760px auf `1fr` stapeln.
- [P1] **Netzplan** auf Touch unbedienbar (Pan=Alt+Drag, Zoom=Wheel, Drag=Maus). `onTouchStart/Move`-Handler, prominente +/−-Buttons, Sidebar mobil stapeln.
- [P2] **Gantt-Reorder** nutzt HTML5-`draggable` (feuert auf Touch nicht) → @dnd-kit `TouchSensor` (Muster aus Kanban) oder Pfeil-Buttons.
- [P2] **Kanban** fixe 200px-Spalten + Scroll-vs-Drag-Konflikt; Status-Buttons unter Touch-Größe → `min(78vw,240px)`+Scroll-Snap, ←/→-Buttons ≥40px.
- [P2] **Touch-Ziele <24px** (`.del` 24, Checkbox 19/14) dicht beieinander → Hit-Area ≥40px, `IconBtn` statt roher `<button>`.
- [P2] **Kalender** fixes 5-Spalten-Monatsgrid + Hover-only-Worker-Info; Zell-Tap öffnet sofort „Neuer Termin" → mobil Wochen-/Agenda-Ansicht, Tap=Detail, separater +-Button.

## Phase 4 — Einheitliche Interaktions-Primitive *(Design-Wette 4)*

Beseitigt eine ganze Klasse „mal so, mal so"-Befunde.

- [P1] **Ein Dialog-Hook** (Focus-Trap, Escape, Fokus-Rückgabe, Body-Lock) für **alle** Overlays inkl. `ConfirmDialog`, `GlobalSearch` (Ctrl+K), `ShortcutsHelp` (`role="dialog"`/`aria-modal`).
- [P1] **Klickbare DIVs zu echten Controls**: Filter-Chips & StatCards → `<button>` bzw. `role="button" tabIndex=0 aria-pressed` + `onKeyDown` (aktuell per Tastatur nicht bedienbar).
- [P2] **Eine Speicher-Semantik pro Feld** (sofort vs. explizit) — ProjectDetail Start/Deadline aktuell an zwei Stellen mit widersprüchlicher Logik; Kachel im Edit-Mode nur Anzeige.
- [P2] **Ein Tastatur-Sende-Standard**: einzeilig=Enter, mehrzeilig=Strg+Enter (mit sichtbarem Hinweis); `onKeyDown` auf alle Felder einer Eingabezeile.
- [P2] Icon-only-Buttons durchgängig `aria-label`; Tabs mit `role="tab"/aria-selected/tabpanel`; Stepper-Wechsel per `aria-live`.
- [P2] **Feedback-Rollen trennen**: SyncIndicator=technisch (mit Reset + klickbarem Retry + Fehlertext), Toast=fachlich (mit Undo); Doppel-Feedback auflösen.
- [P2] **Bootstrap-Ladezustand** (`App.tsx` Z.1503 `return null` → leerer Screen wirkt wie Absturz): Splash/Spinner im `RouteFallback`-Stil.
- [P3] Undo konsistent (Archivieren aus Detail Z.781 ohne, aus Liste Z.1147 mit); Filter-Empty-State „Filter zurücksetzen" statt „Neu anlegen"-CTA; „Vorlage einfügen" bei nicht-leerem Text bestätigen.

## Querschnitt — Lernpfade/Plan (rollenabhängig in Phase 2)
- [P2] Sammel-Bestätigen für Ausbilder („Alle gelernten bestätigen") statt 2 Klicks pro Azubi.
- [P3] Lernpfad-Abschluss rücknehmbar machen (`saveProgress` kann nur `completed=true`).

---

## Empfohlene Reihenfolge

```
Phase 0  (Quick-Wins + echte Bugs)         ← sofort, klein, hohe Wirkung
   │
   ▼  zuerst die 2 Verifikations-Punkte oben prüfen
Phase 1  (Theming eine Quelle)             ← Wurzel-Fix, entsperrt Light-Mode
Phase 2  (Rollen-IA)                       ← größter Bedien-Hebel
Phase 3  (Mobile/Touch)                    ← Hauptgerät der Zielgruppe
Phase 4  (Interaktions-Primitive)          ← räumt Rest-Befunde gebündelt ab
```

Umsetzung gemäß User-Vorgabe **lokal auf Branch, kein Push**, bis explizit freigegeben.
