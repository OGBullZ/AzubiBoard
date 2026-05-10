import { useMemo } from 'react';
import { C, fmtDate, getKW, fmtLocalDate } from '../../lib/utils.js';
import { Avatar, ProgressBar } from '../../components/UI.jsx';
import { IcoBack, IcoCheck, IcoClock, IcoAlert, IcoFolder, IcoReport, IcoTrendUp } from '../../components/Icons.jsx';

// ── Mini Sparkline (Wochenstunden) ────────────────────────────
function HoursChart({ weeks }) {
  if (!weeks.length) return null;
  const max   = Math.max(...weeks.map(w => w.h), 1);
  const W     = 28;
  const H     = 50;
  return (
    <svg width={weeks.length * W} height={H} style={{ overflow: 'visible' }}>
      {weeks.map((w, i) => {
        const bh = Math.max(2, (w.h / max) * (H - 14));
        return (
          <g key={i}>
            <rect x={i * W + 2} y={H - bh - 12} width={W - 6} height={bh} rx={3}
              fill={w.h > 0 ? `${C.ac}99` : `${C.bd2}`} />
            <text x={i * W + W / 2} y={H - 1} textAnchor="middle" fontSize={8} fill={C.mu}>{w.label}</text>
            {w.h > 0 && (
              <text x={i * W + W / 2} y={H - bh - 14} textAnchor="middle" fontSize={8} fill={C.ac} fontWeight={700}>{w.h.toFixed(0)}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Ring ──────────────────────────────────────────────────────
function Ring({ pct = 0, size = 56, stroke = 5, color }) {
  const r    = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(1, pct / 100)) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--c-bd2)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray .4s ease' }} />
    </svg>
  );
}

// ── Stat Box ──────────────────────────────────────────────────
function StatBox({ label, value, color, sub }) {
  return (
    <div className="card" style={{ borderLeft: `3px solid ${color}`, padding: '10px 14px' }}>
      <div style={{ fontSize: 10, color: C.mu, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color, fontFamily: C.mono }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.mu, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function AzubiProfilePage({ azubi, data, currentUser, onBack }) {
  // Hooks IMMER vor Early-Return aufrufen (Rules of Hooks).
  const projects  = useMemo(() => (data?.projects || []).filter(p => !p.archived && (p.assignees || []).includes(azubi?.id)), [data?.projects, azubi?.id]);
  const allTasks  = useMemo(() => projects.flatMap(p => (p.tasks || []).filter(t => t.assignee === azubi?.id)), [projects, azubi?.id]);

  // Last 8 weeks of hours (DST-sicher via lokalen Daten + ISO-Wochenmontag)
  const weeksData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 8 }, (_, i) => {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (7 - i) * 7);
      const mon = new Date(d); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
      const fri = new Date(mon); fri.setDate(fri.getDate() + 6);
      const ms = fmtLocalDate(mon);
      const me = fmtLocalDate(fri);
      const h  = allTasks.flatMap(t => (t.timeLog || []).filter(e => e.date >= ms && e.date <= me)).reduce((s, e) => s + (Number(e.hours) || 0), 0);
      return { label: `KW${getKW(ms)}`, h };
    });
  }, [allTasks]);

  if (!azubi) return <div className="card" style={{ margin: 24 }}>Azubi nicht gefunden.</div>;

  const reports   = (data?.reports || []).filter(r => r.user_id === azubi.id).sort((a, b) => new Date(b.week_start) - new Date(a.week_start));
  const plan      = data?.trainingPlan || { goals: [] };
  const goals     = plan.goals || [];
  const myGoals   = goals.length;
  const confirmed = goals.filter(g => g.progress?.[azubi.id]?.status === 'confirmed').length;
  const learned   = goals.filter(g => ['learned','confirmed'].includes(g.progress?.[azubi.id]?.status)).length;

  const done    = allTasks.filter(t => t.status === 'done').length;
  const open    = allTasks.filter(t => t.status !== 'done').length;
  const overdue = allTasks.filter(t => t.status !== 'done' && t.deadline && new Date(t.deadline) < new Date()).length;
  const taskPct = allTasks.length > 0 ? Math.round(done / allTasks.length * 100) : 0;

  // Total hours logged
  const totalHours = allTasks.flatMap(t => t.timeLog || []).reduce((s, e) => s + (Number(e.hours) || 0), 0);

  const hue = (azubi.name?.charCodeAt(0) || 100) * 37 % 360;

  return (
    <div style={{ padding: 20, maxWidth: 860, margin: '0 auto' }} className="anim">
      {/* Back */}
      <button onClick={onBack} className="btn" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, marginBottom: 16 }}>
        <IcoBack size={12} /> Zurück
      </button>

      {/* Hero card */}
      <div className="card" style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          {azubi.avatar_url
            ? <img src={azubi.avatar_url} alt={azubi.name} style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.1)' }} />
            : <div style={{ width: 72, height: 72, borderRadius: '50%', background: `hsl(${hue},45%,22%)`, border: '3px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, color: `hsl(${hue},65%,75%)` }}>
                {azubi.name?.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()}
              </div>}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.br }}>{azubi.name}</div>
          <div style={{ fontSize: 12, color: C.mu, marginTop: 3 }}>{azubi.email}</div>
          <div style={{ fontSize: 12, color: C.mu, marginTop: 2 }}>
            {azubi.apprenticeship_year ? `${azubi.apprenticeship_year}. Lehrjahr` : 'Azubi'}
            {azubi.profession && ` · ${azubi.profession}`}
          </div>
        </div>
        {/* Kompetenz-Ring */}
        {myGoals > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative', width: 56, height: 56 }}>
              <Ring pct={myGoals > 0 ? Math.round(confirmed / myGoals * 100) : 0} color={C.gr} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: C.gr }}>
                {myGoals > 0 ? Math.round(confirmed / myGoals * 100) : 0}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.gr, fontWeight: 700 }}>Kompetenzen</div>
              <div style={{ fontSize: 10, color: C.mu }}>{confirmed}/{myGoals} bestätigt</div>
            </div>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px,1fr))', gap: 10, marginBottom: 16 }}>
        <StatBox label="Aufgaben ges." value={allTasks.length} color={C.ac} />
        <StatBox label="Erledigt" value={done} color={C.gr} sub={`${taskPct}%`} />
        <StatBox label="Überfällig" value={overdue} color={overdue > 0 ? C.cr : C.mu} />
        <StatBox label="Stunden ges." value={totalHours.toFixed(1)} color={C.yw} sub="geloggt" />
        <StatBox label="Berichte" value={reports.length} color={C.ac} />
        <StatBox label="Projekte" value={projects.length} color={C.mu} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'flex-start' }}>
        {/* Stunden-Chart */}
        <div className="card">
          <div style={{ fontSize: 11, fontWeight: 700, color: C.mu, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 12 }}>📊 Stunden (letzte 8 KW)</div>
          {weeksData.some(w => w.h > 0) ? (
            <div style={{ overflowX: 'auto' }}>
              <HoursChart weeks={weeksData} />
            </div>
          ) : (
            <div style={{ fontSize: 12, color: C.mu, padding: '10px 0' }}>Noch keine Stunden geloggt.</div>
          )}
        </div>

        {/* Projekte */}
        <div className="card">
          <div style={{ fontSize: 11, fontWeight: 700, color: C.mu, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 10 }}>📁 Projekte</div>
          {projects.length === 0
            ? <div style={{ fontSize: 12, color: C.mu }}>Keine Projekte.</div>
            : projects.map(p => {
                const ptasks = (p.tasks || []).filter(t => t.assignee === azubi.id);
                const pdone  = ptasks.filter(t => t.status === 'done').length;
                const ppct   = ptasks.length > 0 ? Math.round(pdone / ptasks.length * 100) : 0;
                return (
                  <div key={p.id} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: C.br, marginBottom: 4 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{p.title}</span>
                      <span style={{ color: C.mu, fontFamily: C.mono, fontSize: 11 }}>{pdone}/{ptasks.length}</span>
                    </div>
                    <ProgressBar value={ppct} height={4} color={ppct === 100 ? C.gr : C.ac} />
                  </div>
                );
              })
          }
        </div>

        {/* Berichte-Historie */}
        <div className="card">
          <div style={{ fontSize: 11, fontWeight: 700, color: C.mu, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 10 }}>📝 Berichtshefte</div>
          {reports.length === 0
            ? <div style={{ fontSize: 12, color: C.mu }}>Noch keine Berichte.</div>
            : reports.slice(0, 10).map(r => {
                const ST = { draft: [C.mu,'Entwurf'], submitted: [C.ac,'Eingereicht'], reviewed: [C.yw,'Geprüft'], signed: [C.gr,'Unterschrieben'] };
                const [color, label] = ST[r.status] || ST.draft;
                return (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, padding: '5px 8px', borderRadius: 6, background: C.sf2 }}>
                    <span style={{ fontSize: 11, color: C.mu, fontFamily: C.mono, flexShrink: 0 }}>KW {r.week_number}/{r.year}</span>
                    <span style={{ flex: 1, fontSize: 12, color: C.br, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title || '–'}</span>
                    <span style={{ fontSize: 10, color, fontWeight: 700, flexShrink: 0 }}>● {label}</span>
                  </div>
                );
              })
          }
        </div>

        {/* Kompetenzen (E2) */}
        {myGoals > 0 && (
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, color: C.mu, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 10 }}>🎓 Lernziele</div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.mu, marginBottom: 4 }}>
                <span>Bestätigt</span><span style={{ color: C.gr, fontWeight: 700 }}>{confirmed}/{myGoals}</span>
              </div>
              <ProgressBar value={myGoals > 0 ? Math.round(confirmed / myGoals * 100) : 0} height={6} color={C.gr} />
              <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 10, color: C.mu }}>
                <span>◑ {learned} gelernt</span>
                <span>○ {myGoals - learned} offen</span>
              </div>
            </div>
            {/* Recent confirmed goals */}
            {goals.filter(g => g.progress?.[azubi.id]?.status === 'confirmed').slice(0,5).map(g => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: C.gr }}>✓</span>
                <span style={{ fontSize: 12, color: C.br }}>{g.title}</span>
                <span style={{ fontSize: 10, color: C.mu, marginLeft: 'auto' }}>LJ{g.year}/Q{g.quarter}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

