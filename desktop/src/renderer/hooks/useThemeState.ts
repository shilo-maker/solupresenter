import { useState, useCallback } from 'react';

// Module-level flag to track if themes have been loaded and applied
// This persists across component remounts (e.g., navigating away and back)
let hasAppliedInitialThemes = false;

export interface Theme {
  id: string;
  name: string;
  type?: string;
  isDefault?: boolean;
  colors?: any;
  elements?: any;
  currentSlideText?: any;
  [key: string]: any;
}

interface UseThemeStateReturn {
  // Theme lists
  themes: Theme[];
  stageMonitorThemes: Theme[];
  bibleThemes: Theme[];
  prayerThemes: Theme[];
  obsThemes: Theme[];

  // Selected themes (using any for backward compatibility with components)
  selectedTheme: any;
  selectedStageTheme: any;
  selectedBibleTheme: any;
  selectedPrayerTheme: any;
  selectedOBSTheme: any;
  selectedOBSSongsTheme: any;
  selectedOBSBibleTheme: any;
  selectedOBSPrayerTheme: any;

  // Theme editor state
  showThemeEditor: boolean;
  editingTheme: {
    id?: string;
    name: string;
    viewerBackground: { type: string; color: string };
    lineStyles: Record<string, { fontSize: number; color: string; fontWeight: string }>;
  } | null;
  showNewThemeModal: boolean;

  // Setters
  setShowThemeEditor: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingTheme: React.Dispatch<React.SetStateAction<{
    id?: string;
    name: string;
    viewerBackground: { type: string; color: string };
    lineStyles: Record<string, { fontSize: number; color: string; fontWeight: string }>;
  } | null>>;
  setShowNewThemeModal: React.Dispatch<React.SetStateAction<boolean>>;

  // Actions
  loadThemes: () => Promise<void>;
  applyViewerTheme: (theme: any) => void;
  applyStageTheme: (theme: any) => void;
  applyBibleTheme: (theme: any) => void;
  applyPrayerTheme: (theme: any) => void;
  applyOBSTheme: (theme: any) => void;

  // Getters for memoized live preview theme
  getMemoizedLivePreviewTheme: (contentType: 'song' | 'bible' | 'prayer' | 'presentation') => Theme | null;
}

export function useThemeState(): UseThemeStateReturn {
  // Theme lists
  const [themes, setThemes] = useState<Theme[]>([]);
  const [stageMonitorThemes, setStageMonitorThemes] = useState<Theme[]>([]);
  const [bibleThemes, setBibleThemes] = useState<Theme[]>([]);
  const [prayerThemes, setPrayerThemes] = useState<Theme[]>([]);
  const [obsThemes, setObsThemes] = useState<Theme[]>([]);

  // Selected themes (using any for backward compatibility with components)
  const [selectedTheme, setSelectedTheme] = useState<any | null>(null);
  const [selectedStageTheme, setSelectedStageTheme] = useState<any | null>(null);
  const [selectedBibleTheme, setSelectedBibleTheme] = useState<any | null>(null);
  const [selectedPrayerTheme, setSelectedPrayerTheme] = useState<any | null>(null);
  const [selectedOBSTheme, setSelectedOBSTheme] = useState<any | null>(null);
  const [selectedOBSSongsTheme, setSelectedOBSSongsTheme] = useState<any | null>(null);
  const [selectedOBSBibleTheme, setSelectedOBSBibleTheme] = useState<any | null>(null);
  const [selectedOBSPrayerTheme, setSelectedOBSPrayerTheme] = useState<any | null>(null);

  // Theme editor state
  const [showThemeEditor, setShowThemeEditor] = useState(false);
  const [editingTheme, setEditingTheme] = useState<{
    id?: string;
    name: string;
    viewerBackground: { type: string; color: string };
    lineStyles: Record<string, { fontSize: number; color: string; fontWeight: string }>;
  } | null>(null);
  const [showNewThemeModal, setShowNewThemeModal] = useState(false);

  // Track if themes have been loaded for the current session
  // Note: hasAppliedInitialThemes at module level prevents re-applying on navigation

  // Apply theme to viewer display
  const applyThemeToViewerInternal = useCallback((theme: Theme) => {
    if (!theme) return;
    window.electronAPI.applyTheme(theme);
    setSelectedTheme(theme);
    window.electronAPI.saveSelectedThemeId('viewer', theme.id);
  }, []);

  // Apply theme to stage monitor
  const applyStageThemeToMonitorInternal = useCallback((theme: Theme) => {
    if (!theme) return;
    try {
      const colors = typeof theme.colors === 'string' ? JSON.parse(theme.colors) : theme.colors;
      const elements = typeof theme.elements === 'string' ? JSON.parse(theme.elements) : theme.elements;
      const currentSlideText = typeof theme.currentSlideText === 'string' ? JSON.parse(theme.currentSlideText) : theme.currentSlideText;
      const nextSlideText = typeof theme.nextSlideText === 'string' ? JSON.parse(theme.nextSlideText) : theme.nextSlideText;
      window.electronAPI.applyStageTheme({ colors, elements, currentSlideText, nextSlideText });
      setSelectedStageTheme(theme);
      window.electronAPI.saveSelectedThemeId('stage', theme.id);
    } catch (error) {
      console.error('Failed to parse stage theme data:', error);
    }
  }, []);

  // Load all themes from database
  const loadThemes = useCallback(async () => {
    try {
      const savedThemeIds = await window.electronAPI.getSelectedThemeIds();
      const isFirstLoad = !hasAppliedInitialThemes;

      // Load songs (viewer) themes
      const themeList = await window.electronAPI.getThemes();
      setThemes(themeList);
      if (themeList.length > 0) {
        let themeToSelect = savedThemeIds.viewerThemeId
          ? themeList.find((t: Theme) => t.id === savedThemeIds.viewerThemeId)
          : null;
        if (!themeToSelect) {
          themeToSelect = themeList.find((t: Theme) => t.isDefault) || themeList[0];
        }
        setSelectedTheme(themeToSelect);
        // Only apply theme on first load
        if (isFirstLoad) {
          applyThemeToViewerInternal(themeToSelect);
        }
      }

      // Load stage monitor themes
      const stageThemeList = await window.electronAPI.getStageThemes();
      setStageMonitorThemes(stageThemeList);
      if (stageThemeList.length > 0) {
        let themeToSelect = savedThemeIds.stageThemeId
          ? stageThemeList.find((t: Theme) => t.id === savedThemeIds.stageThemeId)
          : null;
        if (!themeToSelect) {
          themeToSelect = stageThemeList.find((t: Theme) => t.isDefault) || stageThemeList[0];
        }
        setSelectedStageTheme(themeToSelect);
        // Only apply theme on first load
        if (isFirstLoad) {
          applyStageThemeToMonitorInternal(themeToSelect);
        }
      }

      // Load Bible themes
      const bibleThemeList = await window.electronAPI.getBibleThemes();
      setBibleThemes(bibleThemeList || []);
      if (bibleThemeList && bibleThemeList.length > 0) {
        let themeToSelect = savedThemeIds.bibleThemeId
          ? bibleThemeList.find((t: Theme) => t.id === savedThemeIds.bibleThemeId)
          : null;
        if (!themeToSelect) {
          themeToSelect = bibleThemeList.find((t: Theme) => t.isDefault) || bibleThemeList[0];
        }
        setSelectedBibleTheme(themeToSelect);
        // Only apply theme on first load
        if (isFirstLoad) {
          window.electronAPI.applyBibleTheme(themeToSelect);
        }
      }

      // Load OBS themes
      const obsThemeList = await window.electronAPI.getOBSThemes();
      setObsThemes(obsThemeList || []);
      if (obsThemeList && obsThemeList.length > 0) {
        const obsSongsThemes = obsThemeList.filter((t: Theme) => t.type === 'songs');
        const obsBibleThemes = obsThemeList.filter((t: Theme) => t.type === 'bible');
        const obsPrayerThemes = obsThemeList.filter((t: Theme) => t.type === 'prayer');

        // Load OBS Songs theme
        if (obsSongsThemes.length > 0) {
          let songsTheme = savedThemeIds.obsThemeId
            ? obsSongsThemes.find((t: Theme) => t.id === savedThemeIds.obsThemeId)
            : null;
          if (!songsTheme) {
            songsTheme = obsSongsThemes.find((t: Theme) => t.isDefault) || obsSongsThemes[0];
          }
          setSelectedOBSSongsTheme(songsTheme);
          setSelectedOBSTheme(songsTheme);
          // Only apply theme on first load
          if (isFirstLoad) {
            window.electronAPI.applyOBSTheme(songsTheme);
          }
        }

        // Load OBS Bible theme
        if (obsBibleThemes.length > 0) {
          let bibleTheme = savedThemeIds.obsBibleThemeId
            ? obsBibleThemes.find((t: Theme) => t.id === savedThemeIds.obsBibleThemeId)
            : null;
          if (!bibleTheme) {
            bibleTheme = obsBibleThemes.find((t: Theme) => t.isDefault) || obsBibleThemes[0];
          }
          setSelectedOBSBibleTheme(bibleTheme);
          // Only apply theme on first load
          if (isFirstLoad) {
            window.electronAPI.applyOBSTheme(bibleTheme);
          }
        }

        // Load OBS Prayer theme
        if (obsPrayerThemes.length > 0) {
          let prayerTheme = savedThemeIds.obsPrayerThemeId
            ? obsPrayerThemes.find((t: Theme) => t.id === savedThemeIds.obsPrayerThemeId)
            : null;
          if (!prayerTheme) {
            prayerTheme = obsPrayerThemes.find((t: Theme) => t.isDefault) || obsPrayerThemes[0];
          }
          setSelectedOBSPrayerTheme(prayerTheme);
          // Only apply theme on first load
          if (isFirstLoad) {
            window.electronAPI.applyOBSTheme(prayerTheme);
          }
        }
      }

      // Load Prayer themes
      const prayerThemeList = await window.electronAPI.getPrayerThemes();
      setPrayerThemes(prayerThemeList || []);
      if (prayerThemeList && prayerThemeList.length > 0) {
        let themeToSelect = savedThemeIds.prayerThemeId
          ? prayerThemeList.find((t: Theme) => t.id === savedThemeIds.prayerThemeId)
          : null;
        if (!themeToSelect) {
          themeToSelect = prayerThemeList.find((t: Theme) => t.isDefault) || prayerThemeList[0];
        }
        setSelectedPrayerTheme(themeToSelect);
        // Only apply theme on first load
        if (isFirstLoad) {
          window.electronAPI.applyPrayerTheme(themeToSelect);
        }
      }

      // Mark as loaded (module-level to persist across navigation)
      hasAppliedInitialThemes = true;
    } catch (error) {
      console.error('Failed to load themes:', error);
    }
  }, [applyThemeToViewerInternal, applyStageThemeToMonitorInternal]);

  // Apply viewer theme (accepts theme object)
  const applyViewerTheme = useCallback((theme: any) => {
    if (theme) {
      applyThemeToViewerInternal(theme);
    }
  }, [applyThemeToViewerInternal]);

  // Apply stage theme (accepts theme object)
  const applyStageTheme = useCallback((theme: any) => {
    if (theme) {
      applyStageThemeToMonitorInternal(theme);
    }
  }, [applyStageThemeToMonitorInternal]);

  // Apply Bible theme (accepts theme object)
  const applyBibleTheme = useCallback((theme: any) => {
    if (theme) {
      setSelectedBibleTheme(theme);
      window.electronAPI.applyBibleTheme(theme);
      window.electronAPI.saveSelectedThemeId('bible', theme.id);
    }
  }, []);

  // Apply Prayer theme (accepts theme object)
  const applyPrayerTheme = useCallback((theme: any) => {
    if (theme) {
      setSelectedPrayerTheme(theme);
      window.electronAPI.applyPrayerTheme(theme);
      window.electronAPI.saveSelectedThemeId('prayer', theme.id);
    }
  }, []);

  // Apply OBS theme (accepts theme object)
  const applyOBSTheme = useCallback((theme: any) => {
    if (theme) {
      setSelectedOBSTheme(theme);
      const themeType = theme.type;
      if (themeType === 'songs') {
        setSelectedOBSSongsTheme(theme);
      } else if (themeType === 'bible') {
        setSelectedOBSBibleTheme(theme);
      } else if (themeType === 'prayer') {
        setSelectedOBSPrayerTheme(theme);
      }
      window.electronAPI.applyOBSTheme(theme);
      const themeKey = themeType === 'bible' ? 'obsBible' : themeType === 'prayer' ? 'obsPrayer' : 'obs';
      window.electronAPI.saveSelectedThemeId(themeKey, theme.id);
    }
  }, []);

  // Get the right theme for live preview based on content type
  const getMemoizedLivePreviewTheme = useCallback((contentType: 'song' | 'bible' | 'prayer' | 'presentation'): Theme | null => {
    if (contentType === 'bible') {
      return selectedBibleTheme;
    } else if (contentType === 'prayer') {
      return selectedPrayerTheme;
    }
    return selectedTheme;
  }, [selectedTheme, selectedBibleTheme, selectedPrayerTheme]);

  return {
    // Theme lists
    themes,
    stageMonitorThemes,
    bibleThemes,
    prayerThemes,
    obsThemes,

    // Selected themes
    selectedTheme,
    selectedStageTheme,
    selectedBibleTheme,
    selectedPrayerTheme,
    selectedOBSTheme,
    selectedOBSSongsTheme,
    selectedOBSBibleTheme,
    selectedOBSPrayerTheme,

    // Theme editor state
    showThemeEditor,
    editingTheme,
    showNewThemeModal,

    // Setters
    setShowThemeEditor,
    setEditingTheme,
    setShowNewThemeModal,

    // Actions
    loadThemes,
    applyViewerTheme,
    applyStageTheme,
    applyBibleTheme,
    applyPrayerTheme,
    applyOBSTheme,

    // Getters
    getMemoizedLivePreviewTheme
  };
}
