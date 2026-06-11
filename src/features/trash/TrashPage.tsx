// ============================================================
//  TrashPage – Papierkorb für Projekte / Berichte / Lernziele
//  Restore oder permanent löschen. Auto-Purge nach 30 Tagen.
// ============================================================
import { useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { C, fmtDate } from '../../lib/utils.js';
import { EmptyState } from '../../components/UI.jsx';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { IcoTrash, IcoFolder, IcoReport, IcoStar } from '../../components/Icons.jsx';
import { TRASH_TYPES, restoreFromTrash, purgeFromTrash } from '../../lib/trash.js';
import type { AppState, User } from '../../types';

type TrashType = 'projects' | 'reports' | 'goals';

type TrashItem = {
  id: string | number;
  deletedAt?: string;
  deletedByName?: string;
  title?: string;
  text?: string;
  week_number?: number;
  year?: number;
  [key: string]: unknown;
};

type IconProps = { size?: number; style?: React.CSSProperties };

type TypeMeta = {
  label: string;
  Icon: ComponentType<IconProps>;
  titleKey: string;
  subtitleFn?: (item: TrashItem) => string;
};

const TYPE_META: Record<TrashType, TypeMeta> = {
  projects: { label: 'Projekte',  Icon: IcoFolder, titleKey: 'title' },
  reports:  { label: 'Berichte',  Icon: IcoReport, titleKey: 'title', subtitleFn: r => `KW ${r.week_number}/${r.year}` },
  goals:    { label: 'Lernziele', Icon: IcoStar,   titleKey: 'title' },
};

function daysLeft(deletedAt?: string, maxDays = 30): number {
  if (!deletedAt) return maxDays;
  const elapsed = (Date.now() - new Date(deletedAt).getTime()) / 86_400_000;
  return Math.max(0, Math.ceil(maxDays - elapsed));
}

type TrashPageProps = {
  data: AppState;
  currentUser: User;
  onUpdateData: (next: AppState) => void;
  showToast: (msg: string) => void;
};

export default function TrashPage({ data, currentUser, onUpdateData, showToast }: TrashPageProps) {
  const [tab, setTab]         = useState<TrashType>('projects');
  const [purgeId, setPurgeId] = useState<string | number | null>(null);
  const isAusbilder = currentUser?.role === 'ausbilder';

  const items = useMemo<TrashItem[]>(() => {
    const list: TrashItem[] = (data as any)?.trash?.[tab] || [];
    return [...list].sort((a, b) => +new Date(b.deletedAt ?? 0) - +new Date(a.deletedAt ?? 0));
  }, [data, tab]);

  const counts = useMemo(() => Object.fromEntries(
    TRASH_TYPES.map((t: TrashType) => [t, (data as any)?.trash?.[t]?.length || 0])
  ), [data]);

  const restore = (id: string | number) => {
    onUpdateData(restoreFromTrash(data as any, tab, id) as unknown as AppState);
    showToast(`↻ ${TYPE_META[tab].label.slice(0, -1)} wiederhergestellt`);
  };

  const purge = () => {
    if (!purgeId) return;
    onUpdateData(purgeFromTrash(data as any, tab, purgeId) as unknown as AppState);
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
        {TRASH_TYPES.map((t: TrashType) => {
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
        <EmptyState Icon={IcoTrash} doodle="kiste" title="Leer" subtitle={`Keine ${TYPE_META[tab].label.toLowerCase()} im Papierkorb`} />
      ) : (
        <div className="draft-in-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(it => {
            const days = daysLeft(it.deletedAt);
            const meta = TYPE_META[tab];
            const sub  = meta.subtitleFn ? meta.subtitleFn(it) : null;
            return (
              <div key={it.id} className="card shred-row" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12, borderLeft: `3px solid color-mix(in srgb, ${C.cr} 33%, transparent)` }}>
                <meta.Icon size={18} style={{ color: C.mu, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.br, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {it[meta.titleKey] as string || it.text || '(ohne Titel)'}
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
                    style={{ padding: '5px 9px', fontSize: 13, border: `1px solid color-mix(in srgb, ${C.cr} 33%, transparent)`, background: 'transparent', color: C.cr, borderRadius: 6, cursor: 'pointer', flexShrink: 0 }}>
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
