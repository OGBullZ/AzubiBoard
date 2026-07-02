import { useCallback } from 'react';
import { today } from '../lib/utils';
import { recordBackup } from '../lib/backup.js';
import { ensureTrash, autoCleanTrash } from '../lib/trash.js';
import { migrateData } from '../lib/migrations.js';
import type { ShowToast } from '../lib/hooks';
import type { AppState } from '../types';

// ── Daten-Export (JSON-Backup) + Import (durch die Bootstrap-Pipeline) ──
export function useBackupExport(data: AppState | null, setData: (d: any) => void, showToast: ShowToast) {
  // Daten-Export
  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `azubiboard_backup_${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    recordBackup();                 // I8: Reminder-Tracker auffrischen
    showToast('✓ Daten exportiert');
  }, [data, showToast]);

  // Daten-Import
  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target?.result as string);
        if (!imported.users || !Array.isArray(imported.projects)) throw new Error('Ungültiges Format');
        // Import durch dieselbe Pipeline wie der Bootstrap schicken, sonst landet
        // ein älteres/fremdes Backup unmigriert im State (Bug-Hunt 3 #6).
        setData(autoCleanTrash(ensureTrash(migrateData(imported) as any)));
        showToast('✓ Daten importiert');
      } catch { showToast('⚠ Datei konnte nicht importiert werden'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [setData, showToast]);

  return { handleExport, handleImport };
}
