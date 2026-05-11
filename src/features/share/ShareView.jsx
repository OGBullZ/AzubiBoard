// ============================================================
//  ShareView – öffentliche Read-Only-Ansicht (J10)
//  URL-Format: #/share/{token}  → kein Auth nötig.
// ============================================================
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { C, fmtDate, getISOWeek } from '../../lib/utils.js';
import { dataService } from '../../lib/dataService.js';

export default function ShareView() {
  const { token } = useParams();
  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await dataService.fetchShareLink(token);
        if (!cancelled) setState({ loading: false, data: result, error: null });
      } catch (e) {
        if (!cancelled) setState({ loading: false, data: null, error: e.message || 'Fehler' });
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  if (state.loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--c-bg)' }}>
        <div style={{ fontSize: 13, color: C.mu }}>Lädt …</div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--c-bg)' }}>
        <div style={{ maxWidth: 480, textAlign: 'center', padding: 30, background: 'var(--c-sf)', borderRadius: 12, border: '1px solid var(--c-bd2)' }}>
          <div style={{ fontSize: 30, marginBottom: 12 }}>🔒</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--c-br)', marginBottom: 6 }}>Link nicht verfügbar</div>
          <div style={{ fontSize: 12, color: C.mu }}>{state.error}</div>
        </div>
      </div>
    );
  }

  const { kind, title, data, created_at, expires_at } = state.data;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--c-bg)', padding: '24px 16px' }}>
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        {/* Banner */}
        <div style={{
          padding: '12px 16px', marginBottom: 18,
          background: 'rgba(0,113,227,.08)', border: '1px solid rgba(0,113,227,.35)',
          borderRadius: 9, fontSize: 12, color: 'var(--c-tx)',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <span aria-hidden="true">🔗</span>
          <span style={{ flex: 1 }}>
            <strong>Öffentlicher Read-Only-Link.</strong> {title && <span>· {title}</span>}
            {expires_at && <span style={{ color: C.mu }}> · gültig bis {new Date(expires_at).toLocaleDateString('de-DE')}</span>}
          </span>
        </div>

        {kind === 'jahresmappe' && <JahresmappeView data={data} title={title} />}
        {kind === 'bericht'     && <BerichtView data={data} title={title} />}
        {!['jahresmappe', 'bericht'].includes(kind) && (
          <pre style={{ background: 'var(--c-sf2)', padding: 14, borderRadius: 8, fontSize: 11, color: C.mu, overflow: 'auto' }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        )}

        <div style={{ marginTop: 24, padding: 12, textAlign: 'center', fontSize: 10, color: C.mu, fontStyle: 'italic' }}>
          Erstellt mit AzubiBoard · {fmtDate(created_at?.slice(0, 10))}
        </div>
      </div>
    </div>
  );
}

function JahresmappeView({ data, title }) {
  const reports = Array.isArray(data?.reports) ? data.reports : [];
  return (
    <div>
      <h1 style={{ fontSize: 22, color: 'var(--c-br)', marginBottom: 6 }}>{title || 'Jahresmappe'}</h1>
      <div style={{ fontSize: 12, color: C.mu, marginBottom: 16 }}>{reports.length} Berichtsheft{reports.length === 1 ? '' : 'e'}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {reports.map(r => <ReportCard key={r.id} r={r} />)}
        {reports.length === 0 && <div style={{ color: C.mu, fontStyle: 'italic' }}>Keine Berichte vorhanden.</div>}
      </div>
    </div>
  );
}

function BerichtView({ data, title }) {
  return (
    <div>
      <h1 style={{ fontSize: 22, color: 'var(--c-br)', marginBottom: 16 }}>{title || 'Berichtsheft'}</h1>
      <ReportCard r={data} />
    </div>
  );
}

function ReportCard({ r }) {
  if (!r) return null;
  const iso = getISOWeek(r.week_start);
  const kw  = r.week_number ?? iso.week ?? '–';
  const yr  = r.year ?? iso.year ?? '–';
  return (
    <div className="card" style={{ padding: 18, background: 'var(--c-sf)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, gap: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--c-br)' }}>KW {kw} · {yr}</div>
          <div style={{ fontSize: 11, color: C.mu, marginTop: 3 }}>
            {fmtDate(r.week_start)}
            {r.user_name && <> · {r.user_name}</>}
          </div>
        </div>
        {r.status && (
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'var(--c-sf2)', color: C.mu, fontWeight: 700 }}>
            {r.status}
          </span>
        )}
      </div>
      {r.title && <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-tx)', marginBottom: 10 }}>{r.title}</div>}
      {r.activities && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.mu, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>Tätigkeiten</div>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, fontFamily: 'inherit', color: 'var(--c-tx)', marginBottom: 12 }}>{r.activities}</pre>
        </>
      )}
      {r.learnings && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.mu, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>Lerninhalt</div>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, fontFamily: 'inherit', color: 'var(--c-tx)', marginBottom: 12 }}>{r.learnings}</pre>
        </>
      )}
      {r.reviewer_comment && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.mu, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>Ausbilder-Kommentar</div>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, fontFamily: 'inherit', color: 'var(--c-tx)' }}>{r.reviewer_comment}</pre>
        </>
      )}
    </div>
  );
}
