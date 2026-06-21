import { Avatar } from 'netzplan';

export const Initials = () => (
  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
    <Avatar name="Torben Bull" />
    <Avatar name="Anna Schmidt" />
    <Avatar name="Max Müller" />
  </div>
);

export const Sizes = () => (
  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
    <Avatar name="Anna Schmidt" size={28} />
    <Avatar name="Anna Schmidt" size={40} />
    <Avatar name="Anna Schmidt" size={56} />
  </div>
);
