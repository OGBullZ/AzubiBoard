// ============================================================
//  sentry.ts — Error-Tracking-Init (L3)  (T1 Sprint 14: js → ts migriert)
//
//  Aktiv nur wenn VITE_SENTRY_DSN gesetzt ist. Ohne DSN ist
//  alles ein No-Op — kein Crash bei Dev-Builds ohne Sentry.
//
//  Privacy-Defaults: replaysOnError nur teilweise (10%),
//  tracesSampleRate 0.1 in Production, 1.0 in Dev. PII wird
//  per default NICHT gesendet (sendDefaultPii=false).
// ============================================================
import * as Sentry from '@sentry/react';
import type { Breadcrumb, ErrorEvent } from '@sentry/react';

const DSN  = import.meta.env.VITE_SENTRY_DSN;
const ENV  = import.meta.env.MODE;       // 'development' | 'production'
const REL  = import.meta.env.VITE_APP_VERSION || 'dev';

let initialized = false;

export function initSentry(): void {
  if (initialized || !DSN) return;
  Sentry.init({
    dsn:         DSN,
    environment: ENV,
    release:     REL,

    // Performance / Sampling
    tracesSampleRate:        ENV === 'production' ? 0.1 : 1.0,
    replaysSessionSampleRate: 0,        // keine Session-Replays per default
    replaysOnErrorSampleRate: 0.1,      // 10 % der Crashes mit Replay

    // Datenschutz
    sendDefaultPii: false,
    // Anhängliche User-Daten begrenzen: nur id, nichts darüber hinaus
    beforeSend(event: ErrorEvent): ErrorEvent {
      if (event.user) {
        event.user = { id: event.user.id };
      }
      // Sehr lange Strings (z.B. ganze data-Blobs) abschneiden
      if (event.extra) {
        for (const k of Object.keys(event.extra)) {
          const v = event.extra[k];
          if (typeof v === 'string' && v.length > 2000) {
            event.extra[k] = v.slice(0, 2000) + ' …[gekürzt]';
          }
        }
      }
      return event;
    },

    // localStorage-Fehler oft Browser-Quoten — kein Wert für uns
    ignoreErrors: [
      /QuotaExceededError/i,
      /ResizeObserver loop/i,
    ],
  });
  initialized = true;
}

export function setSentryUser(user?: { id?: string | number; role?: unknown } | null): void {
  if (!initialized) return;
  if (user?.id) Sentry.setUser({ id: String(user.id), role: user.role });
  else          Sentry.setUser(null);
}

export function captureException(err: unknown, ctx?: Record<string, unknown>): void {
  if (!initialized) { console.error(err, ctx); return; }
  Sentry.captureException(err, ctx ? { extra: ctx } : undefined);
}

export function addBreadcrumb(crumb: Breadcrumb): void {
  if (!initialized) return;
  Sentry.addBreadcrumb(crumb);
}

export const ErrorBoundary = Sentry.ErrorBoundary;
