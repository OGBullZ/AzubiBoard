import { Field } from 'netzplan';

export const TextInput = () => (
  <div style={{ width: 320 }}>
    <Field label="E-Mail" hint="Wird nie geteilt">
      <input defaultValue="anna@azubi.de" />
    </Field>
  </div>
);

export const Select = () => (
  <div style={{ width: 320 }}>
    <Field label="Rolle">
      <select defaultValue="azubi">
        <option value="azubi">Azubi</option>
        <option value="ausbilder">Ausbilder</option>
        <option value="mentor">Mentor</option>
      </select>
    </Field>
  </div>
);

export const Textarea = () => (
  <div style={{ width: 320 }}>
    <Field label="Wochenbericht" hint="Max. 500 Zeichen">
      <textarea defaultValue={'KW 25 — Netzplan-Modul abgeschlossen,\nReview offen.'} />
    </Field>
  </div>
);
