import React, { memo, useRef, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SlidePreview from '../SlidePreview';
import SlideControlButtons from './SlideControlButtons';
import { DisplayAssignedType, isViewerLike, DISPLAY_TYPE_BADGE_COLORS } from './panels/types';
import { resolveTranslation } from '../../utils/translationUtils';
import { useSettings } from '../../contexts/SettingsContext';

interface Display {
  id: number;
  bounds: { width: number; height: number };
  assignedType?: DisplayAssignedType;
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

interface AssignedDisplay {
  id: number;
  label: string;
  bounds: { width: number; height: number };
  assignedType?: DisplayAssignedType;
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
  videoLoop: boolean;
  onToggleVideoLoop: () => void;
  onVideoTimeUpdate: (currentTime: number, duration: number) => void;
  onVideoPlay: () => void;
  onVideoPause: () => void;
  onVideoSeeked: (currentTime: number) => void;
  onVideoEnded: () => void;
  // SlideControlButtons props
  showBackgroundDropdown: boolean;
  isRTL: boolean;
  customModeActive: boolean;
  onToggleBlank: () => void;
  onSetDisplayMode: (mode: 'bilingual' | 'original' | 'custom') => void;
  onOpenCustomConfig: () => void;
  onToggleBackgroundDropdown: () => void;
  onSelectBackground: (value: string) => void;
  onClearBackground: () => void;
  // Per-item background toggle
  hasItemBackground?: boolean;
  itemBackgroundMuted?: boolean;
  onToggleItemBackground?: () => void;
  // Display preview selector props
  assignedDisplays: AssignedDisplay[];
  isStreaming: boolean;
  themes: any[];
  bibleThemes: any[];
  prayerThemes: any[];
  stageMonitorThemes: any[];
  liveContentType: 'song' | 'bible' | 'prayer' | 'presentation' | null;
  selectedStageTheme: any;
  obsThemes: any[];
}

const TIME_UPDATE_THROTTLE_MS = 250;
const STREAMING_DISPLAY_ID = -9999;

// ── Hoisted static styles (never recreated) ──

const mediaOverlayButtonsStyle: React.CSSProperties = {
  position: 'absolute',
  top: '12px',
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  zIndex: 20
};

const clearMediaButtonStyle: React.CSSProperties = {
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
  boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
};

const loopButtonBaseStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '8px 12px',
  border: 'none',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
};

const loopButtonOnStyle: React.CSSProperties = {
  ...loopButtonBaseStyle,
  background: 'rgba(40, 167, 69, 0.9)',
  color: 'black'
};

const loopButtonOffStyle: React.CSSProperties = {
  ...loopButtonBaseStyle,
  background: 'rgba(108, 117, 125, 0.7)',
  color: 'rgba(255,255,255,0.8)'
};

const selectorDropdownStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '100%',
  right: 0,
  marginBottom: '4px',
  background: '#1e1e2e',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '8px',
  boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
  minWidth: '160px',
  zIndex: 100,
  overflow: 'hidden'
};

const dpsOptionBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  width: '100%',
  padding: '8px 12px',
  border: 'none',
  fontSize: '0.8rem',
  cursor: 'pointer',
  textAlign: 'left'
};

const dpsOptionDefault: React.CSSProperties = {
  ...dpsOptionBase,
  background: 'transparent',
  color: 'rgba(255,255,255,0.8)',
  fontWeight: 400
};

const dpsOptionActive: React.CSSProperties = {
  ...dpsOptionBase,
  background: 'rgba(6, 182, 212, 0.15)',
  color: '#06b6d4',
  fontWeight: 600
};

const dpsBadgeStyle: React.CSSProperties = {
  fontSize: '0.6rem',
  padding: '1px 6px',
  borderRadius: '3px',
  color: 'black',
  fontWeight: 600,
  flexShrink: 0
};

const dpsLabelOverflowStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
};

const monitorIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const monitorIconSmall = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const dropdownArrowIcon = (
  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

// ── Component ──

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
  videoLoop,
  onToggleVideoLoop,
  onVideoTimeUpdate,
  onVideoPlay,
  onVideoPause,
  onVideoSeeked,
  onVideoEnded,
  // SlideControlButtons props
  showBackgroundDropdown,
  isRTL,
  customModeActive,
  onToggleBlank,
  onSetDisplayMode,
  onOpenCustomConfig,
  onToggleBackgroundDropdown,
  onSelectBackground,
  onClearBackground,
  hasItemBackground,
  itemBackgroundMuted,
  onToggleItemBackground,
  assignedDisplays,
  isStreaming,
  themes,
  bibleThemes,
  prayerThemes,
  stageMonitorThemes,
  liveContentType,
  selectedStageTheme,
  obsThemes
}) => {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const lastVideoTimeUpdateRef = useRef<number>(0);

  // Display preview selector state
  const [previewDisplayId, setPreviewDisplayId] = useState<number | null>(null); // null = global/all
  const [showDisplaySelector, setShowDisplaySelector] = useState(false);
  const [displayOverrides, setDisplayOverrides] = useState<Record<string, string> | null>(null);
  const selectorRef = useRef<HTMLDivElement>(null);

  // Capture rendered HTML from SlideRenderer and send to main process for virtual displays
  const handleHtmlCapture = useCallback((html: string, refWidth: number, refHeight: number) => {
    window.electronAPI.reportRenderedHtml(html, refWidth, refHeight);
  }, []);

  // Load display theme overrides when a specific display is selected
  useEffect(() => {
    if (previewDisplayId === null) {
      setDisplayOverrides(null);
      return;
    }
    let cancelled = false;
    window.electronAPI.displayThemeOverrides.getForDisplay(previewDisplayId).then((overrides: any) => {
      if (cancelled) return;
      // getForDisplay returns an array of { themeType, themeId, ... } records — convert to lookup
      const lookup: Record<string, string> = {};
      if (Array.isArray(overrides)) {
        for (const o of overrides) {
          if (o.themeType && o.themeId) {
            lookup[o.themeType] = o.themeId;
          }
        }
      }
      setDisplayOverrides(lookup);
    }).catch(() => {
      if (!cancelled) setDisplayOverrides({});
    });
    return () => { cancelled = true; };
  }, [previewDisplayId]);

  // Auto-reset when selected display disconnects or streaming stops
  useEffect(() => {
    if (previewDisplayId === null) return;
    if (previewDisplayId === STREAMING_DISPLAY_ID && !isStreaming) {
      setPreviewDisplayId(null);
      setDisplayOverrides(null);
      return;
    }
    if (previewDisplayId !== STREAMING_DISPLAY_ID && !assignedDisplays.some(d => d.id === previewDisplayId)) {
      setPreviewDisplayId(null);
      setDisplayOverrides(null);
    }
  }, [previewDisplayId, assignedDisplays, isStreaming]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!showDisplaySelector) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setShowDisplaySelector(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDisplaySelector]);

  // Consolidated lookup: find the selected assigned display once, derive type + label + bounds
  const selectedAssigned = useMemo(() => {
    if (previewDisplayId === null || previewDisplayId === STREAMING_DISPLAY_ID) return null;
    return assignedDisplays.find(d => d.id === previewDisplayId) || null;
  }, [previewDisplayId, assignedDisplays]);

  const selectedDisplayType = selectedAssigned?.assignedType;

  // Resolve the preview theme based on selected display's overrides
  const resolvedPreviewTheme = useMemo(() => {
    if (previewDisplayId === null || !displayOverrides) return memoizedLivePreviewTheme;

    // For stage displays, use stage override; for viewer-like, pick by content type
    let overrideThemeId: string | undefined;
    let searchArray: any[];
    let obsType: string | null = null; // OBS theme type to search as fallback

    if (selectedDisplayType === 'stage') {
      overrideThemeId = displayOverrides.stage;
      searchArray = stageMonitorThemes;
    } else if (liveContentType === 'bible') {
      overrideThemeId = displayOverrides.bible;
      searchArray = bibleThemes;
      obsType = 'bible';
    } else if (liveContentType === 'prayer') {
      overrideThemeId = displayOverrides.prayer;
      searchArray = prayerThemes;
      obsType = 'prayer';
    } else {
      overrideThemeId = displayOverrides.viewer;
      searchArray = themes;
      obsType = 'songs';
    }

    // When no override exists, stage displays fall back to global stage theme, others to global viewer theme
    const fallbackTheme = selectedDisplayType === 'stage' ? (selectedStageTheme || memoizedLivePreviewTheme) : memoizedLivePreviewTheme;

    if (!overrideThemeId) return fallbackTheme;

    // Search in type-specific array first, then fall back to OBS themes
    const found = searchArray.find((th: any) => th.id === overrideThemeId);
    if (found) return found;

    // OBS themes are stored in a separate table — search there too
    if (obsType && obsThemes.length > 0) {
      const obsFound = obsThemes.find((th: any) => th.id === overrideThemeId && th.type === obsType);
      if (obsFound) return obsFound;
    }

    return fallbackTheme;
  }, [previewDisplayId, displayOverrides, liveContentType, selectedDisplayType, memoizedLivePreviewTheme, selectedStageTheme, themes, bibleThemes, prayerThemes, stageMonitorThemes, obsThemes]);

  // Is the streaming (livestream) display selected for preview?
  const isStreamingPreview = previewDisplayId === STREAMING_DISPLAY_ID;

  // Memoize aspect ratio — selectedAssigned already memoized above
  // Streaming display is always 16:9 (standard streaming resolution)
  const { arWidth, arHeight, aspectRatio } = useMemo(() => {
    if (isStreamingPreview) return { arWidth: 16, arHeight: 9, aspectRatio: '16 / 9' };
    const arDisplay = selectedAssigned || displays.find(d => isViewerLike(d.assignedType));
    const w = arDisplay ? arDisplay.bounds.width : 16;
    const h = arDisplay ? arDisplay.bounds.height : 9;
    return { arWidth: w, arHeight: h, aspectRatio: `${w} / ${h}` };
  }, [isStreamingPreview, selectedAssigned, displays]);

  // The streaming display has a transparent background (for OBS overlay compositing).
  // Override the background so the preview matches what's actually sent to the stream.
  const previewBackground = isStreamingPreview ? 'transparent' : selectedBackground;

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

  // Stage preview: derive next slide for "Next" area
  const nextStageSlide = useMemo(() => {
    if (selectedDisplayType !== 'stage' || !selectedSong?.slides || !liveSlideData) return null;
    const idx = selectedSong.slides.findIndex(
      (s: any) => s.originalText === liveSlideData.originalText
    );
    if (idx < 0 || idx >= selectedSong.slides.length - 1) return null;
    const nextRaw = selectedSong.slides[idx + 1];
    const resolved = resolveTranslation(nextRaw, settings.translationLanguage);
    return { ...nextRaw, translation: resolved.translation, translationOverflow: resolved.translationOverflow };
  }, [selectedDisplayType, selectedSong?.slides, liveSlideData, settings.translationLanguage]);

  // Stage preview: parse theme data (may be JSON strings from DB)
  const stageThemeParsed = useMemo(() => {
    if (selectedDisplayType !== 'stage') return null;
    const st = resolvedPreviewTheme;
    if (!st) return null;
    const colors = typeof st.colors === 'string' ? JSON.parse(st.colors) : st.colors;
    const elements = typeof st.elements === 'string' ? JSON.parse(st.elements) : st.elements;
    const currentSlideText = typeof st.currentSlideText === 'string' ? JSON.parse(st.currentSlideText) : st.currentSlideText;
    const nextSlideText = typeof st.nextSlideText === 'string' ? JSON.parse(st.nextSlideText) : (st.nextSlideText || null);
    return { colors, elements, currentSlideText, nextSlideText };
  }, [selectedDisplayType, resolvedPreviewTheme]);

  // Selector button label — derived from memoized selectedAssigned
  const selectorLabel = previewDisplayId === null
    ? t('controlPanel.allDisplays', 'All')
    : previewDisplayId === STREAMING_DISPLAY_ID
      ? t('controlPanel.livestream', 'Livestream')
      : selectedAssigned?.label || `#${previewDisplayId}`;

  // Display selector callbacks (stable via useCallback)
  const handleSelectAll = useCallback(() => {
    setPreviewDisplayId(null);
    setShowDisplaySelector(false);
  }, []);

  const handleSelectLivestream = useCallback(() => {
    setPreviewDisplayId(STREAMING_DISPLAY_ID);
    setShowDisplaySelector(false);
  }, []);

  const handleToggleDropdown = useCallback(() => {
    setShowDisplaySelector(prev => !prev);
  }, []);

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
          {/* Stage monitor preview - mirrors DisplayStage.tsx exactly (cqw = vw equivalent) */}
          {selectedDisplayType === 'stage' && stageThemeParsed ? (() => {
            const { colors: stColors, elements: stEl, currentSlideText: stCurText, nextSlideText: stNextText } = stageThemeParsed;
            const header = stEl?.header;
            const clock = stEl?.clock;
            const songTitleEl = stEl?.songTitle;
            const curArea = stEl?.currentSlideArea || stEl?.currentSlide;
            const nxtArea = stEl?.nextSlideArea || stEl?.nextSlide;

            // Flow position helper — mirrors getEffectivePosition in DisplayStage.tsx
            const getPos = (
              textStyle: any, allStyles: any,
              lineType: 'original' | 'transliteration' | 'translation',
              visited = new Set<string>()
            ): { x: number; y: number; width: number; height: number } => {
              const defaults: Record<string, { x: number; y: number; width: number; height: number }> = {
                original: { x: 5, y: 20, width: 58, height: 15 },
                transliteration: { x: 5, y: 40, width: 58, height: 12 },
                translation: { x: 5, y: 55, width: 58, height: 12 }
              };
              const d = defaults[lineType];
              if (!textStyle || visited.has(lineType)) {
                return { x: textStyle?.x ?? d.x, y: textStyle?.y ?? d.y, width: textStyle?.width ?? d.width, height: textStyle?.height ?? d.height };
              }
              visited.add(lineType);
              const h = textStyle.height ?? d.height;
              if (textStyle.positionMode !== 'flow') {
                return { x: textStyle.x ?? d.x, y: textStyle.y ?? d.y, width: textStyle.width ?? d.width, height: h };
              }
              let rawAnchor = textStyle.flowAnchor;
              if (rawAnchor?.startsWith('next')) rawAnchor = rawAnchor.charAt(4).toLowerCase() + rawAnchor.slice(5);
              const anchor = rawAnchor as 'original' | 'transliteration' | 'translation' | undefined;
              const gap = textStyle.flowGap ?? 1;
              let y = textStyle.y ?? d.y;
              if (anchor && allStyles[anchor]) {
                const anchorPos = getPos(allStyles[anchor], allStyles, anchor, new Set(visited));
                y = textStyle.flowBeside ? anchorPos.y : anchorPos.y + anchorPos.height + gap;
              }
              return { x: textStyle.x ?? d.x, y, width: textStyle.width ?? d.width, height: h };
            };

            // Text shadow helper — mirrors buildStageTextShadow
            const shadow = (s: any) => {
              if (!s?.textShadowColor && s?.textShadowBlur === undefined && s?.textShadowOffsetX === undefined && s?.textShadowOffsetY === undefined) {
                return '2px 2px 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.5)';
              }
              return `${s.textShadowOffsetX ?? 2}px ${s.textShadowOffsetY ?? 2}px ${s.textShadowBlur ?? 4}px ${s.textShadowColor || 'rgba(0,0,0,0.8)'}`;
            };
            const stroke = (s: any) => s?.textStrokeWidth ? `${s.textStrokeWidth}px ${s.textStrokeColor || '#000'}` : undefined;

            // Calculate positions for current slide text
            const curOrigPos = stCurText ? getPos(stCurText.original, stCurText, 'original') : null;
            const curTranslitPos = stCurText ? getPos(stCurText.transliteration, stCurText, 'transliteration') : null;
            const curTranslationPos = stCurText ? getPos(stCurText.translation, stCurText, 'translation') : null;
            // Calculate positions for next slide text
            const nxtOrigPos = stNextText ? getPos(stNextText.original, stNextText, 'original') : null;
            const nxtTranslitPos = stNextText ? getPos(stNextText.transliteration, stNextText, 'transliteration') : null;
            const nxtTranslationPos = stNextText ? getPos(stNextText.translation, stNextText, 'translation') : null;

            // Helper for text line style — mirrors DisplayStage exactly (vw → cqw)
            const textLineStyle = (style: any, pos: { x: number; y: number; width: number; height: number }, fontDivisor: number): React.CSSProperties => ({
              position: 'absolute',
              left: `${pos.x}%`,
              top: style.autoHeight && style.growDirection === 'up' ? 'auto' : `${pos.y}%`,
              bottom: style.autoHeight && style.growDirection === 'up' ? `${100 - pos.y - pos.height}%` : 'auto',
              width: `${pos.width}%`,
              height: style.autoHeight ? 'fit-content' : `${pos.height}%`,
              minHeight: style.autoHeight ? 0 : undefined,
              display: style.autoHeight ? 'block' : 'flex',
              justifyContent: style.autoHeight ? undefined : (style.alignH === 'left' ? 'flex-start' : style.alignH === 'right' ? 'flex-end' : 'center'),
              alignItems: style.autoHeight ? undefined : (style.alignV === 'top' ? 'flex-start' : style.alignV === 'bottom' ? 'flex-end' : 'center'),
              fontSize: `${(style.fontSize || 100) / fontDivisor}cqw`,
              fontWeight: style.fontWeight,
              color: style.color,
              opacity: style.opacity,
              direction: 'rtl',
              lineHeight: style.autoHeight ? 0.9 : 1.3,
              textAlign: style.alignH || 'center',
              textShadow: shadow(style),
              WebkitTextStroke: stroke(style),
              paintOrder: 'stroke fill',
              boxSizing: 'border-box',
              padding: 0, margin: 0
            });

            return (
              <div style={{
                width: '100%', height: '100%', position: 'relative',
                background: stColors?.background || '#1a1a2e',
                color: stColors?.text || '#fff',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                overflow: 'hidden', containerType: 'inline-size' as any
              }}>
                {/* Header */}
                {header?.visible && (
                  <div style={{
                    position: 'absolute', left: `${header.x}%`, top: `${header.y}%`,
                    width: `${header.width}%`, height: `${header.height}%`,
                    background: header.backgroundColor || 'rgba(0,0,0,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0 2%', boxSizing: 'border-box'
                  }} />
                )}
                {/* Song Title */}
                {songTitleEl?.visible && (
                  <div style={{
                    position: 'absolute', left: `${songTitleEl.x}%`, top: `${songTitleEl.y}%`,
                    width: `${songTitleEl.width}%`, height: `${songTitleEl.height}%`,
                    display: 'flex', alignItems: 'center',
                    justifyContent: songTitleEl.alignH === 'left' ? 'flex-start' : songTitleEl.alignH === 'right' ? 'flex-end' : 'center',
                    paddingLeft: songTitleEl.alignH === 'left' ? '1%' : '0',
                    paddingRight: songTitleEl.alignH === 'right' ? '1%' : '0',
                    fontSize: `${2 * ((songTitleEl.fontSize || 100) / 100)}cqw`,
                    fontWeight: songTitleEl.fontWeight || 600,
                    color: songTitleEl.color || stColors?.accent
                  }}>
                    {selectedSong?.title || 'SoluCast'}
                  </div>
                )}
                {/* Clock */}
                {clock?.visible && (
                  <div style={{
                    position: 'absolute', left: `${clock.x}%`, top: `${clock.y}%`,
                    width: `${clock.width}%`, height: `${clock.height}%`,
                    display: 'flex', alignItems: 'center',
                    justifyContent: clock.alignH === 'left' ? 'flex-start' : clock.alignH === 'center' ? 'center' : 'flex-end',
                    paddingLeft: clock.alignH === 'left' ? '1%' : '0',
                    paddingRight: clock.alignH === 'right' || !clock.alignH ? '1%' : '0',
                    fontSize: `${2.5 * ((clock.fontSize || 100) / 100)}cqw`,
                    fontWeight: clock.fontWeight || 700,
                    fontFamily: clock.fontFamily || 'monospace',
                    color: clock.color || stColors?.text
                  }}>
                    {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, ...(clock.showSeconds ? { second: '2-digit' } : {}) })}
                  </div>
                )}

                {/* Current Slide Area (Background) */}
                <div style={{
                  position: 'absolute',
                  left: `${curArea?.x ?? 2}%`, top: `${curArea?.y ?? 12}%`,
                  width: `${curArea?.width ?? 64}%`, height: `${curArea?.height ?? 84}%`,
                  background: curArea?.backgroundColor || 'rgba(0,0,0,0.5)',
                  borderRadius: `${curArea?.borderRadius || 8}px`,
                  boxSizing: 'border-box'
                }} />
                {/* Current Label — positioned on canvas like DisplayStage */}
                <div style={{
                  position: 'absolute',
                  left: `${curArea?.x ?? 2}%`, top: `${curArea?.y ?? 12}%`,
                  width: `${curArea?.width ?? 64}%`,
                  padding: '1%', fontSize: '1cqw',
                  color: stColors?.secondary || '#888',
                  textTransform: 'uppercase', letterSpacing: '0.2em',
                  textAlign: 'center', boxSizing: 'border-box'
                }}>Current</div>

                {/* Blank state */}
                {isBlank && (
                  <div style={{
                    position: 'absolute',
                    left: `${curArea?.x ?? 2}%`, top: `${curArea?.y ?? 12}%`,
                    width: `${curArea?.width ?? 64}%`, height: `${curArea?.height ?? 84}%`,
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    fontSize: '3cqw', color: 'rgba(255,255,255,0.3)'
                  }}>BLANK</div>
                )}
                {/* Waiting state */}
                {!isBlank && !liveSlideData && (
                  <div style={{
                    position: 'absolute',
                    left: `${curArea?.x ?? 2}%`, top: `${curArea?.y ?? 12}%`,
                    width: `${curArea?.width ?? 64}%`, height: `${curArea?.height ?? 84}%`,
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    fontSize: '2cqw', color: 'rgba(255,255,255,0.3)'
                  }}>Waiting for content...</div>
                )}

                {/* Current slide text — positioned absolutely on canvas */}
                {!isBlank && liveSlideData && stCurText && (
                  <>
                    {stCurText.original?.visible && liveSlideData.originalText && curOrigPos && (
                      <div style={textLineStyle(stCurText.original, curOrigPos, 25)}>
                        {liveSlideData.originalText}
                      </div>
                    )}
                    {stCurText.transliteration?.visible && liveSlideData.transliteration && curTranslitPos && (
                      <div style={textLineStyle(stCurText.transliteration, curTranslitPos, 30)}>
                        {liveSlideData.transliteration}
                      </div>
                    )}
                    {stCurText.translation?.visible && liveSlideData.translation && curTranslationPos && (
                      <div style={textLineStyle(stCurText.translation, curTranslationPos, 35)}>
                        {liveSlideData.translation}
                      </div>
                    )}
                  </>
                )}

                {/* Next Slide Area (Background) */}
                {(nxtArea?.visible !== false) && (
                  <div style={{
                    position: 'absolute',
                    left: `${nxtArea?.x ?? 68}%`, top: `${nxtArea?.y ?? 12}%`,
                    width: `${nxtArea?.width ?? 30}%`, height: `${nxtArea?.height ?? 84}%`,
                    background: nxtArea?.backgroundColor || 'rgba(0,0,0,0.3)',
                    borderRadius: `${nxtArea?.borderRadius || 8}px`,
                    boxSizing: 'border-box', opacity: nxtArea?.opacity ?? 1
                  }}>
                    {/* Next label */}
                    <div style={{
                      position: 'absolute', top: '4%', left: '5%',
                      fontSize: '1cqw',
                      color: nxtArea?.labelColor || stColors?.secondary || '#888',
                      textTransform: 'uppercase', letterSpacing: '0.2em'
                    }}>{nxtArea?.labelText || 'Next'}</div>
                  </div>
                )}

                {/* Next slide text — positioned absolutely on canvas */}
                {(nxtArea?.visible !== false) && nextStageSlide && stNextText && (
                  <>
                    {stNextText.original?.visible && nextStageSlide.originalText && nxtOrigPos && (
                      <div style={textLineStyle(stNextText.original, nxtOrigPos, 40)}>
                        {nextStageSlide.originalText}
                      </div>
                    )}
                    {stNextText.transliteration?.visible && nextStageSlide.transliteration && nxtTranslitPos && (
                      <div style={textLineStyle(stNextText.transliteration, nxtTranslitPos, 50)}>
                        {nextStageSlide.transliteration}
                      </div>
                    )}
                    {stNextText.translation?.visible && nextStageSlide.translation && nxtTranslationPos && (
                      <div style={textLineStyle(stNextText.translation, nxtTranslationPos, 50)}>
                        {nextStageSlide.translation}
                      </div>
                    )}
                  </>
                )}

                {/* No next slide message */}
                {(nxtArea?.visible !== false) && !nextStageSlide && (
                  <div style={{
                    position: 'absolute',
                    left: `${nxtArea?.x ?? 68}%`, top: `${nxtArea?.y ?? 12}%`,
                    width: `${nxtArea?.width ?? 30}%`, height: `${nxtArea?.height ?? 84}%`,
                    display: 'flex', justifyContent: 'center', alignItems: 'center'
                  }}>
                    <div style={{ fontSize: '1.5cqw', color: 'rgba(255,255,255,0.2)' }}>End of content</div>
                  </div>
                )}

                {/* Status indicator */}
                <div style={{
                  position: 'absolute', bottom: '2%', left: '50%', transform: 'translateX(-50%)',
                  padding: '0.5cqh 2cqw',
                  background: isBlank ? '#dc3545' : '#28a745',
                  borderRadius: '0.5cqh', fontSize: '1.2cqw', fontWeight: 600
                }}>
                  {isBlank ? 'BLANK' : 'LIVE'}
                </div>
              </div>
            );
          })() : null}
          {/* Media display - shown when not YouTube */}
          {selectedDisplayType !== 'stage' && !youtubeOnDisplay && activeMedia ? (
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
                  onEnded={onVideoEnded}
                />
              )}
              <div style={mediaOverlayButtonsStyle}>
                <button onClick={onClearMedia} style={clearMediaButtonStyle}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                  Clear Media
                </button>
                {activeMedia.type === 'video' && (
                  <button
                    onClick={onToggleVideoLoop}
                    title={videoLoop ? 'Loop: ON' : 'Loop: OFF'}
                    style={videoLoop ? loopButtonOnStyle : loopButtonOffStyle}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="17 1 21 5 17 9" />
                      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                      <polyline points="7 23 3 19 7 15" />
                      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ) : selectedDisplayType !== 'stage' && !youtubeOnDisplay ? (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <SlidePreview
                slideData={liveSlideData}
                displayMode={displayMode}
                isBlank={isBlank}
                backgroundImage={previewBackground}
                theme={resolvedPreviewTheme}
                tools={memoizedTools}
                activeMedia={null}
                showBadge={false}
                presentationSlide={memoizedPresentationSlide}
                combinedSlides={combinedSlides}
                onHtmlCapture={previewDisplayId === null ? handleHtmlCapture : undefined}
              />
              {hasItemBackground && onToggleItemBackground && (
                <button
                  onClick={onToggleItemBackground}
                  title={itemBackgroundMuted ? 'Enable item background' : 'Disable item background'}
                  style={{
                    position: 'absolute',
                    bottom: 6,
                    right: 6,
                    zIndex: 20,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    background: itemBackgroundMuted ? 'rgba(108, 117, 125, 0.8)' : 'rgba(6, 182, 212, 0.85)',
                    border: 'none',
                    borderRadius: '4px',
                    color: itemBackgroundMuted ? 'rgba(255,255,255,0.8)' : 'black',
                    fontSize: '10px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {itemBackgroundMuted ? (
                      <>
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </>
                    ) : (
                      <>
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </>
                    )}
                  </svg>
                  BG
                </button>
              )}
            </div>
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
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center' }}>
          {/* Display Preview Selector */}
          {(assignedDisplays.length > 0 || isStreaming) && (
            <div ref={selectorRef} style={{ position: 'relative' }}>
              <button
                onClick={handleToggleDropdown}
                style={{
                  background: previewDisplayId !== null ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255,255,255,0.1)',
                  border: `1px solid ${previewDisplayId !== null ? '#06b6d4' : 'rgba(255,255,255,0.2)'}`,
                  borderRadius: '6px',
                  padding: '5px 10px',
                  color: previewDisplayId !== null ? '#06b6d4' : 'rgba(255,255,255,0.7)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease'
                }}
              >
                {monitorIconSmall}
                {selectorLabel}
                {dropdownArrowIcon}
              </button>

              {/* Dropdown menu (opens upward) */}
              {showDisplaySelector && (
                <div style={selectorDropdownStyle}>
                  {/* "All" option */}
                  <button
                    className={`dps-option${previewDisplayId === null ? ' dps-active' : ''}`}
                    onClick={handleSelectAll}
                    style={previewDisplayId === null ? dpsOptionActive : dpsOptionDefault}
                  >
                    {monitorIcon}
                    {t('controlPanel.allDisplays', 'All')}
                  </button>

                  {/* Assigned displays */}
                  {assignedDisplays.map(d => {
                    const isActive = previewDisplayId === d.id;
                    const badgeColor = d.assignedType ? DISPLAY_TYPE_BADGE_COLORS[d.assignedType] : '#6c757d';
                    const typeLabel = d.assignedType
                      ? d.assignedType.charAt(0).toUpperCase() + d.assignedType.slice(1)
                      : '';
                    return (
                      <button
                        key={d.id}
                        className={`dps-option${isActive ? ' dps-active' : ''}`}
                        onClick={() => { setPreviewDisplayId(d.id); setShowDisplaySelector(false); }}
                        style={isActive ? dpsOptionActive : dpsOptionDefault}
                      >
                        <span style={dpsLabelOverflowStyle}>{d.label}</span>
                        {typeLabel && (
                          <span style={{ ...dpsBadgeStyle, background: badgeColor }}>{typeLabel}</span>
                        )}
                      </button>
                    );
                  })}

                  {/* Livestream option */}
                  {isStreaming && (
                    <button
                      className={`dps-option${previewDisplayId === STREAMING_DISPLAY_ID ? ' dps-active' : ''}`}
                      onClick={handleSelectLivestream}
                      style={previewDisplayId === STREAMING_DISPLAY_ID ? dpsOptionActive : dpsOptionDefault}
                    >
                      <span style={{ flex: 1 }}>{t('controlPanel.livestream', 'Livestream')}</span>
                      <span style={{ ...dpsBadgeStyle, background: '#dc3545', color: 'white' }}>LIVE</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <SlideControlButtons
            isBlank={isBlank}
            displayMode={displayMode}
            showBackgroundDropdown={showBackgroundDropdown}
            selectedBackground={selectedBackground}
            isRTL={isRTL}
            customModeActive={customModeActive}
            onToggleBlank={onToggleBlank}
            onSetDisplayMode={onSetDisplayMode}
            onOpenCustomConfig={onOpenCustomConfig}
            onToggleBackgroundDropdown={onToggleBackgroundDropdown}
            onSelectBackground={onSelectBackground}
            onClearBackground={onClearBackground}
          />
        </div>
      </div>
    </div>
  );
});

LivePreviewPanel.displayName = 'LivePreviewPanel';

export default LivePreviewPanel;
