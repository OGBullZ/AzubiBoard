import { C } from '../../lib/utils.js';

// Eine farbcodierte, aggregierte News-Karte (extrahiert das HeroTask-Card-Pattern).
// Severity-Accent links, Icon + Label (uppercase) + Titel + optionaler Sub-Text;
// mit onClick wird die ganze Karte zum Button (Pfeil rechts).
export type NewsCardProps = {
  accent: string;          // Akzentfarbe (Severity)
  accentBg: string;        // Hintergrund-Tint
  icon: string;            // Emoji
  label: string;           // kurzer Großbuchstaben-Tag, z.B. "ÜBERFÄLLIG"
  title: string;           // Hauptzeile, fw800
  sub?: string;            // optionale Detailzeile, C.mu
  onClick?: () => void;    // optional → Navigation, Karte wird klickbar
};

export default function NewsCard({ accent, accentBg, icon, label, title, sub, onClick }: NewsCardProps) {
  const inner = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
        <span style={{ fontSize: 13, lineHeight: 1 }} aria-hidden="true">{icon}</span>
        <span style={{ fontSize: 9, fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
        {onClick && <span style={{ marginLeft: 'auto', color: accent, fontSize: 13 }} aria-hidden="true">→</span>}
      </div>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.br, lineHeight: 1.35 }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: C.mu, marginTop: 2, lineHeight: 1.45 }}>{sub}</div>}
    </>
  );

  const baseStyle: React.CSSProperties = {
    width: '100%', textAlign: 'left',
    borderLeft: `3px solid ${accent}`,
    background: accentBg,
    borderRadius: 8, padding: '11px 14px',
  };

  if (onClick) return (
    <button onClick={onClick} style={{ ...baseStyle, border: 'none', borderLeft: `3px solid ${accent}`, cursor: 'pointer', display: 'block' }}>
      {inner}
    </button>
  );
  return <div style={baseStyle}>{inner}</div>;
}
