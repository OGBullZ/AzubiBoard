// src/features/profile/AzubiProfil.jsx
import React from 'react';
import { useAppStore } from '../../lib/store';
import { getDeadlineDaysLeft } from '../../utils';

const AzubiProfil = () => {
  const { currentUser, data } = useAppStore();

  if (!currentUser || currentUser.role !== 'azubi') {
    return <div className="card">Zugriff verweigert (Security-Guard)</div>;
  }

  const myProjects = data.projects.filter(p => 
    p.azubis?.some(a => a.id === currentUser.id)
  );

  const urgentCount = myProjects.filter(p => {
    const days = getDeadlineDaysLeft(p.deadline);
    return days >= 0 && days <= 3;
  }).length;

  return (
    <div className="card">
      <h1>Mein Profil – {currentUser.name}</h1>
      <p className="muted">Lehrjahr: {currentUser.lehrjahr || '1'} | Ausbilder: {currentUser.ausbilder}</p>
      
      <div className="stats">
        <div>Aktive Projekte: <strong>{myProjects.length}</strong></div>
        <div>Dringende Deadlines: <strong style={{ color: 'var(--cr)' }}>{urgentCount}</strong></div>
      </div>
    </div>
  );
};

export default AzubiProfil;