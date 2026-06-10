import { describe, it, expect } from 'vitest';
import { buildNewsCards } from '../src/features/onboarding/welcomeNewsData.ts';

// Datum N Tage von heute als ISO (YYYY-MM-DD) — LOKAL wie der Produktionscode
// (toISOString wäre UTC und kippt in TZ östlich von UTC kurz nach Mitternacht).
const isoDay = (n) => {
  const d = new Date(Date.now() + n * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const has = (cards, key) => cards.find((c) => c.key === key);

const azubi = { id: 1, name: 'Tobias Krause', role: 'azubi' };
const ausbilder = { id: 9, name: 'Frau Berg', role: 'ausbilder' };
const mentor = { id: 8, name: 'Herr Mai', role: 'mentor' };

// Projekt mit einer Aufgabe für einen Azubi
const projWithTask = (taskOverrides, projOverrides = {}) => ({
  id: 100, title: 'Doku-Projekt', archived: false, assignees: [], status: 'green',
  tasks: [{ id: 'T1', text: 'API dokumentieren', assignee: 1, status: 'open', ...taskOverrides }],
  ...projOverrides,
});

describe('buildNewsCards — Azubi', () => {
  it('überfällige Aufgabe → critical "overdue"-Karte (verhindert dass eine verpasste Deadline unsichtbar bleibt)', () => {
    const data = { projects: [projWithTask({ deadline: isoDay(-4) })], reports: [], users: [azubi] };
    const cards = buildNewsCards(data, azubi, null, 0);
    const c = has(cards, 'overdue');
    expect(c).toBeTruthy();
    expect(c.sev).toBe(0);
    expect(c.title).toMatch(/API dokumentieren|überfällig/);
  });

  it('fehlendes Berichtsheft dieser Woche → warning "report-open"; mit Bericht dieser Woche → keine Karte', () => {
    const base = { projects: [], users: [azubi] };
    const missing = buildNewsCards({ ...base, reports: [] }, azubi, null, 0);
    expect(has(missing, 'report-open')).toBeTruthy();

    const withReport = buildNewsCards({ ...base, reports: [{ id: 'R1', user_id: 1, status: 'draft', week_start: isoDay(0) }] }, azubi, null, 0);
    expect(has(withReport, 'report-open')).toBeFalsy();
  });

  it('Prüfungs-Countdown nur im 0–60-Tage-Fenster', () => {
    const within = buildNewsCards({ projects: [], reports: [{ id: 'R', user_id: 1, week_start: isoDay(0) }], users: [azubi], trainingPlan: { goals: [], examDate: isoDay(30) } }, azubi, null, 0);
    expect(has(within, 'exam')).toBeTruthy();
    const farOut = buildNewsCards({ projects: [], reports: [{ id: 'R', user_id: 1, week_start: isoDay(0) }], users: [azubi], trainingPlan: { goals: [], examDate: isoDay(90) } }, azubi, null, 0);
    expect(has(farOut, 'exam')).toBeFalsy();
  });

  it('Lernziel-Delta nur wenn confirmedCount über zuletzt gesehener Anzahl liegt (kein Dauer-Pop)', () => {
    const data = { projects: [], reports: [{ id: 'R', user_id: 1, week_start: isoDay(0) }], users: [azubi] };
    expect(has(buildNewsCards(data, azubi, 1, 3), 'goals-confirmed')?.title).toMatch(/2 Lernziele bestätigt/);
    expect(has(buildNewsCards(data, azubi, null, 3), 'goals-confirmed')).toBeFalsy(); // erstes Mal → kein Delta
    expect(has(buildNewsCards(data, azubi, 3, 3), 'goals-confirmed')).toBeFalsy();     // nichts Neues
  });
});

describe('buildNewsCards — Staff', () => {
  const azubiUser = { id: 1, name: 'Tobias Krause', role: 'azubi' };

  it('Azubi mit >2 überfälligen Aufgaben → critical "critical-azubis" (Schwelle wie Dashboard-Ampel)', () => {
    const tasks = [-1, -2, -3].map((d, i) => ({ id: 'T' + i, assignee: 1, status: 'open', deadline: isoDay(d) }));
    const data = { projects: [{ id: 1, title: 'P', archived: false, assignees: [1], tasks }], reports: [], users: [ausbilder, azubiUser] };
    expect(has(buildNewsCards(data, ausbilder, null, 0), 'critical-azubis')).toBeTruthy();

    const twoOverdue = { projects: [{ id: 1, title: 'P', archived: false, assignees: [1], tasks: tasks.slice(0, 2) }], reports: [], users: [ausbilder, azubiUser] };
    expect(has(buildNewsCards(twoOverdue, ausbilder, null, 0), 'critical-azubis')).toBeFalsy();
  });

  it('eingereichte Berichte → "review", rote Projekte → "projects-red"', () => {
    const data = {
      projects: [{ id: 5, title: 'Brennt', archived: false, status: 'red', assignees: [], tasks: [] }],
      reports: [{ id: 'R1', status: 'submitted', user_name: 'Tobias', week_number: 23, week_start: isoDay(-1) }],
      users: [ausbilder, azubiUser],
    };
    const cards = buildNewsCards(data, ausbilder, null, 0);
    expect(has(cards, 'review')).toBeTruthy();
    expect(has(cards, 'projects-red')).toBeTruthy();
    expect(has(cards, 'projects-red').to).toBe('/project/5');
  });

  it('Termine in den nächsten 7 Tagen → info "upcoming-events"; untis/holiday und Vergangenes zählen nicht', () => {
    const data = {
      projects: [{ id: 1, title: 'P', archived: false, assignees: [], tasks: [], calendarEvents: [{ id: 'E3', date: isoDay(2), title: 'Projekt-Review' }] }],
      reports: [],
      users: [ausbilder, azubiUser],
      calendarEvents: [
        { id: 'E1', date: isoDay(3), title: 'IHK-Infotag', type: 'event' },
        { id: 'E2', date: isoDay(1), title: 'Berufsschule', type: 'untis' },   // Rauschen → raus
        { id: 'E4', date: isoDay(-2), title: 'Vorbei', type: 'event' },        // Vergangenheit → raus
        { id: 'E5', date: isoDay(20), title: 'Zu weit weg', type: 'event' },   // außerhalb 7 Tage → raus
      ],
    };
    const c = has(buildNewsCards(data, ausbilder, null, 0), 'upcoming-events');
    expect(c).toBeTruthy();
    expect(c.title).toMatch(/2 Termine/);                  // IHK-Infotag + Projekt-Review (eingebettet)
    expect(c.sub).toMatch(/Projekt-Review/);               // chronologisch erster zuerst
    // Azubi bekommt die Karte ebenfalls
    const azubiData = { ...data, reports: [{ id: 'R', user_id: 1, week_start: isoDay(0) }] };
    expect(has(buildNewsCards(azubiData, azubiUser, null, 0), 'upcoming-events')).toBeTruthy();
  });

  it('Mentor bekommt KEINE "Lernziele bestätigen"-Karte (kann nicht bestätigen)', () => {
    const data = {
      projects: [], reports: [], users: [mentor, azubiUser],
      trainingPlan: { goals: [{ id: 'G1', title: 'X', progress: { 1: { status: 'learned' } } }], examDate: null },
    };
    expect(has(buildNewsCards(data, mentor, null, 0), 'goals-learned')).toBeFalsy();
    // Ausbilder hingegen schon
    expect(has(buildNewsCards(data, ausbilder, null, 0), 'goals-learned')).toBeTruthy();
  });
});
