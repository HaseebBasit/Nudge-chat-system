import React, { useEffect } from 'react';

export const ImageViewerModal = ({ imageUrl, fileName, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!imageUrl) return null;

  return (
    <div className="image-viewer-modal" onClick={onClose}>
      <button className="image-viewer-close" onClick={onClose} title="Close viewer">
        ✕
      </button>

      <img
        src={imageUrl}
        alt={fileName || 'Expanded view'}
        className="image-viewer-img"
        onClick={(e) => e.stopPropagation()}
      />

      <div
        style={{
          marginTop: '16px',
          display: 'flex',
          gap: '12px',
          alignItems: 'center'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <a
          href={imageUrl}
          download={fileName || 'image.jpg'}
          className="btn-primary"
          style={{ textDecoration: 'none', fontSize: '13px', padding: '8px 16px' }}
        >
          ⬇ Download Image
        </a>
      </div>
    </div>
  );
};
