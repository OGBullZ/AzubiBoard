# design-sync NOTES — AzubiBoard UI

Repo-spezifische Eigenheiten für künftige Syncs.

## Toolchain (WICHTIG)
- **Chromium-Download von Playwright hängt auf diesem Windows** (CDN stallt bei ~4 MB, `__dirlock` löst nie). NICHT `npx playwright install chromium` nutzen.
- **Stattdessen installiertes Edge als Browser**: `export DS_CHROMIUM_PATH='E:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'` vor `package-validate.mjs` / `package-capture.mjs` / `resync.mjs`. Edge ist Chromium-basiert, `executablePath` greift. Funktioniert einwandfrei (12/12 render).
- `playwright@1.59.1` ist in `.ds-sync/` installiert (passt zum Repo-Pin), aber der Browser kommt von Edge.
- Node 24, npm 11. Build-Deps (esbuild/ts-morph/@types/react) in `.ds-sync/`.

## Build (Synth-Entry)
- AzubiBoard hat **keinen** Library-Build (`private:true`, App via Vite). Sync läuft Synth-Entry über das Barrel `.design-sync/_ds-entry.ts` (re-exportiert die 12 UI.tsx-Komponenten) — `--entry ./.design-sync/_ds-entry.ts`.
- `componentSrcMap` pinnt alle 12 Namen → `src/components/UI.tsx`. Ohne diese Pins würde der Synth-Scan hunderte PascalCase-Exports der ganzen App reinziehen.

## Provider / Look / i18n
- `.design-sync/_ds-provider.tsx` (`DesignRoot`, via `extraEntries`+`provider`) setzt `data-design="beta"` + `data-accent="orange"` auf `document.documentElement` (nicht nur Wrapper — `useDesign()` liest documentElement) und importiert `src/lib/i18n` (sonst suspendieren Modal/Toast/ThemeToggle).

## Fonts — akzeptierte Substitute
- Geshippt: Archivo Variable, Chakra Petch (600/700), JetBrains Mono (400/700) via `@fontsource`.
- `[FONT_MISSING]` für **"Archivo"** (statisch) und **"Fira Code"** ist OK — beides nur Fallback-Namen in den Font-Stacks; die führenden Familien (Archivo Variable / JetBrains Mono) shippen. Kein Handlungsbedarf.

## Known render warns
- Keine offenen. GRID_OVERFLOW bei EmptyState/Field/SectionHeader wurde via `cardMode:"column"` gelöst; Modal/Toast via `cardMode:"single"`.

## Re-sync risks (Watch-list)
- Provider inlinet `src/lib/i18n.ts` + `src/components/UI.tsx` ins Bundle — ändert sich deren API/Init, neu prüfen.
- Beta-Look ist an `[data-design="beta"]`-CSS in `src/index.css` gekoppelt. Größere Umbauten dort → Previews neu graden.
- Conventions-Header (`conventions.md`) nennt konkrete Token-/Klassennamen aus `index.css` — bei CSS-Refactor gegen den Build re-validieren.
- Scope ist bewusst nur UI.tsx (12 Primitive). Weitere Komponenten (Stamp, FlapDigits, Dialoge) sind Floor-Card-Kandidaten für spätere inkrementelle Syncs.
