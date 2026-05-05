import { useState } from "react";
import { C, uid } from '../../lib/utils.js';
import { hashPassword, isHashed } from '../../lib/crypto.js';
import { dataService } from '../../lib/dataService.js';
import { Avatar, Modal, Field, EmptyState } from '../../components/UI.jsx';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';

const USE_API = import.meta.env.VITE_USE_API === 'true';

export function UsersView({ users, onUpdateUsers, showToast }) {
  const azubis = users.filter(u => u.role === 'azubi');
  const [showForm, setShowForm]     = useState(false);
  const [editUser, setEditUser]     = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [form, setForm]             = useState(emptyForm());
  const [saving, setSaving]         = useState(false);

  function emptyForm() {
    return { name: '', email: '', password: '', apprenticeship_year: '1' };
  }

  const openNew = () => {
    setEditUser(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const openEdit = (u) => {
    setEditUser(u);
    setForm({ name: u.name, email: u.email, password: '', apprenticeship_year: String(u.apprenticeship_year || 1) });
    setShowForm(true);
  };

  const close = () => { setShowForm(false); setEditUser(null); setForm(emptyForm()); };

  const save = async () => {
    if (!form.name.trim() || !form.email.trim()) return;
    if (!editUser && form.password.length < 4) return;

    setSaving(true);
    try {
      if (editUser) {
        // ── Nutzer bearbeiten ─────────────────────────────
        if (USE_API) {
          // MySQL aktualisieren
          await dataService.updateUser(editUser.id, {
            name:                form.name.trim(),
            apprenticeship_year: Number(form.apprenticeship_year),
            ...(form.password.length >= 4 ? { password: form.password } : {}),
          });
        }
        // Blob aktualisieren (kein Passwort-Hash mehr nötig wenn API)
        let pw = editUser.password;
        if (!USE_API && form.password.length >= 4) pw = await hashPassword(form.password);
        const updated = users.map(u => u.id === editUser.id
          ? { ...u, name: form.name.trim(), email: form.email.trim(),
              ...(pw !== undefined ? { password: pw } : {}),
              apprenticeship_year: Number(form.apprenticeship_year) }
          : u
        );
        onUpdateUsers(updated);
        showToast('✓ Nutzer aktualisiert');
      } else {
        // ── Neuen Nutzer anlegen ──────────────────────────
        if (users.some(u => u.email.toLowerCase() === form.email.trim().toLowerCase())) {
          showToast('⚠ E-Mail bereits vergeben');
          return;
        }

        if (USE_API) {
          // In MySQL anlegen → liefert echte Integer-ID zurück
          const created = await dataService.createUser({
            name:                form.name.trim(),
            email:               form.email.trim().toLowerCase(),
            password:            form.password,
            apprenticeship_year: Number(form.apprenticeship_year),
          });
          // Blob mit MySQL-ID aktualisieren (Passwort wird NICHT gespeichert)
          const newUser = {
            id:                  created.id,  // bereits als String normalisiert
            name:                created.name,
            email:               created.email,
            role:                'azubi',
            apprenticeship_year: created.apprenticeship_year,
            is_active:           true,
          };
          onUpdateUsers([...users, newUser]);
        } else {
          // Lokaler Modus: SHA-256 Hash, eigene ID
          const pw = await hashPassword(form.password);
          const newUser = {
            id: uid(), name: form.name.trim(), email: form.email.trim(),
            password: pw, role: 'azubi',
            apprenticeship_year: Number(form.apprenticeship_year),
          };
          onUpdateUsers([...users, newUser]);
        }
        showToast('✓ Nutzer erstellt');
      }
      close();
    } catch (e) {
      showToast('⚠ ' + (e.message || 'Unbekannter Fehler'));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u) => {
    const activate = u.active === false || u.is_active === false;
    if (USE_API) {
      try {
        if (activate) await dataService.activateUser(u.id);
        else          await dataService.deactivateUser(u.id);
      } catch (e) {
        showToast('⚠ ' + (e.message || 'Fehler'));
        return;
      }
    }
    onUpdateUsers(users.map(x => x.id === u.id
      ? { ...x, active: activate, is_active: activate }
      : x
    ));
    showToast(activate ? 'Nutzer aktiviert' : 'Nutzer deaktiviert');
  };

  const isInactive = (u) => u.active === false || u.is_active === false;

  return (
    <main style={{ padding: 22, overflow: 'auto', flex: 1 }} className="anim">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: C.br, margin: 0 }}>Nutzerverwaltung</h1>
          <div style={{ fontSize: 11, color: C.mu, marginTop: 3 }}>
            {azubis.length} Azubis
            {USE_API && <span style={{ marginLeft: 6, color: C.gr }}>· API-Modus (MySQL)</span>}
          </div>
        </div>
        <button className="abtn" onClick={openNew}>+ Neuer Azubi</button>
      </div>

      {azubis.length === 0 ? (
        <EmptyState icon="👤" title="Noch keine Azubis" subtitle="Lege Azubi-Profile an" action="+ Neuer Azubi" onAction={openNew} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px,1fr))', gap: 12 }}>
          {azubis.map(u => {
            const inactive = isInactive(u);
            return (
              <article key={u.id} className="card" style={{ opacity: inactive ? .55 : 1 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <Avatar name={u.name} size={42} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: C.br }}>{u.name}</div>
                      {inactive && <span className="tag" style={{ background: C.crd, color: C.cr, border: `1px solid ${C.cr}30`, fontSize: 9 }}>Inaktiv</span>}
                    </div>
                    <div style={{ fontSize: 11, color: C.mu, marginBottom: 6 }}>{u.email}</div>
                    <span className="tag" style={{ background: C.acd, color: C.ac, border: `1px solid ${C.ac}30`, fontSize: 10 }}>
                      Lehrjahr {u.apprenticeship_year || 1}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.bd}` }}>
                  <button className="btn" onClick={() => openEdit(u)} style={{ flex: 1, fontSize: 11, padding: '6px 0', justifyContent: 'center' }}>Bearbeiten</button>
                  <button onClick={() => toggleActive(u)}
                    style={{ flex: 1, fontSize: 11, padding: '6px 0', borderRadius: 7, border: `1px solid ${inactive ? C.gr + '60' : C.yw + '60'}`, background: inactive ? '#07130a' : C.ywd, color: inactive ? C.gr : C.yw, cursor: 'pointer', fontWeight: 600 }}>
                    {inactive ? '✓ Aktivieren' : '⏸ Deaktivieren'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {showForm && (
        <Modal title={editUser ? `${editUser.name} bearbeiten` : 'Neuen Azubi anlegen'} onClose={close}>
          <Field label="Name">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Vor- und Nachname" autoFocus />
          </Field>
          <Field label="E-Mail">
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="azubi@betrieb.de" disabled={!!editUser} style={editUser ? { opacity: .6 } : {}} />
          </Field>
          <Field label={editUser ? 'Neues Passwort (leer lassen = unverändert)' : `Passwort (min. 4 Zeichen${USE_API ? ', bcrypt' : ', SHA-256'})`}>
            <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder={editUser ? '••••••' : 'Min. 4 Zeichen'} />
          </Field>
          <Field label="Lehrjahr">
            <select value={form.apprenticeship_year} onChange={e => setForm(f => ({ ...f, apprenticeship_year: e.target.value }))}>
              <option value="1">1. Lehrjahr</option>
              <option value="2">2. Lehrjahr</option>
              <option value="3">3. Lehrjahr</option>
            </select>
          </Field>
          <button className="abtn" onClick={save} style={{ width: '100%', marginTop: 10, padding: 11 }}
            disabled={saving || !form.name.trim() || !form.email.trim() || (!editUser && form.password.length < 4)}>
            {saving ? 'Speichern…' : editUser ? 'Änderungen speichern' : 'Azubi anlegen'}
          </button>
        </Modal>
      )}
    </main>
  );
}

export default UsersView;
