import { useState } from "react";
import { C, uid, genGroupCode } from '../../lib/utils.js';
import { Avatar, Modal, Field, EmptyState } from '../../components/UI.jsx';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import type { User, Project, Id } from '../../types';

type Group = {
  id: Id;
  name: string;
  type: string;
  members: Id[];
  code?: string;   // Phase 2: Beitritts-Code für Selbst-Registrierung
};

// Projects in this view carry group-assignment fields not present in the shared schema.
type GroupProject = Project & {
  groupId?: Id;
  assignees?: Id[];
};

type GroupForm = {
  name: string;
  type: string;
  members: Id[];
};

type GroupsViewProps = {
  groups: Group[];
  users: User[];
  projects: GroupProject[];
  onUpdateGroups: (groups: Group[]) => void;
  showToast: (msg: string) => void;
  canManage?: boolean;   // Phase 2: nur Ausbilder darf Gruppen/Codes verwalten
};

export function GroupsView({ groups, users, projects, onUpdateGroups, showToast, canManage = false }: GroupsViewProps) {
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<GroupForm>({ name: '', type: 'team', members: [] });
  const [confirmDel, setConfirmDel] = useState<Id | null>(null);

  const add = () => {
    if (!form.name.trim()) return;
    onUpdateGroups([...groups, { id: uid(), name: form.name.trim(), type: form.type, members: form.members, code: genGroupCode() }]);
    setShowNew(false);
    setForm({ name: '', type: 'team', members: [] });
    showToast('✓ Gruppe erstellt');
  };

  const remove = (id: Id) => setConfirmDel(id);

  const toggleMember = (uid2: Id) => {
    const m = form.members.includes(uid2) ? form.members.filter(x => x !== uid2) : [...form.members, uid2];
    setForm(f => ({ ...f, members: m }));
  };

  return (
    <main style={{ padding: 22, overflow: 'auto', flex: 1 }} className="anim">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: C.br, margin: 0 }}>Gruppen</h1>
        {canManage && <button className="abtn" onClick={() => setShowNew(true)}>+ Neue Gruppe</button>}
      </div>

      {groups.length === 0 ? (
        <EmptyState icon="👥" title="Noch keine Gruppen" subtitle={canManage ? 'Erstelle Teams oder Abteilungen' : 'Dein Ausbilder legt Gruppen an'} action={canManage ? '+ Gruppe erstellen' : undefined} onAction={canManage ? () => setShowNew(true) : undefined} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: 14 }}>
          {groups.map(g => {
            const members  = users.filter(u => g.members.includes(u.id));
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
                  {canManage && <button className="del" onClick={() => remove(g.id)} aria-label={`Gruppe ${g.name} löschen`}>×</button>}
                </div>

                {canManage && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
                    <span style={{ fontSize: 10, color: C.mu, textTransform: 'uppercase', letterSpacing: .8, fontWeight: 700 }}>Beitritts-Code</span>
                    {g.code ? (
                      <button onClick={() => { navigator.clipboard?.writeText(g.code!); showToast('✓ Code kopiert'); }}
                        title="Code kopieren — Azubis nutzen ihn bei der Registrierung"
                        style={{ fontFamily: C.mono, fontSize: 12, fontWeight: 700, letterSpacing: 1, color: C.ac, background: C.acd, border: `1px solid ${C.ac}30`, borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}>
                        {g.code}
                      </button>
                    ) : (
                      <button className="btn" onClick={() => onUpdateGroups(groups.map(x => x.id === g.id ? { ...x, code: genGroupCode() } : x))}
                        style={{ fontSize: 10, padding: '2px 8px' }}>Code erzeugen</button>
                    )}
                  </div>
                )}

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

      {confirmDel && (
        <ConfirmDialog
          message={`Gruppe „${groups.find(g => g.id === confirmDel)?.name}" wirklich löschen?`}
          onConfirm={() => { onUpdateGroups(groups.filter(g => g.id !== confirmDel)); showToast('Gruppe gelöscht'); setConfirmDel(null); }}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </main>
  );
}

export default GroupsView;
