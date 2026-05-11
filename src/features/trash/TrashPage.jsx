// ============================================================
//  TrashPage – Papierkorb für Projekte / Berichte / Lernziele
//  Restore oder permanent löschen. Auto-Purge nach 30 Tagen.
// ============================================================
import { useMemo, useState } from 'react';
import { C, fmtDate } from '../../lib/utils.js';
import { EmptyState } from '../../components/UI.jsx';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { IcoTrash, IcoFolder, IcoReport, IcoStar } from '../../components/Icons.jsx';
import { TRASH_TYPES, restoreFromTrash, purgeFromTrash } from '../../lib/trash.js';

const TYPE_META = {
  projects: { label: 'Projekte',  Icon: IcoFolder, titleKey: 'title' },
  reports:  { label: 'Berichte',  Icon: IcoReport, titleKey: 'title', subtitleFn: r => `KW ${r.week_number}/${r.year}` },
  goals:    { label: 'Lernziele', Icon: IcoStar,   titleKey: 'title' },
};

function daysLeft(deletedAt, maxDays = 30) {
  if (!deletedAt) return maxDays;
  const elapsed = (Date.now() - new Date(deletedAt).getTime()) / 86_400_000;
  return Math.max(0, Math.ceil(maxDays - elapsed));
}

export default function TrashPage({ data, currentUser, onUpdateData, showToast }) {
  const [tab, setTab]         = useState('projects');
  const [purgeId, setPurgeId] = useState(null);
  const isAusbilder = currentUser?.role === 'ausbilder';

  const items = useMemo(() => {
    const list = data?.trash?.[tab] || [];
    return [...list].sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
  }, [data, tab]);

  const counts = useMemo(() => Object.fromEntries(
    TRASH_TYPES.map(t => [t, data?.trash?.[t]?.length || 0])
  ), [data]);

  const restore = (id) => {
    onUpdateData(restoreFromTrash(data, tab, id));
    showToast(`↻ ${TYPE_META[tab].label.slice(0, -1)} wiederhergestellt`);
  };

  const purge = () => {
    if (!purgeId) return;
    onUpdateData(purgeFromTrash(data, tab, purgeId));
    showToast('🗑 Endgültig gelöscht');
    setPurgeId(null);
  };

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: '0 auto' }} className="anim">
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.br, display: 'flex', alignItems: 'center', gap: 8 }}>
          <IcoTrash size={18} style={{ color: C.cr }} />
          Papierkorb
        </div>
        <div style={{ fontSize: 12, color: C.mu, marginTop: 3 }}>
          Einträge werden 30 Tage aufbewahrt und danach automatisch endgültig entfernt.
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, borderBottom: `1px solid ${C.bd}`, overflowX: 'auto' }}>
        {TRASH_TYPES.map(t => {
          const M = TYPE_META[t];
          const active = tab === t;
          return (
            <button key={t} onClick={() => setTab(t)}
              style={{
                padding: '8px 14px', fontSize: 12, fontWeight: 700,
                border: 'none', background: 'transparent',
                color: active ? C.ac : C.mu,
                borderBottom: `2px solid ${active ? C.ac : 'transparent'}`,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
              }}>
              <M.Icon size={12} />
              {M.label}
              <span style={{ background: active ? C.acd : C.sf2, color: active ? C.ac : C.mu, padding: '1px 7px', borderRadius: 9, fontSize: 10, fontFamily: C.mono }}>{counts[t]}</span>
            </button>
          );
        })}
      </div>

      {items.length === 0 ? (
        <EmptyState Icon={IcoTrash} title="Leer" subtitle={`Keine ${TYPE_META[tab].label.toLowerCase()} im Papierkorb`} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(it => {
            const days = daysLeft(it.deletedAt);
            const meta = TYPE_META[tab];
            const sub  = meta.subtitleFn ? meta.subtitleFn(it) : null;
            return (
              <div key={it.id} className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12, borderLeft: `3px solid ${C.cr}55` }}>
                <meta.Icon size={18} style={{ color: C.mu, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.br, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {it[meta.titleKey] || it.text || '(ohne Titel)'}
                  </div>
                  <div style={{ fontSize: 11, color: C.mu, marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {sub && <span>{sub}</span>}
                    <span>Gelöscht von {it.deletedByName || '?'} · {fmtDate(it.deletedAt?.slice(0,10))}</span>
                    <span style={{ color: days <= 3 ? C.yw : C.mu }}>· noch {days} Tag{days === 1 ? '' : 'e'}</span>
                  </div>
                </div>
                <button onClick={() => restore(it.id)}
                  style={{ padding: '5px 11px', fontSize: 11, fontWeight: 700, border: `1px solid ${C.ac}`, background: 'transparent', color: C.ac, borderRadius: 6, cursor: 'pointer', flexShrink: 0 }}>
                  ↻ Wiederherstellen
                </button>
                {isAusbilder && (
                  <button onClick={() => setPurgeId(it.id)} aria-label="Endgültig löschen"
                    style={{ padding: '5px 9px', fontSize: 13, border: `1px solid ${C.cr}55`, background: 'transparent', color: C.cr, borderRadius: 6, cursor: 'pointer', flexShrink: 0 }}>
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {purgeId && (
        <ConfirmDialog
          message="Diesen Eintrag endgültig und unwiderruflich löschen?"
          onConfirm={purge}
          onCancel={() => setPurgeId(null)}
        />
      )}
    </div>
  );
}
