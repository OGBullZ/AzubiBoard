// Zelebrations-Partikel (Anhang C: Trainingsplan-Bestätigung) — 12 CSS-Partikel,
// deterministisch (kein Math.random), DOM-Cleanup nach 900ms.
// No-Op außerhalb Design Beta und bei prefers-reduced-motion.
export function celebrate(x: number, y: number): void {
  if (typeof document === 'undefined') return;
  if (document.documentElement.getAttribute('data-design') !== 'beta') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const host = document.createElement('div');
  host.className = 'celebrate-burst';
  host.setAttribute('aria-hidden', 'true');
  const colors = ['var(--c-ac)', 'var(--c-data, #3FD2C7)', 'var(--c-gr)'];
  for (let i = 0; i < 12; i++) {
    const p = document.createElement('i');
    const a = (i / 12) * Math.PI * 2;
    const r = 42 + (i % 3) * 16;
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.setProperty('--dx', `${Math.round(Math.cos(a) * r)}px`);
    p.style.setProperty('--dy', `${Math.round(Math.sin(a) * r - 28)}px`);
    p.style.setProperty('--rr', `${(i % 2 ? 1 : -1) * 200}deg`);
    p.style.background = colors[i % 3];
    host.appendChild(p);
  }
  document.body.appendChild(host);
  setTimeout(() => host.remove(), 900);
}
