import { describe, it, expect } from 'vitest';
import { mapGeneratedPath } from '../src/features/learn/generatedPath.ts';

// Injizierte, deterministische Factory: n1, n2, … — macht IDs prüf- und vergleichbar.
const makeCounter = () => {
  let i = 0;
  return () => `n${++i}`;
};

const gen = (nodes) => ({ title: 'Java Grundlagen', description: 'Beschr.', nodes });

describe('mapGeneratedPath — API-Antwort → Schema-LearningPath', () => {
  // Warum: prereqs kommen als 0-basierte Indizes; das Schema erwartet echte Node-IDs.
  // Falsche Übersetzung → Voraussetzungs-Kanten zeigen ins Leere, Pfad-Gating bricht.
  it('übersetzt prereq-Indizes in tatsächliche Node-IDs', () => {
    const path = mapGeneratedPath(gen([
      { title: 'A', prereqs: [] },
      { title: 'B', prereqs: [0] },
      { title: 'C', prereqs: [0, 1] },
    ]), makeCounter());

    expect(path.nodes.map(n => n.id)).toEqual(['n1', 'n2', 'n3']);
    expect(path.nodes[1].prereqs).toEqual(['n1']);
    expect(path.nodes[2].prereqs).toEqual(['n1', 'n2']);
    expect(path.id).toBe('n4');   // Pfad-id nach den Node-IDs vergeben
  });

  // Warum: ein Index auf sich selbst/spätere Nodes oder out-of-range ist ein Zyklus bzw.
  // Datenmüll — würde als tote Kante gespeichert. Muss still gedroppt werden.
  it('droppt ungültige prereqs (≥ eigene Position, out-of-range, negativ)', () => {
    const path = mapGeneratedPath(gen([
      { title: 'A', prereqs: [1] },        // zeigt auf späteren Node → weg
      { title: 'B', prereqs: [0, 2, -1, 99] }, // 0 gültig, Rest ungültig
    ]), makeCounter());

    expect(path.nodes[0].prereqs).toEqual([]);
    expect(path.nodes[1].prereqs).toEqual(['n1']);
  });

  // Warum: leere Pfade sind ein legitimes API-Ergebnis; darf nicht werfen.
  it('kommt mit leeren/fehlenden nodes zurecht', () => {
    expect(mapGeneratedPath({ title: 'Leer' }, makeCounter()).nodes).toEqual([]);
    const p = mapGeneratedPath(gen([]), makeCounter());
    expect(p.nodes).toEqual([]);
    expect(p.id).toBe('n1');   // trotzdem eine Pfad-id
  });

  // Warum: doppelte IDs würden Fortschritt/Voraussetzungen zwischen Nodes vermischen.
  it('vergibt eindeutige IDs über die injizierte Factory', () => {
    const path = mapGeneratedPath(gen([
      { title: 'A' }, { title: 'B' }, { title: 'C' },
    ]), makeCounter());
    const ids = [...path.nodes.map(n => n.id), path.id];
    expect(new Set(ids).size).toBe(ids.length);
  });
});
