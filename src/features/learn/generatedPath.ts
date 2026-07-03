// KI-Lernpfad: mappt die API-Antwort (POST /api/ai/generate-learning-path) auf
// ein Schema-konformes LearningPath-Objekt. Pure + unit-getestet.
// Der Server liefert Nodes OHNE id und prereqs als 0-basierte Indizes früherer
// Nodes — hier werden IDs vergeben und Indizes → tatsächliche Node-IDs übersetzt.
import type { LearningPath, LearningPathNode, Id } from '../../types';

export type GeneratedNode = {
  title:        string;
  description?: string;
  type?:        'article' | 'link' | 'quiz' | 'task';
  content?:     string;
  prereqs?:     number[];
};

export type GeneratedPath = {
  title:        string;
  description?: string;
  nodes?:       GeneratedNode[];
};

// makeId als Factory (injizierbar → testbar). Am Aufrufort: uid aus lib/utils.
export function mapGeneratedPath(gen: GeneratedPath, makeId: () => Id): LearningPath {
  const nodes = gen.nodes ?? [];
  // Erst alle IDs vergeben, damit prereq-Indizes → IDs übersetzt werden können.
  const ids: Id[] = nodes.map(() => makeId());

  const mappedNodes: LearningPathNode[] = nodes.map((n, i) => ({
    id:          ids[i],
    title:       n.title,
    description: n.description ?? '',
    type:        n.type ?? 'article',
    content:     n.content ?? '',
    // Nur gültige Indizes früherer Nodes; ≥ eigene Position oder out-of-range still droppen.
    prereqs:     (n.prereqs ?? [])
      .filter(idx => Number.isInteger(idx) && idx >= 0 && idx < i)
      .map(idx => ids[idx]),
  }));

  return {
    id:          makeId(),
    title:       gen.title,
    description: gen.description ?? '',
    nodes:       mappedNodes,
  };
}
