# DESIGN-VISION — „Die digitale Werkbank"

> Status: **PLANUNG** (2026-06-10). Keine Umsetzung ohne Freigabe; jede Phase branch-only, Merge erst nach Browser-Review.
> Ersetzt nicht UX-ROADMAP.md (abgeschlossen, Bedienbarkeit) — das hier ist die **ästhetische** Gesamtvision, auf allen Ebenen.

---

## Ebene 0 — Art Direction: Warum „Werkbank"?

**Ist-Zustand:** GitHub-Dark-Palette + Apple-Blau + `system-ui` = kompetent, aber gesichtslos. Nichts an der App sagt „Ausbildung", nichts bleibt hängen.

**Konzept: Die digitale Werkbank / das technische Büro.**
AzubiBoard verwaltet eine Ausbildung: Berichtshefte mit Stempeln, Prüfungen, Lehrjahre, IHK-Formalien, Projektpläne. Die Bildsprache dafür existiert seit 100 Jahren — **technische Zeichnung, Blaupause, Laufkarte, Prüfstempel, Messwerkzeug** — und kein anderes Tool nutzt sie. Das ist unsere Lücke.

- **Ton:** Präzise + industriell, mit Wärme. Kein kaltes Dev-Tool, keine verspielte Lern-App — eine Werkstatt, in der man stolz auf saubere Arbeit ist.
- **Das eine unvergessliche Ding:** **Der Stempel.** Berichtsstatus, bestätigte Lernziele, erledigte Meilensteine bekommen physisch anmutende Prüfstempel mit Stempel-Animation. Wer einmal „GEPRÜFT" auf seinen Wochenbericht geknallt bekommen hat, vergisst die App nicht.
- **Leitmetapher pro Bereich:** Berichte = Laufkarte/Formular · Projekte/Netzplan = Blaupause · Dashboard = Instrumententafel · Kalender = Plantafel · Lernbereich = Karteikasten.

---

## Ebene 1 — Foundations

### 1.1 Typografie (größter Einzelhebel)
| Rolle | Font | Einsatz |
|---|---|---|
| Display | **Chakra Petch** (700/600) | Seitentitel, Widget-Header, große Zahlen, Logo |
| Body | **Archivo** (variable) | Fließtext, Formulare, Listen — schmale Breiten für dichte Tabellen |
| Mono/Daten | **JetBrains Mono** (bereits referenziert, jetzt wirklich laden) | KW, IDs, Datumsangaben, Zeiterfassung, Stempel-Beschriftung |

- Self-hosted via `@fontsource` (PWA-offline, CSP bleibt ohne Google-CDN). Nur benötigte Schnitte: ~80–120 KB woff2, im Workbox-Precache.
- Typo-Skala definieren (12/13/15/18/22/28/40) statt der heutigen ~15 Streuwerte; große Ziffern (Countdown, Stats) in Chakra Petch mit `font-feature-settings: 'tnum'`.

### 1.2 Farbe
Raus aus Blau-auf-Blaugrau. Neues System (alle als `--c-*` Tokens, Alpha-Varianten via `color-mix` statt Hex+'44'-Arithmetik):

| Token | Dark (Default) | Idee |
|---|---|---|
| `--c-bg` | `#0B0F0E` (tiefes Petrol-Schwarz, minimal grünstichig) | Werkstatt bei Nacht |
| `--c-sf*` | gestufte Petrol-Graphit-Flächen | Stahlblech |
| `--c-ac` | **Signal-Orange `#FF6A1A`** | Sicherheitsfarbe der Werkstatt — Aktionen, aktive Zustände |
| `--c-ac2` | Cyan `#3FD2C7` | Daten-/Info-Akzent (Links, Sync, Mono-Daten) |
| Status | Grün/Rot/Amber behalten, auf neue Palette gestimmt | Semantik unverändert |
| Stempel | Tiefrot `#C2362B` + Blau `#2C5E9E` | klassische Stempelfarben |

**Light-Mode = „Papier":** warmes Papierweiß `#F6F3EC`, Tinte `#1A2B3C`, Blaupausen-Linien hellblau — kein invertiertes Dark, sondern eigener Charakter (Zeichenbrett am Tag).

### 1.3 Textur & Tiefe (heute: null Atmosphäre)
- **Blueprint-Raster** als Body-Hintergrund: feines mm-Raster (CSS `repeating-linear-gradient`, ~3 % Opazität), alle 5 Einheiten stärkere Linie. Kostet nichts, trägt alles.
- Dezentes **Noise-Grain-Overlay** (eine 64px-PNG/SVG-Kachel, `opacity .03`) gegen die sterile Flatness.
- Schatten-Skala (3 Stufen) + 1px-Innenkante (`inset 0 1px 0 rgba(255,255,255,.04)`) für „gestanztes Blech"-Gefühl auf Karten.
- Radius-Skala: 4/8/12 — Karten eher kantiger (Werkstück), Dialoge weicher.

### 1.4 Ikonografie & Grafik
- Icons.tsx vereinheitlichen: ein Strichgewicht (1.75), runde Kappen, „technisches" Set ergänzen (Stempel, Messschieber, Laufkarte, Zahnrad).
- Leerzustände: kleine **Blueprint-Doodles** (SVG-Strichzeichnungen mit gestrichelten Maßlinien) statt Emoji-Großbuchstaben.
- Avatare: Hue-Rotation behalten, aber als „Werksausweis"-Optik (eckig mit Lochung) im Profil.

---

## Ebene 2 — Motion-System (CSS-first, kein neues Framework)

Prinzip: **ein orchestrierter Moment pro Screen** statt überall Gewackel. Alles hinter `prefers-reduced-motion`.

1. **Seiten-Einstieg:** gestaffeltes Aufbauen (Widgets 40ms-Stagger, `fadeUp` existiert schon — systematisieren statt Einzelfälle).
2. **Stempel-Animation:** Skalierung 1.4→1 + 2° Rotation + kurzes „Aufschlagen" (90ms, `cubic-bezier(.2,1.4,.4,1)`) + Tintenrand. Eine Keyframe-Klasse, überall nutzbar.
3. **Zahlen zählen hoch** (Dashboard-Stats, Countdown) — kleines `useCountUp`, nur beim ersten Sichtbarwerden.
4. **Kanban-Drag:** Karte kippt 2–3°, Drop-Ziel zeigt gestrichelte Schablonen-Outline; „done" triggert Mini-Stempel.
5. **Focus-visible als Messlehre:** vier Eck-Klammern (`::before/::after`-Brackets) statt Standard-Ring — a11y-konform und absolut eigen.
6. Skeleton-Loading als **Schraffur** (diagonale Linien wandern), passend zur Zeichnungs-Metapher.

---

## Ebene 3 — Komponenten (UI.tsx-Primitive zuerst, dann erbt alles)

| Primitive | Redesign |
|---|---|
| Card | Blech-Optik (Innenkante, Schatten Stufe 1), Header in Chakra Petch, optionale „Laufkarten"-Lochkante links |
| Button `abtn` | Signal-Orange, satte Press-States (translateY 1px), Werkzeug-Feeling |
| StatusBadge | → **Stempel-Variante** für reviewed/signed/confirmed; normale Pills für Rest |
| Modal/Dialog | Kopfzeile als Zeichnungs-Schriftfeld (Titel + KW/Datum in Mono rechts) |
| Toast | „Etikett"-Stil, Akzentkante links, Erfolg mit Mini-Stempel-Icon |
| Tabs | Registerkarten-Metapher (physische Karteireiter, aktive Lasche hebt sich) |
| Inputs | ruhige Felder, Fokus = Messlehre-Brackets, Labels in Mono-Caps |
| Tabellen/Listen | Zeilen-Hover mit Raster-Hervorhebung, Zahlen rechtsbündig tnum |
| SectionHeader | Maßlinien-Dekor (kurze Linie + Punkt) vor dem Label |

---

## Ebene 4 — Screens (jede Route bekommt ihren Moment)

- **Login/AuthPage:** Der erste Eindruck. Blueprint-Raster, Logo wird als technische Zeichnung „konstruiert" (SVG stroke-dashoffset, einmalig ~1.2s), Formular als Schriftfeld einer Zeichnung. Demo-Buttons als Werksausweise.
- **Dashboard:** Instrumententafel — HeroTask als großes Anzeigeinstrument, Stats mit CountUp, WeekProgress als Füllstandsanzeige. Begrüßung in Display-Font.
- **Berichte:** Editor als **Formular/Laufkarte** (nummerierte Abschnitte 01/02/03 in Mono), Statuswechsel = Stempel-Animation. Druck bleibt formal (IHK), Jahresmappe bekommt Deckblatt mit Stempelfeld.
- **Projekte/Kanban:** Spaltenköpfe als Plantafel-Schilder, Karten mit Lochkante, Drag-Physik (Ebene 2.4).
- **Netzplan/Gantt:** der Blueprint-Hero — Knoten als Bauteil-Boxen mit Schriftfeld, Kanten mit Maßpfeilen, Hintergrund-Raster stärker, optional Fadenkreuz-Cursor.
- **Kalender:** Plantafel; KW-Spaltenkopf als **Split-Flap/Fallblatt-Anzeige** (CSS 3D-Flip beim Wochenwechsel), heute-Spalte mit Signal-Orange-Reiter.
- **Trainingsplan:** Lernziel bestätigt = Stempel + dezente Konfetti-Partikel (CSS, einmalig); Prüfungs-Countdown als **Flipclock**.
- **Lernbereich:** Karteikarten endlich wörtlich: 3D-Flip-Karten im Karteikasten, SM-2-Fächer sichtbar als Kastenfächer.
- **Welcome-News:** „Tagesbriefing" als Auftragszettel — perforierte Abrisskante oben, Datum/KW gestempelt, Karten staggern rein.
- **Ctrl+K-Suche:** Kommandopult — Mono-Font, Eingabe-Cursor als Block, Treffer-Kategorien als Registerreiter.
- **GlobalSearch/Shortcuts/Trash/Users/Groups:** erben Primitives, je 1 kleiner Charakterzug (z. B. Papierkorb = Schredder-Streifen-Animation beim Wiederherstellen-Hover).

---

## Ebene 5 — Signature-Momente (das „insane"-Budget, bewusst dosiert)

1. **Stempel-System** (überall, Kern-Identität)
2. **Logo-Konstruktions-Animation** beim Login
3. **Split-Flap-KW** im Kalender + Flipclock-Countdown
4. **Messlehre-Focus** (jede Tastatur-Interaktion fühlt sich gefertigt an)
5. **Lernziel-Zelebration** (Stempel + Partikel — der Dopamin-Moment für Azubis)
6. Theme-Übergang Dark↔Light als kurzer „Lichtschalter"-Sweep (View Transitions API, progressive enhancement)

Nicht mehr als diese sechs. Maximalismus in der Idee, Präzision in der Dosis.

---

## Ebene 6 — Querschnitt

- **a11y:** Kontraste der neuen Palette gegen WCAG AA prüfen (Signal-Orange auf Dunkel: für Text ≥15px ok, sonst `--c-ac-text`-Variante); Motion komplett hinter `prefers-reduced-motion`; Fokus-Brackets ≥3:1.
- **Performance-Budget:** JS-Bundle bleibt ≤170 KB gz (Motion = CSS, CountUp/Konfetti selbst geschrieben, **kein** framer-motion); Fonts ≤120 KB; Lighthouse-Gates (a11y/bp/seo = error) müssen grün bleiben.
- **PWA/Meta:** neues Icon-Set (Stempel/Werkbank-Monogramm), maskable Icons, `theme-color` je Theme, Splash konsistent, Favicon SVG.
- **Print:** unangetastet formal (IHK), nur Jahresmappen-Deckblatt neu.
- **i18n:** alle neuen sichtbaren Strings über i18n (227-Key-System).

---

## Umsetzungsplan (jede Phase eigener Branch, Gates: typecheck/lint/Vitest/Build + Browser-Review)

| Phase | Inhalt | Aufwand | Risiko |
|---|---|---|---|
| **D1 Foundations** | Fonts laden, Token-Palette umstellen, Raster+Noise, Typo-/Schatten-Skala, Light-„Papier" | M | Hoch-sichtbar, aber zentral: 1 CSS-Datei + utils-`C` (38 Dateien lesen `C.*` → Tokens existieren schon aus UX-Phase 1; Rest-Hex `C.gr+'45'`-Arithmetik auf `color-mix` migrieren) |
| **D2 Primitives** | UI.tsx-Komponenten, Fokus-Brackets, Stempel-Komponente + Animation | M | gering — zentrale Dateien |
| **D3 Screens A** | Login, Dashboard, Welcome-News, Berichte (inkl. Stempel-Integration) | L | mittel |
| **D4 Screens B** | Kalender (Split-Flap), Kanban, Netzplan-Blueprint, Trainingsplan (Flipclock/Zelebration) | L | mittel |
| **D5 Screens C + Polish** | Lernbereich-Flip-Karten, Suche, Restscreens, Leerzustand-Doodles, Icons | M | gering |
| **D6 Querschnitt** | PWA-Icons, Theme-Sweep, a11y-/Kontrast-Audit, Lighthouse, Doku | S | gering |

**Empfohlener Einstieg: D1 + D2 zusammen auf einem Branch** — damit steht das komplette Fundament und JEDER Screen sieht sofort anders aus, bevor wir einzelne Screens veredeln.

### Offene Entscheide (vor D1 mit User klären)
1. Signal-Orange als Hauptakzent ok — oder lieber Amber/Cyan-Variante? (3 Token-Sets als Screenshot-Vergleich in D1 lieferbar)
2. Display-Font Chakra Petch ok — Alternativen: Saira SemiCondensed (DIN-näher, ruhiger) / Rajdhani (techy-leichter)
3. Grain/Noise ja/nein (Geschmackssache, 5-Minuten-Toggle)
4. Sound-Effekte (Stempel-Klack, opt-in, default aus) — überhaupt gewollt?
