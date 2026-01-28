import React, { memo, startTransition, useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import VerseSectionNav from './VerseSectionNav';
import SlideControlButtons from './SlideControlButtons';
import SlidesGrid from './SlidesGrid';
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
  autoPlayActive: boolean;
  autoPlayInterval: number;
  currentPresentationSlideIndex: number;
  showBackgroundDropdown: boolean;
  selectedBackground: string;
  combinedSlidesData: { combinedSlides: CombinedSlide[]; originalToCombined: Map<number, number>; combinedToOriginal: Map<number, number[]> } | null;
  selectedCombinedIndex: number;
  quickSlideText: string;
  getVerseTypeColor: (verseType?: string) => string;
  selectSlide: (index: number) => void;
  toggleBlank: () => void;
  goToSlide: (index: number, combinedIndices?: number[]) => void;
  selectCombinedSlide: (combinedIndex: number) => void;
  sendPrayerPresentationSlide: (presentation: Presentation, slideIndex: number, mode: 'bilingual' | 'original' | 'translation') => void;
  updateQuickSlideCount: (text: string) => void;
  handleSetBackground: (value: string) => void;
  onQuickModeClick: () => void;
  isQuickModeActive: boolean;
  onSetDisplayMode: (mode: 'bilingual' | 'original' | 'translation') => void;
  onSetIsBlank: (blank: boolean) => void;
  onSetLiveState: (state: { slideData: any; contentType: any; songId: string | null; slideIndex: number }) => void;
  onSetShowBackgroundDropdown: (show: boolean) => void;
  onSetSelectedBackground: (bg: string) => void;
  onSetAutoPlayActive: (active: boolean, presentation: any) => void;
  onSetAutoPlayInterval: (interval: number) => void;
  onSetCurrentPresentationSlideIndex: (index: number) => void;
  onSlideCodeMapChange?: (codeMap: SlideCodeMap | null) => void;
  onEditSlide?: (index: number) => void;
  onAddSlide?: () => void;
  // Arrangement props
  arrangementState?: ArrangementStateReturn;
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
  autoPlayActive,
  autoPlayInterval,
  currentPresentationSlideIndex,
  showBackgroundDropdown,
  selectedBackground,
  combinedSlidesData,
  selectedCombinedIndex,
  quickSlideText,
  getVerseTypeColor,
  selectSlide,
  toggleBlank,
  goToSlide,
  selectCombinedSlide,
  sendPrayerPresentationSlide,
  updateQuickSlideCount,
  handleSetBackground,
  onQuickModeClick,
  isQuickModeActive,
  onSetDisplayMode,
  onSetIsBlank,
  onSetLiveState,
  onSetShowBackgroundDropdown,
  onSetSelectedBackground,
  onSetAutoPlayActive,
  onSetAutoPlayInterval,
  onSetCurrentPresentationSlideIndex,
  onSlideCodeMapChange,
  onEditSlide,
  onAddSlide,
  arrangementState
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

  // Stable callbacks for SlideControlButtons
  const handleToggleDisplayMode = useCallback(() => {
    const newMode = displayMode === 'bilingual' ? 'original' : 'bilingual';
    onSetDisplayMode(newMode);
    onSetIsBlank(true);
    onSetLiveState({ slideData: null, contentType: null, songId: null, slideIndex: 0 });
    window.electronAPI.sendBlank();
  }, [displayMode, onSetDisplayMode, onSetIsBlank, onSetLiveState]);

  const handleToggleBackgroundDropdown = useCallback(() => {
    onSetShowBackgroundDropdown(!showBackgroundDropdown);
  }, [onSetShowBackgroundDropdown, showBackgroundDropdown]);

  const handleSelectBackground = useCallback((value: string) => {
    onSetSelectedBackground(value);
    handleSetBackground(value);
    onSetShowBackgroundDropdown(false);
  }, [onSetSelectedBackground, handleSetBackground, onSetShowBackgroundDropdown]);

  const handleClearBackground = useCallback(() => {
    onSetSelectedBackground('');
    handleSetBackground('');
  }, [onSetSelectedBackground, handleSetBackground]);

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
          <span style={{ color: 'white', fontWeight: 600, fontSize: '0.9rem', flexShrink: 0 }}>{t('controlPanel.slidePreview')}</span>
          {selectedSong && (
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedSong.title} — {selectedSong.slides?.length ?? 0} slides
            </span>
          )}
        </div>

        {/* Verse Section Navigation Buttons - hidden for now */}

        {/* Arrangement Controls */}
        {selectedSong && arrangementState && (
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

            {/* Dropdown menu - appears below the button, anchored to the right */}
            {showArrDropdown && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
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

        {/* Control Buttons */}
        <SlideControlButtons
          isBlank={isBlank}
          displayMode={displayMode}
          showBackgroundDropdown={showBackgroundDropdown}
          selectedBackground={selectedBackground}
          isRTL={isRTL}
          isQuickModeActive={isQuickModeActive}
          onToggleBlank={toggleBlank}
          onQuickModeClick={onQuickModeClick}
          onToggleDisplayMode={handleToggleDisplayMode}
          onToggleBackgroundDropdown={handleToggleBackgroundDropdown}
          onSelectBackground={handleSelectBackground}
          onClearBackground={handleClearBackground}
        />
      </div>

      {/* Slides Grid */}
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
      />
    </div>
  );
});

BottomRowPanel.displayName = 'BottomRowPanel';

export default BottomRowPanel;
