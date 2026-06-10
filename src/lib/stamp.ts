// Stempel-Logik (getrennt von Stamp.tsx — react-refresh/only-export-components)

export type StampColor = 'red' | 'blue' | 'green';

// Deterministische Rotation aus der Seed — kein Math.random (stabil über Renders/Resume)
export function stampRotation(seed?: string | number): number {
  if (seed == null) return 0;
  const sum = String(seed).split('').reduce((a, ch) => a + ch.charCodeAt(0), 0);
  return (sum % 7) - 3;
}
