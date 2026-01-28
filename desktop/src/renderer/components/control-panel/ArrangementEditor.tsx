import React, { memo, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import SectionChip from './SectionChip';
import { ArrangementStateReturn } from '../../hooks/useArrangementState';
import { ArrangementSection } from '../../utils/arrangementUtils';

// Memoized section item - draggable, and also routes drops to nearest gap
interface ArrangementSectionItemProps {
  section: ArrangementSection;
  index: number;
  verseTypeColor: string;
  isDisabled: boolean;
  previewText: string;
  isDragged: boolean;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  onDelete: (index: number) => void;
  onDragOverGap: (e: React.DragEvent, gapIndex: number) => void;
  onDropOnGap: (e: React.DragEvent, gapIndex: number) => void;
  isRTL: boolean;
}

const ArrangementSectionItem = memo<ArrangementSectionItemProps>(({
  section,
  index,
  verseTypeColor,
  isDisabled,
  previewText,
  isDragged,
  onDragStart,
  onDragEnd,
  onDelete,
  onDragOverGap,
  onDropOnGap,
  isRTL
}) => {
  const handleDragStart = useCallback((e: React.DragEvent) => onDragStart(e, index), [onDragStart, index]);
  const handleDelete = useCallback(() => onDelete(index), [onDelete, index]);

  // When dragging over an item, route to the left or right gap based on cursor position
  const handleItemDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const isBeforeMiddle = isRTL ? (e.clientX > midX) : (e.clientX < midX);
    onDragOverGap(e, isBeforeMiddle ? index : index + 1);
  }, [index, isRTL, onDragOverGap]);

  const handleItemDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const isBeforeMiddle = isRTL ? (e.clientX > midX) : (e.clientX < midX);
    onDropOnGap(e, isBeforeMiddle ? index : index + 1);
  }, [index, isRTL, onDropOnGap]);

  return (
    <div
      onDragOver={handleItemDragOver}
      onDrop={handleItemDrop}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        padding: '10px 8px',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: '10px',
        opacity: isDragged ? 0.4 : 1,
        transition: 'opacity 0.15s ease',
        minWidth: '80px'
      }}
    >
      <SectionChip
        verseType={section.verseType}
        bgColor={verseTypeColor}
        index={index}
        isInArrangement={true}
        showDragHandle={true}
        showDelete={true}
        disabled={isDisabled}
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        onDelete={handleDelete}
      />
      {previewText && (
        <span style={{
          fontSize: '0.75rem',
          color: 'rgba(255,255,255,0.45)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '110px',
          textAlign: 'center',
          lineHeight: 1.2
        }}>
          {previewText}
        </span>
      )}
    </div>
  );
});

ArrangementSectionItem.displayName = 'ArrangementSectionItem';

// Drop gap between items - expands when dragged over
interface DropGapProps {
  gapIndex: number;
  isActive: boolean;
  showArrow: boolean;
  isRTL: boolean;
  onDragOver: (e: React.DragEvent, gapIndex: number) => void;
  onDrop: (e: React.DragEvent, gapIndex: number) => void;
  onDragLeave: () => void;
}

const DropGap = memo<DropGapProps>(({
  gapIndex,
  isActive,
  showArrow,
  isRTL,
  onDragOver,
  onDrop,
  onDragLeave
}) => {
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    onDragOver(e, gapIndex);
  }, [onDragOver, gapIndex]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDrop(e, gapIndex);
  }, [onDrop, gapIndex]);

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragLeave={onDragLeave}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: isActive ? '28px' : '20px',
        minHeight: '40px',
        transition: 'all 0.15s ease',
        flexShrink: 0,
        position: 'relative'
      }}
    >
      {isActive ? (
        <div style={{
          width: '3px',
          height: '100%',
          minHeight: '40px',
          backgroundColor: '#3B82F6',
          borderRadius: '2px',
          boxShadow: '0 0 8px rgba(59,130,246,0.6)'
        }} />
      ) : showArrow ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      ) : null}
    </div>
  );
});

DropGap.displayName = 'DropGap';

interface ArrangementEditorProps {
  arrangementState: ArrangementStateReturn;
  getVerseTypeColor: (verseType?: string) => string;
}

const ArrangementEditor = memo<ArrangementEditorProps>(({
  arrangementState,
  getVerseTypeColor
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';
  const {
    activeArrangement,
    activeArrangementId,
    availableSections,
    deleteArrangement,
    renameArrangement,
    addSection,
    removeSection,
    reorderSections,
    validationResult,
    getSectionPreviewText
  } = arrangementState;

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggedSectionIndex, setDraggedSectionIndex] = useState<number | null>(null);

  // Handle starting rename
  const handleStartRename = useCallback(() => {
    if (activeArrangement) {
      setRenameValue(activeArrangement.name);
      setIsRenaming(true);
    }
  }, [activeArrangement]);

  // Handle saving rename
  const handleSaveRename = useCallback(async () => {
    if (!activeArrangementId || !renameValue.trim()) return;
    try {
      await renameArrangement(activeArrangementId, renameValue.trim());
      setIsRenaming(false);
    } catch (err) {
      console.error('Failed to rename arrangement:', err);
    }
  }, [activeArrangementId, renameValue, renameArrangement]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!activeArrangementId) return;
    if (window.confirm(t('controlPanel.arrangement.confirmDelete', 'Delete this arrangement?'))) {
      await deleteArrangement(activeArrangementId);
    }
  }, [activeArrangementId, deleteArrangement, t]);

  // Handle drag from arrangement list - just track index for visual feedback
  const handleArrangementDragStart = useCallback((_e: React.DragEvent, index: number) => {
    setDraggedSectionIndex(index);
  }, []);

  // Handle drag over a gap between items
  const handleDragOverGap = useCallback((_e: React.DragEvent, gapIndex: number) => {
    setDragOverIndex(gapIndex);
  }, []);

  // Handle drag leaving a gap
  const handleDragLeaveGap = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  // Handle drop on a gap - insert at that position
  const handleDropOnGap = useCallback((e: React.DragEvent, gapIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    setDraggedSectionIndex(null);

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/x-arrangement-section'));

      if (data.fromPalette) {
        // Adding from palette - insert at gap position
        addSection(data.verseType, gapIndex);
      } else if (typeof data.index === 'number') {
        // Reordering within arrangement
        // If dragging to a gap after the current position, adjust index
        const fromIndex = data.index;
        let toIndex = gapIndex;
        if (fromIndex < toIndex) {
          toIndex = toIndex - 1; // Account for removal shifting indices
        }
        if (fromIndex !== toIndex) {
          reorderSections(fromIndex, toIndex);
        }
      }
    } catch (err) {
      console.error('Failed to handle drop:', err);
    }
  }, [addSection, reorderSections]);

  // Handle section removal - stable callback
  const handleRemoveSection = useCallback((index: number) => {
    removeSection(index);
  }, [removeSection]);

  // Handle drag end - must be defined before paletteChips which uses it
  const handleDragEnd = useCallback(() => {
    setDragOverIndex(null);
    setDraggedSectionIndex(null);
  }, []);

  // Memoized palette chips to avoid recreating on every render
  const paletteChips = useMemo(() => {
    return availableSections.map(verseType => (
      <SectionChip
        key={verseType}
        verseType={verseType}
        bgColor={getVerseTypeColor(verseType)}
        showDragHandle={true}
        showDelete={false}
        isInArrangement={false}
        onDragEnd={handleDragEnd}
      />
    ));
  }, [availableSections, getVerseTypeColor, handleDragEnd]);

  // Memoized preview texts for arrangement sections
  const sectionPreviewTexts = useMemo(() => {
    if (!activeArrangement) return new Map<string, string>();
    const texts = new Map<string, string>();
    activeArrangement.sections.forEach(section => {
      if (!texts.has(section.verseType)) {
        texts.set(section.verseType, getSectionPreviewText(section.verseType));
      }
    });
    return texts;
  }, [activeArrangement, getSectionPreviewText]);

  // Set of available sections for O(1) lookup
  const availableSectionsSet = useMemo(() => new Set(availableSections), [availableSections]);

  // Handle drag leaving the container entirely
  const handleContainerDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverIndex(null);
    }
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      gap: '8px',
      padding: '8px'
    }}>
      {/* Top bar: arrangement info + actions | divider | available sections */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexShrink: 0,
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: '6px',
        padding: '6px 8px',
        flexWrap: 'wrap'
      }}>
        {/* Left: arrangement name + rename/delete */}
        {activeArrangement && (
          <>
            {isRenaming ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveRename()}
                  autoFocus
                  style={{
                    width: '120px',
                    padding: '3px 6px',
                    borderRadius: '4px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    color: 'white',
                    fontSize: '0.75rem'
                  }}
                />
                <button
                  onClick={handleSaveRename}
                  style={{
                    padding: '3px 6px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: '#10B981',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.7rem'
                  }}
                >
                  {t('common.save', 'Save')}
                </button>
                <button
                  onClick={() => setIsRenaming(false)}
                  style={{
                    padding: '3px 6px',
                    borderRadius: '4px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    backgroundColor: 'transparent',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.7rem'
                  }}
                >
                  {t('common.cancel', 'Cancel')}
                </button>
              </div>
            ) : (
              <>
                <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>
                  {activeArrangement.name}
                </span>
                <button
                  onClick={handleStartRename}
                  title={t('common.rename', 'Rename')}
                  style={{
                    padding: '3px',
                    borderRadius: '3px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: 'rgba(255,255,255,0.4)',
                    cursor: 'pointer'
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  onClick={handleDelete}
                  title={t('common.delete', 'Delete')}
                  style={{
                    padding: '3px',
                    borderRadius: '3px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: 'rgba(239,68,68,0.5)',
                    cursor: 'pointer'
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </>
            )}

            {/* Vertical divider */}
            <div style={{ width: '1px', height: '20px', backgroundColor: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />
          </>
        )}

        {/* Right: available sections palette */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          flex: 1,
          flexWrap: 'wrap'
        }}>
          {availableSections.length > 0 ? (
            paletteChips
          ) : (
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
              {t('controlPanel.arrangement.noSections', 'No sections in this song')}
            </span>
          )}
        </div>
      </div>

      {/* Arrangement order */}
      <div style={{
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: '6px',
        padding: '8px',
        overflow: 'auto'
      }}>
        <div style={{
          fontSize: '0.7rem',
          color: 'rgba(255,255,255,0.6)',
          marginBottom: '6px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          {t('controlPanel.arrangement.arrangementOrder', 'Arrangement Order')}
        </div>

        {/* Validation warning */}
        {!validationResult.valid && (
          <div style={{
            backgroundColor: 'rgba(239,68,68,0.2)',
            border: '1px solid rgba(239,68,68,0.5)',
            borderRadius: '4px',
            padding: '6px 8px',
            marginBottom: '8px',
            fontSize: '0.75rem',
            color: '#FCA5A5'
          }}>
            {t('controlPanel.arrangement.missingSections', 'Missing sections')}: {validationResult.missingSections.join(', ')}
          </div>
        )}

        {activeArrangement ? (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              minHeight: '60px'
            }}
            onDragLeave={handleContainerDragLeave}
          >
            {activeArrangement.sections.length > 0 ? (
              <>
                {activeArrangement.sections.map((section, index) => (
                  <React.Fragment key={section.id}>
                    {/* Drop gap before each item (and arrow for items after first) */}
                    <DropGap
                      gapIndex={index}
                      isActive={dragOverIndex === index}
                      showArrow={index > 0}
                      isRTL={isRTL}
                      onDragOver={handleDragOverGap}
                      onDrop={handleDropOnGap}
                      onDragLeave={handleDragLeaveGap}
                    />
                    <ArrangementSectionItem
                      section={section}
                      index={index}
                      verseTypeColor={getVerseTypeColor(section.verseType)}
                      isDisabled={!availableSectionsSet.has(section.verseType)}
                      previewText={sectionPreviewTexts.get(section.verseType) || ''}
                      isDragged={draggedSectionIndex === index}
                      onDragStart={handleArrangementDragStart}
                      onDragEnd={handleDragEnd}
                      onDelete={handleRemoveSection}
                      onDragOverGap={handleDragOverGap}
                      onDropOnGap={handleDropOnGap}
                      isRTL={isRTL}
                    />
                  </React.Fragment>
                ))}
                {/* Drop gap after last item */}
                <DropGap
                  gapIndex={activeArrangement.sections.length}
                  isActive={dragOverIndex === activeArrangement.sections.length}
                  showArrow={false}
                  isRTL={isRTL}
                  onDragOver={handleDragOverGap}
                  onDrop={handleDropOnGap}
                  onDragLeave={handleDragLeaveGap}
                />
              </>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; handleDragOverGap(e, 0); }}
                onDrop={(e) => handleDropOnGap(e, 0)}
                onDragLeave={handleDragLeaveGap}
                style={{
                  textAlign: 'center',
                  padding: '20px',
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: '0.85rem',
                  border: dragOverIndex === 0 ? '2px dashed #3B82F6' : '2px dashed rgba(255,255,255,0.2)',
                  backgroundColor: dragOverIndex === 0 ? 'rgba(59,130,246,0.1)' : 'transparent',
                  borderRadius: '6px',
                  width: '100%',
                  transition: 'all 0.15s ease'
                }}
              >
                {t('controlPanel.arrangement.dragSectionsHere', 'Drag sections here to build your arrangement')}
              </div>
            )}
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '20px',
            color: 'rgba(255,255,255,0.4)',
            fontSize: '0.85rem'
          }}>
            {t('controlPanel.arrangement.selectOrCreate', 'Select an arrangement or create a new one')}
          </div>
        )}
      </div>
    </div>
  );
});

ArrangementEditor.displayName = 'ArrangementEditor';

export default ArrangementEditor;
