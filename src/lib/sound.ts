// Werkstatt-Sounds (D6, opt-in — Default AUS). Kein Sample-Download:
// der Stempel-Klack wird mit WebAudio synthetisiert (<1 KB Code, lazy AudioContext).
// Gate: Design Beta + localStorage azubiboard_sound === 'on'.
let ctx: AudioContext | null = null;

function enabled(): boolean {
  try {
    return document.documentElement.getAttribute('data-design') === 'beta'
      && localStorage.getItem('azubiboard_sound') === 'on';
  } catch { return false; }
}

export function playStamp(): void {
  if (!enabled()) return;
  try {
    ctx = ctx || new AudioContext();
    const t = ctx.currentTime;
    // Tiefer, kurzer „Klack": Sinus-Drop + Rausch-Transient
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(190, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.09);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.15);
  } catch { /* Audio blockiert (Autoplay-Policy) → still bleiben */ }
}
