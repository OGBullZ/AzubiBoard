// Blueprint-Doodles für Leerzustände (D5, DESIGN-VISION 1.5) — Strichzeichnungen
// mit Maßlinien-Annotation statt Riesen-Emoji. Nur im Beta-Design gerendert.
import type { JSX } from 'react';

const S = { stroke: 'currentColor', strokeWidth: 1.75, fill: 'none' as const, strokeLinecap: 'round' as const };

export type DoodleName = 'kiste' | 'laufkarte' | 'zahnrad' | 'kaffee';

const DOODLES: Record<DoodleName, JSX.Element> = {
  // leere Kiste (Projekte/Allgemein)
  kiste: (
    <g {...S}>
      <path d="M20 38 L60 24 L100 38 L100 74 L60 88 L20 74 Z" />
      <path d="M20 38 L60 52 L100 38 M60 52 L60 88" />
      <line x1="14" y1="96" x2="106" y2="96" strokeDasharray="4 4" opacity=".5" strokeWidth="1" />
    </g>
  ),
  // Laufkarte (Berichte)
  laufkarte: (
    <g {...S}>
      <rect x="32" y="22" width="56" height="72" rx="3" />
      <circle cx="60" cy="32" r="3" />
      <line x1="42" y1="48" x2="78" y2="48" /><line x1="42" y1="60" x2="78" y2="60" /><line x1="42" y1="72" x2="64" y2="72" />
      <rect x="66" y="78" width="16" height="10" rx="1" opacity=".7" />
    </g>
  ),
  // Zahnrad mit Bruchzahn (Fehler)
  zahnrad: (
    <g {...S}>
      <circle cx="60" cy="58" r="22" />
      <circle cx="60" cy="58" r="8" />
      {[0, 45, 90, 135, 225, 270, 315].map(a => (
        <line key={a}
          x1={60 + 22 * Math.cos(a * Math.PI / 180)} y1={58 + 22 * Math.sin(a * Math.PI / 180)}
          x2={60 + 29 * Math.cos(a * Math.PI / 180)} y2={58 + 29 * Math.sin(a * Math.PI / 180)} />
      ))}
      {/* der fehlende Zahn bei 180° */}
      <path d="M30 52 l-6 -4 m6 10 l-7 1" strokeDasharray="3 3" opacity=".6" strokeWidth="1.25" />
    </g>
  ),
  // Kaffeebecher auf Werkbank (alles erledigt)
  kaffee: (
    <g {...S}>
      <path d="M42 44 h32 v26 a10 10 0 0 1 -10 10 h-12 a10 10 0 0 1 -10 -10 Z" />
      <path d="M74 50 h6 a7 7 0 0 1 0 14 h-7" />
      <path d="M50 34 q2 -5 0 -9 M60 34 q2 -5 0 -9" opacity=".6" />
      <line x1="28" y1="86" x2="92" y2="86" />
    </g>
  ),
};

export function Doodle({ name, size = 120 }: { name: DoodleName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true"
      style={{ color: 'var(--c-mu)', display: 'block', margin: '0 auto' }}>
      {DOODLES[name]}
    </svg>
  );
}

export default Doodle;
