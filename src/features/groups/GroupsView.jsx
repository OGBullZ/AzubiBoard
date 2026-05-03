import { useState } from "react";
import { C, uid } from '../../lib/utils.js';
import { Avatar, Modal, Field, EmptyState } from '../../components/UI.jsx';

export function GroupsView({ groups, users, projects, onUpdateGroups, showToast }) {
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'team', members: [] });
  const add = () => { if (!form.name.trim()) return; onUpdateGroups([...groups, { id: uid(), name: form.name.trim(), type: form.type, members: form.members }]); setShowNew(false); setForm({ name: '', type: 'team', members: [] }); showToast('✓ Gruppe erstellt'); };
  const remove = id => { if (!confirm('Gruppe wirklich löschen?')) return; onUpdateGroups(groups.filter(g => g.id !== id)); showToast('Gruppe gelöscht'); };
  const toggleMember = uid2 => {
    const m = form.members.includes(uid2) ? form.members.filter(x => x !== uid2) : [...form.members, uid2];
    setForm(f => ({ ...f, members: m }));
  };

  return (
    <main style={{ padding: 22, overflow: 'auto', flex: 1 }} className="anim">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: C.br, margin: 0 }}>Gruppen</h1>
        <button className="abtn" onClick={() => setShowNew(true)}>+ Neue Gruppe</button>
      </div>

      {groups.length === 0 ? (
        <EmptyState icon="👥" title="Noch keine Gruppen" subtitle="Erstelle Teams oder Abteilungen" action="+ Gruppe erstellen" onAction={() => setShowNew(true)} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: 14 }}>
          {groups.map(g => {
            const members = users.filter(u => g.members.includes(u.id));
            const gProjects = projects.filter(p => p.groupId === g.id);
            return (
              <article key={g.id} className="card" aria-label={`Gruppe: ${g.name}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <h2 style={{ fontSize: 14, fontWeight: 800, color: C.br, margin: 0, marginBottom: 5 }}>{g.name}</h2>
                    <span className="tag" style={{ background: C.acd, color: C.ac, border: `1px solid ${C.ac}30` }}>
                      {g.type === 'team' ? '👥 Team' : '🏢 Abteilung'}
                    </span>
                  </div>
                  <button className="del" onClick={() => remove(g.id)} aria-label={`Gruppe ${g.name} löschen`}>×</button>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: C.mu, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8, fontWeight: 700 }}>
                    Mitglieder ({members.length})
                  </div>
                  {members.length === 0 ? (
                    <div style={{ fontSize: 11, color: C.mu, fontStyle: 'italic' }}>Keine Mitglieder</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {members.map(u => {
                        const activeCount = projects.filter(p => p.assignees?.includes(u.id) && p.status !== 'green').length;
                        return (
                          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 9px', background: C.sf3, borderRadius: 7, border: `1px solid ${C.bd}` }}>
                            <Avatar name={u.name} size={28} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: C.br }}>{u.name}</div>
                              <div style={{ fontSize: 10, color: C.mu }}>{u.email}</div>
                            </div>
                            {activeCount > 0 && (
                              <span style={{ fontSize: 9, fontWeight: 700, background: C.acd, color: C.ac, border: `1px solid ${C.ac}30`, padding: '2px 6px', borderRadius: 5, fontFamily: C.mono }}>
                                {activeCount} Proj.
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div style={{ paddingTop: 9, borderTop: `1px solid ${C.bd}`, fontSize: 11, color: C.mu }}>
                  {gProjects.length} Projekt(e) dieser Gruppe
                </div>
              </article>
            );
          })}
        </div>
      )}

      {showNew && (
        <Modal title="Neue Gruppe erstellen" onClose={() => setShowNew(false)}>
          <Field label="Gruppenname">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="z.B. IT-Azubis 2024" autoFocus />
          </Field>
          <Field label="Typ">
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="team">👥 Team (Projektgruppe)</option>
              <option value="department">🏢 Abteilung / Jahrgang</option>
            </select>
          </Field>
          <Field label="Mitglieder auswählen">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4 }}>
              {users.filter(u => u.role === 'azubi').map(u => (
                <button key={u.id} onClick={() => toggleMember(u.id)} aria-pressed={form.members.includes(u.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 11px', borderRadius: 8, background: form.members.includes(u.id) ? C.acd : C.sf2, border: `1px solid ${form.members.includes(u.id) ? C.ac : C.bd2}`, cursor: 'pointer', transition: 'all .15s', textAlign: 'left' }}>
                  <Avatar name={u.name} size={26} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: form.members.includes(u.id) ? C.ac : C.br }}>{u.name}</div>
                    <div style={{ fontSize: 10, color: C.mu }}>{u.email}</div>
                  </div>
                  {form.members.includes(u.id) && <span style={{ color: C.ac, fontSize: 14 }}>✓</span>}
                </button>
              ))}
            </div>
          </Field>
          <button className="abtn" onClick={add} style={{ width: '100%', marginTop: 10, padding: 11 }} disabled={!form.name.trim()}>
            Gruppe erstellen ({form.members.length} Mitglieder)
          </button>
        </Modal>
      )}
    </main>
  );
}

export default GroupsView;
