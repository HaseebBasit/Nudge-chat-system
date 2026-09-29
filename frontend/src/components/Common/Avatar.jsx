import React from 'react';
import { getMediaUrl } from '../../services/mediaService.js';

const COLORS = [
  ['#6366f1', '#4f46e5'],
  ['#ec4899', '#db2777'],
  ['#8b5cf6', '#7c3aed'],
  ['#10b981', '#059669'],
  ['#f59e0b', '#d97706'],
  ['#06b6d4', '#0891b2'],
  ['#3b82f6', '#2563eb']
];

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const getGradient = (name) => {
  if (!name) return COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLORS.length;
  return COLORS[index];
};

export const Avatar = ({ name, mediaId, size = 42, isOnline = false, showStatus = true }) => {
  const [gradientStart, gradientEnd] = getGradient(name);
  const initials = getInitials(name);
  const imageUrl = mediaId ? getMediaUrl(mediaId) : null;

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        minWidth: size,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name || 'Avatar'}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            objectFit: 'cover'
          }}
          onError={(e) => {
            // Fallback to initials if image load fails
            e.target.style.display = 'none';
          }}
        />
      ) : null}

      {/* Fallback Initials Block */}
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${gradientStart} 0%, ${gradientEnd} 100%)`,
          color: '#ffffff',
          fontWeight: 700,
          fontSize: Math.round(size * 0.4),
          display: imageUrl ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          userSelect: 'none'
        }}
      >
        {initials}
      </div>

      {showStatus && (
        <span
          className={isOnline ? 'online-dot' : 'offline-dot'}
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: Math.max(9, Math.round(size * 0.26)),
            height: Math.max(9, Math.round(size * 0.26))
          }}
        />
      )}
    </div>
  );
};
