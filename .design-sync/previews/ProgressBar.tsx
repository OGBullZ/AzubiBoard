import { ProgressBar } from 'netzplan';

export const Steps = () => (
  <div style={{ display: 'grid', gap: 16, width: 280 }}>
    <ProgressBar value={25} label="Sprint 25%" />
    <ProgressBar value={60} label="Sprint 60%" />
    <ProgressBar value={100} label="Sprint fertig" />
  </div>
);

export const Colored = () => (
  <div style={{ display: 'grid', gap: 16, width: 280 }}>
    <ProgressBar value={72} color="var(--c-gr)" height={6} />
    <ProgressBar value={40} color="var(--c-yw)" height={6} />
    <ProgressBar value={18} color="var(--c-cr)" height={6} />
  </div>
);
