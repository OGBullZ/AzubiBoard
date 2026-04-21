// src/features/ui/NavBadge.jsx
import React from 'react';

export const NavBadge = ({ count, tooltip }) => {
  if (!count || count < 1) return null;

  return (
    <div 
      className="nav-badge" 
      title={tooltip || `${count} dringende Deadline(s)`}
    >
      {count > 9 ? '9+' : count}
    </div>
  );
};