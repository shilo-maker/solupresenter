import React, { memo, useRef, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import SlidePreview from '../SlidePreview';
import SlideControlButtons from './SlideControlButtons';

interface Display {
  id: number;
  bounds: { width: number; height: number };
  assignedType?: 'viewer' | 'stage';
}

interface ActiveMedia {
  type: 'image' | 'video';
  url: string;
}

interface ActiveYoutubeVideo {
  videoId: string;
  title: string;
  thumbnail: string;
}

interface CurrentSlide {
  verseType?: string;
  originalText?: string;
  [key: string]: any;
}

interface VideoStatus {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}

interface LivePreviewPanelProps {
  displays: Display[];
  selectedSong: { title: string; slides?: any[] } | null;
  currentSlide: CurrentSlide | null;
  isBlank: boolean;
  activeMedia: ActiveMedia | null;
  youtubeOnDisplay: boolean;
  activeYoutubeVideo: ActiveYoutubeVideo | null;
  selectedPresentation: any | null;
  selectedYoutubeItemId: string | null;
  currentContentType: 'song' | 'bible' | 'prayer' | 'presentation';
  onlineConnected: boolean;
  displayMode: 'bilingual' | 'original' | 'translation';
  selectedBackground: string;
  liveSlideData: any;
  memoizedLivePreviewTheme: any;
  memoizedTools: any;
  memoizedPresentationSlide: any;
  combinedSlidesData: any;
  selectedCombinedIndex: number;
  youtubeContainerRef: React.RefObject<HTMLDivElement>;
  previewVideoRef: React.RefObject<HTMLVideoElement>;
  getVerseTypeColor: (verseType?: string) => string;
  onYoutubeStop: () => void;
  onClearMedia: () => void;
  onVideoTimeUpdate: (currentTime: number, duration: number) => void;
  onVideoPlay: () => void;
  onVideoPause: () => void;
  onVideoSeeked: (currentTime: number) => void;
  // SlideControlButtons props
  showBackgroundDropdown: boolean;
  isRTL: boolean;
  onToggleBlank: () => void;
  onToggleDisplayMode: () => void;
  onToggleBackgroundDropdown: () => void;
  onSelectBackground: (value: string) => void;
  onClearBackground: () => void;
}

const TIME_UPDATE_THROTTLE_MS = 250;

const LivePreviewPanel = memo<LivePreviewPanelProps>(({
  displays,
  selectedSong,
  currentSlide,
  isBlank,
  activeMedia,
  youtubeOnDisplay,
  activeYoutubeVideo,
  selectedPresentation,
  selectedYoutubeItemId,
  currentContentType,
  onlineConnected,
  displayMode,
  selectedBackground,
  liveSlideData,
  memoizedLivePreviewTheme,
  memoizedTools,
  memoizedPresentationSlide,
  combinedSlidesData,
  selectedCombinedIndex,
  youtubeContainerRef,
  previewVideoRef,
  getVerseTypeColor,
  onYoutubeStop,
  onClearMedia,
  onVideoTimeUpdate,
  onVideoPlay,
  onVideoPause,
  onVideoSeeked,
  // SlideControlButtons props
  showBackgroundDropdown,
  isRTL,
  onToggleBlank,
  onToggleDisplayMode,
  onToggleBackgroundDropdown,
  onSelectBackground,
  onClearBackground
}) => {
  const { t } = useTranslation();
  const lastVideoTimeUpdateRef = useRef<number>(0);
  const glowStyleRef = useRef<HTMLStyleElement | null>(null);

  // Capture rendered HTML from SlideRenderer and send to main process for virtual displays
  const handleHtmlCapture = useCallback((html: string, refWidth: number, refHeight: number) => {
    window.electronAPI.reportRenderedHtml(html, refWidth, refHeight);
  }, []);

  // Inject glow animation keyframes once
  useEffect(() => {
    if (!glowStyleRef.current) {
      const style = document.createElement('style');
      style.textContent = `
        @keyframes glowRotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
      glowStyleRef.current = style;
    }
    return () => {
      if (glowStyleRef.current) {
        document.head.removeChild(glowStyleRef.current);
        glowStyleRef.current = null;
      }
    };
  }, []);

  // Calculate aspect ratio from viewer display
  const viewerDisplay = displays.find(d => d.assignedType === 'viewer');
  const arWidth = viewerDisplay ? viewerDisplay.bounds.width : 16;
  const arHeight = viewerDisplay ? viewerDisplay.bounds.height : 9;
  const aspectRatio = `${arWidth} / ${arHeight}`;

  // Get status text and color - memoized to avoid recalculation on every render
  const statusInfo = useMemo(() => {
    if (isBlank) return { text: 'BLANK', color: '#dc3545' };
    if (activeMedia) return { text: 'MEDIA', color: '#06b6d4' };
    if (youtubeOnDisplay || selectedYoutubeItemId) return { text: 'YOUTUBE', color: '#FF0000' };
    if (selectedPresentation) return { text: 'PRESENTATION', color: '#28a745' };
    if (currentSlide) {
      const text = currentContentType === 'song' ? 'SONG' : currentContentType === 'bible' ? 'BIBLE' : 'CONTENT';
      return { text, color: '#28a745' };
    }
    return { text: onlineConnected ? 'ONLINE' : 'NO CONTENT', color: onlineConnected ? '#28a745' : '#6c757d' };
  }, [isBlank, activeMedia, youtubeOnDisplay, selectedYoutubeItemId, selectedPresentation, currentSlide, currentContentType, onlineConnected]);

  // Combined slides calculation - memoized to avoid recalculation on every render
  const combinedSlides = useMemo(() => {
    if (displayMode !== 'original' || !combinedSlidesData) return undefined;
    const currentCombined = combinedSlidesData.combinedSlides[selectedCombinedIndex];
    if (!currentCombined || !('originalIndices' in currentCombined) || !Array.isArray(currentCombined.originalIndices) || currentCombined.originalIndices.length <= 1) {
      return undefined;
    }
    // Return all slides in the combined group (SlideRenderer uses only combinedSlides when present)
    return currentCombined.originalIndices.map((idx: number) => {
      const slide = selectedSong?.slides?.[idx];
      return slide ? { originalText: slide.originalText || '' } : null;
    }).filter((s: any): s is { originalText: string } => s !== null);
  }, [displayMode, combinedSlidesData, selectedCombinedIndex, selectedSong?.slides]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', overflow: 'hidden', minWidth: 0 }}>
      {/* Main Preview Screen */}
      <div style={{ flex: 1, padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, overflow: 'hidden', containerType: 'size' } as React.CSSProperties}>
        {(() => {
          const rawColor = isBlank ? '#dc3545' : (getVerseTypeColor(currentSlide?.verseType) || '');
          const glowColor = (rawColor && rawColor !== 'transparent') ? rawColor : '#aaaaaa';
          return (
        <div style={{
          width: `min(100%, calc(100cqh * ${arWidth} / ${arHeight}))`,
          height: `min(100%, calc(100cqw * ${arHeight} / ${arWidth}))`,
          aspectRatio,
          borderRadius: '10px',
          position: 'relative',
          overflow: 'hidden',
          padding: '3px',
          boxShadow: `0 0 15px ${glowColor}44, 0 0 30px ${glowColor}22`
        }}>
          {/* Animated rotating gradient border */}
          <div style={{
            position: 'absolute',
            top: '-50%',
            left: '-50%',
            width: '200%',
            height: '200%',
            background: `conic-gradient(from 0deg, ${glowColor}, ${glowColor}33, ${glowColor}, ${glowColor}33, ${glowColor})`,
            animation: 'glowRotate 3s linear infinite',
            zIndex: 0
          }} />
          <div
            style={{
              width: '100%',
              height: '100%',
              background: '#000',
              borderRadius: '7px',
              position: 'relative',
              overflow: 'hidden',
              zIndex: 1
            }}
          >
          {/* Status indicator */}
          <div style={{
            position: 'absolute',
            top: '8px',
            right: '10px',
            background: statusInfo.color,
            color: 'black',
            fontSize: '10px',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '4px',
            letterSpacing: '1px',
            zIndex: 10
          }}>
            {statusInfo.text}
          </div>

          {/* YouTube container - ALWAYS rendered to avoid DOM conflicts, shown/hidden via zIndex */}
          <div
            ref={youtubeContainerRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: '#000',
              zIndex: youtubeOnDisplay && activeYoutubeVideo ? 5 : -1,
              opacity: youtubeOnDisplay && activeYoutubeVideo ? 1 : 0,
              pointerEvents: youtubeOnDisplay && activeYoutubeVideo ? 'auto' : 'none'
            }}
          />
          {/* YouTube overlay controls - only shown when YouTube is active */}
          {youtubeOnDisplay && activeYoutubeVideo && (
            <>
              <div style={{
                position: 'absolute',
                top: '8px',
                left: '10px',
                background: '#FF0000',
                color: 'black',
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '4px',
                letterSpacing: '1px',
                zIndex: 10
              }}>
                YOUTUBE
              </div>
              <button
                onClick={onYoutubeStop}
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  background: 'rgba(220, 53, 69, 0.9)',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'black',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  zIndex: 10
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
                Stop
              </button>
            </>
          )}
          {/* Media display - shown when not YouTube */}
          {!youtubeOnDisplay && activeMedia ? (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#000',
              direction: 'ltr'
            }}>
              {activeMedia.type === 'image' ? (
                <img
                  src={activeMedia.url}
                  alt="Media"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain'
                  }}
                />
              ) : (
                <video
                  ref={previewVideoRef}
                  src={activeMedia.url}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain'
                  }}
                  muted
                  controls
                  onTimeUpdate={(e) => {
                    const video = e.currentTarget;
                    const now = Date.now();
                    if (now - lastVideoTimeUpdateRef.current >= TIME_UPDATE_THROTTLE_MS) {
                      lastVideoTimeUpdateRef.current = now;
                      onVideoTimeUpdate(video.currentTime, video.duration || 0);
                    }
                  }}
                  onPlay={onVideoPlay}
                  onPause={onVideoPause}
                  onSeeked={(e) => onVideoSeeked(e.currentTarget.currentTime)}
                />
              )}
              <button
                onClick={onClearMedia}
                style={{
                  position: 'absolute',
                  top: '12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  background: 'rgba(220, 53, 69, 0.9)',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'black',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  zIndex: 20
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
                Clear Media
              </button>
            </div>
          ) : !youtubeOnDisplay ? (
            <SlidePreview
              slideData={liveSlideData}
              displayMode={displayMode}
              isBlank={isBlank}
              backgroundImage={selectedBackground}
              theme={memoizedLivePreviewTheme}
              tools={memoizedTools}
              activeMedia={null}
              showBadge={false}
              presentationSlide={memoizedPresentationSlide}
              combinedSlides={combinedSlides}
              onHtmlCapture={handleHtmlCapture}
            />
          ) : null}
          </div>
        </div>
          );
        })()}
      </div>

      {/* Live Preview Footer (was Header) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,0.1)', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: 'white', fontWeight: 600 }}>{t('controlPanel.livePreview')}</span>
          {selectedSong && (
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>
              — {selectedSong.title}
            </span>
          )}
          {currentSlide?.verseType && (
            <span style={{ fontSize: '0.65rem', padding: '2px 8px', background: getVerseTypeColor(currentSlide.verseType), borderRadius: '10px', color: 'black', fontWeight: 600 }}>{currentSlide.verseType}</span>
          )}
        </div>
        <SlideControlButtons
          isBlank={isBlank}
          displayMode={displayMode}
          showBackgroundDropdown={showBackgroundDropdown}
          selectedBackground={selectedBackground}
          isRTL={isRTL}
          onToggleBlank={onToggleBlank}
          onToggleDisplayMode={onToggleDisplayMode}
          onToggleBackgroundDropdown={onToggleBackgroundDropdown}
          onSelectBackground={onSelectBackground}
          onClearBackground={onClearBackground}
        />
      </div>
    </div>
  );
});

LivePreviewPanel.displayName = 'LivePreviewPanel';

export default LivePreviewPanel;
