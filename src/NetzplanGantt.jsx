import { useState, useEffect, useMemo, useRef } from "react";
import { C, PAL, UDAYS, detectCycle, computeCPM, computeLayout } from './utils.js';

const NW = 162, NH = 92, CG = 178, RG = 138, NP = 36;

// ── Netzplan Tab ──────────────────────────────────────────────
export function NetzplanTab({ project, onUpdate }) {
  const np = useMemo(() => project.netzplan || { nodes: [], edges: [], unit: 'W', nodePositions: {} }, [project.netzplan]);
  const [lpos, setLpos] = useState({});
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panR = useRef(null), dragR = useRef(null), contR = useRef(null);
  const [isDrag, setIsDrag] = useState(false);
  const [cycErr, setCycErr] = useState('');
  const [nName, setNName] = useState(''), [nD, setND] = useState(1);
  const [eF, setEF] = useState(''), [eT, setET] = useState('');
  const [editN, setEditN] = useState(null);
  const nidR = useRef(np.nodes.length > 0 ? Math.max(...np.nodes.map(n => n.id)) + 1 : 1);

  // Reset layout positions when project changes
  useEffect(() => {
    setLpos({ ...(project.netzplan?.nodePositions || {}) });
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [project.id]);

  const computed = useMemo(() => computeCPM(np.nodes, np.edges), [np.nodes, np.edges]);
  const laid = useMemo(() => computeLayout(computed, np.edges), [computed, np.edges]);
  const critSet = useMemo(() => new Set(laid.filter(n => n.gp === 0).map(n => n.id)), [laid]);

  const getPos = n => lpos[n.id] || { x: NP + n.col * (NW + CG), y: NP + n.row * (NH + RG) };

  function svgCoords(e) {
    const r = contR.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: (e.clientX - r.left - pan.x) / zoom, y: (e.clientY - r.top - pan.y) / zoom };
  }

  function save(patch) {
    onUpdate(project.id, { netzplan: { ...np, ...patch } });
  }

  const addNode = () => {
    if (!nName.trim()) return;
    const id = nidR.current++;
    save({ nodes: [...np.nodes, { id, name: nName.trim(), d: Math.max(1, nD), color: null, comment: '' }] });
    setNName(''); setND(1);
  };
  const removeNode = id => {
    const newPos = { ...lpos }; delete newPos[id];
    setLpos(newPos);
    save({ nodes: np.nodes.filter(n => n.id !== id), edges: np.edges.filter(e => e.from !== id && e.to !== id), nodePositions: newPos });
    if (editN === id) setEditN(null);
  };
  const updateNode = (id, f, v) => save({ nodes: np.nodes.map(n => n.id === id ? { ...n, [f]: f === 'd' ? Math.max(1, Number(v)) : v } : n) });

  const addEdge = () => {
    const f = Number(eF), t = Number(eT);
    if (!f || !t || f === t) return;
    if (np.edges.find(e => e.from === f && e.to === t)) { setCycErr('Diese Verbindung existiert bereits.'); return; }
    if (detectCycle(np.edges, f, t)) { setCycErr('⚠ Zyklus erkannt — würde einen Kreislauf erzeugen.'); return; }
    setCycErr('');
    save({ edges: [...np.edges, { id: `e${f}-${t}-${Date.now()}`, from: f, to: t }] });
    setEF(''); setET('');
  };
  const removeEdge = id => save({ edges: np.edges.filter(e => e.id !== id) });
  const resetLayout = () => { setLpos({}); save({ nodePositions: {} }); };

  const maxX = laid.length ? Math.max(...laid.map(n => getPos(n).x)) + NW + NP : 500;
  const maxY = laid.length ? Math.max(...laid.map(n => getPos(n).y)) + NH + NP : 350;
  const totalDur = laid.length ? Math.max(...laid.map(n => n.fez)) : 0;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 230px)', gap: 14, minHeight: 400 }}>
      {/* Sidebar */}
      <aside aria-label="Netzplan Steuerung" style={{ width: 230, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
        {/* Add Node */}
        <div className="card">
          <div style={{ fontSize: 10, color: C.mu, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 9, fontWeight: 700 }}>Neuer Vorgang</div>
          <input value={nName} onChange={e => setNName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNode()} placeholder="Bezeichnung…" aria-label="Name des Vorgangs" style={{ marginBottom: 7 }} />
          <div style={{ display: 'flex', gap: 7, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="np-dur">Dauer ({np.unit})</label>
              <input id="np-dur" type="number" min="1" value={nD} onChange={e => setND(Number(e.target.value))} />
            </div>
            <button className="abtn" onClick={addNode} aria-label="Vorgang hinzufügen">+</button>
          </div>
        </div>

        {/* Add Edge */}
        <div className="card">
          <div style={{ fontSize: 10, color: C.mu, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 9, fontWeight: 700 }}>Abhängigkeit</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 7 }}>
            <select value={eF} onChange={e => { setEF(e.target.value); setCycErr(''); }} aria-label="Von Vorgang">
              <option value="">Von</option>
              {np.nodes.map(n => <option key={n.id} value={n.id}>{n.id}: {n.name.slice(0, 12)}</option>)}
            </select>
            <span aria-hidden="true" style={{ color: C.mu, flexShrink: 0, fontSize: 16 }}>→</span>
            <select value={eT} onChange={e => { setET(e.target.value); setCycErr(''); }} aria-label="Nach Vorgang">
              <option value="">Nach</option>
              {np.nodes.map(n => <option key={n.id} value={n.id}>{n.id}: {n.name.slice(0, 12)}</option>)}
            </select>
          </div>
          {cycErr && <div role="alert" style={{ fontSize: 11, color: C.cr, marginBottom: 7, padding: '5px 8px', background: C.crd, borderRadius: 5 }}>{cycErr}</div>}
          <button className="abtn" onClick={addEdge} style={{ width: '100%', fontSize: 11 }}>+ Verbinden</button>
        </div>

        {/* Node list */}
        <div style={{ fontSize: 10, fontWeight: 700, color: C.mu, textTransform: 'uppercase', letterSpacing: 1, paddingLeft: 2 }}>Vorgänge ({np.nodes.length})</div>
        {laid.map(n => {
          const ic = n.gp === 0, bc = n.color || (ic ? C.cr : C.ac);
          return (
            <div key={n.id} style={{ background: C.sf2, border: `1px solid ${editN === n.id ? bc + '60' : C.bd}`, borderLeft: `3px solid ${bc}`, borderRadius: 8, overflow: 'hidden', transition: 'border-color .15s' }}>
              <div style={{ padding: '7px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div aria-hidden="true" style={{ width: 17, height: 17, borderRadius: 4, background: bc + '20', border: `1px solid ${bc}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: bc, fontFamily: C.mono, flexShrink: 0 }}>{n.id}</div>
                <div style={{ flex: 1, minWidth: 0, fontSize: 11, fontWeight: 700, color: C.br, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.name}</div>
                <span style={{ fontSize: 9, fontFamily: C.mono, color: ic ? C.cr : C.yw, flexShrink: 0 }}>GP:{n.gp}</span>
                <button className="icn" onClick={() => setEditN(editN === n.id ? null : n.id)} aria-label="Bearbeiten" style={{ fontSize: 11 }}>✎</button>
                <button className="del" onClick={() => removeNode(n.id)} aria-label={`Vorgang ${n.name} löschen`} style={{ fontSize: 12 }}>×</button>
              </div>
              {editN === n.id && (
                <div style={{ padding: '7px 9px', borderTop: `1px solid ${C.bd}`, background: C.sf3, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input value={n.name} onChange={e => updateNode(n.id, 'name', e.target.value)} aria-label="Vorgang umbenennen" style={{ fontSize: 12 }} />
                  <input type="number" min="1" value={n.d} onChange={e => updateNode(n.id, 'd', e.target.value)} aria-label="Dauer ändern" style={{ fontSize: 12 }} />
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }} role="group" aria-label="Farbe wählen">
                    {PAL.map(col => (
                      <button key={col} onClick={() => updateNode(n.id, 'color', n.color === col ? null : col)}
                        aria-label={`Farbe ${col}`} aria-pressed={n.color === col}
                        style={{ width: 14, height: 14, borderRadius: 3, background: col, cursor: 'pointer', border: `2px solid ${n.color === col ? '#fff' : col + '30'}`, padding: 0 }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Edges */}
        <div className="card">
          <div style={{ fontSize: 10, color: C.mu, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 7, fontWeight: 700 }}>Verbindungen ({np.edges.length})</div>
          {np.edges.map(e => {
            const ic = critSet.has(e.from) && critSet.has(e.to);
            return (
              <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: `1px solid ${C.bd}22`, fontSize: 11, fontFamily: C.mono }}>
                <span style={{ color: ic ? C.cr : C.ac }}>{e.from} → {e.to}</span>
                <button className="del" onClick={() => removeEdge(e.id)} aria-label={`Verbindung ${e.from} → ${e.to} löschen`} style={{ fontSize: 11 }}>×</button>
              </div>
            );
          })}
          {np.edges.length === 0 && <div style={{ fontSize: 11, color: C.mu }}>Noch keine Verbindungen</div>}
        </div>

        {/* Stats */}
        <div className="card" style={{ borderLeft: `3px solid ${C.cr}` }}>
          <div style={{ fontSize: 10, color: C.mu, marginBottom: 3 }}>Gesamtdauer</div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: C.mono, color: C.cr }}>{totalDur} {np.unit}</div>
          <div style={{ fontSize: 10, color: C.mu, marginTop: 4 }}>Kritischer Pfad: {laid.filter(n => n.gp === 0).map(n => n.id).join(' → ')}</div>
        </div>

        <button className="btn" onClick={resetLayout} style={{ fontSize: 11 }}>⊡ Layout zurücksetzen</button>
      </aside>

      {/* Canvas */}
      <div ref={contR}
        style={{ flex: 1, background: C.bg, border: `1px solid ${C.bd}`, borderRadius: 10, overflow: 'hidden', position: 'relative', cursor: isDrag ? 'grabbing' : panR.current ? 'grab' : 'default' }}
        role="img" aria-label="Netzplan Diagramm"
        onWheel={e => { e.preventDefault(); setZoom(z => Math.min(Math.max(z * (e.deltaY > 0 ? .9 : 1.1), .1), 4)); }}
        onMouseDown={e => { if (e.altKey || e.button === 1) { e.preventDefault(); panR.current = { sx: e.clientX - pan.x, sy: e.clientY - pan.y }; } }}
        onMouseMove={e => {
          if (panR.current) setPan({ x: e.clientX - panR.current.sx, y: e.clientY - panR.current.sy });
          if (dragR.current) { const sc = svgCoords(e); setLpos(p => ({ ...p, [dragR.current.id]: { x: Math.max(0, sc.x - dragR.current.ox), y: Math.max(0, sc.y - dragR.current.oy) } })); }
        }}
        onMouseUp={() => {
          if (dragR.current) { save({ nodePositions: { ...np.nodePositions, ...lpos } }); dragR.current = null; setIsDrag(false); }
          panR.current = null;
        }}
        onMouseLeave={() => { panR.current = null; }}>

        {/* Grid background */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} aria-hidden="true">
          <defs>
            <pattern id="ngrid-s" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#181f2a" strokeWidth=".4" />
            </pattern>
            <pattern id="ngrid-l" width="100" height="100" patternUnits="userSpaceOnUse">
              <rect width="100" height="100" fill="url(#ngrid-s)" />
              <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#1c2535" strokeWidth=".8" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#ngrid-l)" />
        </svg>

        {laid.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: C.mu, gap: 8 }}>
            <div style={{ fontSize: 32, opacity: .2 }}>◫</div>
            <div style={{ fontSize: 13, opacity: .4 }}>Vorgänge in der Seitenleiste hinzufügen</div>
          </div>
        )}

        {laid.length > 0 && (
          <svg width={maxX} height={maxY} aria-hidden="true"
            style={{ display: 'block', position: 'absolute', top: 0, left: 0, transformOrigin: 'top left', transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})` }}>
            <defs>
              <marker id="np-arr-c" markerWidth="9" markerHeight="9" refX="8" refY="3.5" orient="auto">
                <path d="M0,0 L0,7 L9,3.5 z" fill={C.cr} />
              </marker>
              <marker id="np-arr-n" markerWidth="9" markerHeight="9" refX="8" refY="3.5" orient="auto">
                <path d="M0,0 L0,7 L9,3.5 z" fill={C.ac} />
              </marker>
              <filter id="np-shadow" x="-10%" y="-10%" width="120%" height="130%">
                <feDropShadow dx="2" dy="3" stdDeviation="3" floodColor="#000" floodOpacity=".35" />
              </filter>
            </defs>

            {/* Edges */}
            {np.edges.map(e => {
              const fn = laid.find(n => n.id === e.from), tn = laid.find(n => n.id === e.to);
              if (!fn || !tn) return null;
              const fp = getPos(fn), tp = getPos(tn);
              const ic = critSet.has(e.from) && critSet.has(e.to);
              const x1 = fp.x + NW, y1 = fp.y + NH / 2, x2 = tp.x, y2 = tp.y + NH / 2;
              const bx = Math.abs(x2 - x1) * .45;
              return (
                <g key={e.id}>
                  {ic && <path d={`M${x1},${y1} C${x1+bx},${y1} ${x2-bx},${y2} ${x2},${y2}`} fill="none" stroke={C.cr} strokeWidth={8} strokeOpacity={.06} />}
                  <path d={`M${x1},${y1} C${x1+bx},${y1} ${x2-bx},${y2} ${x2},${y2}`} fill="none"
                    stroke={ic ? C.cr : C.ac} strokeWidth={ic ? 2 : 1.5}
                    strokeOpacity={ic ? .95 : .5}
                    strokeDasharray={ic ? 'none' : '5,3'}
                    markerEnd={ic ? 'url(#np-arr-c)' : 'url(#np-arr-n)'} />
                </g>
              );
            })}

            {/* Nodes */}
            {laid.map(n => {
              const { x, y } = getPos(n);
              const ic = n.gp === 0, bc = n.color || (ic ? C.cr : C.ac);
              const rh = NH / 3;
              const words = n.name.split(' ');
              const mid = Math.ceil(words.length / 2);
              const l1 = words.slice(0, mid).join(' '), l2 = words.slice(mid).join(' ');

              return (
                <g key={n.id} style={{ cursor: 'grab' }}
                  onMouseDown={e => {
                    if (panR.current) return;
                    e.stopPropagation();
                    const sc = svgCoords(e), cp = getPos(n);
                    dragR.current = { id: n.id, ox: sc.x - cp.x, oy: sc.y - cp.y };
                    setIsDrag(true);
                  }}>
                  {/* Shadow */}
                  <rect x={x + 2} y={y + 3} width={NW} height={NH} rx={8} fill="#000" fillOpacity={.4} />
                  {/* Card */}
                  <rect x={x} y={y} width={NW} height={NH} rx={8} fill={C.sf2} stroke={bc} strokeWidth={ic ? 1.5 : 1} strokeOpacity={.85} />
                  {/* Top zone */}
                  <rect x={x} y={y} width={NW} height={rh} rx={8} fill={ic ? ic ? '#fde8e8' : '#e8f3fc' : ic ? '#fde8e8' : '#e8f3fc'} />
                  <rect x={x} y={y + rh - 1} width={NW} height={2} fill={ic ? ic ? '#fde8e8' : '#e8f3fc' : ic ? '#fde8e8' : '#e8f3fc'} />
                  {/* Top dividers */}
                  {[1, 2].map(i => <line key={i} x1={x + i * NW / 3} y1={y + 2} x2={x + i * NW / 3} y2={y + rh - 1} stroke={bc} strokeWidth={.5} strokeOpacity={.2} />)}
                  {/* Top values */}
                  <text x={x + NW / 6} y={y + 14} textAnchor="middle" fontFamily={C.mono} fontSize={12} fontWeight={500} fill={C.br}>{n.faz}</text>
                  <text x={x + NW / 2} y={y + 14} textAnchor="middle" fontFamily={C.mono} fontSize={14} fontWeight={800} fill={bc}>{n.d}</text>
                  <text x={x + 5 * NW / 6} y={y + 14} textAnchor="middle" fontFamily={C.mono} fontSize={12} fontWeight={500} fill={C.br}>{n.fez}</text>
                  {/* Top labels */}
                  <text x={x + NW / 6} y={y + rh - 2} textAnchor="middle" fontFamily={C.mono} fontSize={7} fill={C.mu}>FAZ</text>
                  <text x={x + NW / 2} y={y + rh - 2} textAnchor="middle" fontFamily={C.mono} fontSize={7} fill={C.mu}>D</text>
                  <text x={x + 5 * NW / 6} y={y + rh - 2} textAnchor="middle" fontFamily={C.mono} fontSize={7} fill={C.mu}>FEZ</text>
                  {/* Middle divider */}
                  <line x1={x} y1={y + rh} x2={x + NW} y2={y + rh} stroke={bc} strokeWidth={.5} strokeOpacity={.15} />
                  {/* Name */}
                  {l2 ? (
                    <>
                      <text x={x + NW / 2} y={y + rh * 1.32 + 3} textAnchor="middle" fontFamily={C.sans} fontSize={10} fontWeight={700} fill={C.br}>{l1}</text>
                      <text x={x + NW / 2} y={y + rh * 1.72 + 3} textAnchor="middle" fontFamily={C.sans} fontSize={10} fontWeight={700} fill={C.br}>{l2}</text>
                    </>
                  ) : (
                    <text x={x + NW / 2} y={y + rh * 1.56 + 3} textAnchor="middle" fontFamily={C.sans} fontSize={10} fontWeight={700} fill={C.br}>{l1}</text>
                  )}
                  {n.color && <circle cx={x + 9} cy={y + rh * 1.5} r={4} fill={n.color} opacity={.8} />}
                  {/* Bottom divider */}
                  <line x1={x} y1={y + 2 * rh} x2={x + NW} y2={y + 2 * rh} stroke={bc} strokeWidth={.5} strokeOpacity={.15} />
                  {/* Bottom zone */}
                  <rect x={x + 1} y={y + 2 * rh} width={NW - 2} height={rh} fill={'var(--c-sf3)'} />
                  <rect x={x + 1} y={y + NH - 5} width={NW - 2} height={5} rx={8} fill={'var(--c-sf3)'} />
                  {[1, 2].map(i => <line key={i} x1={x + i * NW / 3} y1={y + 2 * rh + 2} x2={x + i * NW / 3} y2={y + NH - 2} stroke={bc} strokeWidth={.5} strokeOpacity={.2} />)}
                  {/* Bottom values */}
                  <text x={x + NW / 6} y={y + 2 * rh + 14} textAnchor="middle" fontFamily={C.mono} fontSize={12} fontWeight={500} fill={C.br}>{n.saz}</text>
                  <text x={x + NW / 2} y={y + 2 * rh + 14} textAnchor="middle" fontFamily={C.mono} fontSize={14} fontWeight={800} fill={n.gp === 0 ? C.gr : n.gp <= 1 ? C.yw : C.mu}>{n.gp}</text>
                  <text x={x + 5 * NW / 6} y={y + 2 * rh + 14} textAnchor="middle" fontFamily={C.mono} fontSize={12} fontWeight={500} fill={C.br}>{n.sez}</text>
                  {/* Bottom labels */}
                  <text x={x + NW / 6} y={y + NH - 2} textAnchor="middle" fontFamily={C.mono} fontSize={7} fill={C.mu}>SAZ</text>
                  <text x={x + NW / 2} y={y + NH - 2} textAnchor="middle" fontFamily={C.mono} fontSize={7} fill={C.mu}>GP</text>
                  <text x={x + 5 * NW / 6} y={y + NH - 2} textAnchor="middle" fontFamily={C.mono} fontSize={7} fill={C.mu}>SEZ</text>
                  {/* ID badge */}
                  <rect x={x + NW - 22} y={y} width={22} height={15} rx={4} fill={bc} fillOpacity={.95} />
                  <text x={x + NW - 11} y={y + 10} textAnchor="middle" fontFamily={C.mono} fontSize={9} fontWeight={800} fill="#fff">{n.id}</text>
                </g>
              );
            })}
          </svg>
        )}

        {/* Controls */}
        <div style={{ position: 'absolute', bottom: 12, right: 12, display: 'flex', gap: 5, alignItems: 'center' }}>
          <button className="btn" onClick={() => setZoom(z => Math.min(z * 1.2, 4))} aria-label="Vergrößern" style={{ padding: '5px 9px', fontSize: 14, fontWeight: 700 }}>+</button>
          <span aria-live="polite" style={{ fontSize: 11, color: C.mu, fontFamily: C.mono, minWidth: 36, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
          <button className="btn" onClick={() => setZoom(z => Math.max(z * .83, .1))} aria-label="Verkleinern" style={{ padding: '5px 9px', fontSize: 14, fontWeight: 700 }}>−</button>
          <button className="btn" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} aria-label="Ansicht zurücksetzen" style={{ padding: '5px 9px', fontSize: 12 }}>⊡</button>
        </div>
        <div aria-hidden="true" style={{ position: 'absolute', bottom: 12, left: 12, fontSize: 10, color: C.mu, background: C.sf, border: `1px solid ${C.bd}`, borderRadius: 6, padding: '4px 10px', fontFamily: C.mono }}>
          Alt+Drag = Pan · Drag Knoten = Verschieben · Scroll = Zoom
        </div>
      </div>
    </div>
  );
}

// ── Gantt Tab ─────────────────────────────────────────────────
export function GanttTab({ project }) {
  const np = project.netzplan || { nodes: [], edges: [], unit: 'W', nodePositions: {} };
  const computed = useMemo(() => computeCPM(np.nodes, np.edges), [np.nodes, np.edges]);
  const laid = useMemo(() => computeLayout(computed, np.edges), [computed, np.edges]);

  const totalDur = laid.length ? Math.max(...laid.map(n => n.fez)) : 0;
  const cols = Array.from({ length: totalDur + 1 }, (_, i) => i);
  const CW = 52, RH = 36, HH = 44, NMW = 175;
  const ud = UDAYS[np.unit] || 7;

  const addDays = (s, n) => {
    if (!s) return null;
    const d = new Date(s);
    d.setDate(d.getDate() + Math.round(n));
    return d;
  };

  const critSet = new Set(laid.filter(n => n.gp === 0).map(n => n.id));
  const now = new Date();
  const ps = project.startDate ? new Date(project.startDate) : null;
  const todayOff = ps ? Math.floor((now - ps) / (86400000 * ud)) : null;
  const endDate = addDays(project.startDate, totalDur * ud);
  const unitLabel = { W: 'Wochen', T: 'Tage', M: 'Monate' }[np.unit] || np.unit;

  if (laid.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: C.mu }}>
        <div style={{ fontSize: 28, marginBottom: 12, opacity: .3 }}>📊</div>
        <div style={{ fontSize: 13, opacity: .5 }}>Zuerst Vorgänge im Netzplan erstellen</div>
      </div>
    );
  }

  return (
    <div style={{ border: `1px solid ${C.bd}`, borderRadius: 10, overflow: 'hidden' }} role="figure" aria-label="Gantt-Diagramm">
      {/* Header */}
      <div style={{ padding: '9px 16px', background: C.sf, borderBottom: `1px solid ${C.bd}`, display: 'flex', gap: 20, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.tx }}>{unitLabel}-Plan</div>
        <div style={{ display: 'flex', gap: 14, fontSize: 11, color: C.mu, flexWrap: 'wrap' }}>
          {ps && <span>Start: <time dateTime={project.startDate} style={{ color: C.ac, fontFamily: C.mono }}>{ps.toLocaleDateString('de-DE')}</time></span>}
          {endDate && <span>Ende: <time style={{ color: C.ac, fontFamily: C.mono }}>{endDate.toLocaleDateString('de-DE')}</time></span>}
          <span>Dauer: <span style={{ color: C.ac, fontFamily: C.mono }}>{totalDur} {unitLabel}</span></span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, fontSize: 10, color: C.mu }}>
          <span><span style={{ color: C.cr }}>■</span> Kritisch (GP=0)</span>
          <span><span style={{ color: C.ac }}>■</span> Unkritisch</span>
          <span><span style={{ color: C.yw }}>▭</span> Puffer</span>
          {todayOff !== null && <span><span style={{ color: C.ac }}>│</span> Heute</span>}
        </div>
      </div>

      {/* Body */}
      <div style={{ overflow: 'auto', maxHeight: 450 }}>
        <div style={{ display: 'flex', minWidth: NMW + cols.length * CW + 'px' }}>
          {/* Names column */}
          <div style={{ width: NMW, flexShrink: 0, borderRight: `1px solid ${C.bd}`, position: 'sticky', left: 0, background: C.sf, zIndex: 2 }}>
            <div style={{ height: HH, borderBottom: `1px solid ${C.bd}`, padding: '0 12px', display: 'flex', alignItems: 'center' }}>
              <div style={{ fontSize: 10, color: C.mu, textTransform: 'uppercase', letterSpacing: .8, fontWeight: 700 }}>Vorgang</div>
            </div>
            {laid.map(n => {
              const bc = n.color || (critSet.has(n.id) ? C.cr : C.ac);
              return (
                <div key={n.id} style={{ height: RH, borderBottom: `1px solid ${C.bd}22`, display: 'flex', alignItems: 'center', padding: '0 10px', gap: 7, borderLeft: `3px solid ${bc}` }}>
                  <div aria-hidden="true" style={{ width: 15, height: 15, borderRadius: 3, background: bc + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, color: bc, fontFamily: C.mono, flexShrink: 0 }}>{n.id}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.br, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.name}</div>
                </div>
              );
            })}
          </div>

          {/* Timeline */}
          <div style={{ flex: 1, position: 'relative' }}>
            {/* Column headers */}
            <div style={{ display: 'flex', height: HH, borderBottom: `1px solid ${C.bd}`, position: 'sticky', top: 0, background: C.sf, zIndex: 1 }}>
              {cols.map(i => {
                const d = addDays(project.startDate, i * ud);
                const isT = todayOff === i;
                return (
                  <div key={i} style={{ width: CW, flexShrink: 0, borderRight: `1px solid ${C.bd}22`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: isT ? C.acd : 'transparent', transition: 'background .15s' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: isT ? C.ac : C.ac + '80', fontFamily: C.mono }}>{np.unit}{i}</div>
                    <div style={{ fontSize: 8, color: isT ? C.ac + 'cc' : C.mu, fontFamily: C.mono, marginTop: 1 }}>
                      {d ? d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : '–'}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Rows */}
            {laid.map(n => {
              const bc = n.color || (critSet.has(n.id) ? C.cr : C.ac);
              const ic = critSet.has(n.id);
              const barLeft = n.faz * CW + 2;
              const barW = Math.max(n.d * CW - 4, 10);
              const bufW = n.gp > 0 ? Math.max(n.gp * CW - 2, 4) : 0;
              const startD = addDays(project.startDate, n.faz * ud);
              const endD = addDays(project.startDate, n.fez * ud);

              return (
                <div key={n.id} style={{ height: RH, borderBottom: `1px solid ${C.bd}22`, position: 'relative', display: 'flex' }}>
                  {cols.map(i => <div key={i} style={{ width: CW, flexShrink: 0, borderRight: `1px solid ${C.bd}22`, background: todayOff === i ? C.acd : 'transparent' }} />)}
                  {/* Bar */}
                  <div title={`${n.name}\n${startD?.toLocaleDateString('de-DE')} → ${endD?.toLocaleDateString('de-DE')}\nDauer: ${n.d} ${np.unit} · Puffer: ${n.gp} ${np.unit}`}
                    style={{ position: 'absolute', left: barLeft, top: '50%', transform: 'translateY(-50%)', width: barW, height: 22, background: ic ? `${bc}35` : `${bc}22`, border: `1.5px solid ${bc}`, borderRadius: 5, display: 'flex', alignItems: 'center', paddingLeft: 7, overflow: 'hidden', boxShadow: ic ? `0 0 8px ${bc}25` : 'none' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: bc, whiteSpace: 'nowrap', fontFamily: C.mono }}>{n.d}{np.unit}</span>
                    {n.gp > 0 && <span style={{ fontSize: 9, color: C.yw, marginLeft: 5, opacity: .8 }}>+{n.gp}</span>}
                  </div>
                  {/* Buffer */}
                  {bufW > 0 && (
                    <div style={{ position: 'absolute', left: barLeft + barW, top: '50%', transform: 'translateY(-50%)', width: bufW, height: 10, background: C.yw + '18', border: `1px dashed ${C.yw}50`, borderRadius: 3 }}
                      title={`Puffer: ${n.gp} ${np.unit}`} />
                  )}
                </div>
              );
            })}

            {/* Today line */}
            {todayOff !== null && todayOff >= 0 && todayOff <= totalDur && (
              <div aria-hidden="true" style={{ position: 'absolute', top: 0, bottom: 0, left: todayOff * CW + CW / 2, width: 2, background: C.ac, opacity: .7, zIndex: 3, pointerEvents: 'none' }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default NetzplanTab;
