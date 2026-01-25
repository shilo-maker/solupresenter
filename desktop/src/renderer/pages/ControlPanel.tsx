import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { createLogger } from '../utils/debug';

// Create logger for this module
const log = createLogger('ControlPanel');

// YouTube IFrame API types
declare global {
  interface Window {
    YT: {
      Player: new (element: HTMLElement | string, options: any) => any;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../contexts/SettingsContext';
import { useSetlist, SetlistItem as ContextSetlistItem, SavedSetlist as ContextSavedSetlist } from '../contexts/SetlistContext';
import logoImage from '../assets/logo.png';
import AuthModal from '../components/AuthModal';
import BroadcastSelector from '../components/BroadcastSelector';
import MediaGrid from '../components/MediaGrid';
import SlidePreview from '../components/SlidePreview';
import ThemeSelectionPanel from '../components/control-panel/ThemeSelectionPanel';
import SlideGridItem from '../components/control-panel/SlideGridItem';
import CombinedSlideGridItem from '../components/control-panel/CombinedSlideGridItem';
import AudioPlayerBar from '../components/control-panel/AudioPlayerBar';
import { gradientPresets } from '../utils/gradients';
import {
  colors,
  buttonStyles,
  inputStyles,
  cardStyles,
  dropdownStyles,
  panelStyles,
  tabStyles,
  emptyStateStyles,
  flexStyles,
} from '../styles/controlPanelStyles';

interface Display {
  id: number;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  isPrimary: boolean;
  isAssigned: boolean;
  assignedType?: 'viewer' | 'stage';
}

interface Song {
  id: string;
  title: string;
  originalLanguage?: string;
  tags?: string[];
  slides: Array<{
    originalText?: string;
    transliteration?: string;
    translation?: string;
    translationOverflow?: string;
    verseType?: string;
  }>;
  author?: string;
}

interface AudioPlaylistTrack {
  path: string;
  name: string;
  duration?: number | null;
}

interface SetlistItem {
  id: string;
  type: 'song' | 'blank' | 'section' | 'countdown' | 'announcement' | 'messages' | 'media' | 'bible' | 'presentation' | 'youtube' | 'clock' | 'stopwatch' | 'audioPlaylist';
  song?: Song;
  title?: string;
  // Tool-specific data
  countdownTime?: string;
  countdownMessage?: string;
  announcementText?: string;
  messages?: string[];
  messagesInterval?: number;
  // Media data
  mediaType?: 'video' | 'image' | 'audio';
  mediaPath?: string;
  mediaDuration?: number | null;
  mediaName?: string;
  thumbnailPath?: string | null;
  // Audio playlist data
  audioPlaylist?: {
    tracks: AudioPlaylistTrack[];
    shuffle: boolean;
    name: string;
  };
  // Presentation data
  presentation?: Presentation;
  // Bible data
  bibleData?: {
    book: string;
    chapter: number;
    verses?: any[];
  };
  displayMode?: 'bilingual' | 'original';
  // YouTube data
  youtubeVideoId?: string;
  youtubeTitle?: string;
  youtubeThumbnail?: string;
}

interface SavedSetlist {
  id: string;
  name: string;
  venue?: string;
  items: SetlistItem[];
  createdAt: string;  // ISO timestamp string
  updatedAt?: string;
}

type DisplayMode = 'bilingual' | 'original' | 'translation';
type ResourcePanel = 'songs' | 'media' | 'tools' | 'bible' | 'presentations';

interface QuickModeMetadata {
  type: 'sermon' | 'prayer' | 'announcements';
  title: string;
  subtitles: Array<{
    subtitle: string;
    subtitleTranslation?: string;
    description?: string;
    descriptionTranslation?: string;
    bibleRef?: { reference: string; hebrewReference?: string };
  }>;
}

interface Presentation {
  id: string;
  title: string;
  slides: Array<{
    id: string;
    order: number;
    textBoxes: any[];
    imageBoxes?: any[];
    backgroundColor?: string;
    backgroundType?: 'color' | 'gradient' | 'transparent';
    backgroundGradient?: string;
  }>;
  canvasDimensions?: { width: number; height: number };
  createdAt: string;
  updatedAt: string;
  quickModeData?: QuickModeMetadata;
}

interface BibleBook {
  name: string;
  chapters: number;
  hebrewName?: string;
  testament?: 'old' | 'new';
}

interface BibleSlide {
  originalText: string;
  transliteration: string;
  translation: string;
  verseType: string;
  reference: string;
  hebrewReference: string;
}

// Combined slide types for original-only mode
interface CombinedSlideItem {
  type: 'single' | 'combined';
  originalIndex?: number;
  originalIndices?: number[];
  slide?: Song['slides'][0];
  slides?: Song['slides'];
  label: string;
  verseType: string;
}

interface CombinedSlidesResult {
  combinedSlides: CombinedSlideItem[];
  originalToCombined: Map<number, number>;
  combinedToOriginal: Map<number, number[]>;
}

// Utility function to create combined slides for original-only mode
function createCombinedSlides(slides: Song['slides']): CombinedSlidesResult {
  if (!slides || slides.length === 0) {
    return {
      combinedSlides: [],
      originalToCombined: new Map(),
      combinedToOriginal: new Map()
    };
  }

  const combinedSlides: CombinedSlideItem[] = [];
  const originalToCombined = new Map<number, number>();
  const combinedToOriginal = new Map<number, number[]>();

  let i = 0;
  while (i < slides.length) {
    const currentType = slides[i].verseType || '';

    // If slide has no verseType, keep it as single (don't combine)
    if (!currentType) {
      const combinedIndex = combinedSlides.length;
      combinedSlides.push({
        type: 'single',
        originalIndex: i,
        slide: slides[i],
        label: `${i + 1}`,
        verseType: ''
      });
      originalToCombined.set(i, combinedIndex);
      combinedToOriginal.set(combinedIndex, [i]);
      i++;
      continue;
    }

    // Find all consecutive slides with the same verseType
    let groupEnd = i;
    while (groupEnd < slides.length) {
      const nextType = slides[groupEnd].verseType || '';
      if (nextType !== currentType) break;
      groupEnd++;
    }

    // Pair slides within this group (2-by-2, max 4 slides per combined group for readability)
    const MAX_COMBINED_SLIDES = 4;
    let j = i;
    while (j < groupEnd) {
      const combinedIndex = combinedSlides.length;
      const remainingInGroup = groupEnd - j;

      // Combine up to MAX_COMBINED_SLIDES at a time
      const slidesToCombine = Math.min(2, remainingInGroup, MAX_COMBINED_SLIDES);

      if (slidesToCombine >= 2) {
        // Can pair: combine slides
        const indices = Array.from({ length: slidesToCombine }, (_, k) => j + k);
        combinedSlides.push({
          type: 'combined',
          originalIndices: indices,
          slides: indices.map(idx => slides[idx]),
          label: `${j + 1}-${j + slidesToCombine}`,
          verseType: currentType
        });
        indices.forEach(idx => originalToCombined.set(idx, combinedIndex));
        combinedToOriginal.set(combinedIndex, indices);
        j += slidesToCombine;
      } else {
        // Last slide in group with odd count: stays single
        combinedSlides.push({
          type: 'single',
          originalIndex: j,
          slide: slides[j],
          label: `${j + 1}`,
          verseType: currentType
        });
        originalToCombined.set(j, combinedIndex);
        combinedToOriginal.set(combinedIndex, [j]);
        j += 1;
      }
    }

    i = groupEnd;
  }

  return {
    combinedSlides,
    originalToCombined,
    combinedToOriginal
  };
}

// Memoized SongItem component to prevent unnecessary re-renders
interface SongItemProps {
  song: Song;
  isSelected: boolean;
  isDragged: boolean;
  onSelect: (song: Song) => void;
  onDoubleClick: (song: Song) => void;
  onEdit: (song: Song) => void;
  onDelete: (id: string) => void;
  onDragStart: (song: Song) => void;
  onDragEnd: () => void;
}

const SongItem = memo<SongItemProps>(({
  song,
  isSelected,
  isDragged,
  onSelect,
  onDoubleClick,
  onEdit,
  onDelete,
  onDragStart,
  onDragEnd
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const [isHovered, setIsHovered] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const containerStyle = useMemo(() => ({
    padding: '10px 12px',
    cursor: 'grab' as const,
    background: isSelected ? 'rgba(6,182,212,0.2)' : 'transparent',
    borderLeft: isSelected ? `3px solid ${colors.button.accent}` : '3px solid transparent',
    borderBottom: `1px solid ${colors.border.light}`,
    opacity: isDragged ? 0.5 : 1,
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    position: 'relative' as const,
  }), [isSelected, isDragged]);

  const menuButtonStyle = useMemo(() => ({
    background: colors.background.cardHover,
    border: 'none',
    borderRadius: '4px',
    padding: '4px 6px',
    cursor: 'pointer' as const,
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: '2px',
    alignItems: 'center' as const,
  }), []);

  const dropdownStyle = useMemo(() => ({
    position: 'absolute' as const,
    top: '100%',
    right: isRTL ? 'auto' : 0,
    left: isRTL ? 0 : 'auto',
    marginTop: '4px',
    background: colors.background.dropdown,
    borderRadius: '6px',
    border: `1px solid ${colors.border.medium}`,
    padding: '4px',
    minWidth: '120px',
    zIndex: 100,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  }), [isRTL]);

  return (
    <div
      draggable
      onDragStart={(e) => {
        onDragStart(song);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onDragEnd={onDragEnd}
      onClick={() => onSelect(song)}
      onDoubleClick={() => onDoubleClick(song)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setShowMenu(false); }}
      style={containerStyle}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: 'white', fontWeight: 500, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</div>
      </div>
      {(isHovered || showMenu) && (
        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            style={menuButtonStyle}
          >
            <span style={{ width: '3px', height: '3px', background: colors.text.secondary, borderRadius: '50%' }} />
            <span style={{ width: '3px', height: '3px', background: colors.text.secondary, borderRadius: '50%' }} />
            <span style={{ width: '3px', height: '3px', background: colors.text.secondary, borderRadius: '50%' }} />
          </button>
          {showMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={dropdownStyle}
            >
              <button
                onClick={(e) => { e.stopPropagation(); onDoubleClick(song); setShowMenu(false); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', borderRadius: '4px', padding: '6px 10px', color: 'white', cursor: 'pointer', fontSize: '0.8rem', textAlign: isRTL ? 'right' : 'left' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                {t('controlPanel.addToSetlist')}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(song); setShowMenu(false); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', borderRadius: '4px', padding: '6px 10px', color: 'white', cursor: 'pointer', fontSize: '0.8rem', textAlign: isRTL ? 'right' : 'left' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                {t('controlPanel.edit')}
              </button>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(song.id); setShowMenu(false); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', borderRadius: '4px', padding: '6px 10px', color: '#dc3545', cursor: 'pointer', fontSize: '0.8rem', textAlign: isRTL ? 'right' : 'left' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                {t('controlPanel.delete')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

SongItem.displayName = 'SongItem';

// Presentation Item Component with hover menu
interface PresentationItemProps {
  presentation: any;
  isSelected: boolean;
  onSelect: (pres: any) => void;
  onDoubleClick: (pres: any) => void;
  onEdit: (pres: any) => void;
  onDelete: (pres: any) => void;
  onDragStart: (e: React.DragEvent, pres: any) => void;
}

const PresentationItem = memo<PresentationItemProps>(({
  presentation,
  isSelected,
  onSelect,
  onDoubleClick,
  onEdit,
  onDelete,
  onDragStart
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const [isHovered, setIsHovered] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const containerStyle = useMemo(() => ({
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    padding: '10px 12px',
    cursor: 'pointer' as const,
    background: isSelected ? 'rgba(0, 212, 255, 0.2)' : 'transparent',
    borderLeft: isSelected ? '3px solid #00d4ff' : '3px solid transparent',
    borderBottom: '1px solid rgba(255,255,255,0.05)'
  }), [isSelected]);

  const menuButtonStyle = useMemo(() => ({
    padding: '4px 6px',
    borderRadius: '4px',
    border: 'none',
    background: colors.background.cardHover,
    cursor: 'pointer' as const,
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: '2px',
    alignItems: 'center' as const
  }), []);

  const dropdownStyle = useMemo(() => ({
    position: 'absolute' as const,
    right: isRTL ? 'auto' : 0,
    left: isRTL ? 0 : 'auto',
    top: '100%',
    marginTop: '4px',
    background: colors.background.dropdown,
    borderRadius: '6px',
    border: `1px solid ${colors.border.medium}`,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    zIndex: 100,
    padding: '4px',
    minWidth: '100px',
    overflow: 'hidden'
  }), [isRTL]);

  const menuItemStyle = useMemo(() => ({
    width: '100%',
    padding: '6px 10px',
    border: 'none',
    background: 'transparent',
    color: 'white',
    cursor: 'pointer' as const,
    fontSize: '0.8rem',
    textAlign: (isRTL ? 'right' : 'left') as const,
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '8px',
    borderRadius: '4px'
  }), [isRTL]);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, presentation)}
      onClick={() => onSelect(presentation)}
      onDoubleClick={() => onDoubleClick(presentation)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setShowMenu(false); }}
      style={containerStyle}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {presentation.title}
        </div>
      </div>
      {(isHovered || showMenu) && (
        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            style={menuButtonStyle}
          >
            <span style={{ width: '3px', height: '3px', background: colors.text.secondary, borderRadius: '50%' }} />
            <span style={{ width: '3px', height: '3px', background: colors.text.secondary, borderRadius: '50%' }} />
            <span style={{ width: '3px', height: '3px', background: colors.text.secondary, borderRadius: '50%' }} />
          </button>
          {showMenu && (
            <div onClick={(e) => e.stopPropagation()} style={dropdownStyle}>
              <button
                onClick={(e) => { e.stopPropagation(); onDoubleClick(presentation); setShowMenu(false); }}
                style={menuItemStyle}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                {t('controlPanel.addToSetlist')}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(presentation); setShowMenu(false); }}
                style={menuItemStyle}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                {t('controlPanel.edit')}
              </button>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(presentation); setShowMenu(false); }}
                style={{ ...menuItemStyle, color: '#dc3545' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                {t('controlPanel.delete')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

PresentationItem.displayName = 'PresentationItem';

// Theme Item Component with hover menu
interface ThemeItemProps {
  theme: any;
  isSelected: boolean;
  accentColor: string;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const ThemeItem = memo<ThemeItemProps>(({
  theme,
  isSelected,
  accentColor,
  onSelect,
  onEdit,
  onDelete
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const [isHovered, setIsHovered] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const containerStyle = useMemo(() => ({
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    padding: '10px',
    background: isSelected ? `${accentColor}30` : colors.background.card,
    borderRadius: '8px',
    marginBottom: '6px',
    cursor: 'pointer' as const,
    border: isSelected ? `1px solid ${accentColor}` : '1px solid transparent',
    position: 'relative' as const,
  }), [isSelected, accentColor]);

  const menuButtonStyle = useMemo(() => ({
    background: colors.background.cardHover,
    border: 'none',
    borderRadius: '4px',
    padding: '4px 6px',
    cursor: 'pointer' as const,
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: '2px',
    alignItems: 'center' as const,
  }), []);

  const dropdownStyle = useMemo(() => ({
    position: 'absolute' as const,
    top: '100%',
    right: isRTL ? 'auto' : 0,
    left: isRTL ? 0 : 'auto',
    marginTop: '4px',
    background: colors.background.dropdown,
    borderRadius: '6px',
    border: `1px solid ${colors.border.medium}`,
    padding: '4px',
    minWidth: '100px',
    zIndex: 100,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  }), [isRTL]);

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setShowMenu(false); }}
      style={containerStyle}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ color: colors.text.primary, fontSize: '0.85rem' }}>{theme.name}</span>
        {theme.isBuiltIn && (
          <span style={{ fontSize: '0.65rem', background: colors.border.medium, padding: '2px 5px', borderRadius: '3px', color: colors.text.muted }}>{t('themes.builtIn')}</span>
        )}
      </div>
      {(isHovered || showMenu) && (
        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            style={menuButtonStyle}
          >
            <span style={{ width: '3px', height: '3px', background: colors.text.secondary, borderRadius: '50%' }} />
            <span style={{ width: '3px', height: '3px', background: colors.text.secondary, borderRadius: '50%' }} />
            <span style={{ width: '3px', height: '3px', background: colors.text.secondary, borderRadius: '50%' }} />
          </button>
          {showMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={dropdownStyle}
            >
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(); setShowMenu(false); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', borderRadius: '4px', padding: '6px 10px', color: 'white', cursor: 'pointer', fontSize: '0.8rem', textAlign: isRTL ? 'right' : 'left' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                {t('controlPanel.edit')}
              </button>
              {!theme.isBuiltIn && (
                <>
                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); setShowMenu(false); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', borderRadius: '4px', padding: '6px 10px', color: '#dc3545', cursor: 'pointer', fontSize: '0.8rem', textAlign: isRTL ? 'right' : 'left' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    {t('controlPanel.delete')}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

ThemeItem.displayName = 'ThemeItem';

// ========== Quick Mode Presentation Types & Helpers ==========

// TextBox interface for Quick Mode slides (matches database TextBox type)
interface QuickModeTextBox {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  color: string;
  backgroundColor: string;
  textAlign: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'center' | 'bottom';
  bold: boolean;
  italic: boolean;
  underline: boolean;
  opacity: number;
  zIndex?: number;
  textDirection?: 'ltr' | 'rtl';
  // Enhanced properties (all optional for backward compatibility)
  fontWeight?: string;
  backgroundOpacity?: number;
  visible?: boolean;
  // Per-side borders
  borderTop?: number;
  borderRight?: number;
  borderBottom?: number;
  borderLeft?: number;
  borderColor?: string;
  // Per-corner radius
  borderRadiusTopLeft?: number;
  borderRadiusTopRight?: number;
  borderRadiusBottomRight?: number;
  borderRadiusBottomLeft?: number;
  // Per-side padding
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  // Flow positioning
  positionMode?: 'absolute' | 'flow';
  flowAnchor?: string;
  flowGap?: number;
  autoHeight?: boolean;
  growDirection?: 'up' | 'down';
}

interface QuickModeSlide {
  id: string;
  order: number;
  textBoxes: QuickModeTextBox[];
  imageBoxes: any[];
  backgroundBoxes?: any[];
  backgroundColor: string;
  backgroundGradient?: string;
  backgroundType?: 'color' | 'gradient' | 'transparent';
}

interface QuickModeDataForSlides {
  type: 'sermon' | 'prayer' | 'announcements';
  title: string;
  name?: string;  // Presentation name (derived from type + title if not provided)
  titleTranslation?: string;
  subtitles: Array<{
    subtitle: string;
    subtitleTranslation?: string;
    description: string;
    descriptionTranslation?: string;
    bibleRef?: {
      book: string;
      chapter: number;
      verseStart: number;
      verseEnd?: number;
      hebrewText: string;
      englishText: string;
      reference: string;
      hebrewReference: string;
      useHebrew: boolean;
    };
  }>;
  generateTranslation?: boolean;
}

// Generate unique ID with counter for guaranteed uniqueness
let quickModeIdCounter = 0;
const generateQuickModeId = (): string => {
  quickModeIdCounter++;
  return `qm_${Date.now()}_${quickModeIdCounter}_${Math.random().toString(36).substring(2, 11)}`;
};

// Check if text contains Hebrew characters
const containsHebrew = (text: string): boolean => /[\u0590-\u05FF]/.test(text);

// Generate slides from Quick Mode data with bilingual template support
const createQuickModeSlides = (data: QuickModeDataForSlides): QuickModeSlide[] => {
  const backgroundColor = data.type === 'sermon' ? '#1a1a2e' :
                          data.type === 'prayer' ? '#000000' : '#2d1f3d';

  const isBilingual = data.generateTranslation || false;

  return data.subtitles.map((item, index) => {
    const subtitlePrefix = data.type === 'sermon' ? `${index + 1}. ` :
                           data.type === 'prayer' ? '• ' : '';

    const hasBibleRef = !!item.bibleRef;
    const textBoxes: QuickModeTextBox[] = [];

    const subtitleIsHebrew = containsHebrew(item.subtitle);
    const titleIsHebrew = containsHebrew(data.title);

    if (isBilingual) {
      // ========== BILINGUAL LAYOUT ==========
      const titleY = 4;
      const subtitleY = 14;
      const bibleRefY = 24;
      const bibleTextY = 32;

      // === LEFT SIDE (ENGLISH) ===
      textBoxes.push({
        id: generateQuickModeId(),
        text: titleIsHebrew ? (data.titleTranslation || '[Title Translation]') : data.title,
        x: 2, y: titleY, width: 46, height: 10, fontSize: 120,
        color: '#ffffff', backgroundColor: 'transparent',
        textAlign: 'left', verticalAlign: 'center',
        bold: true, italic: false, underline: false, opacity: 1, zIndex: 10, textDirection: 'ltr'
      });

      textBoxes.push({
        id: generateQuickModeId(),
        text: subtitleIsHebrew
          ? (item.subtitleTranslation || `${subtitlePrefix}[Translation]`)
          : `${subtitlePrefix}${item.subtitle}`,
        x: 2, y: subtitleY, width: 46, height: 8, fontSize: 90,
        color: '#ffffff', backgroundColor: 'transparent',
        textAlign: 'left', verticalAlign: 'center',
        bold: false, italic: false, underline: false, opacity: 1, zIndex: 9, textDirection: 'ltr'
      });

      if (hasBibleRef && item.bibleRef) {
        textBoxes.push({
          id: generateQuickModeId(),
          text: `\u{1F4D6} ${item.bibleRef.reference}`,
          x: 2, y: bibleRefY, width: 46, height: 5, fontSize: 55,
          color: '#00d4ff', backgroundColor: 'transparent',
          textAlign: 'left', verticalAlign: 'center',
          bold: true, italic: false, underline: false, opacity: 1, zIndex: 8, textDirection: 'ltr'
        });

        textBoxes.push({
          id: generateQuickModeId(),
          text: item.bibleRef.englishText || item.bibleRef.hebrewText || '',
          x: 2, y: bibleTextY, width: 46, height: 60, fontSize: 55,
          color: 'rgba(255,255,255,0.9)', backgroundColor: 'transparent',
          textAlign: 'left', verticalAlign: 'top',
          bold: false, italic: true, underline: false, opacity: 1, zIndex: 7, textDirection: 'ltr'
        });
      }

      // === RIGHT SIDE (HEBREW) ===
      textBoxes.push({
        id: generateQuickModeId(),
        text: data.title,
        x: 52, y: titleY, width: 46, height: 10, fontSize: 120,
        color: '#ffffff', backgroundColor: 'transparent',
        textAlign: 'right', verticalAlign: 'center',
        bold: true, italic: false, underline: false, opacity: 1, zIndex: 10, textDirection: 'rtl'
      });

      textBoxes.push({
        id: generateQuickModeId(),
        text: subtitleIsHebrew
          ? `${subtitlePrefix}${item.subtitle}`
          : (item.subtitleTranslation || `${subtitlePrefix}${item.subtitle}`),
        x: 52, y: subtitleY, width: 46, height: 8, fontSize: 90,
        color: '#ffffff', backgroundColor: 'transparent',
        textAlign: 'right', verticalAlign: 'center',
        bold: false, italic: false, underline: false, opacity: 1, zIndex: 9, textDirection: 'rtl'
      });

      if (hasBibleRef && item.bibleRef) {
        textBoxes.push({
          id: generateQuickModeId(),
          text: `\u{1F4D6} ${item.bibleRef.hebrewReference || item.bibleRef.reference}`,
          x: 52, y: bibleRefY, width: 46, height: 5, fontSize: 55,
          color: '#00d4ff', backgroundColor: 'transparent',
          textAlign: 'right', verticalAlign: 'center',
          bold: true, italic: false, underline: false, opacity: 1, zIndex: 8, textDirection: 'rtl'
        });

        textBoxes.push({
          id: generateQuickModeId(),
          text: item.bibleRef.hebrewText || item.bibleRef.englishText || '',
          x: 52, y: bibleTextY, width: 46, height: 60, fontSize: 55,
          color: 'rgba(255,255,255,0.9)', backgroundColor: 'transparent',
          textAlign: 'right', verticalAlign: 'top',
          bold: false, italic: false, underline: false, opacity: 1, zIndex: 7, textDirection: 'rtl'
        });
      }
    } else {
      // ========== SINGLE LANGUAGE LAYOUT ==========
      const hasDescription = item.description.trim().length > 0;
      let subtitleY = 30;
      let descriptionY = 55;
      let bibleRefY = hasDescription ? 75 : 55;
      let bibleTextY = hasDescription ? 82 : 62;

      if (!hasDescription && hasBibleRef) {
        bibleRefY = 50;
        bibleTextY = 58;
      }

      const useRTL = subtitleIsHebrew;

      // Main title
      textBoxes.push({
        id: generateQuickModeId(),
        text: data.title,
        x: 5, y: 5, width: 90, height: 15, fontSize: 140,
        color: '#ffffff', backgroundColor: 'transparent',
        textAlign: useRTL ? 'right' : 'left', verticalAlign: 'center',
        bold: true, italic: false, underline: false, opacity: 1, zIndex: 5,
        textDirection: useRTL ? 'rtl' : 'ltr'
      });

      // Subtitle
      textBoxes.push({
        id: generateQuickModeId(),
        text: `${subtitlePrefix}${item.subtitle}`,
        x: 5, y: subtitleY, width: 90, height: 18, fontSize: 110,
        color: '#ffffff', backgroundColor: 'transparent',
        textAlign: useRTL ? 'right' : (data.type === 'announcements' ? 'center' : 'left'),
        verticalAlign: 'center',
        bold: false, italic: false, underline: false, opacity: 1, zIndex: 4,
        textDirection: useRTL ? 'rtl' : 'ltr'
      });

      // Description
      if (hasDescription) {
        textBoxes.push({
          id: generateQuickModeId(),
          text: item.description,
          x: 5, y: descriptionY, width: 90, height: hasBibleRef ? 18 : 35, fontSize: 80,
          color: 'rgba(255,255,255,0.85)', backgroundColor: 'transparent',
          textAlign: useRTL ? 'right' : (data.type === 'announcements' ? 'center' : 'left'),
          verticalAlign: 'top',
          bold: false, italic: false, underline: false, opacity: 1, zIndex: 3,
          textDirection: useRTL ? 'rtl' : 'ltr'
        });
      }

      // Bible reference
      if (hasBibleRef && item.bibleRef) {
        const bibleUseHebrew = item.bibleRef.useHebrew || false;
        const displayText = bibleUseHebrew
          ? (item.bibleRef.hebrewText || item.bibleRef.englishText || '')
          : (item.bibleRef.englishText || item.bibleRef.hebrewText || '');
        const displayReference = bibleUseHebrew
          ? (item.bibleRef.hebrewReference || item.bibleRef.reference)
          : item.bibleRef.reference;

        textBoxes.push({
          id: generateQuickModeId(),
          text: `\u{1F4D6} ${displayReference}`,
          x: 5, y: bibleRefY, width: 90, height: 6, fontSize: 60,
          color: '#00d4ff', backgroundColor: 'transparent',
          textAlign: bibleUseHebrew ? 'right' : 'left', verticalAlign: 'center',
          bold: true, italic: false, underline: false, opacity: 1, zIndex: 2,
          textDirection: bibleUseHebrew ? 'rtl' : 'ltr'
        });

        textBoxes.push({
          id: generateQuickModeId(),
          text: displayText,
          x: 5, y: bibleTextY, width: 90, height: 18, fontSize: 65,
          color: 'rgba(255,255,255,0.9)', backgroundColor: 'transparent',
          textAlign: bibleUseHebrew ? 'right' : 'left', verticalAlign: 'top',
          bold: false, italic: !bibleUseHebrew, underline: false, opacity: 1, zIndex: 1,
          textDirection: bibleUseHebrew ? 'rtl' : 'ltr'
        });
      }
    }

    return {
      id: generateQuickModeId(),
      order: index,
      textBoxes,
      imageBoxes: [],
      backgroundColor
    };
  });
};

// ========== End Quick Mode Presentation Helpers ==========

const ControlPanel: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { settings } = useSettings();
  const isRTL = i18n.language === 'he';

  // Setlist context (persists across navigation)
  const {
    setlist,
    setSetlist,
    currentSetlistId,
    setCurrentSetlistId,
    currentSetlistName,
    setCurrentSetlistName,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    lastSavedSetlistRef,
    updateSavedSnapshot,
    clearSetlist: clearSetlistFromContext
  } = useSetlist();

  // Display state
  const [displays, setDisplays] = useState<Display[]>([]);
  const [controlDisplayId, setControlDisplayId] = useState<number | null>(null);

  // Content state
  const [songs, setSongs] = useState<Song[]>([]);
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [presentationSearchQuery, setPresentationSearchQuery] = useState('');
  const presentationSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [selectedPresentation, setSelectedPresentation] = useState<Presentation | null>(null);
  const [currentPresentationSlideIndex, setCurrentPresentationSlideIndex] = useState(0);
  // Track what's actually "on air" for the live preview (separate from selected/staged content)
  // Combined into single object for atomic updates to prevent multiple re-renders
  const [liveState, setLiveState] = useState<{
    slideData: any;
    contentType: 'song' | 'bible' | 'prayer' | 'presentation' | null;
    songId: string | null;
    slideIndex: number;
  }>({ slideData: null, contentType: null, songId: null, slideIndex: 0 });
  // Destructure for easier access (these are derived, not separate state)
  const { slideData: liveSlideData, contentType: liveContentType, songId: liveSongId, slideIndex: liveSlideIndex } = liveState;
  // Auto-play state for presentations
  const [autoPlayActive, setAutoPlayActive] = useState(false);
  const [autoPlayInterval, setAutoPlayInterval] = useState(5); // seconds
  const autoPlayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // setlist state is now from SetlistContext
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [displayMode, setDisplayMode] = useState<DisplayMode>('bilingual');

  // Online state
  const [onlineConnected, setOnlineConnected] = useState(false);
  const [roomPin, setRoomPin] = useState<string | null>(null);
  const [viewerCount, setViewerCount] = useState(0);

  // Auth state
  const [authState, setAuthState] = useState<{
    isAuthenticated: boolean;
    user: { id: string; email: string; role: string } | null;
    serverUrl: string;
  }>({ isAuthenticated: false, user: null, serverUrl: 'https://solupresenter.onrender.com' });
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Panel resize state (percentages) with safe localStorage access
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => {
    try {
      const saved = localStorage.getItem('controlPanel_leftWidth');
      if (saved) {
        const parsed = parseFloat(saved);
        return !isNaN(parsed) && parsed > 0 && parsed < 100 ? parsed : 25;
      }
    } catch (error) {
      console.error('[ControlPanel] Failed to read leftPanelWidth from localStorage:', error);
    }
    return 25;
  });
  const [setlistPanelWidth, setSetlistPanelWidth] = useState(() => {
    try {
      const saved = localStorage.getItem('controlPanel_setlistWidth');
      if (saved) {
        const parsed = parseFloat(saved);
        return !isNaN(parsed) && parsed > 0 && parsed < 100 ? parsed : 25;
      }
    } catch (error) {
      console.error('[ControlPanel] Failed to read setlistPanelWidth from localStorage:', error);
    }
    return 25;
  });
  const [topRowHeight, setTopRowHeight] = useState(() => {
    try {
      const saved = localStorage.getItem('controlPanel_topRowHeight');
      if (saved) {
        const parsed = parseFloat(saved);
        return !isNaN(parsed) && parsed > 0 && parsed < 100 ? parsed : 50;
      }
    } catch (error) {
      console.error('[ControlPanel] Failed to read topRowHeight from localStorage:', error);
    }
    return 50;
  });
  const [isResizing, setIsResizing] = useState<'left' | 'setlist' | 'row' | null>(null);
  const resizeStartRef = useRef<{ x: number; y: number; startValue: number }>({ x: 0, y: 0, startValue: 0 });
  const mainContentRef = useRef<HTMLDivElement>(null);

  // UI state
  const [activeResourcePanel, setActiveResourcePanel] = useState<ResourcePanel>('songs');
  // Search uses debouncing for performance - input is uncontrolled for instant response
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isBlank, setIsBlank] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const importStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showDisplayPanel, setShowDisplayPanel] = useState(false);
  const [obsServerRunning, setObsServerRunning] = useState(false);
  const [obsServerUrl, setObsServerUrl] = useState<string | null>(null);

  // Theme state
  const [themes, setThemes] = useState<any[]>([]);
  const [stageMonitorThemes, setStageMonitorThemes] = useState<any[]>([]);
  const [bibleThemes, setBibleThemes] = useState<any[]>([]);
  const [prayerThemes, setPrayerThemes] = useState<any[]>([]);
  const [obsThemes, setObsThemes] = useState<any[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<any | null>(null);
  const [selectedStageTheme, setSelectedStageTheme] = useState<any | null>(null);
  const [selectedBibleTheme, setSelectedBibleTheme] = useState<any | null>(null);
  const [selectedPrayerTheme, setSelectedPrayerTheme] = useState<any | null>(null);
  const [selectedOBSTheme, setSelectedOBSTheme] = useState<any | null>(null);
  const [selectedOBSSongsTheme, setSelectedOBSSongsTheme] = useState<any | null>(null);
  const [selectedOBSBibleTheme, setSelectedOBSBibleTheme] = useState<any | null>(null);
  const [selectedOBSPrayerTheme, setSelectedOBSPrayerTheme] = useState<any | null>(null);
  const [currentContentType, setCurrentContentType] = useState<'song' | 'bible' | 'prayer'>('song');
  const [showThemeEditor, setShowThemeEditor] = useState(false);
  const [editingTheme, setEditingTheme] = useState<{
    id?: string;
    name: string;
    viewerBackground: { type: string; color: string };
    lineStyles: Record<string, { fontSize: number; color: string; fontWeight: string }>;
  } | null>(null);

  // Song editor state
  const [showSongEditor, setShowSongEditor] = useState(false);
  const [editingSong, setEditingSong] = useState<{
    id?: string;
    title: string;
    author: string;
    originalLanguage: string;
    tags: string[];
    slides: Array<{ originalText: string; transliteration: string; translation: string; translationOverflow: string; verseType: string }>;
  } | null>(null);
  const [editingSlideIndex, setEditingSlideIndex] = useState(0);
  const [songEditorExpressMode, setSongEditorExpressMode] = useState(false);
  const [songEditorExpressText, setSongEditorExpressText] = useState('');
  const [songTagInput, setSongTagInput] = useState('');

  // Prayer/Sermon express editor state
  const [showPrayerEditor, setShowPrayerEditor] = useState(false);
  const [editingPrayerPresentation, setEditingPrayerPresentation] = useState<Presentation | null>(null);
  const [prayerExpressText, setPrayerExpressText] = useState('');

  // Language options
  const songLanguages = [
    { code: 'he', name: 'Hebrew (עברית)' },
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish (Español)' },
    { code: 'fr', name: 'French (Français)' },
    { code: 'de', name: 'German (Deutsch)' },
    { code: 'ru', name: 'Russian (Русский)' },
    { code: 'ar', name: 'Arabic (العربية)' },
    { code: 'other', name: 'Other' }
  ];

  // Check if language needs transliteration structure
  const isTransliterationLanguage = editingSong?.originalLanguage === 'he' || editingSong?.originalLanguage === 'ar';

  // Tools state
  const [activeToolsTab, setActiveToolsTab] = useState<'countdown' | 'announce' | 'clock' | 'stopwatch'>('countdown');
  const [countdownTargetTime, setCountdownTargetTime] = useState('');
  const [countdownRemaining, setCountdownRemaining] = useState<string>('');
  const [countdownMessage, setCountdownMessage] = useState('');
  const [countdownMessageTranslation, setCountdownMessageTranslation] = useState('');
  const [isCountdownActive, setIsCountdownActive] = useState(false);
  const [announcementText, setAnnouncementText] = useState('');
  const [isAnnouncementActive, setIsAnnouncementActive] = useState(false);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Refs to access current message values in interval callback
  const countdownMessageRef = useRef(countdownMessage);
  const countdownMessageTranslationRef = useRef(countdownMessageTranslation);
  countdownMessageRef.current = countdownMessage;
  countdownMessageTranslationRef.current = countdownMessageTranslation;

  // Clock state
  const [clockFormat, setClockFormat] = useState<'12h' | '24h'>('12h');
  const [clockShowDate, setClockShowDate] = useState(true);
  const [isClockActive, setIsClockActive] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const clockIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Stopwatch state
  const [stopwatchTime, setStopwatchTime] = useState(0);
  const [isStopwatchRunning, setIsStopwatchRunning] = useState(false);
  const [isStopwatchActive, setIsStopwatchActive] = useState(false);
  const stopwatchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Keyboard shortcuts help
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  // Rotating messages state
  const [rotatingMessages, setRotatingMessages] = useState([
    { id: '1', text: 'Welcome!', textHe: 'ברוכים הבאים!', enabled: true, isPreset: true },
    { id: '2', text: 'Please silence your phones', textHe: 'נא להשתיק טלפונים', enabled: true, isPreset: true },
    { id: '3', text: 'Service starting soon', textHe: 'הכנסייה מתחילה בקרוב', enabled: false, isPreset: true },
    { id: '4', text: 'Connect to WiFi: GuestNetwork', textHe: 'התחברו לרשת: GuestNetwork', enabled: false, isPreset: true },
  ]);
  const [customMessageInput, setCustomMessageInput] = useState('');
  const [rotatingInterval, setRotatingInterval] = useState(5);
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const [isRotatingMessagesActive, setIsRotatingMessagesActive] = useState(false);

  // Quick Slide state
  const [showQuickSlideModal, setShowQuickSlideModal] = useState(false);
  const [quickSlideText, setQuickSlideText] = useState('');
  const [quickSlideCount, setQuickSlideCount] = useState(0);
  const [quickSlideBroadcastIndex, setQuickSlideBroadcastIndex] = useState(-1);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);

  // Background state
  const [selectedBackground, setSelectedBackground] = useState<string>('');
  const [showBackgroundDropdown, setShowBackgroundDropdown] = useState(false);
  const quickSlideTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Fullscreen media state (takes over from slides when active)
  const [activeMedia, setActiveMedia] = useState<{ type: 'image' | 'video'; url: string } | null>(null);
  const [hoveredMediaStopId, setHoveredMediaStopId] = useState<string | null>(null);
  const [selectedSetlistMediaId, setSelectedSetlistMediaId] = useState<string | null>(null);
  const [hoveredSetlistItemId, setHoveredSetlistItemId] = useState<string | null>(null);
  const [setlistMenuOpen, setSetlistMenuOpen] = useState<string | null>(null);
  const [setlistContextMenu, setSetlistContextMenu] = useState<{ x: number; y: number; item: SetlistItem } | null>(null);
  const [selectedYoutubeItemId, setSelectedYoutubeItemId] = useState<string | null>(null);
  const [visibleSongsCount, setVisibleSongsCount] = useState(50); // Limit initial render for performance

  // Video playback control state
  const [videoStatus, setVideoStatus] = useState<{ currentTime: number; duration: number; isPlaying: boolean }>({
    currentTime: 0,
    duration: 0,
    isPlaying: false
  });
  const [videoVolume, setVideoVolume] = useState(1); // 0-1 range
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  // Audio (background music) state - plays only in control panel, not on displays
  const [activeAudio, setActiveAudio] = useState<{ url: string; name: string } | null>(null);
  const [activeAudioSetlistId, setActiveAudioSetlistId] = useState<string | null>(null); // Track which setlist item is playing
  const [audioStatus, setAudioStatus] = useState<{ currentTime: number; duration: number; isPlaying: boolean }>({
    currentTime: 0,
    duration: 0,
    isPlaying: false
  });
  const audioRef = useRef<HTMLAudioElement>(null);
  // Audio playlist state
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null); // Which playlist setlist item is playing
  const [activePlaylistIndex, setActivePlaylistIndex] = useState<number>(0); // Current track index
  const [activePlaylistOrder, setActivePlaylistOrder] = useState<number[]>([]); // Track order (shuffled or sequential)
  // Playlist editing state
  const [editingPlaylistItemId, setEditingPlaylistItemId] = useState<string | null>(null);
  const [editingPlaylistTracks, setEditingPlaylistTracks] = useState<AudioPlaylistTrack[]>([]);
  const [editingPlaylistName, setEditingPlaylistName] = useState('');
  const [editingPlaylistShuffle, setEditingPlaylistShuffle] = useState(false);
  const [editPlaylistDraggedIndex, setEditPlaylistDraggedIndex] = useState<number | null>(null);
  const [editPlaylistDropTargetIndex, setEditPlaylistDropTargetIndex] = useState<number | null>(null);
  const [expandedPlaylistIds, setExpandedPlaylistIds] = useState<Set<string>>(new Set()); // Track which playlists are expanded in setlist
  const [audioTargetVolume, setAudioTargetVolume] = useState(1);
  const audioFadeRef = useRef<NodeJS.Timeout | null>(null);
  const audioEndFadingRef = useRef(false); // Track if we're fading out at end
  const audioNeedsInitialPlay = useRef(false); // Track if we need to start playing on canplay
  // Throttle refs for time updates (prevents excessive re-renders)
  const lastAudioTimeUpdateRef = useRef<number>(0);
  const lastVideoTimeUpdateRef = useRef<number>(0);
  const TIME_UPDATE_THROTTLE_MS = 500; // Update UI at most twice per second

  // YouTube Links state
  interface YouTubeVideo {
    videoId: string;
    title: string;
    thumbnail: string;
  }
  const [youtubeVideos, setYoutubeVideos] = useState<YouTubeVideo[]>([]);
  const [youtubeUrlInput, setYoutubeUrlInput] = useState('');
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [youtubeOnDisplay, setYoutubeOnDisplay] = useState(false);
  const [activeYoutubeVideo, setActiveYoutubeVideo] = useState<YouTubeVideo | null>(null);
  const [youtubePlayerRef, setYoutubePlayerRef] = useState<any>(null);
  const [youtubePlaying, setYoutubePlaying] = useState(false);
  const [youtubeCurrentTime, setYoutubeCurrentTime] = useState(0);
  const [youtubeDuration, setYoutubeDuration] = useState(0);
  const youtubeContainerRef = useRef<HTMLDivElement>(null);
  const youtubeAPIReady = useRef(false);
  const youtubeSyncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [activeMediaSubTab, setActiveMediaSubTab] = useState<'library' | 'links'>('library');
  const [hoveredYoutubeId, setHoveredYoutubeId] = useState<string | null>(null);
  // YouTube search state
  interface YouTubeSearchResult {
    videoId: string;
    title: string;
    thumbnail: string;
    channelTitle: string;
    duration?: string;
  }
  const [youtubeSearchResults, setYoutubeSearchResults] = useState<YouTubeSearchResult[]>([]);
  const [youtubeSearchLoading, setYoutubeSearchLoading] = useState(false);
  const [showYoutubeSearchResults, setShowYoutubeSearchResults] = useState(false);

  // Bible state
  const [bibleBooks, setBibleBooks] = useState<BibleBook[]>([]);
  const [selectedBibleBook, setSelectedBibleBook] = useState('');
  const [selectedBibleChapter, setSelectedBibleChapter] = useState<number | ''>('');
  const [bibleSlides, setBibleSlides] = useState<BibleSlide[]>([]);
  const [bibleLoading, setBibleLoading] = useState(false);
  const [biblePassage, setBiblePassage] = useState<Song | null>(null);
  const [bibleSearchQuery, setBibleSearchQuery] = useState('');
  const bibleSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Setlist persistence state
  const [savedSetlists, setSavedSetlists] = useState<SavedSetlist[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showSetlistMenu, setShowSetlistMenu] = useState(false);
  const [setlistMenuHover, setSetlistMenuHover] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNewThemeModal, setShowNewThemeModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Quick Mode wizard state
  interface QuickModeSubtitle {
    subtitle: string;
    subtitleTranslation?: string; // English translation of Hebrew subtitle
    description: string;
    descriptionTranslation?: string; // English translation of Hebrew description
    bibleRef?: {
      book: string;
      chapter: number;
      verseStart: number;
      verseEnd?: number;
      hebrewText: string;
      englishText: string;
      reference: string;
      hebrewReference: string; // Hebrew version of the reference (e.g., יוחנן ג:טז)
      useHebrew: boolean; // Whether to display Hebrew text in the presentation
    };
  }
  const [showQuickModeWizard, setShowQuickModeWizard] = useState(false);
  const [quickModeStep, setQuickModeStep] = useState(1);
  const [quickModeType, setQuickModeType] = useState<'sermon' | 'prayer' | 'announcements' | null>(null);
  const [quickModeTitle, setQuickModeTitle] = useState('');
  const [quickModeSubtitles, setQuickModeSubtitles] = useState<QuickModeSubtitle[]>([{ subtitle: '', description: '' }]);
  // Bible picker state for Quick Mode
  const [quickModeBiblePickerIndex, setQuickModeBiblePickerIndex] = useState<number | null>(null);
  const [quickModeBibleSearch, setQuickModeBibleSearch] = useState('');
  const [quickModeBibleVerses, setQuickModeBibleVerses] = useState<Array<{ verseNumber: number; hebrew: string; english: string; reference: string; hebrewReference: string }>>([]);
  const [quickModeBibleBook, setQuickModeBibleBook] = useState('');
  const [quickModeBibleChapter, setQuickModeBibleChapter] = useState<number | null>(null);
  const [quickModeVerseStart, setQuickModeVerseStart] = useState<number | null>(null);
  const [quickModeVerseEnd, setQuickModeVerseEnd] = useState<number | null>(null);
  const [quickModeBibleLoading, setQuickModeBibleLoading] = useState(false);
  const [quickModeBooksLoading, setQuickModeBooksLoading] = useState(false);
  const [quickModeBibleNoMatch, setQuickModeBibleNoMatch] = useState(false);
  const [quickModeBibleIsHebrew, setQuickModeBibleIsHebrew] = useState(false); // Track if search was in Hebrew
  const quickModeBibleSearchRef = useRef<string>(''); // Track latest search for race condition prevention
  const quickModeTitleInputRef = useRef<HTMLInputElement>(null); // Ref for title input focus
  const [quickModeGenerateTranslation, setQuickModeGenerateTranslation] = useState(false); // Generate English translation for Hebrew text
  const [quickModeTranslationLoading, setQuickModeTranslationLoading] = useState(false);
  const [quickModeCreating, setQuickModeCreating] = useState(false); // Creating presentation directly without opening editor
  // currentSetlistId, currentSetlistName, hasUnsavedChanges, lastSavedSetlistRef are now from SetlistContext
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'load' | 'clear' | 'new'; setlist?: SavedSetlist } | null>(null);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const sectionTitleRef = useRef<HTMLInputElement>(null);
  const setlistNameRef = useRef<HTMLInputElement>(null);
  const setlistVenueRef = useRef<HTMLInputElement>(null);

  // Drag and drop state
  const [draggedSong, setDraggedSong] = useState<Song | null>(null);
  const [draggedSetlistIndex, setDraggedSetlistIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [isDraggingMedia, setIsDraggingMedia] = useState(false);

  // Combined slides state (for original mode)
  const [selectedCombinedIndex, setSelectedCombinedIndex] = useState(0);

  // Handle panel resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !mainContentRef.current) return;

      const rect = mainContentRef.current.getBoundingClientRect();
      const { x: startX, y: startY, startValue } = resizeStartRef.current;

      // In RTL mode, horizontal drag direction is inverted
      const rtlMultiplier = isRTL ? -1 : 1;

      if (isResizing === 'left') {
        const deltaX = (e.clientX - startX) * rtlMultiplier;
        const deltaPercent = (deltaX / rect.width) * 100;
        const newWidth = Math.min(Math.max(startValue + deltaPercent, 15), 40);
        setLeftPanelWidth(newWidth);
      } else if (isResizing === 'setlist') {
        const deltaX = (e.clientX - startX) * rtlMultiplier;
        const deltaPercent = (deltaX / rect.width) * 100;
        const newWidth = Math.min(Math.max(startValue + deltaPercent, 15), 40);
        setSetlistPanelWidth(newWidth);
      } else if (isResizing === 'row') {
        const deltaY = e.clientY - startY;
        const deltaPercent = (deltaY / rect.height) * 100;
        const newHeight = Math.min(Math.max(startValue + deltaPercent, 30), 70);
        setTopRowHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      if (isResizing) {
        // Save to localStorage with error handling
        try {
          localStorage.setItem('controlPanel_leftWidth', leftPanelWidth.toString());
          localStorage.setItem('controlPanel_setlistWidth', setlistPanelWidth.toString());
          localStorage.setItem('controlPanel_topRowHeight', topRowHeight.toString());
        } catch (error) {
          console.error('[ControlPanel] Failed to save panel sizes to localStorage:', error);
        }
        setIsResizing(null);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, leftPanelWidth, setlistPanelWidth, topRowHeight, isRTL]);

  const startResize = useCallback((type: 'left' | 'setlist' | 'row', e: React.MouseEvent) => {
    e.preventDefault();
    const startValue = type === 'left' ? leftPanelWidth : type === 'setlist' ? setlistPanelWidth : topRowHeight;
    resizeStartRef.current = { x: e.clientX, y: e.clientY, startValue };
    setIsResizing(type);
    document.body.style.cursor = type === 'row' ? 'row-resize' : 'col-resize';
  }, [leftPanelWidth, setlistPanelWidth, topRowHeight]);

  // Handle navigation state (e.g., returning from presentation editor)
  useEffect(() => {
    const state = location.state as { activeTab?: ResourcePanel; editedPresentationId?: string } | null;
    if (state?.activeTab) {
      setActiveResourcePanel(state.activeTab);
    }

    // If returning from editing a presentation, refresh and select it
    if (state?.editedPresentationId) {
      const refreshAndSelect = async () => {
        try {
          // Reload presentations to get updated data
          const presentationList = await window.electronAPI.getPresentations();
          setPresentations(presentationList || []);

          // Find the edited presentation
          const editedPresentation = (presentationList || []).find(
            (p: Presentation) => p.id === state.editedPresentationId
          );

          if (editedPresentation) {
            // Select the presentation to show its slides
            setSelectedPresentation(editedPresentation);
            setSelectedSong(null);
            setCurrentContentType('presentation');
            setCurrentPresentationSlideIndex(0);

            // Also update the presentation in any setlist items that reference it
            setSetlist(prev => prev.map(item => {
              if (item.type === 'presentation' && item.presentation?.id === state.editedPresentationId) {
                return { ...item, presentation: editedPresentation };
              }
              return item;
            }));
          }
        } catch (error) {
          console.error('Failed to refresh presentations:', error);
        }
      };
      refreshAndSelect();
    }

    // Clear the state so it doesn't persist on refresh
    if (state?.activeTab || state?.editedPresentationId) {
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Focus Quick Mode title input when step 2 is reached
  useEffect(() => {
    if (quickModeStep === 2 && quickModeTitleInputRef.current) {
      // Use requestAnimationFrame + setTimeout to ensure DOM is ready and window has focus
      requestAnimationFrame(() => {
        setTimeout(() => {
          // Ensure window has focus first (Electron-specific)
          window.focus();
          quickModeTitleInputRef.current?.focus();
        }, 100);
      });
    }
  }, [quickModeStep]);

  // Load initial data
  useEffect(() => {
    loadDisplays();
    loadSongs();
    loadPresentations();
    loadSavedSetlists();
    loadThemes();
    initializeAuth();

    const cleanup = window.electronAPI.onDisplaysChanged((newDisplays) => {
      setDisplays(newDisplays);
    });

    const onlineCleanup = window.electronAPI.onOnlineStatusChanged((status) => {
      setOnlineConnected(status.connected);
      setRoomPin(status.roomPin || null);
    });

    const viewerCleanup = window.electronAPI.onViewerCountChanged((count) => {
      setViewerCount(count);
    });

    return () => {
      cleanup();
      onlineCleanup();
      viewerCleanup();
      // Centralized interval cleanup - clear ALL interval refs
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      if (clockIntervalRef.current) {
        clearInterval(clockIntervalRef.current);
        clockIntervalRef.current = null;
      }
      if (stopwatchIntervalRef.current) {
        clearInterval(stopwatchIntervalRef.current);
        stopwatchIntervalRef.current = null;
      }
      if (youtubeSyncIntervalRef.current) {
        clearInterval(youtubeSyncIntervalRef.current);
        youtubeSyncIntervalRef.current = null;
      }
      if (audioFadeRef.current) {
        clearInterval(audioFadeRef.current);
        audioFadeRef.current = null;
      }
      if (importStatusTimeoutRef.current) {
        clearTimeout(importStatusTimeoutRef.current);
        importStatusTimeoutRef.current = null;
      }
      // Cleanup audio element to prevent memory leaks and stop playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current.load(); // Reset the audio element
      }
    };
  }, []);

  // YouTube IFrame API setup and sync
  useEffect(() => {
    // Load YouTube IFrame API script if not already loaded
    if (!window.YT && !document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }

    // Set up the callback for when API is ready
    const originalCallback = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      youtubeAPIReady.current = true;
      if (originalCallback) originalCallback();
    };

    // If API is already loaded
    if (window.YT && window.YT.Player) {
      youtubeAPIReady.current = true;
    }

    return () => {
      if (youtubeSyncIntervalRef.current) {
        clearInterval(youtubeSyncIntervalRef.current);
      }
      // Restore original callback on cleanup
      if (originalCallback) {
        (window as any).onYouTubeIframeAPIReady = originalCallback;
      } else {
        delete (window as any).onYouTubeIframeAPIReady;
      }
    };
  }, []);

  // Create/destroy YouTube player when video changes
  useEffect(() => {
    // Track player instance locally to avoid stale closure issues
    let currentPlayer: any = null;
    let createPlayerTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let isCleanedUp = false;
    let retryCount = 0;
    const MAX_RETRIES = 50; // 5 seconds max wait for YouTube API

    if (!youtubeOnDisplay || !activeYoutubeVideo || !youtubeContainerRef.current) {
      // Cleanup player when not displaying
      if (youtubePlayerRef) {
        try {
          youtubePlayerRef.destroy();
        } catch (e) {
          // Ignore errors
        }
        setYoutubePlayerRef(null);
      }
      if (youtubeSyncIntervalRef.current) {
        clearInterval(youtubeSyncIntervalRef.current);
        youtubeSyncIntervalRef.current = null;
      }
      return;
    }

    // Wait for API to be ready
    const createPlayer = () => {
      // Don't create if already cleaned up
      if (isCleanedUp) return;

      if (!window.YT || !window.YT.Player || !youtubeContainerRef.current) {
        if (retryCount++ >= MAX_RETRIES) {
          console.error('YouTube API failed to load after maximum retries');
          return;
        }
        createPlayerTimeoutId = setTimeout(createPlayer, 100);
        return;
      }

      // Clear container
      youtubeContainerRef.current.innerHTML = '';

      const player = new window.YT.Player(youtubeContainerRef.current, {
        videoId: activeYoutubeVideo.videoId,
        playerVars: {
          autoplay: 1,
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
          origin: window.location.origin,
          widget_referrer: window.location.href
        },
        events: {
          onReady: (event: any) => {
            if (isCleanedUp) return;
            setYoutubeDuration(event.target.getDuration());
            // Start sync interval - sync every 200ms for tighter sync
            youtubeSyncIntervalRef.current = setInterval(() => {
              if (isCleanedUp) return;
              if (player && player.getCurrentTime) {
                try {
                  const currentTime = player.getCurrentTime();
                  const playerState = player.getPlayerState();
                  const isPlaying = playerState === window.YT.PlayerState.PLAYING;
                  setYoutubeCurrentTime(currentTime);
                  setYoutubePlaying(isPlaying);
                  // Sync to connected display
                  window.electronAPI.youtubeSync(currentTime, isPlaying);
                } catch (e) {
                  // Player may have been destroyed
                }
              }
            }, 200);
          },
          onStateChange: (event: any) => {
            if (isCleanedUp) return;
            const isPlaying = event.data === window.YT.PlayerState.PLAYING;
            setYoutubePlaying(isPlaying);
            if (event.data === window.YT.PlayerState.PLAYING) {
              const currentTime = player.getCurrentTime();
              window.electronAPI.youtubePlay(currentTime);
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              const currentTime = player.getCurrentTime();
              window.electronAPI.youtubePause(currentTime);
            }
          },
          onError: (event: any) => {
            const errorCodes: Record<number, string> = {
              2: 'Invalid video ID',
              5: 'Video cannot be played in HTML5 player',
              100: 'Video not found or removed',
              101: 'Video not allowed for embedded playback',
              150: 'Video not allowed for embedded playback'
            };
            const errorMessage = errorCodes[event.data] || `Unknown error (code: ${event.data})`;
            console.error('[YouTube] Player error:', errorMessage);
          }
        }
      });

      currentPlayer = player;
      setYoutubePlayerRef(player);
    };

    createPlayer();

    return () => {
      isCleanedUp = true;

      // Cancel pending createPlayer timeout
      if (createPlayerTimeoutId) {
        clearTimeout(createPlayerTimeoutId);
        createPlayerTimeoutId = null;
      }

      // Clear sync interval
      if (youtubeSyncIntervalRef.current) {
        clearInterval(youtubeSyncIntervalRef.current);
        youtubeSyncIntervalRef.current = null;
      }

      // Clean up player - use local reference to avoid stale closure
      const playerToDestroy = currentPlayer || youtubePlayerRef;
      if (playerToDestroy) {
        try {
          playerToDestroy.destroy();
        } catch (e) {
          // Ignore errors during cleanup
        }
      }
      currentPlayer = null;
      setYoutubePlayerRef(null);
    };
  }, [youtubeOnDisplay, activeYoutubeVideo?.videoId]);

  // Clock interval - only update when clock or stopwatch is active to avoid unnecessary re-renders
  useEffect(() => {
    if (isClockActive || isStopwatchRunning) {
      clockIntervalRef.current = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000);
    } else {
      if (clockIntervalRef.current) {
        clearInterval(clockIntervalRef.current);
        clockIntervalRef.current = null;
      }
    }

    return () => {
      if (clockIntervalRef.current) {
        clearInterval(clockIntervalRef.current);
      }
    };
  }, [isClockActive, isStopwatchRunning]);

  // Broadcast clock when active
  useEffect(() => {
    if (isClockActive) {
      const timeStr = formatClockTime(currentTime, clockFormat);
      const dateStr = clockShowDate ? formatClockDate(currentTime) : '';
      window.electronAPI.sendTool({
        type: 'clock',
        active: true,
        time: timeStr,
        date: dateStr,
        format: clockFormat
      });
    }
  }, [isClockActive, currentTime, clockFormat, clockShowDate]);

  // Stopwatch interval
  useEffect(() => {
    if (isStopwatchRunning) {
      stopwatchIntervalRef.current = setInterval(() => {
        setStopwatchTime(prev => prev + 100);
      }, 100);
    } else {
      if (stopwatchIntervalRef.current) {
        clearInterval(stopwatchIntervalRef.current);
      }
    }

    return () => {
      if (stopwatchIntervalRef.current) {
        clearInterval(stopwatchIntervalRef.current);
      }
    };
  }, [isStopwatchRunning]);

  // Broadcast stopwatch when active
  useEffect(() => {
    if (isStopwatchActive) {
      window.electronAPI.sendTool({
        type: 'stopwatch',
        active: true,
        time: formatStopwatchTime(stopwatchTime),
        running: isStopwatchRunning
      });
    }
  }, [isStopwatchActive, stopwatchTime, isStopwatchRunning]);

  // Video status listener
  useEffect(() => {
    const statusCleanup = window.electronAPI.onVideoStatus((status) => {
      setVideoStatus(prev => ({
        ...prev,
        currentTime: status.currentTime,
        duration: status.duration
      }));
    });

    const playingCleanup = window.electronAPI.onVideoPlaying((playing) => {
      setVideoStatus(prev => ({ ...prev, isPlaying: playing }));
    });

    const endedCleanup = window.electronAPI.onVideoEnded(() => {
      setVideoStatus(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));
    });

    // Listen for synchronized video start (when display is ready)
    const syncStartCleanup = window.electronAPI.onVideoSyncStart(() => {
      console.log('[ControlPanel] Video sync start received');
      setVideoStatus(prev => ({ ...prev, isPlaying: true, currentTime: 0 }));
      // Start preview video from beginning
      if (previewVideoRef.current) {
        previewVideoRef.current.currentTime = 0;
        previewVideoRef.current.play().catch(err => console.error('Preview video play failed:', err));
      }
    });

    return () => {
      statusCleanup();
      playingCleanup();
      endedCleanup();
      syncStartCleanup();
    };
  }, []);

  // Auto-play effect for presentation slides
  useEffect(() => {
    // Clear any existing timer
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }

    // Only run if auto-play is active and we have a free-form presentation selected
    if (autoPlayActive && selectedPresentation && !selectedPresentation.quickModeData && selectedPresentation.slides.length > 1) {
      autoPlayTimerRef.current = setInterval(() => {
        setCurrentPresentationSlideIndex(prevIndex => {
          const nextIndex = (prevIndex + 1) % selectedPresentation.slides.length;
          const slide = selectedPresentation.slides[nextIndex];

          // Send the slide to the display
          window.electronAPI.sendSlide({
            songId: selectedPresentation.id,
            slideIndex: nextIndex,
            displayMode: 'bilingual',
            isBlank: false,
            songTitle: selectedPresentation.title,
            presentationSlide: slide
          });

          return nextIndex;
        });
      }, autoPlayInterval * 1000);
    }

    return () => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
    };
  }, [autoPlayActive, autoPlayInterval, selectedPresentation]);

  // Stop auto-play when presentation changes or is deselected
  useEffect(() => {
    setAutoPlayActive(false);
  }, [selectedPresentation?.id]);

  // Close dropdown panels when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Check if click is outside the panels
      if (showDisplayPanel && !target.closest('[data-panel="display"]')) {
        setShowDisplayPanel(false);
      }
      if (showBackgroundDropdown && !target.closest('[data-panel="background"]')) {
        setShowBackgroundDropdown(false);
      }
      // Collapse expanded playlists when clicking outside
      if (expandedPlaylistIds.size > 0) {
        const isInsidePlaylistArea = target.closest('[data-playlist-expanded]');
        const isInsideAudioPlayer = target.closest('[data-audio-player]');
        if (!isInsidePlaylistArea && !isInsideAudioPlayer) {
          setExpandedPlaylistIds(new Set());
        }
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showDisplayPanel, showBackgroundDropdown, expandedPlaylistIds.size]);

  const loadDisplays = async () => {
    const displayList = await window.electronAPI.getDisplays();
    setDisplays(displayList);
    // Get current control window display
    const currentControlDisplay = await window.electronAPI.getControlWindowDisplay();
    setControlDisplayId(currentControlDisplay);
    // Check OBS server state
    const isRunning = await window.electronAPI.isOBSServerRunning();
    setObsServerRunning(isRunning);
    if (isRunning) {
      const url = await window.electronAPI.getOBSServerUrl();
      setObsServerUrl(url);
    }
  };

  const loadSongs = useCallback(async () => {
    try {
      const songList = await window.electronAPI.getSongs();
      setSongs(songList || []);
    } catch (error) {
      console.error('Failed to load songs:', error);
      setSongs([]);
    }
  }, []);

  const loadPresentations = useCallback(async () => {
    try {
      const presentationList = await window.electronAPI.getPresentations();
      setPresentations(presentationList || []);
    } catch (error) {
      console.error('Failed to load presentations:', error);
      setPresentations([]);
    }
  }, []);

  const loadSavedSetlists = async () => {
    try {
      const setlists = await window.electronAPI.getSetlists();
      setSavedSetlists(setlists || []);
    } catch (error) {
      console.error('Failed to load setlists:', error);
      setSavedSetlists([]);
    }
  };

  const loadThemes = async () => {
    try {
      // Load saved theme selections
      const savedThemeIds = await window.electronAPI.getSelectedThemeIds();

      // Load songs (viewer) themes
      const themeList = await window.electronAPI.getThemes();
      setThemes(themeList);
      // Use saved theme if available, otherwise auto-select default
      if (themeList.length > 0 && !selectedTheme) {
        let themeToSelect = savedThemeIds.viewerThemeId
          ? themeList.find((t: any) => t.id === savedThemeIds.viewerThemeId)
          : null;
        if (!themeToSelect) {
          themeToSelect = themeList.find((t: any) => t.isDefault) || themeList[0];
        }
        setSelectedTheme(themeToSelect);
        applyThemeToViewer(themeToSelect);
      }

      // Load stage monitor themes
      const stageThemeList = await window.electronAPI.getStageThemes();
      setStageMonitorThemes(stageThemeList);
      // Use saved theme if available, otherwise auto-select default
      if (stageThemeList.length > 0 && !selectedStageTheme) {
        let themeToSelect = savedThemeIds.stageThemeId
          ? stageThemeList.find((t: any) => t.id === savedThemeIds.stageThemeId)
          : null;
        if (!themeToSelect) {
          themeToSelect = stageThemeList.find((t: any) => t.isDefault) || stageThemeList[0];
        }
        setSelectedStageTheme(themeToSelect);
        applyStageThemeToMonitor(themeToSelect);
      }

      // Load Bible themes
      const bibleThemeList = await window.electronAPI.getBibleThemes();
      setBibleThemes(bibleThemeList || []);
      if (bibleThemeList && bibleThemeList.length > 0 && !selectedBibleTheme) {
        let themeToSelect = savedThemeIds.bibleThemeId
          ? bibleThemeList.find((t: any) => t.id === savedThemeIds.bibleThemeId)
          : null;
        if (!themeToSelect) {
          themeToSelect = bibleThemeList.find((t: any) => t.isDefault) || bibleThemeList[0];
        }
        setSelectedBibleTheme(themeToSelect);
        // Broadcast to display manager so displays have the bible theme ready
        window.electronAPI.applyBibleTheme(themeToSelect);
      }

      // Load OBS themes
      const obsThemeList = await window.electronAPI.getOBSThemes();
      setObsThemes(obsThemeList || []);
      if (obsThemeList && obsThemeList.length > 0) {
        // Filter by type
        const obsSongsThemes = obsThemeList.filter((t: any) => t.type === 'songs');
        const obsBibleThemes = obsThemeList.filter((t: any) => t.type === 'bible');
        const obsPrayerThemes = obsThemeList.filter((t: any) => t.type === 'prayer');

        // Load OBS Songs theme
        if (obsSongsThemes.length > 0 && !selectedOBSSongsTheme) {
          let songsTheme = savedThemeIds.obsThemeId
            ? obsSongsThemes.find((t: any) => t.id === savedThemeIds.obsThemeId)
            : null;
          if (!songsTheme) {
            songsTheme = obsSongsThemes.find((t: any) => t.isDefault) || obsSongsThemes[0];
          }
          setSelectedOBSSongsTheme(songsTheme);
          if (!selectedOBSTheme) setSelectedOBSTheme(songsTheme);
          // Apply to OBS server on load
          window.electronAPI.applyOBSTheme(songsTheme);
        }

        // Load OBS Bible theme
        if (obsBibleThemes.length > 0 && !selectedOBSBibleTheme) {
          let bibleTheme = savedThemeIds.obsBibleThemeId
            ? obsBibleThemes.find((t: any) => t.id === savedThemeIds.obsBibleThemeId)
            : null;
          if (!bibleTheme) {
            bibleTheme = obsBibleThemes.find((t: any) => t.isDefault) || obsBibleThemes[0];
          }
          setSelectedOBSBibleTheme(bibleTheme);
          // Apply to OBS server on load
          window.electronAPI.applyOBSTheme(bibleTheme);
        }

        // Load OBS Prayer theme
        if (obsPrayerThemes.length > 0 && !selectedOBSPrayerTheme) {
          let prayerTheme = savedThemeIds.obsPrayerThemeId
            ? obsPrayerThemes.find((t: any) => t.id === savedThemeIds.obsPrayerThemeId)
            : null;
          if (!prayerTheme) {
            prayerTheme = obsPrayerThemes.find((t: any) => t.isDefault) || obsPrayerThemes[0];
          }
          setSelectedOBSPrayerTheme(prayerTheme);
          // Apply to OBS server on load
          window.electronAPI.applyOBSTheme(prayerTheme);
        }
      }

      // Load Prayer themes
      const prayerThemeList = await window.electronAPI.getPrayerThemes();
      setPrayerThemes(prayerThemeList || []);
      if (prayerThemeList && prayerThemeList.length > 0 && !selectedPrayerTheme) {
        let themeToSelect = savedThemeIds.prayerThemeId
          ? prayerThemeList.find((t: any) => t.id === savedThemeIds.prayerThemeId)
          : null;
        if (!themeToSelect) {
          themeToSelect = prayerThemeList.find((t: any) => t.isDefault) || prayerThemeList[0];
        }
        setSelectedPrayerTheme(themeToSelect);
        // Broadcast to display manager so displays have the prayer theme ready
        window.electronAPI.applyPrayerTheme(themeToSelect);
      }
    } catch (error) {
      console.error('Failed to load themes:', error);
    }
  };

  const applyThemeToViewer = useCallback((theme: any) => {
    if (!theme) return;
    window.electronAPI.applyTheme(theme);
    setSelectedTheme(theme);
    // Persist selection
    window.electronAPI.saveSelectedThemeId('viewer', theme.id);
  }, []);

  const applyStageThemeToMonitor = useCallback((theme: any) => {
    if (!theme) return;
    try {
      // Parse JSON fields if needed (with try-catch for safety)
      const colors = typeof theme.colors === 'string' ? JSON.parse(theme.colors) : theme.colors;
      const elements = typeof theme.elements === 'string' ? JSON.parse(theme.elements) : theme.elements;
      const currentSlideText = typeof theme.currentSlideText === 'string' ? JSON.parse(theme.currentSlideText) : theme.currentSlideText;
      window.electronAPI.applyStageTheme({ colors, elements, currentSlideText });
      setSelectedStageTheme(theme);
      // Persist selection
      window.electronAPI.saveSelectedThemeId('stage', theme.id);
    } catch (error) {
      console.error('Failed to parse stage theme data:', error);
    }
  }, []);

  const applyBibleThemeCallback = useCallback((theme: any) => {
    setSelectedBibleTheme(theme);
    window.electronAPI.applyBibleTheme(theme);
    // Persist selection
    window.electronAPI.saveSelectedThemeId('bible', theme.id);
  }, []);

  const applyOBSThemeCallback = useCallback((theme: any) => {
    setSelectedOBSTheme(theme);
    // Set the appropriate separate state based on theme type
    if (theme.type === 'songs') {
      setSelectedOBSSongsTheme(theme);
    } else if (theme.type === 'bible') {
      setSelectedOBSBibleTheme(theme);
    } else if (theme.type === 'prayer') {
      setSelectedOBSPrayerTheme(theme);
    }
    window.electronAPI.applyOBSTheme(theme);
    // Persist selection based on type
    const themeKey = theme.type === 'bible' ? 'obsBible' : theme.type === 'prayer' ? 'obsPrayer' : 'obs';
    window.electronAPI.saveSelectedThemeId(themeKey, theme.id);
  }, []);

  const applyPrayerThemeCallback = useCallback((theme: any) => {
    setSelectedPrayerTheme(theme);
    window.electronAPI.applyPrayerTheme(theme);
    // Persist selection
    window.electronAPI.saveSelectedThemeId('prayer', theme.id);
  }, []);

  const handleCreateNewTheme = useCallback(() => {
    setShowNewThemeModal(true);
    setShowDisplayPanel(false);
  }, []);

  const handleCloseDisplayPanel = useCallback(() => {
    setShowDisplayPanel(false);
  }, []);

  const startEditingTheme = (theme?: any) => {
    if (theme) {
      // Edit existing theme
      const lineStyles = typeof theme.lineStyles === 'string'
        ? JSON.parse(theme.lineStyles)
        : theme.lineStyles || {};
      const viewerBg = typeof theme.viewerBackground === 'string'
        ? JSON.parse(theme.viewerBackground)
        : theme.viewerBackground || { type: 'color', color: '#000000' };
      setEditingTheme({
        id: theme.id,
        name: theme.name,
        viewerBackground: viewerBg,
        lineStyles: {
          original: { fontSize: lineStyles.original?.fontSize || 100, color: lineStyles.original?.color || '#FFFFFF', fontWeight: lineStyles.original?.fontWeight || '500' },
          transliteration: { fontSize: lineStyles.transliteration?.fontSize || 90, color: lineStyles.transliteration?.color || '#FFFFFF', fontWeight: lineStyles.transliteration?.fontWeight || '400' },
          translation: { fontSize: lineStyles.translation?.fontSize || 90, color: lineStyles.translation?.color || '#FFFFFF', fontWeight: lineStyles.translation?.fontWeight || '400' }
        }
      });
    } else {
      // Create new theme
      setEditingTheme({
        name: 'New Theme',
        viewerBackground: { type: 'color', color: '#1a1a2e' },
        lineStyles: {
          original: { fontSize: 100, color: '#FFFFFF', fontWeight: '500' },
          transliteration: { fontSize: 90, color: '#FFFFFF', fontWeight: '400' },
          translation: { fontSize: 90, color: '#FFFFFF', fontWeight: '400' }
        }
      });
    }
    setShowThemeEditor(true);
  };

  const saveTheme = async () => {
    if (!editingTheme) return;
    try {
      const themeData = {
        name: editingTheme.name,
        viewerBackground: editingTheme.viewerBackground,
        lineStyles: editingTheme.lineStyles
      };
      if (editingTheme.id) {
        await window.electronAPI.updateTheme(editingTheme.id, themeData);
      } else {
        await window.electronAPI.createTheme(themeData);
      }
      await loadThemes();
      setShowThemeEditor(false);
      setEditingTheme(null);
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  };

  const deleteThemeById = async (themeId: string) => {
    try {
      await window.electronAPI.deleteTheme(themeId);
      await loadThemes();
    } catch (error) {
      console.error('Failed to delete theme:', error);
    }
  };

  const deleteStageThemeById = async (themeId: string) => {
    try {
      await window.electronAPI.deleteStageTheme(themeId);
      await loadThemes();
    } catch (error) {
      console.error('Failed to delete stage theme:', error);
    }
  };

  // Memoized song editor functions
  const startEditingSong = useCallback((song?: Song) => {
    // Default to express mode when opening editor
    setSongEditorExpressMode(true);
    setSongTagInput('');
    setEditingSlideIndex(0);

    if (song) {
      // Populate express text from existing song slides
      let lastVerseType = '';
      const expressText = song.slides
        .filter(slide => slide.originalText)
        .map(slide => {
          const lines: string[] = [];
          if (slide.verseType && slide.verseType !== lastVerseType) {
            lines.push(`[${slide.verseType}]`);
            lastVerseType = slide.verseType;
          }
          lines.push(slide.originalText || '');
          if (slide.transliteration) lines.push(slide.transliteration);
          if (slide.translation) lines.push(slide.translation);
          if (slide.translationOverflow) lines.push(slide.translationOverflow);
          return lines.join('\n');
        }).join('\n\n');
      setSongEditorExpressText(expressText);

      setEditingSong({
        id: song.id,
        title: song.title,
        author: song.author || '',
        originalLanguage: song.originalLanguage || 'he',
        tags: song.tags || [],
        slides: song.slides.map(s => ({
          originalText: s.originalText || '',
          transliteration: s.transliteration || '',
          translation: s.translation || '',
          translationOverflow: s.translationOverflow || '',
          verseType: s.verseType || 'Verse'
        }))
      });
    } else {
      setSongEditorExpressText('');
      setEditingSong({
        title: 'New Song',
        author: '',
        originalLanguage: 'he',
        tags: [],
        slides: [{
          originalText: '',
          transliteration: '',
          translation: '',
          translationOverflow: '',
          verseType: 'Verse'
        }]
      });
    }
    setEditingSlideIndex(0);
    setShowSongEditor(true);
  }, []);

  const addSlideToEditingSong = () => {
    if (!editingSong) return;
    const newSlides = [...editingSong.slides, {
      originalText: '',
      transliteration: '',
      translation: '',
      translationOverflow: '',
      verseType: 'Verse'
    }];
    setEditingSong({ ...editingSong, slides: newSlides });
    setEditingSlideIndex(newSlides.length - 1);
  };

  const removeSlideFromEditingSong = (index: number) => {
    if (!editingSong || editingSong.slides.length <= 1) return;
    const newSlides = editingSong.slides.filter((_, i) => i !== index);
    setEditingSong({ ...editingSong, slides: newSlides });
    if (editingSlideIndex >= newSlides.length) {
      setEditingSlideIndex(newSlides.length - 1);
    }
  };

  const updateEditingSlide = (field: string, value: string) => {
    if (!editingSong) return;
    const newSlides = [...editingSong.slides];
    newSlides[editingSlideIndex] = { ...newSlides[editingSlideIndex], [field]: value };
    setEditingSong({ ...editingSong, slides: newSlides });
  };

  const autoGenerateSlideContent = async () => {
    if (!editingSong) return;
    const slide = editingSong.slides[editingSlideIndex];
    if (!slide.originalText.trim()) return;

    try {
      const result = await window.electronAPI.processQuickSlide(slide.originalText);
      const newSlides = [...editingSong.slides];
      newSlides[editingSlideIndex] = {
        ...newSlides[editingSlideIndex],
        transliteration: result.transliteration,
        translation: result.translation
      };
      setEditingSong({ ...editingSong, slides: newSlides });
    } catch (error) {
      console.error('Failed to auto-generate:', error);
    }
  };

  const saveSong = async () => {
    if (!editingSong || !editingSong.title.trim()) return;

    // If in express mode, parse the text first
    let slidesToSave = editingSong.slides;
    if (songEditorExpressMode) {
      slidesToSave = parseExpressText();
    }

    // Filter out empty slides
    const validSlides = slidesToSave.filter(slide => slide.originalText.trim());
    if (validSlides.length === 0) {
      alert('Please add at least one slide with content');
      return;
    }

    try {
      const songData = {
        title: editingSong.title,
        author: editingSong.author || undefined,
        originalLanguage: editingSong.originalLanguage,
        tags: editingSong.tags,
        slides: validSlides
      };
      if (editingSong.id) {
        await window.electronAPI.updateSong(editingSong.id, songData);
        // If the edited song is currently selected, update selectedSong with the new data
        if (selectedSong?.id === editingSong.id) {
          setSelectedSong({
            ...selectedSong,
            ...songData,
            id: editingSong.id
          });
        }
      } else {
        await window.electronAPI.createSong(songData);
      }
      await loadSongs();
      setShowSongEditor(false);
      setEditingSong(null);
      setSongEditorExpressMode(false);
      setSongEditorExpressText('');
    } catch (error) {
      console.error('Failed to save song:', error);
    }
  };

  // Express mode functions
  const parseExpressText = () => {
    // Parse express text into slides
    // Format: [VerseType] marks apply to all following slides until next verse type
    // Each slide separated by blank line
    // Within each slide: line1=original, line2=transliteration, line3=translation, line4=translationOverflow
    const slideBlocks = songEditorExpressText.split(/\n\s*\n/); // Split by blank lines
    let currentVerseType = 'Verse';

    const parsedSlides: Array<{ originalText: string; transliteration: string; translation: string; translationOverflow: string; verseType: string }> = [];

    for (const block of slideBlocks) {
      const lines = block.split('\n').map(line => line.trim()).filter(line => line);
      if (lines.length === 0) continue;

      // Check if first line is a verse type marker like [Verse1], [Chorus], etc.
      const verseTypeMatch = lines[0].match(/^\[(.+)\]$/);
      if (verseTypeMatch) {
        currentVerseType = verseTypeMatch[1];
        lines.shift(); // Remove the verse type line
        if (lines.length === 0) continue; // If only verse type marker, skip
      }

      const originalText = lines[0] || '';
      if (originalText) {
        parsedSlides.push({
          originalText,
          transliteration: lines[1] || '',
          translation: lines[2] || '',
          translationOverflow: lines[3] || '',
          verseType: currentVerseType
        });
      }
    }

    return parsedSlides.length > 0 ? parsedSlides : [{
      originalText: '',
      transliteration: '',
      translation: '',
      translationOverflow: '',
      verseType: 'Verse'
    }];
  };

  const convertSlidesToExpressText = () => {
    if (!editingSong) return '';
    let lastVerseType = '';
    return editingSong.slides
      .filter(slide => slide.originalText) // Skip empty slides
      .map(slide => {
        const lines: string[] = [];

        // Add verse type marker if it changed
        if (slide.verseType && slide.verseType !== lastVerseType) {
          lines.push(`[${slide.verseType}]`);
          lastVerseType = slide.verseType;
        }

        lines.push(slide.originalText);
        if (slide.transliteration) lines.push(slide.transliteration);
        if (slide.translation) lines.push(slide.translation);
        if (slide.translationOverflow) lines.push(slide.translationOverflow);
        return lines.join('\n');
      }).join('\n\n');
  };

  const toggleSongExpressMode = () => {
    if (!songEditorExpressMode) {
      // Switching TO express mode - convert slides to text
      setSongEditorExpressText(convertSlidesToExpressText());
    } else {
      // Switching FROM express mode - parse text to slides
      const parsed = parseExpressText();
      setEditingSong(prev => prev ? { ...prev, slides: parsed } : null);
      setEditingSlideIndex(0);
    }
    setSongEditorExpressMode(!songEditorExpressMode);
  };

  // Tag functions
  const addSongTag = (tag: string) => {
    if (!editingSong) return;
    const trimmedTag = tag.trim().toLowerCase();
    if (trimmedTag && !editingSong.tags.includes(trimmedTag)) {
      setEditingSong({ ...editingSong, tags: [...editingSong.tags, trimmedTag] });
    }
    setSongTagInput(''); // Always clear input
  };

  const removeSongTag = (tagToRemove: string) => {
    if (!editingSong) return;
    setEditingSong({ ...editingSong, tags: editingSong.tags.filter(tag => tag !== tagToRemove) });
  };

  // Prayer/Sermon express editor functions
  const closePrayerEditor = useCallback(() => {
    setShowPrayerEditor(false);
    setEditingPrayerPresentation(null);
    setPrayerExpressText('');
  }, []);

  const startEditingPrayerPresentation = useCallback((presentation: Presentation) => {
    if (!presentation.quickModeData) return;

    const qmd = presentation.quickModeData;
    // Convert to express text format
    // Format: Each point separated by blank line
    // Line 1: Hebrew subtitle
    // Line 2: ~English subtitle translation (optional, prefix with ~)
    // Line 3: --- (separator for description)
    // Line 4: Hebrew description
    // Line 5: ~~English description translation (optional, prefix with ~~)
    // Line 6: @hebrewReference | englishReference (if exists)
    const expressText = qmd.subtitles.map(subtitle => {
      const lines: string[] = [];
      if (subtitle.subtitle) lines.push(subtitle.subtitle);
      if (subtitle.subtitleTranslation) lines.push('~' + subtitle.subtitleTranslation);
      if (subtitle.description && subtitle.description !== subtitle.subtitle) {
        lines.push('---');
        lines.push(subtitle.description);
        if (subtitle.descriptionTranslation) lines.push('~~' + subtitle.descriptionTranslation);
      }
      if (subtitle.bibleRef?.reference || subtitle.bibleRef?.hebrewReference) {
        const refParts: string[] = [];
        if (subtitle.bibleRef.hebrewReference) refParts.push(subtitle.bibleRef.hebrewReference);
        if (subtitle.bibleRef.reference) refParts.push(subtitle.bibleRef.reference);
        lines.push('@' + refParts.join(' | '));
      }
      return lines.join('\n');
    }).join('\n\n');

    setPrayerExpressText(expressText);
    setEditingPrayerPresentation(presentation);
    setShowPrayerEditor(true);
  }, []);

  const parsePrayerExpressText = useCallback(() => {
    // Parse express text back to subtitles array
    // Format:
    // Line starting with ~ is subtitle translation
    // Line starting with ~~ is description translation
    // Line starting with @ is bible reference
    // --- separates subtitle from description
    // Normalize line endings (Windows \r\n to Unix \n)
    const normalizedText = prayerExpressText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const pointBlocks = normalizedText.split(/\n\s*\n/);
    const subtitles: QuickModeMetadata['subtitles'] = [];

    for (const block of pointBlocks) {
      const lines = block.split('\n').map(line => line.trim()).filter(line => line);
      if (lines.length === 0) continue;

      let subtitle = '';
      let subtitleTranslation = '';
      let description = '';
      let descriptionTranslation = '';
      let bibleRef: { reference: string; hebrewReference?: string } | undefined;
      let inDescription = false;

      for (const line of lines) {
        // Check for separator (allow some flexibility with dashes)
        if (line === '---' || line === '---' || /^-{3,}$/.test(line)) {
          inDescription = true;
          continue;
        }
        if (line.startsWith('@')) {
          // Parse reference: @hebrewRef | englishRef or just @ref
          const refText = line.slice(1).trim();
          const refParts = refText.split('|').map(p => p.trim());
          if (refParts.length >= 2) {
            bibleRef = { hebrewReference: refParts[0], reference: refParts[1] };
          } else if (refParts.length === 1) {
            bibleRef = { reference: refParts[0] };
          }
          continue;
        }
        // Check for translation lines (~ prefix for subtitle, ~~ prefix for description)
        if (line.startsWith('~~')) {
          descriptionTranslation = descriptionTranslation
            ? descriptionTranslation + '\n' + line.slice(2).trim()
            : line.slice(2).trim();
          continue;
        }
        if (line.startsWith('~')) {
          if (inDescription) {
            // Single ~ in description section is still description translation
            descriptionTranslation = descriptionTranslation
              ? descriptionTranslation + '\n' + line.slice(1).trim()
              : line.slice(1).trim();
          } else {
            subtitleTranslation = subtitleTranslation
              ? subtitleTranslation + '\n' + line.slice(1).trim()
              : line.slice(1).trim();
          }
          continue;
        }
        if (inDescription) {
          description = description ? description + '\n' + line : line;
        } else {
          subtitle = subtitle ? subtitle + '\n' + line : line;
        }
      }

      if (subtitle) {
        subtitles.push({
          subtitle,
          subtitleTranslation: subtitleTranslation || undefined,
          description: description || subtitle,
          descriptionTranslation: descriptionTranslation || undefined,
          bibleRef
        });
      }
    }

    return subtitles;
  }, [prayerExpressText]);

  const savePrayerPresentation = useCallback(async () => {
    if (!editingPrayerPresentation?.quickModeData) return;

    const subtitles = parsePrayerExpressText();
    if (subtitles.length === 0) {
      alert('Please add at least one point');
      return;
    }

    try {
      const updatedQuickModeData = {
        ...editingPrayerPresentation.quickModeData,
        subtitles
      };

      await window.electronAPI.updatePresentation(editingPrayerPresentation.id, {
        quickModeData: updatedQuickModeData
      });

      // Reload presentations and update selectedPresentation to reflect changes
      const presentationList = await window.electronAPI.getPresentations();
      setPresentations(presentationList || []);

      // Update selectedPresentation if it was the one being edited
      if (selectedPresentation?.id === editingPrayerPresentation.id) {
        const updated = presentationList?.find((p: Presentation) => p.id === editingPrayerPresentation.id);
        if (updated) {
          setSelectedPresentation(updated);
        }
      }

      closePrayerEditor();
    } catch (error) {
      console.error('Failed to save prayer presentation:', error);
      alert('Failed to save changes. Please try again.');
    }
  }, [editingPrayerPresentation, parsePrayerExpressText, closePrayerEditor, selectedPresentation]);

  // Memoized deleteSongById
  const deleteSongById = useCallback(async (songId: string) => {
    if (!confirm('Are you sure you want to delete this song?')) return;
    try {
      await window.electronAPI.deleteSong(songId);
      await loadSongs();
      setSelectedSong(prev => prev?.id === songId ? null : prev);
    } catch (error) {
      console.error('Failed to delete song:', error);
    }
  }, [loadSongs]);

  // Set viewer background
  const handleSetBackground = useCallback(async (background: string) => {
    setSelectedBackground(background);
    try {
      await window.electronAPI.setBackground(background);
    } catch (error) {
      console.error('Failed to set background:', error);
    }
  }, []);

  // YouTube helper functions
  const extractYouTubeVideoId = useCallback((url: string): string | null => {
    // Handle various YouTube URL formats
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/ // Direct video ID
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }, []);

  const fetchYouTubeMetadata = useCallback(async (videoId: string): Promise<YouTubeVideo | null> => {
    const fallback = {
      videoId,
      title: `Video ${videoId}`,
      thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
    };

    try {
      const response = await fetch(`https://www.youtube.com/oembed?url=https://youtube.com/watch?v=${videoId}&format=json`);
      if (!response.ok) return fallback;

      let data: any;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Failed to parse YouTube metadata response:', parseError);
        return fallback;
      }

      return {
        videoId,
        title: data.title || `Video ${videoId}`,
        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
      };
    } catch (error) {
      console.error('Failed to fetch YouTube metadata:', error);
      return fallback;
    }
  }, []);

  const handleAddYoutubeVideo = useCallback(async () => {
    if (!youtubeUrlInput.trim()) return;

    const videoId = extractYouTubeVideoId(youtubeUrlInput.trim());
    if (!videoId) {
      alert('Invalid YouTube URL');
      return;
    }

    // Check if already added
    if (youtubeVideos.some(v => v.videoId === videoId)) {
      setYoutubeUrlInput('');
      return;
    }

    setYoutubeLoading(true);
    const metadata = await fetchYouTubeMetadata(videoId);
    if (metadata) {
      setYoutubeVideos(prev => [...prev, metadata]);
    }
    setYoutubeUrlInput('');
    setYoutubeLoading(false);
  }, [youtubeUrlInput, youtubeVideos, extractYouTubeVideoId, fetchYouTubeMetadata]);

  const handleRemoveYoutubeVideo = useCallback((videoId: string) => {
    setYoutubeVideos(prev => prev.filter(v => v.videoId !== videoId));
    if (activeYoutubeVideo?.videoId === videoId) {
      setActiveYoutubeVideo(null);
      setYoutubeOnDisplay(false);
    }
  }, [activeYoutubeVideo]);

  const handleYoutubeDisplay = useCallback(async (video: YouTubeVideo) => {
    setActiveYoutubeVideo(video);
    setYoutubeOnDisplay(true);
    // Clear any other active media
    setActiveMedia(null);

    // Broadcast to online viewers via socket
    window.electronAPI.youtubeLoad(video.videoId, video.title);
  }, []);

  const handleYoutubeStop = useCallback(() => {
    setActiveYoutubeVideo(null);
    setYoutubeOnDisplay(false);
    setYoutubePlaying(false);
    setYoutubeCurrentTime(0);
    setYoutubeDuration(0);

    // Broadcast stop to online viewers
    window.electronAPI.youtubeStop();
  }, []);

  // Check if input looks like a YouTube URL
  const isYouTubeUrl = useCallback((input: string): boolean => {
    const urlPatterns = [
      /youtube\.com\/watch/,
      /youtu\.be\//,
      /youtube\.com\/embed\//,
      /^[a-zA-Z0-9_-]{11}$/ // Direct video ID
    ];
    return urlPatterns.some(pattern => pattern.test(input));
  }, []);

  // Search YouTube videos via IPC (main process handles the API call)
  const searchYouTube = useCallback(async (query: string) => {
    if (!query.trim()) return;

    setYoutubeSearchLoading(true);
    setShowYoutubeSearchResults(true);

    try {
      // Pass configurable timeout from settings (converted to milliseconds)
      const searchTimeoutMs = (settings.youtubeSearchTimeout || 15) * 1000;
      const result = await window.electronAPI.youtubeSearch(query, searchTimeoutMs);

      if (result.success && result.results) {
        setYoutubeSearchResults(result.results);
      } else {
        console.error('YouTube search failed:', result.error);
        alert(t('media.youtubeSearchFailed') || 'YouTube search failed. Please try again.');
        setYoutubeSearchResults([]);
      }
    } catch (error) {
      console.error('YouTube search error:', error);
      alert(t('media.youtubeSearchFailed') || 'YouTube search failed. Please try again.');
      setYoutubeSearchResults([]);
    } finally {
      setYoutubeSearchLoading(false);
    }
  }, [t, settings.youtubeSearchTimeout]);

  // Add video from search results
  const addVideoFromSearch = useCallback((result: YouTubeSearchResult) => {
    // Check if already added
    if (youtubeVideos.some(v => v.videoId === result.videoId)) {
      return;
    }

    const video: YouTubeVideo = {
      videoId: result.videoId,
      title: result.title,
      thumbnail: result.thumbnail
    };

    setYoutubeVideos(prev => [...prev, video]);
  }, [youtubeVideos]);

  // Handle input submission - either add URL or search
  const handleYoutubeInputSubmit = useCallback(async () => {
    if (!youtubeUrlInput.trim()) return;

    if (isYouTubeUrl(youtubeUrlInput.trim())) {
      // It's a URL - add it directly to setlist
      const videoId = extractYouTubeVideoId(youtubeUrlInput.trim());
      if (!videoId) {
        alert(t('media.invalidYoutubeUrl') || 'Invalid YouTube URL');
        return;
      }

      setYoutubeLoading(true);
      const metadata = await fetchYouTubeMetadata(videoId);
      if (metadata) {
        // Add directly to setlist (like search results do)
        const newItem: SetlistItem = {
          id: crypto.randomUUID(),
          type: 'youtube',
          youtubeVideoId: metadata.videoId,
          youtubeTitle: metadata.title,
          youtubeThumbnail: metadata.thumbnail,
          title: metadata.title
        };
        setSetlist(prev => [...prev, newItem]);
      }
      setYoutubeUrlInput('');
      setYoutubeLoading(false);
      setShowYoutubeSearchResults(false);
    } else {
      // It's a search query
      await searchYouTube(youtubeUrlInput.trim());
    }
  }, [youtubeUrlInput, isYouTubeUrl, extractYouTubeVideoId, fetchYouTubeMetadata, searchYouTube, t]);

  // Close search results
  const closeYoutubeSearchResults = useCallback(() => {
    setShowYoutubeSearchResults(false);
    setYoutubeSearchResults([]);
  }, []);

  // Display fullscreen media (takes over from slides)
  const handleDisplayMedia = useCallback(async (type: 'image' | 'video', path: string) => {
    // Encode the path for media:// protocol (for display windows)
    // Use triple-slash format (media://file/path) to avoid hostname issues in child windows
    const encodedPath = path
      .replace(/\\/g, '/')
      .split('/')
      .map(segment => encodeURIComponent(segment))
      .join('/');
    const mediaUrl = `media://file/${encodedPath}`;

    // Reset video status when starting new video (paused until display is ready)
    if (type === 'video') {
      setVideoStatus({ currentTime: 0, duration: 0, isPlaying: false });
    }

    // Use media:// protocol which uses net.fetch for proper range request support
    setActiveMedia({ type, url: mediaUrl });

    try {
      // Send fullscreen media to displays with proper type info (still uses media:// for displays)
      await window.electronAPI.displayMedia({ type, url: mediaUrl });
    } catch (error) {
      console.error('Failed to display media:', error);
    }
  }, []);

  // Play background audio (only in control panel, not on displays)
  const handlePlayAudio = useCallback((path: string, name: string) => {
    // Encode the path for media:// protocol
    // Use triple-slash format (media://file/path) for consistency
    const encodedPath = path
      .replace(/\\/g, '/')
      .split('/')
      .map(segment => encodeURIComponent(segment))
      .join('/');
    const audioUrl = `media://file/${encodedPath}`;

    audioNeedsInitialPlay.current = true; // Flag for onCanPlay to start playback
    setActiveAudio({ url: audioUrl, name });
    setAudioStatus({ currentTime: 0, duration: 0, isPlaying: false });
  }, []);

  // Audio fade duration in ms
  const AUDIO_FADE_DURATION = 500;
  const AUDIO_FADE_STEPS = 20;

  // Clear any ongoing fade
  const clearAudioFade = useCallback(() => {
    if (audioFadeRef.current) {
      clearInterval(audioFadeRef.current);
      audioFadeRef.current = null;
    }
  }, []);

  // Fade in audio
  const fadeInAudio = useCallback(() => {
    if (!audioRef.current) return;
    clearAudioFade();

    const stepTime = AUDIO_FADE_DURATION / AUDIO_FADE_STEPS;
    const volumeStep = audioTargetVolume / AUDIO_FADE_STEPS;
    audioRef.current.volume = 0;
    audioRef.current.play().catch(err => {
      console.error('Audio play error:', err);
    });

    let currentStep = 0;
    audioFadeRef.current = setInterval(() => {
      currentStep++;
      if (audioRef.current) {
        audioRef.current.volume = Math.min(volumeStep * currentStep, audioTargetVolume);
      }
      if (currentStep >= AUDIO_FADE_STEPS) {
        clearAudioFade();
      }
    }, stepTime);
  }, [audioTargetVolume, clearAudioFade]);

  // Fade out audio and then execute callback
  const fadeOutAudio = useCallback((onComplete?: () => void) => {
    if (!audioRef.current) {
      onComplete?.();
      return;
    }
    clearAudioFade();

    const startVolume = audioRef.current.volume;
    if (startVolume === 0) {
      onComplete?.();
      return;
    }

    const stepTime = AUDIO_FADE_DURATION / AUDIO_FADE_STEPS;
    const volumeStep = startVolume / AUDIO_FADE_STEPS;

    let currentStep = 0;
    audioFadeRef.current = setInterval(() => {
      currentStep++;
      if (audioRef.current) {
        audioRef.current.volume = Math.max(startVolume - (volumeStep * currentStep), 0);
      }
      if (currentStep >= AUDIO_FADE_STEPS) {
        clearAudioFade();
        onComplete?.();
      }
    }, stepTime);
  }, [clearAudioFade]);

  // Clear/stop background audio with fade out
  const handleClearAudio = useCallback(() => {
    fadeOutAudio(() => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setActiveAudio(null);
      setActiveAudioSetlistId(null); // Clear setlist tracking on manual stop
      setActivePlaylistId(null); // Clear playlist tracking
      setActivePlaylistIndex(0);
      setActivePlaylistOrder([]);
      setAudioStatus({ currentTime: 0, duration: 0, isPlaying: false });
    });
  }, [fadeOutAudio]);

  // Stable callbacks for memoized AudioPlayerBar
  const handleAudioPlayPause = useCallback(() => {
    if (audioRef.current) {
      if (audioRef.current.paused) {
        // Immediately update UI to show playing state
        setAudioStatus(prev => ({ ...prev, isPlaying: true }));
        fadeInAudio();
      } else {
        // Immediately update UI to show paused state (icon changes instantly)
        setAudioStatus(prev => ({ ...prev, isPlaying: false }));
        fadeOutAudio(() => {
          if (audioRef.current) {
            audioRef.current.pause();
          }
        });
      }
    }
  }, [fadeInAudio, fadeOutAudio]);

  const handleAudioSeek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  }, []);

  const handleAudioVolumeChange = useCallback((newVolume: number) => {
    setAudioTargetVolume(newVolume);
    if (audioRef.current && !audioFadeRef.current) {
      audioRef.current.volume = newVolume;
    }
  }, []);

  // Start playing an audio playlist (optionally from a specific track index)
  const startPlaylist = useCallback((playlistItem: SetlistItem, startFromTrackIndex?: number) => {
    if (!playlistItem.audioPlaylist || playlistItem.audioPlaylist.tracks.length === 0) return;

    const tracks = playlistItem.audioPlaylist.tracks;
    const shuffle = playlistItem.audioPlaylist.shuffle;

    // Create track order (shuffled or sequential)
    let order = tracks.map((_, idx) => idx);
    if (shuffle && startFromTrackIndex === undefined) {
      // Only shuffle if not starting from a specific track
      // Fisher-Yates shuffle
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
    } else if (startFromTrackIndex !== undefined) {
      // If starting from a specific track, reorder to start from that track
      // Put the selected track first, then continue sequentially
      order = [startFromTrackIndex, ...tracks.map((_, idx) => idx).filter(idx => idx !== startFromTrackIndex)];
    }

    setActivePlaylistId(playlistItem.id);
    setActivePlaylistOrder(order);
    setActivePlaylistIndex(0);
    setActiveAudioSetlistId(null); // Clear single-audio setlist tracking

    // Play the first track in order (which is the selected track if specified)
    const firstTrackIdx = order[0];
    const firstTrack = tracks[firstTrackIdx];
    handlePlayAudio(firstTrack.path, firstTrack.name);
  }, [handlePlayAudio]);

  // Play next track in playlist (called when current track ends)
  const playNextPlaylistTrack = useCallback(() => {
    if (!activePlaylistId) return false;

    const playlistItem = setlist.find(item => item.id === activePlaylistId);
    if (!playlistItem?.audioPlaylist) return false;

    const tracks = playlistItem.audioPlaylist.tracks;
    const nextIndex = activePlaylistIndex + 1;

    if (nextIndex >= activePlaylistOrder.length) {
      // Playlist finished
      setActivePlaylistId(null);
      setActivePlaylistIndex(0);
      setActivePlaylistOrder([]);
      return false;
    }

    // Play next track
    setActivePlaylistIndex(nextIndex);
    const nextTrackIdx = activePlaylistOrder[nextIndex];
    const nextTrack = tracks[nextTrackIdx];
    handlePlayAudio(nextTrack.path, nextTrack.name);
    return true;
  }, [activePlaylistId, activePlaylistIndex, activePlaylistOrder, setlist, handlePlayAudio]);

  // Open edit playlist modal
  const openEditPlaylistModal = useCallback((item: SetlistItem) => {
    if (!item.audioPlaylist) return;
    setEditingPlaylistItemId(item.id);
    setEditingPlaylistTracks([...item.audioPlaylist.tracks]);
    setEditingPlaylistName(item.audioPlaylist.name);
    setEditingPlaylistShuffle(item.audioPlaylist.shuffle);
  }, []);

  // Close edit playlist modal
  const closeEditPlaylistModal = useCallback(() => {
    setEditingPlaylistItemId(null);
    setEditingPlaylistTracks([]);
    setEditingPlaylistName('');
    setEditingPlaylistShuffle(false);
    setEditPlaylistDraggedIndex(null);
    setEditPlaylistDropTargetIndex(null);
  }, []);

  // Save edited playlist to setlist item
  const saveEditedPlaylist = useCallback(() => {
    if (!editingPlaylistItemId || editingPlaylistTracks.length === 0) return;

    setSetlist(prev => prev.map(item => {
      if (item.id === editingPlaylistItemId && item.audioPlaylist) {
        return {
          ...item,
          audioPlaylist: {
            ...item.audioPlaylist,
            tracks: editingPlaylistTracks,
            name: editingPlaylistName || item.audioPlaylist.name,
            shuffle: editingPlaylistShuffle
          }
        };
      }
      return item;
    }));

    closeEditPlaylistModal();
  }, [editingPlaylistItemId, editingPlaylistTracks, editingPlaylistName, editingPlaylistShuffle, closeEditPlaylistModal]);

  // Save edited playlist to database
  const saveEditedPlaylistToDatabase = useCallback(async () => {
    if (editingPlaylistTracks.length === 0) return;

    const name = editingPlaylistName.trim() || `Playlist (${editingPlaylistTracks.length} tracks)`;

    try {
      await window.electronAPI.createAudioPlaylist({
        name,
        tracks: editingPlaylistTracks,
        shuffle: editingPlaylistShuffle
      });
      log.info('Playlist saved to database');
    } catch (error) {
      log.error('Failed to save playlist to database:', error);
    }
  }, [editingPlaylistTracks, editingPlaylistName, editingPlaylistShuffle]);

  // Handle track reordering in edit modal
  const handleEditPlaylistTrackDragStart = useCallback((index: number) => {
    setEditPlaylistDraggedIndex(index);
  }, []);

  const handleEditPlaylistTrackDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setEditPlaylistDropTargetIndex(index);
  }, []);

  const handleEditPlaylistTrackDragEnd = useCallback(() => {
    if (editPlaylistDraggedIndex !== null && editPlaylistDropTargetIndex !== null && editPlaylistDraggedIndex !== editPlaylistDropTargetIndex) {
      setEditingPlaylistTracks(prev => {
        const newTracks = [...prev];
        const [removed] = newTracks.splice(editPlaylistDraggedIndex, 1);
        const insertIndex = editPlaylistDropTargetIndex > editPlaylistDraggedIndex ? editPlaylistDropTargetIndex - 1 : editPlaylistDropTargetIndex;
        newTracks.splice(insertIndex, 0, removed);
        return newTracks;
      });
    }
    setEditPlaylistDraggedIndex(null);
    setEditPlaylistDropTargetIndex(null);
  }, [editPlaylistDraggedIndex, editPlaylistDropTargetIndex]);

  const removeEditPlaylistTrack = useCallback((index: number) => {
    setEditingPlaylistTracks(prev => prev.filter((_, i) => i !== index));
  }, []);

  const sendCurrentSlide = useCallback((song: Song | null, slideIndex: number, mode: DisplayMode, combinedIndices?: number[], contentType: 'song' | 'bible' | 'prayer' = 'song') => {
    if (!song || !song.slides[slideIndex]) {
      window.electronAPI.sendBlank();
      return;
    }

    const slide = song.slides[slideIndex];
    const nextSlide = song.slides[slideIndex + 1] || null;

    // If in original mode with combined slides, include both slides' data
    // Check length AFTER filtering to ensure we actually have multiple valid slides
    const combinedSlidesRaw = mode === 'original' && combinedIndices && combinedIndices.length > 1
      ? combinedIndices.map(i => song.slides[i]).filter(Boolean)
      : null;
    const combinedSlides = combinedSlidesRaw && combinedSlidesRaw.length > 1 ? combinedSlidesRaw : null;

    window.electronAPI.sendSlide({
      songId: song.id,
      slideIndex,
      displayMode: mode,
      isBlank: false,
      songTitle: song.title,
      contentType, // 'song', 'bible', or 'prayer' - determines which theme to apply
      backgroundImage: selectedBackground || undefined, // Include current background (omit if empty to preserve viewer state)
      slideData: (() => {
        const refHebrew = contentType === 'bible' ? (slide as any).hebrewReference : (slide as any).reference;
        const refEnglish = contentType === 'bible' ? (slide as any).reference : undefined;
        return {
          originalText: slide.originalText,
          transliteration: slide.transliteration,
          translation: slide.translation,
          translationOverflow: slide.translationOverflow,
          verseType: slide.verseType,
          // Prayer/Sermon theme fields (mapped from slide structure when available)
          title: (slide as any).title,
          titleTranslation: (slide as any).titleTranslation,
          subtitle: (slide as any).subtitle || slide.originalText,
          subtitleTranslation: (slide as any).subtitleTranslation || slide.translation,
          description: (slide as any).description,
          descriptionTranslation: (slide as any).descriptionTranslation,
          // Reference fields - for Bible content: hebrewReference goes to 'reference', English to 'referenceEnglish'
          reference: refHebrew,
          referenceTranslation: (slide as any).referenceTranslation,
          referenceEnglish: refEnglish
        };
      })(),
      nextSlideData: nextSlide ? {
        originalText: nextSlide.originalText,
        transliteration: nextSlide.transliteration,
        translation: nextSlide.translation,
        translationOverflow: nextSlide.translationOverflow,
        verseType: nextSlide.verseType,
        // Prayer/Sermon content fields
        title: (nextSlide as any).title,
        titleTranslation: (nextSlide as any).titleTranslation,
        subtitle: (nextSlide as any).subtitle,
        subtitleTranslation: (nextSlide as any).subtitleTranslation,
        description: (nextSlide as any).description,
        descriptionTranslation: (nextSlide as any).descriptionTranslation,
        reference: (nextSlide as any).reference,
        referenceTranslation: (nextSlide as any).referenceTranslation
      } : null,
      combinedSlides: combinedSlides?.map(s => ({
        originalText: s.originalText,
        transliteration: s.transliteration,
        translation: s.translation,
        translationOverflow: s.translationOverflow,
        verseType: s.verseType,
        // Prayer/Sermon content fields
        title: (s as any).title,
        titleTranslation: (s as any).titleTranslation,
        subtitle: (s as any).subtitle,
        subtitleTranslation: (s as any).subtitleTranslation,
        description: (s as any).description,
        descriptionTranslation: (s as any).descriptionTranslation,
        reference: (s as any).reference,
        referenceTranslation: (s as any).referenceTranslation
      })) || null
    });
  }, [selectedBackground, selectedBibleTheme, selectedPrayerTheme]);

  // Send prayer/sermon presentation slide using prayer theme instead of textbox rendering
  const sendPrayerPresentationSlide = useCallback((
    presentation: Presentation,
    slideIndex: number,
    mode: DisplayMode
  ) => {
    if (!presentation.quickModeData) {
      return;
    }

    const qmd = presentation.quickModeData;
    const subtitle = qmd.subtitles[slideIndex];
    if (!subtitle) return;

    const hebrewRef = subtitle.bibleRef?.hebrewReference;
    const englishRef = subtitle.bibleRef?.reference;

    const slideData = {
      title: qmd.title,
      titleTranslation: (qmd as any).titleTranslation,
      subtitle: subtitle.subtitle,
      subtitleTranslation: subtitle.subtitleTranslation,
      description: subtitle.description,
      descriptionTranslation: subtitle.descriptionTranslation,
      reference: hebrewRef || englishRef,
      referenceTranslation: englishRef
    };

    // Update live preview state FIRST for immediate UI response (atomic update)
    setLiveState({ slideData, contentType: 'prayer', songId: presentation.id, slideIndex });

    // Send to display (fire and forget)
    window.electronAPI.sendSlide({
      songId: presentation.id,
      slideIndex,
      displayMode: mode,
      isBlank: false,
      songTitle: presentation.title,
      contentType: 'prayer',
      backgroundImage: selectedBackground || undefined,
      activeTheme: selectedPrayerTheme,
      slideData
    });
  }, [selectedBackground, selectedPrayerTheme]);

  // Combined slides for original-only mode (pairs consecutive same-verseType slides)
  // NOTE: This must be defined before handleClearMedia which depends on it
  const combinedSlidesData = useMemo(() => {
    if (displayMode !== 'original' || !selectedSong?.slides) return null;
    return createCombinedSlides(selectedSong.slides);
  }, [displayMode, selectedSong?.slides]);

  // Clear fullscreen media and restore slides
  const handleClearMedia = useCallback(async () => {
    setActiveMedia(null);
    setVideoStatus({ currentTime: 0, duration: 0, isPlaying: false });

    try {
      // Clear fullscreen media
      await window.electronAPI.clearMedia();

      // Re-send the current slide to restore display
      if (selectedSong && currentSlideIndex >= 0) {
        // If in original mode, get the combined indices for the current slide
        let combinedIndices: number[] | undefined;
        if (displayMode === 'original' && combinedSlidesData) {
          const combinedIdx = combinedSlidesData.originalToCombined.get(currentSlideIndex);
          if (combinedIdx !== undefined) {
            combinedIndices = combinedSlidesData.combinedToOriginal.get(combinedIdx);
          }
        }
        sendCurrentSlide(selectedSong, currentSlideIndex, displayMode, combinedIndices, currentContentType);
      }
    } catch (error) {
      console.error('Failed to clear media:', error);
    }
  }, [selectedSong, currentSlideIndex, displayMode, sendCurrentSlide, currentContentType, combinedSlidesData]);

  // Video playback control handlers
  const handleVideoPlayPause = useCallback(async () => {
    // Control preview video
    if (previewVideoRef.current) {
      if (videoStatus.isPlaying) {
        previewVideoRef.current.pause();
      } else {
        previewVideoRef.current.play().catch(console.error);
      }
    }
    // Also send command to display windows
    if (videoStatus.isPlaying) {
      await window.electronAPI.pauseVideo();
    } else {
      await window.electronAPI.resumeVideo();
    }
  }, [videoStatus.isPlaying]);

  const handleVideoSeek = useCallback((time: number) => {
    if (isNaN(time) || time < 0) return;

    // Pause both first for sync
    const video = previewVideoRef.current;
    const wasPlaying = videoStatus.isPlaying;

    // Pause preview
    if (video) {
      video.pause();
    }
    // Pause display
    window.electronAPI.pauseVideo();
    setVideoStatus(prev => ({ ...prev, isPlaying: false }));

    // Small delay to ensure pause takes effect
    setTimeout(() => {
      // Seek preview
      if (video) {
        video.currentTime = time;
      }
      // Seek display
      window.electronAPI.seekVideo(time);

      // Resume after another small delay if was playing
      if (wasPlaying) {
        setTimeout(() => {
          if (video) {
            video.play().catch(() => {});
          }
          window.electronAPI.resumeVideo();
          setVideoStatus(prev => ({ ...prev, isPlaying: true }));
        }, 150);
      }
    }, 50);
  }, [videoStatus.isPlaying]);

  const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Memoized drag handlers for song list
  const handleSongDragStart = useCallback((song: Song) => {
    setDraggedSong(song);
  }, []);

  const handleSongDragEnd = useCallback(() => {
    setDraggedSong(null);
  }, []);

  // ============ Auth Functions ============

  const initializeAuth = async () => {
    try {
      const state = await window.electronAPI.getAuthState();
      setAuthState({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        serverUrl: state.serverUrl
      });

      // If authenticated, auto-connect to online mode
      if (state.isAuthenticated) {
        const result = await window.electronAPI.connectWithAuth();
        if (result.success) {
          // Create a room automatically
          const room = await window.electronAPI.createOnlineRoom();
          if (room) {
            setRoomPin(room.roomPin);
          }
        }
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await window.electronAPI.logout();
      setAuthState({ isAuthenticated: false, user: null, serverUrl: authState.serverUrl });
      setOnlineConnected(false);
      setRoomPin(null);
      setViewerCount(0);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Note: Unsaved changes tracking is now handled by SetlistContext

  // Sync selectedCombinedIndex when mode changes or song changes
  useEffect(() => {
    if (combinedSlidesData && currentSlideIndex !== null) {
      const combinedIdx = combinedSlidesData.originalToCombined.get(currentSlideIndex);
      if (combinedIdx !== undefined) {
        setSelectedCombinedIndex(combinedIdx);
      }
    }
  }, [combinedSlidesData, currentSlideIndex]);

  // Re-send current slide with combined data when combinedSlidesData becomes available
  // This handles cases where a song is selected in original mode - the initial send
  // doesn't have combined indices, but once computed, we re-send with proper data
  const prevCombinedSlidesDataRef = useRef<typeof combinedSlidesData>(null);
  useEffect(() => {
    // Only trigger when combinedSlidesData becomes available (was null, now has data)
    const wasNull = prevCombinedSlidesDataRef.current === null;
    const isNowAvailable = combinedSlidesData !== null;
    prevCombinedSlidesDataRef.current = combinedSlidesData;

    if (wasNull && isNowAvailable && selectedSong && !isBlank && currentSlideIndex !== null) {
      // Get the combined index for the current slide
      const combinedIdx = combinedSlidesData.originalToCombined.get(currentSlideIndex);
      if (combinedIdx !== undefined) {
        const combinedIndices = combinedSlidesData.combinedToOriginal.get(combinedIdx);
        if (combinedIndices && combinedIndices.length > 1) {
          // Re-send with combined data
          sendCurrentSlide(selectedSong, currentSlideIndex, displayMode, combinedIndices, currentContentType);
        }
      }
    }
  }, [combinedSlidesData, selectedSong, isBlank, currentSlideIndex, displayMode, currentContentType, sendCurrentSlide]);

  const openDisplay = async (displayId: number, type: 'viewer' | 'stage') => {
    await window.electronAPI.openDisplayWindow(displayId, type);
    loadDisplays();
  };

  const closeDisplay = async (displayId: number) => {
    await window.electronAPI.closeDisplayWindow(displayId);
    loadDisplays();
  };

  // Memoized selectSong to prevent recreation on every render
  const selectSong = useCallback((song: Song, contentType: 'song' | 'bible' | 'prayer' = 'song', sendToDisplay: boolean = true) => {
    setSelectedSong(song);
    // If selecting the song that's currently live, restore to the live slide index
    // Otherwise reset to 0
    if (song.id === liveSongId) {
      setCurrentSlideIndex(liveSlideIndex);
    } else {
      setCurrentSlideIndex(0);
    }
    setSelectedPresentation(null); // Clear presentation selection
    setCurrentPresentationSlideIndex(0);
    setCurrentContentType(contentType);

    // Only send to display if requested
    if (sendToDisplay) {
      setIsBlank(false);

      // Apply the appropriate OBS theme based on content type
      if (contentType === 'bible' && selectedOBSBibleTheme) {
        window.electronAPI.applyOBSTheme(selectedOBSBibleTheme);
      } else if (contentType === 'prayer' && selectedOBSPrayerTheme) {
        window.electronAPI.applyOBSTheme(selectedOBSPrayerTheme);
      } else if (contentType === 'song' && selectedOBSSongsTheme) {
        window.electronAPI.applyOBSTheme(selectedOBSSongsTheme);
      }

      // Update live preview data (atomic update)
      const slide = song.slides[0];
      const slideData = contentType === 'bible' ? {
        ...slide,
        reference: (slide as any).hebrewReference || song.title,
        referenceEnglish: (slide as any).reference
      } : slide;
      setLiveState({ slideData, contentType, songId: song.id, slideIndex: 0 });

      sendCurrentSlide(song, 0, displayMode, undefined, contentType);
    }
  }, [sendCurrentSlide, displayMode, selectedOBSBibleTheme, selectedOBSSongsTheme, selectedOBSPrayerTheme, liveSongId, liveSlideIndex]);

  // Memoized goToSlide - always sends to display when clicking on a slide card
  const goToSlide = useCallback((index: number, combinedIndices?: number[]) => {
    if (!selectedSong) return;
    const newIndex = Math.max(0, Math.min(index, selectedSong.slides.length - 1));
    setCurrentSlideIndex(newIndex);
    setIsBlank(false); // Always show when clicking on a slide

    // Apply the appropriate OBS theme based on content type
    if (currentContentType === 'bible' && selectedOBSBibleTheme) {
      window.electronAPI.applyOBSTheme(selectedOBSBibleTheme);
    } else if (currentContentType === 'prayer' && selectedOBSPrayerTheme) {
      window.electronAPI.applyOBSTheme(selectedOBSPrayerTheme);
    } else if (currentContentType === 'song' && selectedOBSSongsTheme) {
      window.electronAPI.applyOBSTheme(selectedOBSSongsTheme);
    }

    // Update live preview data (atomic update)
    const slide = selectedSong.slides[newIndex];
    const slideData = currentContentType === 'bible' ? {
      ...slide,
      reference: (slide as any).hebrewReference || selectedSong.title,
      referenceEnglish: (slide as any).reference
    } : slide;
    setLiveState({ slideData, contentType: currentContentType, songId: selectedSong.id, slideIndex: newIndex });

    sendCurrentSlide(selectedSong, newIndex, displayMode, combinedIndices, currentContentType);
  }, [selectedSong, sendCurrentSlide, displayMode, currentContentType, selectedOBSBibleTheme, selectedOBSSongsTheme, selectedOBSPrayerTheme]);

  // Memoized selectCombinedSlide (for original-only mode)
  const selectCombinedSlide = useCallback((combinedIndex: number) => {
    if (!combinedSlidesData || !selectedSong) {
      return;
    }

    setSelectedCombinedIndex(combinedIndex);
    setIsBlank(false);

    const originalIndices = combinedSlidesData.combinedToOriginal.get(combinedIndex);
    if (!originalIndices || originalIndices.length === 0) return;

    const firstOriginalIndex = originalIndices[0];
    setCurrentSlideIndex(firstOriginalIndex);

    // Update live state for immediate UI response (sets liveSongId for selection highlighting)
    const slide = selectedSong.slides[firstOriginalIndex];
    const slideData = currentContentType === 'bible' ? {
      ...slide,
      reference: (slide as any).hebrewReference || selectedSong.title,
      referenceEnglish: (slide as any).reference
    } : slide;
    setLiveState({ slideData, contentType: currentContentType, songId: selectedSong.id, slideIndex: firstOriginalIndex });

    // Send slide with combined indices
    sendCurrentSlide(selectedSong, firstOriginalIndex, displayMode, originalIndices, currentContentType);
  }, [combinedSlidesData, selectedSong, sendCurrentSlide, displayMode, currentContentType]);

  // Memoized nextSlide
  const nextSlide = useCallback(() => {
    if (!selectedSong) return;

    // If in original mode with combined slides, navigate by combined index
    if (displayMode === 'original' && combinedSlidesData) {
      if (selectedCombinedIndex < combinedSlidesData.combinedSlides.length - 1) {
        selectCombinedSlide(selectedCombinedIndex + 1);
        return;
      }
    } else if (currentSlideIndex < selectedSong.slides.length - 1) {
      goToSlide(currentSlideIndex + 1);
    }
  }, [selectedSong, displayMode, combinedSlidesData, selectedCombinedIndex, selectCombinedSlide, currentSlideIndex, goToSlide]);

  // Memoized prevSlide
  const prevSlide = useCallback(() => {
    if (!selectedSong) return;

    // If in original mode with combined slides, navigate by combined index
    if (displayMode === 'original' && combinedSlidesData) {
      if (selectedCombinedIndex > 0) {
        selectCombinedSlide(selectedCombinedIndex - 1);
        return;
      }
    } else if (currentSlideIndex > 0) {
      goToSlide(currentSlideIndex - 1);
    }
  }, [selectedSong, displayMode, combinedSlidesData, selectedCombinedIndex, selectCombinedSlide, currentSlideIndex, goToSlide]);

  // Memoized selectSlide
  const selectSlide = useCallback((index: number) => {
    if (!selectedSong) return;
    setIsBlank(false);

    // If in original mode, find the combined index and select it
    if (displayMode === 'original' && combinedSlidesData) {
      const combinedIdx = combinedSlidesData.originalToCombined.get(index);
      if (combinedIdx !== undefined) {
        selectCombinedSlide(combinedIdx);
        return;
      }
    }

    goToSlide(index);
  }, [selectedSong, displayMode, combinedSlidesData, selectCombinedSlide, goToSlide]);

  const toggleBlank = useCallback(() => {
    setIsBlank(prevBlank => {
      const newBlankState = !prevBlank;
      if (newBlankState) {
        window.electronAPI.sendBlank();
        setLiveState({ slideData: null, contentType: null, songId: null, slideIndex: 0 });
      } else if (selectedSong) {
        // Update live preview data (atomic update)
        const slide = selectedSong.slides[currentSlideIndex];
        const slideData = currentContentType === 'bible' ? {
          ...slide,
          reference: (slide as any).hebrewReference || selectedSong.title,
          referenceEnglish: (slide as any).reference
        } : slide;
        setLiveState({ slideData, contentType: currentContentType, songId: selectedSong.id, slideIndex: currentSlideIndex });
        sendCurrentSlide(selectedSong, currentSlideIndex, displayMode, undefined, currentContentType);
      }
      return newBlankState;
    });
  }, [selectedSong, currentSlideIndex, displayMode, currentContentType, sendCurrentSlide]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // ? or F1 for help
      if (e.key === '?' || e.key === 'F1') {
        e.preventDefault();
        setShowKeyboardHelp(true);
        return;
      }

      // Escape to close modals
      if (e.key === 'Escape') {
        setShowKeyboardHelp(false);
        setShowQuickSlideModal(false);
        return;
      }

      // Arrow keys for slide navigation
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        nextSlide();
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        prevSlide();
        return;
      }

      // B for blank
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        toggleBlank();
        return;
      }

      // Q for quick slide
      if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        setShowQuickSlideModal(true);
        return;
      }

      // Space to toggle display mode
      if (e.key === ' ') {
        e.preventDefault();
        const newMode = displayMode === 'bilingual' ? 'original' : 'bilingual';
        setDisplayMode(newMode);
        // Clear the screen when switching display modes
        setIsBlank(true);
        setLiveState({ slideData: null, contentType: null, songId: null, slideIndex: 0 });
        window.electronAPI.sendBlank();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSong, selectedPresentation, currentSlideIndex, currentPresentationSlideIndex, displayMode, currentContentType, nextSlide, prevSlide, toggleBlank, sendCurrentSlide, sendPrayerPresentationSlide]);

  // Remote Control: Sync state to remote control server
  useEffect(() => {
    // Get current item info
    let currentItem = null;
    let totalSlides = 0;
    let slideIndex = currentSlideIndex;
    let slides: Array<{ index: number; preview: string; verseType?: string }> = [];

    if (selectedPresentation) {
      currentItem = {
        id: selectedPresentation.id,
        type: 'presentation',
        title: selectedPresentation.title || 'Untitled',
        slideCount: selectedPresentation.slides?.length || 0
      };
      totalSlides = selectedPresentation.slides?.length || 0;
      slideIndex = currentPresentationSlideIndex;
      // Build slides preview for presentations
      slides = (selectedPresentation.slides || []).map((slide, idx) => {
        // Get preview text from text boxes
        const textBoxes = slide.textBoxes || [];
        const previewText = textBoxes.map((tb: any) => tb.text || '').filter(Boolean).join(' ').slice(0, 60);
        return {
          index: idx,
          preview: previewText || `Slide ${idx + 1}`,
          verseType: `Slide ${idx + 1}`
        };
      });
    } else if (selectedSong) {
      currentItem = {
        id: selectedSong.id,
        type: currentContentType,
        title: selectedSong.title || 'Untitled',
        slideCount: selectedSong.slides?.length || 0
      };

      // Use combined slides when in original mode
      if (displayMode === 'original' && combinedSlidesData) {
        totalSlides = combinedSlidesData.combinedSlides.length;
        slideIndex = selectedCombinedIndex;
        slides = combinedSlidesData.combinedSlides.map((item, idx) => {
          if (item.type === 'combined' && item.slides) {
            // Combined slide - show both slides' text
            const preview = item.slides.map(s => s.originalText || '').join(' / ').slice(0, 80);
            return {
              index: idx,
              preview: preview,
              verseType: item.verseType || item.label,
              isCombined: true
            };
          } else {
            // Single slide
            const slide = item.slide;
            return {
              index: idx,
              preview: (slide?.originalText || '').slice(0, 60),
              verseType: item.verseType || item.label
            };
          }
        });
      } else {
        totalSlides = selectedSong.slides?.length || 0;
        // Build slides preview for songs/bible (bilingual/translation mode)
        slides = (selectedSong.slides || []).map((slide, idx) => ({
          index: idx,
          preview: (slide.originalText || slide.translation || '').slice(0, 60),
          verseType: slide.verseType || `Slide ${idx + 1}`
        }));
      }
    }

    // Build setlist summary for remote
    const setlistSummary = setlist.map(item => ({
      id: item.id,
      type: item.type,
      title: item.song?.title || item.presentation?.title || item.title || item.type
    }));

    // Collect active tools
    const activeTools: string[] = [];
    setlist.forEach(item => {
      if (item.type === 'countdown' || item.type === 'announcement' || item.type === 'clock' || item.type === 'stopwatch') {
        activeTools.push(item.type);
      }
    });

    // Update remote control state
    window.electronAPI.remoteControl.updateState({
      currentItem,
      currentSlideIndex: slideIndex,
      totalSlides,
      displayMode,
      isBlank,
      setlist: setlistSummary,
      slides,
      activeTools,
      onlineViewerCount: viewerCount,
      activeMedia: activeMedia ? { type: activeMedia.type, name: activeMedia.url.split('/').pop() || 'Media' } : null,
      activeAudio: activeAudio ? {
        name: activeAudio.name,
        isPlaying: audioStatus.isPlaying,
        currentTime: audioStatus.currentTime,
        duration: audioStatus.duration,
        volume: audioTargetVolume
      } : null,
      activeVideo: (activeMedia && activeMedia.type === 'video') ? {
        name: decodeURIComponent(activeMedia.url.split('/').pop() || 'Video'),
        isPlaying: videoStatus.isPlaying,
        currentTime: videoStatus.currentTime,
        duration: videoStatus.duration,
        volume: videoVolume
      } : null,
      activeYoutube: (youtubeOnDisplay && activeYoutubeVideo) ? {
        videoId: activeYoutubeVideo.videoId,
        title: activeYoutubeVideo.title || 'YouTube Video',
        isPlaying: youtubePlaying,
        currentTime: youtubeCurrentTime,
        duration: youtubeDuration
      } : null
    });
  }, [selectedSong, selectedPresentation, currentSlideIndex, currentPresentationSlideIndex, displayMode, isBlank, setlist, currentContentType, viewerCount, combinedSlidesData, selectedCombinedIndex, activeMedia, activeAudio, audioStatus, audioTargetVolume, videoStatus, videoVolume, youtubeOnDisplay, activeYoutubeVideo, youtubePlaying, youtubeCurrentTime, youtubeDuration]);

  // Remote Control: Listen for commands from mobile remote
  useEffect(() => {
    const unsubscribe = window.electronAPI.remoteControl.onCommand((command) => {
      switch (command.type) {
        case 'slide:next':
          nextSlide();
          break;
        case 'slide:prev':
          prevSlide();
          break;
        case 'slide:goto':
          if (command.payload?.index !== undefined) {
            if (displayMode === 'original' && combinedSlidesData) {
              selectCombinedSlide(command.payload.index);
            } else {
              goToSlide(command.payload.index);
            }
          }
          break;
        case 'slide:blank':
          toggleBlank();
          break;
        case 'setlist:select':
          if (command.payload?.id) {
            // Find the item in the setlist and select it
            const item = setlist.find(s => s.id === command.payload.id);
            if (item) {
              if (item.type === 'song' && item.song) {
                setSelectedPresentation(null);
                setSelectedSong(item.song);
                setCurrentSlideIndex(0);
                setCurrentContentType('song');
                setIsBlank(false);
              } else if (item.type === 'bible' && item.song) {
                setSelectedPresentation(null);
                setSelectedSong(item.song);
                setCurrentSlideIndex(0);
                setCurrentContentType('bible');
                setIsBlank(false);
              } else if (item.type === 'presentation' && item.presentation) {
                setSelectedSong(null);
                setSelectedPresentation(item.presentation);
                setCurrentPresentationSlideIndex(0);
                if (item.presentation.quickModeData?.type === 'prayer' || item.presentation.quickModeData?.type === 'sermon') {
                  setCurrentContentType('prayer');
                } else {
                  setCurrentContentType('song');
                }
                setIsBlank(false);
              } else if (item.type === 'media' && item.mediaPath && item.mediaType) {
                if (item.mediaType === 'audio') {
                  // Audio: play in background audio player (not on display)
                  handlePlayAudio(item.mediaPath, item.mediaName || item.title || 'Audio');
                  setActiveAudioSetlistId(item.id);
                } else {
                  // Image/Video: display on screen
                  // Convert file path to media:// protocol
                  const encodedPath = item.mediaPath
                    .replace(/\\/g, '/')
                    .split('/')
                    .map(segment => encodeURIComponent(segment))
                    .join('/');
                  const mediaUrl = `media://file/${encodedPath}`;

                  setSelectedSong(null);
                  setSelectedPresentation(null);
                  setActiveMedia({ type: item.mediaType as 'image' | 'video', url: mediaUrl });
                  setIsBlank(false);
                  window.electronAPI.displayMedia({ type: item.mediaType, url: mediaUrl });
                }
              }
            }
          }
          break;
        case 'mode:set':
          if (command.payload?.mode) {
            const newMode = command.payload.mode as DisplayMode;
            setDisplayMode(newMode);
            // Clear the screen when switching display modes
            setIsBlank(true);
            setLiveState({ slideData: null, contentType: null, songId: null, slideIndex: 0 });
            window.electronAPI.sendBlank();
          }
          break;
        case 'library:addSong':
          if (command.payload?.songId) {
            const song = songs.find(s => s.id === command.payload.songId);
            if (song) {
              setSetlist(prev => [...prev, { id: crypto.randomUUID(), type: 'song', song }]);
            }
          }
          break;
        case 'library:selectSong':
          if (command.payload?.songId) {
            const song = songs.find(s => s.id === command.payload.songId);
            if (song) {
              setSelectedPresentation(null);
              setSelectedSong(song);
              setCurrentSlideIndex(0);
              setCurrentContentType('song');
              setIsBlank(false);
              sendCurrentSlide(song, 0, displayMode, undefined, 'song');
            }
          }
          break;
        case 'library:addBible':
          if (command.payload?.book && command.payload?.chapter) {
            // Fetch Bible chapter and add to setlist
            window.electronAPI.getBibleVerses(command.payload.book, command.payload.chapter).then((result: any) => {
              if (result && result.slides && result.slides.length > 0) {
                // Filter slides if verse range is specified
                let filteredSlides = result.slides;
                const verseStart = command.payload.verseStart;
                const verseEnd = command.payload.verseEnd || verseStart;
                if (verseStart) {
                  filteredSlides = result.slides.filter((s: any) => {
                    // Extract verse number from verseType like "Genesis 1:5"
                    const verseMatch = s.verseType?.match(/:(\d+)$/);
                    const verseNum = verseMatch ? parseInt(verseMatch[1]) : 0;
                    return verseNum >= verseStart && verseNum <= (verseEnd || verseStart);
                  });
                }

                // Build title with verse range if specified
                let title = `${command.payload.book} ${command.payload.chapter}`;
                if (verseStart) {
                  title += `:${verseStart}`;
                  if (verseEnd && verseEnd > verseStart) {
                    title += `-${verseEnd}`;
                  }
                }

                const biblePassage: Song = {
                  id: crypto.randomUUID(),
                  title: title,
                  slides: filteredSlides
                };
                setSetlist(prev => [...prev, { id: crypto.randomUUID(), type: 'bible', song: biblePassage, title: biblePassage.title }]);
              }
            }).catch((err: any) => {
              console.error('[ControlPanel] Error adding Bible from remote:', err);
            });
          }
          break;
        case 'library:selectBible':
          if (command.payload?.book && command.payload?.chapter) {
            window.electronAPI.getBibleVerses(command.payload.book, command.payload.chapter).then((result: any) => {
              if (result && result.slides && result.slides.length > 0) {
                const biblePassage: Song = {
                  id: crypto.randomUUID(),
                  title: `${command.payload.book} ${command.payload.chapter}`,
                  slides: result.slides
                };
                setSelectedPresentation(null);
                setSelectedSong(biblePassage);
                setCurrentSlideIndex(0);
                setCurrentContentType('bible');
                setIsBlank(false);
                sendCurrentSlide(biblePassage, 0, displayMode, undefined, 'bible');
              }
            }).catch((err: any) => {
              console.error('[ControlPanel] Error selecting Bible from remote:', err);
            });
          }
          break;
        case 'library:addMedia':
          if (command.payload?.mediaId) {
            window.electronAPI.getMediaLibraryItem(command.payload.mediaId).then((media: any) => {
              if (media) {
                setSetlist(prev => [...prev, {
                  id: crypto.randomUUID(),
                  type: 'media',
                  mediaType: media.type,
                  mediaPath: media.processedPath || media.originalPath,
                  mediaDuration: media.duration,
                  mediaName: media.name,
                  thumbnailPath: media.thumbnailPath,
                  title: media.name
                }]);
              }
            }).catch((err: any) => {
              console.error('[ControlPanel] Error adding media from remote:', err);
            });
          }
          break;
        case 'library:selectMedia':
          if (command.payload?.mediaId) {
            window.electronAPI.getMediaLibraryItem(command.payload.mediaId).then((media: any) => {
              if (media) {
                // Display the media directly - convert to media:// protocol
                const filePath = media.processedPath || media.originalPath;
                const encodedPath = filePath
                  .replace(/\\/g, '/')
                  .split('/')
                  .map((segment: string) => encodeURIComponent(segment))
                  .join('/');
                const mediaUrl = `media://file/${encodedPath}`;

                setSelectedSong(null);
                setSelectedPresentation(null);
                setActiveMedia({ type: media.type as 'image' | 'video', url: mediaUrl });
                setIsBlank(false);
                window.electronAPI.displayMedia({ type: media.type, url: mediaUrl });
              }
            }).catch((err: any) => {
              console.error('[ControlPanel] Error selecting media from remote:', err);
            });
          }
          break;
        case 'media:stop':
          // Stop displaying media and clear the active media state
          setActiveMedia(null);
          setIsBlank(true);
          setLiveState({ slideData: null, contentType: null, songId: null, slideIndex: 0 });
          window.electronAPI.sendBlank();
          break;
        case 'audio:play':
          if (audioRef.current && activeAudio) {
            audioRef.current.volume = audioTargetVolume;
            audioRef.current.play().catch(err => console.error('Failed to play audio:', err));
          }
          break;
        case 'audio:pause':
          if (audioRef.current) {
            audioRef.current.pause();
          }
          break;
        case 'audio:stop':
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }
          setActiveAudio(null);
          setActiveAudioSetlistId(null);
          setAudioStatus({ currentTime: 0, duration: 0, isPlaying: false });
          break;
        case 'audio:volume':
          if (command.payload?.volume !== undefined) {
            const newVolume = Math.max(0, Math.min(1, command.payload.volume));
            setAudioTargetVolume(newVolume);
            if (audioRef.current) {
              audioRef.current.volume = newVolume;
            }
          }
          break;
        case 'audio:seek':
          if (command.payload?.time !== undefined && audioRef.current) {
            audioRef.current.currentTime = command.payload.time;
          }
          break;
        case 'video:play':
          setVideoStatus(prev => ({ ...prev, isPlaying: true }));
          window.electronAPI.resumeVideo();
          if (previewVideoRef.current) {
            previewVideoRef.current.play().catch(() => {});
          }
          break;
        case 'video:pause':
          setVideoStatus(prev => ({ ...prev, isPlaying: false }));
          window.electronAPI.pauseVideo();
          if (previewVideoRef.current) {
            previewVideoRef.current.pause();
          }
          break;
        case 'video:stop':
          window.electronAPI.stopVideo();
          setActiveMedia(null);
          setVideoStatus({ currentTime: 0, duration: 0, isPlaying: false });
          setIsBlank(true);
          setLiveState({ slideData: null, contentType: null, songId: null, slideIndex: 0 });
          window.electronAPI.sendBlank();
          break;
        case 'video:seek':
          if (command.payload?.time !== undefined) {
            window.electronAPI.seekVideo(command.payload.time);
            if (previewVideoRef.current) {
              previewVideoRef.current.currentTime = command.payload.time;
            }
          }
          break;
        case 'video:volume':
          if (command.payload?.volume !== undefined) {
            const vol = Math.max(0, Math.min(1, command.payload.volume));
            setVideoVolume(vol);
            window.electronAPI.setVideoVolume(vol);
            // Also set preview video volume if exists
            if (previewVideoRef.current) {
              previewVideoRef.current.volume = vol;
            }
          }
          break;
        // YouTube controls
        case 'youtube:play':
          if (youtubeOnDisplay) {
            setYoutubePlaying(true);
            window.electronAPI.youtubePlay(youtubeCurrentTime);
          }
          break;
        case 'youtube:pause':
          if (youtubeOnDisplay) {
            setYoutubePlaying(false);
            window.electronAPI.youtubePause(youtubeCurrentTime);
          }
          break;
        case 'youtube:stop':
          if (youtubeOnDisplay) {
            setYoutubePlaying(false);
            setYoutubeOnDisplay(false);
            setActiveYoutubeVideo(null);
            setYoutubeCurrentTime(0);
            setYoutubeDuration(0);
            window.electronAPI.youtubeStop();
          }
          break;
        case 'youtube:seek':
          if (youtubeOnDisplay && command.payload?.time !== undefined) {
            const seekTime = command.payload.time;
            setYoutubeCurrentTime(seekTime);
            window.electronAPI.youtubeSync(seekTime, youtubePlaying);
          }
          break;
        default:
          console.log('[ControlPanel] Unknown remote command:', command.type);
      }
    });

    return unsubscribe;
  }, [nextSlide, prevSlide, goToSlide, toggleBlank, setlist, songs, selectedSong, selectedPresentation, currentSlideIndex, currentPresentationSlideIndex, displayMode, currentContentType, sendCurrentSlide, sendPrayerPresentationSlide, selectCombinedSlide, combinedSlidesData, handlePlayAudio, activeAudio, audioTargetVolume, activeMedia, youtubeOnDisplay, youtubeCurrentTime, youtubePlaying, activeYoutubeVideo]);

  // Memoized addToSetlist to prevent unnecessary re-renders
  const addToSetlist = useCallback((song: Song) => {
    setSetlist(prev => [...prev, { id: crypto.randomUUID(), type: 'song', song }]);
  }, []);

  // Add Bible passage to setlist
  const addBibleToSetlist = useCallback((passage: Song) => {
    setSetlist(prev => [...prev, { id: crypto.randomUUID(), type: 'bible', song: passage, title: passage.title }]);
  }, []);

  // Add presentation to setlist
  const addPresentationToSetlist = useCallback((presentation: Presentation) => {
    setSetlist(prev => [...prev, { id: crypto.randomUUID(), type: 'presentation', presentation }]);
  }, []);

  // Presentation item callbacks for memoized PresentationItem component
  // Just loads the presentation into preview - doesn't send to display until user clicks a slide
  const handlePresentationSelect = useCallback((pres: any) => {
    setSelectedSong(null);
    setSelectedPresentation(pres);
    setCurrentPresentationSlideIndex(0);
    // Set the content type but don't send to display yet
    if (pres.quickModeData?.type === 'prayer' || pres.quickModeData?.type === 'sermon') {
      setCurrentContentType('prayer');
    } else {
      setCurrentContentType('presentation');
    }
  }, []);

  const handlePresentationEdit = useCallback((pres: any) => {
    if (pres.quickModeData?.type === 'prayer' || pres.quickModeData?.type === 'sermon') {
      startEditingPrayerPresentation(pres);
    } else {
      navigate(`/presentation-editor?id=${pres.id}`);
    }
  }, [navigate, startEditingPrayerPresentation]);

  const handlePresentationDelete = useCallback(async (pres: any) => {
    if (confirm(`Delete "${pres.title}"?`)) {
      await window.electronAPI.deletePresentation(pres.id);
      loadPresentations();
    }
  }, [loadPresentations]);

  const handlePresentationDragStart = useCallback((e: React.DragEvent, pres: any) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'presentation',
      presentation: pres
    }));
  }, []);

  const addSectionHeader = () => {
    setShowSectionModal(true);
  };

  const confirmAddSection = () => {
    const title = sectionTitleRef.current?.value?.trim();
    if (title) {
      setSetlist([...setlist, { id: crypto.randomUUID(), type: 'section', title }]);
    }
    setShowSectionModal(false);
  };

  const removeFromSetlist = (itemId: string) => {
    // Check if removing a currently playing audio item
    const itemToRemove = setlist.find(item => item.id === itemId);
    if (itemToRemove?.type === 'media' && itemToRemove.mediaType === 'audio' && itemToRemove.mediaPath && activeAudio) {
      const encodedPath = itemToRemove.mediaPath
        .replace(/\\/g, '/')
        .split('/')
        .map(segment => encodeURIComponent(segment))
        .join('/');
      const itemAudioUrl = `media://file/${encodedPath}`;
      if (activeAudio.url === itemAudioUrl) {
        // Stop the audio player
        setActiveAudio(null);
        setActiveAudioSetlistId(null); // Clear setlist tracking
        setAudioStatus({ currentTime: 0, duration: 0, isPlaying: false });
      }
    }
    setSetlist(setlist.filter((item) => item.id !== itemId));
  };

  const moveSetlistItem = (fromIndex: number, toIndex: number) => {
    const newSetlist = [...setlist];
    const [removed] = newSetlist.splice(fromIndex, 1);
    newSetlist.splice(toIndex, 0, removed);
    setSetlist(newSetlist);
  };

  const connectOnline = async () => {
    const connected = await window.electronAPI.connectOnline('https://solucast.app', '');
    if (connected) {
      const result = await window.electronAPI.createOnlineRoom();
      if (result) {
        setRoomPin(result.roomPin);
      }
    }
  };

  const importSongsFromServer = async () => {
    // Clear any existing timeout
    if (importStatusTimeoutRef.current) {
      clearTimeout(importStatusTimeoutRef.current);
      importStatusTimeoutRef.current = null;
    }
    setIsImporting(true);
    setImportStatus('Connecting to server...');
    try {
      const result = await window.electronAPI.importSongs('https://solupresenter-backend-4rn5.onrender.com');
      setImportStatus(`Imported ${result.imported}, Updated ${result.updated}${result.errors > 0 ? `, Errors: ${result.errors}` : ''}`);
      await loadSongs();
      importStatusTimeoutRef.current = setTimeout(() => setImportStatus(null), 5000);
    } catch (err: any) {
      setImportStatus(`Error: ${err.message || 'Failed to import'}`);
      importStatusTimeoutRef.current = setTimeout(() => setImportStatus(null), 5000);
    }
    setIsImporting(false);
  };

  // Setlist save/load functions - updateSavedSnapshot is now from SetlistContext

  const saveSetlist = async () => {
    const name = setlistNameRef.current?.value?.trim();
    const venue = setlistVenueRef.current?.value?.trim();
    if (!name) return;

    try {
      let savedSetlist: SavedSetlist | null;

      if (currentSetlistId) {
        // Update existing setlist
        savedSetlist = await window.electronAPI.updateSetlist(currentSetlistId, {
          name,
          venue: venue || undefined,
          items: setlist
        });
      } else {
        // Create new setlist
        savedSetlist = await window.electronAPI.createSetlist({
          name,
          venue: venue || undefined,
          items: setlist
        });
      }

      if (savedSetlist) {
        setCurrentSetlistId(savedSetlist.id);
        setCurrentSetlistName(name);
        // Reload all setlists to get updated list
        await loadSavedSetlists();
      }

      updateSavedSnapshot(setlist);
      setShowSaveModal(false);

      // If there was a pending action (load/clear), proceed with it now that we've saved
      if (pendingAction) {
        if (pendingAction.type === 'load' && pendingAction.setlist) {
          loadSetlistDirect(pendingAction.setlist);
        } else if (pendingAction.type === 'clear') {
          clearSetlistDirect();
        }
      }
      setShowUnsavedWarning(false);
      setPendingAction(null);
    } catch (error) {
      console.error('Failed to save setlist:', error);
    }
  };

  const tryLoadSetlist = (saved: SavedSetlist) => {
    if (hasUnsavedChanges && setlist.length > 0) {
      setPendingAction({ type: 'load', setlist: saved });
      setShowUnsavedWarning(true);
    } else {
      loadSetlistDirect(saved);
    }
  };

  const loadSetlistDirect = (saved: SavedSetlist) => {
    setSetlist(saved.items);
    setCurrentSetlistName(saved.name);
    setCurrentSetlistId(saved.id);
    updateSavedSnapshot(saved.items);
    setShowLoadModal(false);
    setShowUnsavedWarning(false);
    setPendingAction(null);
  };

  const deleteSetlistById = async (id: string) => {
    try {
      await window.electronAPI.deleteSetlist(id);
      // Reload all setlists to get updated list
      await loadSavedSetlists();
      // Clear current if we deleted the active one
      if (currentSetlistId === id) {
        clearSetlistDirect();
      }
    } catch (error) {
      console.error('Failed to delete setlist:', error);
    }
  };

  const tryClearSetlist = () => {
    if (hasUnsavedChanges && setlist.length > 0) {
      setPendingAction({ type: 'clear' });
      setShowUnsavedWarning(true);
    } else {
      clearSetlistDirect();
    }
  };

  const clearSetlistDirect = () => {
    clearSetlistFromContext();
    setShowUnsavedWarning(false);
    setPendingAction(null);
  };

  const confirmUnsavedAction = () => {
    if (!pendingAction) return;
    if (pendingAction.type === 'load' && pendingAction.setlist) {
      loadSetlistDirect(pendingAction.setlist);
    } else if (pendingAction.type === 'clear') {
      clearSetlistDirect();
    }
  };

  const cancelUnsavedAction = () => {
    setShowUnsavedWarning(false);
    setPendingAction(null);
  };

  // Countdown functions
  const startCountdownFromTime = () => {
    if (!countdownTargetTime) return;

    const [hours, minutes] = countdownTargetTime.split(':').map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);

    // If target time is in the past, assume it's for tomorrow
    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }

    setIsCountdownActive(true);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    const updateCountdown = () => {
      const diff = target.getTime() - Date.now();
      if (diff <= 0) {
        setCountdownRemaining('00:00');
        setIsCountdownActive(false);
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        window.electronAPI.sendTool({ type: 'countdown', active: false, remaining: '00:00', message: countdownMessageRef.current, messageTranslation: countdownMessageTranslationRef.current });
        return;
      }
      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      const remaining = hrs > 0
        ? `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        : `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      setCountdownRemaining(remaining);
      window.electronAPI.sendTool({ type: 'countdown', active: true, remaining, message: countdownMessageRef.current, messageTranslation: countdownMessageTranslationRef.current });
    };

    updateCountdown();
    countdownIntervalRef.current = setInterval(updateCountdown, 1000);
  };

  const stopCountdown = () => {
    setIsCountdownActive(false);
    setCountdownRemaining('');
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    window.electronAPI.sendTool({ type: 'countdown', active: false, remaining: '', message: '' });
    // Clear activeToolId if a countdown was active from setlist
    setActiveToolId(prev => {
      const activeItem = setlist.find(item => item.id === prev);
      if (activeItem?.type === 'countdown') return null;
      return prev;
    });
  };

  const showAnnouncement = () => {
    if (!announcementText.trim()) return;
    stopAllTools();
    setIsAnnouncementActive(true);
    window.electronAPI.sendTool({ type: 'announcement', active: true, text: announcementText });
  };

  const hideAnnouncement = () => {
    setIsAnnouncementActive(false);
    window.electronAPI.sendTool({ type: 'announcement', active: false, text: '' });
    // Clear activeToolId if an announcement was active from setlist
    setActiveToolId(prev => {
      const activeItem = setlist.find(item => item.id === prev);
      if (activeItem?.type === 'announcement') return null;
      return prev;
    });
  };

  // Rotating messages functions
  const toggleMessageEnabled = (id: string) => {
    setRotatingMessages(prev =>
      prev.map(msg => msg.id === id ? { ...msg, enabled: !msg.enabled } : msg)
    );
  };

  const addCustomMessage = () => {
    if (!customMessageInput.trim()) return;
    const newMessage = {
      id: crypto.randomUUID(),
      text: customMessageInput.trim(),
      textHe: customMessageInput.trim(),
      enabled: true,
      isPreset: false
    };
    setRotatingMessages(prev => [...prev, newMessage]);
    setCustomMessageInput('');
  };

  const removeCustomMessage = (id: string) => {
    setRotatingMessages(prev => prev.filter(msg => msg.id !== id));
  };

  const broadcastRotatingMessages = () => {
    const enabledMessages = rotatingMessages.filter(m => m.enabled).map(m => m.text);
    if (enabledMessages.length === 0) return;
    stopAllTools();
    setIsRotatingMessagesActive(true); // Track that rotating messages are now active
    window.electronAPI.sendTool({
      type: 'rotatingMessages',
      active: true,
      messages: enabledMessages,
      interval: rotatingInterval
    });
  };

  const stopRotatingMessages = () => {
    setIsRotatingMessagesActive(false);
    window.electronAPI.sendTool({ type: 'rotatingMessages', active: false, messages: [], interval: 5 });
    // Clear activeToolId if messages were active from setlist
    setActiveToolId(prev => {
      const activeItem = setlist.find(item => item.id === prev);
      if (activeItem?.type === 'messages') return null;
      return prev;
    });
  };

  // Add tools to setlist
  const addCountdownToSetlist = () => {
    if (!countdownTargetTime) return;
    const newItem: SetlistItem = {
      id: `countdown-${Date.now()}`,
      type: 'countdown',
      title: `⏱ ${countdownTargetTime}${countdownMessage ? ` - ${countdownMessage}` : ''}`,
      countdownTime: countdownTargetTime,
      countdownMessage: countdownMessage
    };
    setSetlist(prev => [...prev, newItem]);
  };

  const addAnnouncementToSetlist = () => {
    if (!announcementText.trim()) return;
    const newItem: SetlistItem = {
      id: `announcement-${Date.now()}`,
      type: 'announcement',
      title: `📢 ${announcementText.substring(0, 30)}${announcementText.length > 30 ? '...' : ''}`,
      announcementText: announcementText
    };
    setSetlist(prev => [...prev, newItem]);
  };

  const addMessagesToSetlist = () => {
    const enabledMessages = rotatingMessages.filter(m => m.enabled).map(m => m.text);
    if (enabledMessages.length === 0) return;
    const newItem: SetlistItem = {
      id: `messages-${Date.now()}`,
      type: 'messages',
      title: `💬 ${enabledMessages.length} rotating messages`,
      messages: enabledMessages,
      messagesInterval: rotatingInterval
    };
    setSetlist(prev => [...prev, newItem]);
  };

  // Stop all active tools
  const stopAllTools = () => {
    if (isCountdownActive) {
      stopCountdown();
    }
    if (isAnnouncementActive) {
      hideAnnouncement();
    }
    if (isRotatingMessagesActive) {
      stopRotatingMessages();
    }
    if (isClockActive) {
      stopClock();
    }
    if (isStopwatchActive) {
      stopStopwatchBroadcast();
    }
    setActiveToolId(null);
  };

  // Broadcast tool from setlist item (toggle on/off)
  const broadcastToolFromSetlist = (item: SetlistItem) => {
    // If this tool is already active, stop it
    if (activeToolId === item.id) {
      stopAllTools();
      return;
    }

    // Stop any other active tools first
    stopAllTools();

    if (item.type === 'countdown' && item.countdownTime) {
      // Set the countdown time and start it
      setCountdownTargetTime(item.countdownTime);
      setCountdownMessage(item.countdownMessage || '');
      setActiveToolId(item.id);

      // Start countdown
      const [hours, minutes] = item.countdownTime.split(':').map(Number);
      const now = new Date();
      const target = new Date();
      target.setHours(hours, minutes, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);

      setIsCountdownActive(true);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

      const updateCountdown = () => {
        const diff = target.getTime() - Date.now();
        if (diff <= 0) {
          setCountdownRemaining('00:00');
          setIsCountdownActive(false);
          setActiveToolId(null);
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          window.electronAPI.sendTool({ type: 'countdown', active: false, remaining: '00:00', message: countdownMessageRef.current, messageTranslation: countdownMessageTranslationRef.current });
          return;
        }
        const hrs = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        const remaining = hrs > 0
          ? `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
          : `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        setCountdownRemaining(remaining);
        window.electronAPI.sendTool({ type: 'countdown', active: true, remaining, message: countdownMessageRef.current, messageTranslation: countdownMessageTranslationRef.current });
      };
      updateCountdown();
      countdownIntervalRef.current = setInterval(updateCountdown, 1000);
    } else if (item.type === 'announcement' && item.announcementText) {
      setAnnouncementText(item.announcementText);
      setIsAnnouncementActive(true);
      setActiveToolId(item.id);
      window.electronAPI.sendTool({ type: 'announcement', active: true, text: item.announcementText });
    } else if (item.type === 'messages' && item.messages) {
      setIsRotatingMessagesActive(true);
      setActiveToolId(item.id);
      window.electronAPI.sendTool({
        type: 'rotatingMessages',
        active: true,
        messages: item.messages,
        interval: item.messagesInterval || 5
      });
    }
  };

  // Quick Slide functions
  const isHebrewText = (text: string) => /[\u0590-\u05FF]/.test(text);

  const getCurrentQuickSlideText = () => {
    return quickSlideTextareaRef.current?.value || '';
  };

  const updateQuickSlideCount = (text: string) => {
    if (!text.trim()) {
      setQuickSlideCount(0);
    } else {
      const blocks = text.split(/\n\s*\n/).filter(block => block.trim());
      setQuickSlideCount(blocks.length);
    }
  };

  const autoGenerateQuickSlide = async () => {
    const currentText = getCurrentQuickSlideText();
    if (!currentText.trim()) return;

    setIsAutoGenerating(true);
    try {
      const blocks = currentText.split(/\n\s*\n/);
      const processedBlocks = await Promise.all(
        blocks.map(async (block) => {
          const lines = block.split('\n').map(l => l.trim());
          if (lines.length === 0 || !lines[0]) return block;

          // If first line is Hebrew and we don't have all 3 lines
          if (isHebrewText(lines[0]) && lines.length < 3) {
            const result = await window.electronAPI.processQuickSlide(lines[0]);
            return `${result.original}\n${result.transliteration}\n${result.translation}`;
          }
          return block;
        })
      );

      const newText = processedBlocks.join('\n\n');
      if (quickSlideTextareaRef.current) {
        quickSlideTextareaRef.current.value = newText;
      }
      setQuickSlideText(newText);
      updateQuickSlideCount(newText);
    } catch (error) {
      console.error('Error auto-generating:', error);
    }
    setIsAutoGenerating(false);
  };

  const parseAndBroadcastQuickSlide = (slideIndex: number) => {
    const currentText = getCurrentQuickSlideText();
    if (!currentText.trim()) return;

    const blocks = currentText.split(/\n\s*\n/).filter(block => block.trim());
    if (slideIndex >= blocks.length) return;

    const block = blocks[slideIndex];
    const lines = block.split('\n').map(l => l.trim());

    // Create a temporary song with this slide
    const quickSong: Song = {
      id: 'quick-slide',
      title: 'Quick Slide',
      slides: blocks.map((b, idx) => {
        const slideLines = b.split('\n').map(l => l.trim());
        return {
          originalText: slideLines[0] || '',
          transliteration: slideLines[1] || '',
          translation: slideLines[2] || '',
          verseType: `Slide ${idx + 1}`
        };
      })
    };

    // Set as current and broadcast
    setSelectedSong(quickSong);
    setCurrentSlideIndex(slideIndex);
    setIsBlank(false);
    setQuickSlideBroadcastIndex(slideIndex);
    setCurrentContentType('song'); // Quick slide is always song type
    sendCurrentSlide(quickSong, slideIndex, displayMode, undefined, 'song');
  };

  // Bible functions
  const fetchBibleBooks = async () => {
    try {
      const books = await window.electronAPI.getBibleBooks();
      setBibleBooks((books || []) as BibleBook[]);
    } catch (error) {
      console.error('Error fetching Bible books:', error);
    }
  };

  const fetchBibleVerses = async (book: string, chapter: number) => {
    if (!book || !chapter) return;

    setBibleLoading(true);
    try {
      const response = await window.electronAPI.getBibleVerses(book, chapter);
      const bookData = bibleBooks.find(b => b.name === book);

      // Create a Bible passage that acts like a song
      const passage: Song = {
        id: `bible-${book}-${chapter}`,
        title: `${bookData?.hebrewName || book} ${chapter}`,
        slides: response.slides.map((slide, idx) => ({
          originalText: slide.originalText,
          transliteration: '',
          translation: slide.translation,
          verseType: `${idx + 1}`,
          // Keep reference fields for Bible theme display
          reference: slide.reference, // English reference (e.g., "Genesis 1:1")
          hebrewReference: slide.hebrewReference // Hebrew reference (e.g., "בראשית א:א")
        }))
      };

      setBibleSlides(response.slides);
      setBiblePassage(passage);

      // Auto-select this passage with bible content type
      setSelectedSong(passage);
      setCurrentSlideIndex(0);
      setIsBlank(false);
      setCurrentContentType('bible');
    } catch (error) {
      console.error('Error fetching Bible verses:', error);
    } finally {
      setBibleLoading(false);
    }
  };

  // Load Bible books when switching to Bible panel
  const handleResourcePanelChange = useCallback((panel: ResourcePanel) => {
    // Direct state update for instant tab switch
    setActiveResourcePanel(panel);
  }, []);

  // Side effects after tab change - runs after render, doesn't block tab switch
  useEffect(() => {
    if (activeResourcePanel === 'bible' && bibleBooks.length === 0) {
      fetchBibleBooks();
    }
    if (activeResourcePanel === 'media' && !isCountdownActive) {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 10);
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setCountdownTargetTime(`${hours}:${minutes}`);
    }
  }, [activeResourcePanel, bibleBooks.length, isCountdownActive]);

  // Fetch verses when book and chapter are selected
  useEffect(() => {
    if (selectedBibleBook && selectedBibleChapter !== '') {
      fetchBibleVerses(selectedBibleBook, selectedBibleChapter as number);
    }
  }, [selectedBibleBook, selectedBibleChapter]);

  // Get chapter options for selected book
  const getChapterOptions = () => {
    const book = bibleBooks.find(b => b.name === selectedBibleBook);
    if (!book) return [];
    return Array.from({ length: book.chapters }, (_, i) => i + 1);
  };

  // Group books by testament
  const oldTestamentBooks = bibleBooks.filter(b => b.testament === 'old');
  const newTestamentBooks = bibleBooks.filter(b => b.testament === 'new');

  // Hebrew to English book name mapping
  const hebrewBookNames: Record<string, string> = {
    'בראשית': 'Genesis', 'שמות': 'Exodus', 'ויקרא': 'Leviticus',
    'במדבר': 'Numbers', 'דברים': 'Deuteronomy', 'יהושע': 'Joshua',
    'שופטים': 'Judges', 'שמואל א': 'I Samuel', 'שמואל ב': 'II Samuel',
    'מלכים א': 'I Kings', 'מלכים ב': 'II Kings', 'ישעיהו': 'Isaiah',
    'ישעיה': 'Isaiah', 'ירמיהו': 'Jeremiah', 'ירמיה': 'Jeremiah',
    'יחזקאל': 'Ezekiel', 'הושע': 'Hosea', 'יואל': 'Joel', 'עמוס': 'Amos',
    'עובדיה': 'Obadiah', 'יונה': 'Jonah', 'מיכה': 'Micah', 'נחום': 'Nahum',
    'חבקוק': 'Habakkuk', 'צפניה': 'Zephaniah', 'חגי': 'Haggai',
    'זכריה': 'Zechariah', 'מלאכי': 'Malachi', 'תהילים': 'Psalms',
    'תהלים': 'Psalms', 'משלי': 'Proverbs', 'איוב': 'Job',
    'שיר השירים': 'Song of Songs', 'רות': 'Ruth', 'איכה': 'Lamentations',
    'קהלת': 'Ecclesiastes', 'אסתר': 'Esther', 'דניאל': 'Daniel',
    'עזרא': 'Ezra', 'נחמיה': 'Nehemiah', 'דברי הימים א': 'I Chronicles',
    'דברי הימים ב': 'II Chronicles',
    // New Testament
    'מתי': 'Matthew', 'מרקוס': 'Mark', 'לוקס': 'Luke', 'יוחנן': 'John',
    'מעשי השליחים': 'Acts', 'מעשים': 'Acts', 'רומים': 'Romans',
    'קורינתים א': '1 Corinthians', 'קורינתים ב': '2 Corinthians',
    'גלטים': 'Galatians', 'אפסים': 'Ephesians', 'פיליפים': 'Philippians',
    'קולוסים': 'Colossians', 'תסלוניקים א': '1 Thessalonians',
    'תסלוניקים ב': '2 Thessalonians', 'טימותיאוס א': '1 Timothy',
    'טימותיאוס ב': '2 Timothy', 'טיטוס': 'Titus', 'פילימון': 'Philemon',
    'עברים': 'Hebrews', 'יעקב': 'James', 'פטרוס א': '1 Peter',
    'פטרוס ב': '2 Peter', 'יוחנן א': '1 John', 'יוחנן ב': '2 John',
    'יוחנן ג': '3 John', 'יהודה': 'Jude', 'התגלות': 'Revelation', 'חזון': 'Revelation'
  };

  // Convert Hebrew numerals to Arabic numbers
  const hebrewToNumber = (hebrewStr: string): number | null => {
    const cleaned = hebrewStr.replace(/[""״׳']/g, '');
    const hebrewValues: Record<string, number> = {
      'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9,
      'י': 10, 'כ': 20, 'ך': 20, 'ל': 30, 'מ': 40, 'ם': 40, 'נ': 50, 'ן': 50,
      'ס': 60, 'ע': 70, 'פ': 80, 'ף': 80, 'צ': 90, 'ץ': 90,
      'ק': 100, 'ר': 200, 'ש': 300, 'ת': 400
    };
    let total = 0;
    for (const char of cleaned) {
      if (hebrewValues[char]) {
        total += hebrewValues[char];
      }
    }
    return total > 0 ? total : null;
  };

  // Convert Arabic numbers to Hebrew numerals
  const numberToHebrew = (num: number): string => {
    if (num <= 0 || num > 999) return num.toString();

    const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
    const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
    const hundreds = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];

    let result = '';

    // Handle hundreds
    if (num >= 100) {
      result += hundreds[Math.floor(num / 100)];
      num %= 100;
    }

    // Special cases for 15 and 16 (avoid spelling God's name)
    if (num === 15) return result + 'טו';
    if (num === 16) return result + 'טז';

    // Handle tens
    if (num >= 10) {
      result += tens[Math.floor(num / 10)];
      num %= 10;
    }

    // Handle ones
    result += ones[num];

    return result;
  };

  // Get Hebrew book name from English
  const getHebrewBookName = (englishName: string): string => {
    // Find Hebrew name for this English book
    for (const [hebrew, english] of Object.entries(hebrewBookNames)) {
      if (english.toLowerCase() === englishName.toLowerCase()) {
        return hebrew;
      }
    }
    return englishName; // Fallback to English if not found
  };

  // Handle Bible search
  const handleBibleSearch = (query: string) => {
    setBibleSearchQuery(query);
    const trimmed = query.trim();

    if (trimmed === '') {
      return;
    }

    // Try to match pattern: "BookName Chapter" (Arabic or Hebrew numerals)
    const matchArabic = trimmed.match(/^(.+?)\s+(\d+)$/);
    const matchHebrew = trimmed.match(/^(.+?)\s+([א-ת""״׳']+)$/);

    let bookName: string | null = null;
    let chapterNum: number | null = null;

    if (matchArabic) {
      bookName = matchArabic[1].trim().toLowerCase();
      chapterNum = parseInt(matchArabic[2]);
    } else if (matchHebrew) {
      bookName = matchHebrew[1].trim().toLowerCase();
      const hebrewNum = hebrewToNumber(matchHebrew[2]);
      if (hebrewNum) {
        chapterNum = hebrewNum;
      }
    }

    if (bookName && chapterNum) {
      // Check if bookName is Hebrew and convert to English
      let searchName = bookName;
      const hebrewMatch = Object.keys(hebrewBookNames).find(heb =>
        heb === bookName || heb.startsWith(bookName!) || bookName!.startsWith(heb)
      );
      if (hebrewMatch) {
        searchName = hebrewBookNames[hebrewMatch].toLowerCase();
      }

      // Find matching book with fuzzy matching
      let matchedBook = bibleBooks.find(b => b.name.toLowerCase() === searchName);

      if (!matchedBook) {
        // Try prefix match (e.g., "gen" matches "Genesis")
        matchedBook = bibleBooks.find(b => b.name.toLowerCase().startsWith(searchName));
      }

      if (!matchedBook) {
        // Try contains match (e.g., "corin" matches "1 Corinthians")
        matchedBook = bibleBooks.find(b => b.name.toLowerCase().includes(searchName));
      }

      if (matchedBook && chapterNum >= 1 && chapterNum <= matchedBook.chapters) {
        setSelectedBibleBook(matchedBook.name);
        setSelectedBibleChapter(chapterNum);
      }
    }
  };

  // Quick Mode Bible search handler
  const handleQuickModeBibleSearch = async (query: string) => {
    setQuickModeBibleSearch(query);
    quickModeBibleSearchRef.current = query; // Track latest search
    const trimmed = query.trim();

    if (trimmed === '') {
      setQuickModeBibleVerses([]);
      setQuickModeBibleBook('');
      setQuickModeBibleChapter(null);
      setQuickModeVerseStart(null);
      setQuickModeVerseEnd(null);
      setQuickModeBibleNoMatch(false);
      setQuickModeBibleLoading(false);
      setQuickModeBibleIsHebrew(false);
      return;
    }

    // Helper to parse verse specification (e.g., "1-3", "1,2,3", "1-3, 5")
    const parseVerses = (verseStr: string): { start: number | null; end: number | null } => {
      if (!verseStr) return { start: null, end: null };

      // Remove spaces and split by comma
      const parts = verseStr.replace(/\s/g, '').split(',').filter(Boolean);
      const allVerses: number[] = [];

      for (const part of parts) {
        if (part.includes('-')) {
          // Range like "1-3"
          const [startStr, endStr] = part.split('-');
          const start = parseInt(startStr);
          const end = parseInt(endStr);
          if (!isNaN(start)) allVerses.push(start);
          if (!isNaN(end)) allVerses.push(end);
        } else {
          const num = parseInt(part);
          if (!isNaN(num)) allVerses.push(num);
        }
      }

      if (allVerses.length === 0) return { start: null, end: null };
      if (allVerses.length === 1) return { start: allVerses[0], end: null };
      return { start: Math.min(...allVerses), end: Math.max(...allVerses) };
    };

    // Detect if book name contains Hebrew characters
    const hasHebrewChars = (str: string) => /[\u0590-\u05FF]/.test(str);

    let bookNameRaw: string;
    let chapterNum: number;
    let verseStartFromQuery: number | null = null;
    let verseEndFromQuery: number | null = null;
    let isHebrewSearch = false;

    // Pattern 1: English - "Book Chapter" or "Book Chapter:Verse" or "Book Chapter:Start-End"
    const matchArabic = trimmed.match(/^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/);

    // Pattern 2: Hebrew book + Hebrew chapter + optional verses
    // Matches: יוחנן יג, יוחנן י"ג, יוחנן יג 1-3, יוחנן י"ג:1-3, יוחנן יג:1,2,3
    const matchHebrewFull = trimmed.match(/^(.+?)\s+([א-ת]+["״׳']?)(?:[\s:](.+))?$/);

    if (matchArabic && !hasHebrewChars(matchArabic[1])) {
      // English book with Arabic numerals
      bookNameRaw = matchArabic[1].trim().toLowerCase();
      chapterNum = parseInt(matchArabic[2]);
      verseStartFromQuery = matchArabic[3] ? parseInt(matchArabic[3]) : null;
      verseEndFromQuery = matchArabic[4] ? parseInt(matchArabic[4]) : null;
      isHebrewSearch = false;
    } else if (matchHebrewFull) {
      // Hebrew book with Hebrew chapter
      bookNameRaw = matchHebrewFull[1].trim();
      const hebrewChapter = matchHebrewFull[2].replace(/["״׳']/g, ''); // Remove geresh/quotes
      const hebrewNum = hebrewToNumber(hebrewChapter);

      if (!hebrewNum) {
        setQuickModeBibleNoMatch(trimmed.length > 2);
        setQuickModeBibleLoading(false);
        return;
      }
      chapterNum = hebrewNum;

      // Parse verses if present (e.g., "1-3" or "1,2,3")
      if (matchHebrewFull[3]) {
        const parsed = parseVerses(matchHebrewFull[3]);
        verseStartFromQuery = parsed.start;
        verseEndFromQuery = parsed.end;
      }

      isHebrewSearch = true;
    } else {
      // Show no match if pattern is entered but invalid
      setQuickModeBibleNoMatch(trimmed.length > 2);
      setQuickModeBibleLoading(false);
      return;
    }

    // Check if bookName is Hebrew and convert to English for API lookup
    let searchName = bookNameRaw.toLowerCase();
    const hebrewBookMatch = Object.keys(hebrewBookNames).find(heb =>
      heb === bookNameRaw || heb.startsWith(bookNameRaw) || bookNameRaw.startsWith(heb)
    );
    if (hebrewBookMatch) {
      searchName = hebrewBookNames[hebrewBookMatch].toLowerCase();
      isHebrewSearch = true; // Also set Hebrew if book name was Hebrew
    }

    // Update Hebrew state for later use
    setQuickModeBibleIsHebrew(isHebrewSearch);

    // Find matching book (use cached bibleBooks or wait for them to load)
    let matchedBook = bibleBooks.find(b => b.name.toLowerCase() === searchName);
    if (!matchedBook) {
      matchedBook = bibleBooks.find(b => b.name.toLowerCase().startsWith(searchName));
    }
    if (!matchedBook) {
      matchedBook = bibleBooks.find(b => b.name.toLowerCase().includes(searchName));
    }

    if (matchedBook && chapterNum >= 1 && chapterNum <= matchedBook.chapters) {
      setQuickModeBibleNoMatch(false);
      setQuickModeBibleBook(matchedBook.name);
      setQuickModeBibleChapter(chapterNum);

      // Clear previous verse data before fetching new chapter
      // This prevents using old verse text with new reference
      setQuickModeBibleVerses([]);
      setQuickModeVerseStart(null);
      setQuickModeVerseEnd(null);

      // Fetch verses for this chapter
      setQuickModeBibleLoading(true);
      try {
        const response = await window.electronAPI.getBibleVerses(matchedBook.name, chapterNum);
        const verses = response?.verses || [];

        // Guard against race condition: only update if this is still the current search
        if (quickModeBibleSearchRef.current !== query) {
          return; // Search changed while we were loading, discard results
        }

        setQuickModeBibleVerses(verses);

        // Validate and set verse numbers from query
        if (verseStartFromQuery && verses.some(v => v.verseNumber === verseStartFromQuery)) {
          setQuickModeVerseStart(verseStartFromQuery);
          // Only set end if it's valid and greater than start
          if (verseEndFromQuery && verseEndFromQuery > verseStartFromQuery &&
              verses.some(v => v.verseNumber === verseEndFromQuery)) {
            setQuickModeVerseEnd(verseEndFromQuery);
          } else {
            setQuickModeVerseEnd(null);
          }
        } else {
          setQuickModeVerseStart(null);
          setQuickModeVerseEnd(null);
        }
      } catch (error) {
        console.error('Error fetching Bible verses:', error);
        // Only update error state if this is still the current search
        if (quickModeBibleSearchRef.current === query) {
          setQuickModeBibleVerses([]);
          setQuickModeVerseStart(null);
          setQuickModeVerseEnd(null);
          setQuickModeBibleLoading(false);
        }
        return;
      }
      // Only update loading if this is still the current search
      if (quickModeBibleSearchRef.current === query) {
        setQuickModeBibleLoading(false);
      }
    } else {
      // No matching book found or invalid chapter
      setQuickModeBibleNoMatch(true);
      setQuickModeBibleBook('');
      setQuickModeBibleChapter(null);
      setQuickModeBibleVerses([]);
      setQuickModeBibleLoading(false); // Clear loading state for no match
    }
  };

  // Add Bible reference to a Quick Mode subtitle
  const addBibleRefToSubtitle = (index: number) => {
    if (!quickModeBibleBook || !quickModeBibleChapter || !quickModeVerseStart || quickModeBibleVerses.length === 0) return;

    const startVerse = quickModeBibleVerses.find(v => v.verseNumber === quickModeVerseStart);
    if (!startVerse) return;

    let hebrewText = '';
    let englishText = '';
    let reference = `${quickModeBibleBook} ${quickModeBibleChapter}:${quickModeVerseStart}`;
    let hebrewReference = '';

    // Extract base Hebrew reference (book + chapter) from the verse's hebrewReference
    // Format is like "יוחנן ג׳:16" - we need "יוחנן ג׳"
    const baseHebrewRef = startVerse.hebrewReference?.replace(/:.*$/, '') || '';

    if (quickModeVerseEnd && quickModeVerseEnd > quickModeVerseStart) {
      // Verse range
      const versesInRange = quickModeBibleVerses.filter(
        v => v.verseNumber >= quickModeVerseStart! && v.verseNumber <= quickModeVerseEnd!
      );
      hebrewText = versesInRange.map(v => v.hebrew || '').filter(Boolean).join(' ');
      englishText = versesInRange.map(v => v.english || '').filter(Boolean).join(' ');
      reference = `${quickModeBibleBook} ${quickModeBibleChapter}:${quickModeVerseStart}-${quickModeVerseEnd}`;
      hebrewReference = `${baseHebrewRef}:${quickModeVerseStart}-${quickModeVerseEnd}`;
    } else {
      // Single verse
      hebrewText = startVerse.hebrew || '';
      englishText = startVerse.english || '';
      hebrewReference = startVerse.hebrewReference || '';
    }

    setQuickModeSubtitles(prev => prev.map((s, i) =>
      i === index ? {
        ...s,
        bibleRef: {
          book: quickModeBibleBook,
          chapter: quickModeBibleChapter!,
          verseStart: quickModeVerseStart!,
          verseEnd: quickModeVerseEnd || undefined,
          hebrewText,
          englishText,
          reference,
          hebrewReference,
          useHebrew: quickModeBibleIsHebrew
        }
      } : s
    ));

    // Reset picker state
    setQuickModeBiblePickerIndex(null);
    setQuickModeBibleSearch('');
    quickModeBibleSearchRef.current = '';
    setQuickModeBibleVerses([]);
    setQuickModeBibleBook('');
    setQuickModeBibleChapter(null);
    setQuickModeVerseStart(null);
    setQuickModeBibleNoMatch(false);
    setQuickModeVerseEnd(null);
    setQuickModeBibleLoading(false);
    setQuickModeBibleIsHebrew(false);
  };

  // Remove Bible reference from a Quick Mode subtitle
  const removeBibleRefFromSubtitle = (index: number) => {
    setQuickModeSubtitles(prev => prev.map((s, i) =>
      i === index ? { ...s, bibleRef: undefined } : s
    ));
  };

  // Reset all Quick Mode wizard state
  const resetQuickModeWizard = (showAfterReset = false) => {
    setQuickModeStep(1);
    setQuickModeType(null);
    setQuickModeTitle('');
    setQuickModeSubtitles([{ subtitle: '', description: '' }]);
    setQuickModeBiblePickerIndex(null);
    setQuickModeBibleSearch('');
    quickModeBibleSearchRef.current = '';
    setQuickModeBibleVerses([]);
    setQuickModeBibleBook('');
    setQuickModeBibleChapter(null);
    setQuickModeVerseStart(null);
    setQuickModeVerseEnd(null);
    setQuickModeBibleNoMatch(false);
    setQuickModeBibleLoading(false);
    setQuickModeBibleIsHebrew(false);
    setQuickModeGenerateTranslation(false);
    setQuickModeTranslationLoading(false);
    setQuickModeCreating(false);
    setShowQuickModeWizard(showAfterReset);
    // Ensure window has focus when opening the wizard (Electron fix)
    if (showAfterReset) {
      window.focus();
    }
  };

  const filteredSongs = useMemo(() => {
    return songs
      .filter((song) => {
        const query = searchQuery.toLowerCase();
        if (!query) return true;

        // Check title
        if (song.title.toLowerCase().includes(query)) return true;

        // Check author
        if (song.author?.toLowerCase().includes(query)) return true;

        // Check slide content
        if (song.slides && Array.isArray(song.slides)) {
          return song.slides.some(slide =>
            (slide.originalText?.toLowerCase().includes(query)) ||
            (slide.transliteration?.toLowerCase().includes(query)) ||
            (slide.translation?.toLowerCase().includes(query))
          );
        }

        return false;
      })
      .sort((a, b) => a.title.localeCompare(b.title, 'he'));
  }, [songs, searchQuery]);

  const currentSlide = selectedSong?.slides[currentSlideIndex];

  // Memoize to avoid recalculating on every render
  const currentPresentationSlide = useMemo(() => {
    return selectedPresentation?.slides[currentPresentationSlideIndex] || null;
  }, [selectedPresentation?.slides, currentPresentationSlideIndex]);

  // Compute prayer slide data for live preview
  const currentPrayerSlideData = useMemo(() => {
    if (!selectedPresentation?.quickModeData) return null;
    const qmd = selectedPresentation.quickModeData;
    if (qmd.type !== 'prayer' && qmd.type !== 'sermon') return null;
    const subtitle = qmd.subtitles?.[currentPresentationSlideIndex];
    if (!subtitle) return null;
    return {
      title: qmd.title,
      titleTranslation: (qmd as any).titleTranslation,
      subtitle: subtitle.subtitle,
      subtitleTranslation: subtitle.subtitleTranslation,
      description: subtitle.description,
      descriptionTranslation: subtitle.descriptionTranslation,
      reference: subtitle.bibleRef?.hebrewReference || subtitle.bibleRef?.reference,
      referenceTranslation: subtitle.bibleRef?.reference
    };
  }, [selectedPresentation, currentPresentationSlideIndex]);

  // Memoize slideData for SlidePreview to prevent unnecessary re-renders
  const memoizedSlideData = useMemo(() => {
    if (currentContentType === 'prayer') {
      return currentPrayerSlideData;
    }
    if (!currentSlide) return null;
    if (currentContentType === 'bible') {
      // For Bible content: reference = Hebrew reference, referenceEnglish = English reference
      return {
        ...currentSlide,
        reference: (currentSlide as any).hebrewReference || selectedSong?.title,
        referenceEnglish: (currentSlide as any).reference
      };
    }
    return currentSlide;
  }, [currentContentType, currentPrayerSlideData, currentSlide, selectedSong?.title]);

  // Format clock time
  const formatClockTime = (date: Date, format: '12h' | '24h') => {
    if (format === '12h') {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    }
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  // Format clock date
  const formatClockDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  // Format stopwatch time (milliseconds to mm:ss.d)
  const formatStopwatchTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${tenths}`;
  };

  // Memoize tools object for SlidePreview to prevent unnecessary re-renders
  const memoizedTools = useMemo(() => ({
    countdown: isCountdownActive ? { active: true, remaining: countdownRemaining, message: countdownMessage, messageTranslation: countdownMessageTranslation } : undefined,
    announcement: isAnnouncementActive ? { active: true, text: announcementText } : undefined,
    clock: isClockActive ? { active: true, time: formatClockTime(currentTime, clockFormat), date: clockShowDate ? formatClockDate(currentTime) : '' } : undefined,
    stopwatch: isStopwatchActive ? { active: true, time: formatStopwatchTime(stopwatchTime), running: isStopwatchRunning } : undefined
  }), [isCountdownActive, countdownRemaining, countdownMessage, countdownMessageTranslation, isAnnouncementActive, announcementText, isClockActive, currentTime, clockFormat, clockShowDate, isStopwatchActive, stopwatchTime, isStopwatchRunning]);

  // Memoize theme for SlidePreview based on content type (for staged/selected content)
  const memoizedPreviewTheme = useMemo(() => {
    if (currentContentType === 'bible') return selectedBibleTheme;
    if (currentContentType === 'prayer') return selectedPrayerTheme;
    return selectedTheme;
  }, [currentContentType, selectedBibleTheme, selectedPrayerTheme, selectedTheme]);

  // Memoize theme for live preview based on what's actually on air
  const memoizedLivePreviewTheme = useMemo(() => {
    if (liveContentType === 'bible') return selectedBibleTheme;
    if (liveContentType === 'prayer') return selectedPrayerTheme;
    return selectedTheme;
  }, [liveContentType, selectedBibleTheme, selectedPrayerTheme, selectedTheme]);

  // Memoize presentationSlide for SlidePreview
  // For the live preview, use liveSlideData when content type is 'presentation'
  // Prayer/sermon presentations use theme-based rendering (liveSlideData contains prayer data, not presentationSlide)
  const memoizedPresentationSlide = useMemo(() => {
    if (liveContentType === 'presentation' && liveSlideData) {
      return liveSlideData;
    }
    return null;
  }, [liveContentType, liveSlideData]);

  // Memoize resource panel tabs to prevent recreation of SVG icons on every render
  const resourceTabs = useMemo(() => [
    { id: 'songs', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M9 13c0 1.105-1.12 2-2.5 2S4 14.105 4 13s1.12-2 2.5-2 2.5.895 2.5 2z"/><path fillRule="evenodd" d="M9 3v10H8V3h1z"/><path d="M8 2.82a1 1 0 0 1 .804-.98l3-.6A1 1 0 0 1 13 2.22V4L8 5V2.82z"/></svg>, label: t('nav.songs') },
    { id: 'bible', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.461-3.287.811V2.828zm7.5-.141c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v9.923c-.918-.35-2.107-.692-3.287-.81-1.094-.111-2.278-.039-3.213.492V2.687zM8 1.783C7.015.936 5.587.81 4.287.94c-1.514.153-3.042.672-3.994 1.105A.5.5 0 0 0 0 2.5v11a.5.5 0 0 0 .707.455c.882-.4 2.303-.881 3.68-1.02 1.409-.142 2.59.087 3.223.877a.5.5 0 0 0 .78 0c.633-.79 1.814-1.019 3.222-.877 1.378.139 2.8.62 3.681 1.02A.5.5 0 0 0 16 13.5v-11a.5.5 0 0 0-.293-.455c-.952-.433-2.48-.952-3.994-1.105C10.413.809 8.985.936 8 1.783z"/></svg>, label: t('nav.bible') },
    { id: 'media', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M0 1a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1V1zm4 0v6h8V1H4zm8 8H4v6h8V9z"/></svg>, label: t('nav.media') },
    { id: 'presentations', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm5 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm3 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm3 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/><path d="M2 13h12v1H2v-1z"/></svg>, label: t('nav.presentations') },
    { id: 'tools', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M1 0 0 1l2.2 3.081a1 1 0 0 0 .815.419h.07a1 1 0 0 1 .708.293l2.675 2.675-2.617 2.654A3.003 3.003 0 0 0 0 13a3 3 0 1 0 5.878-.851l2.654-2.617.968.968-.305.914a1 1 0 0 0 .242 1.023l3.27 3.27a.997.997 0 0 0 1.414 0l1.586-1.586a.997.997 0 0 0 0-1.414l-3.27-3.27a1 1 0 0 0-1.023-.242L10.5 9.5l-.96-.96 2.68-2.643A3.005 3.005 0 0 0 16 3q0-.405-.102-.777l-2.14 2.141L12 4l-.364-1.757L13.777.102a3 3 0 0 0-3.675 3.68L7.462 6.46 4.793 3.793a1 1 0 0 1-.293-.707v-.071a1 1 0 0 0-.419-.814z"/></svg>, label: t('nav.tools') }
  ], [t]);

  // Memoize tools tabs to prevent recreation on every render
  const toolsTabs = useMemo(() => [
    { key: 'countdown', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3L2 6"/><path d="M22 6l-3-3"/></svg>, label: t('tools.timer') },
    { key: 'clock', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>, label: t('tools.clock') },
    { key: 'stopwatch', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="13" r="8"/><path d="M12 9v4"/><path d="M10 2h4"/><path d="M12 2v2"/></svg>, label: t('tools.stopwatch') },
    { key: 'announce', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>, label: t('tools.announce') }
  ], [t]);

  // Clock control functions
  const startClock = () => {
    stopAllTools();
    setIsClockActive(true);
  };

  const stopClock = () => {
    setIsClockActive(false);
    window.electronAPI.sendTool({ type: 'clock', active: false });
    // Clear activeToolId if a clock was active from setlist (for future setlist support)
    setActiveToolId(prev => {
      const activeItem = setlist.find(item => item.id === prev);
      if (activeItem?.type === 'clock') return null;
      return prev;
    });
  };

  // Stopwatch control functions
  const startStopwatch = () => {
    stopAllTools();
    setIsStopwatchRunning(true);
    setIsStopwatchActive(true);
  };

  const pauseStopwatch = () => {
    setIsStopwatchRunning(false);
  };

  const resetStopwatch = () => {
    setStopwatchTime(0);
    setIsStopwatchRunning(false);
  };

  const stopStopwatchBroadcast = () => {
    setIsStopwatchActive(false);
    window.electronAPI.sendTool({ type: 'stopwatch', active: false });
    // Clear activeToolId if a stopwatch was active from setlist (for future setlist support)
    setActiveToolId(prev => {
      const activeItem = setlist.find(item => item.id === prev);
      if (activeItem?.type === 'stopwatch') return null;
      return prev;
    });
  };

  const getVerseTypeColor = (verseType?: string) => {
    switch (verseType?.toLowerCase()) {
      case 'chorus': return '#06b6d4';
      case 'verse1': case 'verse2': case 'verse3': case 'verse4': return '#54A0FF';
      case 'bridge': return '#1DD1A1';
      case 'prechorus': return '#FFA502';
      case 'intro': case 'outro': return '#A29BFE';
      default: return 'transparent';
    }
  };

  const assignedDisplays = displays.filter(d => d.isAssigned);

  return (
    <div className="control-panel" style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: colors.background.base }}>
      {/* Header - like web app */}
      <header style={{
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        {/* Left - Display Button with Online Status */}
        <div data-panel="display" style={{ position: 'relative' }}>
          <button
            onClick={() => setShowDisplayPanel(!showDisplayPanel)}
            style={{
              background: assignedDisplays.length > 0 || onlineConnected ? colors.button.success : 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 16px',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: '10px'
            }}
            title={onlineConnected ? `${t('controlPanel.online', 'Online')} (${viewerCount})` : t('controlPanel.offline', 'Offline')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" fill="none" stroke="white" strokeWidth="2"/>
              <line x1="8" y1="21" x2="16" y2="21" stroke="white" strokeWidth="2"/>
              <line x1="12" y1="17" x2="12" y2="21" stroke="white" strokeWidth="2"/>
            </svg>
            <span style={{ fontWeight: 500 }}>
              {assignedDisplays.length > 0 ? `${assignedDisplays.length} ${assignedDisplays.length > 1 ? t('controlPanel.displays') : t('controlPanel.display')}` : t('controlPanel.displays')}
            </span>
            {/* Online Status Dot */}
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: onlineConnected ? '#fff' : 'rgba(255,255,255,0.3)',
              boxShadow: onlineConnected ? '0 0 8px rgba(255,255,255,0.9)' : 'none',
              marginLeft: isRTL ? 0 : '4px',
              marginRight: isRTL ? '4px' : 0
            }} />
          </button>

          {/* Display Panel Dropdown */}
          {showDisplayPanel && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: isRTL ? 'auto' : 0,
              right: isRTL ? 0 : 'auto',
              marginTop: '8px',
              background: 'rgba(30, 30, 50, 0.98)',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.2)',
              padding: '12px',
              minWidth: '280px',
              maxHeight: 'calc(100vh - 120px)',
              overflowY: 'auto',
              zIndex: 1000,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
            }}>
              <h4 style={{ margin: '0 0 12px 0', color: 'white', fontSize: '0.9rem' }}>{t('controlPanel.connectedDisplays')}</h4>

              {/* Control Screen Selector */}
              <div style={{
                padding: '10px',
                background: 'rgba(33, 150, 243, 0.1)',
                borderRadius: '8px',
                marginBottom: '12px',
                border: '1px solid rgba(33, 150, 243, 0.3)'
              }}>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginBottom: '6px' }}>
                  {t('controlPanel.controlScreen', 'Control Screen')}
                </div>
                <select
                  value={controlDisplayId ?? ''}
                  onChange={async (e) => {
                    const displayId = parseInt(e.target.value);
                    if (!isNaN(displayId)) {
                      const success = await window.electronAPI.moveControlWindow(displayId);
                      if (success) {
                        setControlDisplayId(displayId);
                      }
                    }
                  }}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '6px',
                    padding: '8px',
                    color: 'white',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  {displays.map((display, index) => (
                    <option key={display.id} value={display.id} style={{ background: '#1e1e32', color: 'white' }}>
                      {index + 1}. {display.label} - {display.bounds.width}x{display.bounds.height}
                    </option>
                  ))}
                </select>
              </div>

              {/* Display List */}
              {displays.map((display, index) => (
                <div
                  key={display.id}
                  className="display-row"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '8px',
                    marginBottom: '8px',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Display Number - Click to Identify */}
                    <button
                      onClick={async () => {
                        try {
                          await window.electronAPI.identifyDisplays(display.id);
                        } catch (err) {
                          console.error('Failed to identify display:', err);
                        }
                      }}
                      title={t('controlPanel.identifyDisplays', 'Click to identify this display')}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        background: 'rgba(255, 152, 0, 0.2)',
                        border: '1px solid rgba(255, 152, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FF9800',
                        fontWeight: 'bold',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 152, 0, 0.4)';
                        e.currentTarget.style.transform = 'scale(1.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 152, 0, 0.2)';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      {index + 1}
                    </button>
                    <div>
                      <div style={{ color: 'white', fontWeight: 500 }}>
                        {display.label}
                                                {display.isAssigned && <span style={{ marginLeft: '8px', fontSize: '0.7rem', background: '#28a745', padding: '2px 6px', borderRadius: '4px' }}>{display.assignedType}</span>}
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>{display.bounds.width}x{display.bounds.height}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {display.id === controlDisplayId ? (
                      <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
                        {t('controlPanel.controlScreen', 'Control Screen')}
                      </span>
                    ) : display.isAssigned ? (
                      <button onClick={() => closeDisplay(display.id)} style={{ background: colors.button.danger, border: 'none', borderRadius: '6px', padding: '6px 12px', color: 'white', fontSize: '0.75rem', cursor: 'pointer' }}>{t('common.close')}</button>
                    ) : (
                      <>
                        <button onClick={() => openDisplay(display.id, 'viewer')} style={{ background: colors.button.info, border: 'none', borderRadius: '6px', padding: '6px 12px', color: 'white', fontSize: '0.75rem', cursor: 'pointer' }}>{t('controlPanel.viewer')}</button>
                        <button onClick={() => openDisplay(display.id, 'stage')} style={{ background: colors.button.secondary, border: 'none', borderRadius: '6px', padding: '6px 12px', color: 'white', fontSize: '0.75rem', cursor: 'pointer' }}>{t('controlPanel.stage')}</button>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {/* Themes Section - Isolated component for better performance */}
              <ThemeSelectionPanel
                themes={themes}
                stageMonitorThemes={stageMonitorThemes}
                bibleThemes={bibleThemes}
                prayerThemes={prayerThemes}
                obsThemes={obsThemes}
                selectedTheme={selectedTheme}
                selectedStageTheme={selectedStageTheme}
                selectedBibleTheme={selectedBibleTheme}
                selectedPrayerTheme={selectedPrayerTheme}
                selectedOBSTheme={selectedOBSTheme}
                selectedOBSSongsTheme={selectedOBSSongsTheme}
                selectedOBSBibleTheme={selectedOBSBibleTheme}
                selectedOBSPrayerTheme={selectedOBSPrayerTheme}
                isRTL={isRTL}
                onApplyViewerTheme={applyThemeToViewer}
                onApplyStageTheme={applyStageThemeToMonitor}
                onApplyBibleTheme={applyBibleThemeCallback}
                onApplyPrayerTheme={applyPrayerThemeCallback}
                onApplyOBSTheme={applyOBSThemeCallback}
                onCreateNewTheme={handleCreateNewTheme}
                onCloseDisplayPanel={handleCloseDisplayPanel}
              />

              {/* OBS Browser Source Section */}
              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <h4 style={{ margin: '0 0 12px 0', color: 'white', fontSize: '0.9rem' }}>{t('controlPanel.obsBrowserSource', 'OBS Browser Source')}</h4>
                <div style={{
                  padding: '10px',
                  background: obsServerRunning ? 'rgba(23, 162, 184, 0.2)' : 'rgba(255,255,255,0.05)',
                  borderRadius: '8px',
                  border: obsServerRunning ? '1px solid rgba(23, 162, 184, 0.5)' : '1px solid transparent'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: obsServerRunning ? '10px' : 0 }}>
                    <div>
                      <div style={{ color: 'white', fontWeight: 500, fontSize: '0.85rem' }}>
                        {t('controlPanel.browserSourceServer', 'Browser Source Server')}
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem' }}>
                        {obsServerRunning
                          ? t('controlPanel.serverRunning', 'Server running')
                          : t('controlPanel.serverStopped', 'Click Start to enable')}
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          if (obsServerRunning) {
                            await window.electronAPI.stopOBSServer();
                            setObsServerRunning(false);
                            setObsServerUrl(null);
                          } else {
                            const result = await window.electronAPI.startOBSServer();
                            if (result.success) {
                              setObsServerRunning(true);
                              setObsServerUrl(result.url ?? null);
                            }
                          }
                        } catch (err) {
                          console.error('[OBS Server] Error:', err);
                        }
                      }}
                      style={{
                        background: obsServerRunning ? '#dc3545' : 'linear-gradient(135deg, #17a2b8, #138496)',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 16px',
                        color: 'white',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        fontWeight: 500
                      }}
                    >
                      {obsServerRunning ? t('common.stop', 'Stop') : t('common.start', 'Start')}
                    </button>
                  </div>

                  {obsServerRunning && obsServerUrl && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'rgba(0,0,0,0.3)',
                      borderRadius: '6px',
                      padding: '8px 12px'
                    }}>
                      <code style={{
                        flex: 1,
                        color: '#4ade80',
                        fontSize: '0.8rem',
                        fontFamily: 'monospace',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {obsServerUrl}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(obsServerUrl);
                        }}
                        style={{
                          background: 'linear-gradient(135deg, #17a2b8, #138496)',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '6px 12px',
                          color: 'white',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          fontWeight: 500
                        }}
                        title={t('controlPanel.copyLink', 'Copy Link')}
                      >
                        {t('controlPanel.copyLink', 'Copy Link')}
                      </button>
                    </div>
                  )}
                </div>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', margin: '8px 0 0 0' }}>
                  {t('controlPanel.obsBrowserSourceHint', 'Add a Browser Source in OBS and paste this URL')}
                </p>
              </div>

              {/* Online Broadcast Section */}
              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <h4 style={{ margin: '0 0 12px 0', color: 'white', fontSize: '0.9rem' }}>{t('controlPanel.onlineBroadcast', 'Online Broadcast')}</h4>
                <BroadcastSelector
                  roomPin={roomPin}
                  viewerCount={viewerCount}
                  onlineConnected={onlineConnected}
                  serverUrl={authState.serverUrl}
                  onConnectClick={authState.isAuthenticated ? connectOnline : () => setShowAuthModal(true)}
                  embedded={true}
                />
              </div>
            </div>
          )}
        </div>

        {/* Center spacer */}
        <div style={{ flex: 1 }} />

        {/* Right - User, Help & Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* User Button */}
          {authState.isAuthenticated ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  style={{
                    background: colors.button.primary,
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="white">
                    <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"/>
                  </svg>
                  <span style={{ color: 'white', fontSize: '0.8rem', fontWeight: 500 }}>
                    {authState.user?.email?.split('@')[0]}
                  </span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" style={{ marginLeft: '2px' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {showUserMenu && (
                  <>
                    <div
                      style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                      onClick={() => setShowUserMenu(false)}
                    />
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      right: isRTL ? 'auto' : 0,
                      left: isRTL ? 0 : 'auto',
                      marginTop: '4px',
                      background: 'rgba(30,30,50,0.98)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.2)',
                      padding: '4px',
                      minWidth: '150px',
                      zIndex: 100,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                    }}>
                      <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '4px' }}>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem' }}>{t('settings.loggedInAs')}</div>
                        <div style={{ color: 'white', fontSize: '0.85rem', fontWeight: 500 }}>{authState.user?.email}</div>
                      </div>
                      <button
                        onClick={() => { navigate('/settings'); setShowUserMenu(false); }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', borderRadius: '6px', padding: '8px 12px', color: 'white', cursor: 'pointer', fontSize: '0.85rem', textAlign: isRTL ? 'right' : 'left' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="3" />
                          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                        {t('nav.settings')}
                      </button>
                      <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
                      <button
                        onClick={() => { handleLogout(); setShowUserMenu(false); }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', borderRadius: '6px', padding: '8px 12px', color: '#dc3545', cursor: 'pointer', fontSize: '0.85rem', textAlign: isRTL ? 'right' : 'left' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                          <polyline points="16 17 21 12 16 7" />
                          <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        {t('nav.logout')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              style={{
                background: colors.button.primary,
                border: 'none',
                borderRadius: '8px',
                padding: '6px 14px',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem',
                fontWeight: 500
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="white">
                <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"/>
              </svg>
              {t('nav.login')}
            </button>
          )}

          {/* Settings Button - always visible */}
          <button
            onClick={() => navigate('/settings')}
            title={t('nav.settings')}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 10px',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>

          <button
            onClick={() => setShowKeyboardHelp(true)}
            title="Keyboard Shortcuts (? or F1)"
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 10px',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.8rem'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
              <path d="M5.255 5.786a.237.237 0 0 0 .241.247h.825c.138 0 .248-.113.266-.25.09-.656.54-1.134 1.342-1.134.686 0 1.314.343 1.314 1.168 0 .635-.374.927-.965 1.371-.673.489-1.206 1.06-1.168 1.987l.003.217a.25.25 0 0 0 .25.246h.811a.25.25 0 0 0 .25-.25v-.105c0-.718.273-.927 1.01-1.486.609-.463 1.244-.977 1.244-2.056 0-1.511-1.276-2.241-2.673-2.241-1.267 0-2.655.59-2.75 2.286zm1.557 5.763c0 .533.425.927 1.01.927.609 0 1.028-.394 1.028-.927 0-.552-.42-.94-1.029-.94-.584 0-1.009.388-1.009.94z"/>
            </svg>
            ?
          </button>
          <img src={logoImage} alt="SoluCast" style={{ height: '32px', objectFit: 'contain' }} />
        </div>
      </header>

      {/* Main Content - Two Row Layout with resizable panels */}
      <main ref={mainContentRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '12px', gap: '0' }}>
        {/* Top Row - Three Column Layout with resizable widths */}
        <div style={{ display: 'flex', height: `${topRowHeight}%`, overflow: 'hidden', minHeight: 0 }}>
          {/* Left Column - Resource Panel (Songs/Media/Tools) */}
          <div style={{ width: `${leftPanelWidth}%`, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', overflow: 'hidden' }}>
            {/* Resource Tabs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderBottom: activeResourcePanel === 'songs' ? 'none' : '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                {resourceTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => handleResourcePanelChange(tab.id as ResourcePanel)}
                    style={{
                      background: activeResourcePanel === tab.id ? '#06b6d4' : 'rgba(255,255,255,0.1)',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      color: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    title={tab.label}
                  >
                    {tab.icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Bar - only for songs, below tabs */}
            {activeResourcePanel === 'songs' && (
              <div style={{ padding: '0 12px 8px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <svg width="14" height="14" fill="rgba(255,255,255,0.5)" viewBox="0 0 16 16" style={{ position: 'absolute', left: isRTL ? 'auto' : '10px', right: isRTL ? '10px' : 'auto', top: '50%', transform: 'translateY(-50%)' }}>
                    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
                  </svg>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder={t('controlPanel.searchSongs')}
                    defaultValue={searchQuery}
                    onChange={(e) => {
                      // Debounce search updates for performance
                      if (searchDebounceRef.current) {
                        clearTimeout(searchDebounceRef.current);
                      }
                      const value = e.target.value;
                      searchDebounceRef.current = setTimeout(() => {
                        setSearchQuery(value);
                        setVisibleSongsCount(50);
                      }, 150); // 150ms debounce
                    }}
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.08)',
                      border: '2px solid rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      padding: isRTL ? '8px 32px 8px 12px' : '8px 12px 8px 32px',
                      color: 'white',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                  />
                </div>
                <button
                  onClick={() => startEditingSong()}
                  title="New Song"
                  style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    width: '34px',
                    height: '34px',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '1.2rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  +
                </button>
              </div>
            )}

            {/* Import Status */}
            {importStatus && (
              <div style={{ padding: '8px 12px', background: importStatus.startsWith('Error') ? 'rgba(220, 53, 69, 0.2)' : 'rgba(40, 167, 69, 0.2)', color: importStatus.startsWith('Error') ? '#ff6b6b' : '#51cf66', fontSize: '0.75rem' }}>
                {importStatus}
              </div>
            )}

            {/* Resource Content */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              {/* Songs Panel */}
              {activeResourcePanel === 'songs' && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {filteredSongs.slice(0, visibleSongsCount).map((song) => (
                    <SongItem
                      key={song.id}
                      song={song}
                      isSelected={selectedSong?.id === song.id}
                      isDragged={draggedSong?.id === song.id}
                      onSelect={(s) => selectSong(s, 'song', false)}
                      onDoubleClick={addToSetlist}
                      onEdit={startEditingSong}
                      onDelete={deleteSongById}
                      onDragStart={handleSongDragStart}
                      onDragEnd={handleSongDragEnd}
                    />
                  ))}
                  {filteredSongs.length > visibleSongsCount && (
                    <button
                      onClick={() => setVisibleSongsCount(prev => prev + 50)}
                      style={{
                        padding: '10px',
                        margin: '8px 12px',
                        background: 'rgba(6, 182, 212, 0.15)',
                        border: '1px solid rgba(6, 182, 212, 0.3)',
                        borderRadius: '6px',
                        color: '#06b6d4',
                        fontSize: '0.8rem',
                        cursor: 'pointer'
                      }}
                    >
                      Load more ({filteredSongs.length - visibleSongsCount} remaining)
                    </button>
                  )}
                </div>
              )}

              {/* Media Panel */}
              {activeResourcePanel === 'media' && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                  {/* Media Sub-tabs */}
                  <div style={{
                    display: 'flex',
                    gap: '2px',
                    padding: '8px 12px',
                    background: 'rgba(0,0,0,0.2)',
                    borderBottom: '1px solid rgba(255,255,255,0.05)'
                  }}>
                    <button
                      onClick={() => setActiveMediaSubTab('library')}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        background: activeMediaSubTab === 'library' ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
                        border: activeMediaSubTab === 'library' ? '1px solid rgba(6, 182, 212, 0.4)' : '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '6px',
                        color: activeMediaSubTab === 'library' ? '#06b6d4' : 'rgba(255,255,255,0.6)',
                        fontSize: '0.8rem',
                        fontWeight: activeMediaSubTab === 'library' ? 600 : 400,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                      </svg>
                      {t('media.library')}
                    </button>
                    <button
                      onClick={() => setActiveMediaSubTab('links')}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        background: activeMediaSubTab === 'links' ? 'rgba(255, 0, 0, 0.15)' : 'transparent',
                        border: activeMediaSubTab === 'links' ? '1px solid rgba(255, 0, 0, 0.4)' : '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '6px',
                        color: activeMediaSubTab === 'links' ? '#ff4444' : 'rgba(255,255,255,0.6)',
                        fontSize: '0.8rem',
                        fontWeight: activeMediaSubTab === 'links' ? 600 : 400,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/>
                        <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/>
                      </svg>
                      {t('media.youtube')}
                    </button>
                  </div>

                  {/* Library Content */}
                  {activeMediaSubTab === 'library' && (
                    <div style={{ padding: '12px', overflowY: 'auto', flex: 1 }}>
                      <MediaGrid
                        onSelectImage={(path) => handleDisplayMedia('image', path)}
                        onSelectVideo={(path) => handleDisplayMedia('video', path)}
                        onSelectAudio={(path, name) => handlePlayAudio(path, name)}
                        onAddToSetlist={(media) => {
                          const newItem: SetlistItem = {
                            id: crypto.randomUUID(),
                            type: 'media',
                            mediaType: media.type,
                            mediaPath: media.path,
                            mediaName: media.name,
                            mediaDuration: media.duration,
                            thumbnailPath: media.thumbnailPath,
                            title: media.name
                          };
                          setSetlist(prev => [...prev, newItem]);
                        }}
                        onAddPlaylistToSetlist={(playlist) => {
                          const newItem: SetlistItem = {
                            id: crypto.randomUUID(),
                            type: 'audioPlaylist',
                            title: playlist.name,
                            audioPlaylist: playlist
                          };
                          setSetlist(prev => [...prev, newItem]);
                        }}
                      />
                    </div>
                  )}

                  {/* YouTube Links Content */}
                  {activeMediaSubTab === 'links' && (
                    <div style={{ padding: '12px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {/* URL/Search Input */}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          placeholder={t('media.youtubeSearchPlaceholder') || "Search YouTube or paste URL..."}
                          value={youtubeUrlInput}
                          onChange={(e) => setYoutubeUrlInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleYoutubeInputSubmit();
                          }}
                          style={{
                            flex: 1,
                            padding: '10px 12px',
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid rgba(255, 0, 0, 0.3)',
                            borderRadius: '8px',
                            color: 'white',
                            fontSize: '0.85rem',
                            outline: 'none'
                          }}
                        />
                        <button
                          onClick={handleYoutubeInputSubmit}
                          disabled={youtubeLoading || youtubeSearchLoading || !youtubeUrlInput.trim()}
                          style={{
                            padding: '10px 16px',
                            background: (youtubeLoading || youtubeSearchLoading) ? 'rgba(255,0,0,0.1)' : 'rgba(255, 0, 0, 0.2)',
                            border: '1px solid rgba(255, 0, 0, 0.4)',
                            borderRadius: '8px',
                            color: '#ff4444',
                            fontWeight: 600,
                            cursor: (youtubeLoading || youtubeSearchLoading) ? 'wait' : 'pointer',
                            fontSize: '0.85rem'
                          }}
                        >
                          {youtubeLoading || youtubeSearchLoading ? '...' : (isYouTubeUrl(youtubeUrlInput.trim()) ? (t('common.add') || 'Add') : (t('common.search') || 'Search'))}
                        </button>
                      </div>

                      {/* YouTube Search Results */}
                      {showYoutubeSearchResults && (
                        <div style={{
                          background: 'rgba(255, 0, 0, 0.05)',
                          border: '1px solid rgba(255, 0, 0, 0.2)',
                          borderRadius: '8px',
                          padding: '12px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <span style={{ color: '#ff4444', fontWeight: 600, fontSize: '0.85rem' }}>
                              {t('media.searchResults') || 'Search Results'}
                            </span>
                            <button
                              onClick={closeYoutubeSearchResults}
                              style={{
                                padding: '4px 8px',
                                background: 'transparent',
                                border: '1px solid rgba(255, 0, 0, 0.3)',
                                borderRadius: '4px',
                                color: '#ff4444',
                                fontSize: '0.75rem',
                                cursor: 'pointer'
                              }}
                            >
                              {t('common.close') || 'Close'}
                            </button>
                          </div>

                          {youtubeSearchLoading ? (
                            <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.6)' }}>
                              {t('common.loading') || 'Loading...'}
                            </div>
                          ) : youtubeSearchResults.length > 0 ? (
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                              gap: '10px',
                              maxHeight: '300px',
                              overflowY: 'auto'
                            }}>
                              {youtubeSearchResults.map((result) => (
                                <div
                                  key={result.videoId}
                                  style={{
                                    position: 'relative',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    border: hoveredYoutubeId === result.videoId ? '2px solid rgba(255, 0, 0, 0.8)' : '2px solid rgba(255, 0, 0, 0.3)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    transform: hoveredYoutubeId === result.videoId ? 'scale(1.02)' : 'scale(1)'
                                  }}
                                  onMouseEnter={() => setHoveredYoutubeId(result.videoId)}
                                  onMouseLeave={() => setHoveredYoutubeId(null)}
                                  onClick={() => {
                                    // Add directly to setlist
                                    const newItem: SetlistItem = {
                                      id: crypto.randomUUID(),
                                      type: 'youtube',
                                      youtubeVideoId: result.videoId,
                                      youtubeTitle: result.title,
                                      youtubeThumbnail: result.thumbnail,
                                      title: result.title
                                    };
                                    setSetlist(prev => [...prev, newItem]);
                                    closeYoutubeSearchResults();
                                  }}
                                >
                                  <img
                                    src={result.thumbnail}
                                    alt={result.title}
                                    style={{
                                      width: '100%',
                                      aspectRatio: '16/9',
                                      objectFit: 'cover',
                                      display: 'block'
                                    }}
                                  />
                                  {/* Add to setlist overlay - only on hover */}
                                  {hoveredYoutubeId === result.videoId && (
                                    <div style={{
                                      position: 'absolute',
                                      top: '50%',
                                      left: '50%',
                                      transform: 'translate(-50%, -50%)',
                                      width: '32px',
                                      height: '32px',
                                      background: 'rgba(255, 0, 0, 0.9)',
                                      borderRadius: '50%',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                                    }}>
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                        <line x1="12" y1="5" x2="12" y2="19" />
                                        <line x1="5" y1="12" x2="19" y2="12" />
                                      </svg>
                                    </div>
                                  )}
                                  {/* Title and channel overlay */}
                                  <div style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    padding: '6px 8px',
                                    background: 'linear-gradient(transparent, rgba(0,0,0,0.95))',
                                    color: 'white'
                                  }}>
                                    <div style={{
                                      fontSize: '0.7rem',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      marginBottom: '2px'
                                    }}>
                                      {result.title}
                                    </div>
                                    <div style={{
                                      fontSize: '0.6rem',
                                      color: 'rgba(255,255,255,0.6)',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap'
                                    }}>
                                      {result.channelTitle}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>
                              {t('media.noSearchResults') || 'No results found'}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Empty state when no search */}
                      {!showYoutubeSearchResults && (
                        <div style={{
                          textAlign: 'center',
                          padding: '40px 20px',
                          color: 'rgba(255,255,255,0.4)'
                        }}>
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ marginBottom: '12px', opacity: 0.5 }}>
                            <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/>
                            <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/>
                          </svg>
                          <div style={{ fontSize: '0.85rem', marginBottom: '4px' }}>{t('media.searchYoutube') || 'Search YouTube'}</div>
                          <div style={{ fontSize: '0.75rem' }}>{t('media.searchYoutubeHint') || 'Type a search query above to find videos'}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Tools Panel */}
              {activeResourcePanel === 'tools' && (
              <div style={{ display: 'flex', padding: '12px', flexDirection: 'column', gap: '12px' }}>
                  {/* Tools Tab Selector */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                    {toolsTabs.map((tab) => (
                      <div
                        key={tab.key}
                        onClick={() => setActiveToolsTab(tab.key as typeof activeToolsTab)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          padding: '6px 2px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          background: activeToolsTab === tab.key
                            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                            : 'rgba(255,255,255,0.08)',
                          border: activeToolsTab === tab.key
                            ? '1px solid rgba(255,255,255,0.3)'
                            : '1px solid rgba(255,255,255,0.1)',
                          color: 'white',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {tab.icon}
                        <span style={{ fontSize: '0.55rem', marginTop: '2px', fontWeight: activeToolsTab === tab.key ? 600 : 400 }}>{tab.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Countdown Tab */}
                  {activeToolsTab === 'countdown' && (
                    <div>
                      {isCountdownActive ? (
                        <div>
                          <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#06b6d4', marginBottom: '4px' }}>{countdownRemaining}</div>
                          </div>
                          {/* Editable message fields while countdown is running */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                            <input
                              type="text"
                              placeholder="הודעה (עברית)"
                              value={countdownMessage}
                              onChange={(e) => setCountdownMessage(e.target.value)}
                              dir="rtl"
                              style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', padding: '8px', color: 'white', fontSize: '0.85rem' }}
                            />
                            <input
                              type="text"
                              placeholder="Message (English)"
                              value={countdownMessageTranslation}
                              onChange={(e) => setCountdownMessageTranslation(e.target.value)}
                              style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', padding: '8px', color: 'white', fontSize: '0.85rem' }}
                            />
                          </div>
                          <button onClick={stopCountdown} style={{ background: colors.button.danger, border: 'none', borderRadius: '8px', padding: '10px 20px', color: 'white', cursor: 'pointer', width: '100%', fontSize: '0.9rem' }}>{t('controlPanel.stopCountdown')}</button>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                            <input
                              type="time"
                              value={countdownTargetTime}
                              onChange={(e) => setCountdownTargetTime(e.target.value)}
                              style={{ flex: '0 0 110px', background: '#2a2a4a', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', padding: '8px', color: 'white', fontSize: '0.85rem' }}
                            />
                            <input
                              type="text"
                              placeholder="הודעה (עברית)"
                              value={countdownMessage}
                              onChange={(e) => setCountdownMessage(e.target.value)}
                              dir="rtl"
                              style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', padding: '8px', color: 'white', fontSize: '0.85rem' }}
                            />
                          </div>
                          <div style={{ marginBottom: '12px' }}>
                            <input
                              type="text"
                              placeholder="Message (English)"
                              value={countdownMessageTranslation}
                              onChange={(e) => setCountdownMessageTranslation(e.target.value)}
                              style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', padding: '8px', color: 'white', fontSize: '0.85rem' }}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={startCountdownFromTime}
                              disabled={!countdownTargetTime}
                              style={{
                                flex: 1,
                                background: countdownTargetTime ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'rgba(255,255,255,0.1)',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '10px 20px',
                                color: 'white',
                                cursor: countdownTargetTime ? 'pointer' : 'not-allowed',
                                fontSize: '0.9rem'
                              }}
                            >
                              {t('tools.broadcastCountdown')}
                            </button>
                            <button
                              onClick={addCountdownToSetlist}
                              disabled={!countdownTargetTime}
                              style={{
                                flex: 1,
                                background: countdownTargetTime ? '#28a745' : 'rgba(255,255,255,0.1)',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '10px 20px',
                                color: 'white',
                                cursor: countdownTargetTime ? 'pointer' : 'not-allowed',
                                fontSize: '0.9rem'
                              }}
                            >
                              {t('tools.addToSetlist')}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Announce Tab */}
                  {activeToolsTab === 'announce' && (
                    <div>
                      {/* Preset buttons */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '12px' }}>
                        {[
                          { en: 'Welcome!', he: 'ברוכים הבאים!' },
                          { en: 'Silence phones', he: 'השתיקו טלפונים' },
                          { en: 'Please be seated', he: 'נא לשבת' },
                          { en: 'Register now!', he: 'הרשמו עכשיו!' }
                        ].map((item, idx) => (
                          <button
                            key={idx}
                            onClick={() => setAnnouncementText(item.he)}
                            style={{
                              background: 'rgba(255,255,255,0.1)',
                              border: '1px solid rgba(255,255,255,0.2)',
                              borderRadius: '6px',
                              padding: '6px 8px',
                              color: 'white',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              textAlign: 'center'
                            }}
                          >
                            {item.he}
                          </button>
                        ))}
                      </div>

                      <input
                        type="text"
                        placeholder={t('tools.announcementPlaceholder')}
                        value={announcementText}
                        onChange={(e) => setAnnouncementText(e.target.value)}
                        style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', padding: '10px', color: 'white', fontSize: '0.85rem', marginBottom: '12px' }}
                      />

                      {isAnnouncementActive ? (
                        <button
                          onClick={hideAnnouncement}
                          style={{
                            width: '100%',
                            background: colors.button.danger,
                            border: 'none',
                            borderRadius: '8px',
                            padding: '10px 20px',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                          }}
                        >
                          {t('controlPanel.stopBroadcasting')}
                        </button>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={showAnnouncement}
                            disabled={!announcementText.trim()}
                            style={{
                              flex: 1,
                              background: announcementText.trim() ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'rgba(255,255,255,0.1)',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '10px 20px',
                              color: 'white',
                              cursor: announcementText.trim() ? 'pointer' : 'not-allowed',
                              fontSize: '0.9rem'
                            }}
                          >
                            {t('tools.broadcastAnnouncement')}
                          </button>
                          <button
                            onClick={addAnnouncementToSetlist}
                            disabled={!announcementText.trim()}
                            style={{
                              flex: 1,
                              background: announcementText.trim() ? '#28a745' : 'rgba(255,255,255,0.1)',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '10px 20px',
                              color: 'white',
                              cursor: announcementText.trim() ? 'pointer' : 'not-allowed',
                              fontSize: '0.9rem'
                            }}
                          >
                            {t('tools.addToSetlist')}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Clock Tab */}
                  {activeToolsTab === 'clock' && (
                    <div style={{ textAlign: 'center' }}>
                      {/* Live Clock Display */}
                      <div style={{
                        fontSize: '2rem',
                        fontWeight: 700,
                        color: isClockActive ? '#00d4ff' : 'white',
                        marginBottom: '4px',
                        fontFamily: 'monospace'
                      }}>
                        {formatClockTime(currentTime, clockFormat)}
                      </div>
                      {clockShowDate && (
                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginBottom: '12px' }}>
                          {formatClockDate(currentTime)}
                        </div>
                      )}

                      {/* Format Toggle */}
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '12px' }}>
                        <button
                          onClick={() => setClockFormat('12h')}
                          style={{
                            background: clockFormat === '12h' ? '#667eea' : 'rgba(255,255,255,0.1)',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                        >
                          {t('tools.format12h')}
                        </button>
                        <button
                          onClick={() => setClockFormat('24h')}
                          style={{
                            background: clockFormat === '24h' ? '#667eea' : 'rgba(255,255,255,0.1)',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                        >
                          {t('tools.format24h')}
                        </button>
                        <button
                          onClick={() => setClockShowDate(!clockShowDate)}
                          style={{
                            background: clockShowDate ? '#667eea' : 'rgba(255,255,255,0.1)',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                        >
                          {t('tools.showDate')}
                        </button>
                      </div>

                      {/* Broadcast Button */}
                      {isClockActive ? (
                        <button
                          onClick={stopClock}
                          style={{
                            width: '100%',
                            background: colors.button.danger,
                            border: 'none',
                            borderRadius: '8px',
                            padding: '10px 20px',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                          }}
                        >
                          {t('controlPanel.stopBroadcasting')}
                        </button>
                      ) : (
                        <button
                          onClick={startClock}
                          style={{
                            width: '100%',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '10px 20px',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                          }}
                        >
                          {t('tools.broadcastClock')}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Stopwatch Tab */}
                  {activeToolsTab === 'stopwatch' && (
                    <div style={{ textAlign: 'center' }}>
                      {/* Stopwatch Display */}
                      <div style={{
                        fontSize: '2.5rem',
                        fontWeight: 700,
                        color: isStopwatchRunning ? '#00d4ff' : 'white',
                        marginBottom: '16px',
                        fontFamily: 'monospace'
                      }}>
                        {formatStopwatchTime(stopwatchTime)}
                      </div>

                      {/* Control Buttons */}
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '12px' }}>
                        {!isStopwatchRunning ? (
                          <button
                            onClick={startStopwatch}
                            style={{
                              flex: 1,
                              background: '#28a745',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '10px 16px',
                              color: 'white',
                              cursor: 'pointer',
                              fontSize: '0.9rem',
                              fontWeight: 600
                            }}
                          >
                            {stopwatchTime > 0 ? t('tools.resume') : t('tools.start')}
                          </button>
                        ) : (
                          <button
                            onClick={pauseStopwatch}
                            style={{
                              flex: 1,
                              background: '#ffc107',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '10px 16px',
                              color: '#000',
                              cursor: 'pointer',
                              fontSize: '0.9rem',
                              fontWeight: 600
                            }}
                          >
                            {t('tools.pause')}
                          </button>
                        )}
                        <button
                          onClick={resetStopwatch}
                          disabled={stopwatchTime === 0}
                          style={{
                            flex: 1,
                            background: stopwatchTime > 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '10px 16px',
                            color: stopwatchTime > 0 ? 'white' : 'rgba(255,255,255,0.3)',
                            cursor: stopwatchTime > 0 ? 'pointer' : 'not-allowed',
                            fontSize: '0.9rem'
                          }}
                        >
                          {t('tools.reset')}
                        </button>
                      </div>

                      {/* Broadcast Button */}
                      {isStopwatchActive ? (
                        <button
                          onClick={stopStopwatchBroadcast}
                          style={{
                            width: '100%',
                            background: colors.button.danger,
                            border: 'none',
                            borderRadius: '8px',
                            padding: '10px 20px',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                          }}
                        >
                          {t('controlPanel.stopBroadcasting')}
                        </button>
                      ) : (
                        <button
                          onClick={startStopwatch}
                          style={{
                            width: '100%',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '10px 20px',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                          }}
                        >
                          {t('tools.broadcastStopwatch')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Bible Panel */}
              {activeResourcePanel === 'bible' && (
              <div style={{ display: 'flex', padding: '12px', flexDirection: 'column', gap: '12px' }}>
                  {/* Search Input */}
                  <div style={{ position: 'relative' }}>
                    <svg width="14" height="14" fill="rgba(255,255,255,0.5)" viewBox="0 0 16 16" style={{ position: 'absolute', left: isRTL ? 'auto' : '10px', right: isRTL ? '10px' : 'auto', top: '50%', transform: 'translateY(-50%)' }}>
                      <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
                    </svg>
                    <input
                      type="text"
                      placeholder="תהילים כ״ג or Psalms 23..."
                      defaultValue={bibleSearchQuery}
                      onChange={(e) => {
                        // Debounce search updates for performance
                        if (bibleSearchDebounceRef.current) {
                          clearTimeout(bibleSearchDebounceRef.current);
                        }
                        const value = e.target.value;
                        bibleSearchDebounceRef.current = setTimeout(() => {
                          handleBibleSearch(value);
                        }, 150);
                      }}
                      style={{
                        width: '100%',
                        background: 'rgba(255,255,255,0.08)',
                        border: '2px solid rgba(255,255,255,0.15)',
                        borderRadius: '8px',
                        padding: isRTL ? '10px 32px 10px 12px' : '10px 12px 10px 32px',
                        color: 'white',
                        fontSize: '0.85rem',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Book Selector */}
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginBottom: '6px', textTransform: 'uppercase' }}>{t('controlPanel.book')}</div>
                    <select
                      value={selectedBibleBook}
                      onChange={(e) => {
                        setSelectedBibleBook(e.target.value);
                        setSelectedBibleChapter('');
                        setBibleSlides([]);
                      }}
                      style={{
                        width: '100%',
                        background: '#2a2a4a',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '6px',
                        padding: '8px',
                        color: 'white',
                        fontSize: '0.85rem'
                      }}
                    >
                      <option value="" style={{ background: '#2a2a4a', color: 'white' }}>{t('controlPanel.selectABook')}</option>
                      <optgroup label="תנ״ך (Old Testament)" style={{ background: '#1a1a3a', color: '#aaa' }}>
                        {oldTestamentBooks.map(book => (
                          <option key={book.name} value={book.name} style={{ background: '#2a2a4a', color: 'white' }}>
                            {book.hebrewName} - {book.name}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="הברית החדשה (New Testament)" style={{ background: '#1a1a3a', color: '#aaa' }}>
                        {newTestamentBooks.map(book => (
                          <option key={book.name} value={book.name} style={{ background: '#2a2a4a', color: 'white' }}>
                            {book.hebrewName} - {book.name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  {/* Chapter Selector */}
                  {selectedBibleBook && (
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginBottom: '6px', textTransform: 'uppercase' }}>{t('controlPanel.chapter')}</div>
                      <select
                        value={selectedBibleChapter}
                        onChange={(e) => setSelectedBibleChapter(e.target.value ? parseInt(e.target.value) : '')}
                        style={{
                          width: '100%',
                          background: '#2a2a4a',
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '6px',
                          padding: '8px',
                          color: 'white',
                          fontSize: '0.85rem'
                        }}
                      >
                        <option value="" style={{ background: '#2a2a4a', color: 'white' }}>{t('controlPanel.selectChapter')}</option>
                        {getChapterOptions().map(ch => (
                          <option key={ch} value={ch} style={{ background: '#2a2a4a', color: 'white' }}>{ch}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Loading indicator */}
                  {bibleLoading && (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.5)' }}>
                      {t('controlPanel.loadingVerses')}
                    </div>
                  )}

                  {/* Status and Add to Setlist */}
                  {biblePassage && bibleSlides.length > 0 && !bibleLoading && (
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginBottom: '8px', textAlign: 'center' }}>
                        {biblePassage.title} • {bibleSlides.length} verses
                      </div>
                      <button
                        onClick={() => addBibleToSetlist(biblePassage)}
                        style={{
                          width: '100%',
                          background: '#28a745',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '10px',
                          color: 'white',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: 600
                        }}
                      >
                        {t('tools.addToSetlist')}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Presentations Panel */}
              {activeResourcePanel === 'presentations' && (
              <div style={{ display: 'flex', padding: '12px', flexDirection: 'column', gap: '12px' }}>
                  {/* Search and New Button Row */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <svg width="14" height="14" fill="rgba(255,255,255,0.5)" viewBox="0 0 16 16" style={{ position: 'absolute', left: isRTL ? 'auto' : '10px', right: isRTL ? '10px' : 'auto', top: '50%', transform: 'translateY(-50%)' }}>
                        <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
                      </svg>
                      <input
                        type="text"
                        placeholder={t('controlPanel.searchPresentations')}
                        defaultValue={presentationSearchQuery}
                        onChange={(e) => {
                          // Debounce search updates for performance
                          if (presentationSearchDebounceRef.current) {
                            clearTimeout(presentationSearchDebounceRef.current);
                          }
                          const value = e.target.value;
                          presentationSearchDebounceRef.current = setTimeout(() => {
                            setPresentationSearchQuery(value);
                          }, 150);
                        }}
                        style={{
                          width: '100%',
                          background: 'rgba(255,255,255,0.08)',
                          border: '2px solid rgba(255,255,255,0.15)',
                          borderRadius: '8px',
                          padding: isRTL ? '8px 32px 8px 12px' : '8px 12px 8px 32px',
                          color: 'white',
                          fontSize: '0.85rem',
                          outline: 'none'
                        }}
                      />
                    </div>
                    <button
                      onClick={() => setShowTemplateModal(true)}
                      title="New Presentation"
                      style={{
                        background: '#06b6d4',
                        border: 'none',
                        borderRadius: '8px',
                        width: '34px',
                        height: '34px',
                        color: 'white',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '1.2rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      +
                    </button>
                  </div>

                  {/* Presentations List */}
                  {presentations.filter(p =>
                    !presentationSearchQuery ||
                    p.title.toLowerCase().includes(presentationSearchQuery.toLowerCase())
                  ).length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      padding: '40px 20px',
                      color: 'rgba(255,255,255,0.5)',
                      fontSize: '0.9rem'
                    }}>
                      <div style={{ fontSize: '32px', marginBottom: '12px' }}>📊</div>
                      <div>{t('controlPanel.noPresentationsYet')}</div>
                      <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>{t('controlPanel.createFirstPresentation')}</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {presentations.filter(p =>
                        !presentationSearchQuery ||
                        p.title.toLowerCase().includes(presentationSearchQuery.toLowerCase())
                      ).map((pres) => (
                        <PresentationItem
                          key={pres.id}
                          presentation={pres}
                          isSelected={selectedPresentation?.id === pres.id}
                          onSelect={handlePresentationSelect}
                          onDoubleClick={addPresentationToSetlist}
                          onEdit={handlePresentationEdit}
                          onDelete={handlePresentationDelete}
                          onDragStart={handlePresentationDragStart}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Resize Handle - Left/Setlist */}
          <div
            onMouseDown={(e) => startResize('left', e)}
            className="resize-handle-vertical"
            style={{
              width: '12px',
              cursor: 'col-resize',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <div style={{ width: '3px', height: '40px', background: isResizing === 'left' ? '#06b6d4' : 'rgba(255,255,255,0.15)', borderRadius: '2px', transition: 'background 0.15s, width 0.15s' }} />
          </div>

          {/* Middle Column - Setlist */}
          <div style={{ width: `${setlistPanelWidth}%`, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', overflow: 'hidden' }}>
            <div
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)', cursor: 'context-menu' }}
              onContextMenu={(e) => { e.preventDefault(); setShowSetlistMenu(true); }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'white', fontWeight: 600 }}>{currentSetlistId ? currentSetlistName : t('controlPanel.setlist')}</span>
                {hasUnsavedChanges && setlist.length > 0 && (
                  <span style={{ color: '#ffc107', fontSize: '0.7rem', fontWeight: 600 }}>*</span>
                )}
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', marginLeft: '2px' }}>{setlist.length} {t('controlPanel.items')}</span>
              </div>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowSetlistMenu(!showSetlistMenu)}
                  onMouseEnter={() => setSetlistMenuHover(true)}
                  onMouseLeave={() => setSetlistMenuHover(false)}
                  style={{
                    background: setlistMenuHover ? 'rgba(255,255,255,0.15)' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 8px',
                    color: 'rgba(255,255,255,0.6)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.15s ease',
                    position: 'relative'
                  }}
                >
                  <span style={{ width: '14px', height: '2px', background: 'currentColor', borderRadius: '1px' }} />
                  <span style={{ width: '14px', height: '2px', background: 'currentColor', borderRadius: '1px' }} />
                  <span style={{ width: '14px', height: '2px', background: 'currentColor', borderRadius: '1px' }} />
                  {/* Subtle unsaved indicator dot */}
                  {hasUnsavedChanges && setlist.length > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: '2px',
                      right: '2px',
                      width: '6px',
                      height: '6px',
                      background: '#ffc107',
                      borderRadius: '50%'
                    }} />
                  )}
                </button>
                {showSetlistMenu && (
                  <>
                    <div
                      style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                      onClick={() => setShowSetlistMenu(false)}
                    />
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      marginTop: '4px',
                      background: 'rgba(30,30,50,0.98)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.2)',
                      padding: '4px',
                      minWidth: '140px',
                      zIndex: 100,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                    }}>
                      <button
                        onClick={() => { tryClearSetlist(); setShowSetlistMenu(false); }}
                        style={{ width: '100%', display: 'flex', flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', borderRadius: '6px', padding: '8px 12px', color: 'white', cursor: 'pointer', fontSize: '0.85rem', textAlign: isRTL ? 'right' : 'left' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2Z"/></svg>
                        {t('controlPanel.newSetlist')}
                      </button>
                      <button
                        onClick={() => { setShowLoadModal(true); setShowSetlistMenu(false); }}
                        style={{ width: '100%', display: 'flex', flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', borderRadius: '6px', padding: '8px 12px', color: 'white', cursor: 'pointer', fontSize: '0.85rem', textAlign: isRTL ? 'right' : 'left' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h4.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9zM2.5 3a.5.5 0 0 0-.5.5V6h12v-.5a.5.5 0 0 0-.5-.5H9c-.964 0-1.71-.629-2.174-1.154C6.374 3.334 5.82 3 5.264 3H2.5zM14 7H2v5.5a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5V7z"/></svg>
                        {t('controlPanel.loadSetlist')}
                      </button>
                      <button
                        onClick={() => { setShowSaveModal(true); setShowSetlistMenu(false); }}
                        style={{ width: '100%', display: 'flex', flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', borderRadius: '6px', padding: '8px 12px', color: hasUnsavedChanges && setlist.length > 0 ? '#ffc107' : 'white', cursor: 'pointer', fontSize: '0.85rem', textAlign: isRTL ? 'right' : 'left' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H9.5a1 1 0 0 0-1 1v7.293l2.146-2.147a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 1 1 .708-.708L7.5 9.293V2a2 2 0 0 1 2-2H14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h2.5a.5.5 0 0 1 0 1H2z"/></svg>
                        {t('controlPanel.saveSetlist')}
                      </button>
                      <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
                      <button
                        onClick={() => { addSectionHeader(); setShowSetlistMenu(false); }}
                        style={{ width: '100%', display: 'flex', flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', borderRadius: '6px', padding: '8px 12px', color: 'white', cursor: 'pointer', fontSize: '0.85rem', textAlign: isRTL ? 'right' : 'left' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" d="M2 3.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zm0 4a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zm0 4a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z"/></svg>
                        {t('controlPanel.addSection')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div
              style={{
                flex: 1,
                overflow: 'auto',
                background: draggedSong ? 'rgba(6,182,212,0.05)' : isDraggingMedia ? 'rgba(50,200,100,0.08)' : 'transparent',
                transition: 'background 0.2s'
              }}
              onDragOver={(e) => {
                e.preventDefault();
                // Check if dragging media from MediaGrid
                if (e.dataTransfer.types.includes('application/json')) {
                  setIsDraggingMedia(true);
                  e.dataTransfer.dropEffect = 'copy';
                } else {
                  e.dataTransfer.dropEffect = draggedSong ? 'copy' : 'move';
                }
              }}
              onDragEnter={(e) => {
                if (e.dataTransfer.types.includes('application/json')) {
                  setIsDraggingMedia(true);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedSong) {
                  // Dropping a song from database
                  if (dropTargetIndex !== null) {
                    const newSetlist = [...setlist];
                    newSetlist.splice(dropTargetIndex, 0, { id: crypto.randomUUID(), type: 'song', song: draggedSong });
                    setSetlist(newSetlist);
                  } else {
                    addToSetlist(draggedSong);
                  }
                  setDraggedSong(null);
                } else if (draggedSetlistIndex !== null && dropTargetIndex !== null && draggedSetlistIndex !== dropTargetIndex) {
                  // Reordering within setlist
                  const newSetlist = [...setlist];
                  const [removed] = newSetlist.splice(draggedSetlistIndex, 1);
                  newSetlist.splice(dropTargetIndex > draggedSetlistIndex ? dropTargetIndex - 1 : dropTargetIndex, 0, removed);
                  setSetlist(newSetlist);
                } else {
                  // Check for media or presentation drop
                  const jsonData = e.dataTransfer.getData('application/json');
                  if (jsonData) {
                    try {
                      const data = JSON.parse(jsonData);

                      // Handle presentation drop
                      if (data.type === 'presentation' && data.presentation) {
                        const presItem: SetlistItem = {
                          id: crypto.randomUUID(),
                          type: 'presentation',
                          title: data.presentation.title,
                          presentation: data.presentation
                        };
                        if (dropTargetIndex !== null) {
                          const newSetlist = [...setlist];
                          newSetlist.splice(dropTargetIndex, 0, presItem);
                          setSetlist(newSetlist);
                        } else {
                          setSetlist(prev => [...prev, presItem]);
                        }
                      }
                      // Handle media drop from MediaGrid
                      else if (data.type && data.path && data.name) {
                        const mediaItem: SetlistItem = {
                          id: crypto.randomUUID(),
                          type: 'media',
                          title: data.name,
                          mediaType: data.type,
                          mediaPath: data.path,
                          mediaName: data.name,
                          mediaDuration: data.duration,
                          thumbnailPath: data.thumbnailPath
                        };
                        if (dropTargetIndex !== null) {
                          const newSetlist = [...setlist];
                          newSetlist.splice(dropTargetIndex, 0, mediaItem);
                          setSetlist(newSetlist);
                        } else {
                          setSetlist(prev => [...prev, mediaItem]);
                        }
                      }
                    } catch (err) {
                      console.error('Failed to parse drop data:', err);
                    }
                  }
                }
                setDropTargetIndex(null);
                setDraggedSetlistIndex(null);
                setIsDraggingMedia(false);
              }}
              onDragLeave={(e) => {
                // Only reset if leaving the container entirely
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDropTargetIndex(null);
                  setIsDraggingMedia(false);
                }
              }}
            >
              {setlist.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
                  {t('controlPanel.dragItemsHere')}
                </div>
              ) : (
                (() => {
                  // Track which section each item belongs to
                  let currentSectionId: string | null = null;
                  return setlist.map((item, index) => {
                    // Update current section tracker
                    if (item.type === 'section') {
                      currentSectionId = item.id;
                    }
                    // Skip items in collapsed sections (but not the section header itself)
                    const belongsToSection = item.type !== 'section' ? currentSectionId : null;
                    if (belongsToSection && collapsedSections.has(belongsToSection)) {
                      return null;
                    }
                    // Count items in this section for the badge
                    const sectionItemCount = item.type === 'section' ? (() => {
                      let count = 0;
                      for (let i = index + 1; i < setlist.length; i++) {
                        if (setlist[i].type === 'section') break;
                        count++;
                      }
                      return count;
                    })() : 0;
                    const isCollapsed = item.type === 'section' && collapsedSections.has(item.id);
                    return (
                    <React.Fragment key={item.id}>
                  <div
                    className="setlist-row"
                    {...(item.type === 'audioPlaylist' && expandedPlaylistIds.has(item.id) ? { 'data-playlist-expanded': true } : {})}
                    draggable
                    onDragStart={(e) => {
                      setDraggedSetlistIndex(index);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={() => {
                      setDraggedSetlistIndex(null);
                      setDropTargetIndex(null);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDropTargetIndex(index);
                    }}
                    onMouseLeave={() => {
                      if (setlistMenuOpen === item.id) setSetlistMenuOpen(null);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setSetlistContextMenu({ x: e.clientX, y: e.clientY, item });
                    }}
                    onClick={() => {
                      if (item.type === 'section') {
                        // Toggle section collapse
                        setCollapsedSections(prev => {
                          const next = new Set(prev);
                          if (next.has(item.id)) {
                            next.delete(item.id);
                          } else {
                            next.add(item.id);
                          }
                          return next;
                        });
                      } else if (item.type === 'song' && item.song) {
                        stopAllTools(); // Stop any active tools
                        setActiveMedia(null); // Clear active media
                        selectSong(item.song, 'song', false); // Load to preview only, don't send to display
                      } else if (item.type === 'bible' && item.song) {
                        stopAllTools(); // Stop any active tools
                        setActiveMedia(null); // Clear active media
                        selectSong(item.song, 'bible', false); // Load to preview only, don't send to display
                      } else if (item.type === 'countdown' || item.type === 'announcement' || item.type === 'messages') {
                        broadcastToolFromSetlist(item);
                      } else if (item.type === 'media' && item.mediaPath && item.mediaType) {
                        // Toggle selection for all media types - don't play immediately
                        setSelectedSetlistMediaId(selectedSetlistMediaId === item.id ? null : item.id);
                      } else if (item.type === 'presentation' && item.presentation) {
                        stopAllTools(); // Stop any active tools
                        setActiveMedia(null); // Clear active media
                        // Select presentation - load to preview only, don't send to display
                        setSelectedSong(null); // Clear song selection
                        setSelectedPresentation(item.presentation);
                        setCurrentPresentationSlideIndex(0);
                        // Set content type based on presentation type
                        if (item.presentation.quickModeData?.type === 'prayer' || item.presentation.quickModeData?.type === 'sermon') {
                          setCurrentContentType('prayer');
                        } else {
                          setCurrentContentType('presentation');
                        }
                      } else if (item.type === 'youtube' && item.youtubeVideoId) {
                        // Just select the YouTube item, don't play immediately
                        setSelectedYoutubeItemId(selectedYoutubeItemId === item.id ? null : item.id);
                      } else if (item.type === 'audioPlaylist' && item.audioPlaylist) {
                        // Start playing the playlist
                        startPlaylist(item);
                      } else if (item.type === 'blank') {
                        stopAllTools(); // Stop any active tools
                        setActiveMedia(null); // Clear active media
                        setSelectedSong(null);
                        setSelectedPresentation(null);
                        setIsBlank(true);
                        setLiveState({ slideData: null, contentType: null, songId: null, slideIndex: 0 }); // Clear live preview
                        window.electronAPI.sendBlank();
                      }
                    }}
                    onDoubleClick={() => removeFromSetlist(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: item.type === 'section' ? '6px 12px' : '10px 12px',
                      cursor: item.type === 'section' ? 'pointer' : 'grab',
                      background: dropTargetIndex === index
                        ? 'rgba(0, 212, 255, 0.2)'
                        : activeToolId === item.id
                        ? 'rgba(102, 126, 234, 0.4)'
                        : item.type === 'song' && selectedSong?.id === item.song?.id
                        ? 'rgba(6,182,212,0.2)'
                        : item.type === 'bible' && selectedSong?.id === item.song?.id
                        ? 'rgba(230, 184, 0, 0.2)'
                        : item.type === 'media' && item.mediaPath && activeMedia && activeMedia.url.includes(encodeURIComponent(item.mediaPath.split(/[/\\]/).pop() || ''))
                        ? 'rgba(50, 200, 100, 0.3)'
                        : item.type === 'media' && item.mediaType === 'audio' && item.mediaPath && activeAudio && activeAudio.url.includes(encodeURIComponent(item.mediaPath.split(/[/\\]/).pop() || ''))
                        ? 'rgba(156, 39, 176, 0.3)'
                        : item.type === 'media' && selectedSetlistMediaId === item.id
                        ? 'rgba(6, 182, 212, 0.2)'
                        : item.type === 'section'
                        ? 'rgba(6,182,212,0.15)'
                        : (item.type === 'countdown' || item.type === 'announcement' || item.type === 'messages')
                        ? 'rgba(102, 126, 234, 0.1)'
                        : item.type === 'media'
                        ? 'rgba(50, 200, 100, 0.1)'
                        : item.type === 'presentation'
                        ? 'rgba(156, 39, 176, 0.1)'
                        : item.type === 'youtube' && youtubeOnDisplay && activeYoutubeVideo?.videoId === item.youtubeVideoId
                        ? 'rgba(255, 0, 0, 0.3)'
                        : item.type === 'youtube' && selectedYoutubeItemId === item.id
                        ? 'rgba(255, 0, 0, 0.2)'
                        : item.type === 'youtube'
                        ? 'rgba(255, 0, 0, 0.1)'
                        : item.type === 'audioPlaylist' && activePlaylistId === item.id
                        ? 'rgba(255, 152, 0, 0.3)'
                        : item.type === 'audioPlaylist'
                        ? 'rgba(255, 152, 0, 0.1)'
                        : 'transparent',
                      borderLeft: item.type === 'section'
                        ? '3px solid #06b6d4'
                        : activeToolId === item.id
                        ? '3px solid #00d4ff'
                        : item.type === 'song' && selectedSong?.id === item.song?.id
                        ? '3px solid #06b6d4'
                        : item.type === 'bible' && selectedSong?.id === item.song?.id
                        ? '3px solid #e6b800'
                        : item.type === 'media' && item.mediaPath && activeMedia && activeMedia.url.includes(encodeURIComponent(item.mediaPath.split(/[/\\]/).pop() || ''))
                        ? '3px solid #32c864'
                        : item.type === 'media' && item.mediaType === 'audio' && item.mediaPath && activeAudio && activeAudio.url.includes(encodeURIComponent(item.mediaPath.split(/[/\\]/).pop() || ''))
                        ? '3px solid #9C27B0'
                        : item.type === 'media' && selectedSetlistMediaId === item.id
                        ? '3px solid #06b6d4'
                        : (item.type === 'countdown' || item.type === 'announcement' || item.type === 'messages')
                        ? '3px solid #667eea'
                        : item.type === 'media'
                        ? '3px solid transparent'
                        : item.type === 'presentation'
                        ? '3px solid #9C27B0'
                        : item.type === 'youtube' && youtubeOnDisplay && activeYoutubeVideo?.videoId === item.youtubeVideoId
                        ? '3px solid #FF0000'
                        : item.type === 'youtube' && selectedYoutubeItemId === item.id
                        ? '3px solid #FF0000'
                        : item.type === 'youtube'
                        ? '3px solid transparent'
                        : item.type === 'audioPlaylist' && activePlaylistId === item.id
                        ? '3px solid #FF9800'
                        : item.type === 'audioPlaylist'
                        ? '3px solid transparent'
                        : '3px solid transparent',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      borderTop: dropTargetIndex === index ? '2px solid #00d4ff' : '2px solid transparent',
                      opacity: draggedSetlistIndex === index ? 0.5 : 1,
                      transition: 'background 0.15s, border 0.15s'
                    }}
                  >
                    {item.type === 'section' && (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth="2"
                        style={{
                          marginRight: '8px',
                          transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                          transition: 'transform 0.15s'
                        }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    )}
                    {item.type !== 'section' && (
                      <span style={{ color: 'rgba(255,255,255,0.4)', marginRight: '10px', fontSize: '0.75rem', minWidth: '20px' }}>
                        {setlist.slice(0, index + 1).filter(i => i.type !== 'section').length}
                      </span>
                    )}
                    {/* Item type icon */}
                    <span style={{ marginRight: '8px', display: 'flex', alignItems: 'center' }}>
                      {item.type === 'song' && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2">
                          <path d="M9 18V5l12-2v13" />
                          <circle cx="6" cy="18" r="3" />
                          <circle cx="18" cy="16" r="3" />
                        </svg>
                      )}
                      {item.type === 'countdown' && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#667eea" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                      )}
                      {item.type === 'announcement' && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#667eea" strokeWidth="2">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                      )}
                      {item.type === 'messages' && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#667eea" strokeWidth="2">
                          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                        </svg>
                      )}
                      {item.type === 'media' && item.mediaType === 'video' && (
                        item.thumbnailPath ? (
                          <img
                            src={`media://file/${encodeURIComponent(item.thumbnailPath)}`}
                            alt=""
                            style={{
                              width: '28px',
                              height: '28px',
                              objectFit: 'cover',
                              borderRadius: '4px',
                              border: '1px solid rgba(50, 200, 100, 0.5)'
                            }}
                            onError={(e) => {
                              // Fallback to icon if thumbnail fails to load
                              e.currentTarget.style.display = 'none';
                              const svgFallback = e.currentTarget.nextElementSibling as HTMLElement;
                              if (svgFallback) svgFallback.style.display = 'block';
                            }}
                          />
                        ) : null
                      )}
                      {item.type === 'media' && item.mediaType === 'video' && !item.thumbnailPath && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#32c864" strokeWidth="2">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      )}
                      {item.type === 'media' && item.mediaType === 'image' && (
                        item.thumbnailPath || item.mediaPath ? (
                          <img
                            src={`media://file/${encodeURIComponent(item.thumbnailPath || item.mediaPath || '')}`}
                            alt=""
                            style={{
                              width: '28px',
                              height: '28px',
                              objectFit: 'cover',
                              borderRadius: '4px',
                              border: '1px solid rgba(50, 200, 100, 0.5)'
                            }}
                            onError={(e) => {
                              // Fallback to icon if image fails to load
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#32c864" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                          </svg>
                        )
                      )}
                      {item.type === 'media' && item.mediaType === 'audio' && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9C27B0" strokeWidth="2">
                          <path d="M9 18V5l12-2v13" />
                          <circle cx="6" cy="18" r="3" />
                          <circle cx="18" cy="16" r="3" />
                        </svg>
                      )}
                      {item.type === 'presentation' && (
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="#9C27B0">
                          <path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm5 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm3 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm3 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/>
                          <path d="M2 13h12v1H2v-1z"/>
                        </svg>
                      )}
                      {item.type === 'bible' && (
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="#e6b800">
                          <path d="M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.461-3.287.811V2.828zm7.5-.141c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v9.923c-.918-.35-2.107-.692-3.287-.81-1.094-.111-2.278-.039-3.213.492V2.687zM8 1.783C7.015.936 5.587.81 4.287.94c-1.514.153-3.042.672-3.994 1.105A.5.5 0 0 0 0 2.5v11a.5.5 0 0 0 .707.455c.882-.4 2.303-.881 3.68-1.02 1.409-.142 2.59.087 3.223.877a.5.5 0 0 0 .78 0c.633-.79 1.814-1.019 3.222-.877 1.378.139 2.8.62 3.681 1.02A.5.5 0 0 0 16 13.5v-11a.5.5 0 0 0-.293-.455c-.952-.433-2.48-.952-3.994-1.105C10.413.809 8.985.936 8 1.783z"/>
                        </svg>
                      )}
                      {item.type === 'blank' && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        </svg>
                      )}
                      {item.type === 'youtube' && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#FF0000">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                        </svg>
                      )}
                      {item.type === 'audioPlaylist' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedPlaylistIds(prev => {
                                const newSet = new Set(prev);
                                if (newSet.has(item.id)) {
                                  newSet.delete(item.id);
                                } else {
                                  newSet.add(item.id);
                                }
                                return newSet;
                              });
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '2px',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="#FF9800"
                              strokeWidth="2"
                              style={{
                                transform: expandedPlaylistIds.has(item.id) ? 'rotate(90deg)' : 'rotate(0deg)',
                                transition: 'transform 0.15s'
                              }}
                            >
                              <polyline points="9 6 15 12 9 18" />
                            </svg>
                          </button>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF9800" strokeWidth="2">
                            <line x1="8" y1="6" x2="21" y2="6" />
                            <line x1="8" y1="12" x2="21" y2="12" />
                            <line x1="8" y1="18" x2="21" y2="18" />
                            <circle cx="4" cy="6" r="2" fill="#FF9800" />
                            <circle cx="4" cy="12" r="2" fill="#FF9800" />
                            <circle cx="4" cy="18" r="2" fill="#FF9800" />
                          </svg>
                        </div>
                      )}
                    </span>
                    <span style={{
                      flex: 1,
                      color: 'white',
                      fontWeight: item.type === 'section' ? 700 : 400,
                      fontSize: '0.85rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {item.type === 'song' ? item.song?.title :
                       item.type === 'section' ? item.title :
                       item.type === 'bible' ? item.song?.title || item.title :
                       item.type === 'media' ? (() => {
                         const name = item.mediaName || item.title || 'Media';
                         return name.length > 30 ? name.slice(0, 30) + '...' : name;
                       })() :
                       item.type === 'presentation' ? (item.presentation?.title || item.title || 'Presentation') :
                       item.type === 'youtube' ? (item.youtubeTitle || item.title || 'YouTube Video') :
                       item.type === 'audioPlaylist' ? (item.audioPlaylist?.name || item.title || 'Playlist') :
                       item.title}
                    </span>
                    {/* Section item count badge */}
                    {item.type === 'section' && sectionItemCount > 0 && (
                      <span style={{
                        background: 'rgba(6,182,212,0.3)',
                        color: '#06b6d4',
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: '10px',
                        marginLeft: '8px'
                      }}>
                        {sectionItemCount}
                      </span>
                    )}
                    {/* Auto-play cycling indicator for presentations */}
                    {item.type === 'presentation' && autoPlayActive && selectedPresentation?.id === item.presentation?.id && (
                      <span style={{
                        background: '#00d4ff',
                        color: '#000',
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        marginLeft: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        animation: 'pulse 1.5s ease-in-out infinite'
                      }}>
                        <span>🔄</span>
                        {currentPresentationSlideIndex + 1}/{selectedPresentation?.slides?.length || 0} • {autoPlayInterval}s
                      </span>
                    )}
                    {/* Audio Playlist: Track count badge and playback controls */}
                    {item.type === 'audioPlaylist' && item.audioPlaylist && (() => {
                      const isPlaying = activePlaylistId === item.id;
                      const trackCount = item.audioPlaylist.tracks.length;
                      const currentTrackIndex = isPlaying ? activePlaylistIndex + 1 : 0;

                      if (isPlaying) {
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
                            <span style={{
                              background: 'rgba(255, 152, 0, 0.3)',
                              color: '#FF9800',
                              fontSize: '0.6rem',
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" style={{ animation: 'pulse 1s ease-in-out infinite' }}>
                                <polygon points="5 3 19 12 5 21 5 3" />
                              </svg>
                              {currentTrackIndex}/{trackCount}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveAudio(null);
                                setActivePlaylistId(null);
                                setActivePlaylistIndex(0);
                                setActivePlaylistOrder([]);
                              }}
                              style={{
                                background: 'rgba(239, 68, 68, 0.9)',
                                color: 'white',
                                fontSize: '0.6rem',
                                fontWeight: 600,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                            >
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                                <rect x="6" y="6" width="12" height="12" />
                              </svg>
                              {t('common.stop')}
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
                          <span style={{
                            background: 'rgba(255, 152, 0, 0.2)',
                            color: '#FF9800',
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            padding: '1px 6px',
                            borderRadius: '10px'
                          }}>
                            {trackCount} {item.audioPlaylist.shuffle ? '🔀' : ''}
                          </span>
                          {/* Edit button - visible on hover */}
                          <button
                            className={`setlist-hover-menu ${selectedSetlistMediaId === item.id ? 'menu-open' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditPlaylistModal(item);
                            }}
                            style={{
                              background: 'rgba(102, 126, 234, 0.3)',
                              color: '#667eea',
                              fontSize: '0.6rem',
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              border: '1px solid rgba(102, 126, 234, 0.5)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                            title="Edit playlist"
                          >
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            Edit
                          </button>
                        </div>
                      );
                    })()}
                    {/* Audio: Play button when selected or hovered (not playing) / Playing indicator with stop */}
                    {item.type === 'media' && item.mediaType === 'audio' && (() => {
                      const encodedPath = (item.mediaPath || '')
                        .replace(/\\/g, '/')
                        .split('/')
                        .map(segment => encodeURIComponent(segment))
                        .join('/');
                      const itemAudioUrl = `media://file/${encodedPath}`;
                      const isPlaying = activeAudio && activeAudio.url === itemAudioUrl;
                      const isSelected = selectedSetlistMediaId === item.id;

                      // Show Play button when selected/hovered and NOT playing
                      if (!isPlaying) {
                        return (
                          <button
                            className={`setlist-hover-menu ${isSelected ? 'menu-open' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlayAudio(item.mediaPath!, item.mediaName || item.title || 'Audio');
                              setActiveAudioSetlistId(item.id); // Track which setlist item is playing
                              setSelectedSetlistMediaId(null);
                            }}
                            style={{
                              background: 'rgba(156, 39, 176, 0.9)',
                              color: 'white',
                              fontSize: '0.65rem',
                              fontWeight: 600,
                              padding: '3px 10px',
                              borderRadius: '4px',
                              marginLeft: '8px',
                              border: 'none',
                              cursor: 'pointer',
                              alignItems: 'center',
                              gap: '4px',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                              <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                            {t('common.play')}
                          </button>
                        );
                      }

                      // Show Playing indicator when playing (with hover-to-stop)
                      if (isPlaying) {
                        const isStopHovered = hoveredMediaStopId === item.id;
                        return (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveAudio(null);
                              setActiveAudioSetlistId(null); // Clear setlist tracking on manual stop
                            }}
                            onMouseEnter={() => setHoveredMediaStopId(item.id)}
                            onMouseLeave={() => setHoveredMediaStopId(null)}
                            style={{
                              background: isStopHovered ? '#dc3545' : (audioStatus.isPlaying ? '#9C27B0' : 'rgba(156, 39, 176, 0.5)'),
                              color: 'white',
                              fontSize: '0.6rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              marginLeft: '8px',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'background 0.15s'
                            }}
                          >
                            {isStopHovered ? (
                              <>
                                <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                                  <rect x="4" y="4" width="16" height="16" rx="2" />
                                </svg>
                                {t('common.stop').toUpperCase()}
                              </>
                            ) : audioStatus.isPlaying ? (
                              <>
                                <span style={{ animation: 'pulse 1s ease-in-out infinite' }}>♪</span>
                                {t('common.playing').toUpperCase()}
                              </>
                            ) : (
                              t('common.pause').toUpperCase()
                            )}
                          </button>
                        );
                      }

                      return null;
                    })()}
                    {/* Video/Image: Play/Display button when selected or hovered (not active) */}
                    {item.type === 'media' && (item.mediaType === 'video' || item.mediaType === 'image') && (() => {
                      const encodedPath = (item.mediaPath || '')
                        .replace(/\\/g, '/')
                        .split('/')
                        .map(segment => encodeURIComponent(segment))
                        .join('/');
                      const itemMediaUrl = `media://file/${encodedPath}`;
                      const isActive = activeMedia && activeMedia.url === itemMediaUrl;
                      const isVideo = item.mediaType === 'video';
                      const isSelected = selectedSetlistMediaId === item.id;

                      // Show Play/Display button when selected/hovered and NOT active
                      if (!isActive) {
                        return (
                          <button
                            className={`setlist-hover-menu ${isSelected ? 'menu-open' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              stopAllTools();
                              handleDisplayMedia(item.mediaType as 'video' | 'image', item.mediaPath!);
                              setSelectedSetlistMediaId(null);
                            }}
                            style={{
                              background: isVideo ? 'rgba(6, 182, 212, 0.9)' : 'rgba(76, 175, 80, 0.9)',
                              color: 'white',
                              fontSize: '0.65rem',
                              fontWeight: 600,
                              padding: '3px 10px',
                              borderRadius: '4px',
                              marginLeft: '8px',
                              border: 'none',
                              cursor: 'pointer',
                              alignItems: 'center',
                              gap: '4px',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {isVideo ? (
                              <>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                  <polygon points="5 3 19 12 5 21 5 3" />
                                </svg>
                                {t('common.play')}
                              </>
                            ) : (
                              <>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                  <circle cx="8.5" cy="8.5" r="1.5"/>
                                  <polyline points="21 15 16 10 5 21"/>
                                </svg>
                                {t('media.display')}
                              </>
                            )}
                          </button>
                        );
                      }

                      // Show Playing/Showing indicator when active (with hover-to-stop)
                      if (isActive) {
                        const isStopHovered = hoveredMediaStopId === item.id;
                        return (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMedia(null);
                              window.electronAPI.clearMedia();
                            }}
                            onMouseEnter={() => setHoveredMediaStopId(item.id)}
                            onMouseLeave={() => setHoveredMediaStopId(null)}
                            style={{
                              background: isStopHovered ? '#dc3545' : (isVideo ? '#32c864' : '#4CAF50'),
                              color: 'white',
                              fontSize: '0.6rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              marginLeft: '8px',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              animation: isStopHovered ? 'none' : 'pulse 1.5s ease-in-out infinite',
                              transition: 'background 0.15s'
                            }}
                          >
                            {isStopHovered ? (
                              <>
                                <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                                  <rect x="4" y="4" width="16" height="16" rx="2" />
                                </svg>
                                {t('common.stop').toUpperCase()}
                              </>
                            ) : isVideo ? (
                              <>
                                <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                                  <polygon points="5 3 19 12 5 21 5 3" />
                                </svg>
                                {t('common.playing').toUpperCase()}
                              </>
                            ) : (
                              <>
                                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                </svg>
                                {t('common.showing').toUpperCase()}
                              </>
                            )}
                          </button>
                        );
                      }

                      return null;
                    })()}
                    {/* YouTube: Play button when selected or hovered (not playing) / Playing indicator with stop */}
                    {item.type === 'youtube' && item.youtubeVideoId && (() => {
                      const isPlaying = youtubeOnDisplay && activeYoutubeVideo?.videoId === item.youtubeVideoId;
                      const isSelected = selectedYoutubeItemId === item.id;

                      // Show Play button when selected/hovered and NOT playing
                      if (!isPlaying) {
                        return (
                          <button
                            className={`setlist-hover-menu ${isSelected ? 'menu-open' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              stopAllTools();
                              setActiveAudio(null);
                              setActiveAudioSetlistId(null); // Clear audio setlist tracking
                              handleYoutubeDisplay({
                                videoId: item.youtubeVideoId!,
                                title: item.youtubeTitle || 'YouTube Video',
                                thumbnail: item.youtubeThumbnail || `https://img.youtube.com/vi/${item.youtubeVideoId}/mqdefault.jpg`
                              });
                              setSelectedYoutubeItemId(null);
                            }}
                            style={{
                              background: 'rgba(255, 0, 0, 0.9)',
                              color: 'white',
                              fontSize: '0.65rem',
                              fontWeight: 600,
                              padding: '3px 10px',
                              borderRadius: '4px',
                              marginLeft: '8px',
                              border: 'none',
                              cursor: 'pointer',
                              alignItems: 'center',
                              gap: '4px',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                              <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                            {t('common.play')}
                          </button>
                        );
                      }

                      // Show Playing indicator when playing (with hover-to-stop)
                      if (isPlaying) {
                        const isStopHovered = hoveredMediaStopId === item.id;
                        return (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleYoutubeStop();
                            }}
                            onMouseEnter={() => setHoveredMediaStopId(item.id)}
                            onMouseLeave={() => setHoveredMediaStopId(null)}
                            style={{
                              background: isStopHovered ? '#dc3545' : '#FF0000',
                              color: 'white',
                              fontSize: '0.6rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              marginLeft: '8px',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'background 0.15s'
                            }}
                          >
                            {isStopHovered ? (
                              <>
                                <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                                  <rect x="4" y="4" width="16" height="16" rx="2" />
                                </svg>
                                {t('common.stop').toUpperCase()}
                              </>
                            ) : (
                              <>
                                <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                                  <polygon points="5 3 19 12 5 21 5 3" />
                                </svg>
                                {t('common.playing').toUpperCase()}
                              </>
                            )}
                          </button>
                        );
                      }

                      return null;
                    })()}
                    {activeToolId === item.id && (
                      <span style={{
                        background: '#00d4ff',
                        color: '#000',
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        marginLeft: '8px',
                        animation: 'pulse 1.5s ease-in-out infinite'
                      }}>
                        ACTIVE
                      </span>
                    )}
                    {/* 3-dot menu for song and bible items - uses CSS hover for instant response */}
                    {(item.type === 'song' || item.type === 'bible') && (
                      <div
                        className={`setlist-hover-menu ${setlistMenuOpen === item.id ? 'menu-open' : ''}`}
                        style={{ position: 'relative', marginLeft: '8px' }}
                      >
                        <button
                          className={`setlist-menu-btn ${setlistMenuOpen === item.id ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSetlistMenuOpen(setlistMenuOpen === item.id ? null : item.id);
                          }}
                        >
                          <span className="setlist-menu-dot" />
                          <span className="setlist-menu-dot" />
                          <span className="setlist-menu-dot" />
                        </button>
                        {setlistMenuOpen === item.id && (
                          <div
                            className="setlist-menu-dropdown"
                            onClick={(e) => e.stopPropagation()}
                            dir={isRTL ? 'rtl' : 'ltr'}
                          >
                            {/* Edit button - only for songs */}
                            {item.type === 'song' && item.song && (
                              <button
                                className="setlist-menu-item"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditingSong(item.song);
                                  setSetlistMenuOpen(null);
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                                {t('controlPanel.edit')}
                              </button>
                            )}
                            {/* Divider - only show if edit button exists */}
                            {item.type === 'song' && item.song && (
                              <div className="setlist-menu-divider" />
                            )}
                            {/* Remove button */}
                            <button
                              className="setlist-menu-item danger"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFromSetlist(item.id);
                                setSetlistMenuOpen(null);
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                              {t('controlPanel.removeFromSetlist')}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Expanded track list for audio playlists */}
                  {item.type === 'audioPlaylist' && item.audioPlaylist && expandedPlaylistIds.has(item.id) && (
                    <div
                      data-playlist-expanded
                      style={{
                      marginLeft: '30px',
                      borderLeft: '2px solid rgba(255, 152, 0, 0.3)',
                      background: 'rgba(0,0,0,0.2)'
                    }}>
                      {item.audioPlaylist.tracks.map((track, trackIndex) => {
                        const isCurrentTrack = activePlaylistId === item.id &&
                          activePlaylistOrder[activePlaylistIndex] === trackIndex;
                        return (
                          <div
                            key={trackIndex}
                            onClick={(e) => {
                              e.stopPropagation();
                              startPlaylist(item, trackIndex);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '8px 12px',
                              cursor: 'pointer',
                              background: isCurrentTrack ? 'rgba(255, 152, 0, 0.2)' : 'transparent',
                              borderBottom: '1px solid rgba(255,255,255,0.05)',
                              borderLeft: isCurrentTrack ? '3px solid #FF9800' : '3px solid transparent',
                              transition: 'background 0.15s'
                            }}
                            onMouseEnter={(e) => {
                              if (!isCurrentTrack) {
                                e.currentTarget.style.background = 'rgba(255, 152, 0, 0.1)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isCurrentTrack) {
                                e.currentTarget.style.background = 'transparent';
                              }
                            }}
                          >
                            {/* Track number */}
                            <span style={{
                              color: isCurrentTrack ? '#FF9800' : 'rgba(255,255,255,0.4)',
                              fontSize: '0.7rem',
                              minWidth: '24px',
                              marginRight: '8px'
                            }}>
                              {trackIndex + 1}
                            </span>
                            {/* Music note icon */}
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke={isCurrentTrack ? '#FF9800' : 'rgba(255,255,255,0.5)'}
                              strokeWidth="2"
                              style={{ marginRight: '8px', flexShrink: 0 }}
                            >
                              <path d="M9 18V5l12-2v13" />
                              <circle cx="6" cy="18" r="3" />
                              <circle cx="18" cy="16" r="3" />
                            </svg>
                            {/* Track name */}
                            <span style={{
                              flex: 1,
                              color: isCurrentTrack ? '#FF9800' : 'white',
                              fontSize: '0.8rem',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              fontWeight: isCurrentTrack ? 600 : 400
                            }}>
                              {track.name}
                            </span>
                            {/* Playing indicator */}
                            {isCurrentTrack && (
                              <span style={{
                                color: '#FF9800',
                                fontSize: '0.65rem',
                                fontWeight: 600,
                                marginLeft: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" style={{ animation: 'pulse 1s ease-in-out infinite' }}>
                                  <polygon points="5 3 19 12 5 21 5 3" />
                                </svg>
                                Playing
                              </span>
                            )}
                            {/* Duration if available */}
                            {track.duration && (
                              <span style={{
                                color: 'rgba(255,255,255,0.4)',
                                fontSize: '0.7rem',
                                marginLeft: '8px'
                              }}>
                                {Math.floor(track.duration / 60)}:{String(Math.floor(track.duration % 60)).padStart(2, '0')}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                    </React.Fragment>
                    );
                  })
                })()
              )}
            </div>
          </div>

          {/* Resize Handle - Setlist/Preview */}
          <div
            onMouseDown={(e) => startResize('setlist', e)}
            className="resize-handle-vertical"
            style={{
              width: '12px',
              cursor: 'col-resize',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <div style={{ width: '3px', height: '40px', background: isResizing === 'setlist' ? '#06b6d4' : 'rgba(255,255,255,0.15)', borderRadius: '2px', transition: 'background 0.15s, width 0.15s' }} />
          </div>

          {/* Right Column - Live Preview (remaining space) */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', overflow: 'hidden', minWidth: 0 }}>
          {/* Live Preview Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: 'white', fontWeight: 600 }}>{t('controlPanel.livePreview')}</span>
              {selectedSong && (
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>
                  — {selectedSong.title}
                </span>
              )}
              {currentSlide?.verseType && (
                <span style={{ fontSize: '0.65rem', padding: '2px 8px', background: getVerseTypeColor(currentSlide.verseType), borderRadius: '10px', color: 'white', fontWeight: 600 }}>{currentSlide.verseType}</span>
              )}
            </div>
          </div>

          {/* Main Preview Screen - Live capture from viewer window */}
          {/* Use connected viewer display's aspect ratio, or 16:9 as default */}
          {(() => {
            const viewerDisplay = displays.find(d => d.assignedType === 'viewer');
            const arWidth = viewerDisplay ? viewerDisplay.bounds.width : 16;
            const arHeight = viewerDisplay ? viewerDisplay.bounds.height : 9;
            const aspectRatio = `${arWidth} / ${arHeight}`;
            return (
          <div style={{ flex: 1, padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, overflow: 'hidden', containerType: 'size' } as React.CSSProperties}>
            <div
              style={{
                width: `min(100%, calc(100cqh * ${arWidth} / ${arHeight}))`,
                height: `min(100%, calc(100cqw * ${arHeight} / ${arWidth}))`,
                aspectRatio,
                background: '#000',
                borderRadius: '8px',
                position: 'relative',
                overflow: 'hidden',
                border: isBlank ? '3px solid #dc3545' : `3px solid ${getVerseTypeColor(currentSlide?.verseType) || 'rgba(255,255,255,0.2)'}`
              }}
            >
              {/* Status indicator */}
              <div style={{
                position: 'absolute',
                top: '8px',
                right: '10px',
                background: activeMedia ? '#06b6d4' : (youtubeOnDisplay || selectedYoutubeItemId) ? '#FF0000' : (selectedPresentation || currentSlide || isBlank) ? '#28a745' : (onlineConnected ? '#28a745' : '#6c757d'),
                color: 'white',
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '4px',
                letterSpacing: '1px',
                zIndex: 10
              }}>
                {activeMedia ? 'MEDIA' :
                  youtubeOnDisplay ? 'YOUTUBE' :
                  selectedYoutubeItemId ? 'YOUTUBE' :
                  selectedPresentation ? 'PRESENTATION' :
                  (currentSlide || isBlank) ? (currentContentType === 'song' ? 'SONG' : currentContentType === 'bible' ? 'BIBLE' : 'CONTENT') :
                  onlineConnected ? 'ONLINE' : 'NO CONTENT'}
              </div>

              {/* YouTube display */}
              {youtubeOnDisplay && activeYoutubeVideo ? (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: '#000'
                }}>
                  {/* Embedded YouTube Player - using IFrame API for sync control */}
                  <div
                    ref={youtubeContainerRef}
                    style={{
                      width: '100%',
                      height: '100%'
                    }}
                  />
                  {/* Status indicator */}
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    left: '10px',
                    background: '#FF0000',
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    letterSpacing: '1px',
                    zIndex: 10
                  }}>
                    YOUTUBE
                  </div>

                  {/* Stop YouTube button */}
                  <button
                    onClick={handleYoutubeStop}
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
                      color: 'white',
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
                </div>
              ) : activeMedia ? (
                /* Fullscreen media display */
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
                  direction: 'ltr' // Always left-to-right for media controls
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
                      autoPlay
                      controls
                      onTimeUpdate={(e) => {
                        const video = e.currentTarget;
                        const now = Date.now();
                        // Throttle state updates to reduce re-renders
                        if (now - lastVideoTimeUpdateRef.current >= TIME_UPDATE_THROTTLE_MS) {
                          lastVideoTimeUpdateRef.current = now;
                          setVideoStatus(prev => ({
                            ...prev,
                            currentTime: video.currentTime,
                            duration: video.duration || 0
                          }));
                        }
                      }}
                      onPlay={() => {
                        setVideoStatus(prev => ({ ...prev, isPlaying: true }));
                        // Also resume video on connected displays
                        window.electronAPI.resumeVideo();
                      }}
                      onPause={() => {
                        setVideoStatus(prev => ({ ...prev, isPlaying: false }));
                        // Also pause video on connected displays
                        window.electronAPI.pauseVideo();
                      }}
                      onSeeked={(e) => {
                        // Sync seek position to connected displays
                        const video = e.currentTarget;
                        window.electronAPI.seekVideo(video.currentTime);
                      }}
                    />
                  )}

                  {/* Clear Media button */}
                  <button
                    onClick={handleClearMedia}
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
                      color: 'white',
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
              ) : (
                /* Local slide preview - renders slide content directly without screen capture */
                /* Uses liveSlideData to only show what's actually being displayed, not staged content */
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
                  combinedSlides={displayMode === 'original' && combinedSlidesData ? (() => {
                    // Get the combined slide for the currently selected combined index
                    const currentCombined = combinedSlidesData.combinedSlides[selectedCombinedIndex];
                    if (!currentCombined || !('originalIndices' in currentCombined) || !Array.isArray(currentCombined.originalIndices) || currentCombined.originalIndices.length <= 1) {
                      return undefined;
                    }
                    // Return the second line(s) from the combined slide
                    return currentCombined.originalIndices.slice(1).map(idx => {
                      const slide = selectedSong?.slides?.[idx];
                      return slide ? { originalText: slide.originalText || '' } : null;
                    }).filter((s): s is { originalText: string } => s !== null);
                  })() : undefined}
                />
              )}
            </div>
          </div>
            );
          })()}
        </div>
        </div>{/* End of Top Row */}

        {/* Horizontal Resize Handle - Top/Bottom Rows */}
        <div
          onMouseDown={(e) => startResize('row', e)}
          className="resize-handle-horizontal"
          style={{
            height: '12px',
            cursor: 'row-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <div style={{ width: '40px', height: '3px', background: isResizing === 'row' ? '#06b6d4' : 'rgba(255,255,255,0.15)', borderRadius: '2px', transition: 'background 0.15s, height 0.15s' }} />
        </div>

        {/* Bottom Row - Slides Grid */}
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
            {selectedSong?.slides && (() => {
              const verseSections: Array<{ type: string; index: number }> = [];
              const seenTypes = new Set<string>();
              selectedSong.slides.forEach((slide, index) => {
                if (slide.verseType && !seenTypes.has(slide.verseType)) {
                  seenTypes.add(slide.verseType);
                  verseSections.push({ type: slide.verseType, index });
                }
              });

              const getAbbreviation = (verseType: string) => {
                switch(verseType) {
                  case 'Intro': return 'In';
                  case 'Verse1': return 'V1';
                  case 'Verse2': return 'V2';
                  case 'Verse3': return 'V3';
                  case 'Verse4': return 'V4';
                  case 'PreChorus': return 'PC';
                  case 'Chorus': return 'Ch';
                  case 'Bridge': return 'Br';
                  case 'Instrumental': return '🎸';
                  case 'Outro': return 'Out';
                  case 'Tag': return 'Tag';
                  default: return verseType?.substring(0, 2) || '?';
                }
              };

              // Hide for single section or Bible passages (numeric verse types like "1", "2", "3")
              const isBiblePassage = verseSections.length > 0 && verseSections.every(s => /^\d+$/.test(s.type));
              if (verseSections.length <= 1 || isBiblePassage) return null;

              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {verseSections.map((section, idx) => (
                    <button
                      key={idx}
                      onClick={() => selectSlide(section.index)}
                      title={section.type}
                      style={{
                        padding: '2px 6px',
                        fontSize: '0.7rem',
                        fontWeight: 'bold',
                        border: currentSlideIndex === section.index ? '2px solid white' : '1px solid rgba(255,255,255,0.4)',
                        borderRadius: '4px',
                        backgroundColor: getVerseTypeColor(section.type),
                        color: 'white',
                        cursor: 'pointer',
                        minWidth: '28px',
                        textAlign: 'center'
                      }}
                    >
                      {getAbbreviation(section.type)}
                    </button>
                  ))}
                </div>
              );
            })()}

            {/* Control Buttons */}
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <button
                onClick={toggleBlank}
                style={{
                  background: isBlank ? '#ffc107' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  color: isBlank ? '#000' : 'white',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.75rem'
                }}
              >
                {isBlank ? t('controlPanel.blankOn') : t('display.blank')}
              </button>
              <button
                onClick={() => {
                  setShowQuickSlideModal(true);
                  updateQuickSlideCount(quickSlideText);
                  setQuickSlideBroadcastIndex(-1);
                }}
                style={{
                  background: '#28a745',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.75rem'
                }}
              >
                ⚡ {t('controlPanel.quickMode')}
              </button>
              <button
                onClick={() => {
                  const newMode = displayMode === 'bilingual' ? 'original' : 'bilingual';
                  setDisplayMode(newMode);
                  // Clear the screen when switching display modes
                  setIsBlank(true);
                  setLiveState({ slideData: null, contentType: null, songId: null, slideIndex: 0 });
                  window.electronAPI.sendBlank();
                }}
                style={{
                  background: colors.button.info,
                  border: 'none',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.75rem'
                }}
              >
                {displayMode === 'original' ? t('controlPanel.original') : t('controlPanel.bilingual')}
              </button>

              {/* Background Button with Dropdown */}
              <div data-panel="background" style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowBackgroundDropdown(!showBackgroundDropdown)}
                  style={{
                    background: selectedBackground ? 'linear-gradient(135deg, #667eea, #764ba2)' : 'rgba(255,255,255,0.1)',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '5px 10px',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.75rem'
                  }}
                >
                  🖼️ {t('controlPanel.bg')}
                </button>

                {showBackgroundDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: isRTL ? 'auto' : 0,
                    left: isRTL ? 0 : 'auto',
                    marginTop: '8px',
                    background: 'rgba(30, 30, 50, 0.98)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    padding: '12px',
                    width: '280px',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    zIndex: 1000,
                    boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h4 style={{ margin: 0, color: 'white', fontSize: '0.9rem' }}>{t('controlPanel.backgrounds')}</h4>
                      {selectedBackground && (
                        <button
                          onClick={() => {
                            setSelectedBackground('');
                            handleSetBackground('');
                          }}
                          style={{
                            background: 'rgba(220, 53, 69, 0.2)',
                            border: '1px solid rgba(220, 53, 69, 0.4)',
                            borderRadius: '4px',
                            padding: '2px 8px',
                            color: '#dc3545',
                            fontSize: '0.7rem',
                            cursor: 'pointer'
                          }}
                        >
                          {t('common.clear')}
                        </button>
                      )}
                    </div>

                    {/* Gradients Grid */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '6px'
                    }}>
                      {gradientPresets.map(gradient => (
                        <div
                          key={gradient.id}
                          onClick={() => {
                            setSelectedBackground(gradient.value);
                            handleSetBackground(gradient.value);
                            setShowBackgroundDropdown(false);
                          }}
                          title={gradient.name}
                          style={{
                            aspectRatio: '16/9',
                            background: gradient.value,
                            borderRadius: '6px',
                            cursor: 'pointer',
                            border: selectedBackground === gradient.value
                              ? '2px solid #06b6d4'
                              : '2px solid transparent',
                            transition: 'all 0.15s ease',
                            boxShadow: selectedBackground === gradient.value
                              ? '0 0 8px rgba(6, 182, 212, 0.4)'
                              : 'none'
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Slides Grid */}
          {selectedPresentation ? (
            /* Presentation slides view */
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '8px',
              overflow: 'auto',
              flex: 1,
              alignContent: 'start'
            }}>
              {/* Wizard presentations (prayer/sermon) - show text lines like songs */}
              {(selectedPresentation.quickModeData?.type === 'prayer' || selectedPresentation.quickModeData?.type === 'sermon') ? (
                selectedPresentation.quickModeData.subtitles?.map((subtitle: any, idx: number) => {
                  const isSelected = liveSongId === selectedPresentation.id && liveSlideIndex === idx;
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setIsBlank(false);
                        sendPrayerPresentationSlide(selectedPresentation, idx, displayMode);
                        // Update staged state in transition (lower priority)
                        startTransition(() => {
                          setCurrentPresentationSlideIndex(idx);
                        });
                      }}
                      style={{
                        position: 'relative',
                        border: isSelected ? '3px solid #00d4ff' : '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '6px',
                        padding: '8px 10px',
                        paddingLeft: isSelected ? '14px' : '10px',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? 'rgba(0, 212, 255, 0.2)' : 'rgba(0,0,0,0.3)',
                        boxShadow: isSelected ? '0 0 12px rgba(0, 212, 255, 0.6)' : 'none'
                      }}
                    >
                      {/* Left accent bar for selected slide */}
                      {isSelected && (
                        <div style={{
                          position: 'absolute',
                          left: '0',
                          top: '0',
                          bottom: '0',
                          width: '4px',
                          background: 'linear-gradient(180deg, #00d4ff 0%, #0099ff 100%)',
                          borderRadius: '6px 0 0 6px'
                        }} />
                      )}
                      {/* Slide header */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: isSelected ? '#00d4ff' : 'rgba(255,255,255,0.7)',
                        fontWeight: 'bold',
                        marginBottom: '4px',
                        fontSize: '0.75rem'
                      }}>
                        {isSelected && <span style={{ fontSize: '0.7rem' }}>▶</span>}
                        <span>Point {idx + 1}</span>
                      </div>
                      {/* Slide content - show text lines like songs */}
                      <div style={{ fontSize: '0.85rem', lineHeight: '1.3', color: 'white' }}>
                        {/* Original/Hebrew text */}
                        {subtitle.subtitle && (
                          <div style={{ textAlign: 'right', direction: 'rtl' }}>
                            {subtitle.subtitle}
                          </div>
                        )}
                        {/* Description in Hebrew */}
                        {subtitle.description && subtitle.description !== subtitle.subtitle && (
                          <div style={{
                            marginTop: '4px',
                            paddingTop: '4px',
                            borderTop: '1px dashed rgba(255,255,255,0.2)',
                            color: 'rgba(255,255,255,0.6)',
                            fontSize: '0.75rem',
                            textAlign: 'right',
                            direction: 'rtl'
                          }}>
                            {subtitle.description}
                          </div>
                        )}
                        {/* Bible reference */}
                        {(subtitle.bibleRef?.hebrewReference || subtitle.bibleRef?.reference) && (
                          <div style={{
                            marginTop: '6px',
                            paddingTop: '4px',
                            borderTop: '1px solid rgba(6,182,212,0.3)',
                            color: '#06b6d4',
                            fontSize: '0.7rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '8px'
                          }}>
                            {subtitle.bibleRef?.hebrewReference && (
                              <span style={{ direction: 'rtl' }}>{subtitle.bibleRef.hebrewReference}</span>
                            )}
                            {subtitle.bibleRef?.reference && (
                              <span style={{ direction: 'ltr', opacity: 0.8 }}>{subtitle.bibleRef.reference}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                /* Free-form presentations - show thumbnails */
                <>
                  {/* Auto-play controls - only show if more than 1 slide */}
                  {selectedPresentation.slides.length > 1 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      marginBottom: '8px',
                      backgroundColor: 'rgba(0,0,0,0.3)',
                      borderRadius: '6px',
                      border: autoPlayActive ? '1px solid #00d4ff' : '1px solid rgba(255,255,255,0.1)'
                    }}>
                      <button
                        onClick={() => setAutoPlayActive(!autoPlayActive)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: autoPlayActive ? '#00d4ff' : 'rgba(255,255,255,0.1)',
                          color: autoPlayActive ? '#000' : '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          fontSize: '0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {autoPlayActive ? '⏸ Stop' : '▶ Auto'}
                      </button>
                      <select
                        value={autoPlayInterval}
                        onChange={(e) => setAutoPlayInterval(Number(e.target.value))}
                        style={{
                          padding: '5px 8px',
                          backgroundColor: '#2a2a2a',
                          color: '#fff',
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          cursor: 'pointer'
                        }}
                      >
                        <option value={2} style={{ backgroundColor: '#2a2a2a', color: '#fff' }}>2s</option>
                        <option value={3} style={{ backgroundColor: '#2a2a2a', color: '#fff' }}>3s</option>
                        <option value={5} style={{ backgroundColor: '#2a2a2a', color: '#fff' }}>5s</option>
                        <option value={7} style={{ backgroundColor: '#2a2a2a', color: '#fff' }}>7s</option>
                        <option value={10} style={{ backgroundColor: '#2a2a2a', color: '#fff' }}>10s</option>
                        <option value={15} style={{ backgroundColor: '#2a2a2a', color: '#fff' }}>15s</option>
                        <option value={20} style={{ backgroundColor: '#2a2a2a', color: '#fff' }}>20s</option>
                        <option value={30} style={{ backgroundColor: '#2a2a2a', color: '#fff' }}>30s</option>
                      </select>
                      {autoPlayActive && (
                        <span style={{
                          color: '#00d4ff',
                          fontSize: '0.7rem',
                          marginLeft: 'auto'
                        }}>
                          {currentPresentationSlideIndex + 1}/{selectedPresentation.slides.length}
                        </span>
                      )}
                    </div>
                  )}
                  {selectedPresentation.slides.map((slide, idx) => {
                  const isSelected = liveSongId === selectedPresentation.id && liveSlideIndex === idx;
                  return (
                    <div
                      key={slide.id}
                      onClick={() => {
                        // Update live state first for immediate preview update (atomic update)
                        setLiveState({ slideData: slide, contentType: 'presentation', songId: selectedPresentation.id, slideIndex: idx });
                        setIsBlank(false);
                        // Update staged state in transition (lower priority)
                        startTransition(() => {
                          setCurrentPresentationSlideIndex(idx);
                        });
                        // Send to display
                        window.electronAPI.sendSlide({
                          songId: selectedPresentation.id,
                          slideIndex: idx,
                          displayMode: 'bilingual',
                          isBlank: false,
                          songTitle: selectedPresentation.title,
                          presentationSlide: slide
                        });
                      }}
                      style={{
                        position: 'relative',
                        border: isSelected ? '3px solid #00d4ff' : '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '6px',
                        padding: '8px 10px',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? 'rgba(0, 212, 255, 0.2)' : 'rgba(0,0,0,0.3)',
                        boxShadow: isSelected ? '0 0 10px rgba(0, 212, 255, 0.5)' : 'none',
                        minHeight: '80px',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Slide header */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: isSelected ? '#00d4ff' : 'rgba(255,255,255,0.6)',
                        fontWeight: 'bold',
                        marginBottom: '6px',
                        fontSize: '0.7rem'
                      }}>
                        {isSelected && <span>▶</span>}
                        Slide {idx + 1}
                      </div>
                      {/* Mini preview of image and text boxes */}
                      <div style={{
                        position: 'relative',
                        width: '100%',
                        aspectRatio: '16 / 9',
                        background: slide.backgroundType === 'gradient' && slide.backgroundGradient
                          ? slide.backgroundGradient
                          : slide.backgroundType === 'transparent'
                          ? 'repeating-conic-gradient(#2a2a2a 0% 25%, #1a1a1a 0% 50%) 50% / 16px 16px'
                          : slide.backgroundColor || '#000',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        {/* Image boxes */}
                        {slide.imageBoxes?.map((imageBox: any) => (
                          <img
                            key={imageBox.id}
                            src={imageBox.src}
                            alt=""
                            style={{
                              position: 'absolute',
                              left: `${imageBox.x}%`,
                              top: `${imageBox.y}%`,
                              width: `${imageBox.width}%`,
                              height: `${imageBox.height}%`,
                              objectFit: imageBox.objectFit || 'contain',
                              opacity: imageBox.opacity ?? 1,
                              borderRadius: `${imageBox.borderRadius || 0}px`,
                              zIndex: imageBox.zIndex ?? 0
                            }}
                          />
                        ))}
                        {/* Text boxes */}
                        {slide.textBoxes.map((textBox: any) => (
                          <div
                            key={textBox.id}
                            style={{
                              position: 'absolute',
                              left: `${textBox.x}%`,
                              top: `${textBox.y}%`,
                              width: `${textBox.width}%`,
                              height: `${textBox.height}%`,
                              backgroundColor: textBox.backgroundColor || 'transparent',
                              display: 'flex',
                              alignItems: textBox.verticalAlign === 'top' ? 'flex-start' : textBox.verticalAlign === 'bottom' ? 'flex-end' : 'center',
                              overflow: 'hidden',
                              padding: '1px',
                              zIndex: textBox.zIndex ?? 0
                            }}
                          >
                            <span
                              dir={textBox.textDirection || 'ltr'}
                              style={{
                                width: '100%',
                                fontSize: '6px',
                                color: textBox.color || '#fff',
                                opacity: textBox.opacity ?? 1,
                                fontWeight: textBox.bold ? '700' : '400',
                                fontStyle: textBox.italic ? 'italic' : 'normal',
                                textAlign: textBox.textAlign,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                direction: textBox.textDirection || 'ltr'
                              }}
                            >
                              {textBox.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                </>
              )}
            </div>
          ) : selectedSong ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '8px',
              overflow: 'auto',
              flex: 1,
              alignContent: 'start'
            }}>
              {/* Combined slides view for original-only mode */}
              {/* Only show a slide as selected if it's on air and matches the current song */}
              {displayMode === 'original' && combinedSlidesData ? (
                combinedSlidesData.combinedSlides.map((item, combinedIndex) => (
                  <CombinedSlideGridItem
                    key={combinedIndex}
                    item={item}
                    combinedIndex={combinedIndex}
                    isSelected={selectedCombinedIndex === combinedIndex && !isBlank && liveSongId === selectedSong?.id}
                    bgColor={getVerseTypeColor(item.verseType || '')}
                    onSelect={selectCombinedSlide}
                  />
                ))
              ) : (
                /* Regular single-slide view for bilingual mode - using memoized SlideGridItem */
                /* Only show a slide as selected if it's on air and matches the current song */
                selectedSong.slides.map((slide, idx) => (
                  <SlideGridItem
                    key={idx}
                    slide={slide}
                    index={idx}
                    isSelected={idx === currentSlideIndex && !isBlank && liveSongId === selectedSong.id}
                    displayMode={displayMode}
                    bgColor={getVerseTypeColor(slide.verseType)}
                    onSelect={goToSlide}
                  />
                ))
              )}
            </div>
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255,255,255,0.3)',
              fontSize: '0.9rem'
            }}>
              {t('controlPanel.selectSongOrPresentation')}
            </div>
          )}
        </div>
      </main>

      {/* Save Modal */}
      {/* Section Title Modal */}
      {showSectionModal && (
        <div onClick={() => setShowSectionModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'rgba(30,30,50,0.98)', borderRadius: '16px', padding: '24px', minWidth: '350px', border: '1px solid rgba(255,255,255,0.2)' }}>
            <h3 style={{ color: 'white', marginBottom: '16px' }}>{t('controlPanel.addSection')}</h3>
            {/* Quick section buttons */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {[
                { key: 'Worship', label: t('controlPanel.sectionWorship') },
                { key: 'Sermon', label: t('controlPanel.sectionSermon') },
                { key: 'Prayer', label: t('controlPanel.sectionPrayer') },
                { key: 'Announcements', label: t('controlPanel.sectionAnnouncements') },
                { key: 'Reading', label: t('controlPanel.sectionReading') },
                { key: 'Offering', label: t('controlPanel.sectionOffering') },
                { key: 'Closing', label: t('controlPanel.sectionClosing') }
              ].map((section) => (
                <button
                  key={section.key}
                  onClick={() => {
                    if (sectionTitleRef.current) {
                      sectionTitleRef.current.value = section.label;
                      sectionTitleRef.current.focus();
                    }
                  }}
                  style={{
                    background: 'rgba(6,182,212,0.2)',
                    border: '1px solid rgba(6,182,212,0.4)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    color: '#06b6d4',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  {section.label}
                </button>
              ))}
            </div>
            <input
              ref={sectionTitleRef}
              type="text"
              placeholder={t('controlPanel.orTypeCustomSection')}
              defaultValue=""
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmAddSection();
                if (e.key === 'Escape') setShowSectionModal(false);
              }}
              autoFocus
              style={{ width: '100%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', padding: '12px', color: 'white', marginBottom: '16px' }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSectionModal(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', padding: '10px 20px', color: 'white', cursor: 'pointer' }}>{t('common.cancel')}</button>
              <button onClick={confirmAddSection} style={{ background: '#06b6d4', border: 'none', borderRadius: '8px', padding: '10px 20px', color: 'white', cursor: 'pointer' }}>{t('common.add')}</button>
            </div>
          </div>
        </div>
      )}

      {showSaveModal && (
        <div onClick={() => setShowSaveModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'rgba(30,30,50,0.98)', borderRadius: '16px', padding: '24px', minWidth: '400px', border: '1px solid rgba(255,255,255,0.2)' }}>
            <h3 style={{ color: 'white', marginBottom: '16px' }}>{t('controlPanel.saveSetlist')}</h3>
            <input
              ref={setlistNameRef}
              type="text"
              placeholder={t('controlPanel.setlistName')}
              defaultValue={currentSetlistName}
              onKeyDown={(e) => { if (e.key === 'Enter') saveSetlist(); }}
              autoFocus
              style={{ width: '100%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', padding: '12px', color: 'white', marginBottom: '8px' }}
            />
            <input
              ref={setlistVenueRef}
              type="text"
              placeholder={t('controlPanel.venueOptional')}
              defaultValue=""
              onKeyDown={(e) => { if (e.key === 'Enter') saveSetlist(); }}
              style={{ width: '100%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', padding: '12px', color: 'white', marginBottom: '16px' }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSaveModal(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', padding: '10px 20px', color: 'white', cursor: 'pointer' }}>{t('common.cancel')}</button>
              <button onClick={saveSetlist} style={{ background: colors.button.info, border: 'none', borderRadius: '8px', padding: '10px 20px', color: 'white', cursor: 'pointer' }}>{t('common.save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Load Modal */}
      {showLoadModal && (
        <div onClick={() => setShowLoadModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'rgba(30,30,50,0.98)', borderRadius: '16px', padding: '24px', minWidth: '400px', maxHeight: '80vh', overflow: 'auto', border: '1px solid rgba(255,255,255,0.2)' }}>
            <h3 style={{ color: 'white', marginBottom: '16px' }}>{t('controlPanel.loadSetlist')}</h3>
            {savedSetlists.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>{t('controlPanel.noSavedSetlists')}</p>
            ) : (
              savedSetlists.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).map((saved) => {
                const dateStr = saved.createdAt
                  ? new Date(saved.createdAt).toLocaleDateString()
                  : saved.updatedAt
                    ? new Date(saved.updatedAt).toLocaleDateString()
                    : '';
                const validDate = dateStr && dateStr !== 'Invalid Date' ? dateStr : '';
                return (
                <div key={saved.id} onClick={() => tryLoadSetlist(saved)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '8px', cursor: 'pointer' }}>
                  <div>
                    <div style={{ color: 'white', fontWeight: 600 }}>{saved.name}</div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>{validDate}{saved.venue && ` • ${saved.venue}`} • {saved.items?.length || 0} items</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); deleteSetlistById(saved.id); }} style={{ background: colors.button.danger, border: 'none', borderRadius: '6px', padding: '6px 12px', color: 'white', cursor: 'pointer', fontSize: '0.75rem' }}>{t('common.delete')}</button>
                </div>
              )})
            )}
            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowLoadModal(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', padding: '10px 20px', color: 'white', cursor: 'pointer' }}>{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Slide Modal */}
      {showQuickSlideModal && (
        <div onClick={() => {
          const currentText = getCurrentQuickSlideText();
          setQuickSlideText(currentText);
          setShowQuickSlideModal(false);
        }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'rgba(30,30,50,0.98)', borderRadius: '16px', padding: '24px', width: '600px', maxHeight: '80vh', overflow: 'auto', border: '1px solid rgba(255,255,255,0.2)' }}>
            <h3 style={{ color: 'white', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ⚡ {t('quickSlide.title')}
            </h3>

            {/* Instructions */}
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
              <strong style={{ color: 'white' }}>How to use:</strong>
              <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                <li>{t('controlPanel.slidesSeparatedByBlankLine')}</li>
                <li>Line 1: Original text (Hebrew)</li>
                <li>Line 2: Transliteration</li>
                <li>Line 3: Translation</li>
              </ul>
            </div>

            {/* Textarea */}
            <textarea
              ref={quickSlideTextareaRef}
              defaultValue={quickSlideText}
              onChange={(e) => updateQuickSlideCount(e.target.value)}
              placeholder={"Slide 1:\nהללויה\nHallelujah\nPraise the Lord\n\nSlide 2:\nשלום\nShalom\nPeace"}
              style={{
                width: '100%',
                height: '200px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                padding: '12px',
                color: 'white',
                fontSize: '1rem',
                fontFamily: 'monospace',
                lineHeight: '1.6',
                resize: 'vertical'
              }}
            />

            {/* Auto-generate button */}
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={autoGenerateQuickSlide}
                disabled={isAutoGenerating}
                style={{
                  background: isAutoGenerating ? 'rgba(255,255,255,0.1)' : '#6f42c1',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  color: 'white',
                  cursor: isAutoGenerating ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {isAutoGenerating ? (
                  <>
                    <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    Processing...
                  </>
                ) : (
                  <>✨ Auto-Generate</>
                )}
              </button>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>
                Fill transliteration & translation for Hebrew lines
              </span>
            </div>

            {/* Slide buttons */}
            {quickSlideCount > 0 && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>Click to broadcast:</span>
                  {Array.from({ length: quickSlideCount }, (_, idx) => (
                    <button
                      key={idx}
                      onClick={() => parseAndBroadcastQuickSlide(idx)}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        border: idx === quickSlideBroadcastIndex ? '2px solid #1e7e34' : '1px solid rgba(255,255,255,0.3)',
                        background: idx === quickSlideBroadcastIndex ? '#28a745' : 'rgba(255,255,255,0.1)',
                        color: 'white',
                        fontWeight: idx === quickSlideBroadcastIndex ? 700 : 400,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontSize: '1rem'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  const currentText = getCurrentQuickSlideText();
                  setQuickSlideText(currentText);
                  setShowQuickSlideModal(false);
                }}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', padding: '10px 24px', color: 'white', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Theme Type Selection Modal */}
      {showNewThemeModal && (
        <div onClick={() => setShowNewThemeModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'rgba(30,30,50,0.98)', borderRadius: '16px', padding: '24px', minWidth: '500px', maxWidth: '700px', border: '1px solid rgba(255,255,255,0.2)' }}>
            <h3 style={{ color: 'white', marginBottom: '20px', textAlign: 'center' }}>{t('controlPanel.createNewTheme')}</h3>
            <p style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginBottom: '24px', fontSize: '0.9rem' }}>
              {t('controlPanel.whatTypeOfTheme', 'What type of theme would you like to create?')}
            </p>
            {/* Main Themes Row */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  setShowNewThemeModal(false);
                  navigate('/theme-editor');
                }}
                style={{
                  background: colors.button.primary,
                  border: 'none',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  minWidth: '120px',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.4)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M8 21h8M12 17v4" />
                </svg>
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{t('controlPanel.songsTheme', 'Songs')}</span>
                <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{t('controlPanel.forSongLyrics', 'Song lyrics')}</span>
              </button>
              <button
                onClick={() => {
                  setShowNewThemeModal(false);
                  navigate('/stage-monitor-editor');
                }}
                style={{
                  background: 'linear-gradient(135deg, #f093fb, #f5576c)',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  minWidth: '120px',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(245, 87, 108, 0.4)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <circle cx="12" cy="10" r="3" />
                  <path d="M12 17v4M8 21h8" />
                </svg>
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{t('controlPanel.stageMonitor')}</span>
                <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{t('controlPanel.forPerformersOnStage', 'Stage view')}</span>
              </button>
              <button
                onClick={() => {
                  setShowNewThemeModal(false);
                  navigate('/bible-theme-editor');
                }}
                style={{
                  background: 'linear-gradient(135deg, #4CAF50, #2E7D32)',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  minWidth: '120px',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(76, 175, 80, 0.4)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{t('controlPanel.bibleTheme', 'Bible')}</span>
                <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{t('controlPanel.forBibleVerses', 'Bible verses')}</span>
              </button>
              <button
                onClick={() => {
                  setShowNewThemeModal(false);
                  navigate('/prayer-theme-editor');
                }}
                style={{
                  background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  minWidth: '120px',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(6, 182, 212, 0.4)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L12 6M12 18L12 22M4.93 4.93L7.76 7.76M16.24 16.24L19.07 19.07M2 12L6 12M18 12L22 12M4.93 19.07L7.76 16.24M16.24 7.76L19.07 4.93" />
                  <circle cx="12" cy="12" r="4" />
                </svg>
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{t('controlPanel.prayerTheme', 'Prayer')}</span>
                <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{t('controlPanel.forPrayerPoints', 'Prayer points')}</span>
              </button>
            </div>
            {/* OBS Themes Row */}
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <p style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: '12px', fontSize: '0.8rem' }}>
                {t('controlPanel.obsOverlayThemes', 'OBS Overlay Themes')}
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={() => {
                    setShowNewThemeModal(false);
                    navigate('/obs-songs-theme-editor');
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #17a2b8, #138496)',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '14px 18px',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    minWidth: '110px',
                    transition: 'transform 0.2s, box-shadow 0.2s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(23, 162, 184, 0.4)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polygon points="10 8 16 12 10 16 10 8" />
                  </svg>
                  <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>{t('controlPanel.obsSongs', 'OBS Songs')}</span>
                </button>
                <button
                  onClick={() => {
                    setShowNewThemeModal(false);
                    navigate('/obs-bible-theme-editor');
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #17a2b8, #138496)',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '14px 18px',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    minWidth: '110px',
                    transition: 'transform 0.2s, box-shadow 0.2s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(23, 162, 184, 0.4)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 12h8M12 8v8" />
                  </svg>
                  <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>{t('controlPanel.obsBible', 'OBS Bible')}</span>
                </button>
                <button
                  onClick={() => {
                    setShowNewThemeModal(false);
                    navigate('/obs-prayer-theme-editor');
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '14px 18px',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    minWidth: '110px',
                    transition: 'transform 0.2s, box-shadow 0.2s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(6, 182, 212, 0.4)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6M12 14v.01" />
                  </svg>
                  <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>{t('controlPanel.obsPrayer', 'OBS Prayer')}</span>
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
              <button onClick={() => setShowNewThemeModal(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', padding: '10px 24px', color: 'white', cursor: 'pointer' }}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* CSS for animations */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      {/* Template Selection Modal */}
      {showTemplateModal && (
        <div
          onClick={() => setShowTemplateModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#1a1a2e',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '600px',
              width: '90%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
            }}
          >
            <h2 style={{ margin: '0 0 8px 0', color: 'white', fontSize: '1.4rem' }}>
              New Presentation
            </h2>
            <p style={{ margin: '0 0 20px 0', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
              Choose a template to get started
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px'
            }}>
              {/* Blank Template */}
              <div
                onClick={() => {
                  setShowTemplateModal(false);
                  navigate('/presentation-editor', { state: { template: 'blank' } });
                }}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '2px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  padding: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.borderColor = 'rgba(6,182,212,0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>📄</div>
                <div style={{ color: 'white', fontWeight: 600, marginBottom: '4px' }}>{t('controlPanel.blank')}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>{t('controlPanel.startFromScratch')}</div>
              </div>

              {/* Sermon Points - launches quick wizard */}
              <div
                onClick={() => {
                  setShowTemplateModal(false);
                  setTimeout(() => {
                    resetQuickModeWizard(false);
                    setQuickModeType('sermon');
                    setQuickModeStep(2);
                    setShowQuickModeWizard(true);
                  }, 50);
                }}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '2px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  padding: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.borderColor = 'rgba(6,182,212,0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>📋</div>
                <div style={{ color: 'white', fontWeight: 600, marginBottom: '4px' }}>{t('controlPanel.sermonPoints')}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>{t('controlPanel.titleWithNumberedPoints')}</div>
              </div>

              {/* Prayer Points - launches quick wizard */}
              <div
                onClick={() => {
                  setShowTemplateModal(false);
                  setTimeout(() => {
                    resetQuickModeWizard(false);
                    setQuickModeType('prayer');
                    setQuickModeStep(2);
                    setShowQuickModeWizard(true);
                  }, 50);
                }}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '2px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  padding: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.borderColor = 'rgba(6,182,212,0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>🙏</div>
                <div style={{ color: 'white', fontWeight: 600, marginBottom: '4px' }}>{t('controlPanel.prayerPoints')}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>{t('controlPanel.bulletPointsForPrayer')}</div>
              </div>

              {/* Announcements - launches quick wizard */}
              <div
                onClick={() => {
                  setShowTemplateModal(false);
                  setTimeout(() => {
                    resetQuickModeWizard(false);
                    setQuickModeType('announcements');
                    setQuickModeStep(2);
                    setShowQuickModeWizard(true);
                  }, 50);
                }}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '2px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  padding: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.borderColor = 'rgba(6,182,212,0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>📢</div>
                <div style={{ color: 'white', fontWeight: 600, marginBottom: '4px' }}>{t('controlPanel.announcements')}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>{t('controlPanel.titleWithDetails')}</div>
              </div>
            </div>

            <button
              onClick={() => setShowTemplateModal(false)}
              style={{
                marginTop: '20px',
                width: '100%',
                padding: '12px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Quick Mode Wizard Modal */}
      {showQuickModeWizard && (
        <div
          onClick={() => resetQuickModeWizard()}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            onMouseDown={() => window.focus()}
            style={{
              background: '#1a1a2e',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '550px',
              width: '90%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
            }}
          >
            {/* Progress Indicator */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              {[1, 2, 3].map((step) => (
                <div
                  key={step}
                  style={{
                    flex: 1,
                    height: '4px',
                    borderRadius: '2px',
                    background: quickModeStep >= step ? '#00d4ff' : 'rgba(255,255,255,0.2)',
                    transition: 'background 0.3s'
                  }}
                />
              ))}
            </div>

            {/* Step 1: Select Type */}
            {quickModeStep === 1 && (
              <>
                <h2 style={{ margin: '0 0 8px 0', color: 'white', fontSize: '1.4rem' }}>
                  Select Presentation Type
                </h2>
                <p style={{ margin: '0 0 20px 0', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
                  Choose the type of presentation you want to create
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { type: 'sermon' as const, icon: '📋', label: 'Sermon Points', desc: 'Numbered points for sermon' },
                    { type: 'prayer' as const, icon: '🙏', label: 'Prayer Points', desc: 'Bullet points for prayer' },
                    { type: 'announcements' as const, icon: '📢', label: 'Announcements', desc: 'Announcements with details' }
                  ].map((item) => (
                    <div
                      key={item.type}
                      onClick={() => {
                        setQuickModeType(item.type);
                        setQuickModeStep(2);
                        // Ensure window has focus for input (Electron fix)
                        window.focus();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        padding: '16px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '2px solid rgba(255,255,255,0.1)',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(0,212,255,0.1)';
                        e.currentTarget.style.borderColor = 'rgba(0,212,255,0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                      }}
                    >
                      <div style={{ fontSize: '28px' }}>{item.icon}</div>
                      <div>
                        <div style={{ color: 'white', fontWeight: 600 }}>{item.label}</div>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Step 2: Enter Title */}
            {quickModeStep === 2 && (
              <>
                <h2 style={{ margin: '0 0 8px 0', color: 'white', fontSize: '1.4rem' }}>
                  Enter Main Title
                </h2>
                <p style={{ margin: '0 0 20px 0', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
                  This title will appear on all slides
                </p>
                <input
                  ref={quickModeTitleInputRef}
                  type="text"
                  autoFocus
                  value={quickModeTitle}
                  onChange={(e) => setQuickModeTitle(e.target.value)}
                  placeholder={quickModeType === 'sermon' ? 'e.g., Faith in Action' : quickModeType === 'prayer' ? 'e.g., Prayer Requests' : 'e.g., Church Updates'}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '1rem',
                    marginBottom: '20px',
                    // @ts-ignore - Electron-specific CSS
                    WebkitAppRegion: 'no-drag',
                    cursor: 'text'
                  }}
                  onClick={(e) => {
                    // Ensure focus on click (Electron focus fix)
                    e.currentTarget.focus();
                    window.focus();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && quickModeTitle.trim()) {
                      setQuickModeStep(3);
                    }
                  }}
                />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => setQuickModeStep(1)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      color: 'rgba(255,255,255,0.7)',
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setQuickModeStep(3)}
                    disabled={!quickModeTitle.trim()}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: quickModeTitle.trim() ? '#00d4ff' : 'rgba(0,212,255,0.3)',
                      border: 'none',
                      borderRadius: '8px',
                      color: quickModeTitle.trim() ? 'black' : 'rgba(0,0,0,0.5)',
                      cursor: quickModeTitle.trim() ? 'pointer' : 'not-allowed',
                      fontSize: '0.9rem',
                      fontWeight: 600
                    }}
                  >
                    Next
                  </button>
                </div>
              </>
            )}

            {/* Step 3: Add Subtitles */}
            {quickModeStep === 3 && (
              <>
                <h2 style={{ margin: '0 0 8px 0', color: 'white', fontSize: '1.4rem' }}>
                  Add {quickModeType === 'sermon' ? 'Points' : quickModeType === 'prayer' ? 'Prayer Items' : 'Announcements'}
                </h2>
                <p style={{ margin: '0 0 16px 0', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
                  Each item becomes a slide. Main title: <strong style={{ color: '#00d4ff' }}>{quickModeTitle}</strong>
                </p>
                <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '16px' }}>
                  {quickModeSubtitles.map((item, index) => (
                    <div
                      key={index}
                      style={{
                        background: 'rgba(0,0,0,0.2)',
                        borderRadius: '8px',
                        padding: '12px',
                        marginBottom: '10px',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', minWidth: '60px' }}>
                          {quickModeType === 'sermon' ? `Point ${index + 1}` : `Slide ${index + 1}`}
                        </span>
                        {quickModeSubtitles.length > 1 && (
                          <button
                            onClick={() => {
                              // Handle Bible picker index when deleting subtitles
                              if (quickModeBiblePickerIndex !== null) {
                                if (quickModeBiblePickerIndex === index) {
                                  // Deleting the subtitle with open picker - close it
                                  setQuickModeBiblePickerIndex(null);
                                  setQuickModeBibleSearch('');
                                  quickModeBibleSearchRef.current = '';
                                  setQuickModeBibleVerses([]);
                                  setQuickModeBibleBook('');
                                  setQuickModeBibleChapter(null);
                                  setQuickModeVerseStart(null);
                                  setQuickModeVerseEnd(null);
                                  setQuickModeBibleNoMatch(false);
                                  setQuickModeBibleLoading(false);
                                  setQuickModeBibleIsHebrew(false);
                                } else if (quickModeBiblePickerIndex > index) {
                                  // Deleting a subtitle before the picker - decrement index
                                  setQuickModeBiblePickerIndex(quickModeBiblePickerIndex - 1);
                                }
                              }
                              setQuickModeSubtitles(quickModeSubtitles.filter((_, i) => i !== index));
                            }}
                            style={{
                              marginLeft: 'auto',
                              background: 'rgba(255,0,0,0.2)',
                              border: 'none',
                              borderRadius: '4px',
                              color: '#ff6b6b',
                              padding: '4px 8px',
                              cursor: 'pointer',
                              fontSize: '0.75rem'
                            }}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={item.subtitle}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          setQuickModeSubtitles(prev => prev.map((s, i) =>
                            i === index ? { ...s, subtitle: newValue } : s
                          ));
                        }}
                        placeholder={quickModeType === 'sermon' ? `${index + 1}. Enter point title` : 'Enter subtitle'}
                        style={{
                          width: '100%',
                          padding: '10px',
                          background: 'rgba(0,0,0,0.3)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          borderRadius: '6px',
                          color: 'white',
                          fontSize: '0.9rem',
                          marginBottom: '8px'
                        }}
                      />
                      <textarea
                        value={item.description}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          setQuickModeSubtitles(prev => prev.map((s, i) =>
                            i === index ? { ...s, description: newValue } : s
                          ));
                        }}
                        placeholder="Description (optional)"
                        rows={2}
                        style={{
                          width: '100%',
                          padding: '10px',
                          background: 'rgba(0,0,0,0.3)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '6px',
                          color: 'rgba(255,255,255,0.8)',
                          fontSize: '0.85rem',
                          resize: 'vertical'
                        }}
                      />

                      {/* Bible Reference Section */}
                      {item.bibleRef ? (
                        <div style={{
                          marginTop: '8px',
                          padding: '8px',
                          background: 'rgba(0,212,255,0.1)',
                          border: '1px solid rgba(0,212,255,0.3)',
                          borderRadius: '6px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ color: '#00d4ff', fontSize: '0.8rem', fontWeight: 600, direction: item.bibleRef.useHebrew ? 'rtl' : 'ltr' }}>
                              {'\u{1F4D6}'} {item.bibleRef.useHebrew ? (item.bibleRef.hebrewReference || item.bibleRef.reference) : item.bibleRef.reference}
                            </span>
                            <button
                              onClick={() => removeBibleRefFromSubtitle(index)}
                              style={{
                                background: 'rgba(255,0,0,0.2)',
                                border: 'none',
                                borderRadius: '4px',
                                color: '#ff6b6b',
                                padding: '2px 6px',
                                cursor: 'pointer',
                                fontSize: '0.7rem'
                              }}
                            >
                              Remove
                            </button>
                          </div>
                          <div style={{
                            fontSize: '0.75rem',
                            color: 'rgba(255,255,255,0.7)',
                            direction: item.bibleRef.useHebrew ? 'rtl' : 'ltr',
                            textAlign: item.bibleRef.useHebrew ? 'right' : 'left'
                          }}>
                            {(() => {
                              const displayText = item.bibleRef.useHebrew
                                ? (item.bibleRef.hebrewText || item.bibleRef.englishText || '')
                                : (item.bibleRef.englishText || item.bibleRef.hebrewText || '');
                              return displayText.length > 100
                                ? displayText.substring(0, 100) + '...'
                                : (displayText || 'No text available');
                            })()}
                          </div>
                        </div>
                      ) : quickModeBiblePickerIndex === index ? (
                        <div style={{
                          marginTop: '8px',
                          padding: '10px',
                          background: 'rgba(0,0,0,0.3)',
                          border: '1px solid rgba(0,212,255,0.3)',
                          borderRadius: '6px'
                        }}>
                          <div style={{ marginBottom: '8px' }}>
                            <input
                              type="text"
                              value={quickModeBibleSearch}
                              onChange={(e) => handleQuickModeBibleSearch(e.target.value)}
                              placeholder="e.g., John 3:16 or Psalms 23:1-6"
                              style={{
                                width: '100%',
                                padding: '8px',
                                background: 'rgba(0,0,0,0.3)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: '4px',
                                color: 'white',
                                fontSize: '0.85rem'
                              }}
                            />
                          </div>
                          {quickModeBooksLoading && (
                            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', textAlign: 'center', padding: '10px' }}>
                              Loading Bible books...
                            </div>
                          )}
                          {quickModeBibleLoading && (
                            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', textAlign: 'center' }}>
                              Loading verses...
                            </div>
                          )}
                          {!quickModeBooksLoading && bibleBooks.length === 0 && (
                            <div style={{ color: 'rgba(255,100,100,0.7)', fontSize: '0.8rem', textAlign: 'center', padding: '10px' }}>
                              <div>Failed to load Bible books.</div>
                              <button
                                onClick={async () => {
                                  setQuickModeBooksLoading(true);
                                  try {
                                    const books = await window.electronAPI.getBibleBooks();
                                    setBibleBooks((books || []) as BibleBook[]);
                                  } catch (error) {
                                    console.error('Error loading Bible books:', error);
                                  }
                                  setQuickModeBooksLoading(false);
                                }}
                                style={{
                                  marginTop: '8px',
                                  padding: '4px 12px',
                                  background: 'rgba(0,212,255,0.2)',
                                  border: '1px solid rgba(0,212,255,0.4)',
                                  borderRadius: '4px',
                                  color: '#00d4ff',
                                  cursor: 'pointer',
                                  fontSize: '0.8rem'
                                }}
                              >
                                Retry
                              </button>
                            </div>
                          )}
                          {quickModeBibleNoMatch && !quickModeBibleLoading && (
                            <div style={{ color: 'rgba(255,200,100,0.8)', fontSize: '0.8rem', textAlign: 'center', padding: '6px' }}>
                              No match found. Try: "John 3:16" or "Genesis 1:1-5"
                            </div>
                          )}
                          {quickModeBibleBook && quickModeBibleChapter && !quickModeBibleLoading && quickModeBibleVerses.length === 0 && (
                            <div style={{ color: 'rgba(255,200,100,0.8)', fontSize: '0.8rem', textAlign: 'center', padding: '6px' }}>
                              No verses found for {quickModeBibleBook} {quickModeBibleChapter}
                            </div>
                          )}
                          {quickModeBibleBook && quickModeBibleChapter && quickModeBibleVerses.length > 0 && (
                            <div>
                              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', marginBottom: '6px' }}>
                                {quickModeBibleBook} {quickModeBibleChapter} ({quickModeBibleVerses.length} verses)
                              </div>
                              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem' }}>From:</span>
                                  <select
                                    value={quickModeVerseStart || ''}
                                    onChange={(e) => {
                                      const newStart = e.target.value ? parseInt(e.target.value) : null;
                                      setQuickModeVerseStart(newStart);
                                      // Clear verse end if start is cleared or end is now invalid
                                      if (!newStart || (quickModeVerseEnd && quickModeVerseEnd <= newStart)) {
                                        setQuickModeVerseEnd(null);
                                      }
                                    }}
                                    style={{
                                      padding: '4px 8px',
                                      background: 'rgba(0,0,0,0.4)',
                                      border: '1px solid rgba(255,255,255,0.2)',
                                      borderRadius: '4px',
                                      color: 'white',
                                      fontSize: '0.8rem'
                                    }}
                                  >
                                    <option value="">{t('controlPanel.selectVerse')}</option>
                                    {quickModeBibleVerses.map(v => (
                                      <option key={v.verseNumber} value={v.verseNumber}>{v.verseNumber}</option>
                                    ))}
                                  </select>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem' }}>To (optional):</span>
                                  <select
                                    value={quickModeVerseEnd || ''}
                                    onChange={(e) => setQuickModeVerseEnd(e.target.value ? parseInt(e.target.value) : null)}
                                    style={{
                                      padding: '4px 8px',
                                      background: 'rgba(0,0,0,0.4)',
                                      border: '1px solid rgba(255,255,255,0.2)',
                                      borderRadius: '4px',
                                      color: 'white',
                                      fontSize: '0.8rem'
                                    }}
                                  >
                                    <option value="">{t('controlPanel.singleVerse')}</option>
                                    {quickModeBibleVerses
                                      .filter(v => !quickModeVerseStart || v.verseNumber > quickModeVerseStart)
                                      .map(v => (
                                        <option key={v.verseNumber} value={v.verseNumber}>{v.verseNumber}</option>
                                      ))}
                                  </select>
                                </div>
                              </div>
                              {quickModeVerseStart && (
                                <div style={{
                                  padding: '6px',
                                  background: 'rgba(0,0,0,0.2)',
                                  borderRadius: '4px',
                                  marginBottom: '8px',
                                  maxHeight: '80px',
                                  overflowY: 'auto'
                                }}>
                                  <div style={{
                                    fontSize: '0.75rem',
                                    color: 'rgba(255,255,255,0.8)',
                                    direction: quickModeBibleIsHebrew ? 'rtl' : 'ltr',
                                    textAlign: quickModeBibleIsHebrew ? 'right' : 'left'
                                  }}>
                                    {quickModeBibleVerses
                                      .filter(v => v.verseNumber >= quickModeVerseStart! && v.verseNumber <= (quickModeVerseEnd || quickModeVerseStart!))
                                      .map(v => quickModeBibleIsHebrew ? (v.hebrew || v.english || '') : (v.english || v.hebrew || ''))
                                      .filter(Boolean)
                                      .join(' ') || 'No text available'}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => {
                                setQuickModeBiblePickerIndex(null);
                                setQuickModeBibleSearch('');
                                quickModeBibleSearchRef.current = '';
                                setQuickModeBibleVerses([]);
                                setQuickModeBibleBook('');
                                setQuickModeBibleChapter(null);
                                setQuickModeVerseStart(null);
                                setQuickModeVerseEnd(null);
                                setQuickModeBibleNoMatch(false);
                                setQuickModeBibleLoading(false);
                                setQuickModeBibleIsHebrew(false);
                              }}
                              style={{
                                flex: 1,
                                padding: '6px',
                                background: 'transparent',
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: '4px',
                                color: 'rgba(255,255,255,0.7)',
                                cursor: 'pointer',
                                fontSize: '0.8rem'
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => addBibleRefToSubtitle(index)}
                              disabled={!quickModeVerseStart}
                              style={{
                                flex: 1,
                                padding: '6px',
                                background: quickModeVerseStart ? '#00d4ff' : 'rgba(0,212,255,0.3)',
                                border: 'none',
                                borderRadius: '4px',
                                color: quickModeVerseStart ? 'black' : 'rgba(0,0,0,0.5)',
                                cursor: quickModeVerseStart ? 'pointer' : 'not-allowed',
                                fontSize: '0.8rem',
                                fontWeight: 600
                              }}
                            >
                              Add Verse
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={async () => {
                            // Prevent multiple clicks while loading
                            if (quickModeBooksLoading) return;

                            // Load Bible books if not already loaded
                            if (bibleBooks.length === 0) {
                              setQuickModeBooksLoading(true);
                              try {
                                const books = await window.electronAPI.getBibleBooks();
                                setBibleBooks((books || []) as BibleBook[]);
                              } catch (error) {
                                console.error('Error loading Bible books:', error);
                              }
                              setQuickModeBooksLoading(false);
                            }

                            // Reset picker state when opening for a new subtitle
                            setQuickModeBibleSearch('');
                            quickModeBibleSearchRef.current = '';
                            setQuickModeBibleVerses([]);
                            setQuickModeBibleBook('');
                            setQuickModeBibleChapter(null);
                            setQuickModeVerseStart(null);
                            setQuickModeVerseEnd(null);
                            setQuickModeBibleNoMatch(false);
                            setQuickModeBibleLoading(false);
                            setQuickModeBibleIsHebrew(false);

                            setQuickModeBiblePickerIndex(index);
                          }}
                          style={{
                            marginTop: '8px',
                            width: '100%',
                            padding: '6px',
                            background: 'transparent',
                            border: '1px dashed rgba(0,212,255,0.4)',
                            borderRadius: '4px',
                            color: 'rgba(0,212,255,0.8)',
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                        >
                          + Add Bible Reference (optional)
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => {
                    setQuickModeSubtitles([...quickModeSubtitles, { subtitle: '', description: '' }]);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px dashed rgba(255,255,255,0.3)',
                    borderRadius: '8px',
                    color: 'rgba(255,255,255,0.7)',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    marginBottom: '16px'
                  }}
                >
                  + Add Another {quickModeType === 'sermon' ? 'Point' : 'Slide'}
                </button>

                {/* Generate Translation checkbox */}
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px',
                    background: 'rgba(0,212,255,0.1)',
                    border: '1px solid rgba(0,212,255,0.3)',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={quickModeGenerateTranslation}
                    onChange={(e) => setQuickModeGenerateTranslation(e.target.checked)}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer',
                      accentColor: '#00d4ff'
                    }}
                  />
                  <div>
                    <div style={{ color: 'white', fontSize: '0.9rem', fontWeight: 500 }}>
                      Generate English Translation
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>
                      Translate Hebrew text to English (bilingual slides)
                    </div>
                  </div>
                </label>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => setQuickModeStep(2)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      color: 'rgba(255,255,255,0.7)',
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
                  >
                    Back
                  </button>
                  <button
                    onClick={async () => {
                      // Filter out empty subtitles
                      const validSubtitles = quickModeSubtitles.filter(s => s.subtitle.trim());
                      if (validSubtitles.length === 0 || !quickModeType || !quickModeTitle.trim()) return;

                      // Set creating state
                      setQuickModeCreating(true);

                      try {
                        // Generate presentation name with translated label
                        const typeLabel = quickModeType === 'sermon' ? t('quickMode.sermonLabel') : quickModeType === 'prayer' ? t('quickMode.prayerLabel') : t('quickMode.announcementsLabel');
                        const presentationName = `${typeLabel}: ${quickModeTitle}`;

                        // Prepare subtitles with translations if needed
                        let translatedSubtitles = validSubtitles.map(s => ({
                          subtitle: s.subtitle,
                          subtitleTranslation: s.subtitleTranslation,
                          description: s.description,
                          descriptionTranslation: s.descriptionTranslation,
                          bibleRef: s.bibleRef
                        }));
                        let titleTranslation: string | undefined;

                        // Generate translations if enabled
                        let translationFailures = 0;
                        if (quickModeGenerateTranslation) {
                          // Translate title if Hebrew
                          if (containsHebrew(quickModeTitle.trim())) {
                            try {
                              const translation = await window.electronAPI.translate(quickModeTitle.trim());
                              if (translation && translation !== quickModeTitle.trim()) {
                                titleTranslation = translation;
                              }
                            } catch (err) {
                              console.error('Failed to translate title:', err);
                              translationFailures++;
                            }
                          }

                          // Translate each subtitle and description if Hebrew
                          translatedSubtitles = await Promise.all(
                            validSubtitles.map(async (item) => {
                              let subtitleTranslation: string | undefined = item.subtitleTranslation;
                              let descriptionTranslation: string | undefined = item.descriptionTranslation;

                              if (containsHebrew(item.subtitle) && !item.subtitleTranslation) {
                                try {
                                  const translation = await window.electronAPI.translate(item.subtitle);
                                  if (translation && translation !== item.subtitle) {
                                    subtitleTranslation = translation;
                                  }
                                } catch (err) {
                                  console.error('Failed to translate subtitle:', err);
                                  translationFailures++;
                                }
                              }

                              if (item.description && containsHebrew(item.description) && !item.descriptionTranslation) {
                                try {
                                  const translation = await window.electronAPI.translate(item.description);
                                  if (translation && translation !== item.description) {
                                    descriptionTranslation = translation;
                                  }
                                } catch (err) {
                                  console.error('Failed to translate description:', err);
                                  translationFailures++;
                                }
                              }

                              return {
                                subtitle: item.subtitle,
                                subtitleTranslation,
                                description: item.description,
                                descriptionTranslation,
                                bibleRef: item.bibleRef
                              };
                            })
                          );

                          // Notify user if some translations failed
                          if (translationFailures > 0) {
                            alert(`${translationFailures} translation(s) failed. The presentation was created with placeholder text where translations could not be generated.`);
                          }
                        }

                        // Build Quick Mode data with translations
                        const quickModeData: QuickModeDataForSlides = {
                          type: quickModeType,
                          title: quickModeTitle.trim(),
                          titleTranslation,
                          subtitles: translatedSubtitles,
                          generateTranslation: quickModeGenerateTranslation
                        };

                        // Create slides
                        const slides = createQuickModeSlides(quickModeData);

                        // Save presentation directly to database
                        const presentationData = {
                          title: presentationName,
                          slides: slides,
                          canvasDimensions: { width: 1920, height: 1080 },
                          quickModeData: {
                            type: quickModeData.type,
                            title: quickModeData.title,
                            titleTranslation: quickModeData.titleTranslation,
                            generateTranslation: quickModeGenerateTranslation,
                            subtitles: translatedSubtitles
                          }
                        };

                        await window.electronAPI.createPresentation(presentationData);

                        // Close modal and reset wizard (reset state first to prevent stuck button)
                        setQuickModeCreating(false);
                        resetQuickModeWizard();

                      } catch (error) {
                        console.error('Failed to create presentation:', error);
                        setQuickModeCreating(false);
                      }
                    }}
                    disabled={!quickModeSubtitles.some(s => s.subtitle.trim()) || quickModeCreating}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: (!quickModeSubtitles.some(s => s.subtitle.trim()) || quickModeCreating) ? 'rgba(0,212,255,0.3)' : '#00d4ff',
                      border: 'none',
                      borderRadius: '8px',
                      color: (!quickModeSubtitles.some(s => s.subtitle.trim()) || quickModeCreating) ? 'rgba(0,0,0,0.5)' : 'black',
                      cursor: (!quickModeSubtitles.some(s => s.subtitle.trim()) || quickModeCreating) ? 'not-allowed' : 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: 600
                    }}
                  >
                    {quickModeCreating ? 'Creating...' : `Create Presentation (${quickModeSubtitles.filter(s => s.subtitle.trim()).length} slides)`}
                  </button>
                </div>
              </>
            )}

            {/* Cancel button (only on step 1) */}
            {quickModeStep === 1 && (
              <button
                onClick={() => resetQuickModeWizard()}
                style={{
                  marginTop: '20px',
                  width: '100%',
                  padding: '12px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: 'rgba(255,255,255,0.7)',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Theme Editor Modal */}
      {showThemeEditor && editingTheme && (
        <div
          onClick={() => { setShowThemeEditor(false); setEditingTheme(null); }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(135deg, rgba(30,30,50,0.98), rgba(20,20,40,0.98))',
              borderRadius: '16px',
              padding: '24px',
              width: '500px',
              maxHeight: '80vh',
              overflow: 'auto',
              border: '1px solid rgba(255,255,255,0.2)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ color: 'white', margin: 0, fontSize: '1.2rem' }}>
                {editingTheme.id ? 'Edit Theme' : 'New Theme'}
              </h3>
              <button
                onClick={() => { setShowThemeEditor(false); setEditingTheme(null); }}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', padding: '4px 8px', color: 'white', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Theme Name */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', marginBottom: '6px' }}>{t('controlPanel.themeName')}</label>
              <input
                type="text"
                value={editingTheme.name}
                onChange={(e) => setEditingTheme({ ...editingTheme, name: e.target.value })}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  padding: '10px',
                  color: 'white',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            {/* Background Color */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', marginBottom: '6px' }}>{t('controlPanel.backgroundColor')}</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="color"
                  value={editingTheme.viewerBackground.color}
                  onChange={(e) => setEditingTheme({
                    ...editingTheme,
                    viewerBackground: { ...editingTheme.viewerBackground, color: e.target.value }
                  })}
                  style={{ width: '50px', height: '36px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                />
                <input
                  type="text"
                  value={editingTheme.viewerBackground.color}
                  onChange={(e) => setEditingTheme({
                    ...editingTheme,
                    viewerBackground: { ...editingTheme.viewerBackground, color: e.target.value }
                  })}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    padding: '8px',
                    color: 'white',
                    fontSize: '0.85rem',
                    fontFamily: 'monospace'
                  }}
                />
              </div>
            </div>

            {/* Line Styles */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', marginBottom: '10px' }}>{t('controlPanel.lineStyles')}</label>
              {(['original', 'transliteration', 'translation'] as const).map((lineType) => (
                <div key={lineType} style={{ marginBottom: '12px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                  <div style={{ color: 'white', fontSize: '0.85rem', marginBottom: '8px', textTransform: 'capitalize' }}>{lineType}</div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '100px' }}>
                      <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', marginBottom: '4px' }}>{t('controlPanel.fontSize')}</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="range"
                          min="50"
                          max="150"
                          value={editingTheme.lineStyles[lineType].fontSize}
                          onChange={(e) => setEditingTheme({
                            ...editingTheme,
                            lineStyles: {
                              ...editingTheme.lineStyles,
                              [lineType]: { ...editingTheme.lineStyles[lineType], fontSize: parseInt(e.target.value) }
                            }
                          })}
                          style={{ flex: 1 }}
                        />
                        <span style={{ color: 'white', fontSize: '0.75rem', minWidth: '35px' }}>{editingTheme.lineStyles[lineType].fontSize}%</span>
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', marginBottom: '4px' }}>{t('controlPanel.color')}</label>
                      <input
                        type="color"
                        value={editingTheme.lineStyles[lineType].color}
                        onChange={(e) => setEditingTheme({
                          ...editingTheme,
                          lineStyles: {
                            ...editingTheme.lineStyles,
                            [lineType]: { ...editingTheme.lineStyles[lineType], color: e.target.value }
                          }
                        })}
                        style={{ width: '36px', height: '28px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', marginBottom: '4px' }}>{t('controlPanel.weight')}</label>
                      <select
                        value={editingTheme.lineStyles[lineType].fontWeight}
                        onChange={(e) => setEditingTheme({
                          ...editingTheme,
                          lineStyles: {
                            ...editingTheme.lineStyles,
                            [lineType]: { ...editingTheme.lineStyles[lineType], fontWeight: e.target.value }
                          }
                        })}
                        style={{
                          background: 'rgba(255,255,255,0.1)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          color: 'white',
                          fontSize: '0.75rem'
                        }}
                      >
                        <option value="300">{t('controlPanel.light')}</option>
                        <option value="400">{t('controlPanel.normal')}</option>
                        <option value="500">{t('controlPanel.medium')}</option>
                        <option value="600">{t('controlPanel.semiBold')}</option>
                        <option value="700">{t('controlPanel.bold')}</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Preview */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', marginBottom: '6px' }}>{t('controlPanel.preview')}</label>
              <div style={{
                background: editingTheme.viewerBackground.color,
                borderRadius: '8px',
                padding: '20px',
                textAlign: 'center',
                border: '1px solid rgba(255,255,255,0.2)'
              }}>
                <div style={{ fontSize: `${editingTheme.lineStyles.original.fontSize * 0.12}px`, color: editingTheme.lineStyles.original.color, fontWeight: editingTheme.lineStyles.original.fontWeight as any, marginBottom: '4px' }}>שלום עולם</div>
                <div style={{ fontSize: `${editingTheme.lineStyles.transliteration.fontSize * 0.12}px`, color: editingTheme.lineStyles.transliteration.color, fontWeight: editingTheme.lineStyles.transliteration.fontWeight as any, marginBottom: '4px' }}>{t('controlPanel.shalomOlam')}</div>
                <div style={{ fontSize: `${editingTheme.lineStyles.translation.fontSize * 0.12}px`, color: editingTheme.lineStyles.translation.color, fontWeight: editingTheme.lineStyles.translation.fontWeight as any }}>{t('controlPanel.helloWorld')}</div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowThemeEditor(false); setEditingTheme(null); }}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveTheme}
                disabled={!editingTheme.name.trim()}
                style={{
                  background: editingTheme.name.trim() ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 24px',
                  color: 'white',
                  cursor: editingTheme.name.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: 600
                }}
              >
                Save Theme
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Song Editor Modal */}
      {showSongEditor && editingSong && (
        <div
          onClick={() => { setShowSongEditor(false); setEditingSong(null); setSongEditorExpressMode(false); }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(135deg, rgba(30,30,50,0.98), rgba(20,20,40,0.98))',
              borderRadius: '16px',
              padding: '24px',
              width: '1000px',
              height: '85vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid rgba(255,255,255,0.2)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ color: 'white', margin: 0, fontSize: '1.2rem' }}>
                {editingSong.id ? 'Edit Song' : 'New Song'}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  onClick={toggleSongExpressMode}
                  style={{
                    background: songEditorExpressMode ? '#17a2b8' : 'rgba(255,255,255,0.1)',
                    border: songEditorExpressMode ? 'none' : '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 500
                  }}
                >
                  {songEditorExpressMode ? 'Standard Mode' : 'Express Mode ⚡'}
                </button>
                <button
                  onClick={() => { setShowSongEditor(false); setEditingSong(null); setSongEditorExpressMode(false); }}
                  style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', padding: '4px 8px', color: 'white', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Song Info Row */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
              <div style={{ flex: 2 }}>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginBottom: '4px' }}>Song Title *</label>
                <input
                  type="text"
                  value={editingSong.title}
                  onChange={(e) => setEditingSong({ ...editingSong, title: e.target.value })}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    padding: '10px',
                    color: 'white',
                    fontSize: '0.9rem'
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginBottom: '4px' }}>{t('controlPanel.author')}</label>
                <input
                  type="text"
                  value={editingSong.author}
                  onChange={(e) => setEditingSong({ ...editingSong, author: e.target.value })}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    padding: '10px',
                    color: 'white',
                    fontSize: '0.9rem'
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginBottom: '4px' }}>{t('controlPanel.language')}</label>
                <select
                  value={editingSong.originalLanguage}
                  onChange={(e) => setEditingSong({ ...editingSong, originalLanguage: e.target.value })}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    padding: '10px',
                    color: 'white',
                    fontSize: '0.9rem'
                  }}
                >
                  {songLanguages.map(lang => (
                    <option key={lang.code} value={lang.code}>{lang.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tags Row */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem' }}>Tags:</span>
                {editingSong.tags.map(tag => (
                  <span
                    key={tag}
                    onClick={() => removeSongTag(tag)}
                    style={{
                      background: colors.button.info,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      color: 'white',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {tag} <span style={{ opacity: 0.7 }}>✕</span>
                  </span>
                ))}
                <input
                  type="text"
                  placeholder="Add tag..."
                  value={songTagInput}
                  onChange={(e) => setSongTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSongTag(songTagInput); } }}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    padding: '4px 10px',
                    color: 'white',
                    fontSize: '0.75rem',
                    width: '100px'
                  }}
                />
              </div>
            </div>

            {/* Main Content Area */}
            {songEditorExpressMode ? (
              /* Express Mode Editor */
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{
                  padding: '12px',
                  background: 'rgba(23, 162, 184, 0.1)',
                  borderRadius: '8px',
                  marginBottom: '12px',
                  border: '1px solid rgba(23, 162, 184, 0.3)'
                }}>
                  <div style={{ color: '#17a2b8', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>{t('controlPanel.expressModeInstructions')}</div>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', lineHeight: 1.5 }}>
                    • Separate slides with a blank line<br/>
                    • Use [VerseType] markers: [Verse1], [Chorus], [Bridge], [Intro], etc.<br/>
                    {isTransliterationLanguage ? (
                      <>• Line 1: Original text, Line 2: Transliteration, Line 3: Translation, Line 4: Overflow</>
                    ) : (
                      <>• Each line becomes a lyric line for the slide</>
                    )}
                  </div>
                </div>
                <textarea
                  value={songEditorExpressText}
                  onChange={(e) => setSongEditorExpressText(e.target.value)}
                  placeholder={isTransliterationLanguage
                    ? "[Verse1]\nשָׁלוֹם עֲלֵיכֶם\nShalom Aleichem\nPeace be upon you\n\n[Chorus]\nמַלְאֲכֵי הַשָּׁרֵת\nMalachei HaShareit\nAngels of service"
                    : "[Verse1]\nAmazing grace, how sweet the sound\nThat saved a wretch like me\n\n[Chorus]\nI once was lost, but now I'm found\nWas blind, but now I see"
                  }
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    padding: '12px',
                    color: 'white',
                    fontSize: '0.95rem',
                    fontFamily: 'monospace',
                    resize: 'none',
                    direction: isTransliterationLanguage ? 'ltr' : 'ltr',
                    lineHeight: 1.6
                  }}
                />
              </div>
            ) : (
              /* Standard Mode Editor */
              <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0 }}>
                {/* Slide Navigator */}
                <div style={{ width: '130px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginBottom: '4px' }}>Slides ({editingSong.slides.length})</div>
                  <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {editingSong.slides.map((slide, idx) => (
                      <div
                        key={idx}
                        onClick={() => setEditingSlideIndex(idx)}
                        style={{
                          padding: '8px',
                          background: editingSlideIndex === idx ? 'rgba(102, 126, 234, 0.3)' : 'rgba(255,255,255,0.05)',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          border: editingSlideIndex === idx ? '1px solid #667eea' : '1px solid transparent',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <span style={{ color: 'white', fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {slide.verseType || 'Slide'} {idx + 1}
                        </span>
                        {editingSong.slides.length > 1 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); removeSlideFromEditingSong(idx); }}
                            style={{ background: 'transparent', border: 'none', color: '#dc3545', cursor: 'pointer', fontSize: '0.7rem', padding: '0 2px' }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={addSlideToEditingSong}
                    style={{
                      background: 'rgba(40, 167, 69, 0.3)',
                      border: '1px solid rgba(40, 167, 69, 0.5)',
                      borderRadius: '6px',
                      padding: '8px',
                      color: '#28a745',
                      cursor: 'pointer',
                      fontSize: '0.75rem'
                    }}
                  >
                    + Add Slide
                  </button>
                </div>

                {/* Slide Editor */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'auto' }}>
                  {/* Verse Type */}
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginBottom: '4px' }}>{t('controlPanel.verseType')}</label>
                      <select
                        value={editingSong.slides[editingSlideIndex]?.verseType || 'Verse'}
                        onChange={(e) => updateEditingSlide('verseType', e.target.value)}
                        style={{
                          width: '100%',
                          background: 'rgba(255,255,255,0.1)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '6px',
                          padding: '8px 12px',
                          color: 'white',
                          fontSize: '0.85rem'
                        }}
                      >
                        <option value="Intro">Intro</option>
                        <option value="Verse">Verse</option>
                        <option value="Verse1">Verse 1</option>
                        <option value="Verse2">Verse 2</option>
                        <option value="Verse3">Verse 3</option>
                        <option value="Verse4">Verse 4</option>
                        <option value="PreChorus">Pre-Chorus</option>
                        <option value="Chorus">Chorus</option>
                        <option value="Bridge">Bridge</option>
                        <option value="Instrumental">Instrumental</option>
                        <option value="Outro">Outro</option>
                        <option value="Tag">Tag</option>
                      </select>
                    </div>
                    {isTransliterationLanguage && (
                      <button
                        onClick={autoGenerateSlideContent}
                        style={{
                          background: 'rgba(102, 126, 234, 0.3)',
                          border: '1px solid rgba(102, 126, 234, 0.5)',
                          borderRadius: '6px',
                          padding: '8px 14px',
                          color: '#667eea',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Auto-Generate ⚡
                      </button>
                    )}
                  </div>

                  {/* Original Text */}
                  <div>
                    <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginBottom: '4px' }}>
                      {isTransliterationLanguage ? 'Original Text *' : 'Lyrics *'}
                    </label>
                    <textarea
                      value={editingSong.slides[editingSlideIndex]?.originalText || ''}
                      onChange={(e) => updateEditingSlide('originalText', e.target.value)}
                      style={{
                        width: '100%',
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '8px',
                        padding: '10px',
                        color: 'white',
                        fontSize: '1rem',
                        fontFamily: isTransliterationLanguage ? 'Arial, sans-serif' : 'inherit',
                        resize: 'vertical',
                        minHeight: '50px',
                        direction: isTransliterationLanguage ? 'rtl' : 'ltr',
                        textAlign: isTransliterationLanguage ? 'right' : 'left'
                      }}
                      placeholder={isTransliterationLanguage ? 'Enter original text...' : 'Enter lyrics...'}
                    />
                  </div>

                  {/* Transliteration / Line 2 */}
                  <div>
                    <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginBottom: '4px' }}>
                      {isTransliterationLanguage ? 'Transliteration' : 'Additional Lyrics'}
                    </label>
                    <textarea
                      value={editingSong.slides[editingSlideIndex]?.transliteration || ''}
                      onChange={(e) => updateEditingSlide('transliteration', e.target.value)}
                      style={{
                        width: '100%',
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '8px',
                        padding: '10px',
                        color: 'white',
                        fontSize: '0.9rem',
                        resize: 'vertical',
                        minHeight: '40px'
                      }}
                      placeholder={isTransliterationLanguage ? 'Enter transliteration...' : 'Additional lyrics...'}
                    />
                  </div>

                  {/* Translation / Line 3 */}
                  <div>
                    <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginBottom: '4px' }}>
                      {isTransliterationLanguage ? 'Translation' : 'Additional Lyrics'}
                    </label>
                    <textarea
                      value={editingSong.slides[editingSlideIndex]?.translation || ''}
                      onChange={(e) => updateEditingSlide('translation', e.target.value)}
                      style={{
                        width: '100%',
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '8px',
                        padding: '10px',
                        color: 'white',
                        fontSize: '0.9rem',
                        resize: 'vertical',
                        minHeight: '40px'
                      }}
                      placeholder={isTransliterationLanguage ? 'Enter translation...' : 'Additional lyrics...'}
                    />
                  </div>

                  {/* Translation Overflow / Line 4 */}
                  <div>
                    <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginBottom: '4px' }}>
                      {isTransliterationLanguage ? 'Translation Overflow' : 'Additional Lyrics'}
                    </label>
                    <textarea
                      value={editingSong.slides[editingSlideIndex]?.translationOverflow || ''}
                      onChange={(e) => updateEditingSlide('translationOverflow', e.target.value)}
                      style={{
                        width: '100%',
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '8px',
                        padding: '10px',
                        color: 'white',
                        fontSize: '0.9rem',
                        resize: 'vertical',
                        minHeight: '40px'
                      }}
                      placeholder={isTransliterationLanguage ? 'Additional translation lines...' : 'Additional lyrics...'}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <button
                onClick={() => { setShowSongEditor(false); setEditingSong(null); setSongEditorExpressMode(false); }}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveSong}
                disabled={!editingSong.title.trim()}
                style={{
                  background: editingSong.title.trim() ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 24px',
                  color: 'white',
                  cursor: editingSong.title.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: 600
                }}
              >
                Save Song
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prayer/Sermon Express Editor Modal */}
      {showPrayerEditor && editingPrayerPresentation && (
        <div
          onClick={closePrayerEditor}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(135deg, rgba(30,30,50,0.98), rgba(20,20,40,0.98))',
              borderRadius: '16px',
              padding: '24px',
              width: '650px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid rgba(6,182,212,0.3)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>⚡</span> Edit {editingPrayerPresentation.quickModeData?.type === 'sermon' ? 'Sermon' : 'Prayer'} Points
              </h3>
              <button
                onClick={closePrayerEditor}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', padding: '4px 8px', color: 'white', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Title display */}
            <div style={{
              padding: '12px',
              background: 'rgba(6,182,212,0.1)',
              borderRadius: '8px',
              marginBottom: '12px',
              border: '1px solid rgba(6,182,212,0.3)'
            }}>
              <div style={{ color: '#06b6d4', fontSize: '0.85rem', fontWeight: 600 }}>
                {editingPrayerPresentation.title}
              </div>
            </div>

            {/* Instructions */}
            <div style={{
              padding: '12px',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '8px',
              marginBottom: '12px',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>Express Mode Instructions</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', lineHeight: 1.5 }}>
                • Separate points with a blank line<br/>
                • Hebrew/original text (main line)<br/>
                • ~English translation (prefix with ~)<br/>
                • --- then description text<br/>
                • @hebrewRef | englishRef for Bible reference
              </div>
            </div>

            {/* Text area */}
            <textarea
              value={prayerExpressText}
              onChange={(e) => setPrayerExpressText(e.target.value)}
              placeholder={"נקודה ראשונה בעברית\n~First point in English\n---\nתיאור נוסף\n@ישעיהו מ:לא | Isaiah 40:31\n\nנקודה שנייה\n~Second point\n---\nתיאור\n@תהילים כג:א | Psalm 23:1"}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                padding: '12px',
                color: 'white',
                fontSize: '0.95rem',
                fontFamily: 'monospace',
                resize: 'none',
                direction: 'rtl',
                minHeight: '250px'
              }}
            />

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <button
                onClick={closePrayerEditor}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={savePrayerPresentation}
                style={{
                  background: 'linear-gradient(135deg, #06b6d4 0%, #22d3ee 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 24px',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved Changes Warning Modal */}
      {showUnsavedWarning && (
        <div
          onClick={cancelUnsavedAction}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(135deg, rgba(30,30,50,0.98), rgba(20,20,40,0.98))',
              borderRadius: '16px',
              padding: '24px',
              minWidth: '350px',
              maxWidth: '450px',
              border: '1px solid rgba(255,193,7,0.4)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <span style={{ fontSize: '2rem' }}>⚠️</span>
              <h3 style={{ color: 'white', margin: 0, fontSize: '1.1rem' }}>{t('controlPanel.unsavedChanges')}</h3>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '20px', lineHeight: 1.5 }}>
              You have unsaved changes to your setlist. Are you sure you want to {pendingAction?.type === 'load' ? 'load a different setlist' : 'clear the setlist'}? Your changes will be lost.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={cancelUnsavedAction}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => setShowSaveModal(true)}
                style={{
                  background: colors.button.info,
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 600
                }}
              >
                Save First
              </button>
              <button
                onClick={confirmUnsavedAction}
                style={{
                  background: colors.button.danger,
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 600
                }}
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Help Modal */}
      {showKeyboardHelp && (
        <div
          onClick={() => setShowKeyboardHelp(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(135deg, rgba(30,30,50,0.98), rgba(20,20,40,0.98))',
              borderRadius: '16px',
              padding: '24px',
              minWidth: '400px',
              maxWidth: '500px',
              border: '1px solid rgba(255,255,255,0.2)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ color: 'white', margin: 0, fontSize: '1.2rem' }}>{t('controlPanel.keyboardShortcuts')}</h3>
              <button
                onClick={() => setShowKeyboardHelp(false)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { keys: ['→', '↓'], action: 'Next slide' },
                { keys: ['←', '↑'], action: 'Previous slide' },
                { keys: ['Space'], action: 'Toggle Bilingual/Original mode' },
                { keys: ['B'], action: 'Toggle blank screen' },
                { keys: ['Q'], action: 'Open Quick Slide' },
                { keys: ['?', 'F1'], action: 'Show this help' },
                { keys: ['Esc'], action: 'Close modals' }
              ].map((shortcut, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '8px'
                  }}
                >
                  <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem' }}>{shortcut.action}</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {shortcut.keys.map((key, kidx) => (
                      <kbd
                        key={kidx}
                        style={{
                          background: 'rgba(255,255,255,0.15)',
                          border: '1px solid rgba(255,255,255,0.3)',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          color: 'white',
                          fontSize: '0.8rem',
                          fontFamily: 'monospace',
                          minWidth: '28px',
                          textAlign: 'center'
                        }}
                      >
                        {key}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '16px', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>
              Press <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '3px' }}>Esc</kbd> to close
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onLoginSuccess={async () => {
            const state = await window.electronAPI.getAuthState();
            setAuthState({
              isAuthenticated: state.isAuthenticated,
              user: state.user,
              serverUrl: state.serverUrl
            });
            // Connect to online mode
            const connectResult = await window.electronAPI.connectWithAuth();
            if (connectResult.success) {
              const room = await window.electronAPI.createOnlineRoom();
              if (room) {
                setRoomPin(room.roomPin);
              }
            }
          }}
        />
      )}

      {/* Hidden audio element for background music */}
      {activeAudio && (
        <audio
          ref={audioRef}
          src={activeAudio.url}
          onCanPlay={() => {
            // Start playing with fade in when audio is ready
            if (audioNeedsInitialPlay.current) {
              audioNeedsInitialPlay.current = false;
              audioEndFadingRef.current = false; // Reset end fade flag
              if (audioRef.current) {
                audioRef.current.volume = 0;
              }
              fadeInAudio();
            }
          }}
          onTimeUpdate={(e) => {
            const audio = e.currentTarget;
            const duration = audio.duration || 0;
            const currentTime = audio.currentTime;

            // Throttle state updates to reduce re-renders (but always check for end fade)
            const now = Date.now();
            if (now - lastAudioTimeUpdateRef.current >= TIME_UPDATE_THROTTLE_MS) {
              lastAudioTimeUpdateRef.current = now;
              setAudioStatus(prev => ({
                ...prev,
                currentTime,
                duration
              }));
            }

            // Fade out when approaching end (last 0.5 seconds) - only trigger once
            if (duration > 0 && currentTime >= duration - 0.5 && !audioEndFadingRef.current) {
              audioEndFadingRef.current = true;
              fadeOutAudio(() => {
                if (audioRef.current) {
                  audioRef.current.pause();
                  audioRef.current.currentTime = 0;
                }

                // Check if there's a playlist playing - play next track
                if (activePlaylistId) {
                  const playedNext = playNextPlaylistTrack();
                  if (playedNext) {
                    audioEndFadingRef.current = false;
                    return; // Continue playlist playback
                  }
                  // Playlist finished, clear playlist state
                  setActivePlaylistId(null);
                  setActivePlaylistIndex(0);
                  setActivePlaylistOrder([]);
                }

                // Check if there's a next audio item in the setlist to auto-play
                if (activeAudioSetlistId) {
                  const currentIndex = setlist.findIndex(item => item.id === activeAudioSetlistId);
                  if (currentIndex !== -1 && currentIndex < setlist.length - 1) {
                    const nextItem = setlist[currentIndex + 1];
                    // Auto-play if next item is also an audio file
                    if (nextItem.type === 'media' && nextItem.mediaType === 'audio' && nextItem.mediaPath) {
                      // Play next audio
                      handlePlayAudio(nextItem.mediaPath, nextItem.mediaName || nextItem.title || 'Audio');
                      setActiveAudioSetlistId(nextItem.id);
                      audioEndFadingRef.current = false;
                      return; // Don't clear audio state, we're continuing playback
                    }
                  }
                }

                // No next audio item, stop playback
                setActiveAudio(null);
                setActiveAudioSetlistId(null);
                setAudioStatus({ currentTime: 0, duration: 0, isPlaying: false });
                audioEndFadingRef.current = false;
              });
            }
          }}
          onPlay={() => setAudioStatus(prev => ({ ...prev, isPlaying: true }))}
          onPause={() => setAudioStatus(prev => ({ ...prev, isPlaying: false }))}
          style={{ display: 'none' }}
        />
      )}

      {/* Audio player bar - memoized component */}
      {activeAudio && (
        <AudioPlayerBar
          name={activeAudio.name}
          isPlaying={audioStatus.isPlaying}
          currentTime={audioStatus.currentTime}
          duration={audioStatus.duration}
          volume={audioTargetVolume}
          onPlayPause={handleAudioPlayPause}
          onSeek={handleAudioSeek}
          onVolumeChange={handleAudioVolumeChange}
          onStop={handleClearAudio}
        />
      )}

      {/* Edit Playlist Modal */}
      {editingPlaylistItemId && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}
          onClick={closeEditPlaylistModal}
        >
          <div
            style={{
              background: 'rgba(30, 30, 35, 0.98)',
              border: '1px solid rgba(255, 152, 0, 0.3)',
              borderRadius: '12px',
              padding: '16px',
              minWidth: '400px',
              maxWidth: '500px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF9800" strokeWidth="2">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>
                Edit Audio Playlist
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>
                Playlist Name
              </label>
              <input
                type="text"
                value={editingPlaylistName}
                onChange={(e) => setEditingPlaylistName(e.target.value)}
                placeholder="Playlist name"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255, 152, 0, 0.4)',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '12px',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: '12px',
                color: 'rgba(255,255,255,0.8)'
              }}>
                <div style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '4px',
                  border: editingPlaylistShuffle ? '2px solid #FF9800' : '2px solid rgba(255,255,255,0.3)',
                  background: editingPlaylistShuffle ? 'rgba(255, 152, 0, 0.3)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}
                  onClick={() => setEditingPlaylistShuffle(!editingPlaylistShuffle)}
                >
                  {editingPlaylistShuffle && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FF9800" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span onClick={() => setEditingPlaylistShuffle(!editingPlaylistShuffle)}>
                  Shuffle playback order
                </span>
              </label>
            </div>

            {/* Track List with Reordering */}
            <div style={{
              maxHeight: '300px',
              overflowY: 'auto',
              marginBottom: '12px',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '6px',
              padding: '4px'
            }}>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', padding: '4px 8px', marginBottom: '4px' }}>
                Drag to reorder tracks ({editingPlaylistTracks.length} tracks)
              </div>
              {editingPlaylistTracks.map((track, index) => (
                <div
                  key={`${track.path}-${index}`}
                  draggable
                  onDragStart={() => handleEditPlaylistTrackDragStart(index)}
                  onDragOver={(e) => handleEditPlaylistTrackDragOver(e, index)}
                  onDragEnd={handleEditPlaylistTrackDragEnd}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 8px',
                    background: editPlaylistDraggedIndex === index
                      ? 'rgba(255, 152, 0, 0.3)'
                      : editPlaylistDropTargetIndex === index
                        ? 'rgba(255, 152, 0, 0.15)'
                        : 'transparent',
                    borderRadius: '4px',
                    cursor: 'grab',
                    borderTop: editPlaylistDropTargetIndex === index && editPlaylistDraggedIndex !== null && editPlaylistDraggedIndex > index
                      ? '2px solid #FF9800'
                      : 'none',
                    borderBottom: editPlaylistDropTargetIndex === index && editPlaylistDraggedIndex !== null && editPlaylistDraggedIndex < index
                      ? '2px solid #FF9800'
                      : 'none',
                    transition: 'background 0.15s ease'
                  }}
                >
                  {/* Drag handle */}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2">
                    <line x1="8" y1="6" x2="16" y2="6" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                    <line x1="8" y1="18" x2="16" y2="18" />
                  </svg>
                  {/* Track number */}
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', width: '16px', textAlign: 'center' }}>
                    {index + 1}
                  </span>
                  {/* Track name */}
                  <span style={{
                    flex: 1,
                    fontSize: '11px',
                    color: 'white',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {track.name}
                  </span>
                  {/* Duration */}
                  {track.duration && (
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
                      {Math.floor(track.duration / 60)}:{String(Math.floor(track.duration % 60)).padStart(2, '0')}
                    </span>
                  )}
                  {/* Remove button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeEditPlaylistTrack(index); }}
                    style={{
                      padding: '2px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '3px',
                      color: 'rgba(255,255,255,0.4)',
                      cursor: 'pointer'
                    }}
                    title="Remove from playlist"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              {editingPlaylistTracks.length === 0 && (
                <div style={{ padding: '16px', textAlign: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                  No tracks in playlist
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
              <button
                onClick={saveEditedPlaylistToDatabase}
                disabled={editingPlaylistTracks.length === 0}
                style={{
                  padding: '8px 12px',
                  background: editingPlaylistTracks.length === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(102, 126, 234, 0.2)',
                  border: editingPlaylistTracks.length === 0 ? 'none' : '1px solid rgba(102, 126, 234, 0.4)',
                  borderRadius: '6px',
                  color: editingPlaylistTracks.length === 0 ? 'rgba(255,255,255,0.3)' : '#667eea',
                  fontSize: '11px',
                  fontWeight: 500,
                  cursor: editingPlaylistTracks.length === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="Save as new playlist"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                Save as New
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={closeEditPlaylistModal}
                  style={{
                    padding: '8px 16px',
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    borderRadius: '6px',
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: '11px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={saveEditedPlaylist}
                  disabled={editingPlaylistTracks.length === 0}
                  style={{
                    padding: '8px 16px',
                    background: editingPlaylistTracks.length === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255, 152, 0, 0.3)',
                    border: editingPlaylistTracks.length === 0 ? 'none' : '1px solid rgba(255, 152, 0, 0.5)',
                    borderRadius: '6px',
                    color: editingPlaylistTracks.length === 0 ? 'rgba(255,255,255,0.3)' : '#FF9800',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: editingPlaylistTracks.length === 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Setlist Item Context Menu */}
      {setlistContextMenu && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000
          }}
          onClick={() => setSetlistContextMenu(null)}
        >
          <div
            style={{
              position: 'fixed',
              top: setlistContextMenu.y,
              left: setlistContextMenu.x,
              background: 'rgba(30, 30, 35, 0.98)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '8px',
              padding: '4px',
              minWidth: '160px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              zIndex: 2001
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Edit option - shown for songs only (not bible) */}
            {setlistContextMenu.item.type === 'song' && setlistContextMenu.item.song && (
              <button
                onClick={() => {
                  startEditingSong(setlistContextMenu.item.song!);
                  setSetlistContextMenu(null);
                }}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'rgba(255,255,255,0.8)',
                  fontSize: '11px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(6,182,212,0.2)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit Song
              </button>
            )}

            {/* Edit presentation - prayer/sermon type */}
            {setlistContextMenu.item.type === 'presentation' && setlistContextMenu.item.presentation?.quickModeData &&
             (setlistContextMenu.item.presentation.quickModeData.type === 'prayer' || setlistContextMenu.item.presentation.quickModeData.type === 'sermon') && (
              <button
                onClick={() => {
                  setEditingPrayerPresentation(setlistContextMenu.item.presentation!);
                  setShowPrayerEditor(true);
                  setSetlistContextMenu(null);
                }}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'rgba(255,255,255,0.8)',
                  fontSize: '11px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(6,182,212,0.2)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit {setlistContextMenu.item.presentation.quickModeData.type === 'sermon' ? 'Sermon' : 'Prayer'} Points
              </button>
            )}

            {/* Edit presentation - free-form type */}
            {setlistContextMenu.item.type === 'presentation' && setlistContextMenu.item.presentation &&
             !setlistContextMenu.item.presentation.quickModeData && (
              <button
                onClick={() => {
                  navigate(`/presentation-editor?id=${setlistContextMenu.item.presentation!.id}`);
                  setSetlistContextMenu(null);
                }}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'rgba(255,255,255,0.8)',
                  fontSize: '11px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(6,182,212,0.2)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit Presentation
              </button>
            )}

            {/* Edit playlist */}
            {setlistContextMenu.item.type === 'audioPlaylist' && setlistContextMenu.item.audioPlaylist && (
              <button
                onClick={() => {
                  openEditPlaylistModal(setlistContextMenu.item);
                  setSetlistContextMenu(null);
                }}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'rgba(255,255,255,0.8)',
                  fontSize: '11px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(6,182,212,0.2)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit Playlist
              </button>
            )}

            {/* Rename section */}
            {setlistContextMenu.item.type === 'section' && (
              <button
                onClick={() => {
                  const newName = prompt('Enter new section name:', setlistContextMenu.item.title || 'Section');
                  if (newName && newName.trim()) {
                    setSetlist(prev => prev.map(item =>
                      item.id === setlistContextMenu.item.id
                        ? { ...item, title: newName.trim() }
                        : item
                    ));
                  }
                  setSetlistContextMenu(null);
                }}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'rgba(255,255,255,0.8)',
                  fontSize: '11px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(6,182,212,0.2)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Rename Section
              </button>
            )}

            {/* Divider before delete */}
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />

            {/* Delete option - shown for all items */}
            <button
              onClick={() => {
                removeFromSetlist(setlistContextMenu.item.id);
                setSetlistContextMenu(null);
              }}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: 'transparent',
                border: 'none',
                borderRadius: '4px',
                color: '#ef4444',
                fontSize: '11px',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Remove from Setlist
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ControlPanel;
