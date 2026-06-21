import { Toast } from 'netzplan';

export const Saved = () => <Toast payload="Projekt gespeichert" />;

export const WithUndo = () => (
  <Toast payload={{ msg: 'Aufgabe gelöscht', undo: () => {} }} />
);
