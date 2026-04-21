// ── CPM ───────────────────────────────────────────────────────
export function detectCycle(edges, f, t) {
  const adj = {};
  edges.forEach(e => { if (!adj[e.from]) adj[e.from] = []; adj[e.from].push(e.to); });
  const vis = new Set(), q = [t];
  while (q.length) { const c = q.shift(); if (c === f) return true; if (vis.has(c)) continue; vis.add(c); (adj[c] || []).forEach(n => q.push(n)); }
  return false;
}
export function computeCPM(nodes, edges) {
  if (!nodes.length) return [];
  const s = {}, p = {};
  nodes.forEach(n => { s[n.id] = []; p[n.id] = []; });
  edges.forEach(({ from, to }) => { if (s[from] !== undefined && p[to] !== undefined) { s[from].push(to); p[to].push(from); } });
  const dg = {}; nodes.forEach(n => (dg[n.id] = p[n.id].length));
  const q = nodes.filter(n => dg[n.id] === 0).map(n => n.id), or = [], dc = { ...dg };
  while (q.length) { const c = q.shift(); or.push(c); s[c].forEach(x => { if (--dc[x] === 0) q.push(x); }); }
  const faz = {}, fez = {};
  or.forEach(id => { const d = nodes.find(n => n.id === id)?.d ?? 1; faz[id] = p[id].length ? Math.max(...p[id].map(x => fez[x] ?? 0)) : 0; fez[id] = faz[id] + d; });
  const mx = or.length ? Math.max(...or.map(id => fez[id] ?? 0)) : 0;
  const saz = {}, sez = {};
  [...or].reverse().forEach(id => { const d = nodes.find(n => n.id === id)?.d ?? 1; sez[id] = s[id].length ? Math.min(...s[id].map(x => saz[x] ?? Infinity)) : mx; if (!isFinite(sez[id])) sez[id] = fez[id]; saz[id] = sez[id] - d; });
  return nodes.map(n => ({ ...n, faz: faz[n.id] ?? 0, fez: fez[n.id] ?? n.d, saz: saz[n.id] ?? 0, sez: sez[n.id] ?? n.d, gp: Math.round(((saz[n.id] ?? 0) - (faz[n.id] ?? 0)) * 100) / 100 }));
}
export function computeLayout(nodes, edges) {
  if (!nodes.length) return [];
  const s = {}, p = {};
  nodes.forEach(n => { s[n.id] = []; p[n.id] = []; });
  edges.forEach(({ from, to }) => { if (s[from] !== undefined && p[to] !== undefined) { s[from].push(to); p[to].push(from); } });
  const col = {}; nodes.forEach(n => (col[n.id] = 0));
  const dc = {}; nodes.forEach(n => (dc[n.id] = p[n.id].length));
  const q = nodes.filter(n => dc[n.id] === 0).map(n => n.id);
  while (q.length) { const c = q.shift(); s[c].forEach(x => { col[x] = Math.max(col[x], col[c] + 1); if (--dc[x] === 0) q.push(x); }); }
  const bc = {}; nodes.forEach(n => { if (!bc[col[n.id]]) bc[col[n.id]] = []; bc[col[n.id]].push(n.id); });
  const row = {}; Object.keys(bc).forEach(c => bc[c].forEach((id, i) => (row[id] = i)));
  return nodes.map(n => ({ ...n, col: col[n.id] ?? 0, row: row[n.id] ?? 0 }));
}

// ── Storage ───────────────────────────────────────────────────
const SK     = 'azubi_pm_v7';
const SK_OLD = 'azubi_pm_v6';

// ── Migration: fehlende Felder auf alten Daten auffüllen ──────
function migrateData(d) {
  if (!d) return null;
  // Projekt-Felder
  if (d.projects) {
    d.projects = d.projects.map(p => ({
      links: [], archived: false, calendarEvents: [],
      ...p,
      // Tasks normalisieren
      tasks: (p.tasks || []).map(t => ({
        links: [], doc: '', protocol: '', materialRef: [],
        ...t,
        status: t.done ? 'done' : (t.status || 'not_started'),
      })),
      // Netzplan-Struktur sicherstellen
      netzplan: p.netzplan || { nodes: [], edges: [], unit: 'W', nodePositions: {} },
    }));
  }
  if (!d.groups)         d.groups         = [];
  if (!d.reports)        d.reports        = [];
  if (!d.calendarEvents) d.calendarEvents = [];
  if (!d.theme)          d.theme          = 'dark';
  return d;
}

export function loadData() {
  try {
    // Erst v7 versuchen
    let raw = localStorage.getItem(SK);
    if (raw) return migrateData(JSON.parse(raw));
    // v6 migrieren
    raw = localStorage.getItem(SK_OLD);
    if (raw) {
      const d = migrateData(JSON.parse(raw));
      if (d) { localStorage.setItem(SK, JSON.stringify(d)); localStorage.removeItem(SK_OLD); }
      return d;
    }
    return null;
  } catch { return null; }
}
export function persistData(d) { try { localStorage.setItem(SK, JSON.stringify(d)); } catch {} }

// ── Helpers ───────────────────────────────────────────────────
export const uid     = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
export const today   = () => new Date().toISOString().split('T')[0];
export const fmtDate = s  => s ? new Date(s + 'T12:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–';
export const UDAYS   = { W: 7, T: 1, M: 30 };
export const PAL     = ['#4d9de0','#e84855','#3fb950','#d29922','#a371f7','#f78166','#56d364','#58a6ff','#ffa657'];

// ── C: CSS-Variablen Referenzen ───────────────────────────────
export const C = {
  bg: 'var(--c-bg)', sf: 'var(--c-sf)', sf2: 'var(--c-sf2)', sf3: 'var(--c-sf3)',
  bd: 'var(--c-bd)', bd2: 'var(--c-bd2)',
  tx: 'var(--c-tx)', mu: 'var(--c-mu)', br: 'var(--c-br)',
  ac: 'var(--c-ac)', acd: 'var(--c-acd)',
  cr: 'var(--c-cr)', crd: 'var(--c-crd)',
  gr: 'var(--c-gr)', yw: 'var(--c-yw)', ywd: 'var(--c-ywd)',
  mono: "'DM Mono','Courier New',monospace",
  sans: "'Syne',system-ui,sans-serif",
};

export const ST = {
  green:  { c: 'var(--c-gr)', label: 'In Ordnung',     bg: 'var(--st-green-bg)'  },
  yellow: { c: 'var(--c-yw)', label: 'In Bearbeitung',  bg: 'var(--st-yellow-bg)' },
  red:    { c: 'var(--c-cr)', label: 'Problem',         bg: 'var(--st-red-bg)'    },
};

// ── Default Data ──────────────────────────────────────────────
export function mkProject(o = {}) {
  return {
    id: uid(), title: 'Neues Projekt', description: '', status: 'yellow',
    assignees: [], groupId: null, startDate: today(), deadline: '',
    materials: [], requirements: [], tasks: [], steps: [],
    calendarEvents: [], links: [],
    netzplan: { nodes: [], edges: [], unit: 'W', nodePositions: {} },
    ...o,
  };
}

export function defaultData() {
  const a1 = uid(), a2 = uid(), ad = uid(), g1 = uid(), p1 = uid();
  return {
    users: [
      { id: ad, name: 'Max Mustermann', email: 'ausbilder@firma.de', password: '1234', role: 'ausbilder', theme: 'dark', apprenticeship_year: 0 },
      { id: a1, name: 'Anna Schmidt',   email: 'anna@azubi.de',      password: '1234', role: 'azubi',     theme: 'dark', apprenticeship_year: 2 },
      { id: a2, name: 'Ben Müller',     email: 'ben@azubi.de',       password: '1234', role: 'azubi',     theme: 'dark', apprenticeship_year: 1 },
    ],
    groups:  [{ id: g1, name: 'IT-Azubis 2024', type: 'department', members: [a1, a2] }],
    reports: [],
    calendarEvents: [{ id: uid(), date: '2026-03-20', title: 'Zwischenpräsentation', projectId: p1, note: '', type: 'meeting' }],
    currentUserId: null,
    theme: 'dark',
    projects: [mkProject({
      id: p1, title: 'Weboberfläche Azubi-Verwaltung',
      description: 'Digitales System zur Projektzuweisung der Auszubildenden.',
      status: 'yellow', assignees: [a1], groupId: g1,
      startDate: '2026-01-01', deadline: '2026-06-30',
      links: [
        { id: uid(), url: 'https://www.php.net/manual/de/', title: 'PHP Handbuch', type: 'doc', note: 'Offizielle Dokumentation' },
        { id: uid(), url: 'https://developer.mozilla.org/de/', title: 'MDN Web Docs', type: 'tutorial', note: '' },
      ],
      requirements: [
        { id: uid(), text: 'Datenbankstruktur erstellen', done: true },
        { id: uid(), text: 'Backend in PHP entwickeln',  done: false },
        { id: uid(), text: 'Frontend gestalten',          done: false },
      ],
      tasks: [
        { id: uid(), text: 'Anforderungsanalyse',  status: 'done',        priority: 'high',   note: 'Abgesprochen mit Ausbilder', doc: '', protocol: '', links: [], deadline: '2026-01-10', assignee: a1 },
        { id: uid(), text: 'ER-Diagramm zeichnen', status: 'done',        priority: 'high',   note: '', doc: '', protocol: '', links: [], deadline: '2026-01-15', assignee: a1 },
        { id: uid(), text: 'Login implementieren', status: 'in_progress', priority: 'high',   note: '', doc: '', protocol: '', links: [{ id: uid(), url: 'https://www.php.net/manual/de/book.session.php', title: 'PHP Sessions', type: 'doc', note: '' }], deadline: '2026-02-01', assignee: a1 },
        { id: uid(), text: 'Frontend gestalten',   status: 'not_started', priority: 'medium', note: '', doc: '', protocol: '', links: [], deadline: '2026-02-15', assignee: a1 },
        { id: uid(), text: 'Testing & Bugs',        status: 'not_started', priority: 'low',    note: '', doc: '', protocol: '', links: [], deadline: '2026-03-01', assignee: a1 },
      ],
      materials: [
        { id: uid(), name: 'XAMPP', qty: 1, cost: 0 },
        { id: uid(), name: 'Hosting (6 Monate)', qty: 6, cost: 12 },
      ],
      steps: [{ id: uid(), title: 'Projekt-Kickoff', date: '2026-01-02', note: 'Erstes Meeting. Stack: PHP, MySQL, HTML/CSS/JS.' }],
      netzplan: {
        unit: 'W', nodePositions: {},
        nodes: [{ id: 1, name: 'Planung', d: 1 }, { id: 2, name: 'Datenbank', d: 1 }, { id: 3, name: 'Backend', d: 2 }, { id: 4, name: 'Frontend', d: 2 }, { id: 5, name: 'Testing', d: 1 }],
        edges: [{ id: 'e1', from: 1, to: 2 }, { id: 'e2', from: 2, to: 3 }, { id: 'e3', from: 2, to: 4 }, { id: 'e4', from: 3, to: 5 }, { id: 'e5', from: 4, to: 5 }],
      },
    })],
  };
}

// ── Global CSS (Desktop-First) ────────────────────────────────
export const GS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap');

/* ── Dark Theme ── */
:root {
  --c-bg:  #080c10;
  --c-sf:  #0d1117;
  --c-sf2: #13181f;
  --c-sf3: #0a0e14;
  --c-bd:  #1e2730;
  --c-bd2: #2d3748;
  --c-tx:  #c9d1d9;
  --c-mu:  #8b949e;
  --c-br:  #e6edf3;
  --c-ac:  #4d9de0;
  --c-acd: #4d9de018;
  --c-cr:  #e84855;
  --c-crd: #e8485514;
  --c-gr:  #3fb950;
  --c-yw:  #d29922;
  --c-ywd: #d2992214;
  --st-green-bg:  #061209;
  --st-yellow-bg: #120f08;
  --st-red-bg:    #120809;
  --shadow:    0 2px 12px rgba(0,0,0,.5);
  --shadow-lg: 0 8px 40px rgba(0,0,0,.7);
}
/* ── Light Theme ── */
[data-theme="light"] {
  --c-bg:  #f0f4f8;
  --c-sf:  #ffffff;
  --c-sf2: #f5f7fa;
  --c-sf3: #eef1f6;
  --c-bd:  #dde3ec;
  --c-bd2: #c4cdd9;
  --c-tx:  #374151;
  --c-mu:  #6b7280;
  --c-br:  #111827;
  --c-ac:  #2563eb;
  --c-acd: #2563eb12;
  --c-cr:  #dc2626;
  --c-crd: #dc262612;
  --c-gr:  #16a34a;
  --c-yw:  #d97706;
  --c-ywd: #d9770612;
  --st-green-bg:  #dcfce7;
  --st-yellow-bg: #fef3c7;
  --st-red-bg:    #fee2e2;
  --shadow:    0 2px 8px rgba(0,0,0,.08);
  --shadow-lg: 0 8px 24px rgba(0,0,0,.12);
}

/* ── Reset & Base ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #root { height: 100%; width: 100%; overflow: hidden; }
body { min-width: 900px; }
body {
  background: var(--c-bg);
  color: var(--c-tx);
  font-family: 'Syne', system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

/* Scrollbar */
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-thumb { background: var(--c-bd2); border-radius: 3px; }
::-webkit-scrollbar-track { background: transparent; }

/* ── Inputs ── */
input, select, textarea {
  background: var(--c-sf2);
  border: 1px solid var(--c-bd2);
  color: var(--c-br);
  border-radius: 7px;
  padding: 7px 11px;
  font-family: 'Syne', system-ui, sans-serif;
  font-size: 13px;
  width: 100%;
  outline: none;
  transition: border-color .15s, box-shadow .15s;
}
input:focus, select:focus, textarea:focus {
  border-color: var(--c-ac);
  box-shadow: 0 0 0 3px var(--c-acd);
}
input::placeholder, textarea::placeholder { color: var(--c-mu); }
select option { background: var(--c-sf2); }
textarea { resize: vertical; min-height: 72px; font-size: 12px; line-height: 1.65; }
button { cursor: pointer; font-family: 'Syne', system-ui, sans-serif; border: none; transition: all .15s; }
button:disabled { opacity: .4; cursor: not-allowed; }
button:focus-visible { outline: 2px solid var(--c-ac); outline-offset: 2px; }
label {
  font-size: 11px; color: var(--c-mu);
  text-transform: uppercase; letter-spacing: .8px;
  font-weight: 700; display: block; margin-bottom: 5px;
}

/* ── Layout-Klassen ── */
.card {
  background: var(--c-sf2);
  border: 1px solid var(--c-bd);
  border-radius: 10px;
  padding: 14px;
}

/* ── Buttons ── */
.abtn {
  background: var(--c-ac); color: #fff;
  border-radius: 7px; padding: 7px 14px;
  font-weight: 700; font-size: 12px; border: none;
  display: inline-flex; align-items: center; gap: 6px;
}
.abtn:hover:not(:disabled) { filter: brightness(1.1); }

.btn {
  background: var(--c-sf2); color: var(--c-tx);
  border-radius: 7px; padding: 6px 11px;
  font-size: 12px; font-weight: 600;
  border: 1px solid var(--c-bd2);
  display: inline-flex; align-items: center; gap: 5px;
}
.btn:hover:not(:disabled) { border-color: var(--c-ac); color: var(--c-ac); }

.del {
  background: none; color: var(--c-mu);
  padding: 3px 7px; border-radius: 5px;
  font-size: 15px; line-height: 1; border: none;
}
.del:hover { background: var(--c-crd); color: var(--c-cr); }

.icn {
  background: none; color: var(--c-mu);
  padding: 3px 7px; border-radius: 5px;
  font-size: 12px; border: none;
  display: inline-flex; align-items: center; gap: 4px;
}
.icn:hover { background: var(--c-acd); color: var(--c-ac); }

/* ── Sidebar Nav ── */
.ni {
  display: flex; align-items: center; gap: 9px;
  padding: 8px 10px; border-radius: 8px;
  font-size: 13px; font-weight: 600;
  color: var(--c-mu); border: none; background: none;
  width: 100%; text-align: left; cursor: pointer;
  transition: background .12s, color .12s;
}
.ni:hover { background: var(--c-sf2); color: var(--c-tx); }
.ni.on  { background: var(--c-acd); color: var(--c-ac); font-weight: 700; }
.ni-icon { width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

/* ── Tag / Badge ── */
.tag {
  display: inline-flex; align-items: center;
  border-radius: 5px; font-size: 10px; font-weight: 700;
  padding: 2px 7px; white-space: nowrap;
  font-family: 'DM Mono', monospace;
}

/* ── Progress ── */
.progress-track { background: var(--c-bd2); border-radius: 2px; overflow: hidden; }
.progress-fill  { height: 100%; border-radius: 2px; transition: width .35s ease; }

/* ── Row Hover ── */
.row-btn {
  display: flex; align-items: center;
  width: 100%; background: none; border: none;
  cursor: pointer; text-align: left;
  padding: 6px 8px; border-radius: 7px;
  transition: background .1s;
}
.row-btn:hover { background: var(--c-sf3); }

/* ── Animationen ── */
@keyframes fadeUp  { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
@keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
@keyframes toastIn { from { opacity:0; transform:translate(-50%,6px) } to { opacity:1; transform:translate(-50%,0) } }
@keyframes spin    { to { transform:rotate(360deg) } }
.anim { animation: fadeUp .18s ease; }

/* ── Projekt-Karte: Hover-Aktion ── */
.proj-card { position: relative; }
.proj-card .hover-action { opacity: 0; transition: opacity .15s; pointer-events: none; }
.proj-card:hover .hover-action { opacity: 1; pointer-events: all; }
`;
