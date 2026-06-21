import { SectionHeader } from 'netzplan';
import { IcoFolder, IcoUsers } from '../../src/components/Icons';

export const Small = () => (
  <div style={{ width: 340 }}>
    <SectionHeader title="Projekte" count={8} Icon={IcoFolder} />
  </div>
);

export const Medium = () => (
  <div style={{ width: 340 }}>
    <SectionHeader size="md" title="Team" count={4} Icon={IcoUsers} />
  </div>
);

export const WithBadge = () => (
  <div style={{ width: 340 }}>
    <SectionHeader title="Netzplan" badge={{ text: 'BETA' }} />
  </div>
);

export const WithAction = () => (
  <div style={{ width: 340 }}>
    <SectionHeader title="Aufgaben" count={12} action="Alle anzeigen" onAction={() => {}} />
  </div>
);
