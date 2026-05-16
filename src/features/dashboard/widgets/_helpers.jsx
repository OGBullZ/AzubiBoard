// Sprint-9-quality H3: Geteilte Dashboard-Bausteine. Bisher inline in Dashboard.jsx.
import { useState, useEffect } from "react";
import { C } from '../../../lib/utils.js';
import { IcoPlay, IcoCheck, IcoPause, IcoBlock } from '../../../components/Icons.jsx';

export function LiveClock() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setT(new Date()), 1000); return () => clearInterval(i); }, []);
  return (
    <span style={{ fontFamily: C.mono, fontSize: 14, color: C.ac, fontWeight: 700, letterSpacing: 1.5, userSelect: 'none' }}>
      {t.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}

export function useCountUp(target) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!target) return;
    let cur = 0;
    const step = Math.max(1, Math.ceil(target / 30));
    const i = setInterval(() => {
      cur = Math.min(cur + step, target);
      setV(cur);
      if (cur >= target) clearInterval(i);
    }, 20);
    return () => clearInterval(i);
  }, [target]);
  return v;
}

export function Ring({ pct = 0, size = 44, stroke = 4, color, bg }) {
  const r    = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(1, pct / 100)) * circ;
  const bgColor = bg || 'var(--c-bd2)';
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }} aria-hidden="true">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={bgColor} strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray .6s cubic-bezier(.4,0,.2,1)' }} />
    </svg>
  );
}

export function Chip({ value, label, color, animated = false }) {
  const counted = useCountUp(typeof value === 'number' && animated ? value : 0);
  const n = animated && typeof value === 'number' ? counted : value;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 13px', background: color + '12', border: `1px solid ${color}25`, borderRadius: 8 }}>
      <span style={{ fontSize: 18, fontWeight: 800, color, fontFamily: "'Syne',system-ui,sans-serif", lineHeight: 1, letterSpacing: -0.5 }}>
        {animated ? n : value}
      </span>
      <span style={{ fontSize: 10, color: C.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: .7, lineHeight: 1.3 }}>
        {label}
      </span>
    </div>
  );
}

export function urgencyColor(diff) {
  if (diff < 0)  return C.cr;
  if (diff === 0) return C.cr;
  if (diff <= 3)  return '#f78166';
  if (diff <= 7)  return C.yw;
  return C.mu;
}
export function urgencyBg(diff) {
  if (diff < 0)  return C.crd;
  if (diff === 0) return C.crd;
  if (diff <= 3)  return '#f7816618';
  if (diff <= 7)  return C.ywd;
  return 'var(--c-sf3)';
}
export function urgencyLabel(diff) {
  if (diff < 0)   return `${Math.abs(diff)}d über`;
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Morgen';
  return `${diff}d`;
}

export const ST_ICONS  = { in_progress: IcoPlay, not_started: IcoCheck, waiting: IcoPause, blocked: IcoBlock, done: IcoCheck };
export const ST_COLORS = { in_progress: C.ac, not_started: C.mu, waiting: C.yw, blocked: C.cr, done: C.gr };

export function PanelTitle({ Icon, children, badge, action, onAction }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 11, flexShrink: 0 }}>
      {Icon && <Icon size={12} style={{ color: C.textSecondary }} />}
      <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>{children}</span>
      {badge && (
        <span style={{ fontSize: 9, background: badge.bg || C.acd, color: badge.c || C.ac, borderRadius: 5, padding: '1px 6px', fontFamily: C.mono, fontWeight: 700 }}>
          {badge.text}
        </span>
      )}
      {action && <button className="icn" onClick={onAction} style={{ fontSize: 10, padding: '1px 5px' }}>{action}</button>}
    </div>
  );
}
