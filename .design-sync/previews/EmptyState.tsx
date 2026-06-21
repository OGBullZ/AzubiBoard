import { EmptyState } from 'netzplan';
import { IcoFolder } from '../../src/components/Icons';

export const WithIcon = () => (
  <div style={{ width: 360 }}>
    <EmptyState
      Icon={IcoFolder}
      title="Keine Projekte"
      subtitle="Lege dein erstes Projekt an, um loszulegen."
      action="Projekt erstellen"
      onAction={() => {}}
    />
  </div>
);

export const WithDoodle = () => (
  <div style={{ width: 360 }}>
    <EmptyState doodle="kiste" title="Alles erledigt" subtitle="Keine offenen Aufgaben." />
  </div>
);
