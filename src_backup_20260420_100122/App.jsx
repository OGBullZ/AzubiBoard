import { useState, useEffect, useMemo, useCallback, Component } from "react";
import { GS, C, loadData, persistData, defaultData } from './utils.js';
import { Toast, ThemeToggle } from './Components.jsx';
import {
  IcoDashboard, IcoFolder, IcoCalendar, IcoUsers,
  IcoReport, IcoLearn, IcoLogout, IcoPlus, IcoChevron,
  IcoBack, IcoChat, IcoX
} from './Icons.jsx';
import AuthPage from './AuthPage.jsx';
import { Dashboard, ProjectPool } from './Views.jsx';
import ProjectDetail from './ProjectDetail.jsx';
import { CalendarView, GroupsView, NewProjectModal } from './ExtraViews.jsx';
import LearnPage from './LearnPage.jsx';
import ReportsPage from './ReportsPage.jsx';

// ── Error Boundary (Class Component – React-Pflicht) ──────────
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null, info: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { this.setState({ info }); console.error('AzubiBoard Fehler:', error, info); }
  reset() { this.setState({ error: null, info: null }); }
  render() {
    if (!this.state.error) return this.props.children;
    const msg = this.state.error?.message || 'Unbekannter Fehler';
    const stack = this.state.info?.componentStack?.split('\n').slice(1, 4).join('\n') || '';
    return (
      <div style={{ minHeight: '100vh', background: '#080c10', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, fontFamily: "'Syne',system-ui,sans-serif" }}>
        <div style={{ maxWidth: 520, width: '100%', background: '#0d1117', border: '1px solid #e8485530', borderRadius: 12, padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: '#e8485518', border: '1px solid #e8485540', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>⚠</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#e6edf3' }}>AzubiBoard – Fehler</div>
              <div style={{ fontSize: 11, color: '#8b949e', marginTop: 2 }}>Die App ist auf einen unerwarteten Fehler gestoßen</div>
            </div>
          </div>
          <div style={{ background: '#13181f', border: '1px solid #1e2730', borderRadius: 8, padding: '10px 14px', marginBottom: 18 }}>
            <div style={{ fontSize: 12, color: '#e84855', fontFamily: "'DM Mono',monospace", wordBreak: 'break-word' }}>{msg}</div>
            {stack && <pre style={{ fontSize: 10, color: '#8b949e', margin: '8px 0 0', fontFamily: "'DM Mono',monospace", whiteSpace: 'pre-wrap', opacity: .7 }}>{stack}</pre>}
          </div>
          <div style={{ display: 'flex', gap: 9 }}>
            <button onClick={() => this.reset()} style={{ flex: 1, padding: '9px', borderRadius: 7, border: 'none', background: '#4d9de0', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'Syne',system-ui" }}>
              ↺ Erneut versuchen
            </button>
            <button onClick={() => { localStorage.clear(); window.location.reload(); }} style={{ padding: '9px 14px', borderRadius: 7, border: '1px solid #1e2730', background: 'transparent', color: '#8b949e', fontSize: 12, cursor: 'pointer', fontFamily: "'Syne',system-ui" }}>
              Daten zurücksetzen
            </button>
          </div>
        </div>
      </div>
    );
  }
}

// Exportierter Wrapper mit ErrorBoundary
export default function AppWithBoundary() {
  return <ErrorBoundary><App /></ErrorBoundary>;
}

function SideAvatar({ name, size = 28 }) {
  const initials = (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const hue = (name?.charCodeAt(0) || 200) * 37 % 360;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: `hsl(${hue},45%,22%)`, border: `2px solid hsl(${hue},45%,38%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.max(size * 0.36, 9), fontWeight: 700, color: `hsl(${hue},65%,75%)`, flexShrink: 0, userSelect: 'none', lineHeight: 1, fontFamily: "'DM Mono',monospace" }}>
      {initials}
    </div>
  );
}

const NAV = [
  { k: 'dashboard', l: 'Dashboard',     Icon: IcoDashboard },
  { k: 'projects',  l: 'Projekte',      Icon: IcoFolder    },
  { k: 'calendar',  l: 'Kalender',      Icon: IcoCalendar  },
  { k: 'groups',    l: 'Gruppen',       Icon: IcoUsers     },
  { k: 'reports',   l: 'Berichtshefte', Icon: IcoReport    },
  { k: 'learn',     l: 'Lernbereich',   Icon: IcoLearn     },
];

// ── Chat-Platzhalter Panel ────────────────────────────────────
function ChatPanel({ onClose, currentUser }) {
  const MOCK_MSGS = [
    { id: 1, from: 'Max Mustermann', role: 'ausbilder', text: 'Vergiss nicht den Abschlussbericht diese Woche.', time: '09:14', mine: false },
    { id: 2, from: 'Du', role: 'azubi', text: 'Ja, ich kümmere mich darum!', time: '09:22', mine: true },
    { id: 3, from: 'Max Mustermann', role: 'ausbilder', text: 'Gut. Das Login-Feature sieht schon sauber aus.', time: '10:05', mine: false },
  ];
  return (
    <div style={{ position: 'fixed', bottom: 0, left: 200, width: 300, height: 380, background: C.sf, border: `1px solid ${C.bd2}`, borderRadius: '12px 12px 0 0', boxShadow: 'var(--shadow-lg)', zIndex: 400, display: 'flex', flexDirection: 'column', animation: 'fadeUp .2s ease' }}>
      {/* Header */}
      <div style={{ padding: '11px 14px', borderBottom: `1px solid ${C.bd}`, display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.gr, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.br }}>Team-Chat</div>
          <div style={{ fontSize: 10, color: C.mu }}>Platzhalter · Wird entwickelt</div>
        </div>
        <button className="icn" onClick={onClose} style={{ padding: '3px 6px' }}><IcoX size={13} /></button>
      </div>
      {/* Nachrichten */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 8px' }}>
        {MOCK_MSGS.map(m => (
          <div key={m.id} style={{ display: 'flex', gap: 8, marginBottom: 12, flexDirection: m.mine ? 'row-reverse' : 'row' }}>
            <SideAvatar name={m.from} size={26} />
            <div style={{ maxWidth: '72%' }}>
              {!m.mine && <div style={{ fontSize: 10, color: C.mu, marginBottom: 3, fontWeight: 600 }}>{m.from}</div>}
              <div style={{ background: m.mine ? C.ac : C.sf2, color: m.mine ? '#fff' : C.tx, borderRadius: m.mine ? '10px 10px 2px 10px' : '10px 10px 10px 2px', padding: '7px 10px', fontSize: 12, lineHeight: 1.5 }}>
                {m.text}
              </div>
              <div style={{ fontSize: 9, color: C.mu, marginTop: 2, textAlign: m.mine ? 'right' : 'left' }}>{m.time}</div>
            </div>
          </div>
        ))}
        {/* Coming soon overlay */}
        <div style={{ background: C.acd, border: `1px solid ${C.ac}30`, borderRadius: 8, padding: '8px 12px', marginTop: 8, fontSize: 11, color: C.ac, textAlign: 'center', lineHeight: 1.6 }}>
          🚧 Chat-Funktion wird in einer späteren Version integriert
        </div>
      </div>
      {/* Input */}
      <div style={{ padding: '8px 12px', borderTop: `1px solid ${C.bd}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          <input placeholder="Nachricht…" style={{ flex: 1, fontSize: 12, padding: '6px 10px', opacity: .5, cursor: 'not-allowed' }} disabled />
          <button className="abtn" disabled style={{ padding: '6px 10px', fontSize: 11, opacity: .4 }}>→</button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [data, setData]       = useState(() => loadData() || defaultData());
  const [page, setPage]       = useState('dashboard');
  const [openPid, setOpenPid] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [toast, setToast]     = useState(null);
  const [showChat, setShowChat] = useState(false);

  const theme = useMemo(() => data.theme || 'dark', [data.theme]);
  useEffect(() => { persistData(data); }, [data]);

  useEffect(() => {
    const h = (e) => {
      if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey) setShowNew(true);
      if (e.key === 'Escape') {
        if (showChat) { setShowChat(false); return; }
        if (openPid)  { setOpenPid(null); }
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [openPid, showChat]);

  const cu = useMemo(() => data.users.find(u => u.id === data.currentUserId) || null, [data.users, data.currentUserId]);

  const showToast = useCallback((msg) => {
    if (!msg) return; setToast(msg); setTimeout(() => setToast(null), 2200);
  }, []);

  const toggleTheme = useCallback(() => {
    setData(d => ({ ...d, theme: d.theme === 'dark' ? 'light' : 'dark' }));
  }, []);

  const login    = id => setData(d => ({ ...d, currentUserId: id }));
  const logout   = () => { setData(d => ({ ...d, currentUserId: null })); setPage('dashboard'); setOpenPid(null); };
  const register = u  => setData(d => ({ ...d, users: [...d.users, u], currentUserId: u.id }));

  const updateProject = useCallback((id, patch) => {
    if (id === '_cal') { setData(d => ({ ...d, calendarEvents: [...(d.calendarEvents || []), patch.ev] })); return; }
    setData(d => ({ ...d, projects: d.projects.map(p => p.id === id ? { ...p, ...patch } : p) }));
  }, []);

  const createProject = useCallback(proj => {
    setData(d => ({ ...d, projects: [...d.projects, proj] }));
    setShowNew(false); setOpenPid(proj.id); setPage('projects');
    showToast('✓ Projekt erstellt');
  }, [showToast]);

  const deleteProject = useCallback((id, title = '') => {
    const msg1 = `Projekt "${title || 'dieses Projekt'}" löschen?\nAlle Aufgaben, Materialien und Daten gehen verloren.`;
    if (!confirm(msg1)) return;
    if (!confirm('Bist du sicher? Diese Aktion kann nicht rückgängig gemacht werden.')) return;
    setData(d => ({ ...d, projects: d.projects.filter(p => p.id !== id) }));
    if (openPid === id) setOpenPid(null);
    showToast('Projekt gelöscht');
  }, [openPid, showToast]);

  const archiveProject = useCallback(id => {
    setData(d => ({ ...d, projects: d.projects.map(p => p.id === id ? { ...p, archived: true, status: 'green' } : p) }));
    setOpenPid(null); showToast('✓ Projekt archiviert');
  }, [showToast]);

  const unarchiveProject = useCallback(id => {
    setData(d => ({ ...d, projects: d.projects.map(p => p.id === id ? { ...p, archived: false } : p) }));
    showToast('✓ Projekt wiederhergestellt');
  }, [showToast]);

  const updateGroups = useCallback(groups => setData(d => ({ ...d, groups })), []);
  const openProject  = useCallback(id => { setOpenPid(id); setPage('projects'); }, []);

  const op = data.projects.find(p => p.id === openPid);

  if (!cu) {
    return (
      <div data-theme={theme} style={{ width: '100%', height: '100%' }}>
        <style>{GS}</style>
        <AuthPage onLogin={login} users={data.users} onRegister={register} />
      </div>
    );
  }

  const urgentCount = data.projects.filter(p => {
    if (!p.deadline || p.status === 'green') return false;
    if (cu.role === 'azubi' && !p.assignees.includes(cu.id)) return false;
    return Math.ceil((new Date(p.deadline) - new Date()) / 86400000) <= 3;
  }).length;

  // Breadcrumb
  const crumbs = [{ l: NAV.find(n => n.k === page)?.l || page }];
  if (page === 'projects' && openPid && op) {
    crumbs[0].onClick = () => setOpenPid(null);
    crumbs.push({ l: op.title });
  }

  return (
    <div data-theme={theme} style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden', background: C.bg }}>
      <style>{GS}</style>
      {toast && <Toast msg={toast} />}
      {showNew && (
        <NewProjectModal users={data.users} groups={data.groups} currentUser={cu}
          onClose={() => setShowNew(false)} onCreate={createProject} />
      )}
      {showChat && <ChatPanel onClose={() => setShowChat(false)} currentUser={cu} />}

      {/* ══ SIDEBAR ══════════════════════════════════════════════ */}
      <nav aria-label="Hauptnavigation" style={{
        width: 200, flexShrink: 0, background: C.sf, borderRight: `1px solid ${C.bd}`,
        display: 'flex', flexDirection: 'column', padding: '12px 8px 10px',
        transition: 'background .25s, border-color .25s',
      }}>
        {/* Logo + Theme (NUR HIER, nicht doppelt in Topbar) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 4px', marginBottom: 18 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg,${C.ac},#2563eb)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0 }}>A</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.br, lineHeight: 1.2 }}>AzubiBoard</div>
            <div style={{ fontSize: 9, color: C.mu, textTransform: 'uppercase', letterSpacing: .5 }}>PM System</div>
          </div>
          {/* ← einziger Theme Toggle */}
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>

        {/* Nav Links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(({ k, l, Icon }) => {
            const active = page === k;
            return (
              <button key={k} className={`ni${active ? ' on' : ''}`}
                onClick={() => { setPage(k); setOpenPid(null); }}
                aria-current={active ? 'page' : undefined}>
                <span className="ni-icon"><Icon size={16} /></span>
                <span style={{ flex: 1 }}>{l}</span>
                {k === 'dashboard' && urgentCount > 0 && (
                  <span style={{ fontSize: 9, fontWeight: 800, background: C.cr, color: '#fff', borderRadius: 8, padding: '1px 5px', fontFamily: C.mono }}>{urgentCount}</span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        {/* Chat-Platzhalter */}
        <button onClick={() => setShowChat(s => !s)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: showChat ? C.acd : 'transparent', border: `1px solid ${showChat ? C.ac + '40' : 'transparent'}`, cursor: 'pointer', marginBottom: 6, transition: 'all .15s', width: '100%', textAlign: 'left' }}>
          <span className="ni-icon" style={{ color: showChat ? C.ac : C.mu }}><IcoChat size={16} /></span>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: showChat ? C.ac : C.mu }}>Team-Chat</span>
          <span style={{ fontSize: 9, background: C.yw + '30', color: C.yw, borderRadius: 6, padding: '1px 5px', fontFamily: C.mono }}>Bald</span>
        </button>

        {/* Neues Projekt Button */}
        <button className="abtn" onClick={() => setShowNew(true)}
          style={{ margin: '0 2px 8px', padding: '8px 12px', fontSize: 12, justifyContent: 'center' }}
          title="Neues Projekt (N)">
          <IcoPlus size={13} /> Neues Projekt
          <span style={{ fontSize: 9, background: 'rgba(255,255,255,.2)', borderRadius: 4, padding: '1px 5px', fontFamily: C.mono, marginLeft: 2 }}>N</span>
        </button>

        <div style={{ height: 1, background: C.bd, margin: '0 4px 8px' }} />

        {/* User */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, background: C.sf2, marginBottom: 4, border: `1px solid ${C.bd}` }}>
          <SideAvatar name={cu.name} size={28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.br, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cu.name.split(' ')[0]}</div>
            <div style={{ fontSize: 9, color: cu.role === 'ausbilder' ? C.ac : C.mu, textTransform: 'uppercase', letterSpacing: .4, fontWeight: 700 }}>
              {cu.role === 'ausbilder' ? 'Ausbilder' : `Azubi · LJ ${cu.apprenticeship_year || 1}`}
            </div>
          </div>
        </div>
        <button className="ni" onClick={logout} style={{ color: C.cr }}>
          <span className="ni-icon"><IcoLogout size={15} /></span>
          Abmelden
        </button>
      </nav>

      {/* ══ HAUPTBEREICH ════════════════════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Topbar: NUR Breadcrumb, kein zweiter Toggle */}
        <div style={{ height: 40, flexShrink: 0, background: C.sf, borderBottom: `1px solid ${C.bd}`, display: 'flex', alignItems: 'center', padding: '0 18px', gap: 8 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, minWidth: 0 }}>
            {crumbs.map((c, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {i > 0 && <IcoChevron size={10} style={{ opacity: .3, color: C.mu, flexShrink: 0 }} />}
                {c.onClick
                  ? <button onClick={c.onClick} style={{ background: 'none', border: 'none', color: C.ac, cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <IcoBack size={11} /> {c.l}
                    </button>
                  : <span style={{ color: i > 0 ? C.br : C.mu, fontWeight: i > 0 ? 700 : 500, fontSize: i > 0 ? 13 : 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 340 }}>{c.l}</span>}
              </span>
            ))}
          </div>
        </div>

        {/* Seiteninhalt */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {page === 'dashboard' && (
            <Dashboard user={cu} projects={data.projects} users={data.users}
              reports={data.reports || []}
              onNewProject={() => setShowNew(true)}
              onOpenProject={openProject}
              onUpdateProject={updateProject}
              calendarEvents={data.calendarEvents || []}
              onNavigate={k => { setPage(k); setOpenPid(null); }} />
          )}
          {page === 'projects' && (
            openPid && op
              ? <ProjectDetail key={op.id} project={op} users={data.users} groups={data.groups}
                  currentUser={cu} onUpdate={updateProject}
                  onBack={() => setOpenPid(null)}
                  onArchive={archiveProject}
                  showToast={showToast} />
              : <ProjectPool projects={data.projects} users={data.users} groups={data.groups}
                  currentUser={cu} onOpen={openProject}
                  onNew={() => setShowNew(true)}
                  onDelete={deleteProject}
                  onArchive={archiveProject}
                  onUnarchive={unarchiveProject} />
          )}
          {page === 'calendar' && (
            <CalendarView projects={data.projects} calendarEvents={data.calendarEvents || []}
              users={data.users} onUpdate={updateProject} showToast={showToast} />
          )}
          {page === 'groups' && (
            <GroupsView groups={data.groups} users={data.users} projects={data.projects}
              onUpdateGroups={updateGroups} showToast={showToast} />
          )}
          {page === 'reports' && (
            <ReportsPage currentUser={cu} data={data}
              onUpdateData={patch => setData(d => ({ ...d, ...patch }))}
              showToast={showToast} />
          )}
          {page === 'learn' && <LearnPage currentUser={cu} />}
        </div>
      </div>
    </div>
  );
}
