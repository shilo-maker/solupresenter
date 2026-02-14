import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMidiBuilderState, ArrangedSlide, MidiItemType, getItemCategory } from '../hooks/useMidiBuilderState';
import { formatTime } from '../utils/slideUtils';
import { colors, buttonStyles, inputStyles, radius, spacing, shadows, transitions } from '../styles/controlPanelStyles';

// Detect if text starts with RTL characters (Hebrew/Arabic)
// Finds the first alphabetic character (skipping numbers, punctuation, emoji)
const isRTLText = (text: string): boolean => {
  const match = text.match(/[a-zA-Z\u0590-\u05FF\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/);
  if (!match) return false;
  return /[\u0590-\u05FF\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(match[0]);
};

// ============================================================
// STATIC STYLES - Extracted to module level to avoid re-creation
// on every render. These objects are created once and reused.
// ============================================================

// -- Root container --
const rootStyle: React.CSSProperties = {
  height: '100vh',
  display: 'flex',
  flexDirection: 'column',
  background: 'radial-gradient(ellipse at center, #0f0f12 0%, #09090b 70%)',
  color: colors.text.primary,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  overflow: 'hidden',
};

// -- Header styles --
const headerBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 20px',
  background: 'rgba(0, 0, 0, 0.3)',
  borderBottom: `1px solid ${colors.glass.border}`,
  flexShrink: 0,
};

const headerLeftStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
};

const backButtonStyle: React.CSSProperties = {
  ...buttonStyles.base,
  ...buttonStyles.ghost,
  padding: '6px 12px',
  fontSize: '0.8125rem',
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1rem',
  fontWeight: 600,
  background: 'linear-gradient(135deg, #22d3ee, #06b6d4)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
};

// -- Config bar styles --
const configBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
  padding: '10px 20px',
  background: 'rgba(0, 0, 0, 0.15)',
  borderBottom: `1px solid ${colors.glass.border}`,
  flexShrink: 0,
  flexWrap: 'wrap',
};

const songSelectorStyle: React.CSSProperties = {
  position: 'relative',
  flex: '1 1 200px',
  maxWidth: '300px',
};

const configLabelStyle: React.CSSProperties = {
  fontSize: '0.6875rem',
  color: colors.text.muted,
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  marginBottom: '4px',
  display: 'block',
};

const compactInputStyle: React.CSSProperties = {
  ...inputStyles.base,
  padding: '6px 10px',
  fontSize: '0.8125rem',
};

const songDropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  maxHeight: '250px',
  overflowY: 'auto',
  background: colors.background.dropdown,
  border: `1px solid ${colors.glass.borderHover}`,
  borderRadius: radius.md,
  boxShadow: shadows.xl,
  zIndex: 100,
  marginTop: '2px',
};

const songDropdownItemStyle: React.CSSProperties = {
  padding: '8px 10px',
  cursor: 'pointer',
  fontSize: '0.8125rem',
  borderBottom: `1px solid ${colors.glass.border}`,
  transition: `background ${transitions.fast}`,
};

const songTitleStyle: React.CSSProperties = { fontWeight: 500 };
const songArtistStyle: React.CSSProperties = { fontSize: '0.6875rem', color: colors.text.muted };
const emptyDropdownStyle: React.CSSProperties = { padding: '12px', fontSize: '0.75rem', color: colors.text.muted, textAlign: 'center' };

// Stable empty array reference — avoids breaking React.memo on SlideCard
// when slideTimestamps[index] is undefined
const EMPTY_TIMESTAMPS: number[] = [];

const flexAutoStyle: React.CSSProperties = { flex: '0 0 auto' };
const selectInputStyle: React.CSSProperties = {
  ...inputStyles.base,
  padding: '6px 10px',
  fontSize: '0.8125rem',
  width: 'auto',
};

const audioLoaderStyle: React.CSSProperties = {
  flex: '0 0 auto',
  display: 'flex',
  alignItems: 'flex-end',
  gap: '8px',
};

const audioButtonStyle: React.CSSProperties = {
  ...buttonStyles.base,
  ...buttonStyles.secondary,
  padding: '6px 12px',
  fontSize: '0.8125rem',
};

const audioDurationStyle: React.CSSProperties = { fontSize: '0.75rem', color: colors.text.muted, paddingBottom: '2px' };
const audioErrorStyle: React.CSSProperties = { fontSize: '0.6875rem', color: colors.danger.main, paddingBottom: '2px' };

const bpmInputStyle: React.CSSProperties = {
  ...inputStyles.base,
  width: '70px',
  padding: '6px 10px',
  fontSize: '0.8125rem',
  textAlign: 'center' as const,
};

// -- Item type selector styles --
const ITEM_TYPE_OPTIONS: { value: MidiItemType; label: string }[] = [
  { value: 'song', label: 'Song' },
  { value: 'presentation', label: 'Presentation' },
  { value: 'bible', label: 'Bible' },
  { value: 'media', label: 'Media' },
  { value: 'countdown', label: 'Countdown' },
  { value: 'audioPlaylist', label: 'Audio Playlist' },
];

const itemTypeSelectorStyle: React.CSSProperties = {
  flex: '0 0 auto',
};

const itemTypeSelectStyle: React.CSSProperties = {
  ...inputStyles.base,
  padding: '6px 10px',
  fontSize: '0.8125rem',
  width: 'auto',
  minWidth: '130px',
};

// -- Action card styles --
const actionCardContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap',
  justifyContent: 'center',
  padding: '20px',
};

// -- Main content styles --
const mainContentStyle: React.CSSProperties = { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' };

const slideGridContainerStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: '8px 20px',
};

const emptySlideListStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: colors.text.muted,
  fontSize: '0.875rem',
};

const slideGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
  gap: '8px',
  alignContent: 'start',
};

// -- Slide card static parts --
const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  marginBottom: '6px',
  fontSize: '0.7rem',
  fontWeight: 'bold',
};

const cardTimestampBadge: React.CSSProperties = {
  marginLeft: 'auto',
  fontFamily: 'monospace',
  fontSize: '0.65rem',
  padding: '1px 5px',
  borderRadius: '3px',
  backgroundColor: 'rgba(0,0,0,0.3)',
};

const cardTextStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  lineHeight: 1.4,
  color: 'white',
  fontWeight: 500,
};

// -- Timeline styles --
const timelineWrapperStyle: React.CSSProperties = {
  flexShrink: 0,
  padding: '8px 20px',
  borderTop: `1px solid ${colors.glass.border}`,
  background: 'rgba(0, 0, 0, 0.15)',
};

const timelineBaseStyle: React.CSSProperties = {
  position: 'relative',
  height: '48px',
  background: colors.background.surface,
  borderRadius: radius.sm,
  overflow: 'visible',
  userSelect: 'none',
};

const segmentLabelStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  fontSize: '0.5625rem',
  fontWeight: 700,
  color: 'rgba(255,255,255,0.5)',
  whiteSpace: 'nowrap' as const,
  pointerEvents: 'none',
};

const markerHitAreaBase: React.CSSProperties = {
  position: 'absolute',
  top: '-4px',
  bottom: '-4px',
  width: '8px',
  marginLeft: '-4px',
  zIndex: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const markerLineInactive: React.CSSProperties = {
  width: '2px',
  height: '100%',
  background: 'rgba(255,255,255,0.4)',
  borderRadius: '1px',
};

const markerLineActive: React.CSSProperties = {
  ...markerLineInactive,
  background: colors.primary.light,
};

const markerTriangleBase: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  width: 0,
  height: 0,
  borderLeft: '4px solid transparent',
  borderRight: '4px solid transparent',
};

const markerTriangleInactive: React.CSSProperties = {
  ...markerTriangleBase,
  borderTop: '6px solid rgba(255,255,255,0.6)',
};

const markerTriangleActive: React.CSSProperties = {
  ...markerTriangleBase,
  borderTop: `6px solid ${colors.primary.light}`,
};

const playheadBase: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: '2px',
  marginLeft: '-1px',
  background: colors.danger.main,
  zIndex: 20,
  pointerEvents: 'none',
};

// -- Transport styles --
const transportBarStyle: React.CSSProperties = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '12px',
  padding: '12px 20px',
  borderTop: `1px solid ${colors.glass.border}`,
  background: 'rgba(0, 0, 0, 0.2)',
};

const roundButtonBase: React.CSSProperties = {
  ...buttonStyles.base,
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  padding: 0,
};

const playPauseEnabledStyle: React.CSSProperties = {
  ...roundButtonBase,
  ...buttonStyles.secondary,
  opacity: 1,
  cursor: 'pointer',
};

const playPauseDisabledStyle: React.CSSProperties = {
  ...roundButtonBase,
  ...buttonStyles.secondary,
  opacity: 0.3,
  cursor: 'not-allowed',
};

const playIconStyle: React.CSSProperties = { fontSize: '1rem' };
const stopIconStyle: React.CSSProperties = { fontSize: '0.875rem' };

const timeDisplayStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: '0.875rem',
  color: colors.text.secondary,
  minWidth: '100px',
  textAlign: 'center' as const,
};

const recordingHintStyle: React.CSSProperties = {
  fontSize: '0.6875rem',
  color: colors.danger.light,
  animation: 'midiBuilderPulse 1.5s ease-in-out infinite',
};

// -- Export button pre-computed states --
const exportButtonEnabled: React.CSSProperties = {
  ...buttonStyles.base,
  ...buttonStyles.primary,
  opacity: 1,
  cursor: 'pointer',
  padding: '8px 16px',
};

const exportButtonDisabled: React.CSSProperties = {
  ...buttonStyles.base,
  opacity: 0.4,
  cursor: 'not-allowed',
  padding: '8px 16px',
};

const actionBodyStyle: React.CSSProperties = { textAlign: 'center', fontSize: '1.5rem', marginTop: '4px' };
const actionIconSpanStyle: React.CSSProperties = { marginRight: '6px' };
const actionLabelBaseStyle: React.CSSProperties = { fontSize: '0.85rem', fontWeight: 600 };
const actionItemNameStyle: React.CSSProperties = { flex: '1 1 200px', maxWidth: '300px' };

// Media grid dropdown styles
const mediaGridDropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  minWidth: '360px',
  maxHeight: '320px',
  overflowY: 'auto',
  background: colors.background.card,
  border: `1px solid ${colors.glass.border}`,
  borderRadius: '8px',
  marginTop: '4px',
  zIndex: 100,
  padding: '8px',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
  gap: '8px',
};
const mediaGridItemStyle: React.CSSProperties = {
  position: 'relative',
  aspectRatio: '1',
  borderRadius: '6px',
  overflow: 'hidden',
  cursor: 'pointer',
  border: '2px solid transparent',
};
const mediaGridItemSelectedStyle: React.CSSProperties = {
  ...mediaGridItemStyle,
  border: '2px solid #00d4ff',
  boxShadow: '0 0 8px rgba(0, 212, 255, 0.4)',
};
const mediaGridImgStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};
const mediaGridNameStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  padding: '2px 4px',
  background: 'rgba(0,0,0,0.7)',
  color: 'white',
  fontSize: '0.6rem',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

function getMediaUrl(path: string): string {
  return `media://file/${path.replace(/\\/g, '/').split('/').map(s => encodeURIComponent(s)).join('/')}`;
}

// Presentation thumbnail styles
const presThumbnailContainer: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  aspectRatio: '16 / 9',
  borderRadius: '4px',
  overflow: 'hidden',
};
const presTextBoxBase: React.CSSProperties = {
  position: 'absolute',
  overflow: 'hidden',
  padding: '1px',
};
const presTextSpanBase: React.CSSProperties = {
  width: '100%',
  fontSize: '6px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

// Prayer card styles
const prayerBodyStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  lineHeight: '1.3',
  color: 'white',
};
const prayerDescStyle: React.CSSProperties = {
  marginTop: '4px',
  paddingTop: '4px',
  borderTop: '1px dashed rgba(255,255,255,0.2)',
  color: 'rgba(255,255,255,0.6)',
  fontSize: '0.75rem',
  textAlign: 'right',
  direction: 'rtl',
};
const prayerBibleRefStyle: React.CSSProperties = {
  marginTop: '6px',
  paddingTop: '4px',
  borderTop: '1px solid rgba(6,182,212,0.3)',
  color: '#06b6d4',
  fontSize: '0.7rem',
  display: 'flex',
  justifyContent: 'space-between',
  gap: '8px',
};

// ============================================================
// Memoized SlideCard — only re-renders when its own props change.
// During recording, only the affected cards re-render instead
// of the entire grid (~96% reduction in render work).
// ============================================================

interface SlideCardProps {
  arrangedSlide: ArrangedSlide;
  index: number;
  isCurrent: boolean;
  timestamps: number[];
  formatTimestamp: (t: number) => string;
  onSelect: (index: number) => void;
  onClear: (slideIndex: number, timestampIndex: number) => void;
}

const clearBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'rgba(255,255,255,0.4)',
  cursor: 'pointer',
  padding: '0 2px',
  fontSize: '0.7rem',
  lineHeight: 1,
  marginLeft: '2px',
};

const timestampBadgesStyle: React.CSSProperties = {
  marginLeft: 'auto',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '3px',
  justifyContent: 'flex-end',
};

// Pre-computed header styles for current/inactive cards (avoids spread per render)
const cardHeaderCurrent: React.CSSProperties = { ...cardHeaderStyle, color: '#00d4ff' };
const cardHeaderInactive: React.CSSProperties = { ...cardHeaderStyle, color: 'rgba(255,255,255,0.6)' };

// Pre-computed text styles for LTR/RTL (avoids spread per render)
const cardTextLTR: React.CSSProperties = { ...cardTextStyle, direction: 'ltr', textAlign: 'left' };
const cardTextRTL: React.CSSProperties = { ...cardTextStyle, direction: 'rtl', textAlign: 'right' };

// Pre-computed timestamp badge styles
const timestampBadgeRecorded: React.CSSProperties = { ...cardTimestampBadge, color: '#00d4ff', marginLeft: 0 };
const timestampBadgeEmpty: React.CSSProperties = { ...cardTimestampBadge, color: 'rgba(255,255,255,0.4)', marginLeft: 0 };

// Blank slide body style
const blankBodyStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'rgba(255,255,255,0.3)',
  fontSize: '0.75rem',
  fontStyle: 'italic',
};

const SlideCard = React.memo<SlideCardProps>(({ arrangedSlide, index, isCurrent, timestamps, formatTimestamp, onSelect, onClear }) => {
  const isBlank = !!arrangedSlide.isBlank;
  const isAction = !!arrangedSlide.isAction;
  const text = arrangedSlide.slide.originalText || arrangedSlide.slide.translation || '';
  const rtl = !isAction && isRTLText(text);
  const bgColor = arrangedSlide.color;
  const isRecorded = timestamps.length > 0;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onSelect(index);
    (e.currentTarget as HTMLElement).blur();
  }, [index, onSelect]);

  const containerStyle = useMemo<React.CSSProperties>(() => ({
    position: 'relative',
    border: isCurrent ? '2px solid #00d4ff' : isBlank ? '2px dashed rgba(255,255,255,0.2)' : isAction ? `2px solid ${bgColor}88` : '2px solid rgba(255,255,255,0.1)',
    borderRadius: isAction ? '10px' : '6px',
    padding: isAction ? '16px 10px' : '8px 10px',
    cursor: 'pointer',
    backgroundColor: isBlank
      ? (isCurrent ? 'rgba(55, 65, 81, 0.8)' : 'rgba(55, 65, 81, 0.4)')
      : isAction
        ? (isCurrent ? `${bgColor}44` : `${bgColor}22`)
        : bgColor && bgColor !== 'transparent'
          ? (isCurrent ? bgColor : `${bgColor}99`)
          : (isCurrent ? 'rgba(0, 212, 255, 0.2)' : 'rgba(0,0,0,0.3)'),
    boxShadow: isCurrent ? '0 0 10px rgba(0, 212, 255, 0.5)' : 'none',
    minHeight: isBlank || isAction ? '60px' : undefined,
    display: isBlank || isAction ? 'flex' : undefined,
    flexDirection: (isBlank || isAction) ? 'column' as const : undefined,
    alignItems: isAction ? 'center' : undefined,
    justifyContent: isAction ? 'center' : undefined,
  }), [isCurrent, bgColor, isBlank, isAction]);

  return (
    <div
      data-slide-index={index}
      onMouseDown={handleMouseDown}
      style={containerStyle}
    >
      {/* Header: verse type + timestamp badges */}
      <div style={isCurrent ? cardHeaderCurrent : cardHeaderInactive}>
        {isCurrent && <span>▶</span>}
        <span>{arrangedSlide.verseType || `Slide ${index + 1}`}</span>
        <div style={timestampBadgesStyle}>
          {isRecorded ? timestamps.map((t, tIdx) => (
            <span key={tIdx} style={timestampBadgeRecorded}>
              {formatTimestamp(t)}
              <button
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onClear(index, tIdx);
                }}
                style={clearBtnStyle}
                title="Clear timestamp"
              >
                ✕
              </button>
            </span>
          )) : (
            <span style={timestampBadgeEmpty}>
              --:--
            </span>
          )}
        </div>
      </div>
      {/* Body content */}
      {isBlank ? (
        <div style={blankBodyStyle}>Clear Screen</div>
      ) : isAction ? (
        <div style={actionBodyStyle}>
          <span style={actionIconSpanStyle}>{arrangedSlide.actionIcon}</span>
          <span style={{ ...actionLabelBaseStyle, color: bgColor }}>{arrangedSlide.actionLabel}</span>
        </div>
      ) : arrangedSlide.presentationSlide ? (
        /* Free-form presentation thumbnail */
        <div style={{
          ...presThumbnailContainer,
          background: arrangedSlide.presentationSlide.backgroundType === 'gradient' && arrangedSlide.presentationSlide.backgroundGradient
            ? arrangedSlide.presentationSlide.backgroundGradient
            : arrangedSlide.presentationSlide.backgroundType === 'transparent'
            ? 'repeating-conic-gradient(#2a2a2a 0% 25%, #1a1a1a 0% 50%) 50% / 16px 16px'
            : arrangedSlide.presentationSlide.backgroundColor || '#000',
        }}>
          {arrangedSlide.presentationSlide.imageBoxes?.map((ib: any) => (
            <img
              key={ib.id}
              src={ib.src}
              alt=""
              style={{
                position: 'absolute',
                left: `${ib.x}%`,
                top: `${ib.y}%`,
                width: `${ib.width}%`,
                height: `${ib.height}%`,
                objectFit: ib.objectFit || 'contain',
                opacity: ib.opacity ?? 1,
                borderRadius: `${ib.borderRadius || 0}px`,
                zIndex: ib.zIndex ?? 0,
              }}
            />
          ))}
          {arrangedSlide.presentationSlide.textBoxes?.map((tb: any) => (
            <div
              key={tb.id}
              style={{
                ...presTextBoxBase,
                left: `${tb.x}%`,
                top: `${tb.y}%`,
                width: `${tb.width}%`,
                height: `${tb.height}%`,
                backgroundColor: tb.backgroundColor || 'transparent',
                display: 'flex',
                alignItems: tb.verticalAlign === 'top' ? 'flex-start' : tb.verticalAlign === 'bottom' ? 'flex-end' : 'center',
                zIndex: tb.zIndex ?? 0,
              }}
            >
              <span
                dir={tb.textDirection || 'ltr'}
                style={{
                  ...presTextSpanBase,
                  color: tb.color || '#fff',
                  opacity: tb.opacity ?? 1,
                  fontWeight: tb.bold ? '700' : '400',
                  fontStyle: tb.italic ? 'italic' : 'normal',
                  textAlign: tb.textAlign || 'left',
                  direction: tb.textDirection || 'ltr',
                }}
              >
                {tb.text}
              </span>
            </div>
          ))}
        </div>
      ) : arrangedSlide.prayerSubtitle ? (
        /* Prayer/sermon card */
        <div style={prayerBodyStyle}>
          {arrangedSlide.prayerSubtitle.subtitle && (
            <div style={{ textAlign: 'right', direction: 'rtl' }}>
              {arrangedSlide.prayerSubtitle.subtitle}
            </div>
          )}
          {arrangedSlide.prayerSubtitle.description && arrangedSlide.prayerSubtitle.description !== arrangedSlide.prayerSubtitle.subtitle && (
            <div style={prayerDescStyle}>
              {arrangedSlide.prayerSubtitle.description}
            </div>
          )}
          {(arrangedSlide.prayerSubtitle.bibleRef?.hebrewReference || arrangedSlide.prayerSubtitle.bibleRef?.reference) && (
            <div style={prayerBibleRefStyle}>
              {arrangedSlide.prayerSubtitle.bibleRef?.hebrewReference && (
                <span style={{ direction: 'rtl' }}>{arrangedSlide.prayerSubtitle.bibleRef.hebrewReference}</span>
              )}
              {arrangedSlide.prayerSubtitle.bibleRef?.reference && (
                <span style={{ direction: 'ltr', opacity: 0.8 }}>{arrangedSlide.prayerSubtitle.bibleRef.reference}</span>
              )}
            </div>
          )}
        </div>
      ) : (
        <div style={rtl ? cardTextRTL : cardTextLTR}>
          {text}
        </div>
      )}
    </div>
  );
});

// ============================================================
// Component
// ============================================================

const MidiBuilderPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialSongId = searchParams.get('songId');

  const state = useMidiBuilderState();
  const {
    selectedItemType, itemCategory, changeItemType,
    songs, selectedSong, arrangements, activeArrangementId, setActiveArrangementId,
    arrangedSlides, songSearchQuery, setSongSearchQuery, showSongDropdown, setShowSongDropdown,
    selectSong,
    presentations, selectedPresentation, selectPresentation,
    bibleBooks, selectedBibleBook, selectedBibleChapter, bibleLoading,
    handleBibleBookChange, setSelectedBibleChapter,
    selectedMediaType, handleMediaTypeChange, filteredMedia, selectMediaItem,
    audioPlaylists, selectAudioPlaylist,
    selectedItem, selectActionItem, activeItemForDisplay,
    selectedBackground, setSelectedBackground,
    audioRef, audioFilePath, audioFileName, audioDuration, audioCurrentTime,
    isAudioPlaying, audioLoadError, loadAudioFile, isRecording, currentSlideIndex, slideTimestamps,
    startRecording, advanceSlide, selectSlide, markSlideTimestamp, addInstantTimestamp, clearSlideTimestamp, togglePlayPause, stopPlayback,
    seekTo, updateSlideTimestamp, bpm, setBpm, exportMidi, isExporting, hasRecordedSlides,
  } = state;

  const slideListRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [draggingMarker, setDraggingMarker] = useState<{ slideIndex: number; timestampIndex: number } | null>(null);
  const songDropdownRef = useRef<HTMLDivElement>(null);
  const mediaGridRef = useRef<HTMLDivElement>(null);
  const [showMediaGrid, setShowMediaGrid] = useState(false);
  const [bpmInput, setBpmInput] = useState(String(bpm));

  // Cache the timeline rect during drag to avoid repeated getBoundingClientRect calls
  const timelineRectRef = useRef<DOMRect | null>(null);
  // Refs for rAF-driven playhead and time display (bypasses React during playback)
  const playheadRef = useRef<HTMLDivElement>(null);
  const timeDisplayRef = useRef<HTMLSpanElement>(null);

  const isSongType = selectedItemType === 'song';

  // Click on a slide: mark timestamp if recording, just select if not
  // Non-song types: always add instant timestamp (no audio needed)
  const handleSlideClick = useCallback((index: number) => {
    if (!isSongType) {
      addInstantTimestamp(index);
    } else if (isRecording) {
      markSlideTimestamp(index);
    } else {
      selectSlide(index);
    }
  }, [isSongType, isRecording, addInstantTimestamp, markSlideTimestamp, selectSlide]);

  // Sync BPM input display when bpm state changes externally
  useEffect(() => {
    setBpmInput(String(bpm));
  }, [bpm]);

  // Load initial song from URL param
  useEffect(() => {
    if (initialSongId && songs.length > 0 && !selectedSong) {
      const song = songs.find((s: any) => s.id === initialSongId);
      if (song) selectSong(song);
    }
  }, [initialSongId, songs, selectedSong, selectSong]);

  // Auto-scroll slide list to current slide during recording
  // Uses 'auto' behavior to avoid layout thrashing during rapid slide advancement
  useEffect(() => {
    if (isRecording && slideListRef.current) {
      const el = slideListRef.current.querySelector(`[data-slide-index="${currentSlideIndex}"]`);
      if (el) el.scrollIntoView({ behavior: 'auto', block: 'nearest' });
    }
  }, [isRecording, currentSlideIndex]);

  // Keyboard handlers for recording
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key repeats to prevent rapid-firing advanceSlide when holding keys
      if (e.repeat) return;

      // Don't intercept when typing in inputs, textareas, select elements, or activating buttons
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLButtonElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) return;

      if (e.code === 'Escape') {
        setShowSongDropdown(false);
        return;
      }

      if (isRecording && (e.code === 'Space' || e.code === 'ArrowRight')) {
        e.preventDefault();
        advanceSlide();
      } else if (e.code === 'Space' && !isRecording) {
        e.preventDefault();
        togglePlayPause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecording, advanceSlide, togglePlayPause, setShowSongDropdown]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (songDropdownRef.current && !songDropdownRef.current.contains(e.target as Node)) {
        setShowSongDropdown(false);
      }
      if (mediaGridRef.current && !mediaGridRef.current.contains(e.target as Node)) {
        setShowMediaGrid(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [setShowSongDropdown]);

  // rAF-driven playhead and time display during playback
  // Updates DOM directly at ~60fps without triggering React re-renders
  useEffect(() => {
    if (!isAudioPlaying) return;
    let rafId: number;
    const update = () => {
      const audio = audioRef.current;
      if (!audio) return;
      const t = audio.currentTime;
      if (playheadRef.current && audioDuration > 0) {
        const pct = Math.min(100, (t / audioDuration) * 100);
        playheadRef.current.style.left = `${pct}%`;
        playheadRef.current.style.display = 'block';
      }
      if (timeDisplayRef.current) {
        timeDisplayRef.current.textContent = `${formatTime(t)} / ${formatTime(audioDuration)}`;
      }
      rafId = requestAnimationFrame(update);
    };
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [isAudioPlaying, audioDuration]);

  // Click on timeline to seek audio position
  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (!timelineRef.current || !audioDuration) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const time = (x / rect.width) * audioDuration;
    seekTo(time);
  }, [audioDuration, seekTo]);

  // Flatten all timestamps into sorted events for timeline rendering
  const timelineEvents = useMemo(() => {
    const events: { slideIndex: number; timestampIndex: number; time: number }[] = [];
    for (let i = 0; i < slideTimestamps.length; i++) {
      for (let j = 0; j < slideTimestamps[i].length; j++) {
        events.push({ slideIndex: i, timestampIndex: j, time: slideTimestamps[i][j] });
      }
    }
    events.sort((a, b) => a.time - b.time);
    return events;
  }, [slideTimestamps]);

  // Timeline drag handlers (disabled during recording)
  const handleTimelineMouseDown = useCallback((e: React.MouseEvent, slideIndex: number, timestampIndex: number) => {
    if (isRecording) return;
    e.preventDefault();
    e.stopPropagation(); // Don't trigger timeline seek when dragging a marker
    if (timelineRef.current) {
      timelineRectRef.current = timelineRef.current.getBoundingClientRect();
    }
    setDraggingMarker({ slideIndex, timestampIndex });
  }, [isRecording]);

  // Global mouse handlers for drag (works even when mouse leaves the timeline)
  useEffect(() => {
    if (draggingMarker === null) return;

    let rafId: number | null = null;
    let lastClientX = 0;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      lastClientX = e.clientX;
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const rect = timelineRectRef.current;
        if (!rect || rect.width === 0) return;
        const x = Math.max(0, Math.min(lastClientX - rect.left, rect.width));
        const time = (x / rect.width) * audioDuration;
        updateSlideTimestamp(draggingMarker.slideIndex, draggingMarker.timestampIndex, time);
      });
    };

    const handleGlobalMouseUp = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      timelineRectRef.current = null;
      setDraggingMarker(null);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [draggingMarker, audioDuration, updateSlideTimestamp]);

  const formatTimestamp = useCallback((t: number): string => {
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60);
    const ms = Math.floor((t % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
  }, []);

  // Clamp playhead percentage
  const playheadPercent = audioDuration > 0
    ? Math.min(100, (Math.min(audioCurrentTime, audioDuration) / audioDuration) * 100)
    : 0;

  // Pre-compute semi-static styles that depend on boolean flags
  const timelineStyle = useMemo<React.CSSProperties>(() => ({
    ...timelineBaseStyle,
    cursor: draggingMarker !== null ? 'grabbing' : 'pointer',
  }), [draggingMarker !== null]);

  const exportButtonStyle = hasRecordedSlides && !isExporting
    ? exportButtonEnabled
    : exportButtonDisabled;

  const canRecord = isSongType && !!audioFileName && arrangedSlides.length > 0 && !!activeItemForDisplay;

  const recordButtonStyle = useMemo<React.CSSProperties>(() => ({
    ...roundButtonBase,
    background: isRecording
      ? 'rgba(239, 68, 68, 0.3)'
      : !canRecord
        ? colors.background.surface
        : colors.button.danger,
    border: isRecording ? `2px solid ${colors.danger.main}` : 'none',
    opacity: canRecord ? 1 : 0.3,
    cursor: canRecord ? 'pointer' : 'not-allowed',
  }), [isRecording, canRecord]);

  const recordIconStyle = useMemo<React.CSSProperties>(() => ({
    width: isRecording ? '12px' : '14px',
    height: isRecording ? '12px' : '14px',
    borderRadius: isRecording ? '2px' : '50%',
    background: isRecording ? colors.danger.main : '#fff',
    margin: 'auto',
  }), [isRecording]);

  const playPauseStyle = audioFileName ? playPauseEnabledStyle : playPauseDisabledStyle;
  const stopButtonStyle = playPauseStyle; // Same logic

  return (
    <div style={rootStyle}>
      {/* Hidden audio element */}
      <audio ref={audioRef} />

      {/* Header */}
      <div style={headerBarStyle}>
        <div style={headerLeftStyle}>
          <button
            onClick={() => navigate('/')}
            style={backButtonStyle}
          >
            ← Back
          </button>
          <h1 style={titleStyle}>
            MIDI Arrangement Builder
          </h1>
        </div>
        <button
          onClick={exportMidi}
          disabled={!hasRecordedSlides || isExporting}
          style={exportButtonStyle}
        >
          {isExporting ? 'Exporting...' : 'Export MIDI'}
        </button>
      </div>

      {/* Config Bar */}
      <div style={configBarStyle}>
        {/* Item Type Selector */}
        <div style={itemTypeSelectorStyle}>
          <label style={configLabelStyle}>
            Type
          </label>
          <select
            value={selectedItemType}
            onChange={(e) => changeItemType(e.target.value as MidiItemType)}
            style={itemTypeSelectStyle}
          >
            {ITEM_TYPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Song Selector */}
        {selectedItemType === 'song' && (
          <div ref={songDropdownRef} style={songSelectorStyle}>
            <label style={configLabelStyle}>
              Song
            </label>
            <input
              type="text"
              value={showSongDropdown ? songSearchQuery : (selectedSong?.title || '')}
              onChange={(e) => { setSongSearchQuery(e.target.value); setShowSongDropdown(true); }}
              onFocus={() => setShowSongDropdown(true)}
              placeholder="Search songs..."
              style={compactInputStyle}
            />
            {showSongDropdown && (
              <div style={songDropdownStyle}>
                {songs.map((song: any) => (
                  <div
                    key={song.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectSong(song);
                    }}
                    style={songDropdownItemStyle}
                    onMouseEnter={(e) => (e.currentTarget.style.background = colors.glass.hover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={songTitleStyle}>{song.title}</div>
                    {song.artist && (
                      <div style={songArtistStyle}>{song.artist}</div>
                    )}
                  </div>
                ))}
                {songs.length === 0 && (
                  <div style={emptyDropdownStyle}>
                    No songs found
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bible Book & Chapter Selectors */}
        {selectedItemType === 'bible' && (
          <>
            <div style={{ flex: '1 1 180px', maxWidth: '280px' }}>
              <label style={configLabelStyle}>Book</label>
              <select
                value={selectedBibleBook}
                onChange={(e) => handleBibleBookChange(e.target.value)}
                style={itemTypeSelectStyle}
              >
                <option value="">Select a book...</option>
                <optgroup label="Old Testament">
                  {bibleBooks.filter((b: any) => b.testament === 'old').map((book: any) => (
                    <option key={book.name} value={book.name}>
                      {book.hebrewName ? `${book.hebrewName} - ${book.name}` : book.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="New Testament">
                  {bibleBooks.filter((b: any) => b.testament === 'new').map((book: any) => (
                    <option key={book.name} value={book.name}>
                      {book.hebrewName ? `${book.hebrewName} - ${book.name}` : book.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
            {selectedBibleBook && (
              <div style={{ flex: '0 0 100px' }}>
                <label style={configLabelStyle}>Chapter</label>
                <select
                  value={selectedBibleChapter}
                  onChange={(e) => setSelectedBibleChapter(e.target.value ? parseInt(e.target.value) : '')}
                  style={itemTypeSelectStyle}
                >
                  <option value="">Ch...</option>
                  {Array.from(
                    { length: bibleBooks.find((b: any) => b.name === selectedBibleBook)?.chapters || 0 },
                    (_, i) => i + 1
                  ).map(ch => (
                    <option key={ch} value={ch}>{ch}</option>
                  ))}
                </select>
              </div>
            )}
            {bibleLoading && (
              <div style={{ alignSelf: 'flex-end', padding: '6px 0', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>
                Loading...
              </div>
            )}
            {selectedSong && !bibleLoading && (
              <div style={{ alignSelf: 'flex-end', padding: '6px 0', color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem' }}>
                {selectedSong.title} — {selectedSong.slides?.length || 0} verses
              </div>
            )}
          </>
        )}

        {selectedItemType === 'presentation' && (
          <div ref={songDropdownRef} style={songSelectorStyle}>
            <label style={configLabelStyle}>
              Presentation
            </label>
            <input
              type="text"
              value={showSongDropdown ? songSearchQuery : (selectedPresentation?.title || '')}
              onChange={(e) => { setSongSearchQuery(e.target.value); setShowSongDropdown(true); }}
              onFocus={() => setShowSongDropdown(true)}
              placeholder="Search presentations..."
              style={compactInputStyle}
            />
            {showSongDropdown && (
              <div style={songDropdownStyle}>
                {presentations.map((pres: any) => (
                  <div
                    key={pres.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectPresentation(pres);
                    }}
                    style={songDropdownItemStyle}
                    onMouseEnter={(e) => (e.currentTarget.style.background = colors.glass.hover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={songTitleStyle}>{pres.title}</div>
                    <div style={songArtistStyle}>{pres.slides?.length || 0} slides</div>
                  </div>
                ))}
                {presentations.length === 0 && (
                  <div style={emptyDropdownStyle}>
                    No presentations found
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Media type + item selectors */}
        {selectedItemType === 'media' && (
          <>
            <div style={{ flex: '0 0 auto' }}>
              <label style={configLabelStyle}>Media Type</label>
              <select
                value={selectedMediaType}
                onChange={(e) => { handleMediaTypeChange(e.target.value as 'video' | 'image' | 'audio'); setShowMediaGrid(false); }}
                style={itemTypeSelectStyle}
              >
                <option value="video">Video</option>
                <option value="image">Image</option>
                <option value="audio">Audio</option>
              </select>
            </div>
            {selectedMediaType === 'image' || selectedMediaType === 'video' ? (
              /* Image / Video grid picker */
              <div ref={mediaGridRef} style={{ flex: '1 1 200px', maxWidth: '300px', position: 'relative' }}>
                <label style={configLabelStyle}>Item</label>
                <div
                  onMouseDown={() => setShowMediaGrid(!showMediaGrid)}
                  style={{
                    ...compactInputStyle,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {selectedItem ? (
                    <>
                      <img
                        src={getMediaUrl(selectedItem.thumbnailPath || selectedItem.mediaPath)}
                        alt=""
                        style={{ width: '24px', height: '24px', objectFit: 'cover', borderRadius: '3px', flexShrink: 0 }}
                      />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedItem.name}</span>
                    </>
                  ) : (
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>Select {selectedMediaType}...</span>
                  )}
                </div>
                {showMediaGrid && (
                  <div style={mediaGridDropdownStyle}>
                    {filteredMedia.map((m: any) => (
                      <div
                        key={m.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selectMediaItem(m.id);
                          setShowMediaGrid(false);
                        }}
                        style={selectedItem?.id === m.id ? mediaGridItemSelectedStyle : mediaGridItemStyle}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = selectedItem?.id === m.id ? '#00d4ff' : 'transparent'; }}
                        title={m.name}
                      >
                        <img
                          src={getMediaUrl(m.thumbnailPath || m.processedPath)}
                          alt={m.name}
                          loading="lazy"
                          style={mediaGridImgStyle}
                        />
                        <div style={mediaGridNameStyle}>{m.name}</div>
                      </div>
                    ))}
                    {filteredMedia.length === 0 && (
                      <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: '16px', fontSize: '0.8rem' }}>
                        No {selectedMediaType}s in library
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Audio dropdown */
              <div style={{ flex: '1 1 200px', maxWidth: '300px' }}>
                <label style={configLabelStyle}>Item</label>
                <select
                  value={selectedItem?.id || ''}
                  onChange={(e) => selectMediaItem(e.target.value)}
                  style={itemTypeSelectStyle}
                >
                  <option value="">Select {selectedMediaType}...</option>
                  {filteredMedia.map((m: any) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        {/* Generic action-based item name (non-media) */}
        {/* Countdown creator */}
        {selectedItemType === 'countdown' && (
          <>
            <div style={{ flex: '0 0 auto' }}>
              <label style={configLabelStyle}>Time</label>
              <input
                type="time"
                step="1"
                value={selectedItem?.countdownTime || ''}
                onChange={(e) => {
                  const time = e.target.value;
                  const msg = selectedItem?.countdownMessage || '';
                  const title = `⏱ ${time}${msg ? ` - ${msg}` : ''}`;
                  selectActionItem({ id: 'countdown', countdownTime: time, countdownMessage: msg, title, name: title });
                }}
                style={{ ...compactInputStyle, width: '120px' }}
              />
            </div>
            <div style={{ flex: '1 1 180px', maxWidth: '280px' }}>
              <label style={configLabelStyle}>Message</label>
              <input
                type="text"
                value={selectedItem?.countdownMessage || ''}
                onChange={(e) => {
                  const msg = e.target.value;
                  const time = selectedItem?.countdownTime || '';
                  const title = `⏱ ${time}${msg ? ` - ${msg}` : ''}`;
                  selectActionItem({ id: 'countdown', countdownTime: time, countdownMessage: msg, title, name: title });
                }}
                placeholder="Message (optional)"
                style={compactInputStyle}
              />
            </div>
          </>
        )}

        {/* Audio playlist selector */}
        {selectedItemType === 'audioPlaylist' && (
          <div style={{ flex: '1 1 200px', maxWidth: '300px' }}>
            <label style={configLabelStyle}>Playlist</label>
            <select
              value={selectedItem?.id || ''}
              onChange={(e) => selectAudioPlaylist(e.target.value)}
              style={itemTypeSelectStyle}
            >
              <option value="">Select playlist...</option>
              {audioPlaylists.map((pl: any) => (
                <option key={pl.id} value={pl.id}>
                  {pl.name} ({pl.tracks?.length || 0} tracks)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Arrangement Selector (songs only) */}
        {selectedItemType === 'song' && arrangements.length > 1 && (
          <div style={flexAutoStyle}>
            <label style={configLabelStyle}>
              Arrangement
            </label>
            <select
              value={activeArrangementId || ''}
              onChange={(e) => setActiveArrangementId(e.target.value)}
              style={selectInputStyle}
            >
              {arrangements.map(arr => (
                <option key={arr.id} value={arr.id}>{arr.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Audio Loader (songs only) */}
        {isSongType && (
          <div style={audioLoaderStyle}>
            <div>
              <label style={configLabelStyle}>
                Audio
              </label>
              <button
                onClick={loadAudioFile}
                style={audioButtonStyle}
              >
                {audioFileName || 'Load Audio'}
              </button>
            </div>
            {audioDuration > 0 && (
              <span style={audioDurationStyle}>
                ({formatTime(audioDuration)})
              </span>
            )}
            {audioLoadError && (
              <span style={audioErrorStyle}>
                {audioLoadError}
              </span>
            )}
          </div>
        )}

        {/* BPM Input - songs only */}
        {isSongType && (
          <div style={flexAutoStyle}>
            <label style={configLabelStyle}>
              BPM
            </label>
            <input
              type="number"
              min={4}
              max={999}
              value={bpmInput}
              onChange={(e) => {
                setBpmInput(e.target.value);
                const v = parseInt(e.target.value);
                if (!isNaN(v) && v >= 4 && v <= 999) setBpm(v);
              }}
              onBlur={() => {
                // On blur, validate and reset to current bpm if invalid
                const v = parseInt(bpmInput);
                if (isNaN(v) || v < 4 || v > 999) {
                  setBpmInput(String(bpm));
                }
              }}
              style={bpmInputStyle}
            />
          </div>
        )}
      </div>

      {/* Main Content */}
      <div style={mainContentStyle}>
        {/* Slide Card Grid */}
        <div
          ref={slideListRef}
          style={slideGridContainerStyle}
        >
          {arrangedSlides.length === 0 ? (
            <div style={emptySlideListStyle}>
              {activeItemForDisplay
                ? (itemCategory === 'action-based' ? 'Enter an item name to see actions' : 'No slides found')
                : `Select ${selectedItemType === 'song' ? 'a song' : selectedItemType === 'presentation' ? 'a presentation' : `a ${selectedItemType}`} to begin`}
            </div>
          ) : (
            <div style={slideGridStyle}>
              {arrangedSlides.map((as, index) => (
                <SlideCard
                  key={index}
                  arrangedSlide={as}
                  index={index}
                  isCurrent={index === currentSlideIndex}
                  timestamps={slideTimestamps[index] || EMPTY_TIMESTAMPS}
                  formatTimestamp={formatTimestamp}
                  onSelect={handleSlideClick}
                  onClear={clearSlideTimestamp}
                />
              ))}
            </div>
          )}
        </div>

        {/* Timeline (songs only) */}
        {isSongType && arrangedSlides.length > 0 && audioDuration > 0 && (
          <div style={timelineWrapperStyle}>
            <div
              ref={timelineRef}
              style={timelineStyle}
              onMouseDown={handleTimelineClick}
            >
              {/* Section colored segments from sorted timeline events */}
              {timelineEvents.map((evt, evtIdx) => {
                const as = arrangedSlides[evt.slideIndex];
                if (!as) return null;
                const endTime = evtIdx + 1 < timelineEvents.length
                  ? timelineEvents[evtIdx + 1].time
                  : audioDuration;

                const left = Math.max(0, (evt.time / audioDuration) * 100);
                const width = Math.max(0, ((endTime - evt.time) / audioDuration) * 100);

                return (
                  <div
                    key={`seg-${evt.slideIndex}-${evt.timestampIndex}`}
                    style={{
                      position: 'absolute',
                      left: `${left}%`,
                      width: `${width}%`,
                      top: 0,
                      bottom: 0,
                      background: as.color === 'transparent' ? 'rgba(255,255,255,0.05)' : `${as.color}33`,
                      borderRight: evtIdx < timelineEvents.length - 1 ? `1px solid ${colors.glass.border}` : 'none',
                    }}
                  >
                    <span style={segmentLabelStyle}>
                      {as.sectionAbbr}
                    </span>
                  </div>
                );
              })}

              {/* Draggable markers */}
              {timelineEvents.map((evt) => {
                const left = Math.min(100, (evt.time / audioDuration) * 100);
                const isDragging = draggingMarker !== null
                  && draggingMarker.slideIndex === evt.slideIndex
                  && draggingMarker.timestampIndex === evt.timestampIndex;

                return (
                  <div
                    key={`marker-${evt.slideIndex}-${evt.timestampIndex}`}
                    onMouseDown={(e) => handleTimelineMouseDown(e, evt.slideIndex, evt.timestampIndex)}
                    style={{
                      ...markerHitAreaBase,
                      left: `${left}%`,
                      cursor: isRecording ? 'default' : 'grab',
                    }}
                  >
                    <div style={isDragging ? markerLineActive : markerLineInactive} />
                    <div style={isDragging ? markerTriangleActive : markerTriangleInactive} />
                  </div>
                );
              })}

              {/* Playhead — positioned by rAF during playback, by React when paused */}
              <div
                ref={playheadRef}
                style={{
                  ...playheadBase,
                  left: `${playheadPercent}%`,
                  display: (isAudioPlaying || playheadPercent > 0) ? 'block' : 'none',
                }}
              />
            </div>
          </div>
        )}

        {/* Transport Controls */}
        {isSongType ? (
          <div style={transportBarStyle}>
            {/* Record button */}
            <button
              onClick={startRecording}
              disabled={!canRecord}
              title="Start recording (plays audio and records slide timings)"
              style={recordButtonStyle}
            >
              <div style={recordIconStyle} />
            </button>

            {/* Play/Pause button */}
            <button
              onClick={togglePlayPause}
              disabled={!audioFileName}
              style={playPauseStyle}
            >
              <span style={playIconStyle}>
                {isAudioPlaying ? '\u23F8' : '\u25B6'}
              </span>
            </button>

            {/* Stop button */}
            <button
              onClick={stopPlayback}
              disabled={!audioFileName}
              style={stopButtonStyle}
            >
              <span style={stopIconStyle}>{'\u23F9'}</span>
            </button>

            {/* Time display — updated by rAF during playback, React when paused */}
            <span ref={timeDisplayRef} style={timeDisplayStyle}>
              {formatTime(audioCurrentTime)} / {formatTime(audioDuration)}
            </span>

            {/* Recording hint */}
            {isRecording && (
              <span style={recordingHintStyle}>
                {itemCategory === 'action-based'
                  ? 'Click actions or press Space to mark timing'
                  : 'Click slides or press Space to mark timing'}
              </span>
            )}
          </div>
        ) : arrangedSlides.length > 0 && (
          <div style={transportBarStyle}>
            <span style={{ fontSize: '0.8125rem', color: colors.text.muted }}>
              Click {itemCategory === 'action-based' ? 'actions' : 'slides'} to add MIDI commands (1s each)
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MidiBuilderPage;
