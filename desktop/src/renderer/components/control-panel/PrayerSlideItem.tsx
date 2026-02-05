import React, { memo } from 'react';

interface Subtitle {
  subtitle?: string;
  description?: string;
  bibleRef?: {
    hebrewReference?: string;
    reference?: string;
  };
}

interface PrayerSlideItemProps {
  subtitle: Subtitle;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}

const PrayerSlideItem = memo<PrayerSlideItemProps>(({
  subtitle,
  index,
  isSelected,
  onSelect
}) => {
  return (
    <div
      onClick={(e) => {
        onSelect();
        // Blur so arrow keys work globally after clicking
        (e.currentTarget as HTMLElement).blur();
      }}
      style={{
        position: 'relative',
        border: isSelected ? '2px solid #00d4ff' : '2px solid rgba(255,255,255,0.1)',
        borderRadius: '6px',
        padding: '8px 10px',
        paddingLeft: '14px',
        cursor: 'pointer',
        backgroundColor: isSelected ? 'rgba(0, 212, 255, 0.2)' : 'rgba(0,0,0,0.3)',
        boxShadow: isSelected ? '0 0 12px rgba(0, 212, 255, 0.6)' : 'none'
      }}
    >
      {/* Left accent bar for selected slide */}
      {isSelected && (
        <div style={{
          position: 'absolute',
          left: '0',
          top: '0',
          bottom: '0',
          width: '4px',
          background: 'linear-gradient(180deg, #00d4ff 0%, #0099ff 100%)',
          borderRadius: '6px 0 0 6px'
        }} />
      )}
      {/* Slide header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        color: isSelected ? '#00d4ff' : 'rgba(255,255,255,0.7)',
        fontWeight: 'bold',
        marginBottom: '4px',
        fontSize: '0.75rem'
      }}>
        {isSelected && <span style={{ fontSize: '0.7rem' }}>▶</span>}
        <span>Point {index + 1}</span>
      </div>
      {/* Slide content - show text lines like songs */}
      <div style={{ fontSize: '0.85rem', lineHeight: '1.3', color: 'white' }}>
        {/* Original/Hebrew text */}
        {subtitle.subtitle && (
          <div style={{ textAlign: 'right', direction: 'rtl' }}>
            {subtitle.subtitle}
          </div>
        )}
        {/* Description in Hebrew */}
        {subtitle.description && subtitle.description !== subtitle.subtitle && (
          <div style={{
            marginTop: '4px',
            paddingTop: '4px',
            borderTop: '1px dashed rgba(255,255,255,0.2)',
            color: 'rgba(255,255,255,0.6)',
            fontSize: '0.75rem',
            textAlign: 'right',
            direction: 'rtl'
          }}>
            {subtitle.description}
          </div>
        )}
        {/* Bible reference */}
        {(subtitle.bibleRef?.hebrewReference || subtitle.bibleRef?.reference) && (
          <div style={{
            marginTop: '6px',
            paddingTop: '4px',
            borderTop: '1px solid rgba(6,182,212,0.3)',
            color: '#06b6d4',
            fontSize: '0.7rem',
            display: 'flex',
            justifyContent: 'space-between',
            gap: '8px'
          }}>
            {subtitle.bibleRef?.hebrewReference && (
              <span style={{ direction: 'rtl' }}>{subtitle.bibleRef.hebrewReference}</span>
            )}
            {subtitle.bibleRef?.reference && (
              <span style={{ direction: 'ltr', opacity: 0.8 }}>{subtitle.bibleRef.reference}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

PrayerSlideItem.displayName = 'PrayerSlideItem';

export default PrayerSlideItem;
