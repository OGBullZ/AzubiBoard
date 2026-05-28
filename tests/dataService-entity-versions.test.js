// tests/dataService-entity-versions.test.js
// L5-5b (Sprint 12 P2-3): parseEntityVersions ist der forward-compat-Parser
// für per-Entität-Versionen. Solange der Server den X-Entity-Versions-Header
// nicht sendet, muss er {} liefern (= kein Verhalten geändert).
import { describe, it, expect } from 'vitest';
import { parseEntityVersions } from '../src/lib/dataService.js';

describe('parseEntityVersions (L5-5b forward-compat)', () => {
  it('liefert {} für fehlenden/leeren/Nicht-String-Header', () => {
    expect(parseEntityVersions(null)).toEqual({});
    expect(parseEntityVersions(undefined)).toEqual({});
    expect(parseEntityVersions('')).toEqual({});
    expect(parseEntityVersions(42)).toEqual({});
    expect(parseEntityVersions({})).toEqual({});
  });

  it('liefert {} für ungültiges JSON', () => {
    expect(parseEntityVersions('not-json')).toEqual({});
    expect(parseEntityVersions('{broken')).toEqual({});
  });

  it('liefert {} für JSON-Arrays oder Skalare', () => {
    expect(parseEntityVersions('[1,2,3]')).toEqual({});
    expect(parseEntityVersions('123')).toEqual({});
    expect(parseEntityVersions('"x"')).toEqual({});
    expect(parseEntityVersions('null')).toEqual({});
  });

  it('parst eine Versions-Map und behält nur positive, endliche Zahlen', () => {
    const out = parseEntityVersions('{"projects":1714,"reports":1700}');
    expect(out).toEqual({ projects: 1714, reports: 1700 });
  });

  it('coerced numerische Strings und droppt Müll-Werte', () => {
    const out = parseEntityVersions(
      '{"projects":"1714","reports":0,"tasks":-5,"x":"abc","y":null,"z":1}'
    );
    // nur positive endliche Zahlen bleiben übrig
    expect(out).toEqual({ projects: 1714, z: 1 });
  });
});
