// Sidebar (Navigation + Profil-/Theme-/Logout-Leiste).
// Aus App.tsx extrahiert (2026-06-13) — self-contained, props-getrieben.
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { NotificationBell } from '../features/notifications/NotificationBell.jsx';
import { firstName } from '../lib/utils.js';
import {
  IcoDashboard, IcoFolder, IcoCalendar, IcoReport, IcoRequire, IcoLearn,
  IcoUsers, IcoUserEdit, IcoTrash, IcoSearch, IcoPlus, IcoSun, IcoMoon, IcoLogout,
} from './Icons.jsx';
import type { User } from '../types';

interface SidebarProps {
  currentUser: User | null;
  onLogout: () => void;
  onNewProject: () => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onShowBackups?: (() => void) | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSearch: () => void;
  theme: string;
  onToggleTheme: () => void;
  isMobile: boolean;
  drawerOpen: boolean;
  onCloseDrawer?: () => void;
  trashCount?: number;
}
export function Sidebar({ currentUser, onLogout, onNewProject, onExport, onImport, onShowBackups, collapsed, onToggleCollapse, onSearch, theme, onToggleTheme, isMobile, drawerOpen, onCloseDrawer, trashCount: _trashCount = 0 }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const path     = location.pathname;
  const isAusbilder = currentUser?.role === 'ausbilder';

  const handleNav = (to: string) => { navigate(to); if (isMobile) onCloseDrawer?.(); };

  // Phase 2: Navigation in „Arbeiten" / „Verwalten" gruppiert
  const navGroups = [
    { label: 'Arbeiten', items: [
      { to: '/dashboard', label: 'Dashboard',       Icon: IcoDashboard },
      { to: '/projects',  label: 'Projekte',        Icon: IcoFolder    },
      { to: '/calendar',  label: 'Kalender',        Icon: IcoCalendar  },
      { to: '/reports',   label: 'Berichtshefte',   Icon: IcoReport    },
      { to: '/training',  label: 'Ausbildungsplan', Icon: IcoRequire   },
      { to: '/learn',     label: 'Lernbereich',     Icon: IcoLearn     },
    ] },
    { label: 'Verwalten', items: [
      { to: '/groups',    label: 'Gruppen',         Icon: IcoUsers     },
      ...(isAusbilder ? [{ to: '/users', label: 'Nutzer', Icon: IcoUserEdit }] : []),
      { to: '/trash',     label: 'Papierkorb',      Icon: IcoTrash     },
    ] },
  ];

  const hue = (currentUser?.name?.charCodeAt(0) || 100) * 37 % 360;
  const w   = isMobile ? 220 : (collapsed ? 52 : 200);

  const drawerStyle: React.CSSProperties = isMobile ? {
    position:  'fixed',
    left:      0,
    top:       0,
    zIndex:    900,
    height:    '100dvh',
    transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
    transition: 'transform .25s ease',
    boxShadow: drawerOpen ? '4px 0 32px rgba(0,0,0,.45)' : 'none',
  } : {};

  return (
    <aside style={{ width: w, flexShrink: 0, background: 'var(--c-sf)', borderRight: '1px solid var(--c-bd)', display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', transition: isMobile ? 'transform .25s ease' : 'width .2s ease', ...drawerStyle }}>

      {/* Logo + Collapse Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 9, padding: collapsed ? '14px 11px' : '14px 12px 10px', borderBottom: '1px solid var(--c-bd)', flexShrink: 0, justifyContent: collapsed ? 'center' : 'space-between' }}>
        <div onClick={() => navigate('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', minWidth: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: 'linear-gradient(135deg, var(--c-ac), #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', boxShadow: '0 2px 8px rgba(0,113,227,0.35)' }}>A</div>
          {!collapsed && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-br)', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>AzubiBoard</div>
              <div style={{ fontSize: 9, color: 'var(--c-mu)', textTransform: 'uppercase', letterSpacing: 1 }}>PM System</div>
            </div>
          )}
        </div>
        {isMobile
          ? <button onClick={onCloseDrawer} aria-label="Menü schließen"
              style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--c-mu)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16, padding: 0 }}>×</button>
          : <button onClick={onToggleCollapse} title={collapsed ? 'Aufklappen' : 'Einklappen'}
              style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--c-mu)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14, padding: 0 }}>
              {collapsed ? '›' : '‹'}
            </button>
        }
      </div>

      {/* Search */}
      <div style={{ padding: '4px 6px 0' }}>
        <button onClick={onSearch} title="Suchen (Strg+K)"
          style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 8, justifyContent: collapsed ? 'center' : 'flex-start', width: '100%', padding: collapsed ? '8px' : '7px 10px', borderRadius: 7, border: '1px solid var(--c-bd)', background: 'var(--c-sf2)', color: 'var(--c-mu)', fontSize: 12, cursor: 'pointer', marginBottom: 4 }}>
          <IcoSearch size={13} />
          {!collapsed && <>
            <span style={{ flex: 1 }}>Suchen…</span>
            <kbd style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--c-sf3)', border: '1px solid var(--c-bd2)', color: 'var(--c-mu)' }}>Ctrl+K</kbd>
          </>}
        </button>
      </div>

      {/* Benachrichtigungen */}
      <NotificationBell collapsed={collapsed} />

      {/* Nav */}
      <nav style={{ flex: 1, padding: '4px 6px', overflowY: 'auto' }}>
        {navGroups.map((group, gi) => (
          <div key={group.label} style={{ marginTop: gi === 0 ? 0 : 8 }}>
            {!collapsed && (
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--c-mu)', textTransform: 'uppercase', letterSpacing: 1, padding: '6px 10px 4px', opacity: .7 }}>{group.label}</div>
            )}
            {group.items.map(({ to, label, Icon: NavIcon }) => {
              const active = path === to || (to !== '/dashboard' && path.startsWith(to));
              return (
                <button key={to} onClick={() => handleNav(to)} title={collapsed ? label : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 9, justifyContent: collapsed ? 'center' : 'flex-start', width: '100%', padding: collapsed ? '9px' : '8px 10px', borderRadius: 8, border: 'none', background: active ? 'var(--c-acd)' : 'transparent', color: active ? 'var(--c-ac)' : 'var(--c-mu)', fontSize: 13, fontWeight: active ? 700 : 500, cursor: 'pointer', textAlign: 'left', marginBottom: 1, transition: 'all .12s', borderLeft: active ? '2px solid var(--c-ac)' : '2px solid transparent' }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--c-sf2)'; e.currentTarget.style.color = 'var(--c-br)'; }}}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--c-mu)'; }}}>
                  <NavIcon size={14} />
                  {!collapsed && label}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div style={{ padding: collapsed ? '8px 6px 12px' : '8px 8px 12px', borderTop: '1px solid var(--c-bd)', flexShrink: 0 }}>
        {!collapsed && (
          <>
            {/* Neues Projekt (0.6: nur Ausbilder — Azubi/Mentor bekommen Projekte zugewiesen) */}
            {isAusbilder && (
              <button className="abtn" onClick={onNewProject} style={{ width: '100%', justifyContent: 'center', marginBottom: 6, fontSize: 12 }}>
                <IcoPlus size={12} /> Neues Projekt
              </button>
            )}

            {/* Export / Import */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
              <button className="btn" onClick={onExport} title="Daten als JSON exportieren" style={{ flex: 1, fontSize: 10, padding: '5px 0', justifyContent: 'center' }}>↓ Export</button>
              <label className="btn" title="JSON-Backup importieren" style={{ flex: 1, fontSize: 10, padding: '5px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, margin: 0 }}>
                ↑ Import
                <input type="file" accept=".json" onChange={onImport} style={{ display: 'none' }} />
              </label>
            </div>
            {/* L4: Server-Backups (nur Ausbilder) */}
            {isAusbilder && onShowBackups && (
              <button className="btn" onClick={onShowBackups} title="Tägliche Server-Snapshots verwalten"
                style={{ width: '100%', fontSize: 10, padding: '5px 0', justifyContent: 'center', marginBottom: 6 }}>
                💾 Server-Backups
              </button>
            )}

            {/* User → klickbar → Profil-Seite */}
            <button onClick={() => handleNav('/profile')} title="Mein Profil"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: path === '/profile' ? 'var(--c-acd)' : 'var(--c-sf2)', marginBottom: 5, border: 'none', borderLeft: path === '/profile' ? '2px solid var(--c-ac)' : '2px solid transparent', cursor: 'pointer', width: '100%', textAlign: 'left', transition: 'background .1s' }}
              onMouseEnter={e => { if (path !== '/profile') e.currentTarget.style.background = 'var(--c-sf3)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = path === '/profile' ? 'var(--c-acd)' : 'var(--c-sf2)'; }}>
              {currentUser?.avatar_url
                ? <img src={currentUser.avatar_url} alt={currentUser.name} style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1.5px solid rgba(255,255,255,0.1)' }} />
                : <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, background: `hsl(${hue},45%,22%)`, border: '1.5px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: `hsl(${hue},65%,75%)` }}>
                    {currentUser?.name?.split(' ').map((w: string) => w[0]).slice(0,2).join('').toUpperCase()}
                  </div>}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-br)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{firstName(currentUser?.name)}</div>
                <div style={{ fontSize: 9, color: 'var(--c-mu)', textTransform: 'uppercase', letterSpacing: .5 }}>
                  {currentUser?.role === 'azubi' ? `Azubi · LJ ${currentUser?.apprenticeship_year || 1}` : currentUser?.role === 'mentor' ? 'Mentor' : 'Ausbilder'}
                </div>
              </div>
              <span style={{ fontSize: 9, color: 'var(--c-mu)', flexShrink: 0 }}>›</span>
            </button>
          </>
        )}

        {collapsed && (
          <>
            {isAusbilder && (
              <button onClick={onNewProject} title="Neues Projekt" className="abtn" style={{ width: '100%', padding: '8px', justifyContent: 'center', marginBottom: 4, fontSize: 14 }}>
                <IcoPlus size={14} />
              </button>
            )}
            <button onClick={() => handleNav('/profile')} title="Mein Profil"
              style={{ width: '100%', padding: '6px', borderRadius: 7, border: 'none', background: 'var(--c-sf2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
              {currentUser?.avatar_url
                ? <img src={currentUser.avatar_url} alt={currentUser.name} style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(255,255,255,0.1)' }} />
                : <div style={{ width: 22, height: 22, borderRadius: '50%', background: `hsl(${hue},45%,22%)`, border: '1.5px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: `hsl(${hue},65%,75%)` }}>
                    {currentUser?.name?.split(' ').map((w: string) => w[0]).slice(0,2).join('').toUpperCase()}
                  </div>}
            </button>
          </>
        )}

        <button onClick={onToggleTheme} title={theme === 'dark' ? 'Light-Mode' : 'Dark-Mode'}
          style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 7, justifyContent: collapsed ? 'center' : 'flex-start', width: '100%', padding: collapsed ? '8px' : '7px 10px', borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--c-mu)', fontSize: 12, cursor: 'pointer', marginBottom: 2 }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--c-sf2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          {theme === 'dark' ? <IcoSun size={13} /> : <IcoMoon size={13} />}
          {!collapsed && (theme === 'dark' ? 'Light-Mode' : 'Dark-Mode')}
        </button>

        <button onClick={onLogout} title="Abmelden"
          style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 7, justifyContent: collapsed ? 'center' : 'flex-start', width: '100%', padding: collapsed ? '8px' : '7px 10px', borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--c-cr)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--c-crd)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <IcoLogout size={13} />
          {!collapsed && 'Abmelden'}
        </button>
      </div>
    </aside>
  );
}
