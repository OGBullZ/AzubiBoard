import { useState } from 'react';
import { C, ST } from '../lib/utils.js';
import { IcoMoon, IcoSun } from './Icons.jsx';

// ── Toast ─────────────────────────────────────────────────────
// payload kann String oder { msg, undo, duration } sein
export function Toast({ payload, onDismiss }) {
  const isObj = payload && typeof payload === 'object';
  const msg   = isObj ? payload.msg  : payload;
  const undo  = isObj ? payload.undo : null;
  return (
    <div role="status" aria-live="polite"
      style={{
        position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)',
        background: 'var(--c-sf)', border: '1px solid var(--c-bd2)', borderRadius: 9,
        padding: '9px 14px 9px 18px', fontSize: 13, color: 'var(--c-br)', zIndex: 9999,
        fontWeight: 600, boxShadow: 'var(--shadow-lg)', animation: 'toastIn .2s ease',
        whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 12, maxWidth: '90vw'
      }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{msg}</span>
      {undo && (
        <button
          onClick={() => { undo(); onDismiss?.(); }}
          aria-label="Aktion rückgängig machen"
          style={{
            background: 'transparent', border: '1px solid var(--c-ac)', color: 'var(--c-ac)',
            borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700,
            cursor: 'pointer', textTransform: 'uppercase', letterSpacing: .6,
            flexShrink: 0
          }}>
          ↶ Rückgängig
        </button>
      )}
    </div>
  );
}

// ── Status Badge ──────────────────────────────────────────────
export function StatusBadge({ status }) {
  const s = ST[status] || ST.yellow;
  return (
    <span className="tag" role="status" style={{ background: s.bg, color: s.c, border: `1px solid ${s.c}35`, padding: '6px 12px', fontSize: 12, fontWeight: 600 }} aria-label={`Status: ${s.label}`}>
      ● {s.label}
    </span>
  );
}

// ── Avatar — zeigt Profilbild oder Initialen ──────────────────
export function Avatar({ name, url, size = 28 }) {
  const [imgErr, setImgErr] = useState(false);
  const initials  = (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const hue       = (name?.charCodeAt(0) || 200) * 37 % 360;
  const fontSize  = Math.max(size * 0.36, 10);
  const baseStyle = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    border: '2px solid rgba(255,255,255,0.2)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
    transition: 'all 0.15s cubic-bezier(0.4,0,0.2,1)',
  };

  if (url && !imgErr) {
    return (
      <div role="img" aria-label={name} title={name}
        style={{ ...baseStyle, overflow: 'hidden' }}>
        <img src={url} alt={name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={() => setImgErr(true)} />
      </div>
    );
  }
  return (
    <div role="img" aria-label={name} title={name}
      style={{ ...baseStyle, background: `hsl(${hue},45%,22%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize, fontWeight: 700, color: `hsl(${hue},65%,75%)`, userSelect: 'none', lineHeight: 1, fontFamily: C.mono }}>
      {initials}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────
export function Modal({ title, onClose, children, width = 480 }) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="modal-title"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn .12s', padding: 16 }}
      onClick={onClose}>
      <div style={{ background: C.sf, border: `1px solid ${C.bd2}`, borderRadius: 12, padding: 22, width, maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto', animation: 'fadeUp .18s ease', boxShadow: 'var(--shadow-lg)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 id="modal-title" style={{ fontSize: 15, fontWeight: 800, color: C.br, margin: 0 }}>{title}</h2>
          <button className="del" onClick={onClose} style={{ fontSize: 20 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────
export function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <label>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: C.mu, marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

// ── Progress Bar ──────────────────────────────────────────────
export function ProgressBar({ value, color, height = 4, label }) {
  const pct = Math.min(Math.max(Math.round(value ?? 0), 0), 100);
  return (
    <div className="progress-track" style={{ height }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label || `${pct}%`}>
      <div className="progress-fill" style={{ width: `${pct}%`, background: color || C.ac }} />
    </div>
  );
}

// ── Stat Card (Desktop: große klare Zahl) ─────────────────────
export function StatCard({ label, value, color, sub, Icon, onClick }) {
  return (
    <div className="card" style={{ borderLeft: `3px solid ${color}`, padding: '12px 16px', position: 'relative', overflow: 'hidden', cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      {Icon && <div style={{ position: 'absolute', right: 10, bottom: 8, opacity: .06, color }} aria-hidden="true"><Icon size={36} /></div>}
      <div style={{ fontSize: 10, color: C.mu, textTransform: 'uppercase', letterSpacing: .9, fontWeight: 700, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1, fontFamily: C.sans, fontVariantNumeric: 'tabular-nums', letterSpacing: -1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.mu, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────
export function EmptyState({ icon, Icon, title, subtitle, action, onAction }) {
  return (
    <div style={{ textAlign: 'center', padding: '32px 16px', color: C.mu }}>
      {Icon
        ? <div style={{ display: 'inline-flex', padding: 14, borderRadius: 14, background: C.sf2, border: `1px solid ${C.bd}`, marginBottom: 14, opacity: .5, color: C.mu }}><Icon size={26} /></div>
        : icon && <div style={{ fontSize: 34, marginBottom: 12, opacity: .3 }}>{icon}</div>}
      <div style={{ fontSize: 14, fontWeight: 700, color: C.tx, marginBottom: 5 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, marginBottom: 16, lineHeight: 1.6 }}>{subtitle}</div>}
      {action && onAction && <button className="abtn" onClick={onAction} style={{ fontSize: 12 }}>{action}</button>}
    </div>
  );
}

// ── Section Header ────────────────────────────────────────────
export function SectionHeader({ title, count, Icon, action, onAction }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
      {Icon && <span style={{ color: C.mu, display: 'flex' }}><Icon size={13} /></span>}
      <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: C.tx, textTransform: 'uppercase', letterSpacing: .8 }}>
        {title}{count !== undefined && <span style={{ color: C.mu, fontWeight: 400, marginLeft: 5 }}>({count})</span>}
      </div>
      {action && onAction && (
        <button className="icn" onClick={onAction} style={{ fontSize: 11, fontWeight: 700 }}>{action}</button>
      )}
    </div>
  );
}

// ── Theme Toggle ──────────────────────────────────────────────
export function ThemeToggle({ theme, onToggle }) {
  const dark = theme === 'dark';
  return (
    <button onClick={onToggle} title={dark ? 'Light Mode' : 'Dark Mode'} aria-label={dark ? 'Light Mode aktivieren' : 'Dark Mode aktivieren'}
      style={{ width: 34, height: 20, borderRadius: 10, border: `1px solid ${C.bd2}`, background: dark ? C.sf2 : C.acd, cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0, padding: 0, display: 'flex', alignItems: 'center' }}>
      <div style={{ position: 'absolute', width: 14, height: 14, borderRadius: '50%', background: dark ? C.mu : C.ac, left: dark ? 2 : 18, top: 2, transition: 'left .18s, background .18s' }} />
      <span style={{ position: 'absolute', left: 3, display: 'flex', opacity: dark ? .9 : .3, color: C.mu }}><IcoMoon size={9} /></span>
      <span style={{ position: 'absolute', right: 3, display: 'flex', opacity: dark ? .3 : .9, color: C.ac }}><IcoSun size={9} /></span>
    </button>
  );
}

// ── Icon Button (APPLE-STYLE: 40x40, better feedback) ───────────
export function IconBtn({ Icon, onClick, label, danger = false, active = false, size = 16, style: s = {} }) {
  const handleClick = (e) => {
    // Spring animation on click
    e.currentTarget.style.transform = 'scale(0.95)';
    setTimeout(() => {
      e.currentTarget.style.transform = 'scale(1)';
    }, 100);
    onClick?.();
  };

  const bgColor = danger ? 'rgba(255, 59, 48, 0.1)' : active ? 'rgba(0, 113, 227, 0.1)' : 'transparent';
  const textColor = danger ? C.critical : active ? C.primary : C.textSecondary;

  return (
    <button onClick={handleClick} aria-label={label} title={label}
      style={{
        width: 40,
        height: 40,
        borderRadius: 8,
        border: 'none',
        background: bgColor,
        color: textColor,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
        flexShrink: 0,
        fontSize: size,
        ...s,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = danger ? 'rgba(255, 59, 48, 0.2)' : active ? 'rgba(0, 113, 227, 0.2)' : 'rgba(0, 0, 0, 0.05)';
        e.currentTarget.style.color = danger ? C.critical : active ? C.primary : C.textPrimary;
        e.currentTarget.style.transform = 'scale(1.1)';
        e.currentTarget.style.boxShadow = danger ? 'var(--shadow-sm)' : active ? 'var(--shadow-sm)' : 'var(--shadow-xs)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = bgColor;
        e.currentTarget.style.color = textColor;
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = 'none';
      }}
      onFocus={e => {
        e.currentTarget.style.boxShadow = `var(--shadow-focus)`;
      }}
      onBlur={e => {
        e.currentTarget.style.boxShadow = 'none';
      }}>
      <Icon size={size} />
    </button>
  );
}

// ── Divider ───────────────────────────────────────────────────
export function Divider({ my = 10 }) {
  return <div style={{ height: 1, background: C.bd, margin: `${my}px 0` }} />;
}
