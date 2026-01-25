import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';

// Types - duplicated here to avoid circular imports
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

interface Presentation {
  id: string;
  title: string;
  slides: Array<{
    id: string;
    order: number;
    textBoxes: any[];
    imageBoxes?: any[];
    backgroundColor?: string;
  }>;
  createdAt: string;
  updatedAt: string;
  quickModeData?: any;
}

interface AudioPlaylistTrack {
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
}

export interface SavedSetlist {
  id: string;
  name: string;
  venue?: string;
  items: SetlistItem[];
  createdAt: string;  // ISO timestamp string
  updatedAt?: string;
}

interface SetlistContextType {
  // Current working setlist
  setlist: SetlistItem[];
  setSetlist: React.Dispatch<React.SetStateAction<SetlistItem[]>>;

  // Current setlist metadata (if loaded from saved)
  currentSetlistId: string | null;
  setCurrentSetlistId: React.Dispatch<React.SetStateAction<string | null>>;
  currentSetlistName: string;
  setCurrentSetlistName: React.Dispatch<React.SetStateAction<string>>;

  // Unsaved changes tracking
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: React.Dispatch<React.SetStateAction<boolean>>;
  lastSavedSetlistRef: React.MutableRefObject<string>;

  // Helper functions
  updateSavedSnapshot: (items: SetlistItem[]) => void;
  clearSetlist: () => void;
}

const SetlistContext = createContext<SetlistContextType | undefined>(undefined);

const STORAGE_KEY = 'solupresenter_draft_setlist';

interface DraftSetlist {
  items: SetlistItem[];
  currentSetlistId: string | null;
  currentSetlistName: string;
  lastSavedSnapshot: string;
}

// Helper to serialize setlist items for comparison (avoids duplicate code)
const serializeSetlistForComparison = (items: SetlistItem[]): string => {
  return JSON.stringify(items.map(item => ({
    type: item.type,
    songId: item.song?.id,
    title: item.title,
    countdownTime: item.countdownTime,
    countdownMessage: item.countdownMessage,
    announcementText: item.announcementText,
    messages: item.messages,
    messagesInterval: item.messagesInterval,
    mediaPath: item.mediaPath,
    mediaType: item.mediaType,
    mediaDuration: item.mediaDuration,
    mediaName: item.mediaName,
    presentationId: item.presentation?.id,
    bibleData: item.bibleData,
    youtubeVideoId: item.youtubeVideoId,
    youtubeTitle: item.youtubeTitle,
    youtubeThumbnail: item.youtubeThumbnail,
    audioPlaylist: item.audioPlaylist
  })));
};

// Validate a single setlist item
const isValidSetlistItem = (item: unknown): item is SetlistItem => {
  if (!item || typeof item !== 'object') return false;
  const obj = item as Record<string, unknown>;
  // Must have id and type
  if (typeof obj.id !== 'string' || !obj.id) return false;
  if (typeof obj.type !== 'string' || !obj.type) return false;
  // Validate type is one of the allowed types
  const validTypes = ['song', 'blank', 'section', 'countdown', 'announcement', 'messages', 'media', 'bible', 'presentation', 'youtube', 'clock', 'stopwatch', 'audioPlaylist'];
  if (!validTypes.includes(obj.type)) return false;
  return true;
};

// Load draft setlist from localStorage
const loadDraftSetlist = (): DraftSetlist | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate the structure
      if (parsed && Array.isArray(parsed.items)) {
        // Filter out any invalid items
        const validItems = parsed.items.filter(isValidSetlistItem);
        if (validItems.length !== parsed.items.length) {
          console.warn('[SetlistContext] Filtered out', parsed.items.length - validItems.length, 'invalid setlist items');
        }
        return {
          ...parsed,
          items: validItems
        } as DraftSetlist;
      }
    }
  } catch (error) {
    console.error('[SetlistContext] Failed to load draft setlist from localStorage:', error);
  }
  return null;
};

// Save draft setlist to localStorage
const saveDraftSetlist = (draft: DraftSetlist): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch (error) {
    console.error('[SetlistContext] Failed to save draft setlist to localStorage:', error);
  }
};

export const SetlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load draft setlist from localStorage on initial render
  const initialDraft = useMemo(() => loadDraftSetlist(), []);

  const [setlist, setSetlist] = useState<SetlistItem[]>(initialDraft?.items || []);
  const [currentSetlistId, setCurrentSetlistId] = useState<string | null>(initialDraft?.currentSetlistId || null);
  const [currentSetlistName, setCurrentSetlistName] = useState<string>(initialDraft?.currentSetlistName || '');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const lastSavedSetlistRef = useRef<string>(initialDraft?.lastSavedSnapshot || '[]');

  // Memoize the serialized setlist to avoid recalculating on every render
  const serializedSetlist = useMemo(() => serializeSetlistForComparison(setlist), [setlist]);

  // Track unsaved changes - only runs when serializedSetlist changes
  useEffect(() => {
    setHasUnsavedChanges(serializedSetlist !== lastSavedSetlistRef.current);
  }, [serializedSetlist]);

  // Persist draft setlist to localStorage whenever it changes
  useEffect(() => {
    saveDraftSetlist({
      items: setlist,
      currentSetlistId,
      currentSetlistName,
      lastSavedSnapshot: lastSavedSetlistRef.current
    });
  }, [setlist, currentSetlistId, currentSetlistName]);

  const updateSavedSnapshot = useCallback((items: SetlistItem[]) => {
    lastSavedSetlistRef.current = serializeSetlistForComparison(items);
    setHasUnsavedChanges(false);
  }, []);

  const clearSetlist = useCallback(() => {
    setSetlist([]);
    setCurrentSetlistName('');
    setCurrentSetlistId(null);
    lastSavedSetlistRef.current = '[]';
    setHasUnsavedChanges(false);
    // Clear localStorage draft
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('[SetlistContext] Failed to clear draft from localStorage:', error);
    }
  }, []);

  // Memoize context value to prevent unnecessary re-renders of consumers
  const value: SetlistContextType = useMemo(() => ({
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
    clearSetlist
  }), [
    setlist,
    currentSetlistId,
    currentSetlistName,
    hasUnsavedChanges,
    updateSavedSnapshot,
    clearSetlist
  ]);

  return (
    <SetlistContext.Provider value={value}>
      {children}
    </SetlistContext.Provider>
  );
};

export const useSetlist = (): SetlistContextType => {
  const context = useContext(SetlistContext);
  if (context === undefined) {
    throw new Error('useSetlist must be used within a SetlistProvider');
  }
  return context;
};
