import { Divider } from 'netzplan';

export const Default = () => (
  <div style={{ width: 280, color: 'var(--c-tx)', fontSize: 13 }}>
    <div>Projektdetails</div>
    <Divider />
    <div>Aufgabenliste</div>
  </div>
);

export const Spacing = () => (
  <div style={{ width: 280, color: 'var(--c-tx)', fontSize: 13 }}>
    <div>Eng</div>
    <Divider my={4} />
    <div>Weit</div>
    <Divider my={20} />
    <div>Ende</div>
  </div>
);
