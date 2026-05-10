// ============================================================
//  BackupReminder – nicht-aufdringliche Erinnerung
//  Zeigt einen Banner unterhalb des Headers wenn das letzte
//  Backup älter als 7 Tage ist (oder noch nie erstellt wurde).
// ============================================================
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { needsBackup, daysSinceBackup, snoozeReminder, lastBackupAt } from '../lib/backup.js';

export default function BackupReminder({ onBackup }) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  const [days, setDays] = useState(0);

  useEffect(() => {
    // Beim Mount prüfen + alle 30 min
    const tick = () => {
      const want = needsBackup(7);
      setShow(want);
      if (want) setDays(Math.floor(daysSinceBackup()));
    };
    tick();
    const id = setInterval(tick, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  if (!show) return null;

  const isFirstTime = !lastBackupAt();
  const when = days === 0 ? t('common.today')
             : days === 1 ? t('common.yesterday')
             : t('backup.daysAgo', { count: days, defaultValue: `vor ${days} Tagen erstellt worden` });
  const text = isFirstTime ? t('backup.neverDone') : t('backup.lastBackup', { when });

  return (
    <div role="status" aria-live="polite"
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 16px', margin: '0 16px 12px',
        background: 'rgba(255,149,0,.08)',
        border: '1px solid rgba(255,149,0,.35)',
        borderRadius: 9, fontSize: 12,
        color: 'var(--c-br)',
      }}>
      <span style={{ fontSize: 16, lineHeight: 1 }} aria-hidden="true">💾</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <strong>{text}</strong>{' '}{t('backup.recommend')}
      </span>
      <button
        onClick={onBackup}
        style={{
          padding: '5px 11px', fontSize: 11, fontWeight: 700,
          borderRadius: 6, border: '1px solid var(--c-yw)',
          background: 'var(--c-yw)', color: '#1a1a1a',
          cursor: 'pointer', textTransform: 'uppercase', letterSpacing: .5,
          flexShrink: 0,
        }}>
        {t('backup.doBackup')}
      </button>
      <button
        onClick={() => { snoozeReminder(24); setShow(false); }}
        aria-label={t('backup.snooze')}
        title={t('backup.snooze')}
        style={{
          padding: '5px 9px', fontSize: 14, lineHeight: 1,
          borderRadius: 6, border: '1px solid var(--c-bd2)',
          background: 'transparent', color: 'var(--c-mu)',
          cursor: 'pointer', flexShrink: 0,
        }}>
        ✕
      </button>
    </div>
  );
}
