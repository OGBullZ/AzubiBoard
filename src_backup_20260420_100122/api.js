// ============================================================
//  AzubiBoard – Frontend API Client
//  Datei: src/api.js
//
//  Verbindet React-Frontend mit PHP-API (XAMPP).
//  Wechsel zu Node.js später: nur VITE_API_URL in .env ändern.
//
//  .env Datei im Projektordner erstellen:
//    VITE_API_URL=http://localhost/azubiboard/api
// ============================================================

const BASE = import.meta.env.VITE_API_URL || 'http://localhost/azubiboard/api';

// ── Token ────────────────────────────────────────────────────
export const getToken  = ()    => localStorage.getItem('azubi_token');
export const setToken  = (t)   => t ? localStorage.setItem('azubi_token', t) : localStorage.removeItem('azubi_token');
export const hasToken  = ()    => !!getToken();

// ── Basis-Fetch ──────────────────────────────────────────────
async function req(path, opts = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...opts.headers,
  };

  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 401) {
    setToken(null);
    window.dispatchEvent(new Event('azubi:logout'));
    throw new Error('Sitzung abgelaufen – bitte neu anmelden');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const get   = (path)        => req(path, { method: 'GET' });
const post  = (path, body)  => req(path, { method: 'POST',   body });
const put   = (path, body)  => req(path, { method: 'PUT',    body });
const patch = (path, body)  => req(path, { method: 'PATCH',  body });
const del   = (path)        => req(path, { method: 'DELETE' });

// ── File-Upload ──────────────────────────────────────────────
async function upload(path, file, extra = {}) {
  const form = new FormData();
  form.append('file', file);
  Object.entries(extra).forEach(([k, v]) => form.append(k, v));
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Upload fehlgeschlagen');
  return data;
}

// ── API ───────────────────────────────────────────────────────
export const api = {

  // ── Auth ───────────────────────────────────────────────────
  auth: {
    login:    (email, password) => post('/auth/login',    { email, password }),
    register: (data)            => post('/auth/register', data),
    logout:   ()                => { setToken(null); return Promise.resolve(); },
    me:       ()                => get('/auth/me'),
    setTheme: (theme)           => patch('/auth/theme',   { theme }),
    updateProfile: (data)       => patch('/auth/profile', data),
    changePassword: (old_password, new_password) =>
                                   patch('/auth/password', { old_password, new_password }),
  },

  // ── Projekte ───────────────────────────────────────────────
  projects: {
    list:   ()          => get('/projects'),
    get:    (id)        => get(`/projects/${id}`),
    create: (data)      => post('/projects', data),
    update: (id, data)  => put(`/projects/${id}`, data),
    patch:  (id, data)  => patch(`/projects/${id}`, data),
    delete: (id)        => del(`/projects/${id}`),
  },

  // ── Aufgaben ───────────────────────────────────────────────
  // Frontend-Felder: text, status, priority, assignee, deadline, note, doc, protocol
  // API übernimmt das Mapping zu DB-Feldern (title, assigned_to, due_date, status-ENUM)
  tasks: {
    list:   (projectId)         => get(`/tasks?project_id=${projectId}`),
    get:    (id)                => get(`/tasks/${id}`),
    create: (data)              => post('/tasks', data),
    update: (id, data)          => patch(`/tasks/${id}`, data),
    delete: (id)                => del(`/tasks/${id}`),
    // Kurzform: nur Status ändern
    setStatus: (id, status)     => patch(`/tasks/${id}`, { status }),
    // Kurzform: Aufgabe abhaken
    complete:  (id)             => patch(`/tasks/${id}`, { status: 'done' }),
    reopen:    (id)             => patch(`/tasks/${id}`, { status: 'not_started' }),
  },

  // ── Zeiterfassung ──────────────────────────────────────────
  time: {
    list:    (projectId)        => get(`/time?project_id=${projectId}`),
    running: ()                 => get('/time/running'),
    start:   (projectId, taskId, description) =>
                                   post('/time', { project_id: projectId, task_id: taskId, description }),
    stop:    (id)               => patch(`/time/${id}/stop`, {}),
    delete:  (id)               => del(`/time/${id}`),
  },

  // ── Material ───────────────────────────────────────────────
  materials: {
    list:   (projectId)         => get(`/materials?project_id=${projectId}`),
    create: (data)              => post('/materials', data),
    update: (id, data)          => patch(`/materials/${id}`, data),
    delete: (id)                => del(`/materials/${id}`),
  },

  // ── Anforderungen ──────────────────────────────────────────
  requirements: {
    list:   (projectId)         => get(`/requirements?project_id=${projectId}`),
    create: (data)              => post('/requirements', data),
    toggle: (id, done)          => patch(`/requirements/${id}`, { done: done ? 1 : 0 }),
    delete: (id)                => del(`/requirements/${id}`),
  },

  // ── Dokumentationsschritte ─────────────────────────────────
  steps: {
    list:   (projectId)         => get(`/steps?project_id=${projectId}`),
    create: (data)              => post('/steps', data),
    update: (id, data)          => patch(`/steps/${id}`, data),
    delete: (id)                => del(`/steps/${id}`),
  },

  // ── Netzplan ───────────────────────────────────────────────
  netzplan: {
    nodes:      (projectId)             => get(`/netzplan/${projectId}/nodes`),
    edges:      (projectId)             => get(`/netzplan/${projectId}/edges`),
    saveNode:   (projectId, data)       => post(`/netzplan/${projectId}/nodes`, data),
    updateNode: (projectId, nid, data)  => patch(`/netzplan/${projectId}/nodes/${nid}`, data),
    deleteNode: (projectId, nid)        => del(`/netzplan/${projectId}/nodes/${nid}`),
    saveEdge:   (projectId, data)       => post(`/netzplan/${projectId}/edges`, data),
    deleteEdge: (projectId, eid)        => del(`/netzplan/${projectId}/edges/${eid}`),
  },

  // ── Kalender ───────────────────────────────────────────────
  calendar: {
    list:        (year, month)  => get(`/calendar?year=${year}&month=${month}`),
    create:      (data)         => post('/calendar', data),
    update:      (id, data)     => patch(`/calendar/${id}`, data),
    delete:      (id)           => del(`/calendar/${id}`),
    importUntis: (creds)        => post('/untis/import', creds),
  },

  // ── Benachrichtigungen ─────────────────────────────────────
  notifications: {
    list:    ()     => get('/notifications'),
    markRead:(id)   => patch(`/notifications/${id}/read`, {}),
    markAll: ()     => patch('/notifications/read-all', {}),
    count:   ()     => get('/notifications?count=1'),
  },

  // ── Berichtshefte ──────────────────────────────────────────
  reports: {
    list:    ()             => get('/reports'),
    get:     (id)           => get(`/reports/${id}`),
    create:  (data)         => post('/reports', data),
    update:  (id, data)     => put(`/reports/${id}`, data),
    submit:  (id)           => patch(`/reports/${id}/submit`, {}),
    review:  (id, status, comment) =>
                               patch(`/reports/${id}/review`, { status, comment }),
    upload:  (id, file)     => upload(`/reports/${id}/upload`, file),
  },

  // ── Gruppen ────────────────────────────────────────────────
  groups: {
    list:         ()            => get('/groups'),
    get:          (id)          => get(`/groups/${id}`),
    create:       (data)        => post('/groups', data),
    update:       (id, data)    => put(`/groups/${id}`, data),
    delete:       (id)          => del(`/groups/${id}`),
    addMember:    (gid, uid)    => post(`/groups/${gid}/members`, { user_id: uid }),
    removeMember: (gid, uid)    => del(`/groups/${gid}/members/${uid}`),
  },

  // ── Nutzer ─────────────────────────────────────────────────
  users: {
    list:     ()            => get('/users'),
    get:      (id)          => get(`/users/${id}`),
    update:   (id, data)    => patch(`/users/${id}`, data),
    skills:   (id)          => get(`/users/${id}/skills`),
    addSkill: (id, data)    => post(`/users/${id}/skills`, data),
  },

  // ── Lernbereich ────────────────────────────────────────────
  learn: {
    categories:   ()            => get('/learn/categories'),
    // Quiz
    quizzes:      ()            => get('/learn/quizzes'),
    getQuiz:      (id)          => get(`/learn/quizzes/${id}`),
    createQuiz:   (data)        => post('/learn/quizzes', data),
    submitQuiz:   (id, answers) => post(`/learn/quizzes/${id}/attempt`, { answers }),
    myAttempts:   ()            => get('/learn/quizzes/attempts'),
    // Karteikarten
    flashSets:    ()            => get('/learn/flashcards'),
    getFlashSet:  (id)          => get(`/learn/flashcards/${id}`),
    createSet:    (data)        => post('/learn/flashcards', data),
    getDueCards:  (setId)       => get(`/learn/flashcards/${setId}/due`),
    reviewCard:   (cardId, q)   => patch(`/learn/flashcards/cards/${cardId}/review`, { quality: q }),
    // Programmieraufgaben
    challenges:   ()            => get('/learn/coding'),
    getChallenge: (id)          => get(`/learn/coding/${id}`),
    submitCode:   (id, data)    => post(`/learn/coding/${id}/submit`, data),
  },

  // ── Uploads ────────────────────────────────────────────────
  uploads: {
    upload: (file, context, contextId) =>
              upload('/uploads', file, { context, context_id: contextId }),
    delete: (id) => del(`/uploads/${id}`),
  },
};

// ── React Hook: useApi ────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';

/**
 * Einfacher Datenabruf-Hook
 * @param {Function} apiFn  - z.B. () => api.projects.list()
 * @param {Array}    deps   - Abhängigkeiten (wie useEffect)
 *
 * Verwendung:
 *   const { data, loading, error, reload } = useApi(() => api.projects.list(), []);
 */
export function useApi(apiFn, deps = []) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await apiFn());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load };
}

// ── ALTER TABLE Hinweise für neue Spalten ─────────────────────
/*
  Führe folgende SQL-Befehle in phpMyAdmin aus,
  BEVOR du die Aufgaben-API verwendest:

  ALTER TABLE tasks
    ADD COLUMN doc      TEXT NULL AFTER note,
    ADD COLUMN protocol TEXT NULL AFTER doc,
    MODIFY COLUMN status
      ENUM('open','in_progress','done','blocked','waiting')
      NOT NULL DEFAULT 'open';
*/
