import React from 'react';

const AnnouncementBanner = React.memo(function AnnouncementBanner({ banner }) {
  if ((!banner.visible && banner.animating !== 'out') || !banner.text) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      color: 'white',
      padding: '20px 40px',
      textAlign: 'center',
      fontSize: 'clamp(1.5rem, 4vw, 3rem)',
      fontWeight: '400',
      zIndex: 1000,
      animation: banner.animating === 'out'
        ? 'slideDown 0.5s ease-in forwards'
        : banner.animating === 'in'
          ? 'slideUp 0.5s ease-out'
          : 'none',
      backdropFilter: 'blur(10px)',
      borderTop: '1px solid rgba(255, 255, 255, 0.2)'
    }}>
      {banner.text}
    </div>
  );
});

export default AnnouncementBanner;
