// ============================================================
//  Stamp – Prüfstempel (Design 1.0 Beta, DESIGN-VISION Ebene 3)
//  Kern-Identität der Werkbank: Status als physischer Stempelabdruck.
//  Farb-Fallbacks (var(--stamp-*, var(--c-*))) machen ihn auch unter
//  Design 1.0 renderbar; eingesetzt wird er erst in Beta-Screens (D3+).
// ============================================================

import { stampRotation, type StampColor } from '../lib/stamp.js';

type StampProps = {
  label: string;
  color?: StampColor;
  /** true → Aufschlag-Animation (.stamp-in) beim Rendern, z. B. direkt nach Statuswechsel */
  stamped?: boolean;
  /** Entity-ID → deterministische Mini-Rotation (-3..3°), jeder Abdruck sitzt anders */
  seed?: string | number;
  size?: 'sm' | 'md';
};

const COLORS: Record<StampColor, string> = {
  red:   'var(--stamp-red, var(--c-cr))',
  blue:  'var(--stamp-blue, var(--c-ac))',
  green: 'var(--stamp-green, var(--c-gr))',
};

export function Stamp({ label, color = 'blue', stamped = false, seed, size = 'sm' }: StampProps) {
  const rot = stampRotation(seed);
  const col = COLORS[color];
  return (
    <span
      role="img"
      aria-label={label}
      className={stamped ? 'stamp stamp-in' : 'stamp'}
      style={{
        display: 'inline-block',
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: size === 'md' ? 14 : 11,
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        color: col,
        padding: size === 'md' ? '5px 12px' : '2px 8px',
        border: `2px solid ${col}`,
        borderRadius: 3,
        // Doppelrahmen: 1.5px Luft in Flächenfarbe + 1px Innenlinie
        boxShadow: `inset 0 0 0 1.5px var(--c-sf), inset 0 0 0 2.5px ${col}`,
        ['--stamp-rot' as string]: `${rot}deg`,
        transform: `rotate(${rot}deg)`,
        whiteSpace: 'nowrap',
      }}>
      {label}
    </span>
  );
}

export default Stamp;
