import { useState } from "react";
import { C, uid } from '../../lib/utils.js';
import { IcoLink, IcoExternalLink, IcoPlus, IcoX } from '../../components/Icons.jsx';

const LINK_TYPES = {
  tutorial:  { l: 'Tutorial',       color: C.ac  },
  video:     { l: 'Video',           color: C.cr  },
  doc:       { l: 'Dokumentation',   color: C.gr  },
  tool:      { l: 'Tool',            color: C.yw  },
  example:   { l: 'Beispiel',        color: '#a371f7' },
  other:     { l: 'Sonstiges',       color: C.mu  },
};

function getFavicon(url) {
  try { return `https://www.google.com/s2/favicons?domain=${new URL(url.startsWith('http') ? url : 'https://' + url).hostname}&sz=16`; }
  catch { return null; }
}

function getHost(url) {
  try { return new URL(url.startsWith('http') ? url : 'https://' + url).hostname.replace('www.', ''); }
  catch { return url.slice(0, 30); }
}

function safeUrl(url) {
  if (!url) return '#';
  return url.startsWith('http') ? url : 'https://' + url;
}

function LinkRow({ link, onRemove, readOnly }) {
  const t = LINK_TYPES[link.type] || LINK_TYPES.other;
  const favicon = getFavicon(link.url);
  const [hov, setHov] = useState(false);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 7, transition: 'background .1s', background: hov ? 'var(--c-sf3)' : 'transparent' }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>

      <div style={{ width: 20, height: 20, borderRadius: 4, background: t.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
        {favicon
          ? <img src={favicon} width={12} height={12} alt="" onError={e => e.target.style.display = 'none'} />
          : <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.color }} />}
      </div>

      <a href={safeUrl(link.url)} target="_blank" rel="noopener noreferrer"
        style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: t.color, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
        {link.title || getHost(link.url)}
      </a>

      <span style={{ fontSize: 10, color: C.mu, flexShrink: 0, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {getHost(link.url)}
      </span>

      <span style={{ fontSize: 9, color: t.color, background: t.color + '14', borderRadius: 4, padding: '1px 5px', flexShrink: 0, fontFamily: C.mono, fontWeight: 700 }}>
        {t.l}
      </span>

      {hov && !readOnly && (
        <button onClick={() => onRemove(link.id)} className="del" style={{ fontSize: 14, flexShrink: 0, padding: '1px 5px' }}>×</button>
      )}
      {hov && (
        <a href={safeUrl(link.url)} target="_blank" rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', fontSize: 10, color: C.ac, textDecoration: 'none', flexShrink: 0 }}>
          <IcoExternalLink size={12} />
        </a>
      )}
    </div>
  );
}

export function LinksManager({ links = [], onUpdate, readOnly = false, compact = false }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ url: '', title: '', type: 'tutorial', note: '' });
  const [urlErr, setUrlErr]     = useState('');

  const validate = url => {
    if (!url.trim()) { setUrlErr('URL erforderlich'); return false; }
    try { new URL(url.startsWith('http') ? url : 'https://' + url); setUrlErr(''); return true; }
    catch { setUrlErr('Ungültige URL'); return false; }
  };

  const add = () => {
    if (!validate(form.url)) return;
    onUpdate([...links, { id: uid(), ...form, url: safeUrl(form.url), created: new Date().toISOString() }]);
    setForm({ url: '', title: '', type: 'tutorial', note: '' });
    setShowForm(false);
  };

  const remove = id => onUpdate(links.filter(l => l.id !== id));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: links.length > 0 || showForm ? 8 : 0 }}>
        <IcoLink size={13} style={{ color: C.mu }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: C.mu, textTransform: 'uppercase', letterSpacing: .8, flex: 1 }}>
          Links & Ressourcen
          {links.length > 0 && <span style={{ color: C.ac, fontWeight: 400, marginLeft: 5 }}>({links.length})</span>}
        </span>
        {!readOnly && (
          <button onClick={() => setShowForm(s => !s)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, border: `1px solid ${showForm ? C.cr + '60' : C.ac + '50'}`, background: showForm ? C.crd : C.acd, color: showForm ? C.cr : C.ac, fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all .12s' }}>
            {showForm ? <IcoX size={11} /> : <IcoPlus size={11} />}
            {showForm ? 'Abbrechen' : 'Link'}
          </button>
        )}
      </div>

      {links.length > 0 && !showForm && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {links.map(l => <LinkRow key={l.id} link={l} onRemove={remove} readOnly={readOnly} />)}
        </div>
      )}

      {links.length === 0 && !showForm && !readOnly && (
        <div style={{ fontSize: 11, color: C.mu, fontStyle: 'italic', paddingLeft: 4 }}>
          Noch keine Links — klicke + Link
        </div>
      )}

      {showForm && (
        <div style={{ background: 'var(--c-sf3)', border: `1px solid var(--c-bd2)`, borderRadius: 9, padding: 12, animation: 'fadeUp .15s ease' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label>URL *</label>
              <input autoFocus value={form.url}
                onChange={e => { setForm(f => ({ ...f, url: e.target.value })); setUrlErr(''); }}
                onKeyDown={e => e.key === 'Enter' && add()}
                placeholder="https://docs.oracle.com/…"
                style={{ borderColor: urlErr ? C.cr : undefined }} />
              {urlErr && <div style={{ fontSize: 10, color: C.cr, marginTop: 2 }}>{urlErr}</div>}
            </div>
            <div>
              <label>Titel (optional)</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Beschreibender Name…" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div>
              <label>Kategorie</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {Object.entries(LINK_TYPES).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
              </select>
            </div>
            <div>
              <label>Notiz (optional)</label>
              <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Wofür ist dieser Link?" />
            </div>
          </div>
          <button className="abtn" onClick={add} style={{ width: '100%', padding: '7px', fontSize: 12, justifyContent: 'center' }}>
            <IcoPlus size={12} /> Link hinzufügen
          </button>
        </div>
      )}
    </div>
  );
}
