import React, { memo, startTransition, useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import VerseSectionNav from './VerseSectionNav';
import SlidesGrid from './SlidesGrid';
import QuickSlideEditor from './QuickSlideEditor';
import SongSlideEditor from './SongSlideEditor';
import { SlideCodeMap } from '../../utils/slideCodeUtils';
import { ArrangementStateReturn } from '../../hooks/useArrangementState';

interface Song {
  id: string;
  title: string;
  slides: Array<{
    originalText?: string;
    transliteration?: string;
    translation?: string;
    verseType?: string;
    [key: string]: any;
  }>;
}

interface Presentation {
  id: string;
  title: string;
  slides: any[];
  quickModeData?: {
    type: string;
    subtitles?: any[];
    [key: string]: any;
  };
}

interface CombinedSlide {
  verseType?: string;
  originalIndices?: number[];
  [key: string]: any;
}

interface BottomRowPanelProps {
  selectedSong: Song | null;
  selectedPresentation: Presentation | null;
  displayMode: 'bilingual' | 'original' | 'translation';
  currentSlideIndex: number;
  liveSongId: string | null;
  liveSlideIndex: number;
  isBlank: boolean;
  isRTL: boolean;
  contentType?: 'song' | 'bible' | 'prayer' | 'presentation';
  isQuickModeActive: boolean;
  onQuickModeClick: () => void;
  // Quick Slide props
  quickSlideCount: number;
  quickSlideBroadcastIndex: number;
  isAutoGenerating: boolean;
  onQuickSlideTextChange: (text: string) => void;
  onAutoGenerateQuickSlide: () => void;
  onBroadcastQuickSlide: (index: number, text: string) => void;
  autoPlayActive: boolean;
  autoPlayInterval: number;
  currentPresentationSlideIndex: number;
  combinedSlidesData: { combinedSlides: CombinedSlide[]; originalToCombined: Map<number, number>; combinedToOriginal: Map<number, number[]> } | null;
  selectedCombinedIndex: number;
  quickSlideText: string;
  getVerseTypeColor: (verseType?: string) => string;
  selectSlide: (index: number) => void;
  goToSlide: (index: number, combinedIndices?: number[]) => void;
  selectCombinedSlide: (combinedIndex: number) => void;
  sendPrayerPresentationSlide: (presentation: Presentation, slideIndex: number, mode: 'bilingual' | 'original' | 'translation') => void;
  updateQuickSlideCount: (text: string) => void;
  onSetIsBlank: (blank: boolean) => void;
  onSetLiveState: (state: { slideData: any; contentType: any; songId: string | null; slideIndex: number }) => void;
  onSetAutoPlayActive: (active: boolean, presentation: any) => void;
  onSetAutoPlayInterval: (interval: number) => void;
  onSetCurrentPresentationSlideIndex: (index: number) => void;
  onSlideCodeMapChange?: (codeMap: SlideCodeMap | null) => void;
  onEditSlide?: (index: number) => void;
  onAddSlide?: () => void;
  // Arrangement props
  arrangementState?: ArrangementStateReturn;
  // Song slide editing props - index of slide being edited, -1 for new slide, null for not editing
  editingSongSlideIndex?: number | null;
  onSaveSongSlides?: (slides: Array<{ originalText: string; transliteration: string; translation: string; translationOverflow: string; verseType: string }>) => Promise<void>;
  onCancelEditSongSlides?: () => void;
}

const BottomRowPanel = memo<BottomRowPanelProps>(({
  selectedSong,
  selectedPresentation,
  displayMode,
  currentSlideIndex,
  liveSongId,
  liveSlideIndex,
  isBlank,
  isRTL,
  contentType,
  isQuickModeActive,
  onQuickModeClick,
  quickSlideCount,
  quickSlideBroadcastIndex,
  isAutoGenerating,
  onQuickSlideTextChange,
  onAutoGenerateQuickSlide,
  onBroadcastQuickSlide,
  autoPlayActive,
  autoPlayInterval,
  currentPresentationSlideIndex,
  combinedSlidesData,
  selectedCombinedIndex,
  quickSlideText,
  getVerseTypeColor,
  selectSlide,
  goToSlide,
  selectCombinedSlide,
  sendPrayerPresentationSlide,
  updateQuickSlideCount,
  onSetIsBlank,
  onSetLiveState,
  onSetAutoPlayActive,
  onSetAutoPlayInterval,
  onSetCurrentPresentationSlideIndex,
  onSlideCodeMapChange,
  onEditSlide,
  onAddSlide,
  arrangementState,
  editingSongSlideIndex,
  onSaveSongSlides,
  onCancelEditSongSlides
}) => {
  const { t } = useTranslation();
  const isArrangementMode = arrangementState?.isArrangementMode ?? false;
  const [showArrDropdown, setShowArrDropdown] = useState(false);
  const arrDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showArrDropdown) return;
    const handleClick = (e: MouseEvent) => {
      if (arrDropdownRef.current && !arrDropdownRef.current.contains(e.target as Node)) {
        setShowArrDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showArrDropdown]);

  // Stable callbacks for SlidesGrid
  const handleAutoPlayToggle = useCallback(() => {
    if (!autoPlayActive && selectedPresentation) {
      onSetAutoPlayActive(true, selectedPresentation);
    } else {
      onSetAutoPlayActive(false, null);
    }
  }, [autoPlayActive, selectedPresentation, onSetAutoPlayActive]);

  const handleSelectPrayerSlide = useCallback((presentation: Presentation, idx: number) => {
    onSetIsBlank(false);
    sendPrayerPresentationSlide(presentation, idx, displayMode);
    startTransition(() => {
      onSetCurrentPresentationSlideIndex(idx);
    });
  }, [onSetIsBlank, sendPrayerPresentationSlide, displayMode, onSetCurrentPresentationSlideIndex]);

  const handleSelectPresentationSlide = useCallback((presentation: Presentation, slide: any, idx: number) => {
    onSetLiveState({ slideData: slide, contentType: 'presentation', songId: presentation.id, slideIndex: idx });
    onSetIsBlank(false);
    startTransition(() => {
      onSetCurrentPresentationSlideIndex(idx);
    });
    window.electronAPI.sendSlide({
      songId: presentation.id,
      slideIndex: idx,
      displayMode: 'bilingual',
      isBlank: false,
      songTitle: presentation.title,
      presentationSlide: slide
    });
  }, [onSetLiveState, onSetIsBlank, onSetCurrentPresentationSlideIndex]);

  return (
    <div style={{
      flex: 1,
      background: 'rgba(255,255,255,0.03)',
      borderRadius: '12px',
      padding: '12px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0
    }}>
      {/* Slide Preview Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '10px',
        flexShrink: 0,
        gap: '10px',
        flexWrap: 'wrap'
      }}>
        {/* Title Section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', minWidth: 0, flexShrink: 1 }}>
          <span style={{ color: 'white', fontWeight: 600, fontSize: '0.9rem', flexShrink: 0 }}>
            {isQuickModeActive ? t('quickSlide.title', 'Quick Slide') : t('controlPanel.slidePreview')}
          </span>
          {selectedSong && !isQuickModeActive && (
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedSong.title} — {selectedSong.slides?.length ?? 0} slides
            </span>
          )}
          {/* Quick Mode Button */}
          <button
            onClick={onQuickModeClick}
            style={{
              background: isQuickModeActive ? '#6f42c1' : 'rgba(255,255,255,0.1)',
              border: isQuickModeActive ? 'none' : '1px solid #6f42c1',
              borderRadius: '6px',
              padding: '5px 10px',
              color: isQuickModeActive ? '#000' : '#6f42c1',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.75rem',
              boxShadow: isQuickModeActive ? '0 0 10px #6f42c1, 0 0 20px rgba(111, 66, 193, 0.5)' : 'none',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {isQuickModeActive ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                {t('common.exit', 'Exit')}
              </>
            ) : (
              <>⚡ {t('controlPanel.quickMode')}</>
            )}
          </button>
          {/* Quick Mode Instructions - show next to Exit button */}
          {isQuickModeActive && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '4px 10px',
              background: 'rgba(111, 66, 193, 0.15)',
              borderRadius: '5px',
              fontSize: '0.7rem',
              color: 'rgba(255,255,255,0.7)'
            }}>
              <span><strong style={{ color: '#a78bfa' }}>L1:</strong> Original</span>
              <span><strong style={{ color: '#a78bfa' }}>L2:</strong> Transliteration</span>
              <span><strong style={{ color: '#a78bfa' }}>L3:</strong> Translation</span>
            </div>
          )}
        </div>

        {/* Verse Section Navigation Buttons - hidden for now */}

        {/* Arrangement Controls - hidden when Quick Mode is active */}
        {selectedSong && arrangementState && !isQuickModeActive && (
          <div ref={arrDropdownRef} style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'relative' }}>
            {/* Done button - exit edit mode back to using the arrangement */}
            {isArrangementMode && (
              <button
                onClick={() => arrangementState.setIsArrangementMode(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#10B981',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {t('common.done', 'Done')}
              </button>
            )}

            {/* Clear arrangement button - show when one is selected outside edit mode */}
            {arrangementState.activeArrangementId && !isArrangementMode && (
              <button
                onClick={() => arrangementState.setActiveArrangementId(null)}
                title={t('controlPanel.arrangement.clearArrangement', 'Clear arrangement')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px',
                  borderRadius: '4px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.5)',
                  cursor: 'pointer'
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}

            {/* Arrangement button - click toggles dropdown, long label shows active arrangement */}
            <button
              onClick={() => setShowArrDropdown(!showArrDropdown)}
              title={isArrangementMode ? t('controlPanel.arrangement.exitArrangementMode', 'Exit Arrangement Mode') : t('controlPanel.arrangement.enterArrangementMode', 'Arrangement Mode')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 10px',
                borderRadius: showArrDropdown ? '6px 6px 0 0' : '6px',
                border: 'none',
                borderBottom: showArrDropdown ? 'none' : undefined,
                backgroundColor: (isArrangementMode || showArrDropdown) ? '#3B82F6' : arrangementState.activeArrangementId ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.1)',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 600,
                transition: 'all 0.15s ease',
                position: 'relative',
                zIndex: showArrDropdown ? 101 : 'auto'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              {arrangementState.activeArrangement?.name || t('controlPanel.arrangement.arr', 'Arr')}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, transform: showArrDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Dropdown menu - appears below the button, anchored toward the panel interior */}
            {showArrDropdown && (
              <div style={{
                position: 'absolute',
                top: '100%',
                ...(isRTL ? { left: 0 } : { right: 0 }),
                minWidth: '180px',
                backgroundColor: '#1E1E2E',
                border: '1px solid rgba(255,255,255,0.15)',
                borderTop: 'none',
                borderRadius: '0 0 6px 6px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                zIndex: 100,
                overflow: 'hidden'
              }}>
                {/* Turn off arrangement - only when one is active */}
                {arrangementState.activeArrangementId && (
                  <>
                    <div
                      onClick={() => { arrangementState.setActiveArrangementId(null); setShowArrDropdown(false); if (isArrangementMode) arrangementState.setIsArrangementMode(false); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '7px 12px',
                        fontSize: '0.75rem',
                        color: 'rgba(255,255,255,0.5)',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                      {t('controlPanel.arrangement.turnOff', 'Turn off')}
                    </div>
                    <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.1)', margin: '2px 0' }} />
                  </>
                )}
                {/* Arrangement items */}
                {arrangementState.arrangements.map(arr => (
                  <div
                    key={arr.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: arrangementState.activeArrangementId === arr.id ? 'rgba(59,130,246,0.15)' : 'transparent',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => { if (arrangementState.activeArrangementId !== arr.id) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; }}
                    onMouseLeave={(e) => { if (arrangementState.activeArrangementId !== arr.id) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <div
                      onClick={() => { arrangementState.setActiveArrangementId(arr.id); setShowArrDropdown(false); }}
                      style={{
                        flex: 1,
                        padding: '7px 12px',
                        fontSize: '0.75rem',
                        color: arrangementState.activeArrangementId === arr.id ? 'white' : 'rgba(255,255,255,0.7)',
                        cursor: 'pointer'
                      }}
                    >
                      {arr.name}
                    </div>
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowArrDropdown(false);
                        arrangementState.setActiveArrangementId(arr.id);
                        arrangementState.setIsArrangementMode(true);
                      }}
                      title={t('controlPanel.arrangement.editArrangements', 'Edit Arrangements')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '4px 8px',
                        color: 'rgba(255,255,255,0.35)',
                        cursor: 'pointer',
                        flexShrink: 0
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </div>
                  </div>
                ))}
                {/* Divider */}
                <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.1)', margin: '2px 0' }} />
                {/* Create new button */}
                <div
                  onClick={async () => {
                    setShowArrDropdown(false);
                    const newArr = await arrangementState.createArrangement(
                      t('controlPanel.arrangement.defaultName', 'Arrangement') + ' ' + (arrangementState.arrangements.length + 1)
                    );
                    arrangementState.setActiveArrangementId(newArr.id);
                    arrangementState.setIsArrangementMode(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 12px',
                    fontSize: '0.75rem',
                    color: '#10B981',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(16,185,129,0.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  {t('controlPanel.arrangement.newArrangement', 'New Arrangement')}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Slide Editor, Song Slide Editor, or Slides Grid */}
      {isQuickModeActive ? (
        <QuickSlideEditor
          quickSlideText={quickSlideText}
          quickSlideCount={quickSlideCount}
          quickSlideBroadcastIndex={quickSlideBroadcastIndex}
          isAutoGenerating={isAutoGenerating}
          displayMode={displayMode}
          onTextChange={onQuickSlideTextChange}
          onUpdateCount={updateQuickSlideCount}
          onAutoGenerate={onAutoGenerateQuickSlide}
          onBroadcastSlide={onBroadcastQuickSlide}
        />
      ) : editingSongSlideIndex !== null && selectedSong && onSaveSongSlides && onCancelEditSongSlides ? (
        <SongSlideEditor
          song={selectedSong as any}
          editingSlideIndex={editingSongSlideIndex}
          displayMode={displayMode}
          currentSlideIndex={currentSlideIndex}
          liveSongId={liveSongId}
          isBlank={isBlank}
          getVerseTypeColor={getVerseTypeColor}
          onSave={onSaveSongSlides}
          onCancel={onCancelEditSongSlides}
          onSelectSlide={goToSlide}
        />
      ) : (
        <SlidesGrid
          selectedPresentation={selectedPresentation}
          selectedSong={selectedSong}
          displayMode={displayMode}
          currentSlideIndex={currentSlideIndex}
          liveSongId={liveSongId}
          liveSlideIndex={liveSlideIndex}
          isBlank={isBlank}
          autoPlayActive={autoPlayActive}
          autoPlayInterval={autoPlayInterval}
          currentPresentationSlideIndex={currentPresentationSlideIndex}
          combinedSlidesData={combinedSlidesData}
          selectedCombinedIndex={selectedCombinedIndex}
          getVerseTypeColor={getVerseTypeColor}
          onAutoPlayToggle={handleAutoPlayToggle}
          onAutoPlayIntervalChange={onSetAutoPlayInterval}
          onSelectPrayerSlide={handleSelectPrayerSlide}
          onSelectPresentationSlide={handleSelectPresentationSlide}
          onSelectSongSlide={goToSlide}
          onSelectCombinedSlide={selectCombinedSlide}
          onSlideCodeMapChange={onSlideCodeMapChange}
          onEditSlide={onEditSlide}
          onAddSlide={onAddSlide}
          arrangementState={arrangementState}
          showSlideCodes={contentType !== 'bible'}
        />
      )}
    </div>
  );
});

BottomRowPanel.displayName = 'BottomRowPanel';

export default BottomRowPanel;
