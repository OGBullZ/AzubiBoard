import { ThemeToggle } from 'netzplan';

export const DarkMode = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--c-tx)', fontSize: 12 }}>
    <span>Dark</span>
    <ThemeToggle theme="dark" onToggle={() => {}} />
  </div>
);

export const LightMode = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--c-tx)', fontSize: 12 }}>
    <span>Light</span>
    <ThemeToggle theme="light" onToggle={() => {}} />
  </div>
);
