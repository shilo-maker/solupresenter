import React, { useState, useEffect, useRef, memo } from 'react';

interface SlideData {
  // Song content fields
  originalText?: string;
  transliteration?: string;
  translation?: string;
  // Prayer/Sermon content fields
  title?: string;
  titleTranslation?: string;
  subtitle?: string;
  subtitleTranslation?: string;
  description?: string;
  descriptionTranslation?: string;
  reference?: string;
  referenceTranslation?: string;
}

interface StageColors {
  background: string;
  text: string;
  accent: string;
  secondary: string;
  border: string;
}

interface StageElementConfig {
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  backgroundColor?: string;
  borderRadius?: number;
  color?: string;
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string;
  labelText?: string;
  labelColor?: string;
  opacity?: number;
  showSeconds?: boolean;
  alignH?: 'left' | 'center' | 'right';
}

interface StageTextStyle {
  visible: boolean;
  color: string;
  fontSize: number;
  fontWeight: string;
  opacity: number;
  // Position properties (percentage-based)
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  alignH?: 'left' | 'center' | 'right';
  alignV?: 'top' | 'center' | 'bottom';
  // Flow positioning
  positionMode?: 'absolute' | 'flow';
  flowAnchor?: string;
  flowGap?: number;
  flowBeside?: boolean;
  // Auto height
  autoHeight?: boolean;
  growDirection?: 'up' | 'down';
  // Text shadow properties
  textShadowColor?: string;
  textShadowBlur?: number;
  textShadowOffsetX?: number;
  textShadowOffsetY?: number;
  // Text stroke/outline properties
  textStrokeWidth?: number;
  textStrokeColor?: string;
}

interface StageTheme {
  colors: StageColors;
  elements: {
    header: StageElementConfig;
    clock: StageElementConfig;
    songTitle: StageElementConfig;
    currentSlideArea: StageElementConfig;
    nextSlideArea: StageElementConfig;
  };
  currentSlideText: {
    original: StageTextStyle;
    transliteration: StageTextStyle;
    translation: StageTextStyle;
  };
  nextSlideText: {
    original: StageTextStyle;
    transliteration: StageTextStyle;
    translation: StageTextStyle;
  };
}

const DEFAULT_THEME: StageTheme = {
  colors: {
    background: '#1a1a2e',
    text: '#ffffff',
    accent: '#06b6d4',
    secondary: '#888888',
    border: '#333333'
  },
  elements: {
    header: { visible: true, x: 0, y: 0, width: 100, height: 8, backgroundColor: 'rgba(0,0,0,0.3)' },
    clock: { visible: true, x: 85, y: 1, width: 13, height: 6, color: '#ffffff', showSeconds: true },
    songTitle: { visible: true, x: 2, y: 1, width: 60, height: 6, color: '#06b6d4' },
    currentSlideArea: { visible: true, x: 2, y: 12, width: 64, height: 84, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8 },
    nextSlideArea: { visible: true, x: 68, y: 12, width: 30, height: 84, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 8, labelText: 'Next' }
  },
  currentSlideText: {
    original: { visible: true, color: '#ffffff', fontSize: 100, fontWeight: '500', opacity: 1, x: 5, y: 20, width: 58, height: 15, alignH: 'center', alignV: 'center' },
    transliteration: { visible: true, color: 'rgba(255,255,255,0.9)', fontSize: 70, fontWeight: '400', opacity: 1, x: 5, y: 40, width: 58, height: 12, alignH: 'center', alignV: 'center' },
    translation: { visible: true, color: 'rgba(255,255,255,0.7)', fontSize: 60, fontWeight: '400', opacity: 1, x: 5, y: 55, width: 58, height: 12, alignH: 'center', alignV: 'center' }
  },
  nextSlideText: {
    original: { visible: true, color: '#ffffff', fontSize: 100, fontWeight: 'bold', opacity: 0.8, x: 70, y: 25, width: 26, height: 12, alignH: 'center', alignV: 'center' },
    transliteration: { visible: true, color: '#888888', fontSize: 70, fontWeight: '400', opacity: 0.7, x: 70, y: 40, width: 26, height: 10, alignH: 'center', alignV: 'center' },
    translation: { visible: true, color: '#ffffff', fontSize: 70, fontWeight: '400', opacity: 0.7, x: 70, y: 52, width: 26, height: 10, alignH: 'center', alignV: 'center' }
  }
};

// Tool state interfaces
function buildStageTextShadow(style?: StageTextStyle): string {
  if (!style?.textShadowColor && style?.textShadowBlur === undefined
      && style?.textShadowOffsetX === undefined && style?.textShadowOffsetY === undefined) {
    return '2px 2px 4px rgba(0, 0, 0, 0.8), 0 0 8px rgba(0, 0, 0, 0.5)';
  }
  const color = style.textShadowColor || 'rgba(0,0,0,0.8)';
  const blur = style.textShadowBlur ?? 4;
  const ox = style.textShadowOffsetX ?? 2;
  const oy = style.textShadowOffsetY ?? 2;
  return `${ox}px ${oy}px ${blur}px ${color}`;
}

function buildStageTextStroke(style?: StageTextStyle): string | undefined {
  if (!style?.textStrokeWidth) return undefined;
  return `${style.textStrokeWidth}px ${style.textStrokeColor || '#000000'}`;
}

interface CountdownState {
  active: boolean;
  remaining: string;
  message: string;
  messageTranslation?: string;
}

interface AnnouncementState {
  active: boolean;
  text: string;
}

interface ClockToolState {
  active: boolean;
  time: string;
  date: string;
}

interface StopwatchState {
  active: boolean;
  time: string;
  running: boolean;
}

interface RotatingMessagesState {
  active: boolean;
  messages: string[];
  interval: number;
  currentIndex: number;
}

// Helper to calculate effective position based on flow mode
interface TextStyles {
  original: StageTextStyle;
  transliteration: StageTextStyle;
  translation: StageTextStyle;
}

const getDefaultPosition = (lineType: 'original' | 'transliteration' | 'translation') => {
  switch (lineType) {
    case 'original': return { x: 5, y: 20, width: 58, height: 15 };
    case 'transliteration': return { x: 5, y: 40, width: 58, height: 12 };
    case 'translation': return { x: 5, y: 55, width: 58, height: 12 };
  }
};

const getEffectivePosition = (
  textStyle: StageTextStyle,
  allTextStyles: TextStyles,
  lineType: 'original' | 'transliteration' | 'translation',
  measuredHeights: Record<string, number> = {},
  visited: Set<string> = new Set()
): { x: number; y: number; width: number; height: number } => {
  const defaultPos = getDefaultPosition(lineType);

  // Cycle detection - prevent infinite recursion
  if (visited.has(lineType)) {
    console.warn(`[DisplayStage] Circular flow dependency detected at: ${lineType}`);
    return {
      x: textStyle.x ?? defaultPos.x,
      y: textStyle.y ?? defaultPos.y,
      width: textStyle.width ?? defaultPos.width,
      height: textStyle.autoHeight && measuredHeights[lineType] !== undefined
        ? measuredHeights[lineType]
        : (textStyle.height ?? defaultPos.height)
    };
  }
  visited.add(lineType);

  // Determine the effective height (use measured height if autoHeight is enabled)
  const effectiveHeight = textStyle.autoHeight && measuredHeights[lineType] !== undefined
    ? measuredHeights[lineType]
    : (textStyle.height ?? defaultPos.height);

  // If not in flow mode, use absolute position
  if (textStyle.positionMode !== 'flow') {
    return {
      x: textStyle.x ?? defaultPos.x,
      y: textStyle.y ?? defaultPos.y,
      width: textStyle.width ?? defaultPos.width,
      height: effectiveHeight
    };
  }

  // Flow mode - calculate position based on anchor
  let rawAnchor = textStyle.flowAnchor;
  // Strip 'next' prefix if present (e.g., 'nextOriginal' -> 'original')
  if (rawAnchor && rawAnchor.startsWith('next')) {
    rawAnchor = rawAnchor.charAt(4).toLowerCase() + rawAnchor.slice(5);
  }
  const anchor = rawAnchor as 'original' | 'transliteration' | 'translation' | undefined;
  const gap = textStyle.flowGap ?? 1;

  let y = textStyle.y ?? defaultPos.y;

  if (anchor && allTextStyles[anchor]) {
    const anchorStyle = allTextStyles[anchor];
    const anchorPos = getEffectivePosition(
      anchorStyle,
      allTextStyles,
      anchor,
      measuredHeights,
      new Set(visited) // Pass a copy to preserve visited set for other branches
    );

    if (textStyle.flowBeside) {
      // Position beside - same Y as anchor
      y = anchorPos.y;
    } else {
      // Position below - Y = anchor's Y + anchor's height + gap
      y = anchorPos.y + anchorPos.height + gap;
    }
  }

  return {
    x: textStyle.x ?? defaultPos.x,
    y,
    width: textStyle.width ?? defaultPos.width,
    height: effectiveHeight
  };
};

const DisplayStage: React.FC = () => {
  const [currentSlide, setCurrentSlide] = useState<SlideData | null>(null);
  const [nextSlide, setNextSlide] = useState<SlideData | null>(null);
  const [songTitle, setSongTitle] = useState<string>('');
  const [isBlank, setIsBlank] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [theme, setTheme] = useState<StageTheme>(DEFAULT_THEME);

  // Measured heights for auto-height text elements (percentage of viewport)
  const [measuredHeights, setMeasuredHeights] = useState<Record<string, number>>({});
  const [nextMeasuredHeights, setNextMeasuredHeights] = useState<Record<string, number>>({});
  const originalRef = useRef<HTMLDivElement>(null);
  const translitRef = useRef<HTMLDivElement>(null);
  const translationRef = useRef<HTMLDivElement>(null);
  const nextOriginalRef = useRef<HTMLDivElement>(null);
  const nextTranslitRef = useRef<HTMLDivElement>(null);
  const nextTranslationRef = useRef<HTMLDivElement>(null);

  // Tool states
  const [countdown, setCountdown] = useState<CountdownState>({ active: false, remaining: '', message: '' });
  const [announcement, setAnnouncement] = useState<AnnouncementState>({ active: false, text: '' });
  const [clockTool, setClockTool] = useState<ClockToolState>({ active: false, time: '', date: '' });
  const [stopwatch, setStopwatch] = useState<StopwatchState>({ active: false, time: '00:00.0', running: false });
  const [rotatingMessages, setRotatingMessages] = useState<RotatingMessagesState>({ active: false, messages: [], interval: 5, currentIndex: 0 });

  // Announcement auto-fade state
  const [announcementVisible, setAnnouncementVisible] = useState(false);
  const [announcementFading, setAnnouncementFading] = useState(false);
  const announcementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announcementFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasAnnouncementActive = useRef(false);

  // Stage message state
  const [stageMessage, setStageMessage] = useState<{ text: string; timestamp: number } | null>(null);
  const [stageMessageVisible, setStageMessageVisible] = useState(false);
  const [stageMessageFading, setStageMessageFading] = useState(false);
  const stageMessageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageMessageFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Report ready
    window.displayAPI.reportReady();

    // Listen for slide updates
    const slideCleanup = window.displayAPI.onSlideUpdate((data) => {
      if (data.isBlank) {
        setIsBlank(true);
      } else {
        setIsBlank(false);
        if (data.slideData) {
          setCurrentSlide(data.slideData);
        }
        if (data.nextSlideData) {
          setNextSlide(data.nextSlideData);
        } else {
          setNextSlide(null);
        }
        if (data.songTitle) {
          setSongTitle(data.songTitle);
        }
      }
    });

    // Listen for stage theme updates
    const stageThemeCleanup = window.displayAPI.onStageThemeUpdate((newTheme) => {
      if (newTheme) {
        setTheme({
          colors: { ...DEFAULT_THEME.colors, ...(newTheme.colors || {}) },
          elements: {
            header: { ...DEFAULT_THEME.elements.header, ...(newTheme.elements?.header || {}) },
            clock: { ...DEFAULT_THEME.elements.clock, ...(newTheme.elements?.clock || {}) },
            songTitle: { ...DEFAULT_THEME.elements.songTitle, ...(newTheme.elements?.songTitle || {}) },
            currentSlideArea: { ...DEFAULT_THEME.elements.currentSlideArea, ...(newTheme.elements?.currentSlideArea || {}) },
            nextSlideArea: { ...DEFAULT_THEME.elements.nextSlideArea, ...(newTheme.elements?.nextSlideArea || {}) },
          },
          currentSlideText: {
            original: { ...DEFAULT_THEME.currentSlideText.original, ...(newTheme.currentSlideText?.original || {}) },
            transliteration: { ...DEFAULT_THEME.currentSlideText.transliteration, ...(newTheme.currentSlideText?.transliteration || {}) },
            translation: { ...DEFAULT_THEME.currentSlideText.translation, ...(newTheme.currentSlideText?.translation || {}) },
          },
          nextSlideText: {
            original: { ...DEFAULT_THEME.nextSlideText.original, ...(newTheme.nextSlideText?.original || {}) },
            transliteration: { ...DEFAULT_THEME.nextSlideText.transliteration, ...(newTheme.nextSlideText?.transliteration || {}) },
            translation: { ...DEFAULT_THEME.nextSlideText.translation, ...(newTheme.nextSlideText?.translation || {}) },
          }
        });
      }
    });

    // Listen for tool updates
    const toolCleanup = window.displayAPI.onToolUpdate((toolData: any) => {
      if (!toolData) return;

      if (toolData.type === 'countdown') {
        setCountdown({
          active: toolData.active,
          remaining: toolData.remaining || '',
          message: toolData.message || '',
          messageTranslation: toolData.messageTranslation
        });
      } else if (toolData.type === 'announcement') {
        setAnnouncement({
          active: toolData.active,
          text: toolData.text || ''
        });
      } else if (toolData.type === 'clock') {
        setClockTool({
          active: toolData.active,
          time: toolData.time || '',
          date: toolData.date || ''
        });
      } else if (toolData.type === 'stopwatch') {
        setStopwatch({
          active: toolData.active,
          time: toolData.time || '00:00.0',
          running: toolData.running || false
        });
      } else if (toolData.type === 'rotatingMessages') {
        if (toolData.active && toolData.messages && toolData.messages.length > 0) {
          setRotatingMessages({
            active: true,
            messages: toolData.messages,
            interval: toolData.interval || 5,
            currentIndex: 0
          });
        } else {
          setRotatingMessages(prev => ({ ...prev, active: false }));
        }
      }
    });

    // Listen for stage messages
    const stageMessageCleanup = window.displayAPI.onStageMessage((data) => {
      if (data && data.text) {
        setStageMessage(data);
      }
    });

    // Update clock
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      slideCleanup();
      stageThemeCleanup();
      toolCleanup();
      stageMessageCleanup();
      clearInterval(clockInterval);
    };
  }, []);

  // Measure text heights for auto-height flow positioning (current slide)
  useEffect(() => {
    const measureHeights = () => {
      const viewportHeight = window.innerHeight;
      const newHeights: Record<string, number> = {};

      if (originalRef.current && theme.currentSlideText?.original?.autoHeight) {
        const heightPx = originalRef.current.getBoundingClientRect().height;
        newHeights['original'] = (heightPx / viewportHeight) * 100;
      }
      if (translitRef.current && theme.currentSlideText?.transliteration?.autoHeight) {
        const heightPx = translitRef.current.getBoundingClientRect().height;
        newHeights['transliteration'] = (heightPx / viewportHeight) * 100;
      }
      if (translationRef.current && theme.currentSlideText?.translation?.autoHeight) {
        const heightPx = translationRef.current.getBoundingClientRect().height;
        newHeights['translation'] = (heightPx / viewportHeight) * 100;
      }

      if (Object.keys(newHeights).length > 0) {
        setMeasuredHeights(prev => ({ ...prev, ...newHeights }));
      }
    };

    // Measure after render
    requestAnimationFrame(measureHeights);
  }, [currentSlide, theme.currentSlideText]);

  // Measure text heights for auto-height flow positioning (next slide)
  useEffect(() => {
    const measureHeights = () => {
      const viewportHeight = window.innerHeight;
      const newHeights: Record<string, number> = {};

      if (nextOriginalRef.current && theme.nextSlideText?.original?.autoHeight) {
        const heightPx = nextOriginalRef.current.getBoundingClientRect().height;
        newHeights['original'] = (heightPx / viewportHeight) * 100;
      }
      if (nextTranslitRef.current && theme.nextSlideText?.transliteration?.autoHeight) {
        const heightPx = nextTranslitRef.current.getBoundingClientRect().height;
        newHeights['transliteration'] = (heightPx / viewportHeight) * 100;
      }
      if (nextTranslationRef.current && theme.nextSlideText?.translation?.autoHeight) {
        const heightPx = nextTranslationRef.current.getBoundingClientRect().height;
        newHeights['translation'] = (heightPx / viewportHeight) * 100;
      }

      if (Object.keys(newHeights).length > 0) {
        setNextMeasuredHeights(prev => ({ ...prev, ...newHeights }));
      }
    };

    // Measure after render
    requestAnimationFrame(measureHeights);
  }, [nextSlide, theme.nextSlideText]);

  // Handle announcement visibility and auto-dismiss after 10 seconds
  useEffect(() => {
    if (announcement.active && announcement.text) {
      // Clear any existing timer
      if (announcementTimerRef.current) {
        clearTimeout(announcementTimerRef.current);
      }

      // Show announcement with slide-up animation
      setAnnouncementFading(false);
      setAnnouncementVisible(true);
      wasAnnouncementActive.current = true;

      // Start fade-out after 8 seconds, then hide after 10 seconds total
      announcementTimerRef.current = setTimeout(() => {
        setAnnouncementFading(true);
        // Fully hide after fade animation completes (2 seconds)
        announcementFadeRef.current = setTimeout(() => {
          setAnnouncementVisible(false);
          setAnnouncementFading(false);
        }, 2000);
      }, 8000);
    } else if (!announcement.active && wasAnnouncementActive.current) {
      // If announcement is deactivated and was previously active, start fade out immediately
      wasAnnouncementActive.current = false;
      setAnnouncementFading(true);
      announcementFadeRef.current = setTimeout(() => {
        setAnnouncementVisible(false);
        setAnnouncementFading(false);
      }, 500);
      if (announcementTimerRef.current) {
        clearTimeout(announcementTimerRef.current);
      }
    }

    return () => {
      if (announcementTimerRef.current) {
        clearTimeout(announcementTimerRef.current);
      }
      if (announcementFadeRef.current) {
        clearTimeout(announcementFadeRef.current);
      }
    };
  }, [announcement.active, announcement.text]);

  // Rotating messages interval
  useEffect(() => {
    let rotatingInterval: ReturnType<typeof setInterval> | null = null;

    if (rotatingMessages.active && rotatingMessages.messages.length > 1) {
      rotatingInterval = setInterval(() => {
        setRotatingMessages(prev => ({
          ...prev,
          currentIndex: (prev.currentIndex + 1) % prev.messages.length
        }));
      }, rotatingMessages.interval * 1000);
    }

    return () => {
      if (rotatingInterval) {
        clearInterval(rotatingInterval);
      }
    };
  }, [rotatingMessages.active, rotatingMessages.messages.length, rotatingMessages.interval]);

  // Stage message auto-hide after 15 seconds
  useEffect(() => {
    if (stageMessage && stageMessage.text) {
      // Clear any existing timers
      if (stageMessageTimerRef.current) {
        clearTimeout(stageMessageTimerRef.current);
      }
      if (stageMessageFadeRef.current) {
        clearTimeout(stageMessageFadeRef.current);
      }

      // Show message with slide-up animation
      setStageMessageFading(false);
      setStageMessageVisible(true);

      // Start fade-out after 13 seconds, then hide after 15 seconds total
      stageMessageTimerRef.current = setTimeout(() => {
        setStageMessageFading(true);
        // Fully hide after fade animation completes (2 seconds)
        stageMessageFadeRef.current = setTimeout(() => {
          setStageMessageVisible(false);
          setStageMessageFading(false);
          setStageMessage(null);
        }, 2000);
      }, 13000);
    }

    return () => {
      if (stageMessageTimerRef.current) {
        clearTimeout(stageMessageTimerRef.current);
      }
      if (stageMessageFadeRef.current) {
        clearTimeout(stageMessageFadeRef.current);
      }
    };
  }, [stageMessage?.timestamp]);

  // Format time
  const formatTime = (date: Date): string => {
    const opts: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    };
    if (theme.elements.clock?.showSeconds) {
      opts.second = '2-digit';
    }
    return date.toLocaleTimeString('en-US', opts);
  };

  // Get element styles
  const { colors, elements, currentSlideText } = theme;

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: colors.background,
        position: 'relative',
        color: colors.text,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      {/* Header - positioned absolutely */}
      {elements.header.visible && (
        <div
          style={{
            position: 'absolute',
            left: `${elements.header.x}%`,
            top: `${elements.header.y}%`,
            width: `${elements.header.width}%`,
            height: `${elements.header.height}%`,
            background: elements.header.backgroundColor || 'rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 2%',
            boxSizing: 'border-box'
          }}
        />
      )}

      {/* Song Title */}
      {elements.songTitle.visible && (
        <div
          style={{
            position: 'absolute',
            left: `${elements.songTitle.x}%`,
            top: `${elements.songTitle.y}%`,
            width: `${elements.songTitle.width}%`,
            height: `${elements.songTitle.height}%`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: elements.songTitle.alignH === 'left' ? 'flex-start' : elements.songTitle.alignH === 'right' ? 'flex-end' : 'center',
            paddingLeft: elements.songTitle.alignH === 'left' ? '1%' : '0',
            paddingRight: elements.songTitle.alignH === 'right' ? '1%' : '0',
            fontSize: `${2 * ((elements.songTitle.fontSize || 100) / 100)}vw`,
            fontWeight: elements.songTitle.fontWeight || 600,
            color: elements.songTitle.color || colors.accent
          }}
        >
          {songTitle || 'SoluCast'}
        </div>
      )}

      {/* Clock */}
      {elements.clock.visible && (
        <div
          style={{
            position: 'absolute',
            left: `${elements.clock.x}%`,
            top: `${elements.clock.y}%`,
            width: `${elements.clock.width}%`,
            height: `${elements.clock.height}%`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: elements.clock.alignH === 'left' ? 'flex-start' : elements.clock.alignH === 'center' ? 'center' : 'flex-end',
            paddingLeft: elements.clock.alignH === 'left' ? '1%' : '0',
            paddingRight: elements.clock.alignH === 'right' || !elements.clock.alignH ? '1%' : '0',
            fontSize: `${2.5 * ((elements.clock.fontSize || 100) / 100)}vw`,
            fontWeight: elements.clock.fontWeight || 700,
            fontFamily: elements.clock.fontFamily || 'monospace',
            color: elements.clock.color || colors.text
          }}
        >
          {formatTime(currentTime)}
        </div>
      )}

      {/* Current Slide Area (Background) */}
      <div
        style={{
          position: 'absolute',
          left: `${elements.currentSlideArea.x}%`,
          top: `${elements.currentSlideArea.y}%`,
          width: `${elements.currentSlideArea.width}%`,
          height: `${elements.currentSlideArea.height}%`,
          background: elements.currentSlideArea.backgroundColor || 'rgba(0,0,0,0.5)',
          borderRadius: `${elements.currentSlideArea.borderRadius || 8}px`,
          boxSizing: 'border-box'
        }}
      />

      {/* Current Label */}
      <div
        style={{
          position: 'absolute',
          left: `${elements.currentSlideArea.x}%`,
          top: `${elements.currentSlideArea.y}%`,
          width: `${elements.currentSlideArea.width}%`,
          padding: '1%',
          fontSize: '1vw',
          color: colors.secondary,
          textTransform: 'uppercase',
          letterSpacing: '0.2em',
          textAlign: 'center',
          boxSizing: 'border-box'
        }}
      >
        Current
      </div>

      {/* Blank/Waiting State */}
      {isBlank && (
        <div
          style={{
            position: 'absolute',
            left: `${elements.currentSlideArea.x}%`,
            top: `${elements.currentSlideArea.y}%`,
            width: `${elements.currentSlideArea.width}%`,
            height: `${elements.currentSlideArea.height}%`,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: '3vw',
            color: 'rgba(255,255,255,0.3)'
          }}
        >
          BLANK
        </div>
      )}

      {!isBlank && !currentSlide && (
        <div
          style={{
            position: 'absolute',
            left: `${elements.currentSlideArea.x}%`,
            top: `${elements.currentSlideArea.y}%`,
            width: `${elements.currentSlideArea.width}%`,
            height: `${elements.currentSlideArea.height}%`,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: '2vw',
            color: 'rgba(255,255,255,0.3)'
          }}
        >
          Waiting for content...
        </div>
      )}

      {/* Song Content - Individual Positioned Text Lines */}
      {!isBlank && currentSlide && !currentSlide.title && (() => {
        // Calculate effective positions based on flow settings
        const originalPos = getEffectivePosition(currentSlideText.original, currentSlideText, 'original', measuredHeights);
        const translitPos = getEffectivePosition(currentSlideText.transliteration, currentSlideText, 'transliteration', measuredHeights);
        const translationPos = getEffectivePosition(currentSlideText.translation, currentSlideText, 'translation', measuredHeights);

        return (
        <>
          {/* Original Text */}
          {currentSlideText.original.visible && currentSlide.originalText && (
            <div
              ref={originalRef}
              style={{
                position: 'absolute',
                left: `${originalPos.x}%`,
                top: currentSlideText.original.autoHeight && currentSlideText.original.growDirection === 'up'
                  ? 'auto'
                  : `${originalPos.y}%`,
                bottom: currentSlideText.original.autoHeight && currentSlideText.original.growDirection === 'up'
                  ? `${100 - originalPos.y - originalPos.height}%`
                  : 'auto',
                width: `${originalPos.width}%`,
                height: currentSlideText.original.autoHeight ? 'fit-content' : `${originalPos.height}%`,
                minHeight: currentSlideText.original.autoHeight ? 0 : undefined,
                display: currentSlideText.original.autoHeight ? 'block' : 'flex',
                justifyContent: currentSlideText.original.autoHeight ? undefined : (currentSlideText.original.alignH === 'left' ? 'flex-start' : currentSlideText.original.alignH === 'right' ? 'flex-end' : 'center'),
                alignItems: currentSlideText.original.autoHeight ? undefined : (currentSlideText.original.alignV === 'top' ? 'flex-start' : currentSlideText.original.alignV === 'bottom' ? 'flex-end' : 'center'),
                fontSize: `${currentSlideText.original.fontSize / 25}vw`,
                fontWeight: currentSlideText.original.fontWeight as any,
                color: currentSlideText.original.color,
                opacity: currentSlideText.original.opacity,
                direction: 'rtl',
                lineHeight: currentSlideText.original.autoHeight ? 0.9 : 1.3,
                textAlign: currentSlideText.original.alignH || 'center',
                textShadow: buildStageTextShadow(currentSlideText.original),
                WebkitTextStroke: buildStageTextStroke(currentSlideText.original),
                paintOrder: 'stroke fill',
                boxSizing: 'border-box',
                padding: 0,
                margin: 0
              }}
            >
              {currentSlide.originalText}
            </div>
          )}

          {/* Transliteration Text */}
          {currentSlideText.transliteration.visible && currentSlide.transliteration && (
            <div
              ref={translitRef}
              style={{
                position: 'absolute',
                left: `${translitPos.x}%`,
                top: currentSlideText.transliteration.autoHeight && currentSlideText.transliteration.growDirection === 'up'
                  ? 'auto'
                  : `${translitPos.y}%`,
                bottom: currentSlideText.transliteration.autoHeight && currentSlideText.transliteration.growDirection === 'up'
                  ? `${100 - translitPos.y - translitPos.height}%`
                  : 'auto',
                width: `${translitPos.width}%`,
                height: currentSlideText.transliteration.autoHeight ? 'fit-content' : `${translitPos.height}%`,
                minHeight: currentSlideText.transliteration.autoHeight ? 0 : undefined,
                display: currentSlideText.transliteration.autoHeight ? 'block' : 'flex',
                justifyContent: currentSlideText.transliteration.autoHeight ? undefined : (currentSlideText.transliteration.alignH === 'left' ? 'flex-start' : currentSlideText.transliteration.alignH === 'right' ? 'flex-end' : 'center'),
                alignItems: currentSlideText.transliteration.autoHeight ? undefined : (currentSlideText.transliteration.alignV === 'top' ? 'flex-start' : currentSlideText.transliteration.alignV === 'bottom' ? 'flex-end' : 'center'),
                fontSize: `${currentSlideText.transliteration.fontSize / 30}vw`,
                fontWeight: currentSlideText.transliteration.fontWeight as any,
                color: currentSlideText.transliteration.color,
                opacity: currentSlideText.transliteration.opacity,
                lineHeight: currentSlideText.transliteration.autoHeight ? 0.9 : 1.3,
                textAlign: currentSlideText.transliteration.alignH || 'center',
                textShadow: buildStageTextShadow(currentSlideText.transliteration),
                WebkitTextStroke: buildStageTextStroke(currentSlideText.transliteration),
                paintOrder: 'stroke fill',
                boxSizing: 'border-box',
                padding: 0,
                margin: 0
              }}
            >
              {currentSlide.transliteration}
            </div>
          )}

          {/* Translation Text */}
          {currentSlideText.translation.visible && currentSlide.translation && (
            <div
              ref={translationRef}
              style={{
                position: 'absolute',
                left: `${translationPos.x}%`,
                top: currentSlideText.translation.autoHeight && currentSlideText.translation.growDirection === 'up'
                  ? 'auto'
                  : `${translationPos.y}%`,
                bottom: currentSlideText.translation.autoHeight && currentSlideText.translation.growDirection === 'up'
                  ? `${100 - translationPos.y - translationPos.height}%`
                  : 'auto',
                width: `${translationPos.width}%`,
                height: currentSlideText.translation.autoHeight ? 'fit-content' : `${translationPos.height}%`,
                minHeight: currentSlideText.translation.autoHeight ? 0 : undefined,
                display: currentSlideText.translation.autoHeight ? 'block' : 'flex',
                justifyContent: currentSlideText.translation.autoHeight ? undefined : (currentSlideText.translation.alignH === 'left' ? 'flex-start' : currentSlideText.translation.alignH === 'right' ? 'flex-end' : 'center'),
                alignItems: currentSlideText.translation.autoHeight ? undefined : (currentSlideText.translation.alignV === 'top' ? 'flex-start' : currentSlideText.translation.alignV === 'bottom' ? 'flex-end' : 'center'),
                fontSize: `${currentSlideText.translation.fontSize / 35}vw`,
                fontWeight: currentSlideText.translation.fontWeight as any,
                color: currentSlideText.translation.color,
                opacity: currentSlideText.translation.opacity,
                lineHeight: currentSlideText.translation.autoHeight ? 0.9 : 1.3,
                textAlign: currentSlideText.translation.alignH || 'center',
                textShadow: buildStageTextShadow(currentSlideText.translation),
                WebkitTextStroke: buildStageTextStroke(currentSlideText.translation),
                paintOrder: 'stroke fill',
                boxSizing: 'border-box',
                padding: 0,
                margin: 0
              }}
            >
              {currentSlide.translation}
            </div>
          )}
        </>
        );
      })()}

      {/* Prayer/Sermon Content - Positioned in Current Slide Area */}
      {!isBlank && currentSlide && currentSlide.title && (
        <div
          style={{
            position: 'absolute',
            left: `${elements.currentSlideArea.x}%`,
            top: `${elements.currentSlideArea.y + 5}%`,
            width: `${elements.currentSlideArea.width}%`,
            height: `${elements.currentSlideArea.height - 5}%`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            padding: '2%',
            boxSizing: 'border-box'
          }}
        >
          {currentSlide.title && (
            <div
              style={{
                fontSize: `${currentSlideText.original.fontSize / 25}vw`,
                fontWeight: currentSlideText.original.fontWeight as any,
                color: currentSlideText.original.color,
                opacity: currentSlideText.original.opacity,
                marginBottom: '1vh',
                direction: 'rtl',
                lineHeight: 1.3,
                textShadow: buildStageTextShadow(currentSlideText.original),
                WebkitTextStroke: buildStageTextStroke(currentSlideText.original),
                paintOrder: 'stroke fill'
              }}
            >
              {currentSlide.title}
            </div>
          )}
          {currentSlide.titleTranslation && (
            <div
              style={{
                fontSize: `${currentSlideText.translation.fontSize / 30}vw`,
                fontWeight: currentSlideText.translation.fontWeight as any,
                color: currentSlideText.translation.color,
                opacity: currentSlideText.translation.opacity,
                marginBottom: '2vh',
                textShadow: buildStageTextShadow(currentSlideText.translation),
                WebkitTextStroke: buildStageTextStroke(currentSlideText.translation),
                paintOrder: 'stroke fill'
              }}
            >
              {currentSlide.titleTranslation}
            </div>
          )}
          {currentSlide.subtitle && (
            <div
              style={{
                fontSize: `${currentSlideText.original.fontSize / 30}vw`,
                fontWeight: '500',
                color: currentSlideText.original.color,
                opacity: 0.9,
                marginBottom: '0.5vh',
                direction: 'rtl',
                lineHeight: 1.3,
                textShadow: buildStageTextShadow(currentSlideText.original),
                WebkitTextStroke: buildStageTextStroke(currentSlideText.original),
                paintOrder: 'stroke fill'
              }}
            >
              {currentSlide.subtitle}
            </div>
          )}
          {currentSlide.subtitleTranslation && (
            <div
              style={{
                fontSize: `${currentSlideText.translation.fontSize / 35}vw`,
                fontWeight: currentSlideText.translation.fontWeight as any,
                color: currentSlideText.translation.color,
                opacity: 0.8,
                marginBottom: '2vh',
                textShadow: buildStageTextShadow(currentSlideText.translation),
                WebkitTextStroke: buildStageTextStroke(currentSlideText.translation),
                paintOrder: 'stroke fill'
              }}
            >
              {currentSlide.subtitleTranslation}
            </div>
          )}
          {currentSlide.description && (
            <div
              style={{
                fontSize: `${currentSlideText.original.fontSize / 35}vw`,
                fontWeight: '400',
                color: currentSlideText.original.color,
                opacity: 0.85,
                marginBottom: '0.5vh',
                direction: 'rtl',
                lineHeight: 1.4,
                textShadow: buildStageTextShadow(currentSlideText.original),
                WebkitTextStroke: buildStageTextStroke(currentSlideText.original),
                paintOrder: 'stroke fill'
              }}
            >
              {currentSlide.description}
            </div>
          )}
          {currentSlide.descriptionTranslation && (
            <div
              style={{
                fontSize: `${currentSlideText.translation.fontSize / 40}vw`,
                fontWeight: currentSlideText.translation.fontWeight as any,
                color: currentSlideText.translation.color,
                opacity: 0.75,
                marginBottom: '2vh',
                textShadow: buildStageTextShadow(currentSlideText.translation),
                WebkitTextStroke: buildStageTextStroke(currentSlideText.translation),
                paintOrder: 'stroke fill'
              }}
            >
              {currentSlide.descriptionTranslation}
            </div>
          )}
          {(currentSlide.reference || currentSlide.referenceTranslation) && (
            <div
              style={{
                fontSize: '1.5vw',
                fontWeight: '500',
                color: colors.accent,
                opacity: 0.9,
                marginTop: '1vh'
              }}
            >
              {currentSlide.reference && <span style={{ direction: 'rtl' }}>{currentSlide.reference}</span>}
              {currentSlide.reference && currentSlide.referenceTranslation && ' | '}
              {currentSlide.referenceTranslation && <span>{currentSlide.referenceTranslation}</span>}
            </div>
          )}
        </div>
      )}

      {/* Next Slide Preview - Background Area */}
      {elements.nextSlideArea.visible && (
        <div
          style={{
            position: 'absolute',
            left: `${elements.nextSlideArea.x}%`,
            top: `${elements.nextSlideArea.y}%`,
            width: `${elements.nextSlideArea.width}%`,
            height: `${elements.nextSlideArea.height}%`,
            background: elements.nextSlideArea.backgroundColor || 'rgba(0,0,0,0.3)',
            borderRadius: `${elements.nextSlideArea.borderRadius || 8}px`,
            boxSizing: 'border-box',
            opacity: elements.nextSlideArea.opacity ?? 1
          }}
        >
          {/* Label */}
          <div
            style={{
              position: 'absolute',
              top: '4%',
              left: '5%',
              fontSize: '1vw',
              color: elements.nextSlideArea.labelColor || colors.secondary,
              textTransform: 'uppercase',
              letterSpacing: '0.2em'
            }}
          >
            {elements.nextSlideArea.labelText || 'Next'}
          </div>
        </div>
      )}

      {/* Next Slide Text - Positioned Absolutely on Canvas */}
      {elements.nextSlideArea.visible && nextSlide && !nextSlide.title && (() => {
        // Calculate effective positions for next slide text based on flow settings
        const nextOriginalPos = getEffectivePosition(theme.nextSlideText.original, theme.nextSlideText, 'original', nextMeasuredHeights);
        const nextTranslitPos = getEffectivePosition(theme.nextSlideText.transliteration, theme.nextSlideText, 'transliteration', nextMeasuredHeights);
        const nextTranslationPos = getEffectivePosition(theme.nextSlideText.translation, theme.nextSlideText, 'translation', nextMeasuredHeights);

        return (
        <>
          {/* Next Original Text */}
          {theme.nextSlideText.original.visible && nextSlide.originalText && (
            <div
              ref={nextOriginalRef}
              style={{
                position: 'absolute',
                left: `${nextOriginalPos.x}%`,
                top: theme.nextSlideText.original.autoHeight && theme.nextSlideText.original.growDirection === 'up'
                  ? 'auto'
                  : `${nextOriginalPos.y}%`,
                bottom: theme.nextSlideText.original.autoHeight && theme.nextSlideText.original.growDirection === 'up'
                  ? `${100 - nextOriginalPos.y - nextOriginalPos.height}%`
                  : 'auto',
                width: `${nextOriginalPos.width}%`,
                height: theme.nextSlideText.original.autoHeight ? 'fit-content' : `${nextOriginalPos.height}%`,
                minHeight: theme.nextSlideText.original.autoHeight ? 0 : undefined,
                display: theme.nextSlideText.original.autoHeight ? 'block' : 'flex',
                justifyContent: theme.nextSlideText.original.autoHeight ? undefined : (theme.nextSlideText.original.alignH === 'left' ? 'flex-start' : theme.nextSlideText.original.alignH === 'right' ? 'flex-end' : 'center'),
                alignItems: theme.nextSlideText.original.autoHeight ? undefined : (theme.nextSlideText.original.alignV === 'top' ? 'flex-start' : theme.nextSlideText.original.alignV === 'bottom' ? 'flex-end' : 'center'),
                fontSize: `${theme.nextSlideText.original.fontSize / 40}vw`,
                fontWeight: theme.nextSlideText.original.fontWeight as any,
                color: theme.nextSlideText.original.color,
                opacity: theme.nextSlideText.original.opacity,
                direction: 'rtl',
                lineHeight: theme.nextSlideText.original.autoHeight ? 0.9 : 1.3,
                textAlign: theme.nextSlideText.original.alignH || 'center',
                textShadow: buildStageTextShadow(theme.nextSlideText.original),
                WebkitTextStroke: buildStageTextStroke(theme.nextSlideText.original),
                paintOrder: 'stroke fill',
                boxSizing: 'border-box',
                padding: 0,
                margin: 0
              }}
            >
              {nextSlide.originalText}
            </div>
          )}

          {/* Next Transliteration Text */}
          {theme.nextSlideText.transliteration.visible && nextSlide.transliteration && (
            <div
              ref={nextTranslitRef}
              style={{
                position: 'absolute',
                left: `${nextTranslitPos.x}%`,
                top: theme.nextSlideText.transliteration.autoHeight && theme.nextSlideText.transliteration.growDirection === 'up'
                  ? 'auto'
                  : `${nextTranslitPos.y}%`,
                bottom: theme.nextSlideText.transliteration.autoHeight && theme.nextSlideText.transliteration.growDirection === 'up'
                  ? `${100 - nextTranslitPos.y - nextTranslitPos.height}%`
                  : 'auto',
                width: `${nextTranslitPos.width}%`,
                height: theme.nextSlideText.transliteration.autoHeight ? 'fit-content' : `${nextTranslitPos.height}%`,
                minHeight: theme.nextSlideText.transliteration.autoHeight ? 0 : undefined,
                display: theme.nextSlideText.transliteration.autoHeight ? 'block' : 'flex',
                justifyContent: theme.nextSlideText.transliteration.autoHeight ? undefined : (theme.nextSlideText.transliteration.alignH === 'left' ? 'flex-start' : theme.nextSlideText.transliteration.alignH === 'right' ? 'flex-end' : 'center'),
                alignItems: theme.nextSlideText.transliteration.autoHeight ? undefined : (theme.nextSlideText.transliteration.alignV === 'top' ? 'flex-start' : theme.nextSlideText.transliteration.alignV === 'bottom' ? 'flex-end' : 'center'),
                fontSize: `${theme.nextSlideText.transliteration.fontSize / 50}vw`,
                fontWeight: theme.nextSlideText.transliteration.fontWeight as any,
                color: theme.nextSlideText.transliteration.color,
                opacity: theme.nextSlideText.transliteration.opacity,
                lineHeight: theme.nextSlideText.transliteration.autoHeight ? 0.9 : 1.3,
                textAlign: theme.nextSlideText.transliteration.alignH || 'center',
                textShadow: buildStageTextShadow(theme.nextSlideText.transliteration),
                WebkitTextStroke: buildStageTextStroke(theme.nextSlideText.transliteration),
                paintOrder: 'stroke fill',
                boxSizing: 'border-box',
                padding: 0,
                margin: 0
              }}
            >
              {nextSlide.transliteration}
            </div>
          )}

          {/* Next Translation Text */}
          {theme.nextSlideText.translation.visible && nextSlide.translation && (
            <div
              ref={nextTranslationRef}
              style={{
                position: 'absolute',
                left: `${nextTranslationPos.x}%`,
                top: theme.nextSlideText.translation.autoHeight && theme.nextSlideText.translation.growDirection === 'up'
                  ? 'auto'
                  : `${nextTranslationPos.y}%`,
                bottom: theme.nextSlideText.translation.autoHeight && theme.nextSlideText.translation.growDirection === 'up'
                  ? `${100 - nextTranslationPos.y - nextTranslationPos.height}%`
                  : 'auto',
                width: `${nextTranslationPos.width}%`,
                height: theme.nextSlideText.translation.autoHeight ? 'fit-content' : `${nextTranslationPos.height}%`,
                minHeight: theme.nextSlideText.translation.autoHeight ? 0 : undefined,
                display: theme.nextSlideText.translation.autoHeight ? 'block' : 'flex',
                justifyContent: theme.nextSlideText.translation.autoHeight ? undefined : (theme.nextSlideText.translation.alignH === 'left' ? 'flex-start' : theme.nextSlideText.translation.alignH === 'right' ? 'flex-end' : 'center'),
                alignItems: theme.nextSlideText.translation.autoHeight ? undefined : (theme.nextSlideText.translation.alignV === 'top' ? 'flex-start' : theme.nextSlideText.translation.alignV === 'bottom' ? 'flex-end' : 'center'),
                fontSize: `${theme.nextSlideText.translation.fontSize / 50}vw`,
                fontWeight: theme.nextSlideText.translation.fontWeight as any,
                color: theme.nextSlideText.translation.color,
                opacity: theme.nextSlideText.translation.opacity,
                lineHeight: theme.nextSlideText.translation.autoHeight ? 0.9 : 1.3,
                textAlign: theme.nextSlideText.translation.alignH || 'center',
                textShadow: buildStageTextShadow(theme.nextSlideText.translation),
                WebkitTextStroke: buildStageTextStroke(theme.nextSlideText.translation),
                paintOrder: 'stroke fill',
                boxSizing: 'border-box',
                padding: 0,
                margin: 0
              }}
            >
              {nextSlide.translation}
            </div>
          )}
        </>
        );
      })()}

      {/* Next Slide - Prayer/Sermon Content (centered in area) */}
      {elements.nextSlideArea.visible && nextSlide && nextSlide.title && (
        <div
          style={{
            position: 'absolute',
            left: `${elements.nextSlideArea.x}%`,
            top: `${elements.nextSlideArea.y + 10}%`,
            width: `${elements.nextSlideArea.width}%`,
            height: `${elements.nextSlideArea.height - 15}%`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            boxSizing: 'border-box',
            padding: '2%'
          }}
        >
          {nextSlide.title && theme.nextSlideText.original.visible && (
            <div
              style={{
                fontSize: `${theme.nextSlideText.original.fontSize / 40}vw`,
                fontWeight: theme.nextSlideText.original.fontWeight as any,
                marginBottom: '0.5vh',
                direction: 'rtl',
                color: theme.nextSlideText.original.color,
                opacity: theme.nextSlideText.original.opacity,
                lineHeight: 1.3,
                textShadow: buildStageTextShadow(theme.nextSlideText.original),
                WebkitTextStroke: buildStageTextStroke(theme.nextSlideText.original),
                paintOrder: 'stroke fill'
              }}
            >
              {nextSlide.title}
            </div>
          )}
          {nextSlide.titleTranslation && theme.nextSlideText.translation.visible && (
            <div
              style={{
                fontSize: `${theme.nextSlideText.translation.fontSize / 50}vw`,
                fontWeight: theme.nextSlideText.translation.fontWeight as any,
                color: theme.nextSlideText.translation.color,
                opacity: theme.nextSlideText.translation.opacity,
                marginBottom: '0.5vh',
                textShadow: buildStageTextShadow(theme.nextSlideText.translation),
                WebkitTextStroke: buildStageTextStroke(theme.nextSlideText.translation),
                paintOrder: 'stroke fill'
              }}
            >
              {nextSlide.titleTranslation}
            </div>
          )}
          {nextSlide.subtitle && theme.nextSlideText.transliteration.visible && (
            <div
              style={{
                fontSize: `${theme.nextSlideText.transliteration.fontSize / 50}vw`,
                fontWeight: theme.nextSlideText.transliteration.fontWeight as any,
                direction: 'rtl',
                color: theme.nextSlideText.transliteration.color,
                opacity: theme.nextSlideText.transliteration.opacity,
                marginTop: '0.5vh',
                textShadow: buildStageTextShadow(theme.nextSlideText.transliteration),
                WebkitTextStroke: buildStageTextStroke(theme.nextSlideText.transliteration),
                paintOrder: 'stroke fill'
              }}
            >
              {nextSlide.subtitle}
            </div>
          )}
        </div>
      )}

      {/* No Next Slide Message */}
      {elements.nextSlideArea.visible && !nextSlide && (
        <div
          style={{
            position: 'absolute',
            left: `${elements.nextSlideArea.x}%`,
            top: `${elements.nextSlideArea.y}%`,
            width: `${elements.nextSlideArea.width}%`,
            height: `${elements.nextSlideArea.height}%`,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <div style={{ fontSize: '1.5vw', color: 'rgba(255,255,255,0.2)' }}>
            End of content
          </div>
        </div>
      )}

      {/* Tool Overlays */}
      {/* Countdown overlay */}
      {countdown.active && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            zIndex: 100
          }}
        >
          <div style={{ fontSize: '8vw', fontWeight: 700, color: '#00d4ff', fontFamily: 'monospace' }}>
            {countdown.remaining}
          </div>
          {countdown.message && (
            <div style={{ fontSize: '2vw', color: 'white', marginTop: '1vh', direction: 'rtl' }}>
              {countdown.message}
            </div>
          )}
          {countdown.messageTranslation && (
            <div style={{ fontSize: '1.5vw', color: 'rgba(255,255,255,0.7)', marginTop: '0.5vh' }}>
              {countdown.messageTranslation}
            </div>
          )}
        </div>
      )}

      {/* Clock tool overlay */}
      {clockTool.active && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            zIndex: 100
          }}
        >
          <div style={{ fontSize: '8vw', fontWeight: 700, color: '#00d4ff', fontFamily: 'monospace' }}>
            {clockTool.time}
          </div>
          {clockTool.date && (
            <div style={{ fontSize: '2vw', color: 'rgba(255,255,255,0.7)', marginTop: '1vh' }}>
              {clockTool.date}
            </div>
          )}
        </div>
      )}

      {/* Stopwatch overlay */}
      {stopwatch.active && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            zIndex: 100
          }}
        >
          <div style={{
            fontSize: '8vw',
            fontWeight: 700,
            color: stopwatch.running ? '#00d4ff' : '#ffc107',
            fontFamily: 'monospace'
          }}>
            {stopwatch.time}
          </div>
        </div>
      )}

      {/* Announcement banner with auto-fade */}
      {announcementVisible && announcement.text && (
        <div
          style={{
            position: 'absolute',
            bottom: '8%',
            left: '5%',
            right: '5%',
            padding: '1.5vh 2vw',
            background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.95), rgba(8, 145, 178, 0.95))',
            borderRadius: '1vh',
            textAlign: 'center',
            fontSize: '2vw',
            fontWeight: 600,
            color: 'white',
            zIndex: 90,
            animation: announcementFading ? 'slideDownStage 0.5s ease-out forwards' : 'slideUpStage 0.5s ease-out forwards'
          }}
        >
          {announcement.text}
          <style>{`
            @keyframes slideUpStage {
              from {
                opacity: 0;
                transform: translateY(30px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
            @keyframes slideDownStage {
              from {
                opacity: 1;
                transform: translateY(0);
              }
              to {
                opacity: 0;
                transform: translateY(30px);
              }
            }
          `}</style>
        </div>
      )}

      {/* Stage message alert - centered with pulsing icon */}
      {stageMessageVisible && stageMessage?.text && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            padding: '3vh 4vw',
            background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.95), rgba(219, 39, 119, 0.95))',
            borderRadius: '2vh',
            textAlign: 'center',
            zIndex: 200,
            animation: stageMessageFading ? 'fadeOutStageMsg 0.5s ease-out forwards' : 'fadeInStageMsg 0.5s ease-out forwards',
            boxShadow: '0 8px 40px rgba(236, 72, 153, 0.6), 0 0 100px rgba(236, 72, 153, 0.3)',
            minWidth: '30vw',
            maxWidth: '80vw'
          }}
        >
          {/* Pulsing alert icon */}
          <div style={{
            marginBottom: '2vh',
            display: 'flex',
            justifyContent: 'center'
          }}>
            <svg
              width="8vw"
              height="8vw"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              style={{
                animation: 'pulseIcon 1s ease-in-out infinite'
              }}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          {/* Message text */}
          <div style={{
            fontSize: '4vw',
            fontWeight: 700,
            color: 'white',
            lineHeight: 1.3,
            textShadow: '0 2px 10px rgba(0,0,0,0.3)'
          }}>
            {stageMessage.text}
          </div>
          <style>{`
            @keyframes fadeInStageMsg {
              from {
                opacity: 0;
                transform: translate(-50%, -50%) scale(0.8);
              }
              to {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
              }
            }
            @keyframes fadeOutStageMsg {
              from {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
              }
              to {
                opacity: 0;
                transform: translate(-50%, -50%) scale(0.8);
              }
            }
            @keyframes pulseIcon {
              0%, 100% {
                transform: scale(1);
                opacity: 1;
              }
              50% {
                transform: scale(1.15);
                opacity: 0.8;
              }
            }
          `}</style>
        </div>
      )}

      {/* Rotating messages banner */}
      {rotatingMessages.active && rotatingMessages.messages.length > 0 && (() => {
        const safeIndex = Math.min(rotatingMessages.currentIndex, rotatingMessages.messages.length - 1);
        const currentMessage = rotatingMessages.messages[safeIndex];
        if (!currentMessage) return null;
        return (
        <div
          style={{
            position: 'absolute',
            bottom: '8%',
            left: '5%',
            right: '5%',
            padding: '1.5vh 2vw',
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.95), rgba(118, 75, 162, 0.95))',
            borderRadius: '1vh',
            textAlign: 'center',
            fontSize: '2vw',
            fontWeight: 600,
            color: 'white',
            zIndex: 90
          }}
        >
          <div key={`msg-${safeIndex}`} style={{ animation: 'messageSlideIn 0.4s ease-out' }}>
            {currentMessage}
          </div>
          <style>{`
            @keyframes messageSlideIn {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
        );
      })()}

      {/* Status indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: '2%',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '0.5vh 2vw',
          background: isBlank ? '#dc3545' : '#28a745',
          borderRadius: '0.5vh',
          fontSize: '1.2vw',
          fontWeight: 600
        }}
      >
        {isBlank ? 'BLANK' : 'LIVE'}
      </div>
    </div>
  );
};

export default memo(DisplayStage);
