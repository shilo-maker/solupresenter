import React, { memo, useCallback, CSSProperties } from 'react';

interface SlideData {
  originalText?: string;
  transliteration?: string;
  translation?: string;
  verseType?: string;
}

interface SlideGridItemProps {
  slide: SlideData;
  index: number;
  isSelected: boolean;
  displayMode: string;
  bgColor: string;
  onSelect: (index: number) => void;
}

const SlideGridItem: React.FC<SlideGridItemProps> = memo(({
  slide,
  index,
  isSelected,
  displayMode,
  bgColor,
  onSelect
}) => {
  // Use onMouseDown instead of onClick for instant response (no wait for mouseup)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); // Prevent text selection
    onSelect(index);
  }, [index, onSelect]);

  const containerStyle: CSSProperties = {
    position: 'relative',
    border: isSelected ? '3px solid #00d4ff' : '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    padding: '8px 10px',
    cursor: 'pointer',
    backgroundColor: bgColor && bgColor !== 'transparent'
      ? (isSelected ? bgColor : `${bgColor}99`)
      : (isSelected ? 'rgba(0, 212, 255, 0.2)' : 'rgba(0,0,0,0.3)'),
    boxShadow: isSelected ? '0 0 10px rgba(0, 212, 255, 0.5)' : 'none'
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: isSelected ? '#00d4ff' : 'rgba(255,255,255,0.6)',
    fontWeight: 'bold',
    marginBottom: '6px',
    fontSize: '0.7rem'
  };

  return (
    <div onMouseDown={handleMouseDown} style={containerStyle}>
      {/* Slide header */}
      <div style={headerStyle}>
        {isSelected && <span>▶</span>}
        {slide.verseType || `Slide ${index + 1}`}
      </div>
      {/* Slide content - respects displayMode */}
      <div style={{ fontSize: '0.8rem', lineHeight: '1.4', color: 'white', textAlign: 'left' }}>
        {slide.originalText && (
          <div style={{ marginBottom: displayMode === 'bilingual' ? '3px' : 0, fontWeight: 500 }}>
            {slide.originalText}
          </div>
        )}
        {displayMode === 'bilingual' && slide.transliteration && (
          <div style={{ marginBottom: '3px', color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', fontStyle: 'italic' }}>
            {slide.transliteration}
          </div>
        )}
        {displayMode === 'bilingual' && slide.translation && (
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem' }}>
            {slide.translation}
          </div>
        )}
      </div>
    </div>
  );
});

SlideGridItem.displayName = 'SlideGridItem';

export default SlideGridItem;
