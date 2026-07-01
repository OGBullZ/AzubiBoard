import { Modal, Field } from 'netzplan';

export const Default = () => (
  <Modal title="Projekt umbenennen" onClose={() => {}} width={420}>
    <Field label="Projektname">
      <input defaultValue="Netzplan Sprint 14" />
    </Field>
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
      <button className="btn">Abbrechen</button>
      <button className="abtn">Speichern</button>
    </div>
  </Modal>
);
