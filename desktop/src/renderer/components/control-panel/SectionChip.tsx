import React, { memo } from 'react';
import { getSectionAbbreviation } from '../../utils/arrangementUtils';

interface SectionChipProps {
  verseType: string;
  bgColor: string;
  index?: number;
  isDragging?: boolean;
  isInArrangement?: boolean;
  showDelete?: boolean;
  showDragHandle?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  onDelete?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

const SectionChip = memo<SectionChipProps>(({
  verseType,
  bgColor,
  index,
  isDragging = false,
  isInArrangement = false,
  showDelete = false,
  showDragHandle = true,
  disabled = false,
  onClick,
  onDelete,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop
}) => {
  const abbreviation = getSectionAbbreviation(verseType);

  const handleDragStart = (e: React.DragEvent) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    // Use same format as ArrangementEditor for consistency
    e.dataTransfer.setData('application/x-arrangement-section', JSON.stringify({
      verseType,
      index,
      fromPalette: !isInArrangement
    }));
    e.dataTransfer.effectAllowed = 'move';
    onDragStart?.(e);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
  };

  return (
    <div
      draggable={!disabled && showDragHandle}
      onClick={disabled ? undefined : onClick}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 14px',
        borderRadius: '8px',
        backgroundColor: bgColor || 'rgba(255,255,255,0.1)',
        color: 'white',
        fontSize: '0.95rem',
        fontWeight: 'bold',
        cursor: disabled ? 'default' : (showDragHandle ? 'grab' : 'pointer'),
        opacity: isDragging ? 0.5 : (disabled ? 0.5 : 1),
        border: '1px solid rgba(255,255,255,0.2)',
        transition: 'all 0.15s ease',
        userSelect: 'none',
        minWidth: '48px',
        justifyContent: 'center',
        position: 'relative'
      }}
      title={verseType}
    >
      {showDragHandle && !disabled && (
        <span style={{
          display: 'flex',
          alignItems: 'center',
          marginRight: '2px',
          opacity: 0.6
        }}>
          <svg width="10" height="14" viewBox="0 0 8 12" fill="currentColor">
            <circle cx="2" cy="2" r="1.2" />
            <circle cx="6" cy="2" r="1.2" />
            <circle cx="2" cy="6" r="1.2" />
            <circle cx="6" cy="6" r="1.2" />
            <circle cx="2" cy="10" r="1.2" />
            <circle cx="6" cy="10" r="1.2" />
          </svg>
        </span>
      )}
      <span>{abbreviation}</span>
      {showDelete && onDelete && (
        <button
          draggable={false}
          onClick={handleDeleteClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '16px',
            height: '16px',
            padding: 0,
            marginLeft: '2px',
            border: 'none',
            borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,0.2)',
            color: 'white',
            cursor: 'pointer',
            fontSize: '11px',
            lineHeight: 1
          }}
          title="Remove section"
        >
          ×
        </button>
      )}
    </div>
  );
});

SectionChip.displayName = 'SectionChip';

export default SectionChip;
