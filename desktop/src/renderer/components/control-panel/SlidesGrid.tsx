import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import SlideGridItem from './SlideGridItem';
import CombinedSlideGridItem from './CombinedSlideGridItem';
import AutoPlayControls from './AutoPlayControls';
import PrayerSlideItem from './PrayerSlideItem';
import PresentationSlideItem from './PresentationSlideItem';

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

interface SlidesGridProps {
  selectedPresentation: Presentation | null;
  selectedSong: Song | null;
  displayMode: 'bilingual' | 'original' | 'translation';
  currentSlideIndex: number;
  liveSongId: string | null;
  liveSlideIndex: number;
  isBlank: boolean;
  autoPlayActive: boolean;
  autoPlayInterval: number;
  currentPresentationSlideIndex: number;
  combinedSlidesData: { combinedSlides: CombinedSlide[] } | null;
  selectedCombinedIndex: number;
  getVerseTypeColor: (verseType?: string) => string;
  onAutoPlayToggle: () => void;
  onAutoPlayIntervalChange: (interval: number) => void;
  onSelectPrayerSlide: (presentation: Presentation, index: number) => void;
  onSelectPresentationSlide: (presentation: Presentation, slide: any, index: number) => void;
  onSelectSongSlide: (index: number) => void;
  onSelectCombinedSlide: (combinedIndex: number) => void;
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
  gap: '8px',
  overflow: 'auto',
  flex: 1,
  alignContent: 'start'
};

const emptyStateStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'rgba(255,255,255,0.3)',
  fontSize: '0.9rem'
};

const SlidesGrid = memo<SlidesGridProps>(({
  selectedPresentation,
  selectedSong,
  displayMode,
  currentSlideIndex,
  liveSongId,
  liveSlideIndex,
  isBlank,
  autoPlayActive,
  autoPlayInterval,
  currentPresentationSlideIndex,
  combinedSlidesData,
  selectedCombinedIndex,
  getVerseTypeColor,
  onAutoPlayToggle,
  onAutoPlayIntervalChange,
  onSelectPrayerSlide,
  onSelectPresentationSlide,
  onSelectSongSlide,
  onSelectCombinedSlide
}) => {
  const { t } = useTranslation();

  // Presentation slides view
  if (selectedPresentation) {
    const isPrayerOrSermon = selectedPresentation.quickModeData?.type === 'prayer' ||
                              selectedPresentation.quickModeData?.type === 'sermon';

    return (
      <div style={gridStyle}>
        {isPrayerOrSermon ? (
          // Wizard presentations (prayer/sermon)
          selectedPresentation.quickModeData?.subtitles?.map((subtitle: any, idx: number) => (
            <PrayerSlideItem
              key={idx}
              subtitle={subtitle}
              index={idx}
              isSelected={liveSongId === selectedPresentation.id && liveSlideIndex === idx}
              onSelect={() => onSelectPrayerSlide(selectedPresentation, idx)}
            />
          ))
        ) : (
          // Free-form presentations
          <>
            {selectedPresentation.slides.length > 1 && (
              <AutoPlayControls
                isActive={autoPlayActive}
                interval={autoPlayInterval}
                currentSlideIndex={currentPresentationSlideIndex}
                totalSlides={selectedPresentation.slides.length}
                onToggle={onAutoPlayToggle}
                onIntervalChange={onAutoPlayIntervalChange}
              />
            )}
            {selectedPresentation.slides.map((slide, idx) => (
              <PresentationSlideItem
                key={slide.id}
                slide={slide}
                index={idx}
                isSelected={liveSongId === selectedPresentation.id && liveSlideIndex === idx}
                onSelect={() => onSelectPresentationSlide(selectedPresentation, slide, idx)}
              />
            ))}
          </>
        )}
      </div>
    );
  }

  // Song slides view
  if (selectedSong) {
    return (
      <div style={gridStyle}>
        {displayMode === 'original' && combinedSlidesData ? (
          // Combined slides view for original-only mode
          combinedSlidesData.combinedSlides.map((item, combinedIndex) => (
            <CombinedSlideGridItem
              key={combinedIndex}
              item={item}
              combinedIndex={combinedIndex}
              isSelected={selectedCombinedIndex === combinedIndex && !isBlank && liveSongId === selectedSong.id}
              bgColor={getVerseTypeColor(item.verseType || '')}
              onSelect={onSelectCombinedSlide}
            />
          ))
        ) : (
          // Regular single-slide view for bilingual mode
          selectedSong.slides.map((slide, idx) => (
            <SlideGridItem
              key={idx}
              slide={slide}
              index={idx}
              isSelected={idx === currentSlideIndex && !isBlank && liveSongId === selectedSong.id}
              displayMode={displayMode}
              bgColor={getVerseTypeColor(slide.verseType)}
              onSelect={onSelectSongSlide}
            />
          ))
        )}
      </div>
    );
  }

  // Empty state
  return (
    <div style={emptyStateStyle}>
      {t('controlPanel.selectSongOrPresentation')}
    </div>
  );
});

SlidesGrid.displayName = 'SlidesGrid';

export default SlidesGrid;
