import React, { memo, useCallback, useState, CSSProperties } from 'react';

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
  onEdit?: (index: number) => void;
  slideCode?: string;  // e.g., "V11", "C12"
}

const SlideGridItem: React.FC<SlideGridItemProps> = memo(({
  slide,
  index,
  isSelected,
  displayMode,
  bgColor,
  onSelect,
  onEdit,
  slideCode
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Use onMouseDown instead of onClick for instant response (no wait for mouseup)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); // Prevent text selection
    onSelect(index);
  }, [index, onSelect]);

  const handleEditClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onEdit?.(index);
  }, [index, onEdit]);

  const containerStyle: CSSProperties = {
    position: 'relative',
    border: isSelected ? '2px solid #00d4ff' : '2px solid rgba(255,255,255,0.1)',
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
    <div
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={containerStyle}
    >
      {/* Edit button - appears on hover */}
      {isHovered && onEdit && (
        <button
          onMouseDown={handleEditClick}
          style={{
            position: 'absolute',
            top: '4px',
            left: '4px',
            background: 'rgba(255, 255, 255, 0.15)',
            border: 'none',
            borderRadius: '4px',
            padding: '4px 6px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '0.7rem',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Edit slide"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      )}
      {/* Slide header */}
      <div style={headerStyle}>
        {isSelected && <span>▶</span>}
        <span>{slide.verseType || `Slide ${index + 1}`}</span>
        {slideCode && (
          <span style={{
            marginLeft: 'auto',
            backgroundColor: 'rgba(0,0,0,0.3)',
            padding: '1px 5px',
            borderRadius: '3px',
            fontSize: '0.65rem',
            fontFamily: 'monospace',
            color: isSelected ? '#00d4ff' : 'rgba(255,255,255,0.5)'
          }}>
            {slideCode}
          </span>
        )}
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
