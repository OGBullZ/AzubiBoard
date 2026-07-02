import React, { useState, useRef, lazy, Suspense } from 'react';
import { useAppStore } from '../lib/store';
import { dataService } from '../lib/dataService';
import { sameId } from '../lib/utils';
import { playStamp } from '../lib/sound.js';
import { ACCENTS } from '../lib/prefs.js';
import type { ShowToast } from '../lib/hooks';
import type { User, Project, Task, AppState } from '../types';

const TwoFactorSettings = lazy(() => import('../features/auth/TwoFactorSettings.jsx'));

const USE_API = import.meta.env.VITE_USE_API === 'true';

// ── Design-Version 1.0 ↔ 1.1 (Werkbank-Redesign, DESIGN-VISION.md) ──
// Boot-Apply in main.tsx; ACCENTS geteilt mit Onboarding (lib/prefs).
function DesignSwitch() {
  // Graduierung 2026-06-11: Werkbank-Design ist 1.1 und Default; interner Wert bleibt 'beta' (CSS-Hooks)
  const [design, setDesign] = useState(() => localStorage.getItem('azubiboard_design') || 'beta');
  const [accent, setAccent] = useState(() => localStorage.getItem('azubiboard_accent') || 'orange');
  const [sound, setSound] = useState(() => localStorage.getItem('azubiboard_sound') === 'on');
  const apply = (key: string, val: string, set: (v: string) => void) => {
    set(val);
    try { localStorage.setItem(`azubiboard_${key}`, val); } catch { /* noop */ }
    const run = () => {
      document.documentElement.setAttribute(`data-${key}`, val);
      if (key === 'design') window.dispatchEvent(new Event('azubiboard:design')); // useDesign-Konsumenten re-rendern
    };
    // Design-Wechsel mit weichem Sweep (View Transitions, progressive enhancement)
    if (key === 'design' && 'startViewTransition' in document && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      (document as any).startViewTransition(run);
    } else run();
  };
  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    try { localStorage.setItem('azubiboard_sound', next ? 'on' : 'off'); } catch { /* noop */ }
    if (next) playStamp();   // sofortiges Probehören
  };
  return (
    <div style={{ marginTop: 14 }}>
      <label>Design-Version</label>
      <div style={{ display: 'flex', gap: 8 }}>
        {[['v1', '1.0'], ['beta', '1.1 ✦']].map(([val, lab]) => (
          <button key={val} className="btn" onClick={() => apply('design', val, setDesign)} aria-pressed={design === val}
            style={{ flex: 1, justifyContent: 'center', padding: '9px',
              ...(design === val ? { borderColor: 'var(--c-ac)', color: 'var(--c-ac-text)', background: 'var(--c-acd)' } : {}) }}>
            {lab}
          </button>
        ))}
      </div>
      {design === 'beta' && (
        <div style={{ marginTop: 10 }}>
          <label>Akzentfarbe</label>
          <div style={{ display: 'flex', gap: 8 }} role="radiogroup" aria-label="Akzentfarbe">
            {ACCENTS.map(a => (
              <button key={a.val} onClick={() => apply('accent', a.val, setAccent)}
                role="radio" aria-checked={accent === a.val} aria-label={a.label} title={a.label}
                style={{ width: 34, height: 34, borderRadius: 8, background: a.hex, cursor: 'pointer',
                  border: accent === a.val ? '2px solid var(--c-br)' : '2px solid transparent',
                  outlineOffset: 2, boxShadow: accent === a.val ? '0 0 0 1.5px var(--c-bg) inset' : 'none' }} />
            ))}
          </div>
        </div>
      )}
      {design === 'beta' && (
        <button className="btn" onClick={toggleSound} aria-pressed={sound}
          style={{ width: '100%', marginTop: 10, padding: '9px', justifyContent: 'center',
            ...(sound ? { borderColor: 'var(--c-ac)', color: 'var(--c-ac-text)' } : {}) }}>
          {sound ? '🔊 Werkstatt-Sounds an' : '🔇 Werkstatt-Sounds aus'}
        </button>
      )}
      <div style={{ fontSize: 11, color: 'var(--c-mu)', marginTop: 6 }}>
        1.1 = neues „Werkbank"-Design (Standard). Jederzeit auf 1.0 zurückschaltbar.
      </div>
    </div>
  );
}

// ── Profil-Seite ──────────────────────────────────────────────
export function ProfilePage({ showToast }: { showToast: ShowToast }) {
  const store = useAppStore();
  const currentUser = store.currentUser as User | null;
  const data = store.data as AppState | null;
  const setCurrentUser = store.setCurrentUser;
  const setData = store.setData;
  const [tab, setTab]               = useState('info');
  const [name, setName]             = useState(() => currentUser?.name || '');
  const [profession, setProfession] = useState(() => currentUser?.profession || '');
  const [company, setCompany]       = useState(() => currentUser?.company || '');
  const [department, setDepartment] = useState(() => currentUser?.department || '');
  const [year, setYear]             = useState(() => String(currentUser?.apprenticeship_year || 1));
  const [oldPw, setOldPw]           = useState('');
  const [newPw, setNewPw]           = useState('');
  const [saving, setSaving]         = useState(false);
  const [avatarHov, setAvatarHov]   = useState(false);
  const avatarInputRef              = useRef<HTMLInputElement>(null);
  const toast = showToast || (() => {});

  if (!currentUser) return null;

  const isAzubi = currentUser.role === 'azubi';
  const myProjects = (data?.projects || []).filter((p: Project) => !p.archived && p.assignees?.some(a => sameId(a, currentUser.id)));
  const hue = (currentUser.name?.charCodeAt(0) || 100) * 37 % 360;

  // Eingabe-Style wiederverwenden
  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 7, border: '1px solid var(--c-bd2)', background: 'var(--c-sf2)', color: 'var(--c-br)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' };
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--c-mu)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 6 };

  const saveProfile = async () => {
    const trimName = name.trim();
    const trimProf = profession.trim();
    const parsedYear = Number(year);
    if (!trimName) return;

    const trimCompany = company.trim();
    const trimDept    = department.trim();
    const changes: any = {};
    if (trimName !== currentUser.name)                             changes.name = trimName;
    if (trimProf !== (currentUser.profession || ''))              changes.profession = trimProf;
    if (isAzubi && trimCompany !== (currentUser.company || ''))    changes.company = trimCompany;
    if (isAzubi && trimDept !== (currentUser.department || ''))    changes.department = trimDept;
    if (isAzubi && parsedYear !== (currentUser.apprenticeship_year || 1)) changes.apprenticeship_year = parsedYear;
    if (Object.keys(changes).length === 0) return;

    setSaving(true);
    try {
      if (USE_API) await dataService.updateProfile(changes);
      const updatedUser = { ...currentUser, ...changes };
      setCurrentUser(updatedUser);
      setData((prev: any) => prev ? { ...prev, users: (prev.users || []).map((u: User) => sameId(u.id, currentUser.id) ? { ...u, ...changes } : u) } : prev);
      toast('✓ Profil gespeichert');
    } catch (e: any) { toast('⚠ ' + e.message); }
    finally { setSaving(false); }
  };

  const savePassword = async () => {
    if (!oldPw || newPw.length < 8) return;
    setSaving(true);
    try {
      if (USE_API) {
        await dataService.changePassword(oldPw, newPw);
        toast('✓ Passwort geändert');
        setOldPw(''); setNewPw('');
      } else {
        toast('⚠ Passwortänderung nur im API-Modus verfügbar');
      }
    } catch (e: any) { toast('⚠ ' + e.message); }
    finally { setSaving(false); }
  };

  const handleAvatarClick = () => {
    if (!USE_API) { toast('⚠ Avatar-Upload nur im API-Modus verfügbar'); return; }
    avatarInputRef.current?.click();
  };
  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    try {
      const { avatar_url } = await dataService.uploadAvatar(file);
      const updatedUser = { ...currentUser, avatar_url };
      setCurrentUser(updatedUser);
      setData((prev: any) => prev ? { ...prev, users: (prev.users || []).map((u: User) => sameId(u.id, currentUser.id) ? { ...u, avatar_url } : u) } : prev);
      toast('✓ Profilbild gespeichert');
    } catch (err: any) { toast('⚠ ' + err.message); }
    finally { setSaving(false); e.target.value = ''; }
  };

  const tabBtn = (key: string, label: string) => (
    <button key={key} onClick={() => setTab(key)} role="tab" aria-selected={tab === key}
      style={{ flex: 1, padding: '8px', borderRadius: 6, fontSize: 13, fontWeight: 700, border: 'none',
        background: tab === key ? 'var(--c-ac)' : 'transparent',
        color: tab === key ? 'var(--c-on-ac)' : 'var(--c-mu)', transition: 'all .15s' }}>
      {label}
    </button>
  );

  return (
    <div style={{ padding: 24, maxWidth: 560 }}>
      {/* Avatar + Header */}
      <div className="card" style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
        {/* Klickbarer Avatar mit Kamera-Overlay; Beta: wandernde Strichlinie beim Hover (Anhang C) */}
        <div className="avatar-drop" style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }}
          onClick={handleAvatarClick}
          onMouseEnter={() => setAvatarHov(true)}
          onMouseLeave={() => setAvatarHov(false)}
          title="Profilbild ändern">
          {currentUser.avatar_url
            ? <img src={currentUser.avatar_url} alt={currentUser.name}
                style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.1)', display: 'block' }} />
            : <div style={{ width: 56, height: 56, borderRadius: '50%', background: `hsl(${hue},45%,22%)`, border: '2px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: `hsl(${hue},65%,75%)` }}>
                {currentUser.name?.split(' ').map((w: string) => w[0]).slice(0,2).join('').toUpperCase()}
              </div>}
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: avatarHov ? 1 : 0, transition: 'opacity .15s' }}>
            <span style={{ fontSize: 16 }}>📷</span>
          </div>
          <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }} onChange={handleAvatarFile} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--c-br)' }}>{currentUser.name}</div>
          <div style={{ fontSize: 12, color: 'var(--c-mu)', marginTop: 2 }}>
            {currentUser.email}
          </div>
          <div style={{ fontSize: 11, color: 'var(--c-mu)', marginTop: 2 }}>
            {isAzubi
              ? `Azubi · Lehrjahr ${currentUser.apprenticeship_year || 1}${currentUser.profession ? ` · ${currentUser.profession}` : ''}`
              : `${currentUser.role === 'mentor' ? 'Mentor' : 'Ausbilder'}${currentUser.profession ? ` · ${currentUser.profession}` : ''}`}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Aktive Projekte',  value: myProjects.length,                                                                                     color: 'var(--c-ac-text)' },
          { label: 'Offene Aufgaben',  value: myProjects.flatMap((p: Project) => p.tasks||[]).filter((t: Task) => sameId(t.assignee, currentUser.id) && t.status !== 'done').length, color: 'var(--c-yw-text)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ borderLeft: `3px solid ${s.color}`, padding: '10px 14px' }}>
            <div style={{ fontSize: 10, color: 'var(--c-mu)', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="card">
        <div role="tablist" style={{ display: 'flex', background: 'var(--c-sf2)', borderRadius: 8, padding: 3, marginBottom: 18, gap: 3 }}>
          {tabBtn('info', 'Profil')}
          {tabBtn('password', 'Passwort')}
          {USE_API && tabBtn('security', '🔒 Sicherheit')}
        </div>

        {tab === 'info' && (
          <div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle} htmlFor="prof-name">Anzeigename</label>
              <input id="prof-name" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Ausbildungsberuf</label>
              <input value={profession} onChange={e => setProfession(e.target.value)}
                placeholder="z. B. Fachinformatiker Anwendungsentwicklung"
                style={inputStyle} />
            </div>
            {isAzubi && (
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Lehrjahr</label>
                <select value={year} onChange={e => setYear(e.target.value)}
                  style={{ ...inputStyle, appearance: 'auto' }}>
                  <option value="1">1. Lehrjahr</option>
                  <option value="2">2. Lehrjahr</option>
                  <option value="3">3. Lehrjahr</option>
                </select>
              </div>
            )}
            {isAzubi && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Ausbildungsbetrieb</label>
                  <input value={company} onChange={e => setCompany(e.target.value)}
                    placeholder="z. B. Muster GmbH" style={inputStyle} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Abteilung</label>
                  <input value={department} onChange={e => setDepartment(e.target.value)}
                    placeholder="z. B. IT / Anwendungsentwicklung" style={inputStyle} />
                </div>
              </>
            )}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle} htmlFor="prof-email">E-Mail</label>
              <input id="prof-email" value={currentUser.email} disabled
                style={{ ...inputStyle, border: '1px solid var(--c-bd)', background: 'var(--c-sf3)', color: 'var(--c-mu)', opacity: .7 }} />
            </div>
            <button className="abtn" onClick={saveProfile} disabled={saving || !name.trim()}
              style={{ width: '100%', padding: 11, fontSize: 13 }}>
              {saving ? 'Speichern…' : 'Profil speichern'}
            </button>
            <button className="btn" onClick={() => {
              if (currentUser?.id) localStorage.removeItem(`azubiboard_onboarded_${currentUser.id}`);
              window.dispatchEvent(new Event('azubiboard:show-onboarding'));
            }} style={{ width: '100%', marginTop: 8, padding: '9px', fontSize: 12, color: 'var(--c-ac-text)', borderColor: 'var(--c-ac)60' }}>
              🎓 Einführungs-Wizard erneut anzeigen
            </button>
            <button className="btn" onClick={() => window.dispatchEvent(new Event('azubiboard:show-news'))}
              style={{ width: '100%', marginTop: 8, padding: '9px', fontSize: 12, color: 'var(--c-ac-text)', borderColor: 'var(--c-ac)60' }}>
              📰 Tagesübersicht anzeigen
            </button>
            <DesignSwitch />
          </div>
        )}

        {tab === 'password' && (
          <div>
            {!USE_API && (
              <div style={{ fontSize: 12, color: 'var(--c-mu)', background: 'var(--c-sf2)', borderRadius: 7, padding: '10px 12px', marginBottom: 14, borderLeft: '3px solid var(--c-yw)' }}>
                Passwortänderung ist nur im API-Modus verfügbar (VITE_USE_API=true).
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Aktuelles Passwort</label>
              <input type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} disabled={!USE_API}
                style={inputStyle} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Neues Passwort (min. 8 Zeichen)</label>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} disabled={!USE_API}
                style={inputStyle} />
            </div>
            <button className="abtn" onClick={savePassword}
              disabled={saving || !USE_API || !oldPw || newPw.length < 8}
              style={{ width: '100%', padding: 11, fontSize: 13 }}>
              {saving ? 'Ändern…' : 'Passwort ändern'}
            </button>
          </div>
        )}

        {tab === 'security' && (
          <Suspense fallback={<div style={{ fontSize: 12, color: 'var(--c-mu)' }}>Lädt …</div>}>
            <TwoFactorSettings showToast={showToast} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
