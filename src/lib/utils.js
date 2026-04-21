// ============================================================
//  utils.js – AzubiBoard Design System & Helpers
//  Pfad: src/utils.js
// ============================================================

// ── Farb-System ───────────────────────────────────────────────
export const C = {
  // Hintergründe
  bg:   '#0a0e14',
  sf:   '#161b22',
  sf2:  '#13181f',
  sf3:  '#0d1117',

  // Text
  tx:   '#c9d1d9',
  br:   '#f0f6fc',
  mu:   '#8b949e',

  // Borders
  bd:   '#21262d',
  bd2:  '#30363d',

  // Akzentfarben
  ac:   '#0071E3',
  acd:  'rgba(0, 113, 227, 0.1)',
  gr:   '#34C759',
  grd:  'rgba(52, 199, 89, 0.1)',
  cr:   '#FF3B30',
  crd:  'rgba(255, 59, 48, 0.1)',
  yw:   '#FF9500',
  ywd:  'rgba(255, 149, 0, 0.1)',

  // Aliase für Kompatibilität
  textPrimary:   '#f0f6fc',
  textSecondary: '#8b949e',
  primary:       '#0071E3',
  critical:      '#FF3B30',

  // Schriften
  mono: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
  sans: "system-ui, -apple-system, 'Segoe UI', sans-serif",
};

// ── Status-Konfiguration ─────────────────────────────────────
export const ST = {
  green:  { label: 'In Ordnung',     bg: '#07130a',               c: C.gr },
  yellow: { label: 'In Bearbeitung', bg: 'rgba(255,149,0,0.1)',   c: C.yw },
  red:    { label: 'Problem',        bg: 'rgba(255,59,48,0.1)',   c: C.cr },
};

// Platzhalter – werden in manchen Importen referenziert
export const S  = {};
export const T  = {};
export const Sh = {};

// ── Farbpalette (für Netzplan-Knoten) ────────────────────────
export const PAL = [
  '#0071E3', '#34C759', '#FF3B30', '#FF9500',
  '#a371f7', '#f78166', '#58c4dc', '#f0b429',
];

// ── Zeiteinheiten in Tagen ───────────────────────────────────
export const UDAYS = { W: 7, T: 1, M: 30 };

// ── ID-Generator ─────────────────────────────────────────────
export const uid = () =>
  Math.random().toString(36).slice(2, 7) + Date.now().toString(36).slice(-4);

// ── Datums-Helfer ────────────────────────────────────────────
export const today = () => new Date().toISOString().split('T')[0];

export const fmtDate = (d) => {
  if (!d) return '';
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch {
    return d;
  }
};

export const getDeadlineDaysLeft = (deadline) => {
  if (!deadline) return null;
  const diff = Math.ceil((new Date(deadline) - new Date()) / 86400000);
  return diff;
};

// ── Netzplan: Zyklus-Erkennung ───────────────────────────────
export function detectCycle(edges, from, to) {
  const adj = {};
  edges.forEach(e => {
    if (!adj[e.from]) adj[e.from] = [];
    adj[e.from].push(e.to);
  });
  const visited = new Set();
  function dfs(node) {
    if (node === from) return true;
    if (visited.has(node)) return false;
    visited.add(node);
    return (adj[node] || []).some(dfs);
  }
  return dfs(to);
}

// ── Netzplan: Topologische Sortierung ────────────────────────
function topSort(nodes, edges) {
  const inDeg = {};
  nodes.forEach(n => (inDeg[n.id] = 0));
  edges.forEach(e => { if (inDeg[e.to] !== undefined) inDeg[e.to]++; });
  const queue = nodes.filter(n => inDeg[n.id] === 0).map(n => n.id);
  const result = [];
  while (queue.length) {
    const id = queue.shift();
    result.push(id);
    edges
      .filter(e => e.from === id)
      .forEach(e => { if (--inDeg[e.to] === 0) queue.push(e.to); });
  }
  return result;
}

// ── Netzplan: CPM-Berechnung ─────────────────────────────────
export function computeCPM(nodes, edges) {
  const nodeMap = {};
  nodes.forEach(n => (nodeMap[n.id] = { ...n, faz: 0, fez: 0, saz: 0, sez: 0, gp: 0 }));

  const sorted = topSort(nodes, edges);

  // Vorwärtsrechnung
  sorted.forEach(id => {
    const n = nodeMap[id];
    const preds = edges
      .filter(e => e.to === id)
      .map(e => nodeMap[e.from])
      .filter(Boolean);
    n.faz = preds.length ? Math.max(...preds.map(p => p.fez)) : 0;
    n.fez = n.faz + n.d;
  });

  const maxFez = Math.max(...Object.values(nodeMap).map(n => n.fez), 0);

  // Rückwärtsrechnung
  [...sorted].reverse().forEach(id => {
    const n = nodeMap[id];
    const succs = edges
      .filter(e => e.from === id)
      .map(e => nodeMap[e.to])
      .filter(Boolean);
    n.sez = succs.length ? Math.min(...succs.map(s => s.saz)) : maxFez;
    n.saz = n.sez - n.d;
    n.gp  = n.saz - n.faz;
  });

  return Object.values(nodeMap);
}

// ── Netzplan: Auto-Layout ─────────────────────────────────────
export function computeLayout(nodes, edges) {
  const cols = {};
  const sorted = topSort(nodes, edges);

  sorted.forEach(id => {
    const preds = edges
      .filter(e => e.to === id)
      .map(e => cols[e.from])
      .filter(v => v !== undefined);
    cols[id] = preds.length ? Math.max(...preds) + 1 : 0;
  });

  const rowCount = {};
  const rows = {};
  sorted.forEach(id => {
    const col = cols[id] || 0;
    if (!rowCount[col]) rowCount[col] = 0;
    rows[id] = rowCount[col]++;
  });

  return nodes.map(n => ({
    ...n,
    col: cols[n.id] || 0,
    row: rows[n.id] || 0,
  }));
}

// ── Datenpersistenz ───────────────────────────────────────────
const STORAGE_KEY = 'azubiboard_v2';

export function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...getDefaultData(), ...JSON.parse(saved) };
  } catch {}
  return getDefaultData();
}

export function persistData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Speichern fehlgeschlagen:', e);
  }
}

function getDefaultData() {
  return {
    users: [
      {
        id: 'u1',
        name: 'Max Müller',
        email: 'ausbilder@firma.de',
        password: '1234',
        role: 'ausbilder',
        apprenticeship_year: null,
      },
      {
        id: 'u2',
        name: 'Anna Schmidt',
        email: 'anna@azubi.de',
        password: '1234',
        role: 'azubi',
        apprenticeship_year: 2,
      },
    ],
    projects: [],
    groups: [],
    reports: [],
    calendarEvents: [],
  };
}
