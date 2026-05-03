import { useState } from "react";
import { C, fmtDate } from '../../lib/utils.js';
import { StatusBadge, Avatar, ProgressBar, EmptyState, IconBtn } from '../../components/UI.jsx';
import {
  IcoFolder, IcoCheck, IcoClock, IcoSearch, IcoTrash,
  IcoPlus, IcoLink, IcoArchive, IcoChevron
} from '../../components/Icons.jsx';

export function ProjectPool({ projects, users, groups, currentUser, onOpen, onNew, onDelete, onArchive, onUnarchive }) {
  const [filter,      setFilter]      = useState('all');
  const [search,      setSearch]      = useState('');
  const [showArchive, setShowArchive] = useState(false);
  const [viewMode,    setViewMode]    = useState('grid');

  const active   = projects.filter(p => !p.archived);
  const archived = projects.filter(p => p.archived);

  const visible = active.filter(p => {
    if (filter === 'mine' && !(p.assignees||[]).includes(currentUser.id) && currentUser.role !== 'ausbilder') return false;
    if (['green','yellow','red'].includes(filter) && p.status !== filter) return false;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase()) && !(p.description || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const FILTERS = [
    ['all',    'Alle',       null,  C.ac, active.length],
    ['mine',   'Meine',      null,  C.mu, active.filter(p => (p.assignees||[]).includes(currentUser.id)).length],
    ['green',  'In Ordnung', C.gr,  C.gr, active.filter(p => p.status === 'green').length],
    ['yellow', 'Laufend',    C.yw,  C.yw, active.filter(p => p.status === 'yellow').length],
    ['red',    'Problem',    C.cr,  C.cr, active.filter(p => p.status === 'red').length],
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '16px 20px' }} className="anim">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: C.br, margin: 0 }}>Projekte</h1>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: C.textSecondary, pointerEvents: 'none' }}><IcoSearch size={12} /></div>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suchen…" style={{ paddingLeft: 28, width: 200 }} />
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {FILTERS.map(([v, l, dot, c, cnt]) => (
              <button key={v} className="btn" onClick={() => setFilter(v)} aria-pressed={filter === v}
                style={{ fontSize: 11, padding: '5px 10px', background: filter === v ? c + '18' : '', borderColor: filter === v ? c : '', color: filter === v ? c : C.tx }}>
                {dot && <div style={{ width: 6, height: 6, borderRadius: '50%', background: dot }} />}
                {l} <span style={{ fontSize: 9, fontFamily: C.mono, opacity: .6 }}>({cnt})</span>
              </button>
            ))}
          </div>
          <button className="abtn" onClick={onNew} style={{ fontSize: 12 }}>
            <IcoPlus size={13} /> Neu
          </button>
          <div style={{ display: 'flex', background: 'var(--c-sf2)', borderRadius: 7, padding: 2, gap: 2, border: `1px solid var(--c-bd)` }}>
            <button onClick={() => setViewMode('grid')}
              style={{ padding: '4px 8px', borderRadius: 5, border: 'none', background: viewMode === 'grid' ? C.ac : 'transparent', color: viewMode === 'grid' ? '#fff' : C.mu, cursor: 'pointer', fontSize: 11, fontWeight: 700, transition: 'all .12s', display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg viewBox="0 0 14 14" width="12" height="12" fill="currentColor"><rect x="0" y="0" width="5" height="5" rx="1"/><rect x="7" y="0" width="5" height="5" rx="1"/><rect x="0" y="7" width="5" height="5" rx="1"/><rect x="7" y="7" width="5" height="5" rx="1"/></svg>
              Grid
            </button>
            <button onClick={() => setViewMode('table')}
              style={{ padding: '4px 8px', borderRadius: 5, border: 'none', background: viewMode === 'table' ? C.ac : 'transparent', color: viewMode === 'table' ? '#fff' : C.mu, cursor: 'pointer', fontSize: 11, fontWeight: 700, transition: 'all .12s', display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg viewBox="0 0 14 14" width="12" height="12" fill="currentColor"><rect x="0" y="0" width="14" height="3" rx="1"/><rect x="0" y="5" width="14" height="3" rx="1"/><rect x="0" y="10" width="14" height="3" rx="1"/></svg>
              Liste
            </button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {visible.length === 0 ? (
          <EmptyState Icon={IcoSearch} title="Keine Projekte"
            subtitle={search ? `Nichts für "${search}"` : 'Noch keine Projekte in dieser Kategorie'}
            action={!search ? '+ Neues Projekt' : undefined} onAction={!search ? onNew : undefined} />
        ) : viewMode === 'table' ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid var(--c-bd)`, textAlign: 'left' }}>
                {['Projekt','Status','Fortschritt','Azubis','Deadline','Aufgaben'].map(h => (
                  <th key={h} style={{ padding: '7px 12px', fontSize: 13, fontWeight: 700, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: .8, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
                {currentUser.role === 'ausbilder' && <th style={{ width: 60 }} />}
              </tr>
            </thead>
            <tbody>
              {visible.map(p => {
                const au   = users.filter(u => (p.assignees||[]).includes(u.id));
                const done = (p.tasks||[]).filter(t => t.status === 'done' || t.done).length;
                const pct  = (p.tasks||[]).length > 0 ? Math.round(done / (p.tasks||[]).length * 100) : 0;
                const sc   = p.status === 'green' ? C.gr : p.status === 'red' ? C.cr : C.yw;
                const over = p.deadline && new Date(p.deadline) < new Date();
                return (
                  <tr key={p.id}
                    style={{ borderBottom: `1px solid var(--c-bd)`, cursor: 'pointer', transition: 'background .1s' }}
                    onClick={() => onOpen(p.id)}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--c-sf3)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 3, height: 28, borderRadius: 2, background: sc, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontWeight: 700, color: C.br }}>{p.title}</div>
                          {p.description && <div style={{ fontSize: 12, color: C.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>{p.description}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}><StatusBadge status={p.status} /></td>
                    <td style={{ padding: '12px 14px', minWidth: 120 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <ProgressBar value={pct} color={pct === 100 ? C.gr : C.ac} height={4} />
                        <span style={{ fontSize: 10, fontFamily: C.mono, color: C.textSecondary, flexShrink: 0 }}>{pct}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex' }}>
                        {au.slice(0, 4).map((u, i) => <div key={u.id} style={{ marginLeft: i > 0 ? -6 : 0, zIndex: i }}><Avatar name={u.name} size={22} /></div>)}
                        {au.length > 4 && <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--c-bd2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: C.textSecondary, marginLeft: -6 }}>+{au.length-4}</div>}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', fontFamily: C.mono, fontSize: 11, color: over ? C.cr : C.mu, fontWeight: over ? 700 : 400 }}>
                      {p.deadline ? (over ? '⚠ ' : '') + fmtDate(p.deadline) : '–'}
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', fontFamily: C.mono, fontSize: 11, color: C.textSecondary }}>
                      {done}/{(p.tasks||[]).length}
                      {(p.tasks||[]).filter(t => t.status === 'in_progress').length > 0 &&
                        <span style={{ color: C.ac, marginLeft: 6 }}>▶{(p.tasks||[]).filter(t => t.status === 'in_progress').length}</span>}
                    </td>
                    {currentUser.role === 'ausbilder' && (
                      <td style={{ padding: '12px 14px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <IconBtn Icon={IcoArchive} onClick={() => onArchive?.(p.id)} label="Archivieren" style={{ background: 'var(--c-sf)', border: `1px solid var(--c-bd2)` }} />
                          <IconBtn Icon={IcoTrash}   onClick={() => onDelete(p.id, p.title)} label="Löschen" danger />
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, alignContent: 'start' }}>
            {visible.map(p => {
              const au    = users.filter(u => (p.assignees||[]).includes(u.id));
              const grp   = groups.find(g => g.id === p.groupId);
              const done  = (p.tasks||[]).filter(t => t.status === 'done' || t.done).length;
              const pct   = (p.tasks||[]).length > 0 ? Math.round(done / (p.tasks||[]).length * 100) : null;
              const sc    = p.status === 'green' ? C.gr : p.status === 'red' ? C.cr : C.yw;
              const activ = (p.tasks||[]).filter(t => t.status === 'in_progress').length;
              const lc    = (p.links || []).length;
              return (
                <article key={p.id} role="listitem" className="card proj-card"
                  style={{ cursor: 'pointer', borderLeft: `3px solid ${sc}`, transition: 'transform .12s, box-shadow .12s' }}
                  onClick={() => onOpen(p.id)} tabIndex={0} onKeyDown={e => e.key === 'Enter' && onOpen(p.id)}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderLeftColor = sc; }}>
                  {currentUser.role === 'ausbilder' && (
                    <div className="hover-action" style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
                      <IconBtn Icon={IcoArchive} onClick={e => { e.stopPropagation(); onArchive?.(p.id); }} label="Archivieren" style={{ background: 'var(--c-sf)', border: `1px solid var(--c-bd2)` }} />
                      <IconBtn Icon={IcoTrash}   onClick={e => { e.stopPropagation(); onDelete(p.id, p.title); }} label="Löschen" danger />
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 7, gap: 8 }}>
                    <h2 style={{ fontSize: 14, fontWeight: 800, color: C.br, margin: 0, lineHeight: 1.35, flex: 1, wordBreak: 'break-word' }}>{p.title}</h2>
                    <div style={{ flexShrink: 0 }}><StatusBadge status={p.status} /></div>
                  </div>
                  {p.description && (
                    <p style={{ fontSize: 14, color: C.textSecondary, margin: '0 0 9px', lineHeight: 1.55, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.description}</p>
                  )}
                  <div style={{ display: 'flex', gap: 7, marginBottom: 9, flexWrap: 'wrap', alignItems: 'center' }}>
                    {grp    && <span style={{ fontSize: 10, color: C.ac, display: 'flex', alignItems: 'center', gap: 3 }}><IcoFolder size={10} />{grp.name}</span>}
                    {lc > 0 && <span style={{ fontSize: 10, color: C.textSecondary, display: 'flex', alignItems: 'center', gap: 3 }}><IcoLink size={10} />{lc}</span>}
                    {activ > 0 && <span style={{ fontSize: 9, color: C.ac, fontFamily: C.mono, background: C.acd, borderRadius: 4, padding: '1px 5px' }}>▶ {activ}</span>}
                    {p.deadline && <time dateTime={p.deadline} style={{ fontSize: 10, color: new Date(p.deadline) < new Date() ? C.cr : C.mu, display: 'flex', alignItems: 'center', gap: 3, marginLeft: 'auto' }}><IcoClock size={10} />{fmtDate(p.deadline)}</time>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: pct !== null ? 8 : 0 }}>
                    <div style={{ display: 'flex' }}>
                      {au.slice(0, 5).map((u, i) => <div key={u.id} style={{ marginLeft: i > 0 ? -6 : 0, zIndex: i }}><Avatar name={u.name} size={22} /></div>)}
                      {au.length > 5 && <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--c-bd2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: C.textSecondary, marginLeft: -6 }}>+{au.length - 5}</div>}
                    </div>
                    <span style={{ fontSize: 10, color: C.textSecondary, fontFamily: C.mono }}>{done}/{(p.tasks||[]).length}</span>
                  </div>
                  {pct !== null && <ProgressBar value={pct} color={pct === 100 ? C.gr : C.ac} height={3} />}
                </article>
              );
            })}
          </div>
        )}

        {archived.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <button onClick={() => setShowArchive(s => !s)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: `1px solid var(--c-bd)`, borderRadius: 7, padding: '6px 14px', cursor: 'pointer', color: C.textSecondary, fontSize: 12, fontWeight: 600, marginBottom: 12, transition: 'border-color .15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = C.bd2}
              onMouseLeave={e => e.currentTarget.style.borderColor = C.bd}>
              <IcoArchive size={13} /> Archiv ({archived.length}) <span style={{ fontSize: 10, marginLeft: 2 }}>{showArchive ? '▲' : '▼'}</span>
            </button>
            {showArchive && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                {archived.map(p => (
                  <div key={p.id} style={{ background: 'var(--c-sf2)', border: `1px solid var(--c-bd)`, borderRadius: 9, padding: '11px 14px', opacity: .6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: C.br, wordBreak: 'break-word', flex: 1 }}>{p.title}</span>
                      <span className="tag" style={{ background: 'var(--c-sf3)', color: C.textSecondary, border: `1px solid var(--c-bd2)`, fontSize: 9, flexShrink: 0 }}>Archiv</span>
                    </div>
                    <div style={{ display: 'flex', gap: 7 }}>
                      <button onClick={() => onUnarchive?.(p.id)} className="btn" style={{ fontSize: 11, padding: '3px 9px' }}>Wiederherstellen</button>
                      <button onClick={() => onDelete(p.id, p.title)} className="del" style={{ fontSize: 11 }}>Löschen</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectPool;
