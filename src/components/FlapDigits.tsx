// Split-Flap-/Fallblatt-Anzeige (Anhang C, Signature 3) — Kalender-KW, Flipclock.
// Ziffern klappen beim Wertwechsel kaskadiert (90ms versetzt); Ziffer wird zur
// Klapp-Halbzeit getauscht. Ohne Motion (reduced-motion) einfach statischer Tausch.
import { useEffect, useRef, useState } from 'react';

export function FlapDigits({ value, label }: { value: string; label?: string }) {
  const [shown, setShown] = useState(value);
  const [going, setGoing] = useState<boolean[]>([]);
  const prev = useRef(value);

  useEffect(() => {
    if (value === prev.current) return;
    prev.current = value;
    const n = Math.max(value.length, shown.length);
    setGoing(Array.from({ length: n }, () => true));
    const swap = setTimeout(() => setShown(value), 170);
    const done = setTimeout(() => setGoing([]), 170 + 90 * n + 360);
    return () => { clearTimeout(swap); clearTimeout(done); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span className="flap" role="text" aria-label={label ? `${label} ${value}` : value}>
      {shown.split('').map((ch, i) => (
        <span key={i} className={going[i] ? 'd go' : 'd'} aria-hidden="true"
          style={{ animationDelay: `${i * 90}ms` }}>{ch}</span>
      ))}
    </span>
  );
}

export default FlapDigits;
