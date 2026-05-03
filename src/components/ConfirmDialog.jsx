import { C } from '../lib/utils.js';

export function ConfirmDialog({ message, onConfirm, onCancel, confirmLabel = 'Löschen', cancelLabel = 'Abbrechen', danger = true }) {
  return (
    <div
      role="dialog" aria-modal="true"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onCancel}>
      <div
        style={{ background: C.sf, border: `1px solid ${C.bd2}`, borderRadius: 12, padding: 24, width: 340, maxWidth: '90vw', boxShadow: '0 16px 60px rgba(0,0,0,.6)', animation: 'fadeUp .15s ease' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.br, marginBottom: 8 }}>Bestätigung erforderlich</div>
        <div style={{ fontSize: 13, color: C.tx, lineHeight: 1.6, marginBottom: 22 }}>{message}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onCancel} style={{ padding: '8px 16px' }}>{cancelLabel}</button>
          <button
            onClick={onConfirm}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: danger ? C.cr : C.ac, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
