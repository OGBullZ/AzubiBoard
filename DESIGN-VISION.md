# DESIGN-VISION — „Die digitale Werkbank"

> Status: **PLANUNG v2** (2026-06-10, vertieft). Keine Umsetzung ohne Freigabe; jede Phase branch-only, Merge erst nach Browser-Review.
> Ersetzt nicht UX-ROADMAP.md (abgeschlossen, Bedienbarkeit) — das hier ist die **ästhetische** Gesamtvision, auf allen Ebenen.

---

## Ebene 0 — Art Direction: Warum „Werkbank"?

**Ist-Zustand:** GitHub-Dark-Palette + Apple-Blau + `system-ui` = kompetent, aber gesichtslos. Nichts an der App sagt „Ausbildung", nichts bleibt hängen.

**Konzept: Die digitale Werkbank / das technische Büro.**
AzubiBoard verwaltet eine Ausbildung: Berichtshefte mit Stempeln, Prüfungen, Lehrjahre, IHK-Formalien, Projektpläne. Die Bildsprache dafür existiert seit 100 Jahren — **technische Zeichnung, Blaupause, Laufkarte, Prüfstempel, Messwerkzeug** — und kein anderes Tool nutzt sie.

- **Ton:** Präzise + industriell, mit Wärme. Eine Werkstatt, in der man stolz auf saubere Arbeit ist.
- **Das eine unvergessliche Ding:** **Der Stempel.**
- **Leitmetapher pro Bereich:** Berichte = Laufkarte · Projekte/Netzplan = Blaupause · Dashboard = Instrumententafel · Kalender = Plantafel · Lernbereich = Karteikasten · Nutzer/Gruppen = Werksausweise · Papierkorb = Schredder · Audit = Maschinenbuch.

**Drei Gestaltungsgesetze** (gegen Beliebigkeit, jede Design-Entscheidung muss eines erfüllen):
1. **Gefertigt, nicht gerendert** — Dinge haben Kanten, Material, Gewicht (Innenkanten, Stanzungen, Stempeldruck).
2. **Beschriftet wie eine Zeichnung** — Meta-Informationen (KW, Datum, IDs, Maße) immer in Mono-Caps, wie Schriftfelder auf Plänen.
3. **Ein Moment pro Screen** — Motion wird budgetiert wie Geld. Lieber ein perfekter Stempel als zehn Hover-Wackler.

---

## Ebene 1 — Foundations

### 1.1 Typografie
| Rolle | Font | Schnitte | Einsatz |
|---|---|---|---|
| Display | **Chakra Petch** | 600, 700 | Seitentitel, Widget-Header, große Zahlen, Logo, Stempeltext |
| Body | **Archivo** (variable) | 400–700, width-axis | Fließtext, Formulare, Listen |
| Mono | **JetBrains Mono** | 400, 700 | KW/Daten/IDs, Schriftfelder, Code, Terminal |

- Self-hosted via `@fontsource` (PWA-offline, CSP ohne Google-CDN). Subset latin + latin-ext, gesamt ≤120 KB woff2, Workbox-Precache, `font-display: swap` mit `size-adjust`-Fallback-Metriken gegen Layout-Shift.
- **Typo-Skala** (ersetzt ~15 Streuwerte): `--fs-0: 11px` (Mono-Labels) · `--fs-1: 12.5` · `--fs-2: 14` (Body-Default, hoch von 13) · `--fs-3: 16` · `--fs-4: 19` · `--fs-5: 24` · `--fs-6: 32` · `--fs-7: 44` (Hero-Zahlen). Zeilenhöhe 1.55 Body / 1.15 Display.
- Ziffern: `font-feature-settings: 'tnum' 1` überall wo Zahlen untereinander stehen (Stats, Tabellen, Zeiterfassung, Countdown).
- **Mono-Caps-Label** als festes Stilmittel: `font: 700 11px JetBrains Mono; letter-spacing: .14em; text-transform: uppercase; color: var(--c-mu)` — ersetzt die ~80 uneinheitlichen Inline-Uppercase-Labels (SectionHeader-Konsolidierung aus UX-Phase 1 wird hier vollendet).

### 1.2 Farbe — Token-Architektur
Zweischichtig: **Primitives** (rohe Skalen) → **Semantik** (was Komponenten benutzen). Komponenten greifen NIE auf Primitives zu.

```css
/* Primitives (Auszug) */
--petrol-950:#0B0F0E; --petrol-900:#101614; --petrol-850:#151C1A; --petrol-800:#1A2320;
--ink-100:#EDEAE2;    --paper:#F6F3EC;
--orange-500:#FF6A1A; --orange-600:#E55708; --orange-100:#FFD9C2;
--cyan-400:#3FD2C7;   --stamp-red:#C2362B;  --stamp-blue:#2C5E9E;
--green-500:#37C871;  --red-500:#F45B4E;    --amber-500:#FFB224;

/* Semantik (Dark) */
--c-bg: var(--petrol-950);        --c-sf: var(--petrol-900);     /* usw. */
--c-ac: var(--orange-500);        --c-ac-press: var(--orange-600);
--c-ac-text: #FFB78A;             /* Orange ist als Text auf Dunkel zu schwach → eigene Text-Variante, AA-geprüft */
--c-data: var(--cyan-400);        /* Links, Sync, Mono-Daten */
--c-grid: color-mix(in srgb, var(--cyan-400) 4%, transparent);   /* Blueprint-Raster */
```

- **Alle Alpha-Varianten via `color-mix`** — die letzten `C.gr+'45'`-Hex-Arithmetiken sterben; `C` in utils.ts wird zur reinen `var()`-Brücke (Token-Namen 1:1 behalten → 38 Dateien kompilieren unverändert).
- **60/30/10-Regel:** 60 % Flächen (Petrol), 30 % Text/Struktur, 10 % Akzent. Orange ist Belohnung, nicht Tapete — pro Screen max. 3 orange Elemente (primäre Aktion, aktiver Zustand, 1 Akzentdetail).
- Status-Farben semantisch unverändert (grün/rot/amber), aber auf Petrol gestimmt + je eine `-bg`- und `-text`-Stufe (kein Raten mehr mit rgba).

### 1.3 Licht-Modus = „Papier" (eigener Charakter, kein invertiertes Dark)
- Hintergrund Papierweiß `#F6F3EC` mit **Millimeterpapier-Raster in Blaupausen-Blau** (klassisch!), Flächen reines Weiß mit harten 1px-Tintenlinien `#1A2B3C`.
- Schatten fast weg → stattdessen Linienstärke-Hierarchie (Zeichnungs-Logik: dick = wichtig).
- Akzent bleibt Signal-Orange (funktioniert auf Papier hervorragend), Stempel kräftiger (rot/blau wie echte Stempelfarbe auf Papier).
- Theme-Wechsel = Metapher-Wechsel: **nachts Werkstatt, tags Zeichenbrett.**

### 1.4 Textur, Tiefe, Material
- ~~Blueprint-Raster als Body-Hintergrund~~ — **GESTRICHEN (User-Entscheid 2026-06-10): Hintergrund bleibt solid.** Das Raster lebt nur noch LOKAL weiter: Netzplan-Canvas (D4) und optional Login-Bühne — als Werkzeug-Fläche, nicht als Tapete. `--c-grid`-Tokens bleiben dafür definiert.
- **Grain:** 64px-SVG-Noise-Kachel (`feTurbulence`, inline data-URI), fixed Overlay `opacity:.035; pointer-events:none; mix-blend-mode:overlay`. Toggle-bar über ein einziges `data-grain`-Attribut.
- **Material-Rezept Karte** („gestanztes Blech"): `box-shadow: 0 1px 0 rgba(255,255,255,.05) inset, 0 6px 16px -8px rgba(0,0,0,.5); border: 1px solid var(--c-bd)`.
- Schatten-Skala: `--sh-1` (Karte) / `--sh-2` (Popover) / `--sh-3` (Modal, mit 2px Akzent-Glow-Anteil).
- Radius-Skala: `--r-1: 4px` (Inputs, Tags) / `--r-2: 8px` (Karten) / `--r-3: 14px` (Dialoge). Karten kantiger = Werkstück.
- **Perforations-Kante** (Laufkarten/Welcome-News): `mask-image: radial-gradient(...)`-Punktreihe — physische Abrisskante ohne Bild-Asset.

### 1.5 Ikonografie & Illustration
- Icons.tsx: ein Strichgewicht 1.75, runde Kappen; neue Icons: Stempel, Messschieber, Laufkarte, Schraubstock, Karteikasten, Plantafel-Magnet, Lochzange.
- **Blueprint-Doodles** für Leerzustände: SVG-Strichzeichnungen mit gestrichelten Maßlinien + Maßpfeilen + handschriftlicher Annotation (z. B. leeres Kanban: gezeichnete Kiste, Maßpfeil „hier entsteht dein erstes Projekt"). 6–8 Stück, je <2 KB inline.
- Logo-Idee: „AB"-Monogramm als Zirkelschlag + Winkellineal konstruiert; Konstruktionslinien bleiben im Logo dezent sichtbar (Konzept „gefertigt, nicht gerendert").
- Avatare: „Werksausweis"-Optik im Profil/UsersView — eckige Karte, Lochung oben, Name in Mono, Rolle als Farbstreifen (Azubi orange / Mentor cyan / Ausbilder grün).

### 1.6 Räumliche Komposition
- **Schriftfeld-Prinzip:** Jede „Dokument-artige" Fläche (Bericht, Projekt-Detail, Druck-Deckblatt) bekommt unten rechts ein technisches Schriftfeld (Tabelle: Erstellt / Geprüft / KW / Version) — echtes Zeichnungs-Layout.
- Asymmetrie erlaubt: Dashboard-Hero darf 2 Spalten brechen; Seitentitel dürfen mit Maßlinie nach links aus dem Content-Raster „herausgezogen" werden.
- Dichte: PC-only → wir dürfen dicht sein. Listen 36px-Zeilen, aber großzügige Sektion-Abstände (32/48) — Spannung aus Kontrast dicht/leer.

---

## Ebene 2 — Motion-System

Token: `--ease-stamp: cubic-bezier(.2,1.4,.4,1)` · `--ease-out: cubic-bezier(.16,1,.3,1)` · Dauern 90/180/320/600ms. Alles in einer `motion.css`, alles hinter `@media (prefers-reduced-motion: no-preference)`.

1. **Stempel** (`.stamp-in`): scale 1.45→.98→1, rotate -2.5°, 280ms `--ease-stamp`; beim Aufschlag 1 Frame `filter: blur(.4px)` + Tinten-Ring (`::after` mit radialem Gradient, fade 600ms). Ein dezenter Versatz/Rotation pro Instanz via `--stamp-seed` (deterministisch aus ID gehasht — kein Math.random im Render) → jeder Stempel sitzt minimal anders, wie echt.
2. **Seiten-Einstieg:** Container-Klasse `.draft-in` — Kinder staggern mit `animation-delay: calc(var(--i) * 40ms)`, fadeUp 12px. Einheitlich statt der heutigen Einzel-`anim`.
3. **CountUp:** `useCountUp(target, 600ms, easeOut)` — nur beim ersten IntersectionObserver-Sichtbarwerden, tnum verhindert Zappeln.
4. **Kanban-Physik:** Drag = rotate 2.5° + Schatten Stufe 2 + cursor grabbing; Drop-Slot = gestrichelte Schablonen-Outline (animierter `stroke-dashoffset`-Lauf, „Ameisen"); Drop in „done" = Mini-Stempel ✓ auf der Karte.
5. **Messlehre-Focus:** `:focus-visible` → vier Eck-Klammern via `clip-path`-Frame oder Doppel-`box-shadow`-Ecken, 2px Orange, snappt mit 90ms. Inputs behalten zusätzlich Unterkante.
6. **Skeleton = Schraffur:** 45°-Linien (`repeating-linear-gradient`), wandern 1.2s linear — Lade-Zustand sieht aus wie „noch nicht ausgefülltes Zeichnungsfeld".
7. **Split-Flap** (KW-Anzeige): zweigeteilte Karte, obere Hälfte klappt mit `rotateX`, 3 Kaskaden-Flaps bei Wochenwechsel, 90ms versetzt + dezenter Klack (nur wenn Sound an).
8. **Zahnrad-Sync:** SyncIndicator-Icon = kleines Zahnrad, dreht bei inflight (rotate steps(8) — mechanisch, nicht smooth), bei Fehler steht es mit rotem Sprenkel still.
9. **Toast-Einfahrt:** von unten mit leichtem Überschwingen, Akzentkante „druckt" sich von links auf (scaleX 0→1).
10. **View-Transition Theme-Switch:** `document.startViewTransition` mit radialem `clip-path`-Sweep vom Schalter aus (progressive enhancement, Fallback = instant).

**Choreografie-Budget je Screen:** 1 Entrance + 1 Signature + Micro-Feedback. Nicht mehr.

---

## Ebene 3 — Komponenten (UI.tsx zuerst, dann erbt alles)

| Primitive | Redesign-Spec |
|---|---|
| **Card** | Blech-Rezept (1.4), Header-Zeile: Mono-Caps-Label links, optional Schriftfeld-Meta rechts; Varianten `card--punched` (Lochkante links, Laufkarte) und `card--blueprint` (Rasterfüllung, für Netzplan/Empty) |
| **Button** | `abtn`: Orange, `translateY(1px)` + dunklere Stufe beim Druck, 90ms; Sekundär: Outline mit Mono-Caps; Gefahr: Stempelrot. Loading-State: Mini-Schraffur-Streifen läuft durch |
| **StatusBadge → Stamp** | Neue `<Stamp status>`-Komponente: doppelter Rahmen (2px außen, 1px innen, 2px Abstand), Chakra Petch caps, leichte Rotation aus `--stamp-seed`, Farbwelt Stempelrot/-blau/-grün; `stamped`-Prop triggert `.stamp-in`. Pills bleiben für neutrale Tags |
| **Modal/Dialog** | Kopf als Zeichnungs-Schriftfeld: Titel links (Display), rechts Mono-Block (Datum · KW · ggf. Entity-ID); Fußleiste mit 1px-Doppellinie; Eintritt: fadeUp + Backdrop-Blur 4px |
| **ConfirmDialog (destruktiv)** | rote Schraffur-Ecke oben links (Gefahrenzettel-Optik), Bestätigen-Button Stempelrot |
| **Toast** | Etikett: linke Akzentkante, Mono-Zeitstempel klein rechts, Erfolg mit Mini-Stempel-Icon, Undo als unterstrichene Mono-Aktion |
| **Tabs** | physische Karteireiter: aktive Lasche 2px höher, verbindet sich nahtlos mit Inhaltsfläche (border-bottom der Fläche unterbricht), inaktive abgedunkelt |
| **Inputs/Select/Textarea** | ruhig: nur Unterkante + Fläche `--c-sf2`; Label = Mono-Caps; Focus = Messlehre; Fehler: Unterkante rot + Mono-Fehlertext; Pflichtfeld-Stern als Zeichnungs-Annotation `(*)` |
| **Tabelle/Liste** | Zeilen-Hover: Hintergrund + linke 2px-Akzentkante; Zahlen rechts/tnum; Kopfzeile Mono-Caps mit Sortier-Dreieck |
| **SectionHeader** | Maßlinien-Dekor: `—•` vor Label, optionale Zähler-Klammer in Mono `[12]` |
| **EmptyState** | Blueprint-Doodle + Annotation + 1 CTA; nie wieder Riesen-Emoji |
| **Avatar** | rund im Fluss, „Werksausweis" in Profil/Users |
| **ProgressBar/WeekProgress** | Füllstandsanzeige: Skalenstriche (alle 20 %), Füllung mit feiner Diagonal-Schraffur statt Flat-Fill |
| **Tooltip** | Mono, dunkler Zettel mit 1px-Kante, Pfeil als Maßpfeil-Spitze |
| **NotificationBell** | Zähler als gestempelte Marke; Panel-Einträge mit Zeitstempel-Spalte in Mono |

---

## Ebene 4 — Screens (jede Route: Metapher · Entrance · Signature · Details)

### Login/AuthPage — „Zutritt zur Werkstatt"
- Volle Blueprint-Bühne: stärkeres Raster, Vignette zu den Ecken.
- **Logo-Konstruktion** (einmalig ~1.2s): SVG-Strokes zeichnen sich via `stroke-dashoffset`, Konstruktionslinien (gestrichelt) erscheinen zuerst und faden auf 20 %.
- Formular = Schriftfeld-Block: Mono-Labels, Messlehre-Focus; Login-Button „Einstempeln".
- Demo-Login-Buttons = drei **Werksausweise** (Karte mit Lochung, Rollen-Farbstreifen, Name in Mono).
- 2FA-Schritt: Code-Input als 6 einzelne Stanzfelder.
- Fehler (falsches Passwort): kurzes mechanisches Ruckeln (translateX ±4px, 3 Zyklen, 200ms) + roter Stempelabdruck „ABGELEHNT" der sofort verblasst (Augenzwinkern, nicht nervig).

### Dashboard — „Instrumententafel"
**→ Eigenes Vertiefungs-Konzept in Anhang D (Zustands-Modell leer → Arbeitsmodus).** Kurzform:
- Begrüßung in Display-Font + Datum/KW als gestempelte Mono-Zeile.
- HeroTask = großes Instrument: links Aufgabe, rechts Restzeit-Anzeige als Halbkreis-Gauge mit Skalenstrichen.
- Stat-Kacheln: CountUp, Mono-Caps-Label, Trend-Pfeil als Maßpfeil; kritische Stat bekommt orangen Eckmarker.
- Widgets staggern (`.draft-in`); WeekProgress = Füllstandsanzeige (Ebene 3).
- Aktivitäts-Feed: Zeitstempel-Spalte Mono, Einträge wie Logbuch-Zeilen mit Lochrand links.

### Berichte — „Laufkarte & Prüfstempel" (emotionales Zentrum)
- Editor als nummeriertes Formular: Abschnitte `01 TÄTIGKEITEN` / `02 LERNINHALTE` / `03 KOMMENTAR` in Mono-Caps mit Maßlinie.
- Statuswechsel = **Stempel-Animation auf dem Dokument**: „EINGEREICHT" (blau) → „GEPRÜFT" (blau) → „UNTERSCHRIEBEN" (rot, mit Unterschriften-Schnörkel-SVG das sich zeichnet). Stempel bleiben als Badges auf der Karte sichtbar, leicht rotiert.
- Berichts-Karte in der Liste = Laufkarte: Lochkante, KW groß in Mono, Status-Stempel rechts oben.
- KW-Navigation als Split-Flap-Mini.
- Jahresmappe-Druck: neues Deckblatt mit großem Schriftfeld + Stempelfeld (Print bleibt sonst IHK-formal).

### Projekte/Kanban — „Plantafel"
- Spaltenköpfe als angeschraubte Schilder (2 Schrauben-Punkte, Mono-Caps, Zähler-Marke).
- Karten mit Magnete-Metapher: kleiner runder „Magnet"-Dot oben mittig in Spaltenfarbe.
- Drag-Physik + Schablonen-Drop (Ebene 2.4); „done"-Drop = Mini-Stempel ✓.
- Projekt-Status-Ampel als echte Signalleuchte (3 gestapelte Punkte, aktiver glüht mit 8px-Glow).

### Netzplan/Gantt — „Die Blaupause" (visueller Hero)
- Canvas-Fläche mit stärkerem Raster + Eckmarken wie Plot-Bögen; optional Fadenkreuz-Cursor (2 Hairlines, folgen der Maus, @10 %).
- Knoten = Bauteil-Boxen: Titel + Mono-Schriftfeld (Dauer/FAZ/SAZ), kritischer Pfad in Signal-Orange mit dickerer Linie.
- Kanten mit Maßpfeil-Spitzen; Abhängigkeit beim Hover hervorgehoben, Rest dimmt auf 40 %.
- Gantt-Balken mit Schraffur-Füllung für „geplant" vs. satter Füllung „erledigt".
- Zoom-Steuerung als Messschieber-Optik.

### Kalender — „Plantafel mit Fallblatt"
- **Split-Flap-KW** im Kopf (Signature); Heute-Spalte mit orangenem Reiter oben + zartem Spalten-Glow.
- Event-Chips nach Typ: deadline = rotes Fähnchen, event = Magnet-Dot, holiday = Schraffur-Hintergrund, untis = Mono-Stundenplan-Optik.
- Monats-/Wochen-Toggle als physischer Schiebeschalter.
- iCal-Export-Button mit Mono-Label `EXPORT .ICS`.

### Trainingsplan — „Prüfungsordner"
- Lernziel-Zeilen mit Fortschritts-Stempelspur: leer → „GELERNT" (Azubi, blau klein) → „BESTÄTIGT" (Ausbilder, rot, mit Stempel-Animation + **Zelebration**: 12 CSS-Partikel in Orange/Cyan, 800ms, einmalig).
- **Prüfungs-Countdown = Flipclock** (Tage), darunter Meilenstein-Maßband (horizontale Skala mit Markern).
- Kategorie-Gruppen als Ordner-Register.

### Lernbereich — „Karteikasten"
- Karteikarten wörtlich: **3D-Flip** (`rotateY`, perspective 1200px), Vorderseite Frage (Display), Rückseite Antwort (Body) mit Karteikarten-Linien-Hintergrund.
- SM-2-Fächer als sichtbarer Kasten: 5 Fächer-Tabs („Fach 1 = täglich" … „Fach 5 = gemeistert"), Karte wandert sichtbar ins nächste Fach (kleine Fluganimation).
- Quiz: Fortschritt als Lochstreifen (gestanzte Punkte füllen sich); richtige Antwort = grüner Mini-Stempel, falsche = roter Korrektur-Strich (handschriftliche Anmutung).
- Lernpfad-DAG erbt Blueprint-Optik vom Netzplan; abgeschlossene Knoten abgestempelt.

### Welcome-News — „Das Tagesbriefing"
- Auftragszettel: Perforations-Kante oben (1.4), Datum/KW als Stempelabdruck schräg rechts oben, Karten staggern.
- Karten-Prioritäten als Marker: kritisch = rotes Fähnchen, info = Magnet-Dot.
- Leerzustand „Alles gut" = Doodle: gezeichneter Kaffeebecher auf Werkbank, Annotation „Keine offenen Posten".

### Ctrl+K — „Kommandopult"
- Vollmono. Eingabezeile mit Block-Cursor (blinkt steps(1)), Prompt-Zeichen `>`.
- Treffer-Gruppen als Registerreiter; Tastatur-Hints als gestanzte Keycaps (`<kbd>` mit 3D-Unterkante).
- Sektion „Befehle" zusätzlich zu Suche (später: `>neuer bericht`, `>thema hell`).

### Users/Groups — „Personalkartei"
- User-Karten = Werksausweise (1.5); Gruppen = Karteikästen mit Reiter; Beitritts-Anfragen als „Eingangskorb"-Tray mit Zähler-Marke.

### Papierkorb — „Schredder"
- Einträge mit feinen vertikalen Schnittlinien-Streifen im Hintergrund; Wiederherstellen-Hover „setzt die Streifen zusammen" (Streifen-Versatz → 0, 200ms). Endgültig löschen = Konfirmations-Dialog mit Schraffur-Ecke.

### Profil/Settings, Audit, Backups, Share
- Profil: großer Werksausweis + Stats; „Tagesübersicht anzeigen"/„Wizard" als Werkzeugleisten-Buttons.
- Audit-Log = Maschinenbuch: Zebra-Zeilen, Mono-Zeitstempel, Typ als kleine Marke.
- BackupsModal: Backup-Einträge als Archiv-Kisten mit Datum-Stempel; Restore mit deutlicher roter Schraffur-Warnung.
- ShareView (öffentlich): bekommt die Papier-Optik (Light), wie ein ausgehändigtes Dokument — Wiedererkennung nach außen.

### ErrorBoundary/404 — „Maschinenschaden"
- Doodle: gezeichnetes Zahnrad mit herausgebrochenem Zahn, Annotation „Hier klemmt's"; Mono-Fehlercode; Button „Neu einrichten" (reload). Charmant statt peinlich.

---

## Ebene 5 — Signature-Momente (das „insane"-Budget)

**Kern-Sechs (Pflicht):**
1. Stempel-System (App-weite Identität)
2. Logo-Konstruktion beim Login
3. Split-Flap-KW + Flipclock-Countdown
4. Messlehre-Focus
5. Lernziel-Zelebration (Stempel + Partikel)
6. Theme-Sweep (View Transitions)

**Erweiterung (nach Geschmack, je klein):**
7. **Onboarding-Abschluss:** „Werkstatt eingerichtet"-Moment — Wizard endet mit großem Stempel „BETRIEBSBEREIT" über der ausgegrauten App, der beim Aufschlag die Farben „freischaltet" (Sättigungs-Sweep).
8. **Wochen-Ritual:** Der erste Login am Montag stempelt im Welcome-Briefing „NEUE WOCHE · KW XX" — kleines wiederkehrendes Ritual.
9. **Signatur-Schnörkel:** Beim „Unterschreiben" zeichnet sich ein SVG-Unterschriften-Pfad unter dem Stempel (stroke-dashoffset, 600ms).
10. **Jahres-Abschluss:** Wenn alle KW eines Jahres signed sind → Jahresmappe-Kachel bekommt Goldkante + „VOLLSTÄNDIG"-Prägung. (Ein einziges if, großer Stolz-Effekt.)
11. **Tastatur-Spur:** `?`-Shortcut-Overlay zeigt Keycaps, die beim tatsächlichen Drücken physisch einfedern.
12. **Kritischer-Pfad-Puls:** Im Netzplan pulsiert der kritische Pfad alle 8s einmal ganz dezent (Opacity-Welle entlang der Kanten — „Strom fließt").

**Easter Eggs (max. 2, unaufdringlich):**
- Konami-Code → kurz Schweißfunken-Partikel am Cursor (3s, dann nie wieder bis Reload).
- 100 % Lernziele bestätigt → Profil-Werksausweis bekommt „MEISTERSTÜCK"-Hologramm-Schimmer (animierter Gradient).

**Sound (opt-in, default AUS, Toggle im Profil):**
- 3 Samples, gesamt <30 KB: Stempel-Klack (satt, tief), Split-Flap-Flattern (leise), Erfolgs-„Ping" (kurz, hölzern). Web Audio, lazy, niemals beim Laden.

---

## Ebene 6 — Datenvisualisierung (eigene Sprache statt Chart-Defaults)

- **Balken:** Schraffur für Plan/Offen, satte Füllung für Ist; Achsen als Maßlinien mit Endstrichen; Beschriftung Mono.
- **Gauge/Halbkreis** (HeroTask, Auslastung): Skalenstriche außen, Zeiger-Nadel mit Gegengewicht-Punkt — Instrument, nicht Donut.
- **Sparklines** in Stat-Kacheln: 1px-Linie mit Endpunkt-Dot, kein Fill.
- **Heatmap** (optional, Berichts-Streak im Profil): Stanzraster — gefüllte vs. ungefüllte Lochungen pro KW. „Wie ein Fahrkarten-Entwerter für fleißige Wochen."
- Farben: Daten immer Cyan/Neutral, nie Orange (Orange = Interaktion, Gesetz 1.2).

---

## Ebene 7 — Sprache & Microcopy (Design ist auch Text)

- Ton: werkstattwarm, knapp, nie albern. „Sauber. Bericht ist raus." statt „Super gemacht!!! 🎉".
- Konsistente Verben: einstempeln (Login), ablegen (speichern), aushändigen (teilen), ausmustern (löschen → Papierkorb).
- Leerzustände erklären immer den nächsten Handgriff („Dein Ausbilder weist Projekte zu — bis dahin: erster Wochenbericht?").
- Fehlertexte: was passiert ist + was zu tun ist, Mono-Fehlercode dezent für Support.
- Alle neuen Strings über i18n (227-Key-System wächst mit, DE zuerst, EN nachziehen).

---

## Ebene 8 — Rollen-Identität (dieselbe Werkstatt, drei Perspektiven)

| Rolle | Akzent-Detail | Dashboard-Fokus |
|---|---|---|
| Azubi | Ausweis-Streifen Orange; „mein Werkstück"-Sprache | HeroTask, Berichts-Streak, Countdown |
| Mentor | Streifen Cyan; durchgängig Lese-Optik: Stempel „NUR ANSICHT" dezent im Header read-only-Seiten | Übersicht ohne Aktionsdruck |
| Ausbilder | Streifen Grün; „Prüfer-Werkzeuge" (Stempelkissen-Leiste in Berichten: Geprüft/Unterschreiben nebeneinander) | Eingangskorb (zu prüfen), kritische Azubis |

Kein Fork des Designs — nur Akzent + Reihenfolge. Die Rollen-Logik existiert (isStaff/isMentor/isAusbilder), hier bekommt sie Gesicht.

---

## Ebene 9 — Querschnitt: a11y, Performance, PWA, Print

- **a11y:** Orange-auf-Petrol für Text nur via `--c-ac-text` (AA geprüft); Stempel-Infos nie nur Farbe (immer Text); Fokus-Brackets ≥3:1; alle Animationen hinter `prefers-reduced-motion`; Split-Flap/Flipclock mit `aria-live="polite"`-Textalternative; Partikel `aria-hidden`.
- **Performance:** JS ≤170 KB gz hart (Motion = CSS; CountUp/Partikel/Flip selbst, je <1 KB; KEIN framer-motion/lottie); Fonts ≤120 KB precached; Grain/Raster = CSS/Data-URI; Lighthouse-Gates bleiben error-level. Animations-Layer nur `transform/opacity` (Compositor), `will-change` sparsam.
- **PWA/Meta:** Icon-Neuzeichnung (Monogramm + Stempel-Variante), maskable, `theme-color` je Theme, Titelbar-Farbe, Splash; OG-Image für Share-Links im Papier-Look.
- **Print:** IHK-Layouts unangetastet; Jahresmappen-Deckblatt (Schriftfeld + Stempelfeld); `@media print` killt Raster/Grain/Motion global.
- **Browser:** `color-mix`/`:has`/View-Transitions = progressive enhancement mit definierten Fallbacks (Edge/Chrome aktuell = Primärziel, PC-only).

---

## Umsetzungsplan (jede Phase eigener Branch, Gates: typecheck/lint/Vitest/Build + Browser-Review)

| Phase | Inhalt | Aufwand | Risiko |
|---|---|---|---|
| **D1 Foundations** | Fonts, Token-Architektur (Primitives+Semantik), Raster+Grain, Typo-/Schatten-/Radius-Skala, Papier-Light, Mono-Caps-Label | M | zentral: index.css + utils-`C`-Brücke; Rest-Hex-Arithmetik → color-mix |
| **D2 Primitives + Motion-Kit** | UI.tsx-Komponenten, `<Stamp>`, motion.css (Stempel/Stagger/Focus/Skeleton), Messlehre-Focus | M | gering |
| **D3 Screens A** | Login (Logo-Konstruktion), Dashboard (Instrumente), Berichte (Laufkarte+Stempel), Welcome-News (Auftragszettel) | L | mittel |
| **D4 Screens B** | Kalender (Split-Flap), Kanban (Plantafel), Netzplan (Blaupause), Trainingsplan (Flipclock+Zelebration) | L | mittel |
| **D5 Screens C + Illustration** | Lernbereich (Flip-Karten/Karteikasten), Ctrl+K, Users/Groups (Ausweise), Trash/Audit/Backups, Doodles, Icons | M | gering |
| **D6 Querschnitt + Extended** | PWA-Icons, Theme-Sweep, Rollen-Akzente, Microcopy-Pass, Signature 7–12 nach Wahl, a11y-/Kontrast-/Lighthouse-Audit | M | gering |

**Einstieg: D1+D2 zusammen** — Fundament + Primitives, damit sieht sofort die ganze App anders aus. In D1 liefere ich **3 Akzent-Varianten als Screenshot-Vergleich** (Signal-Orange / Amber / Cyan-dominant) vor der Festlegung.

### Offene Entscheide (vor D1)
1. **Akzentfarbe:** Signal-Orange (Empfehlung) vs. Amber vs. Cyan — **live umschaltbar in `docs/design-preview.html`**.
2. **Display-Font:** Chakra Petch (Empfehlung, techy) vs. Saira SemiCondensed (DIN-näher, ruhiger) vs. Rajdhani (leichter).
3. **Grain:** an (Empfehlung, .035) / aus — im Preview umschaltbar.
4. **Sound:** Stempel-Klack & Co als Opt-in bauen (D6) — ja/nein?
5. **Erweiterte Signatures (7–12) + Easter Eggs:** welche davon? (Empfehlung: 7, 9, 10 — die ritualbildenden.)

> **👉 `docs/design-preview.html` im Browser öffnen** — klickbarer Prototyp der Foundations (Stempel-Animation, Split-Flap, Messlehre-Focus per Tab, Werksausweis, Karteireiter, Papier-Modus). Null App-Code, reine Entscheidungshilfe.

---

## Anhang A — Playbook D1+D2 (erster Umsetzungs-Branch `design-d1`)

### Commit-Plan (jeder Commit einzeln grün: typecheck/lint/Vitest/Build)
| # | Commit | Inhalt | Berührte Dateien |
|---|---|---|---|
| 1 | `design: fonts` | `@fontsource-variable/archivo`, `@fontsource/chakra-petch`, `@fontsource/jetbrains-mono` installieren; Imports in `main.tsx`; `--f-*`-Tokens; body/h-Defaults in index.css | package.json, main.tsx, index.css |
| 2 | `design: token-architektur` | Primitives + Semantik-Layer in index.css (Struktur aus Preview übernehmen), `[data-theme=light]` → Papier-Werte, Typo-/Radius-/Schatten-Skala | index.css |
| 3 | `design: C-bridge` | utils.ts-`C` vollständig auf `var(--c-*)` (Token-Namen 1:1 → 38 Konsumenten-Dateien unverändert); verbleibende Hex+Alpha-Arithmetik (`C.gr+'45'` u. ä., ~6 Stellen via grep) auf `color-mix`-Tokens | utils.ts + die ~6 Arithmetik-Stellen |
| 4 | `design: raster+grain` | Blueprint-Raster auf body, Grain-Overlay hinter `data-grain`, Mono-Caps-Label-Klasse `.label`, SectionHeader-Maßlinien-Dekor | index.css, UI.tsx (SectionHeader) |
| 5 | `design: motion-kit` | `src/motion.css`: stampIn/fadeUp-Stagger/hatch/flapTurn + Easing-Tokens; global `:focus-visible`-Messlehre (Eckklammern-Technik aus Preview); reduced-motion-Block | motion.css (neu), main.tsx-Import |
| 6 | `design: stamp` | `src/components/Stamp.tsx` (API s. Anhang B) + Vitest (Render, Seed-Determinismus, Klassen je Status) | Stamp.tsx (neu), Test |
| 7 | `design: primitives` | UI.tsx: Card (Blech + `--punched`-Variante), Buttons (Press-State), Inputs (Unterkante), Toast (Etikett), Tabs (Karteireiter), EmptyState (Doodle-Slot), Füllstands-Progress | UI.tsx, ConfirmDialog.tsx |

### Verifikation pro Commit + am Ende
- Gates: tsc/lint/Vitest/Build; **Bundle-Diff dokumentieren** (Budget: JS ≤170 KB gz, Fonts ≤120 KB).
- Browser-Pass über ALLE 14 Routen (Edge/Playwright-Screenshots vorher/nachher je Route ablegen) — Token-Umstellung ist global, Regressionen zeigen sich visuell, nicht in Tests.
- Kontrast-Matrix prüfen (axe oder manuell): `--c-tx`/`--c-mu`/`--c-ac-text`/Status-Text auf allen 4 Flächen, beide Themes.
- Lighthouse-CI-Lauf (a11y/bp/seo error-Gates) auf dem Branch.

### Risiken & Gegenmittel
- **`C`-Brücke bricht Alpha-Arithmetik:** vorher `grep -rn "C\.\w\w*\s*\+\s*'" src/` → jede Stelle einzeln auf `color-mix`-Token; Commit 3 ist der riskanteste → kleinster Scope, eigener Screenshot-Pass.
- **Font-Layout-Shift:** Archivo ist schmaler als system-ui → Dichte-Pass über Sidebar/Tabellen (Commit 1 bewusst früh, damit alle Folge-Commits mit echten Fonts beurteilt werden).
- **Grain auf Low-End:** `mix-blend-mode` auf fixed Element ist GPU-billig, aber: messen (Performance-Tab); Fallback = Grain aus per Default.
- **Inline-Style-Altlasten:** Stellen, die noch rohe Hex (#161b22 etc.) statt `C.*`/Token nutzen: `grep -rn "#0a0e14\|#161b22\|#0071E3" src/` → Liste in D1 abarbeiten oder dokumentiert stehen lassen.

---

## Anhang B — Komponenten-APIs & Kit-Inventar (D2)

### `<Stamp>` — `src/components/Stamp.tssx`
```ts
type StampProps = {
  label: string;                      // i18n-Key-Resultat, z. B. t('report.status.reviewed')
  color?: 'red' | 'blue' | 'green';   // Stempelfarben-Welt (default: blue)
  stamped?: boolean;                  // true → .stamp-in-Animation beim Mount/Wechsel
  seed?: string | number;             // Entity-ID → deterministische Rotation (-3..3°, Hash, KEIN Math.random)
  size?: 'sm' | 'md';                 // sm = Listen-Badge, md = Dokument-Stempel
};
```
- Rotations-Hash: `(String(seed).split('').reduce((a,c)=>a+c.charCodeAt(0),0) % 7) - 3`.
- Status-Mapping Berichte: draft = neutraler Pill (kein Stempel) · submitted/reviewed = blau · signed = rot. Lernziele: learned = blau klein · confirmed = rot + `stamped`.
- a11y: `role="img"` + `aria-label`, Farbe nie alleiniger Träger (Text immer da).

### `useCountUp(target: number, opts?: { duration?: number })`
- Startet beim ersten IntersectionObserver-Hit, easeOut, rAF; gibt formatierte Zahl zurück; reduced-motion → sofort Zielwert. ≤40 Zeilen, `src/lib/hooks.ts`.

### `motion.css` — Klassen-Inventar
| Klasse | Zweck | Spec |
|---|---|---|
| `.stamp-in` | Stempel-Aufschlag | 280ms `--ease-stamp`, scale 1.45→.96→1, blur-Frame |
| `.draft-in > *` | Screen-Entrance | fadeUp 12px/320ms, delay `calc(var(--i)*60ms)` — Container vergibt `--i` |
| `.skel` | Lade-Schraffur | 45°-Streifen wandern 1.2s linear |
| `.flap .d.go` | Split-Flap-Drehung | rotateX-Halbzeiten, 360ms; Ziffern-Swap bei 170ms via JS |
| `:focus-visible` global | Messlehre | 8 background-Gradients als Eckklammern (Technik im Preview), kein outline |
| `.shake-reject` | Login-Fehler | translateX ±4px ×3, 200ms |
| `@keyframes particles` | Zelebration | 12 Partikel (`<i>`-Elemente), transform-only, 800ms, danach DOM-Cleanup |
- Alles in `@media (prefers-reduced-motion: no-preference)`; Datei < 4 KB.

### Doodle-Bibliothek (D5, Vorab-Spec)
`src/components/Doodles.tsx` — 8 Inline-SVGs (je <2 KB): leeres Kanban (Kiste), keine Berichte (Laufkarte), Papierkorb leer (Schredder), Suche leer (Lupe+Maßlinie), keine Termine (Plantafel), Fehler (Zahnrad mit Bruchzahn), alles-gut (Kaffeebecher), keine Gruppe (Karteikasten). Strichstärke 1.75, `stroke="currentColor"`, gestrichelte Maßlinien + Annotations-Text als `<text>` in Mono.

## Anhang C — Animations-Drehbuch (verbindlich für D3–D6)

Timing-System: **90ms** (Press/Snap) · **180ms** (Hover/Toggle) · **320ms** (Entrance/Layout) · **600ms** (Zeremonie: Stempel-Folge, Zeichnen). Easings: `--ease-out` Standard, `--ease-stamp` nur für Aufschläge. Nur `transform`/`opacity` (Compositor); alles außer Focus-Brackets hinter `prefers-reduced-motion`. **Budget: 1 Entrance + 1 Signature + Micro-Feedback pro Screen — nicht mehr.**

| Screen | Entrance (einmalig je Mount) | Signature | Micro-Feedback |
|---|---|---|---|
| **Login** | Logo-Konstruktion: SVG-Strokes zeichnen sich 1.2s (stroke-dashoffset), Formular faded danach ein (320ms) | „ABGELEHNT"-Stempel blitzt bei Fehlversuch auf + `.shake-reject` (200ms) | Button-Press 90ms; Input-Focus-Brackets snappen |
| **Dashboard** | `.draft-in`-Stagger über Widgets (60ms-Versatz) | Stat-Zahlen zählen hoch (`useCountUp`, 600ms, nur beim 1. Sichtbarwerden) | WeekProgress-Balken wachsen 320ms gestaffelt; Hover hebt Karte 1px |
| **Berichte** | Listen-Stagger 40ms | **Statuswechsel = `<Stamp stamped>`-Aufschlag** (280ms) + Tinten-Ring-Fade 600ms | KW-Wechsel als Mini-Split-Flap; Filter-Chip-Toggle 90ms |
| **Kanban** | Spalten staggern 60ms | Drag: Karte kippt 2.5° + Schatten; Drop-Slot = wandernde Schablonen-Strichlinie; Drop in „done" → Mini-Stempel ✓ | Spalten-Zähler pulst (scale 1.15→1, 180ms) bei Änderung |
| **Netzplan** | Knoten faden entlang Topologie ein (Welle, 40ms/Knoten) | Kritischer Pfad: Opacity-Puls wandert alle 8s einmal die Kanten entlang („Strom fließt") | Hover dimmt Nicht-Nachbarn auf 40 % (150ms); Zoom buttert 180ms |
| **Kalender** | Monat/Woche cross-faded 180ms | **Split-Flap-KW** beim Wochenwechsel (3 Flaps, 90ms versetzt) | Heute-Spalten-Glow faded beim Laden ein; Event-Chip-Hover hebt 1px |
| **Trainingsplan** | Kategorien staggern | Ausbilder bestätigt → Stempel + **12 CSS-Partikel** (800ms, danach DOM-Cleanup); Flipclock-Countdown klappt bei Tageswechsel | Fortschritts-Maßband füllt 320ms |
| **Lernbereich** | Karteikasten-Fächer staggern | Karteikarte **3D-Flip** (rotateY, 400ms); Karte „fliegt" ins nächste SM-2-Fach (500ms translate+scale) | Quiz richtig = grüner Mini-Stempel; falsch = `.shake-reject` |
| **Welcome-News** | Karten staggern 60ms unter Perfo-Kante | Datum/KW stempelt sich beim Öffnen (280ms, einmal pro Tag ohnehin) | CTA-Press |
| **Ctrl+K** | Panel scale .96→1 + fade 120ms | Block-Cursor blinkt `steps(1)` | Treffer-Hover: linke Akzentkante scaleY |
| **Profil/Users** | Werksausweis-Karte kippt minimal ein (rotate -1°→0, 320ms) | „MEISTERSTÜCK"-Schimmer (nur bei 100 % Lernzielen, animierter Gradient) | Avatar-Upload: Drop-Zone-Strichlinie wandert |
| **Papierkorb** | Zeilen-Stagger | Wiederherstellen-Hover: Schredder-Streifen setzen sich zusammen (Versatz→0, 200ms) | Endgültig-Löschen-Dialog: rote Schraffur-Ecke pulst NICHT (Ruhe = Ernst) |
| **Toasts** | — | Einfahrt von unten mit Überschwingen (320ms `--ease-stamp` light); Akzentkante „druckt" sich scaleX 0→1 | Undo-Link-Hover unterstreicht 90ms |
| **Theme-/Design-Switch** | — | View-Transition: radialer Sweep vom Schalter (600ms, progressive enhancement) | Schalter-Knopf federt 90ms |
| **Sync-Indicator** | — | Zahnrad dreht `steps(8)` bei inflight (mechanisch); steht bei Fehler abrupt still | Erfolg: kurzer grüner Tick-Fade |

**Implementierungs-Regeln:**
1. Alles CSS-Klassen aus `motion.css` + max. 3 Mini-Hooks (`useCountUp`, Partikel-Spawner, Flap-Ziffern-Swap) — kein Animations-Framework.
2. Entrance-Animationen NUR beim Mount, nie bei Re-Render (Key-Disziplin; `.draft-in` sitzt am Container).
3. Listen >30 Einträge: Stagger kappen (max. 12 Kinder animieren, Rest erscheint sofort).
4. Jede neue Animation wird im Browser gegen „nervt beim 20. Mal?" geprüft — Zeremonien (Stempel, Partikel) nur an echten Meilensteinen, nie an Routine-Klicks.

## Anhang D — Dashboard-Konzept „Vom leeren Tisch zur Instrumententafel"

Das Dashboard ist der meistgesehene Screen und hat drei klar getrennte Zustände. Das Designziel pro Zustand ist verschieden — Leere soll **einladen**, Betrieb soll **fokussieren**.

### D.1 Zustands-Modell
| Zustand | Bedingung (Azubi) | Designziel |
|---|---|---|
| **Z1 Leerer Tisch** | 0 Projekte UND 0 eigene Berichte | Neugier + erster Handgriff — darf charmant sein, Animation erlaubt |
| **Z2 Einrichten** | Setup unvollständig (Profil/Gruppe/1. Bericht offen), aber schon Aktivität | Checkliste führt, Instrumente erscheinen nach und nach |
| **Z3 Arbeitsmodus** | Projekte zugewiesen / Berichte laufen | **Ultra-Übersicht**: eine Blick-Hierarchie, null Deko-Konkurrenz |

Ausbilder analog: Z1 = „Werkstatt eröffnen" (Gruppe anlegen → Azubis einladen → erstes Projekt), Z3 = Prüf-Cockpit (Eingangskorb zuerst).

### D.2 Z1 — Der leere Tisch (cool statt peinlich)
- **Bühne:** mittig eine **animierte Blueprint-Werkbank** (Inline-SVG ~3 KB): Konstruktionslinien zeichnen sich beim Mount (stroke-dashoffset, 1.4s, einmalig), danach EIN dezenter Idle-Loop — das kleine Zahnrad an der Werkbank dreht `steps(8)`, 12s-Periode. Nicht mehr; Leere soll ruhig wirken.
- Headline (Display): „Deine Werkbank steht bereit." Sub: ein Satz, was als Nächstes Sinn ergibt.
- **Einrichtungs-Laufkarte** darunter (card--punched): 3–4 Schritte mit leeren Stempelfeldern — „Profil vervollständigen" · „Gruppe beitreten" · „Ersten Wochenbericht anlegen" · „Lernpfad starten". Jeder erledigte Schritt bekommt live den Mini-Stempel (Aufschlag-Animation); Fortschritt als Mono-Zähler `EINRICHTUNG 2/4`.
- Jeder Schritt = direkter Deep-Link (Event-Bus-navigate), kein „Anleitung lesen".
- **Übergangs-Zeremonie Z1/Z2 → Z3** (= Signature 7): Wenn der letzte Schritt fällt ODER das erste Projekt zugewiesen wird → großer Stempel „BETRIEBSBEREIT" über der Laufkarte (600ms), die Karte faded aus, die Instrumente staggern herein. Passiert genau EINMAL (localStorage-Flag pro User).
- Z1 mit teilweisem Inhalt (z. B. nur Bericht fehlt) zeigt zusätzlich schon die relevanten Mini-Widgets — keine künstliche Leere.

### D.3 Z3 — Arbeitsmodus: die Blick-Hierarchie (genau 3 Ebenen)
Lesefluss in unter 5 Sekunden — „Was jetzt? Wie steht's? Was kommt?":

1. **Kopfzeile (volle Breite):** Begrüßung + Datum/KW-Stempel rechts. KEINE Aktionen hier.
2. **Hero-Zeile = „WAS JETZT":** Das EINE nächste Ding, groß. Auswahl-Logik (Priorität): überfällige Aufgabe → heute fällige Aufgabe → Berichtsheft dieser Woche offen → nächste Deadline ≤3 Tage → „Alles im Plan" (grüner Ruhezustand mit nächstem Termin). Links Titel+Kontext, rechts **Halbkreis-Gauge** mit Resttagen, EIN orangefarbener CTA. Daneben kompakt: 3 CountUp-Stats (offene Aufgaben / Projekte / Berichts-Streak) — mehr Zahlen gibt es above-the-fold NICHT.
3. **Arbeitsfläche (2 Spalten) = „WIE STEHT'S / WAS KOMMT":**
   - Links **Aktive Projekte** als Werkbank-Reihen (nicht Karten-Grid): Signalleuchte (Ampel-Glow) · Titel · Füllstands-Balken mit Skalenstrichen · „nächste Aufgabe"-Zeile in Mono · Deadline rechts. Eine Zeile = ein Projekt = ein Klick. Max. 5, dann „Alle →".
   - Rechts schmale Spalte: **Wochenübersicht** (Füllstand MO–FR), **Termine** (nächste 3, Mono-Datum), **Berichtsheft-Status** (Stempel-Vorschau der aktuellen KW), Lern-Snack (1 fälliger Karteikasten-Stapel).
   - **Aktivitäts-Feed wandert ans Ende** (volle Breite, eingeklappt auf 5 Zeilen) — Historie ist Nachschlag, nicht Konkurrenz zur Arbeit.
- **Dichte-Regeln:** Jedes Widget beantwortet EINE Frage und hat max. EINEN CTA. Keine zwei Widgets zeigen dieselbe Information (heute: Deadlines doppelt in HeroTask + Deadline-Widget → Deadline-Widget fliegt zusammengelegt in die Termin-Spalte). Leere Einzel-Widgets in Z3 zeigen einen Einzeiler statt Riesen-Emoji.
- **Motion in Z3** (nach Anhang C): Entrance-Stagger + CountUp einmalig, Gauge-Nadel schwingt beim Laden ein (320ms) — danach ist das Dashboard STILL. Bewegung nur noch als Antwort auf Nutzer-Aktion.

### D.4 Ausbilder-Cockpit (Z3-Variante)
1. Hero = **Eingangskorb**: „N Berichte warten auf Prüfung" mit direktem Prüf-CTA + ältester Wartezeit in Mono.
2. **Azubi-Reihen** statt Projekt-Reihen: Avatar · Name · Ampel (überfällige Aufgaben) · Berichtsstatus-Stempel der KW · letzter Aktiv-Zeitstempel. Ein Klick → Azubi-Profil.
3. Peripherie: kritische Projekte, Gruppen-Anfragen-Tray, Termine.

### D.5 Umsetzung & Geltung
- **Phase D3** (Dashboard-Teil): Z1-Werkbank-SVG + Laufkarte + Zustands-Weiche + Z3-Hierarchie-Umbau + Hero-Auswahl-Logik (`buildHeroSuggestion` als pure Funktion in eigener .ts → unit-testbar wie buildNewsCards).
- Wiederverwendung: Einrichtungs-Logik teilt Checks mit OnboardingWizard/WelcomeNews (ein Modul, kein Drift); Projekt-Reihen-Komponente wird auch im Ausbilder-Cockpit als Azubi-Reihe variiert.
- Alles Beta-gescoped: 1.0-Dashboard bleibt unverändert; die Zustands-Weiche rendert in v1 schlicht das bisherige Layout.

### Preview als lebendes Artefakt
`docs/design-preview.html` wird pro D-Phase um die neu gebauten Primitives erweitert (Copy aus echtem CSS) — dient als Styleguide-Snapshot für Reviews, fliegt nach D6 in `docs/styleguide.html` umbenannt zusammen.
