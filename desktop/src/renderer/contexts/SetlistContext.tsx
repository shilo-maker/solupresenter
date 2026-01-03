import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

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

export interface SetlistItem {
  id: string;
  type: 'song' | 'blank' | 'section' | 'countdown' | 'announcement' | 'messages' | 'media' | 'bible' | 'presentation' | 'youtube';
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
  createdAt: number;
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

export const SetlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize state from localStorage
  const [setlist, setSetlist] = useState<SetlistItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const draft: DraftSetlist = JSON.parse(saved);
        return draft.items || [];
      }
    } catch (e) {
      console.error('Failed to load draft setlist from localStorage:', e);
    }
    return [];
  });

  const [currentSetlistId, setCurrentSetlistId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const draft: DraftSetlist = JSON.parse(saved);
        return draft.currentSetlistId || null;
      }
    } catch (e) {
      // Ignore
    }
    return null;
  });

  const [currentSetlistName, setCurrentSetlistName] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const draft: DraftSetlist = JSON.parse(saved);
        return draft.currentSetlistName || '';
      }
    } catch (e) {
      // Ignore
    }
    return '';
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const lastSavedSetlistRef = useRef<string>((() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const draft: DraftSetlist = JSON.parse(saved);
        return draft.lastSavedSnapshot || '[]';
      }
    } catch (e) {
      // Ignore
    }
    return '[]';
  })());

  // Save to localStorage whenever state changes
  useEffect(() => {
    try {
      const draft: DraftSetlist = {
        items: setlist,
        currentSetlistId,
        currentSetlistName,
        lastSavedSnapshot: lastSavedSetlistRef.current
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch (e) {
      console.error('Failed to save draft setlist to localStorage:', e);
    }
  }, [setlist, currentSetlistId, currentSetlistName]);

  // Track unsaved changes
  useEffect(() => {
    const currentSetlistJson = JSON.stringify(setlist.map(item => ({
      type: item.type,
      songId: item.song?.id,
      title: item.title,
      countdownTime: item.countdownTime,
      countdownMessage: item.countdownMessage,
      announcementText: item.announcementText,
      messages: item.messages,
      messagesInterval: item.messagesInterval,
      mediaPath: item.mediaPath,
      presentationId: item.presentation?.id,
      bibleData: item.bibleData,
      youtubeVideoId: item.youtubeVideoId
    })));
    setHasUnsavedChanges(currentSetlistJson !== lastSavedSetlistRef.current);
  }, [setlist]);

  const updateSavedSnapshot = useCallback((items: SetlistItem[]) => {
    lastSavedSetlistRef.current = JSON.stringify(items.map(item => ({
      type: item.type,
      songId: item.song?.id,
      title: item.title,
      countdownTime: item.countdownTime,
      countdownMessage: item.countdownMessage,
      announcementText: item.announcementText,
      messages: item.messages,
      messagesInterval: item.messagesInterval,
      mediaPath: item.mediaPath,
      presentationId: item.presentation?.id,
      bibleData: item.bibleData,
      youtubeVideoId: item.youtubeVideoId
    })));
    setHasUnsavedChanges(false);
  }, []);

  const clearSetlist = useCallback(() => {
    setSetlist([]);
    setCurrentSetlistName('');
    setCurrentSetlistId(null);
    lastSavedSetlistRef.current = '[]';
    setHasUnsavedChanges(false);
  }, []);

  const value: SetlistContextType = {
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
  };

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
