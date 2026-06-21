# AzubiBoard UI — Konventionen für den Design-Agent

Diese Library sind die echten React-Primitive aus AzubiBoard (Ausbildungs-Management-Tool, React 19). Styling läuft **nicht über Utility-Klassen-Frameworks wie Tailwind**, sondern über (a) CSS-Custom-Properties als Design-Tokens, (b) eine kleine Menge globaler Klassen, und (c) Attribut-Schalter am Root-Element für Design-Variante/Theme/Akzent. Alles davon liegt in der gebundenen `styles.css` (inkl. `@import "./_ds_bundle.css"`).

## Pflicht: Root-Attribute setzen (sonst falscher Look)

Der App-Default ist das **„Beta"/Werkbank-Design** (Archivo + Chakra Petch, Petrol-Dunkel, Signal-Orange). Setze auf dem Wurzel-Element (`<html>` oder App-Root):

```html
<html data-design="beta" data-accent="orange">   <!-- data-accent: orange | amber | cyan -->
```

- **Ohne `data-design="beta"`** rendern die Komponenten im älteren v1-Look (`:root`-Defaults: #0a0e14, System-Font, Blau) — funktioniert, ist aber nicht die aktuelle Marke.
- **Light-Mode:** zusätzlich `data-theme="light"` (eigener Papier-Look, kein invertiertes Dark).
- Komponenten mit Text (`Modal`, `Toast`, `ThemeToggle`) nutzen react-i18next — die Host-App muss i18next initialisiert haben, sonst suspendieren sie.

## Styling-Idiom: Tokens + Klassen, keine erfundenen Namen

**Farb-/Schrift-Tokens** (als `var(--c-…)` / `var(--font-…)`; themen automatisch über die Attribute oben):
`--c-bg --c-sf --c-sf2 --c-sf3` (Flächen), `--c-tx --c-br --c-mu` (Text), `--c-bd --c-bd2` (Border), `--c-ac --c-acd` (Akzent + Tint), `--c-gr/grd --c-yw/ywd --c-cr/crd` (grün/gelb/rot + Tints), `--font-body --font-display --font-mono`, `--shadow --shadow-sm --shadow-lg --shadow-focus`.

**Globale Klassen** (für eigenes Layout/Glue verwenden, nicht neu erfinden):
`.card` (Panel), `.abtn` (Primär-Button, Orange), `.btn` (Sekundär), `.icn` (Icon-Text-Button), `.del` (Close/Delete-×), `.row-btn` (Listzeile), `.tag` (Pill), `.progress-track`/`.progress-fill`, `.section-header`. Form-Elemente (`input/textarea/select/label`) sind global gestyled — kein Wrapper nötig.

## Wo die Wahrheit steht
Vor eigenem Styling die gebundene `styles.css` (+ ihre `@import`-Kette inkl. `_ds_bundle.css`) lesen — sie ist die einzige Quelle für Token-Werte und Klassen. Pro Komponente: die `<Name>.d.ts` (Props-Contract) und `<Name>.prompt.md`.

## Idiomatisches Beispiel

```tsx
import { StatCard, SectionHeader, ProgressBar } from 'netzplan';

<section className="card">
  <SectionHeader title="Sprint 14" count={12} />
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
    <StatCard label="Erledigt" value={42} color="var(--c-gr)" sub="+5 diese Woche" />
    <StatCard label="Offen"    value={13} color="var(--c-yw)" />
    <StatCard label="Quote"    value="68%" color="var(--c-ac)" />
  </div>
  <ProgressBar value={68} color="var(--c-ac)" />
</section>
```
