import React, { memo, useCallback, CSSProperties } from 'react';

interface SlideData {
  originalText?: string;
  transliteration?: string;
  translation?: string;
  verseType?: string;
}

interface CombinedSlideItem {
  type: 'single' | 'combined';
  slide?: SlideData;
  slides?: SlideData[];
  label: string;
  verseType?: string;
}

interface CombinedSlideGridItemProps {
  item: CombinedSlideItem;
  combinedIndex: number;
  isSelected: boolean;
  bgColor: string;
  onSelect: (index: number) => void;
}

const CombinedSlideGridItem: React.FC<CombinedSlideGridItemProps> = memo(({
  item,
  combinedIndex,
  isSelected,
  bgColor,
  onSelect
}) => {
  // Use onMouseDown instead of onClick for instant response (no wait for mouseup)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); // Prevent text selection
    onSelect(combinedIndex);
  }, [combinedIndex, onSelect]);

  const verseType = item.verseType || '';

  const containerStyle: CSSProperties = {
    position: 'relative',
    border: isSelected ? '3px solid #00d4ff' : '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    padding: '8px 10px',
    paddingLeft: isSelected ? '14px' : '10px',
    cursor: 'pointer',
    backgroundColor: bgColor && bgColor !== 'transparent'
      ? (isSelected ? bgColor : `${bgColor}99`)
      : (isSelected ? 'rgba(0, 212, 255, 0.2)' : 'rgba(0,0,0,0.3)'),
    boxShadow: isSelected ? '0 0 12px rgba(0, 212, 255, 0.6)' : 'none'
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: isSelected ? '#00d4ff' : 'rgba(255,255,255,0.7)',
    fontWeight: 'bold',
    marginBottom: '4px',
    fontSize: '0.75rem'
  };

  return (
    <div onMouseDown={handleMouseDown} style={containerStyle}>
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
      <div style={headerStyle}>
        {isSelected && <span style={{ fontSize: '0.7rem' }}>▶</span>}
        {/* Show label like "Verse 1-2" or "3-4" */}
        {item.type === 'combined' ? (
          <span>
            {verseType ? `${verseType} ` : ''}{item.label}
            <span style={{ marginLeft: '4px', fontSize: '0.65rem', opacity: 0.7 }}>●●</span>
          </span>
        ) : (
          <span>{verseType ? `${verseType} ` : ''}{item.label}</span>
        )}
      </div>
      {/* Slide content */}
      <div style={{ fontSize: '0.85rem', lineHeight: '1.3', color: 'white' }}>
        {item.type === 'combined' && item.slides ? (
          <>
            <div style={{ marginBottom: '4px', textAlign: 'right', direction: 'rtl' }}>
              {item.slides[0]?.originalText}
            </div>
            <div style={{
              paddingTop: '4px',
              borderTop: '1px dashed rgba(255,255,255,0.3)',
              textAlign: 'right',
              direction: 'rtl'
            }}>
              {item.slides[1]?.originalText}
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'right', direction: 'rtl' }}>
            {item.slide?.originalText}
          </div>
        )}
      </div>
    </div>
  );
});

CombinedSlideGridItem.displayName = 'CombinedSlideGridItem';

export default CombinedSlideGridItem;
