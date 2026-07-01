import { IconBtn } from 'netzplan';
import { IcoEdit, IcoStar, IcoTrash } from '../../src/components/Icons';

export const Default = () => (
  <div style={{ display: 'flex', gap: 8 }}>
    <IconBtn Icon={IcoEdit} label="Bearbeiten" />
    <IconBtn Icon={IcoStar} label="Favorit" />
  </div>
);

export const Active = () => <IconBtn Icon={IcoStar} label="Favorit" active />;

export const Danger = () => <IconBtn Icon={IcoTrash} label="Löschen" danger />;
