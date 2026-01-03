import React, { memo, useMemo, useCallback, CSSProperties, DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { cardStyles, colors, flexStyles } from '../../styles/controlPanelStyles';

type SetlistItemType = 'song' | 'blank' | 'section' | 'countdown' | 'announcement' | 'messages' | 'media' | 'bible' | 'presentation' | 'youtube';

interface SetlistItem {
  id: string;
  type: SetlistItemType;
  title?: string;
  song?: {
    id: string;
    title: string;
  };
}

interface SetlistItemCardProps {
  item: SetlistItem;
  index: number;
  isSelected: boolean;
  isDropTarget: boolean;
  isCollapsed?: boolean;
  sectionItemCount?: number;
  isRTL?: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onDragStart: (index: number) => void;
  onDragEnd: () => void;
  onDragOver: (index: number) => void;
  onToggleCollapse?: () => void;
}

const typeIcons: Record<SetlistItemType, string> = {
  song: '🎵',
  blank: '⬜',
  section: '§',
  countdown: '⏱️',
  announcement: '📢',
  messages: '💬',
  media: '🎬',
  bible: '📖',
  presentation: '📊',
  youtube: '▶️',
};

const typeColors: Record<SetlistItemType, string> = {
  song: 'rgba(102, 126, 234, 0.3)',
  blank: 'rgba(255,255,255,0.1)',
  section: 'rgba(255, 140, 66, 0.15)',
  countdown: 'rgba(255, 193, 7, 0.15)',
  announcement: 'rgba(255, 193, 7, 0.15)',
  messages: 'rgba(255, 193, 7, 0.15)',
  media: 'rgba(40, 167, 69, 0.15)',
  bible: 'rgba(102, 126, 234, 0.15)',
  presentation: 'rgba(0, 212, 255, 0.15)',
  youtube: 'rgba(255, 0, 0, 0.15)',
};

const SetlistItemCard: React.FC<SetlistItemCardProps> = memo(({
  item,
  index,
  isSelected,
  isDropTarget,
  isCollapsed = false,
  sectionItemCount = 0,
  isRTL = false,
  onSelect,
  onRemove,
  onDragStart,
  onDragEnd,
  onDragOver,
  onToggleCollapse,
}) => {
  const { t } = useTranslation();

  const containerStyle = useMemo((): CSSProperties => {
    const baseStyle: CSSProperties = {
      ...cardStyles.base,
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      marginBottom: '4px',
      background: isSelected
        ? 'rgba(102, 126, 234, 0.3)'
        : typeColors[item.type] || cardStyles.base.background,
      borderColor: isSelected ? 'rgba(102, 126, 234, 0.5)' : 'transparent',
    };

    if (isDropTarget) {
      baseStyle.borderTop = '2px solid #FF8C42';
    }

    if (item.type === 'section') {
      baseStyle.background = 'rgba(255, 140, 66, 0.15)';
      baseStyle.borderLeft = '3px solid #FF8C42';
      baseStyle.paddingLeft = '10px';
    }

    return baseStyle;
  }, [isSelected, isDropTarget, item.type]);

  const handleDragStart = useCallback((e: DragEvent<HTMLDivElement>) => {
    onDragStart(index);
    e.dataTransfer.effectAllowed = 'move';
  }, [index, onDragStart]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onDragOver(index);
  }, [index, onDragOver]);

  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove();
  }, [onRemove]);

  const getTitle = (): string => {
    if (item.type === 'song' && item.song) {
      return item.song.title;
    }
    if (item.type === 'section') {
      return item.title || t('controlPanel.section');
    }
    return item.title || t(`controlPanel.${item.type}`);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onDragOver={handleDragOver}
      onClick={onSelect}
      style={containerStyle}
    >
      {/* Icon */}
      <span style={{
        fontSize: item.type === 'section' ? '1rem' : '0.9rem',
        color: item.type === 'section' ? '#FF8C42' : 'white',
        opacity: 0.8,
      }}>
        {typeIcons[item.type]}
      </span>

      {/* Title */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: 'white',
          fontSize: item.type === 'section' ? '0.85rem' : '0.8rem',
          fontWeight: item.type === 'section' ? 600 : 400,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {getTitle()}
        </div>
      </div>

      {/* Section collapse indicator */}
      {item.type === 'section' && (
        <span style={{
          fontSize: '0.7rem',
          color: 'rgba(255,255,255,0.5)',
          background: 'rgba(255,255,255,0.1)',
          padding: '2px 6px',
          borderRadius: '10px',
        }}>
          {sectionItemCount} {isCollapsed ? '▸' : '▾'}
        </span>
      )}

      {/* Remove button */}
      <button
        onClick={handleRemove}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'rgba(255,255,255,0.4)',
          cursor: 'pointer',
          padding: '4px',
          fontSize: '0.8rem',
          lineHeight: 1,
        }}
        title={t('common.remove')}
      >
        ×
      </button>
    </div>
  );
});

SetlistItemCard.displayName = 'SetlistItemCard';

export default SetlistItemCard;
