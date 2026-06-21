import { StatusBadge } from 'netzplan';

export const AllStates = () => (
  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
    <StatusBadge status="green" />
    <StatusBadge status="yellow" />
    <StatusBadge status="red" />
  </div>
);
