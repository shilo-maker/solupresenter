import React, { memo, startTransition } from 'react';
import { useTranslation } from 'react-i18next';
import VerseSectionNav from './VerseSectionNav';
import SlideControlButtons from './SlideControlButtons';
import SlidesGrid from './SlidesGrid';

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
  onSetCurrentPresentationSlideIndex
}) => {
  const { t } = useTranslation();

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

        {/* Verse Section Navigation Buttons */}
        {selectedSong?.slides && (
          <VerseSectionNav
            slides={selectedSong.slides}
            currentSlideIndex={currentSlideIndex}
            onSelectSlide={selectSlide}
            getVerseTypeColor={getVerseTypeColor}
          />
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
          onToggleDisplayMode={() => {
            const newMode = displayMode === 'bilingual' ? 'original' : 'bilingual';
            onSetDisplayMode(newMode);
            onSetIsBlank(true);
            onSetLiveState({ slideData: null, contentType: null, songId: null, slideIndex: 0 });
            window.electronAPI.sendBlank();
          }}
          onToggleBackgroundDropdown={() => onSetShowBackgroundDropdown(!showBackgroundDropdown)}
          onSelectBackground={(value) => {
            onSetSelectedBackground(value);
            handleSetBackground(value);
            onSetShowBackgroundDropdown(false);
          }}
          onClearBackground={() => {
            onSetSelectedBackground('');
            handleSetBackground('');
          }}
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
        onAutoPlayToggle={() => {
          if (!autoPlayActive && selectedPresentation) {
            // Starting auto-play - pass the presentation
            onSetAutoPlayActive(true, selectedPresentation);
          } else {
            // Stopping auto-play
            onSetAutoPlayActive(false, null);
          }
        }}
        onAutoPlayIntervalChange={onSetAutoPlayInterval}
        onSelectPrayerSlide={(presentation, idx) => {
          onSetIsBlank(false);
          sendPrayerPresentationSlide(presentation, idx, displayMode);
          startTransition(() => {
            onSetCurrentPresentationSlideIndex(idx);
          });
        }}
        onSelectPresentationSlide={(presentation, slide, idx) => {
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
        }}
        onSelectSongSlide={goToSlide}
        onSelectCombinedSlide={selectCombinedSlide}
      />
    </div>
  );
});

BottomRowPanel.displayName = 'BottomRowPanel';

export default BottomRowPanel;
