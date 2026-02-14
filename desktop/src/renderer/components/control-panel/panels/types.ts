// Shared types for Control Panel tabs/panels

/** Display type assigned to a physical display window */
export type DisplayAssignedType = 'viewer' | 'stage' | 'camera';

/** Check if a display type behaves like a viewer (receives viewer themes, slides, media, YouTube, etc.) */
export function isViewerLike(type: string | undefined): boolean {
  return type === 'viewer' || type === 'camera';
}

/** Badge color for each display assigned type */
export const DISPLAY_TYPE_BADGE_COLORS: Record<DisplayAssignedType, string> = {
  viewer: '#28a745',
  stage: '#6c757d',
  camera: '#00897b',
};

export interface Song {
  id: string;
  title: string;
  originalLanguage?: string;
  tags?: string[];
  slides: Array<{
    originalText?: string;
    transliteration?: string;
    translation?: string;
    translationOverflow?: string;
    translations?: Record<string, string>;
    verseType?: string;
  }>;
  author?: string;
}

export interface AudioPlaylistTrack {
  path: string;
  name: string;
  duration?: number | null;
}

export interface SetlistItem {
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
  // Per-item background override (viewer only)
  background?: string;
}

export interface Presentation {
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

export interface QuickModeMetadata {
  type: 'sermon' | 'prayer' | 'announcements';
  title: string;
  titleTranslation?: string;
  generateTranslation?: boolean;
  subtitles: Array<{
    subtitle: string;
    subtitleTranslation?: string;
    description?: string;
    descriptionTranslation?: string;
    bibleRef?: { reference: string; hebrewReference?: string };
  }>;
}

export interface BibleBook {
  name: string;
  chapters: number;
  hebrewName?: string;
  testament?: 'old' | 'new';
}

export interface BibleSlide {
  originalText: string;
  transliteration: string;
  translation: string;
  verseType: string;
  reference: string;
  hebrewReference: string;
}

export interface YouTubeVideo {
  videoId: string;
  title: string;
  thumbnail: string;
}

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  duration?: string;
}
