import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Stamp } from '../src/components/Stamp.tsx';
import { stampRotation } from '../src/lib/stamp.ts';

describe('Stamp', () => {
  it('Rotation ist deterministisch aus der Seed (gleiche ID = gleicher Abdruck über Renders hinweg) und bleibt in -3..3°', () => {
    expect(stampRotation('report-42')).toBe(stampRotation('report-42'));
    expect(stampRotation('a')).not.toBe(stampRotation('d')); // verschiedene Seeds streuen
    for (const s of ['x', 'report-42', 12345, 'zzzz']) {
      const r = stampRotation(s);
      expect(r).toBeGreaterThanOrEqual(-3);
      expect(r).toBeLessThanOrEqual(3);
    }
    expect(stampRotation(undefined)).toBe(0); // ohne Seed: gerade
  });

  it('rendert zugänglich als role=img mit Label-Text (Status nie nur über Farbe)', () => {
    const { getByRole } = render(<Stamp label="Geprüft" color="blue" seed="r1" />);
    const el = getByRole('img', { name: 'Geprüft' });
    expect(el.textContent).toBe('Geprüft');
  });

  it('stamped=true aktiviert die Aufschlag-Animation (.stamp-in), default nicht (kein Dauer-Gewackel in Listen)', () => {
    const { getByRole, rerender } = render(<Stamp label="Unterschrieben" stamped seed="r2" />);
    expect(getByRole('img').className).toContain('stamp-in');
    rerender(<Stamp label="Unterschrieben" seed="r2" />);
    expect(getByRole('img').className).not.toContain('stamp-in');
  });
});
