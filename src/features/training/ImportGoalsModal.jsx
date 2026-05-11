// ============================================================
//  ImportGoalsModal – Bulk-Import von Lernzielen (J16)
//  Unterstützt: CSV (Semikolon-getrennt), JSON-Array,
//  und 2 Built-in-Vorlagen (Kaufmännisch, IT/Digital).
// ============================================================
import { useMemo, useState } from 'react';
import { C, uid } from '../../lib/utils.js';
import { IcoX, IcoDoc } from '../../components/Icons.jsx';

const YEARS    = [1, 2, 3];
const QUARTERS = [1, 2, 3, 4];
const CATS     = ['Fachkompetenz', 'Methodenkompetenz', 'Sozialkompetenz', 'IT & Digital', 'Betrieb', 'Schule', 'Sonstiges'];

// ── Built-in-Vorlagen: knapper Auszug aus IHK-Rahmenplänen ──
const TEMPLATES = {
  kaufmaennisch: {
    label: 'Kaufmännisch (Büro / Office)',
    goals: [
      { title: 'Bürokommunikation',          description: 'E-Mails, Telefon, Posteingang/-ausgang',          year: 1, quarter: 1, category: 'Fachkompetenz'      },
      { title: 'Datenschutz & DSGVO',        description: 'Grundlagen, Aufbewahrungsfristen, Verschwiegenheit', year: 1, quarter: 1, category: 'Betrieb'              },
      { title: 'Excel — Grundlagen',         description: 'Tabellen, Formeln (SUMME, WENN, SVERWEIS)',         year: 1, quarter: 2, category: 'IT & Digital'          },
      { title: 'Word — Geschäftsbriefe',     description: 'DIN 5008, Vorlagen, Seriendruck',                   year: 1, quarter: 2, category: 'IT & Digital'          },
      { title: 'Rechnungsstellung',          description: 'Pflichtangaben, USt., Skonto',                      year: 1, quarter: 3, category: 'Fachkompetenz'         },
      { title: 'Mahnwesen',                  description: '1./2./3. Mahnung, Verzugszinsen',                   year: 1, quarter: 4, category: 'Fachkompetenz'         },
      { title: 'Kundengespräche',            description: 'Begrüßung, Bedarfsanalyse, Einwandbehandlung',      year: 2, quarter: 1, category: 'Sozialkompetenz'       },
      { title: 'Buchhaltung — Grundlagen',   description: 'Aktiva, Passiva, GuV, Bilanz',                      year: 2, quarter: 2, category: 'Fachkompetenz'         },
      { title: 'Personalwirtschaft',         description: 'Lohnabrechnung-Grundzüge, Sozialversicherung',      year: 2, quarter: 3, category: 'Fachkompetenz'         },
      { title: 'Projektarbeit',              description: 'Eigenständiges Projekt für IHK-Prüfung',            year: 3, quarter: 1, category: 'Methodenkompetenz'     },
    ],
  },
  itDigital: {
    label: 'IT / Digitalisierung (Fachinformatiker)',
    goals: [
      { title: 'Hardware-Grundlagen',        description: 'CPU, RAM, Storage, Mainboard, BIOS/UEFI',           year: 1, quarter: 1, category: 'Fachkompetenz'         },
      { title: 'Betriebssysteme',            description: 'Windows + Linux, Dateisystem, Berechtigungen',      year: 1, quarter: 1, category: 'IT & Digital'          },
      { title: 'Netzwerk — OSI/TCP-IP',      description: 'Schichten, IP, Subnetting, DNS',                    year: 1, quarter: 2, category: 'IT & Digital'          },
      { title: 'Programmieren — Grundlagen', description: 'Variablen, Schleifen, Funktionen (Python/Java)',    year: 1, quarter: 2, category: 'IT & Digital'          },
      { title: 'SQL — Basics',               description: 'SELECT, JOIN, GROUP BY, Indizes',                   year: 1, quarter: 3, category: 'IT & Digital'          },
      { title: 'Versionskontrolle (Git)',    description: 'commit, branch, merge, pull request',               year: 1, quarter: 3, category: 'Methodenkompetenz'     },
      { title: 'IT-Sicherheit',              description: 'Verschlüsselung, Authentifizierung, OWASP-Top-10',  year: 2, quarter: 1, category: 'IT & Digital'          },
      { title: 'Datenbank-Design',           description: 'Normalformen, ER-Modell, Relationen',               year: 2, quarter: 2, category: 'IT & Digital'          },
      { title: 'Frontend (HTML/CSS/JS)',     description: 'Responsive Layout, DOM, Fetch-API',                 year: 2, quarter: 3, category: 'IT & Digital'          },
      { title: 'Backend & APIs',             description: 'REST, Auth, Persistierung',                         year: 2, quarter: 4, category: 'IT & Digital'          },
      { title: 'Projektmanagement',          description: 'Agile, Scrum, Kanban; Pflichten-/Lastenheft',       year: 3, quarter: 1, category: 'Methodenkompetenz'     },
      { title: 'Abschlussprojekt',           description: 'Eigenständiges IHK-Projekt mit Dokumentation',      year: 3, quarter: 2, category: 'Methodenkompetenz'     },
    ],
  },
};

// ── CSV-Parser (Semikolon-getrennt, Header-Row) ─────────────
//   title;description;year;quarter;category
function parseCSV(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return { goals: [], errors: ['Datei ist leer'] };
  const header = lines[0].split(';').map(h => h.trim().toLowerCase());
  const required = ['title', 'year', 'quarter'];
  const missing  = required.filter(r => !header.includes(r));
  if (missing.length) return { goals: [], errors: [`Spalten fehlen: ${missing.join(', ')}`] };

  const idx = (k) => header.indexOf(k);
  const goals = [];
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';').map(c => c.trim().replace(/^"|"$/g, ''));
    const title = cols[idx('title')];
    if (!title) { errors.push(`Zeile ${i + 1}: title fehlt`); continue; }
    const year    = Number(cols[idx('year')]);
    const quarter = Number(cols[idx('quarter')]);
    if (!YEARS.includes(year))       { errors.push(`Zeile ${i + 1}: ungültiges Lehrjahr "${cols[idx('year')]}"`); continue; }
    if (!QUARTERS.includes(quarter)) { errors.push(`Zeile ${i + 1}: ungültiges Quartal "${cols[idx('quarter')]}"`); continue; }
    const description = idx('description') !== -1 ? cols[idx('description')] || '' : '';
    let category = idx('category') !== -1 ? cols[idx('category')] || 'Fachkompetenz' : 'Fachkompetenz';
    if (!CATS.includes(category))    category = 'Fachkompetenz';
    goals.push({ id: uid(), title, description, year, quarter, category, progress: {} });
  }
  return { goals, errors };
}

// ── JSON-Parser ─────────────────────────────────────────────
function parseJSON(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch (e) { return { goals: [], errors: [`JSON ungültig: ${e.message}`] }; }
  const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.goals) ? parsed.goals : null);
  if (!list) return { goals: [], errors: ['JSON muss Array sein oder {"goals": [...]}-Objekt'] };
  const goals = [];
  const errors = [];
  list.forEach((g, i) => {
    if (!g?.title) { errors.push(`Eintrag ${i + 1}: title fehlt`); return; }
    const year    = Number(g.year) || 1;
    const quarter = Number(g.quarter) || 1;
    if (!YEARS.includes(year))       { errors.push(`Eintrag ${i + 1}: ungültiges year`); return; }
    if (!QUARTERS.includes(quarter)) { errors.push(`Eintrag ${i + 1}: ungültiges quarter`); return; }
    const category = CATS.includes(g.category) ? g.category : 'Fachkompetenz';
    goals.push({ id: uid(), title: String(g.title), description: String(g.description || ''), year, quarter, category, progress: {} });
  });
  return { goals, errors };
}

export default function ImportGoalsModal({ existingGoals = [], onImport, onClose }) {
  const [tab, setTab]   = useState('template'); // 'template' | 'csv' | 'json'
  const [text, setText] = useState('');
  const [tpl,  setTpl]  = useState('itDigital');
  const [dedup, setDedup] = useState(true);

  const parsed = useMemo(() => {
    if (tab === 'template') {
      const t = TEMPLATES[tpl];
      const goals = (t?.goals || []).map(g => ({ id: uid(), ...g, progress: {} }));
      return { goals, errors: [] };
    }
    if (!text.trim()) return { goals: [], errors: [] };
    return tab === 'csv' ? parseCSV(text) : parseJSON(text);
  }, [tab, text, tpl]);

  const existingTitles = useMemo(
    () => new Set((existingGoals || []).map(g => `${g.title?.toLowerCase().trim()}|${g.year}|${g.quarter}`)),
    [existingGoals]
  );

  const finalGoals = useMemo(() => {
    if (!dedup) return parsed.goals;
    return parsed.goals.filter(g => !existingTitles.has(`${g.title.toLowerCase().trim()}|${g.year}|${g.quarter}`));
  }, [parsed.goals, dedup, existingTitles]);

  const skippedCount = parsed.goals.length - finalGoals.length;

  const doImport = () => {
    if (!finalGoals.length) return;
    onImport(finalGoals);
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 1024 * 1024) return alert('Datei zu groß (max. 1 MB)');
    const reader = new FileReader();
    reader.onload = (ev) => {
      setText(ev.target.result);
      if (f.name.toLowerCase().endsWith('.json')) setTab('json');
      else setTab('csv');
    };
    reader.readAsText(f);
    e.target.value = '';
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="import-title"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div style={{ background: 'var(--c-sf)', border: '1px solid var(--c-bd2)', borderRadius: 12, width: '100%', maxWidth: 720, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.6)' }}>
        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--c-bd)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span id="import-title" style={{ fontSize: 14, fontWeight: 800, color: 'var(--c-br)', flex: 1 }}>
            📥 Lernziele importieren
          </span>
          <button onClick={onClose} aria-label="Schließen"
            style={{ background: 'transparent', border: 'none', color: C.mu, cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 6px' }}>
            <IcoX size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: '10px 16px 0', borderBottom: '1px solid var(--c-bd)' }}>
          {[
            ['template', '📚 Vorlage'],
            ['csv',      '📄 CSV-Datei'],
            ['json',     '📋 JSON-Code'],
          ].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{
                padding: '7px 14px', fontSize: 12, fontWeight: 700, border: 'none',
                background: 'transparent', color: tab === k ? C.ac : C.mu,
                borderBottom: `2px solid ${tab === k ? C.ac : 'transparent'}`,
                cursor: 'pointer', marginBottom: -1,
              }}>{l}</button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: 18, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tab === 'template' && (
            <>
              <div style={{ fontSize: 12, color: C.tx }}>
                Wähle eine Branchen-Vorlage. Die Lernziele basieren auf typischen IHK-Rahmenplänen
                und können nach dem Import individuell angepasst werden.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Object.entries(TEMPLATES).map(([k, t]) => (
                  <label key={k} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    border: `1px solid ${tpl === k ? C.ac : 'var(--c-bd2)'}`, borderRadius: 8,
                    background: tpl === k ? C.acd : 'var(--c-sf2)', cursor: 'pointer',
                  }}>
                    <input type="radio" name="tpl" value={k} checked={tpl === k} onChange={() => setTpl(k)} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-br)' }}>{t.label}</div>
                      <div style={{ fontSize: 11, color: C.mu, marginTop: 2 }}>{t.goals.length} Lernziele</div>
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}

          {tab === 'csv' && (
            <>
              <div style={{ fontSize: 12, color: C.tx }}>
                CSV-Format (Semikolon-getrennt, Header-Zeile pflicht):
                <pre style={{ background: 'var(--c-sf2)', padding: 9, borderRadius: 6, fontSize: 11, marginTop: 6, overflow: 'auto', color: C.mu }}>
{`title;description;year;quarter;category
"Excel Grundlagen";"SUMME, MITTELWERT, …";1;1;"IT & Digital"
"Kundengespräch";"Telefon und persönlich";2;3;"Sozialkompetenz"`}
                </pre>
              </div>
              <label style={{ display: 'inline-block' }}>
                <input type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: 'none' }} />
                <span className="btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
                  <IcoDoc size={12} /> Datei wählen
                </span>
              </label>
              <textarea value={text} onChange={e => setText(e.target.value)} rows={8}
                placeholder="… oder CSV-Inhalt hier einfügen"
                style={{ width: '100%', padding: 9, fontFamily: C.mono, fontSize: 11, background: 'var(--c-sf2)', color: 'var(--c-tx)', border: '1px solid var(--c-bd2)', borderRadius: 6, resize: 'vertical' }} />
            </>
          )}

          {tab === 'json' && (
            <>
              <div style={{ fontSize: 12, color: C.tx }}>JSON-Array oder Objekt mit goals-Array:</div>
              <textarea value={text} onChange={e => setText(e.target.value)} rows={10}
                placeholder='[{"title":"…","year":1,"quarter":2,"category":"IT & Digital"}]'
                style={{ width: '100%', padding: 9, fontFamily: C.mono, fontSize: 11, background: 'var(--c-sf2)', color: 'var(--c-tx)', border: '1px solid var(--c-bd2)', borderRadius: 6, resize: 'vertical' }} />
            </>
          )}

          {/* Preview */}
          {parsed.errors.length > 0 && (
            <div style={{ padding: 9, background: 'rgba(255,59,48,.08)', border: '1px solid rgba(255,59,48,.35)', borderRadius: 7, fontSize: 11, color: C.cr }}>
              <strong>{parsed.errors.length} Problem(e):</strong>
              <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                {parsed.errors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}
                {parsed.errors.length > 8 && <li>… und {parsed.errors.length - 8} weitere</li>}
              </ul>
            </div>
          )}
          {parsed.goals.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-br)' }}>
                  Vorschau: {finalGoals.length} Lernziel{finalGoals.length === 1 ? '' : 'e'}
                </span>
                {skippedCount > 0 && (
                  <span style={{ fontSize: 11, color: C.yw }}>
                    · {skippedCount} Duplikat{skippedCount === 1 ? '' : 'e'} übersprungen
                  </span>
                )}
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.mu, marginBottom: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={dedup} onChange={e => setDedup(e.target.checked)} />
                Duplikate (gleicher Titel + LJ + Q) automatisch überspringen
              </label>
              <div style={{ maxHeight: 200, overflowY: 'auto', background: 'var(--c-sf2)', border: '1px solid var(--c-bd)', borderRadius: 7 }}>
                {finalGoals.map(g => (
                  <div key={g.id} style={{ padding: '6px 10px', borderBottom: '1px solid var(--c-bd)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: C.mono, color: C.mu, fontSize: 10, flexShrink: 0, width: 64 }}>LJ {g.year} · Q{g.quarter}</span>
                    <span style={{ fontWeight: 600, color: 'var(--c-br)', flex: 1 }}>{g.title}</span>
                    <span style={{ fontSize: 10, color: C.mu, flexShrink: 0 }}>{g.category}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--c-bd)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} className="btn" style={{ padding: '7px 14px', fontSize: 12 }}>Abbrechen</button>
          <button onClick={doImport} className="abtn" disabled={!finalGoals.length}
            style={{ padding: '7px 14px', fontSize: 12, opacity: finalGoals.length ? 1 : .4, cursor: finalGoals.length ? 'pointer' : 'not-allowed' }}>
            ✓ {finalGoals.length} Lernziel{finalGoals.length === 1 ? '' : 'e'} importieren
          </button>
        </div>
      </div>
    </div>
  );
}
