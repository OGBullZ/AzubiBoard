// Notification-UI: Glocke + Panel + Push-Permission-Zeile.
// Aus App.tsx extrahiert (2026-06-13) — liegt jetzt neben useNotifications.ts.
// Reine UI/Leaf-Komponenten, Verhalten unverändert.
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../lib/store';
import { useNotifications, type NotificationEntry } from './useNotifications';
import { IcoAlert, IcoReport, IcoClock, IcoBell, IcoX } from '../../components/Icons.jsx';
import type { AppState, User } from '../../types';

function NotificationPermissionRow() {
  const [perm, setPerm]       = useState(() => typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
  const [enabled, setEnabledState] = useState(true);

  useEffect(() => {
    let mounted = true;
    import('../../lib/webPush.js').then(m => {
      if (!mounted) return;
      setEnabledState(m.isEnabled());
      setPerm(m.currentPermission());
    });
    return () => { mounted = false; };
  }, []);

  if (perm === 'unsupported') return null;

  const ask = async () => {
    const m = await import('../../lib/webPush.js');
    const result = await m.requestPermission();
    setPerm(result);
  };
  const toggle = async () => {
    const m = await import('../../lib/webPush.js');
    const next = !enabled;
    m.setEnabled(next);
    setEnabledState(next);
  };

  if (perm === 'default') {
    return (
      <div style={{ padding: '9px 14px', borderBottom: '1px solid var(--c-bd)', background: 'rgba(0,113,227,.06)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 9 }}>
        <span aria-hidden="true">🔔</span>
        <span style={{ flex: 1, color: 'var(--c-tx)' }}>Browser-Benachrichtigungen erlauben?</span>
        <button onClick={ask} className="abtn" style={{ padding: '4px 9px', fontSize: 10 }}>Erlauben</button>
      </div>
    );
  }
  if (perm === 'denied') {
    return (
      <div style={{ padding: '7px 14px', borderBottom: '1px solid var(--c-bd)', fontSize: 10, color: 'var(--c-mu)', fontStyle: 'italic' }}>
        🔕 Browser-Notifications blockiert (in den Browser-Einstellungen freigeben)
      </div>
    );
  }
  // granted → Toggle anzeigen
  return (
    <label style={{ padding: '7px 14px', borderBottom: '1px solid var(--c-bd)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--c-mu)' }}>
      <input type="checkbox" checked={enabled} onChange={toggle} />
      <span style={{ flex: 1 }}>Browser-Push aktiv</span>
      <span style={{ fontSize: 9, color: 'var(--c-gr)' }}>● {enabled ? 'AN' : 'AUS'}</span>
    </label>
  );
}

function NotificationItem({ n, read, onMarkRead, navigate, onClose }: {
  n: NotificationEntry; read: boolean; onMarkRead: (id: string) => void; navigate: (to: string) => void; onClose: () => void;
}) {
  const clr = ({ critical: 'var(--c-cr)', warning: 'var(--c-yw)', info: 'var(--c-ac)' } as Record<string, string>)[n.severity] || 'var(--c-ac)';
  const Icon = n.severity === 'critical' ? IcoAlert : n.type === 'report' ? IcoReport : IcoClock;
  const handleClick = () => {
    onMarkRead(n.id);
    onClose();
    if (n.projectId) navigate(`/project/${n.projectId}`);
    else if (n.type === 'report') navigate('/reports');
  };
  return (
    <button onClick={handleClick}
      style={{ width: '100%', display: 'flex', gap: 10, padding: '10px 14px', border: 'none', borderBottom: '1px solid var(--c-bd)', background: read ? 'transparent' : 'rgba(0,113,227,.05)', cursor: 'pointer', textAlign: 'left', transition: 'background .1s' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--c-sf2)'}
      onMouseLeave={e => e.currentTarget.style.background = read ? 'transparent' : 'rgba(0,113,227,.05)'}>
      <div style={{ width: 26, height: 26, borderRadius: 6, background: clr + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
        <Icon size={12} style={{ color: clr }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: read ? 500 : 700, color: 'var(--c-br)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</div>
        <div style={{ fontSize: 11, color: 'var(--c-mu)', marginTop: 1 }}>{n.message}</div>
        {n.projectTitle && <div style={{ fontSize: 10, color: 'var(--c-mu)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📁 {n.projectTitle}</div>}
      </div>
      {!read && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--c-ac)', flexShrink: 0, marginTop: 7 }} />}
    </button>
  );
}

export function NotificationBell({ collapsed }: { collapsed: boolean }) {
  const { data, currentUser } = useAppStore();
  const navigate = useNavigate();
  const { notifications, unreadCount, readIds, markRead, markAllRead } = useNotifications(data as AppState | null, currentUser as User | null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => { if (!panelRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [open]);

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.top, left: r.right + 8 });
    }
    setOpen(o => !o);
  };

  return (
    <div style={{ padding: '0 6px 4px' }}>
      <button ref={btnRef} onClick={handleToggle} title={collapsed ? 'Benachrichtigungen' : undefined}
        style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 8, justifyContent: collapsed ? 'center' : 'flex-start', width: '100%', padding: collapsed ? '8px' : '7px 10px', borderRadius: 7, border: '1px solid var(--c-bd)', background: open ? 'var(--c-acd)' : 'var(--c-sf2)', color: unreadCount > 0 ? 'var(--c-br)' : 'var(--c-mu)', fontSize: 12, cursor: 'pointer', position: 'relative', transition: 'background .1s' }}>
        <IcoBell size={13} />
        {!collapsed && <span style={{ flex: 1, textAlign: 'left' }}>Benachrichtigungen</span>}
        {unreadCount > 0 && (
          <span style={{ ...(collapsed ? { position: 'absolute', top: 3, right: 3 } : {}), background: 'var(--c-cr)', color: '#fff', borderRadius: 10, fontSize: 9, fontWeight: 800, minWidth: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && createPortal(
        <div ref={panelRef} style={{ position: 'fixed', top: pos.top, left: pos.left, width: 310, maxHeight: 460, background: 'var(--c-sf)', border: '1px solid var(--c-bd2)', borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,.6)', zIndex: 850, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderBottom: '1px solid var(--c-bd)', flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-br)' }}>Benachrichtigungen</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {unreadCount > 0 && <button onClick={markAllRead} style={{ fontSize: 11, color: 'var(--c-ac)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Alle gelesen</button>}
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-mu)', padding: 0, display: 'flex', alignItems: 'center' }}><IcoX size={14} /></button>
            </div>
          </div>
          <NotificationPermissionRow />
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0
              ? <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--c-mu)', fontSize: 13 }}>Alles erledigt ✓</div>
              : notifications.map(n => <NotificationItem key={n.id} n={n} read={readIds.has(n.id)} onMarkRead={markRead} navigate={navigate} onClose={() => setOpen(false)} />)
            }
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
