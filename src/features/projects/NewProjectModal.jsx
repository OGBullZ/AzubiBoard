import { useState } from "react";
import { C, uid, today } from '../../lib/utils.js';
import { Avatar, Modal } from '../../components/UI.jsx';

export function NewProjectModal({ users, groups, currentUser, onClose, onCreate }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    title: '', description: '', status: 'yellow',
    assignees: [currentUser.id],
    groupId: '', startDate: today(), deadline: '',
    netzplan: { nodes: [], edges: [], unit: 'W', nodePositions: {} },
    materials: [], requirements: [], links: [],
  });
  const [err, setErr] = useState('');
  const [matForm, setMatForm] = useState({ name: '', qty: 1, cost: 0 });
  const [reqText, setReqText] = useState('');
  const [linkForm, setLinkForm] = useState({ url: '', title: '' });

  const u = (f, v) => setForm(p => ({ ...p, [f]: v }));
  const toggleAssignee = id => u('assignees', form.assignees.includes(id) ? form.assignees.filter(x => x !== id) : [...form.assignees, id]);

  const addMat = () => {
    if (!matForm.name.trim()) return;
    u('materials', [...form.materials, { id: uid(), name: matForm.name.trim(), qty: Number(matForm.qty) || 1, cost: Number(matForm.cost) || 0 }]);
    setMatForm({ name: '', qty: 1, cost: 0 });
  };
  const addReq = () => {
    if (!reqText.trim()) return;
    u('requirements', [...form.requirements, { id: uid(), text: reqText.trim(), done: false }]);
    setReqText('');
  };
  const addLink = () => {
    if (!linkForm.url.trim()) return;
    const url = linkForm.url.startsWith('http') ? linkForm.url : 'https://' + linkForm.url;
    u('links', [...form.links, { id: uid(), url, title: linkForm.title.trim(), type: 'other', note: '' }]);
    setLinkForm({ url: '', title: '' });
  };

  const next = () => {
    if (step === 1 && !form.title.trim()) { setErr('Bitte einen Projekttitel eingeben.'); return; }
    setErr('');
    setStep(s => s + 1);
  };

  const submit = () => {
    onCreate({ ...form, id: uid(), tasks: [], steps: [], calendarEvents: [] });
  };

  const STEPS = ['Grunddaten', 'Zeitraum & Team', 'Details'];

  return (
    <Modal title="Neues Projekt" onClose={onClose} width={500}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 22 }}>
        {STEPS.map((s, i) => {
          const n = i + 1;
          const done = n < step;
          const active = n === step;
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: done ? C.gr : active ? C.ac : 'var(--c-sf3)', border: `2px solid ${done ? C.gr : active ? C.ac : 'var(--c-bd2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: (done || active) ? '#fff' : C.mu, transition: 'all .2s', flexShrink: 0 }}>
                  {done ? '✓' : n}
                </div>
                <span style={{ fontSize: 10, fontWeight: active ? 700 : 400, color: active ? C.ac : done ? C.gr : C.mu, whiteSpace: 'nowrap' }}>{s}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 2, background: done ? C.gr : 'var(--c-bd2)', margin: '0 6px', marginTop: -14, transition: 'background .3s' }} />
              )}
            </div>
          );
        })}
      </div>

      {err && <div role="alert" style={{ fontSize: 12, color: C.cr, background: C.crd, border: `1px solid ${C.cr}30`, borderRadius: 7, padding: '8px 12px', marginBottom: 14 }}>⚠ {err}</div>}

      {step === 1 && (
        <div style={{ animation: 'fadeUp .15s ease', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: C.tx, marginBottom: 7, display: 'block' }}>Projekttitel *</label>
            <input value={form.title} onChange={e => u('title', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && next()}
              placeholder="z.B. Weboberfläche Azubi-Verwaltung"
              autoFocus style={{ fontSize: 15, padding: '10px 13px', fontWeight: 600 }} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: C.tx, marginBottom: 7, display: 'block' }}>Beschreibung</label>
            <textarea value={form.description} onChange={e => u('description', e.target.value)}
              placeholder="Was soll in diesem Projekt erreicht werden?"
              style={{ minHeight: 100, fontSize: 13, lineHeight: 1.65 }} />
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ animation: 'fadeUp .15s ease', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: C.tx, marginBottom: 7, display: 'block' }}>Startdatum</label>
              <input type="date" value={form.startDate} onChange={e => u('startDate', e.target.value)} style={{ fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: C.tx, marginBottom: 7, display: 'block' }}>Deadline</label>
              <input type="date" value={form.deadline} onChange={e => u('deadline', e.target.value)} style={{ fontSize: 13 }} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: C.tx, marginBottom: 7, display: 'block' }}>Gruppe (optional)</label>
            <select value={form.groupId} onChange={e => u('groupId', e.target.value)} style={{ fontSize: 13 }}>
              <option value="">— Keine Gruppe —</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: C.tx, marginBottom: 9, display: 'block' }}>Azubis zuweisen</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {users.filter(u2 => u2.role === 'azubi').map(u2 => {
                const sel = form.assignees.includes(u2.id);
                return (
                  <button key={u2.id} onClick={() => toggleAssignee(u2.id)} aria-pressed={sel}
                    style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 13px', borderRadius: 10, background: sel ? C.acd : 'var(--c-sf2)', border: `2px solid ${sel ? C.ac : 'var(--c-bd2)'}`, cursor: 'pointer', transition: 'all .12s', textAlign: 'left' }}>
                    <Avatar name={u2.name} size={34} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: sel ? C.ac : C.br }}>{u2.name}</div>
                      <div style={{ fontSize: 10, color: C.mu }}>{u2.email} · LJ {u2.apprenticeship_year || 1}</div>
                    </div>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${sel ? C.ac : 'var(--c-bd2)'}`, background: sel ? C.ac : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, fontWeight: 800, color: '#fff', transition: 'all .12s' }}>
                      {sel ? '✓' : ''}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ animation: 'fadeUp .15s ease', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 12, color: C.mu, margin: 0 }}>Optional — alles kann auch später im Projekt hinzugefügt werden.</p>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.tx, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 7, display: 'block' }}>
              Material <span style={{ color: C.mu, fontWeight: 400, fontSize: 10 }}>({form.materials.length})</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 55px 75px auto', gap: 6, marginBottom: 6 }}>
              <input value={matForm.name} onChange={e => setMatForm(f => ({ ...f, name: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addMat()} placeholder="Bezeichnung…" style={{ fontSize: 12 }} />
              <input type="number" min="1" value={matForm.qty} onChange={e => setMatForm(f => ({ ...f, qty: e.target.value }))} style={{ fontSize: 12 }} />
              <input type="number" min="0" step="0.01" value={matForm.cost} onChange={e => setMatForm(f => ({ ...f, cost: e.target.value }))} placeholder="€" style={{ fontSize: 12 }} />
              <button className="abtn" onClick={addMat} style={{ padding: '6px 10px', fontSize: 11 }}>+</button>
            </div>
            {form.materials.length > 0 && form.materials.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.mu, padding: '3px 0', borderBottom: `1px solid var(--c-bd)22` }}>
                <span style={{ flex: 1, color: C.tx }}>{m.name}</span>
                <span style={{ fontFamily: C.mono }}>{m.qty}× · {(m.qty * m.cost).toFixed(2)} €</span>
                <button className="del" onClick={() => u('materials', form.materials.filter(x => x.id !== m.id))} style={{ fontSize: 12 }}>×</button>
              </div>
            ))}
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.tx, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 7, display: 'block' }}>
              Anforderungen <span style={{ color: C.mu, fontWeight: 400, fontSize: 10 }}>({form.requirements.length})</span>
            </label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <input value={reqText} onChange={e => setReqText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addReq()} placeholder="Anforderung hinzufügen…" style={{ flex: 1, fontSize: 12 }} />
              <button className="abtn" onClick={addReq} style={{ padding: '6px 10px', fontSize: 11 }}>+</button>
            </div>
            {form.requirements.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '3px 0', borderBottom: `1px solid var(--c-bd)22` }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.gr, flexShrink: 0 }} />
                <span style={{ flex: 1, color: C.tx }}>{r.text}</span>
                <button className="del" onClick={() => u('requirements', form.requirements.filter(x => x.id !== r.id))} style={{ fontSize: 12 }}>×</button>
              </div>
            ))}
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.tx, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 7, display: 'block' }}>
              Links <span style={{ color: C.mu, fontWeight: 400, fontSize: 10 }}>({form.links.length})</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6, marginBottom: 6 }}>
              <input value={linkForm.url} onChange={e => setLinkForm(f => ({ ...f, url: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addLink()} placeholder="URL…" style={{ fontSize: 12 }} />
              <input value={linkForm.title} onChange={e => setLinkForm(f => ({ ...f, title: e.target.value }))} placeholder="Titel (optional)" style={{ fontSize: 12 }} />
              <button className="abtn" onClick={addLink} style={{ padding: '6px 10px', fontSize: 11 }}>+</button>
            </div>
            {form.links.map(l => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '3px 0', borderBottom: `1px solid var(--c-bd)22` }}>
                <span style={{ fontSize: 10, color: C.ac }}>🔗</span>
                <span style={{ flex: 1, color: C.ac, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title || l.url}</span>
                <button className="del" onClick={() => u('links', form.links.filter(x => x.id !== l.id))} style={{ fontSize: 12 }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 9, marginTop: 22 }}>
        {step > 1 && (
          <button className="btn" onClick={() => setStep(s => s - 1)} style={{ padding: '11px 16px', fontSize: 13 }}>← Zurück</button>
        )}
        {step < 3 ? (
          <button className="abtn" onClick={next} style={{ flex: 1, padding: 12, fontSize: 14, justifyContent: 'center', fontWeight: 800 }}>
            Weiter →
          </button>
        ) : (
          <button className="abtn" onClick={submit} style={{ flex: 1, padding: 12, fontSize: 14, justifyContent: 'center', fontWeight: 800, background: C.gr }}>
            ✓ Projekt erstellen
          </button>
        )}
        {step === 1 && (
          <button className="btn" onClick={onClose} style={{ padding: '11px 16px' }}>Abbrechen</button>
        )}
      </div>
    </Modal>
  );
}

export default NewProjectModal;
