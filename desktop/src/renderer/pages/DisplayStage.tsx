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
}

interface StageTextStyle {
  visible: boolean;
  color: string;
  fontSize: number;
  fontWeight: string;
  opacity: number;
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
    original: { visible: true, color: '#ffffff', fontSize: 100, fontWeight: '500', opacity: 1 },
    transliteration: { visible: true, color: 'rgba(255,255,255,0.9)', fontSize: 70, fontWeight: '400', opacity: 1 },
    translation: { visible: true, color: 'rgba(255,255,255,0.7)', fontSize: 60, fontWeight: '400', opacity: 1 }
  }
};

// Tool state interfaces
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

const DisplayStage: React.FC = () => {
  const [currentSlide, setCurrentSlide] = useState<SlideData | null>(null);
  const [nextSlide, setNextSlide] = useState<SlideData | null>(null);
  const [songTitle, setSongTitle] = useState<string>('');
  const [isBlank, setIsBlank] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [theme, setTheme] = useState<StageTheme>(DEFAULT_THEME);

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
          colors: newTheme.colors || DEFAULT_THEME.colors,
          elements: newTheme.elements || DEFAULT_THEME.elements,
          currentSlideText: newTheme.currentSlideText || DEFAULT_THEME.currentSlideText
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

    // Update clock
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      slideCleanup();
      stageThemeCleanup();
      toolCleanup();
      clearInterval(clockInterval);
    };
  }, []);

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
            paddingLeft: '1%',
            fontSize: '2vw',
            fontWeight: 600,
            color: elements.songTitle.color || colors.accent
          }}
        >
          {songTitle || 'SoluPresenter'}
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
            justifyContent: 'flex-end',
            paddingRight: '1%',
            fontSize: '2.5vw',
            fontWeight: 700,
            fontFamily: elements.clock.fontFamily || 'monospace',
            color: elements.clock.color || colors.text
          }}
        >
          {formatTime(currentTime)}
        </div>
      )}

      {/* Current Slide Area */}
      <div
        style={{
          position: 'absolute',
          left: `${elements.currentSlideArea.x}%`,
          top: `${elements.currentSlideArea.y}%`,
          width: `${elements.currentSlideArea.width}%`,
          height: `${elements.currentSlideArea.height}%`,
          background: elements.currentSlideArea.backgroundColor || 'rgba(0,0,0,0.5)',
          borderRadius: `${elements.currentSlideArea.borderRadius || 8}px`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          padding: '2%',
          boxSizing: 'border-box'
        }}
      >
        <div
          style={{
            fontSize: '1vw',
            color: colors.secondary,
            marginBottom: '1vh',
            textTransform: 'uppercase',
            letterSpacing: '0.2em'
          }}
        >
          Current
        </div>

        {isBlank ? (
          <div style={{ fontSize: '3vw', color: 'rgba(255,255,255,0.3)' }}>BLANK</div>
        ) : currentSlide ? (
          // Check if this is prayer content (has title) or song content (has originalText)
          currentSlide.title ? (
            // Render prayer/sermon content
            <>
              {currentSlide.title && (
                <div
                  style={{
                    fontSize: `${currentSlideText.original.fontSize / 25}vw`,
                    fontWeight: currentSlideText.original.fontWeight as any,
                    color: currentSlideText.original.color,
                    opacity: currentSlideText.original.opacity,
                    marginBottom: '1vh',
                    direction: 'rtl',
                    lineHeight: 1.3
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
                    marginBottom: '2vh'
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
                    lineHeight: 1.3
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
                    marginBottom: '2vh'
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
                    lineHeight: 1.4
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
                    marginBottom: '2vh'
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
            </>
          ) : (
            // Render song content (original, transliteration, translation)
            <>
              {currentSlideText.original.visible && currentSlide.originalText && (
                <div
                  style={{
                    fontSize: `${currentSlideText.original.fontSize / 25}vw`,
                    fontWeight: currentSlideText.original.fontWeight as any,
                    color: currentSlideText.original.color,
                    opacity: currentSlideText.original.opacity,
                    marginBottom: '2vh',
                    direction: 'rtl',
                    lineHeight: 1.3
                  }}
                >
                  {currentSlide.originalText}
                </div>
              )}
              {currentSlideText.transliteration.visible && currentSlide.transliteration && (
                <div
                  style={{
                    fontSize: `${currentSlideText.transliteration.fontSize / 30}vw`,
                    fontWeight: currentSlideText.transliteration.fontWeight as any,
                    color: currentSlideText.transliteration.color,
                    opacity: currentSlideText.transliteration.opacity,
                    marginBottom: '1vh'
                  }}
                >
                  {currentSlide.transliteration}
                </div>
              )}
              {currentSlideText.translation.visible && currentSlide.translation && (
                <div
                  style={{
                    fontSize: `${currentSlideText.translation.fontSize / 35}vw`,
                    fontWeight: currentSlideText.translation.fontWeight as any,
                    color: currentSlideText.translation.color,
                    opacity: currentSlideText.translation.opacity
                  }}
                >
                  {currentSlide.translation}
                </div>
              )}
            </>
          )
        ) : (
          <div style={{ fontSize: '2vw', color: 'rgba(255,255,255,0.3)' }}>
            Waiting for content...
          </div>
        )}
      </div>

      {/* Next Slide Preview */}
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
            display: 'flex',
            flexDirection: 'column',
            padding: '2%',
            boxSizing: 'border-box',
            opacity: elements.nextSlideArea.opacity ?? 1
          }}
        >
          <div
            style={{
              fontSize: '1vw',
              color: elements.nextSlideArea.labelColor || colors.secondary,
              marginBottom: '1vh',
              textTransform: 'uppercase',
              letterSpacing: '0.2em'
            }}
          >
            {elements.nextSlideArea.labelText || 'Next'}
          </div>

          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center'
            }}
          >
            {nextSlide ? (
              // Check if next slide is prayer content (has title) or song content
              nextSlide.title ? (
                // Prayer/sermon next preview
                <>
                  {nextSlide.title && (
                    <div
                      style={{
                        fontSize: '1.8vw',
                        fontWeight: 600,
                        marginBottom: '0.5vh',
                        direction: 'rtl',
                        color: 'rgba(255,255,255,0.8)',
                        lineHeight: 1.3
                      }}
                    >
                      {nextSlide.title}
                    </div>
                  )}
                  {nextSlide.titleTranslation && (
                    <div
                      style={{
                        fontSize: '1.2vw',
                        color: 'rgba(255,255,255,0.5)',
                        marginBottom: '0.5vh'
                      }}
                    >
                      {nextSlide.titleTranslation}
                    </div>
                  )}
                  {nextSlide.subtitle && (
                    <div
                      style={{
                        fontSize: '1.4vw',
                        fontWeight: 500,
                        direction: 'rtl',
                        color: 'rgba(255,255,255,0.6)',
                        marginTop: '0.5vh'
                      }}
                    >
                      {nextSlide.subtitle}
                    </div>
                  )}
                </>
              ) : (
                // Song next preview
                <>
                  {nextSlide.originalText && (
                    <div
                      style={{
                        fontSize: '2vw',
                        fontWeight: 500,
                        marginBottom: '1vh',
                        direction: 'rtl',
                        color: 'rgba(255,255,255,0.8)',
                        lineHeight: 1.3
                      }}
                    >
                      {nextSlide.originalText}
                    </div>
                  )}
                  {nextSlide.transliteration && (
                    <div
                      style={{
                        fontSize: '1.2vw',
                        color: 'rgba(255,255,255,0.5)'
                      }}
                    >
                      {nextSlide.transliteration}
                    </div>
                  )}
                </>
              )
            ) : (
              <div style={{ fontSize: '1.5vw', color: 'rgba(255,255,255,0.2)' }}>
                End of content
              </div>
            )}
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
