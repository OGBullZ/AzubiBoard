import { StatCard } from 'netzplan';
import { IcoCheck, IcoClock, IcoTrendUp } from '../../src/components/Icons';

export const Done = () => (
  <div style={{ width: 200 }}>
    <StatCard label="Erledigt" value={42} color="var(--c-gr)" Icon={IcoCheck} sub="+5 diese Woche" />
  </div>
);

export const Open = () => (
  <div style={{ width: 200 }}>
    <StatCard label="Offen" value={13} color="var(--c-yw)" Icon={IcoClock} />
  </div>
);

export const Progress = () => (
  <div style={{ width: 200 }}>
    <StatCard label="Fortschritt" value="68%" color="var(--c-ac)" Icon={IcoTrendUp} sub="Ziel 80%" />
  </div>
);
