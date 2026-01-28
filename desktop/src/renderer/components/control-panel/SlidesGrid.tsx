import React, { memo, useMemo, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import SlideGridItem from './SlideGridItem';
import CombinedSlideGridItem from './CombinedSlideGridItem';
import AutoPlayControls from './AutoPlayControls';
import PrayerSlideItem from './PrayerSlideItem';
import PresentationSlideItem from './PresentationSlideItem';
import ArrangementEditor from './ArrangementEditor';
import { generateSlideCodes, SlideCodeMap } from '../../utils/slideCodeUtils';
import { ArrangementStateReturn } from '../../hooks/useArrangementState';
import { getSectionRanges } from '../../utils/arrangementUtils';

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
  onSlideCodeMapChange?: (codeMap: SlideCodeMap | null) => void;
  onEditSlide?: (index: number) => void;
  onAddSlide?: () => void;
  // Arrangement props
  arrangementState?: ArrangementStateReturn;
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
  onSelectCombinedSlide,
  onSlideCodeMapChange,
  onEditSlide,
  onAddSlide,
  arrangementState
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';
  const isArrangementMode = arrangementState?.isArrangementMode ?? false;
  const activeArrangement = arrangementState?.activeArrangement;

  // Auto-scroll to selected slide in arrangement view
  const arrangementContainerRef = useRef<HTMLDivElement>(null);
  const arrangementFlatIndex = arrangementState?.flatSlideIndex ?? -1;

  useEffect(() => {
    if (arrangementFlatIndex < 0 || !arrangementContainerRef.current || !activeArrangement || isArrangementMode) return;
    const el = arrangementContainerRef.current.querySelector(
      `[data-flat-index="${arrangementFlatIndex}"]`
    ) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [arrangementFlatIndex, activeArrangement, isArrangementMode]);

  // Generate slide codes for the current song
  const slideCodeMap = useMemo(() => {
    if (!selectedSong?.slides) return null;
    return generateSlideCodes(selectedSong.slides);
  }, [selectedSong?.slides]);

  // Build arranged slides grouped by section when arrangement is active
  const arrangedSections = useMemo(() => {
    if (!activeArrangement || !selectedSong?.slides || isArrangementMode) {
      return null;
    }

    const ranges = getSectionRanges(selectedSong.slides);
    const sections: Array<{
      sectionIndex: number;
      sectionName: string;
      slides: Array<{
        slide: typeof selectedSong.slides[0];
        originalIndex: number;
        flatIndex: number;
        slideInSection: number;
      }>;
    }> = [];

    let flatIndex = 0;
    activeArrangement.sections.forEach((section, sectionIndex) => {
      const range = ranges.get(section.verseType);
      if (range) {
        const sectionSlides: typeof sections[0]['slides'] = [];
        for (let i = range.start; i <= range.end; i++) {
          sectionSlides.push({
            slide: selectedSong.slides[i],
            originalIndex: i,
            flatIndex,
            slideInSection: i - range.start
          });
          flatIndex++;
        }
        sections.push({
          sectionIndex,
          sectionName: section.verseType,
          slides: sectionSlides
        });
      }
    });

    return sections;
  }, [activeArrangement, selectedSong?.slides, isArrangementMode]);

  // Handle clicking on an arranged slide
  const handleArrangedSlideSelect = useCallback((flatIndex: number) => {
    if (arrangementState) {
      arrangementState.goToFlatSlideIndex(flatIndex);
    }
  }, [arrangementState]);

  // Build a flat-index-to-original-index map for arranged slides edit callback
  const flatToOriginalMap = useMemo(() => {
    if (!arrangedSections) return null;
    const map = new Map<number, number>();
    for (const section of arrangedSections) {
      for (const item of section.slides) {
        map.set(item.flatIndex, item.originalIndex);
      }
    }
    return map;
  }, [arrangedSections]);

  // Stable edit callback for arranged slides - maps flatIndex back to originalIndex
  const handleArrangedSlideEdit = useCallback((flatIndex: number) => {
    if (!onEditSlide || !flatToOriginalMap) return;
    const originalIndex = flatToOriginalMap.get(flatIndex);
    if (originalIndex !== undefined) {
      onEditSlide(originalIndex);
    }
  }, [onEditSlide, flatToOriginalMap]);

  // Track previous code map to avoid unnecessary callbacks
  const prevCodeMapRef = useRef<SlideCodeMap | null>(null);
  const onSlideCodeMapChangeRef = useRef(onSlideCodeMapChange);
  onSlideCodeMapChangeRef.current = onSlideCodeMapChange;

  // Notify parent of code map changes - only when actually changed
  useEffect(() => {
    if (slideCodeMap !== prevCodeMapRef.current) {
      prevCodeMapRef.current = slideCodeMap;
      onSlideCodeMapChangeRef.current?.(slideCodeMap);
    }
  }, [slideCodeMap]);

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
    // Show arrangement editor if in arrangement mode
    if (isArrangementMode && arrangementState) {
      return (
        <ArrangementEditor
          arrangementState={arrangementState}
          getVerseTypeColor={getVerseTypeColor}
        />
      );
    }

    // Arrangement view - sections flow inline with arrows between them
    if (arrangedSections) {
      return (
        <div ref={arrangementContainerRef} style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          gap: '8px',
          overflow: 'auto',
          flex: 1,
          alignContent: 'start'
        }}>
          {arrangedSections.map((section, secIdx) => (
            <React.Fragment key={`${section.sectionIndex}`}>
              {/* Arrow between sections */}
              {secIdx > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  alignSelf: 'stretch',
                  padding: '0 2px'
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              )}
              {/* Section group: header + slides */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {/* Section header - only spans this section's slides */}
                <div style={{
                  padding: '3px 8px',
                  backgroundColor: getVerseTypeColor(section.sectionName),
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  color: 'white',
                  opacity: 0.9,
                  textAlign: 'center'
                }}>
                  {section.sectionName}
                </div>
                {/* Slides in this section */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {section.slides.map(item => (
                    <div key={`${section.sectionIndex}-${item.slideInSection}`} data-flat-index={item.flatIndex} style={{ width: '200px', flexShrink: 0 }}>
                      <SlideGridItem
                        slide={item.slide}
                        index={item.flatIndex}
                        isSelected={item.flatIndex === arrangementState?.flatSlideIndex && !isBlank && liveSongId === selectedSong.id}
                        displayMode={displayMode}
                        bgColor={getVerseTypeColor(item.slide.verseType)}
                        onSelect={handleArrangedSlideSelect}
                        onEdit={onEditSlide ? handleArrangedSlideEdit : undefined}
                        slideCode={slideCodeMap?.codes[item.originalIndex]?.code}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>
      );
    }

    return (
      <div style={gridStyle}>
        {displayMode === 'original' && combinedSlidesData ? (
          // Combined slides view for original-only mode
          combinedSlidesData.combinedSlides.map((item, combinedIndex) => {
            // For combined mode, we need to map back to original indices to get the code
            const originalIndex = item.originalIndices?.[0] ?? combinedIndex;
            const slideCode = slideCodeMap?.codes[originalIndex]?.code;
            return (
              <CombinedSlideGridItem
                key={combinedIndex}
                item={item}
                combinedIndex={combinedIndex}
                isSelected={selectedCombinedIndex === combinedIndex && !isBlank && liveSongId === selectedSong.id}
                bgColor={getVerseTypeColor(item.verseType || '')}
                onSelect={onSelectCombinedSlide}
                slideCode={slideCode}
              />
            );
          })
        ) : (
          // Regular single-slide view (no arrangement)
          <>
            {selectedSong.slides.map((slide, idx) => (
              <SlideGridItem
                key={idx}
                slide={slide}
                index={idx}
                isSelected={idx === currentSlideIndex && !isBlank && liveSongId === selectedSong.id}
                displayMode={displayMode}
                bgColor={getVerseTypeColor(slide.verseType)}
                onSelect={onSelectSongSlide}
                onEdit={onEditSlide}
                slideCode={slideCodeMap?.codes[idx]?.code}
              />
            ))}
            {/* Add Slide card */}
            {onAddSlide && (
              <div
                onClick={onAddSlide}
                style={{
                  border: '2px dashed rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  cursor: 'pointer',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '80px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                }}
                title="Add new slide"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
            )}
          </>
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
