// ============================================================
//  utils.ts – AzubiBoard Design System & Helpers
//  Pfad: src/lib/utils.ts  (T1 Sprint 14: js → ts migriert)
// ============================================================

// ── Farb-System ───────────────────────────────────────────────
// Themebare Werte zeigen auf die CSS-Vars aus index.css (Dark + [data-theme=light]).
// Inline-Styles lösen var() auf → Light-Mode greift überall. (0.3 / Phase 1)
// Akzent-Volltöne sind seit D1 ebenfalls Tokens (Hex-Alpha-Arithmetik → color-mix migriert);
// [data-design=beta] färbt sie um, Design 1.0 behält die alten Werte aus :root.
export const C = {
  // Hintergründe
  bg:   'var(--c-bg)',
  sf:   'var(--c-sf)',
  sf2:  'var(--c-sf2)',
  sf3:  'var(--c-sf3)',

  // Text
  tx:   'var(--c-tx)',
  br:   'var(--c-br)',
  mu:   'var(--c-mu)',

  // Borders
  bd:   'var(--c-bd)',
  bd2:  'var(--c-bd2)',

  // Akzent-Vollton: themebar
  ac:   'var(--c-ac)',
  gr:   'var(--c-gr)',
  cr:   'var(--c-cr)',
  yw:   'var(--c-yw)',
  // Akzent-Tints: themebar → var(--c-*d) (index.css [data-theme=light] passt die Deckkraft an)
  acd:  'var(--c-acd)',
  grd:  'var(--c-grd)',
  crd:  'var(--c-crd)',
  ywd:  'var(--c-ywd)',

  // Aliase für Kompatibilität
  textPrimary:   'var(--c-br)',
  textSecondary: 'var(--c-mu)',
  primary:       'var(--c-ac)',
  critical:      'var(--c-cr)',

  // Schriften (Tokens aus index.css — Beta schaltet auf Archivo/Chakra Petch um)
  mono: 'var(--font-mono)',
  sans: 'var(--font-body)',
};

// ── Status-Konfiguration ─────────────────────────────────────
export const ST = {
  green:  { label: 'Abgeschlossen',   bg: 'var(--st-green-bg)',    c: C.gr },
  yellow: { label: 'In Bearbeitung', bg: 'var(--c-ywd)',          c: C.yw },
  red:    { label: 'Problem',        bg: 'var(--c-crd)',          c: C.cr },
};

// Platzhalter – werden in manchen Importen referenziert
export const S:  Record<string, unknown> = {};
export const T:  Record<string, unknown> = {};
export const Sh: Record<string, unknown> = {};

// ── Farbpalette (für Netzplan-Knoten) ────────────────────────
export const PAL = [
  '#0071E3', '#34C759', '#FF3B30', '#FF9500',
  '#a371f7', '#f78166', '#58c4dc', '#f0b429',
];

// ── Zeiteinheiten in Tagen ───────────────────────────────────
export const UDAYS = { W: 7, T: 1, M: 30 };

// ── ID-Generator ─────────────────────────────────────────────
export const uid = (): string =>
  Math.random().toString(36).slice(2, 7) + Date.now().toString(36).slice(-4);

// ── ID-Vergleich ─────────────────────────────────────────────
// IDs sind je nach Modus string (localStorage/Blob) oder number (API) — daher
// IMMER über String() vergleichen, nie roh ===. Eine Quelle gegen Drift (Bug-Hunt 3).
export const sameId = (a: unknown, b: unknown): boolean => String(a) === String(b);

// Vorname (erstes Wort) — null-sicher, eine Quelle statt verstreutem name.split(' ')[0].
export const firstName = (name?: string | null): string => (name || '').trim().split(' ')[0] || (name || '');

// ── Datums-Helfer ────────────────────────────────────────────
// Lokales Datum (YYYY-MM-DD) — NICHT toISOString() (UTC), sonst Off-by-one in positiven Zeitzonen 00–02 Uhr.
export const today = (): string => fmtLocalDate(new Date());

export const fmtDate = (d?: string | null): string => {
  if (!d) return '';
  try {
    return new Date(`${d}T12:00:00`).toLocaleDateString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch {
    return d;
  }
};

// Tagesdifferenz auf lokalen Mitternachts-Achsen. Reine Datums-Strings
// ('YYYY-MM-DD') werden sonst als UTC-Mitternacht geparst, während `now` lokal
// ist → Off-by-one im nächtlichen Zeitfenster (Bug-Hunt 3 #7).
export const dayDiffLocal = (iso: string | Date, now: Date = new Date()): number => {
  const a = iso instanceof Date ? new Date(iso)
    : new Date(typeof iso === 'string' && iso.length === 10 ? `${iso}T00:00:00` : iso);
  a.setHours(0, 0, 0, 0);
  const b = new Date(now); b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / 86400000);
};

export const getDeadlineDaysLeft = (deadline?: string | null): number | null =>
  deadline ? dayDiffLocal(deadline) : null;

// ── ISO-8601 Kalenderwoche ───────────────────────────────────
// Korrekt für Jahresgrenzen: 29.12.2025 → KW1/2026, 01.01.2024 → KW1/2024
// Akzeptiert ISO-Datumsstring ('YYYY-MM-DD') oder Date-Objekt.
export function getISOWeek(input?: string | Date | null): { year: number | null; week: number | null } {
  if (!input) return { year: null, week: null };
  const d = input instanceof Date ? new Date(input) : new Date(`${input}T12:00:00`);
  if (isNaN(d.getTime())) return { year: null, week: null };
  // Donnerstag der gleichen Woche bestimmt das Jahr (ISO 8601)
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;          // Mo=0 … So=6
  target.setUTCDate(target.getUTCDate() - dayNr + 3);  // Donnerstag dieser Woche
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNr = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNr + 3);
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return { year: target.getUTCFullYear(), week };
}

// Kompakte Variante – gibt nur Wochennummer zurück
export const getKW = (input?: string | Date | null): number | null => getISOWeek(input).week;

// Montag der ISO-Woche zu einem Datum (lokale Zeit, 00:00:00)
export function getISOWeekMonday(input?: string | Date | null): Date | null {
  const d = input instanceof Date ? new Date(input) : new Date(`${input}T12:00:00`);
  if (isNaN(d.getTime())) return null;
  const dayNr = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - dayNr);
  return d;
}

// ISO-Wochenmontag als lokales YYYY-MM-DD (DST-sicher) — Wrapper um getISOWeekMonday.
// Eine Quelle für die früher in ~8 Dateien inline duplizierte Berechnung.
export const isoWeekMonday = (input?: string | Date | null): string => fmtLocalDate(getISOWeekMonday(input));

// Lokales Datum als YYYY-MM-DD ohne UTC-Shift
export function fmtLocalDate(d?: string | Date | null): string {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── Netzplan-Typen ───────────────────────────────────────────
type NodeId = string | number;
interface GraphEdge { from: NodeId; to: NodeId; }
interface GraphNode { id: NodeId; d: number; }
interface CpmNode extends GraphNode { faz: number; fez: number; saz: number; sez: number; gp: number; }

// ── Netzplan: Zyklus-Erkennung ───────────────────────────────
export function detectCycle(edges: GraphEdge[], from: NodeId, to: NodeId): boolean {
  const adj: Record<string, NodeId[]> = {};
  edges.forEach(e => {
    if (!adj[e.from]) adj[e.from] = [];
    adj[e.from].push(e.to);
  });
  const visited = new Set<NodeId>();
  function dfs(node: NodeId): boolean {
    if (node === from) return true;
    if (visited.has(node)) return false;
    visited.add(node);
    return (adj[node] || []).some(dfs);
  }
  return dfs(to);
}

// ── Netzplan: Topologische Sortierung ────────────────────────
function topSort(nodes: GraphNode[], edges: GraphEdge[]): NodeId[] {
  const inDeg: Record<string, number> = {};
  nodes.forEach(n => (inDeg[n.id] = 0));
  edges.forEach(e => { if (inDeg[e.to] !== undefined) inDeg[e.to]++; });
  const queue = nodes.filter(n => inDeg[n.id] === 0).map(n => n.id);
  const result: NodeId[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    result.push(id);
    edges
      .filter(e => e.from === id)
      .forEach(e => { if (--inDeg[e.to] === 0) queue.push(e.to); });
  }
  return result;
}

// ── Netzplan: CPM-Berechnung ─────────────────────────────────
export function computeCPM(nodes: GraphNode[], edges: GraphEdge[]): CpmNode[] {
  const nodeMap: Record<string, CpmNode> = {};
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
export function computeLayout<TNode extends GraphNode>(
  nodes: TNode[],
  edges: GraphEdge[],
): Array<TNode & { col: number; row: number }> {
  const cols: Record<string, number> = {};
  const sorted = topSort(nodes, edges);

  sorted.forEach(id => {
    const preds = edges
      .filter(e => e.to === id)
      .map(e => cols[e.from])
      .filter(v => v !== undefined);
    cols[id] = preds.length ? Math.max(...preds) + 1 : 0;
  });

  const rowCount: Record<string, number> = {};
  const rows: Record<string, number> = {};
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

// ── Activity Log ─────────────────────────────────────────────
interface ActivityEntry { id: string; ts: string; [k: string]: unknown; }

// Generisch über den konkreten Daten-Typ (z.B. AppState): Rückgabe = Eingabe-Typ,
// damit Aufrufer keine Casts an der Boundary brauchen.
export function addActivity<T extends { activityLog?: unknown[] }>(
  data: T,
  entry: Record<string, unknown>,
): T {
  // entry = { type, userId, userName, entityTitle, projectId, projectTitle, action }
  const log = data.activityLog || [];
  const newEntry: ActivityEntry = { id: uid(), ts: new Date().toISOString(), ...entry };
  // Max 100 Einträge, neueste zuerst
  return { ...data, activityLog: [newEntry, ...log].slice(0, 100) } as T;
}

// ── Session-Management ────────────────────────────────────────
const SESSION_KEY = 'azubiboard_session';
const SESSION_TTL = 8 * 60 * 60 * 1000; // 8 Stunden

export function saveSession(userId: string | number): void {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ userId, expires: Date.now() + SESSION_TTL })); } catch { /* noop */ }
}

export function loadSession(): string | number | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null') as
      { userId?: string | number; expires?: number } | null;
    if (s?.userId != null && (s.expires ?? 0) > Date.now()) return s.userId;
  } catch { /* noop */ }
  return null;
}

export function clearSession(): void {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* noop */ }
}

// ── Datenpersistenz ───────────────────────────────────────────
const STORAGE_KEY = 'azubiboard_v2';

export function loadData(): Record<string, unknown> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...getDefaultData(), ...JSON.parse(saved) };
  } catch { /* noop */ }
  return getDefaultData();
}

export function persistData(data: Record<string, unknown>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

function getDefaultData(): Record<string, unknown> {
  // SHA-256('1234') – Passwörter niemals im Klartext speichern
  const PW = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';
  return {
    users: [
      { id: 'u1', name: 'Max Müller',   email: 'ausbilder@firma.de', password: PW, role: 'ausbilder', apprenticeship_year: null },
      { id: 'u2', name: 'Anna Schmidt', email: 'anna@azubi.de',       password: PW, role: 'azubi',     apprenticeship_year: 2   },
    ],
    projects: [],
    groups: [],
    reports: [],
    calendarEvents: [],
  };
}
