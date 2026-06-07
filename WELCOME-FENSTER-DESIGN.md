# Design-Spec: Willkommens-/News-Fenster beim Login

> Status: Design/Planung (kein Code). Quelle: Multi-Agent Design-Workflow (4 Blickwinkel — Inhalt/IA, Visuell/Layout, Interaktion/Cadence, Onboarding-Ausbau — + Synthese). Stand: 7. Juni 2026.

---

## 1. Ziel & Scope

Beim Login soll AzubiBoard rollenabhängig die aktuelle Lage zeigen: für Azubis offene/überfällige Aufgaben, fehlendes Berichtsheft, Feedback und bestätigte Lernziele; für Ausbilder/Mentor Berichte zur Prüfung, kritische Azubis, fehlende Wochenberichte und Lernziele zur Bestätigung. Ton und Stil orientieren sich an der vom User geschätzten `HeroTask`-`emptyAccount`-Kachel (`src/features/dashboard/widgets/HeroTask.tsx` Z.27-34): warm, handlungsorientiert, mit freundlichem Leerzustand statt „0 Notifications".

**Harte User-Vorgabe (unverhandelbar):** Das bestehende Onboarding (`OnboardingWizard`, First-Login, Trigger `azubiboard_onboarded_<id>`) bleibt erhalten und wird ausgebaut (siehe §5). ZUSÄTZLICH erscheint beim normalen (jeden) Login ein eigenes Willkommens-/News-Fenster. Beides koexistiert, überlappt aber nie in derselben Session.

---

## 2. Anzeige-Logik / Trigger (Entscheidungsbaum)

### 2.1 Kernproblem (entscheidende Erkenntnis)

`setCurrentUser(...)` wird in `src/App.tsx` an drei Stellen aufgerufen: `handleLogin` (Z.1431, echter Login), Bootstrap `getMe()` (API-Reload mit JWT) und `loadSession()` (lokaler Reload mit sessionStorage). Der bestehende Onboarding-Effect (Z.1283-1287) hängt nur an `currentUser?.id` und kann frischen Login NICHT von Reload unterscheiden. Beim Onboarding egal (localStorage-Flag fängt es), beim News-Fenster NICHT — sonst poppt es bei jedem F5/Tab-Reload auf.

**Lösung:** Expliziter Login-Marker in `sessionStorage`, nur von `handleLogin` gesetzt:
```ts
// in handleLogin (App.tsx Z.1431), VOR setCurrentUser(user):
sessionStorage.setItem('azubiboard_fresh_login', String(user.id));
```
`sessionStorage` ist korrekt: Reload = gleiche Session = Marker bereits konsumiert → kein Re-Pop; neuer Tab = kein Marker → kein Pop ohne echten Login.

### 2.2 Entscheidungsbaum

```
setCurrentUser feuert (Login ODER Reload), currentUser.id gesetzt:
│
├─ fresh = sessionStorage['azubiboard_fresh_login']
├─ fresh !== String(currentUser.id)?  → JA: Reload/Restore → NICHTS zeigen. STOP.
│                                        NEIN ↓ (echter Login)
├─ sessionStorage.removeItem('azubiboard_fresh_login')   ← Marker konsumieren
│
├─ localStorage['azubiboard_onboarded_<id>'] NICHT gesetzt?
│   └─ JA  → ERSTER Login → OnboardingWizard (hat Vorrang).
│            News-Fenster in DIESER Session NICHT zeigen
│            (Wizard-Schritt „Dein Wochenstart" ist bereits die News, §5).
│            doneOnboarding() setzt onboarded=1 → ab nächstem Login greift News.
│   └─ NEIN → KEIN Onboarding. Weiter ↓
│
├─ localStorage['azubiboard_news_seen_<id>'] === today()?
│   └─ JA  → heute schon gesehen → NICHTS zeigen. STOP.
│   └─ NEIN ↓
│
└─ setShowNews(true)
    ├─ Items vorhanden (§3)?  → News-Karten rendern.
    └─ 0 Items                → Fenster TROTZDEM zeigen, „Alles gut"-Zustand
                                (HeroTask-Ton). Begründung: der geliebte
                                Begrüßungsmoment soll auch an ruhigen Tagen da sein.
    └─ Beim Schließen: localStorage['azubiboard_news_seen_<id>'] = today()
```

### 2.3 Cadence (Entscheidung)

**Max. 1× pro Kalendertag pro User**, nur bei echtem Login. Alternative „bei jedem Login" wurde verworfen: nervt bei Multi-Login/Reload und dupliziert die `NotificationBell` (Live-Werkzeug). 1×/Tag ist der Sweet Spot — `today()` existiert bereits (`src/lib/utils.ts`, importiert in App.tsx). Eine „Heute nicht mehr zeigen"-Checkbox entfällt, weil Schließen ohnehin den Tages-Key setzt.

> Hinweis zur User-Formulierung „bei jedem Login": Streng wörtlich hieße das auch bei Reload/mehrfach täglich. Wir interpretieren es als „bei jedem echten Login-Vorgang, höchstens 1×/Tag". Falls der User wirklich jedes Mal will → Offene Frage Q1.

### 2.4 Storage-Schema

| Key | Storage | Wert | Zweck | Gesetzt in |
|---|---|---|---|---|
| `azubiboard_onboarded_<id>` | localStorage | `'1'` | Onboarding gesehen (bestehend) | `doneOnboarding` (App.tsx Z.1449) |
| `azubiboard_fresh_login` | **sessionStorage** | `<userId>` | Marker echter Login (NEU) | `handleLogin` Z.1431, vor `setCurrentUser` |
| `azubiboard_news_seen_<id>` | localStorage | ISO-Datum (`today()`) | News heute weggeklickt (NEU) | beim Schließen des Fensters |
| `azubiboard_notif_read_<id>` | localStorage | JSON-Array IDs | Glocken-Read-State (bestehend Z.242) — News teilt ihn | `markRead`/`markAllRead` |

**Verworfen:** Variante `azubiboard_news_seen_<id>_<YYYY-MM-DD>` — würde pro Tag einen neuen Key akkumulieren (Garbage). Stattdessen ein Key mit Datum als Wert, wird überschrieben statt akkumuliert.

### 2.5 Rollen-Gating

Inhalt verzweigt über `currentUser.role`; Schema rollenunabhängig. `azubi` → Azubi-Variante. `ausbilder` + `mentor` → Staff-Variante (konsistent mit Dashboard-Dispatch und Glocken-Branch `role === 'ausbilder' || role === 'mentor'`, Z.272). Mentor read-only: nur Navigation, keine Aktions-CTAs (`isMentor()` aus `src/lib/roles.js`).

### 2.6 Edge-Cases

1. **Reload mit Session:** kein `fresh_login` → kein Pop. ✅ (Kernproblem)
2. **Erster Login:** Onboarding, News unterdrückt (Effect bricht bei fehlendem onboarded-Flag ab). 2. Login → News.
3. **„Überspringen" im Onboarding:** `doneOnboarding` setzt trotzdem onboarded=1 → News erst nächster Login, kein Doppel-Modal.
4. **Onboarding manuell via Event** (`azubiboard:show-onboarding`, Z.1289): unabhängig vom Login-Marker, kein Einfluss auf News.
5. **Mehrere Tabs:** `fresh_login` ist sessionStorage (pro Tab) → kein Doppel-Pop.
6. **Login → Logout → Login am selben Tag:** Marker neu gesetzt, aber `news_seen == today()` → kein erneutes Zeigen. ✅
7. **Mitternacht:** `today()` ändert sich → nächster Login zeigt wieder. Gewollt.
8. **`data` beim Login noch nicht geladen (API-Modus):** Items leer → fälschlich „Alles gut". **Mitigation:** Marker konsumieren + `setShowNews(true)`, aber Item-Berechnung passiert IM Fenster reaktiv aus dem Store (`useAppStore`), der nachlädt. Optional kurzes Lade-Skeleton statt sofortigem „Alles gut".
9. **localStorage aus/voll:** alle Zugriffe in `try/catch` wie bestehend (Z.244, 306, 313); Fallback = nicht crashen.
10. **Kein User:** Effect bricht bei `!currentUser?.id` ab.

---

## 3. Inhalt pro Rolle

Severity-Reihenfolge wie bestehend: `critical → warning → info` (Sort Z.282). News-Fenster zeigt **aggregierte Zusammenfassungen** („3 Berichte zu prüfen") statt der flachen Einzelliste der Glocke — gleiche Datenquelle, andere Verdichtung.

### 3.1 Azubi (priorisiert)

| # | Item | Severity |
|---|---|---|
| 1 | X Aufgaben überfällig (bei genau 1 → Titel = `task.text`) | critical |
| 2 | Berichtsheft KW {n} noch offen | warning |
| 3 | X Aufgaben/Deadlines fällig in ≤3 Tagen | warning |
| 4 | Bericht KW X geprüft/unterschrieben (Feedback) | info |
| 5 | X Lernziele bestätigt 🎉 (Delta) | info |
| 6 | Noch X Tage bis zur Prüfung (nur wenn ≤60 Tage) | info |

### 3.2 Ausbilder (priorisiert)

| # | Item | Severity |
|---|---|---|
| 1 | X Azubis brauchen Aufmerksamkeit (Ampel rot) | critical |
| 2 | X Berichtshefte warten auf Prüfung | warning |
| 3 | X Azubis: KW {n} fehlt | warning |
| 4 | X Lernziele als „gelernt" markiert (zu bestätigen) | info |
| 5 | X Projekte kritisch (status rot) | warning |
| 6 | X Deadlines diese Woche | info |

### 3.3 Mentor (read-only, sonst = Ausbilder)

- **Item #4 (Lernziele bestätigen) entfällt** als Handlungsaufforderung — Mentor kann nicht bestätigen (Toggle in `TrainingPlanPage.tsx` Z.146 ist Ausbilder-Aktion). Höchstens passiv: „X Lernziele warten auf Bestätigung durch den Ausbilder".
- Item #2 Wording: „X Berichte in Prüfung" statt „warten auf deine Prüfung".
- Alle CTAs = Navigation („ansehen"), keine Aktions-Buttons.
- Implementierung: Staff-Liste einmal bauen, für Mentor filtern/umlabeln (nicht duplizieren), via `isMentor()`.

### 3.4 Daten-Mapping (Item → Feld/Berechnung → Route)

| Item | Quelle / Feld | Berechnung | Klick → Route |
|---|---|---|---|
| Überfällige Tasks (Azubi) | `data.projects[].tasks[]`: `assignee`, `status`, `deadline` | `!archived`, `assignee===me`, `status!=='done'`, `deadline`, `ceil((deadline-now)/86400000) < 0` (Z.256) | 1: `/project/{projectId}`; mehrere: `/projects` |
| Bald fällig (Azubi) | dito + `project.assignees`/`project.deadline` | `0 ≤ d ≤ 3` (Z.259-268) | 1: `/project/{id}`; mehrere: `/calendar` |
| Berichtsheft offen (Azubi) | `data.reports[]`: `user_id`, `week_start` | `weekMon = ISO-Montag(now)` (Dashboard Z.108); `!some(r.user_id===me && r.week_start >= weekMon)` | `/reports` |
| Bericht-Feedback (Azubi) | `data.reports[]`: `user_id`, `status` | `user_id===me && status ∈ {reviewed,signed}` (Z.277), nur ungelesen gg. `readIds` | `/reports` |
| Lernziel bestätigt (Azubi) | `data.trainingPlan.goals[].progress[me].status` | `=== 'confirmed'` (TrainingPlanPage Z.394); **Delta** gg. zuletzt gesehener Anzahl | `/training` |
| Prüfungs-Countdown (Azubi) | `data.trainingPlan.examDate` | `0 ≤ ceil((examDate-now)/Tag) ≤ 60` (Z.35) | `/training` |
| Berichte zu prüfen (Staff) | `data.reports[]`: `status` | `status==='submitted'` (`.length`, Z.273) | `/reports` |
| Kritische Azubis (Staff) | `data.projects[].tasks[]` + `data.users[]` | pro azubi: `overdue.length > 2` (Ampel Z.121) | `/` (Dashboard) |
| Azubis ohne Bericht (Staff) | `data.reports[]` + `data.users[]` | pro azubi: `!hasThisWeek` (Z.111) | `/` |
| Lernziele zu bestätigen (Staff) | `data.trainingPlan.goals[].progress[azubiId].status` | `=== 'learned'`, Summe über Azubis (Z.130/146) | `/training` |
| Projekte rot (Staff) | `data.projects[]`: `archived`, `status` | `!archived && status==='red'` | 1: `/project/{id}`; mehrere: `/projects` |
| Deadlines diese Woche (Staff) | `data.calendarEvents[]` + `project.deadline` | `type==='deadline'` bzw. Deadline ≤7 Tage | `/calendar` |

Helfer: `getISOWeek(now).week` (`src/lib/utils.ts`); ISO-Montag DST-sicher wie Dashboard.tsx Z.108 (`fmtLocalDate`).

**Schema-Hinweis:** `data.trainingPlan.goals` ist im Schema `z.array(z.unknown())` (schemas.ts Z.264), Cast auf echten `TrainingGoal`-Typ wie in TrainingPlanPage.tsx Z.267. `data.groups` ebenso `z.unknown()` (Z.267).

### 3.5 „Alles gut"-Zustand

- **Azubi, Konto leer** (`data.projects.filter(p => p.assignees?.includes(me)).length === 0`): 👋 „Willkommen zurück, {Vorname}!" + „Dein Ausbilder weist dir Projekte zu. Bis dahin kannst du deinen ersten Berichtsheft-Eintrag anlegen." + CTA „Bericht anlegen". (1:1 Geist HeroTask Z.30-32.)
- **Azubi, alles erledigt** (Projekte da, 0 Items): ✓ grün (`C.gr`), „Alles im grünen Bereich!" + „Keine offenen Aufgaben, dein Bericht ist abgegeben." (HeroTask Z.37-40, Willkommens-gerahmt.)
- **Staff, alles gut:** 👋 + tageszeitabhängiger Gruß + „Alles unter Kontrolle — keine Berichte zu prüfen, alle Azubis im Plan." + ruhige Mini-Übersicht „{azubis.length} Azubis · {active.length} aktive Projekte". Souverän, nicht leer.

---

## 4. Visuelles Design

### 4.1 Empfehlung: zentriertes Modal-Overlay

**Entscheidung: Modal-Overlay (zentriert), kein eingebettetes Dashboard-Panel, kein Slide-in.** Begründung: (a) Das Onboarding ist bereits ein zentriertes Overlay (gleiches mentales Modell „beim Reinkommen begrüßt mich die App"); (b) Modal erzwingt den einmaligen Fokus-Moment, ohne Dashboard-Fläche zu verbrauchen; (c) Slide-in von rechts kollidiert mit dem `NotificationBell`-Popover (Doppelung). Die Bell bleibt das permanente Live-Werkzeug, das Modal ist der Tages-Aufschlag.

**Verworfen:** `Modal` aus `UI.tsx` als Hülle vs. eigene Portal-Hülle wie OnboardingWizard. **Entscheidung: eigene Portal-Hülle im OnboardingWizard-Stil** (`position:fixed`, `inset:0`, `zIndex 9000`, `rgba(0,0,0,.7)`, `maxWidth 540`, `borderRadius 16`, `fadeIn/fadeUp`). Grund (Rule 7): visuelle Konsistenz mit dem Onboarding ist hier wichtiger als die generische `Modal`-Komponente, und der Wizard-Footer/Step-Stil wird ohnehin als Vorlage gebraucht. `SectionHeader`/`Divider`/`abtn`/`btn` aus dem Design-System werden im Body wiederverwendet. **Außerdem: den neuen `useDialog`-Hook (`src/lib/hooks.ts`, Phase 4) für Escape/Fokus-Trap/Body-Lock nutzen.**

Begrüßung im Body (nicht als `Modal`-`title`), weil mehrzeilig (Gruß + Datum + KW). Tageszeit-Gruß wie StepWelcome (OnboardingWizard Z.28-30).

### 4.2 ASCII-Mockup — Azubi

```
┌──────────────────────────────────────────────────────────────┐
│                                                            ×   │
│                                                               │
│   👋  Guten Morgen, Tobias!                                    │  fontSize 22, fw800, C.br
│       Sonntag, 7. Juni · KW 23                                 │  fontSize 12, C.mu, KW mono
│   ─────────────────────────────────────────────────────────  │
│   DEINE LAGE                                                   │  SectionHeader size="md"
│                                                               │
│   ┃ ⚠  ÜBERFÄLLIG                                              │  borderLeft 3px C.cr, bg C.crd
│   ┃ 2 Aufgaben überfällig                                      │  fw800 C.cr
│   ┃ Älteste: „Doku API-Endpoint" · 4 Tage              →      │  fontSize 11 C.mu
│                                                               │
│   ┃ 📅 DIESE WOCHE                                            │  borderLeft 3px #f78166
│   ┃ Berichtsheft KW 23 noch offen                             │  (Hero-„heute fällig"-Orange)
│                                                               │
│   ┃ ✓  ERLEDIGT                                               │  borderLeft 3px C.gr, bg C.gr+'08'
│   ┃ Bericht KW 22 wurde unterschrieben 🎉                     │
│   ─────────────────────────────────────────────────────────  │
│                      [ Schließen ]  [ Berichtsheft öffnen → ] │  btn / abtn
└──────────────────────────────────────────────────────────────┘
        width ~540px, zentriert, zIndex 9000
```

Leerzustand (Azubi, alles erledigt):
```
│   👋  Guten Abend, Tobias!     Mittwoch, 7. Juni · KW 23      │
│   ─────────────────────────────────────────────────────────  │
│                          ✓                                     │  fontSize 28, C.gr
│                   Alles im grünen Bereich!                     │  fw700 C.gr
│        Keine offenen Aufgaben, dein Bericht ist abgegeben.     │  C.mu
│   ─────────────────────────────────────────────────────────  │
│                          [ Schließen ]  [ Zum Dashboard → ]    │
```

### 4.3 ASCII-Mockup — Ausbilder

```
┌──────────────────────────────────────────────────────────────┐
│                                                            ×   │
│   👋  Guten Morgen, Frau Berg!  Sonntag, 7. Juni · KW 23      │
│   ─────────────────────────────────────────────────────────  │
│   ZU TUN                                                       │
│                                                               │
│   ┃ ⚠  AUFMERKSAMKEIT                                         │  C.cr
│   ┃ 1 Azubi braucht Aufmerksamkeit                            │
│   ┃ Tobias K. · 3 Aufgaben überfällig                  →      │
│                                                               │
│   ┃ 📋 PRÜFUNG OFFEN                                          │  C.ac / C.acd
│   ┃ 5 Berichtshefte warten auf Prüfung                        │
│   ┃ Neueste: Tobias K. · KW 23                          →     │
│                                                               │
│   ┃ 🎯 LERNZIELE                                              │  #f78166
│   ┃ 3 Lernziele von Azubis als „gelernt" markiert            │
│   ┃ → bestätigen                                       →      │
│   ─────────────────────────────────────────────────────────  │
│                          [ Schließen ]  [ Berichte prüfen → ] │
└──────────────────────────────────────────────────────────────┘
```
(Mentor: identisches Gerüst, Lernziel-Karte ohne „→ bestätigen"-Pfeil, CTA neutral „Zum Dashboard →".)

### 4.4 Komponenten

**Wiederverwenden (bestehend):**
- `src/features/onboarding/OnboardingWizard.tsx` — Portal-/Overlay-Hülle, Step-/Footer-Stil, Tageszeit-Gruß (Z.28-30) als Strukturvorlage.
- `src/features/dashboard/widgets/HeroTask.tsx` (Z.27-65) — Card-Pattern (Severity-Accent `isOverdue→C.cr / active→C.ac / sonst #f78166`, `accent+'40'`-Border, `accent+'10'`-Deko-Kreis) + Leerzustand-Ton.
- `src/components/UI.tsx` — `SectionHeader size="md"`, `Divider`; CSS-Klassen `abtn`/`btn`.
- `src/lib/hooks.ts` — `useDialog` (Escape/Fokus-Trap/Body-Lock, Phase 4).
- `src/lib/utils.ts` — `C`, `fmtDate`, `getISOWeek`, `today`, `fmtLocalDate`.
- `src/lib/roles.js` — `isMentor()`, `isAusbilder()`.

**Neu (Pfade):**
1. `src/features/onboarding/WelcomeNews.tsx` — Modal (lazy, analog OnboardingWizard). Props: `data`, `currentUser`, `onClose`, `navigate`. Rollen-Switch intern.
2. `src/features/onboarding/NewsCard.tsx` — eine farbcodierte aggregierte Karte (Severity-Accent, Icon, Titel, Sub, optionaler `→`-Klick). Extrahiert das HeroTask-Card-Pattern.
3. **Geteilter Aggregations-Hook** — siehe §6 (kritisch gegen Drift).
4. `greetingByHour()` — kleiner Gruß-Helfer, lebt im Hook-Modul oder `utils.ts`.

Ablage in `features/onboarding/`, weil eng mit Wizard verzahnt (gemeinsame News-Vorschau, §5).

---

## 5. Onboarding-Ausbau

Aus dem heutigen 3-Schritt-Info-Wizard (`StepWelcome`/`StepFeatures`/`StepQuickstart`, fixes `steps[]`-Array Z.161-165) wird ein rollenspezifischer Aktivierungs-Flow. Einzige strukturelle Änderung am Gerüst: `steps[]` wird rollenabhängig gefüllt; alles andere sind neue Step-Komponenten (Rule 2).

### Azubi-Flow (5 Schritte)
1. **Willkommen** — bestehend `StepWelcome`, unverändert.
2. **NEU: Profil vervollständigen** — Inline-Form auf bestehende User-Felder `profession`, `apprenticeship_year` (Dropdown 1.–4. Lehrjahr), optional `avatar_url`/`phone` (schemas.ts User). „Überspringen" erlaubt. Nutzen: füttert Lernpfad-/Trainingsplan-Jahr.
3. **NEU: Gruppe beitreten** — Code-Eingabe (6-stellig), Validierung gegen `data.groups[].code`. Trefferanzeige „Du gehörst zu: <Name>". Kein Code → emptyAccount-Hinweis „Dein Ausbilder gibt dir einen Code — geht auch später." ⚠️ Siehe Risiko §6/Q4: Self-Join-Schreiblogik existiert evtl. noch nicht.
4. **Feature-Tour (gekürzt)** — `StepFeatures`, eingedampft auf Berichte/Lernportal/Kalender.
5. **NEU: „Dein Wochenstart"** — rendert die Azubi-News (geteilter Hook, §6) als Vorschau; End-CTA bleibt „+ Erster Bericht" (`onFirstReport`, bereits durchgereicht Z.156). Mini-Hinweis: „Dieses Fenster siehst du ab jetzt bei jedem Login."

### Ausbilder-Flow (5 Schritte)
1. **Willkommen** — bestehend.
2. **NEU: Erste Gruppe anlegen + Code teilen** — Name + Typ → 6-stelliger Code, prominent mit „Kopieren". ⚠️ `genGroupCode` ist aktuell **module-private** in `GroupsView.tsx` (Z.16) → muss exportiert/in `utils.ts` gehoben werden, um im Wizard wiederverwendbar zu sein (sonst Duplikat, Rule 7).
3. **NEU: Ersten Azubi anlegen/einladen** — „Manuell anlegen" ODER „Per Code einladen". „Später" erlaubt. ⚠️ Create-Flow-Existenz prüfen (Q4).
4. **Feature-Tour (gekürzt)** — Projekte/Berichte prüfen/Lernpfade.
5. **NEU: „Dein Überblick"** — Ausbilder-News-Vorschau (geteilter Hook), End-CTA „+ Erstes Projekt" (`onNewProject`). Gleicher „ab jetzt"-Hinweis.

**Mentor:** Ausbilder-Flow OHNE Setup-Schritte 2/3 (read-only) → nur Willkommen, Feature-Tour, News-Vorschau.

### Übergang Wizard → News-Fenster
Der letzte Wizard-Schritt rendert **dieselbe Komponente** (`NewsCard`-Liste) wie das spätere Login-Fenster, gespeist aus demselben Hook → kein visueller Bruch, Erwartungs-Management durch den expliziten „ab jetzt"-Hinweis. In der First-Login-Session erscheint danach KEIN separates News-Fenster (Wizard hat Vorrang, §2.2).

---

## 6. Umsetzungs-Plan (Phasen)

**Phase 0 — Hook extrahieren (Fundament, blockt alles)**
`useNotifications` (App.tsx Z.241-326) ist privat. Für News-Fenster + Wizard-Vorschau muss die Aggregation geteilt werden, sonst Drift (Rule 7). → Verschieben nach `src/features/notifications/useNotifications.ts`, exportieren, NotificationBell weiter daran hängen. Surgical: nur verschieben + exportieren.
Aufwand: klein. Risiko: niedrig (reines Move). Abhängigkeit: App.tsx-Imports.

**Phase 1 — News-Fenster MVP (Kern der Aufgabe)**
- `handleLogin`-Marker (§2.1) + neuer News-Effect neben dem Onboarding-Effect (Z.1283) + `closeNews`-Callback + Render-Block nach dem Onboarding-Block (Z.1660), gegated `&& !showOnboarding`.
- `WelcomeNews.tsx` + `NewsCard.tsx` mit den **bestehenden** Item-Typen aus Phase 0 (Tasks, Projektdeadlines, Reports), aggregiert + Leerzustand.
Aufwand: mittel. Risiko: mittel (Trigger-Timing, `data`-Race Edge-Case 8). Abhängigkeit: Phase 0.

**Phase 2 — Neue Item-Typen**
Im geteilten Memo ergänzen (profitiert auch die Glocke): Berichtsheft-offen (Azubi), Lernziele learned/confirmed, Prüfungs-Countdown, kritische Azubis, Azubis-ohne-Bericht, Projekte-rot, Gruppen-Deadlines (§3.4). Delta-Logik für „bestätigt"-Items braucht „zuletzt gesehene Anzahl" im localStorage (Q3).
Aufwand: mittel-groß. Risiko: mittel (Delta-State). Abhängigkeit: Phase 1.

**Phase 3 — Onboarding-Ausbau**
`steps[]` rollenabhängig; neue Step-Komponenten; `genGroupCode` exportieren; Wizard-Schritt 5 = `NewsCard`-Vorschau.
Aufwand: groß. Risiko: mittel-hoch (Self-Join + Azubi-Create evtl. nicht vorhanden, Q4). Abhängigkeit: Phase 0 (Hook) + Klärung Q4.

Empfohlene Reihenfolge: 0 → 1 → 2 → 3. Phasen 1+2 liefern bereits die Kern-Aufgabe; Phase 3 ist additiv.

---

## 7. Offene Fragen für den User

1. **Cadence:** 1× pro Tag (Empfehlung) — oder wirklich bei JEDEM Login-Vorgang (auch mehrfach täglich)? Wörtlich genommen heißt „jeder Login" Letzteres.
2. **Leerzustand zeigen?** Soll das Fenster auch erscheinen, wenn 0 Items vorliegen (freundliches „Alles gut", Empfehlung) — oder dann gar nicht aufpoppen?
3. **Delta-Persistenz:** Für „X Lernziele bestätigt 🎉" braucht es eine „zuletzt gesehene Anzahl" pro User im localStorage, sonst Dauer-Anzeige. OK so?
4. **Onboarding-Setup-Schritte (Phase 3):** Existiert bereits (a) ein Azubi-Self-Join-per-Code (schreibt Gruppen-Mitgliedschaft) und (b) ein Ausbilder-„Azubi anlegen"-Flow? Falls nein, vorher bauen oder die Schritte abspecken?
5. **Manuelles Wiederöffnen:** Soll das News-Fenster per Menü-/Profil-Event erneut öffenbar sein (analog `azubiboard:show-onboarding`), z.B. `azubiboard:show-welcome`?
