import React, { memo, useMemo, useCallback, CSSProperties, DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { cardStyles } from '../../styles/controlPanelStyles';
import { theme, itemTypeColors, getItemTypeColor } from '../../styles/theme';

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
  const itemColors = getItemTypeColor(item.type);

  const containerStyle = useMemo((): CSSProperties => {
    const baseStyle: CSSProperties = {
      ...cardStyles.base,
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      marginBottom: '4px',
      background: isSelected
        ? theme.colors.primary.bgHover
        : itemColors.bg,
      borderColor: isSelected ? theme.colors.primary.border : 'transparent',
    };

    if (isDropTarget) {
      baseStyle.borderTop = `2px solid ${theme.colors.primary.main}`;
    }

    if (item.type === 'section') {
      baseStyle.background = theme.colors.secondary.bg;
      baseStyle.borderLeft = `3px solid ${theme.colors.secondary.main}`;
      baseStyle.paddingLeft = '10px';
    }

    return baseStyle;
  }, [isSelected, isDropTarget, item.type, itemColors.bg]);

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
        color: item.type === 'section' ? theme.colors.secondary.light : 'white',
        opacity: 0.8,
      }}>
        {typeIcons[item.type]}
      </span>

      {/* Title */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: theme.colors.text.primary,
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
          color: theme.colors.text.muted,
          background: theme.colors.glass.hover,
          padding: '2px 6px',
          borderRadius: theme.radius.full,
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
          color: theme.colors.text.muted,
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
