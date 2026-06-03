import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Id, User, LearningPath, LearningPathNode } from '../../types';
import { C, uid } from '../../lib/utils.js';
import { Modal, Field, ProgressBar, EmptyState } from '../../components/UI.jsx';
import AiGoalSuggestions from './AiGoalSuggestions.jsx';

// Ad-hoc Fortschritts-Map (Runtime-Form weicht von pathProgress-Schema ab):
// pro Node-Id ein { completed } Flag.
type ProgressMap = Record<string, { completed?: boolean; completedAt?: string } | undefined>;

// ── Topological sort (Kahn's algorithm) ───────────────────────
function topoSort(nodes: LearningPathNode[]) {
  const map = Object.fromEntries(nodes.map(n => [n.id, n]));
  const inDeg: Record<string, number> = Object.fromEntries(nodes.map(n => [n.id, 0]));
  nodes.forEach(n => n.prereqs.forEach((p: Id) => { if (map[p]) inDeg[n.id]++; }));
  const queue = nodes.filter(n => inDeg[n.id] === 0).map(n => n.id);
  const sorted: Id[] = [];
  while (queue.length) {
    const cur = queue.shift();
    sorted.push(cur!);
    nodes.forEach(n => {
      if (n.prereqs.includes(cur!)) {
        inDeg[n.id]--;
        if (inDeg[n.id] === 0) queue.push(n.id);
      }
    });
  }
  // append any cycle-remaining nodes at the end
  nodes.forEach(n => { if (!sorted.includes(n.id)) sorted.push(n.id); });
  return sorted.map(id => map[id]).filter(Boolean);
}

// ── Fortschritt eines Pfades berechnen ────────────────────────
function pathStats(path: LearningPath, progress: ProgressMap) {
  const total = path.nodes.length;
  const done  = path.nodes.filter((n: LearningPathNode) => progress[n.id]?.completed).length;
  return { total, done, pct: total ? Math.round(done / total * 100) : 0 };
}

// ── Ist ein Node freigeschalten? ──────────────────────────────
function isUnlocked(node: LearningPathNode, progress: ProgressMap) {
  return node.prereqs.every((pid: Id) => progress[pid]?.completed);
}

const LEHRJAHR_COLOR: Record<number, string> = { 1: C.gr, 2: C.ac, 3: C.yw };
const TYPE_ICON: Record<string, string> = { article: '📖', link: '🔗', quiz: '🧩', task: '✅' };

type PathForm = { title: string; description: string; lehrjahr: number };
type NodeForm = { title: string; description: string; type: string; prereqs: string[]; content: string; _id?: string };

const EMPTY_PATH: PathForm = { title: '', description: '', lehrjahr: 1 };
const EMPTY_NODE: NodeForm = { title: '', description: '', type: 'article', prereqs: [], content: '' };

// ── Detail-Ansicht eines Lernpfades ───────────────────────────
type PathDetailViewProps = {
  path: LearningPath;
  progress: ProgressMap;
  onComplete: (nodeId: Id) => void;
  onBack: () => void;
  isAusbilder: boolean;
  onEditPath: () => void;
  onAddNode: () => void;
  onEditNode: (node: LearningPathNode) => void;
  onDeleteNode: (nodeId: Id) => void;
  onAiSuggest: () => void;
};

function PathDetailView({ path, progress, onComplete, onBack, isAusbilder, onEditPath, onAddNode, onEditNode, onDeleteNode, onAiSuggest }: PathDetailViewProps) {
  const sorted   = topoSort(path.nodes);
  const [selNode, setSelNode] = useState<LearningPathNode | null>(null);

  const color = LEHRJAHR_COLOR[path.lehrjahr as number] || C.ac;
  const stats = pathStats(path, progress);

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }} className="anim">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <button className="btn" onClick={onBack} style={{ padding: '5px 10px', fontSize: 11 }}>← Zurück</button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: C.br, margin: 0 }}>{path.title}</h2>
          {path.description && <div style={{ fontSize: 12, color: C.mu, marginTop: 2 }}>{path.description}</div>}
        </div>
        <span className="tag" style={{ background: color + '20', color, border: `1px solid ${color}40` }}>
          {path.lehrjahr}. Lehrjahr
        </span>
        {isAusbilder && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn" onClick={onEditPath} style={{ fontSize: 11, padding: '4px 10px' }}>✎ Pfad</button>
            <button className="btn" onClick={onAiSuggest}
              style={{ fontSize: 11, padding: '4px 10px', color: C.ac, borderColor: C.ac + '60' }}
              title="KI-Lernziele vorschlagen">🤖 KI</button>
            <button className="abtn" onClick={onAddNode} style={{ fontSize: 11, padding: '4px 10px' }}>+ Lernziel</button>
          </div>
        )}
      </div>

      {/* Progress */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.mu, marginBottom: 4 }}>
          <span>{stats.done} / {stats.total} Lernziele abgeschlossen</span>
          <span style={{ color, fontWeight: 700 }}>{stats.pct}%</span>
        </div>
        <ProgressBar value={stats.pct} color={color} height={6} label={`${stats.pct}%`} />
      </div>

      {path.nodes.length === 0 ? (
        <EmptyState icon="🗺️" title="Noch keine Lernziele" subtitle={isAusbilder ? 'Füge das erste Lernziel über + Lernziel hinzu.' : 'Dieser Pfad hat noch keine Inhalte.'} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {sorted.map((node, idx) => {
            const done     = !!progress[node.id]?.completed;
            const unlocked = isUnlocked(node, progress);
            const locked   = !unlocked && !done;

            const borderColor = done ? C.gr : unlocked ? color : C.bd;
            const bgColor     = done ? '#07130a' : unlocked ? C.sf : C.sf3;
            const textColor   = locked ? C.mu : C.br;

            return (
              <div key={node.id} style={{ display: 'flex', gap: 0 }}>
                {/* Connector line */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32, flexShrink: 0 }}>
                  {idx > 0 && <div style={{ width: 2, height: 14, background: C.bd }} />}
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    background: done ? C.gr : unlocked ? color : C.bd2,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 800, color: done || unlocked ? '#fff' : C.mu,
                    transition: 'all .2s',
                  }}>
                    {done ? '✓' : locked ? '🔒' : idx + 1}
                  </div>
                  {idx < sorted.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 14, background: C.bd }} />}
                </div>

                {/* Node card */}
                <div className="card" onClick={() => !locked && setSelNode(node)} style={{
                  flex: 1, marginLeft: 8, marginBottom: 8, background: bgColor,
                  borderColor, cursor: locked ? 'default' : 'pointer',
                  opacity: locked ? 0.6 : 1, transition: 'all .15s',
                }}
                  onMouseEnter={e => { if (!locked) { e.currentTarget.style.borderColor = color; e.currentTarget.style.transform = 'translateX(3px)'; }}}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = borderColor; e.currentTarget.style.transform = 'none'; }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ fontSize: 18, lineHeight: 1, marginTop: 1 }}>{TYPE_ICON[node.type as string] || '📋'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: textColor, marginBottom: node.description ? 3 : 0 }}>
                        {node.title}
                        {done && <span style={{ marginLeft: 8, fontSize: 10, color: C.gr, fontWeight: 600 }}>Abgeschlossen</span>}
                        {locked && <span style={{ marginLeft: 8, fontSize: 10, color: C.mu, fontWeight: 600 }}>Gesperrt</span>}
                      </div>
                      {node.description && <div style={{ fontSize: 12, color: C.mu, lineHeight: 1.5 }}>{node.description}</div>}
                      {node.prereqs.length > 0 && (
                        <div style={{ fontSize: 10, color: C.mu, marginTop: 4 }}>
                          Voraussetzung: {node.prereqs.map((pid: Id) => {
                            const pre = path.nodes.find((n: LearningPathNode) => n.id === pid);
                            return pre ? (
                              <span key={pid} style={{ marginRight: 6, color: progress[pid]?.completed ? C.gr : C.yw }}>
                                {progress[pid]?.completed ? '✓' : '○'} {pre.title}
                              </span>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>
                    {isAusbilder && (
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                        <button className="btn" onClick={() => onEditNode(node)} style={{ padding: '2px 7px', fontSize: 11 }}>✎</button>
                        <button className="del" onClick={() => onDeleteNode(node.id)} aria-label="Lernziel löschen">×</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Node detail overlay */}
      {selNode && (
        <NodeModal
          node={selNode}
          done={!!progress[selNode.id]?.completed}
          onComplete={() => { onComplete(selNode.id); setSelNode(null); }}
          onClose={() => setSelNode(null)}
        />
      )}
    </div>
  );
}

// ── Node-Detail Modal ─────────────────────────────────────────
type NodeModalProps = { node: LearningPathNode; done: boolean; onComplete: () => void; onClose: () => void };

function NodeModal({ node, done, onComplete, onClose }: NodeModalProps) {
  return (
    <Modal title={node.title} onClose={onClose} width={520}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <span className="tag" style={{ background: C.sf2, color: C.mu, border: `1px solid ${C.bd}` }}>
          {TYPE_ICON[node.type as string]} {node.type === 'article' ? 'Artikel' : node.type === 'link' ? 'Link' : node.type === 'quiz' ? 'Quiz' : 'Aufgabe'}
        </span>
        {done && <span className="tag" style={{ background: '#07130a', color: C.gr, border: `1px solid ${C.gr}40` }}>✓ Abgeschlossen</span>}
      </div>

      {node.description && (
        <div style={{ fontSize: 13, color: C.tx, lineHeight: 1.7, marginBottom: 16 }}>{node.description}</div>
      )}

      {node.content && node.type === 'link' && (
        <a href={node.content} target="_blank" rel="noreferrer"
          style={{ display: 'block', padding: '10px 14px', background: C.acd, border: `1px solid ${C.ac}30`, borderRadius: 8, fontSize: 13, color: C.ac, marginBottom: 16, wordBreak: 'break-all' }}>
          🔗 {node.content}
        </a>
      )}

      {node.content && node.type === 'article' && (
        <div style={{ background: C.sf2, border: `1px solid ${C.bd}`, borderRadius: 8, padding: '12px 14px', fontSize: 13, color: C.tx, lineHeight: 1.7, marginBottom: 16, whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto' }}>
          {node.content}
        </div>
      )}

      {!done && (
        <button className="abtn" onClick={onComplete} style={{ width: '100%', padding: 11 }}>
          ✓ Als abgeschlossen markieren
        </button>
      )}
    </Modal>
  );
}

// ── Pfad-Edit Modal ───────────────────────────────────────────
type PathModalProps = {
  form: PathForm;
  setForm: Dispatch<SetStateAction<PathForm>>;
  onSave: () => void;
  onClose: () => void;
  title: string;
};

function PathModal({ form, setForm, onSave, onClose, title }: PathModalProps) {
  return (
    <Modal title={title} onClose={onClose} width={460}>
      <Field label="Titel">
        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="z.B. Java Grundlagen – 1. Lehrjahr" autoFocus />
      </Field>
      <Field label="Beschreibung (optional)">
        <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Kurze Beschreibung des Lernpfades..." rows={2} />
      </Field>
      <Field label="Lehrjahr">
        <select value={form.lehrjahr} onChange={e => setForm(f => ({ ...f, lehrjahr: Number(e.target.value) }))}>
          <option value={1}>1. Lehrjahr</option>
          <option value={2}>2. Lehrjahr</option>
          <option value={3}>3. Lehrjahr</option>
        </select>
      </Field>
      <button className="abtn" onClick={onSave}
        disabled={!form.title.trim()}
        style={{ width: '100%', padding: 11, marginTop: 6 }}>
        Speichern
      </button>
    </Modal>
  );
}

// ── Node-Edit Modal ───────────────────────────────────────────
type NodeEditModalProps = {
  form: NodeForm;
  setForm: Dispatch<SetStateAction<NodeForm>>;
  onSave: () => void;
  onClose: () => void;
  title: string;
  allNodes: LearningPathNode[];
};

function NodeEditModal({ form, setForm, onSave, onClose, title, allNodes }: NodeEditModalProps) {
  return (
    <Modal title={title} onClose={onClose} width={520}>
      <Field label="Titel">
        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="z.B. Variablen und Datentypen" autoFocus />
      </Field>
      <Field label="Beschreibung (optional)">
        <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Was wird in diesem Lernziel vermittelt?" rows={2} />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="Typ">
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value, content: '' }))}>
            <option value="article">📖 Artikel / Text</option>
            <option value="link">🔗 Link / Ressource</option>
            <option value="task">✅ Aufgabe</option>
          </select>
        </Field>
        <Field label="Voraussetzungen">
          <select multiple value={form.prereqs}
            onChange={e => setForm(f => ({ ...f, prereqs: [...e.target.selectedOptions].map(o => o.value) }))}
            style={{ height: 72 }}>
            {allNodes.filter((n: LearningPathNode) => n.id !== form._id).map((n: LearningPathNode) => (
              <option key={n.id} value={n.id}>{n.title}</option>
            ))}
          </select>
        </Field>
      </div>
      {(form.type === 'article' || form.type === 'task') && (
        <Field label={form.type === 'article' ? 'Inhalt' : 'Aufgabenbeschreibung'}>
          <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
            placeholder={form.type === 'article' ? 'Lerninhalt eingeben...' : 'Aufgabe beschreiben...'} rows={4} />
        </Field>
      )}
      {form.type === 'link' && (
        <Field label="URL">
          <input value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
            placeholder="https://..." type="url" />
        </Field>
      )}
      <button className="abtn" onClick={onSave}
        disabled={!form.title.trim()}
        style={{ width: '100%', padding: 11, marginTop: 6 }}>
        Speichern
      </button>
    </Modal>
  );
}

// ── Haupt-Komponente: Liste aller Lernpfade ───────────────────
type LernpfadeViewProps = {
  currentUser: User;
  data: any;
  setData: (updater: (d: any) => any) => void;
  onBack: () => void;
};

export default function LernpfadeView({ currentUser, data, setData, onBack }: LernpfadeViewProps) {
  const [selPath,       setSelPath]       = useState<LearningPath | null>(null);
  const [showPathModal, setShowPathModal] = useState(false);
  const [pathForm,      setPathForm]      = useState<PathForm>(EMPTY_PATH);
  const [editingPath,   setEditingPath]   = useState<LearningPath | null>(null);
  const [showNodeModal, setShowNodeModal] = useState(false);
  const [nodeForm,      setNodeForm]      = useState<NodeForm>(EMPTY_NODE);
  const [editingNode,   setEditingNode]   = useState<LearningPathNode | null>(null);
  const [showAiModal,   setShowAiModal]   = useState(false);

  const isAusbilder  = currentUser?.role === 'ausbilder';
  const userId       = currentUser?.id || 'anon';
  const learningPaths: LearningPath[] = data?.learningPaths || [];
  const pathProgress: ProgressMap      = data?.pathProgress?.[userId] || {};

  const savePaths = (next: LearningPath[]) => setData(d => ({ ...d, learningPaths: next }));
  const saveProgress = (nodeId: Id) => setData(d => ({
    ...d,
    pathProgress: {
      ...(d.pathProgress || {}),
      [userId]: {
        ...(d.pathProgress?.[userId] || {}),
        [nodeId]: { completed: true, completedAt: new Date().toISOString() },
      },
    },
  }));

  // ── Path CRUD ──
  const openCreatePath = () => { setPathForm(EMPTY_PATH); setEditingPath(null); setShowPathModal(true); };
  const openEditPath   = (path: LearningPath) => { setPathForm({ title: path.title, description: path.description || '', lehrjahr: path.lehrjahr ?? 1 }); setEditingPath(path); setShowPathModal(true); };
  const savePathForm   = () => {
    if (!pathForm.title.trim()) return;
    if (editingPath) {
      savePaths(learningPaths.map((p: LearningPath) => p.id === editingPath.id ? { ...p, ...pathForm } : p));
    } else {
      savePaths([...learningPaths, { id: uid(), nodes: [], ...pathForm }]);
    }
    setShowPathModal(false);
  };
  const deletePath = (id: Id) => {
    savePaths(learningPaths.filter((p: LearningPath) => p.id !== id));
    if (selPath?.id === id) setSelPath(null);
  };

  // ── Node CRUD (within selPath) ──
  const openAddNode  = () => { setNodeForm({ ...EMPTY_NODE }); setEditingNode(null); setShowNodeModal(true); };
  const openEditNode = (node: LearningPathNode) => {
    setNodeForm({ title: node.title, description: node.description || '', type: node.type || 'article', prereqs: (node.prereqs || []).map(String), content: node.content || '', _id: String(node.id) });
    setEditingNode(node);
    setShowNodeModal(true);
  };
  const saveNodeForm = () => {
    if (!nodeForm.title.trim() || !selPath) return;
    const patch = (nodes: LearningPathNode[]): LearningPathNode[] => {
      if (editingNode) {
        return nodes.map((n: LearningPathNode) => n.id === editingNode.id
          ? { ...n, title: nodeForm.title.trim(), description: nodeForm.description, type: nodeForm.type, prereqs: nodeForm.prereqs, content: nodeForm.content } as LearningPathNode
          : n);
      }
      return [...nodes, { id: uid(), title: nodeForm.title.trim(), description: nodeForm.description, type: nodeForm.type, prereqs: nodeForm.prereqs, content: nodeForm.content } as LearningPathNode];
    };
    const updatedPath = { ...selPath, nodes: patch(selPath.nodes) };
    savePaths(learningPaths.map((p: LearningPath) => p.id === selPath.id ? updatedPath : p));
    setSelPath(updatedPath);
    setShowNodeModal(false);
  };
  const deleteNode = (nodeId: Id) => {
    const updatedPath = {
      ...selPath!,
      nodes: selPath!.nodes
        .filter((n: LearningPathNode) => n.id !== nodeId)
        .map((n: LearningPathNode) => ({ ...n, prereqs: n.prereqs.filter((p: Id) => p !== nodeId) })),
    };
    savePaths(learningPaths.map((p: LearningPath) => p.id === selPath!.id ? updatedPath : p));
    setSelPath(updatedPath);
  };

  // ── AI2: Bulk-Add nodes from KI suggestions ──
  const addNodesFromAi = (suggestions: { title: string; description?: string; type?: string }[]) => {
    if (!selPath || suggestions.length === 0) return;
    const newNodes: LearningPathNode[] = suggestions.map(s => ({
      id:          uid(),
      title:       s.title,
      description: s.description || '',
      type:        s.type || 'task',
      prereqs:     [],
      content:     '',
    } as LearningPathNode));
    const updatedPath = { ...selPath, nodes: [...selPath.nodes, ...newNodes] };
    savePaths(learningPaths.map((p: LearningPath) => p.id === selPath.id ? updatedPath : p));
    setSelPath(updatedPath);
  };

  // Keep selPath in sync with latest data
  const currentSelPath = selPath ? (learningPaths.find((p: LearningPath) => p.id === selPath.id) || selPath) : null;

  if (currentSelPath) {
    return (
      <>
        <PathDetailView
          path={currentSelPath}
          progress={pathProgress}
          onComplete={saveProgress}
          onBack={() => setSelPath(null)}
          isAusbilder={isAusbilder}
          onEditPath={() => openEditPath(currentSelPath)}
          onAddNode={openAddNode}
          onEditNode={openEditNode}
          onDeleteNode={deleteNode}
          onAiSuggest={() => setShowAiModal(true)}
        />
        {showPathModal && (
          <PathModal form={pathForm} setForm={setPathForm} onSave={savePathForm} onClose={() => setShowPathModal(false)}
            title={editingPath ? 'Lernpfad bearbeiten' : 'Neuer Lernpfad'} />
        )}
        {showNodeModal && (
          <NodeEditModal form={nodeForm} setForm={setNodeForm} onSave={saveNodeForm} onClose={() => setShowNodeModal(false)}
            title={editingNode ? 'Lernziel bearbeiten' : 'Neues Lernziel'}
            allNodes={currentSelPath.nodes} />
        )}
        {showAiModal && (
          <AiGoalSuggestions
            lehrjahr={currentSelPath.lehrjahr as number}
            existingTitles={currentSelPath.nodes.map((n: LearningPathNode) => n.title)}
            onAdd={addNodesFromAi}
            onClose={() => setShowAiModal(false)}
          />
        )}
      </>
    );
  }

  // ── Path list ──
  const byYear = [1, 2, 3].map(y => ({ y, paths: learningPaths.filter((p: LearningPath) => p.lehrjahr === y) })).filter(g => g.paths.length > 0 || isAusbilder);

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }} className="anim">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button className="btn" onClick={onBack} style={{ padding: '5px 10px', fontSize: 11 }}>← Zurück</button>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: C.br, margin: 0, flex: 1 }}>Lernpfade 🗺️</h1>
        {isAusbilder && (
          <button className="abtn" onClick={openCreatePath} style={{ fontSize: 12, padding: '7px 14px' }}>+ Neuer Lernpfad</button>
        )}
      </div>

      {learningPaths.length === 0 ? (
        <EmptyState icon="🗺️" title="Noch keine Lernpfade"
          subtitle={isAusbilder ? 'Erstelle strukturierte Lernpfade mit Lernzielen und Voraussetzungen.' : 'Dein Ausbilder hat noch keine Lernpfade erstellt.'}
          action={isAusbilder ? '+ Lernpfad erstellen' : null} onAction={(isAusbilder ? openCreatePath : null) as any} />
      ) : (
        byYear.map(({ y, paths }) => (
          <div key={y} style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: LEHRJAHR_COLOR[y], textTransform: 'uppercase', letterSpacing: .9, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: LEHRJAHR_COLOR[y] }} />
              {y}. Lehrjahr
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 12 }}>
              {paths.map((path: LearningPath) => {
                const stats = pathStats(path, pathProgress);
                const color = LEHRJAHR_COLOR[path.lehrjahr as number] || C.ac;
                return (
                  <div key={path.id} className="card proj-card" style={{ cursor: 'pointer', transition: 'all .15s', borderLeft: `3px solid ${color}` }}
                    onClick={() => setSelPath(path)}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: C.br, lineHeight: 1.3, flex: 1 }}>{path.title}</div>
                      {isAusbilder && (
                        <div className="hover-action" style={{ gap: 4, marginLeft: 8 }} onClick={e => e.stopPropagation()}>
                          <button className="btn" onClick={() => openEditPath(path)} style={{ padding: '2px 7px', fontSize: 11 }}>✎</button>
                          <button className="del" onClick={() => deletePath(path.id)} aria-label="Pfad löschen">×</button>
                        </div>
                      )}
                    </div>
                    {path.description && (
                      <div style={{ fontSize: 12, color: C.mu, marginBottom: 10, lineHeight: 1.5 }}>{path.description}</div>
                    )}
                    <div style={{ marginBottom: 8 }}>
                      <ProgressBar value={stats.pct} color={color} height={5} label={`${stats.pct}%`} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.mu }}>
                      <span>{stats.done} / {stats.total} Lernziele</span>
                      <span style={{ color: stats.pct === 100 ? C.gr : color, fontWeight: 700 }}>{stats.pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {showPathModal && (
        <PathModal form={pathForm} setForm={setPathForm} onSave={savePathForm} onClose={() => setShowPathModal(false)}
          title={editingPath ? 'Lernpfad bearbeiten' : 'Neuer Lernpfad'} />
      )}
    </div>
  );
}
