import { useState, useCallback } from 'react';

// Module-level flag to track if themes have been loaded
// This persists across component remounts (e.g., navigating away and back)
// NOTE: Themes are NO LONGER automatically applied on mount to prevent
// unexpected theme broadcasts when navigating or reconnecting displays.
// Themes are only applied when explicitly requested by user action.
let hasLoadedThemes = false;

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
  dualTranslationThemes: Theme[];

  // Selected themes (using any for backward compatibility with components)
  selectedTheme: any;
  selectedStageTheme: any;
  selectedBibleTheme: any;
  selectedPrayerTheme: any;
  selectedOBSTheme: any;
  selectedOBSSongsTheme: any;
  selectedOBSBibleTheme: any;
  selectedOBSPrayerTheme: any;
  selectedDualTranslationTheme: any;

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
  applyDualTranslationTheme: (theme: any) => void;

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
  const [dualTranslationThemes, setDualTranslationThemes] = useState<Theme[]>([]);

  // Selected themes (using any for backward compatibility with components)
  const [selectedTheme, setSelectedTheme] = useState<any | null>(null);
  const [selectedStageTheme, setSelectedStageTheme] = useState<any | null>(null);
  const [selectedBibleTheme, setSelectedBibleTheme] = useState<any | null>(null);
  const [selectedPrayerTheme, setSelectedPrayerTheme] = useState<any | null>(null);
  const [selectedOBSTheme, setSelectedOBSTheme] = useState<any | null>(null);
  const [selectedOBSSongsTheme, setSelectedOBSSongsTheme] = useState<any | null>(null);
  const [selectedOBSBibleTheme, setSelectedOBSBibleTheme] = useState<any | null>(null);
  const [selectedOBSPrayerTheme, setSelectedOBSPrayerTheme] = useState<any | null>(null);
  const [selectedDualTranslationTheme, setSelectedDualTranslationTheme] = useState<any | null>(null);

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
  // NOTE: This function ONLY loads themes into state - it does NOT broadcast them to displays.
  // Themes are only broadcast when explicitly applied by user action (via applyViewerTheme, etc.)
  // or when a display connects and requests initial state from displayManager.
  const loadThemes = useCallback(async () => {
    try {
      // Load all theme data in parallel for faster startup
      // Use Promise.allSettled for dual translation themes to avoid breaking all theme loading
      // if the dual_translation_themes table doesn't exist yet (e.g., during migration)
      const [
        savedThemeIds,
        themeList,
        stageThemeList,
        bibleThemeList,
        obsThemeList,
        prayerThemeList
      ] = await Promise.all([
        window.electronAPI.getSelectedThemeIds(),
        window.electronAPI.getThemes(),
        window.electronAPI.getStageThemes(),
        window.electronAPI.getBibleThemes(),
        window.electronAPI.getOBSThemes(),
        window.electronAPI.getPrayerThemes()
      ]);

      // Load dual translation themes separately so failure doesn't break other themes
      let dualTranslationThemeList: any[] = [];
      try {
        dualTranslationThemeList = await window.electronAPI.getDualTranslationThemes();
      } catch (e) {
        console.warn('Failed to load dual translation themes (table may not exist yet):', e);
      }

      // Process viewer themes
      setThemes(themeList);
      if (themeList.length > 0) {
        let themeToSelect = savedThemeIds.viewerThemeId
          ? themeList.find((t: Theme) => t.id === savedThemeIds.viewerThemeId)
          : null;
        if (!themeToSelect) {
          themeToSelect = themeList.find((t: Theme) => t.isDefault) || themeList[0];
        }
        setSelectedTheme(themeToSelect);
        // NO automatic apply - themes are only applied on explicit user action
      }

      // Process stage monitor themes
      setStageMonitorThemes(stageThemeList);
      if (stageThemeList.length > 0) {
        let themeToSelect = savedThemeIds.stageThemeId
          ? stageThemeList.find((t: Theme) => t.id === savedThemeIds.stageThemeId)
          : null;
        if (!themeToSelect) {
          themeToSelect = stageThemeList.find((t: Theme) => t.isDefault) || stageThemeList[0];
        }
        setSelectedStageTheme(themeToSelect);
        // NO automatic apply - themes are only applied on explicit user action
      }

      // Process Bible themes
      setBibleThemes(bibleThemeList || []);
      if (bibleThemeList && bibleThemeList.length > 0) {
        let themeToSelect = savedThemeIds.bibleThemeId
          ? bibleThemeList.find((t: Theme) => t.id === savedThemeIds.bibleThemeId)
          : null;
        if (!themeToSelect) {
          themeToSelect = bibleThemeList.find((t: Theme) => t.isDefault) || bibleThemeList[0];
        }
        setSelectedBibleTheme(themeToSelect);
        // NO automatic apply - themes are only applied on explicit user action
      }

      // Process OBS themes
      setObsThemes(obsThemeList || []);
      if (obsThemeList && obsThemeList.length > 0) {
        const obsSongsThemes = obsThemeList.filter((t: Theme) => t.type === 'songs');
        const obsBibleThemes = obsThemeList.filter((t: Theme) => t.type === 'bible');
        const obsPrayerThemes = obsThemeList.filter((t: Theme) => t.type === 'prayer');

        // Process OBS Songs theme
        if (obsSongsThemes.length > 0) {
          let songsTheme = savedThemeIds.obsThemeId
            ? obsSongsThemes.find((t: Theme) => t.id === savedThemeIds.obsThemeId)
            : null;
          if (!songsTheme) {
            songsTheme = obsSongsThemes.find((t: Theme) => t.isDefault) || obsSongsThemes[0];
          }
          setSelectedOBSSongsTheme(songsTheme);
          setSelectedOBSTheme(songsTheme);
          // NO automatic apply - themes are only applied on explicit user action
        }

        // Process OBS Bible theme
        if (obsBibleThemes.length > 0) {
          let bibleTheme = savedThemeIds.obsBibleThemeId
            ? obsBibleThemes.find((t: Theme) => t.id === savedThemeIds.obsBibleThemeId)
            : null;
          if (!bibleTheme) {
            bibleTheme = obsBibleThemes.find((t: Theme) => t.isDefault) || obsBibleThemes[0];
          }
          setSelectedOBSBibleTheme(bibleTheme);
          // NO automatic apply - themes are only applied on explicit user action
        }

        // Process OBS Prayer theme
        if (obsPrayerThemes.length > 0) {
          let prayerTheme = savedThemeIds.obsPrayerThemeId
            ? obsPrayerThemes.find((t: Theme) => t.id === savedThemeIds.obsPrayerThemeId)
            : null;
          if (!prayerTheme) {
            prayerTheme = obsPrayerThemes.find((t: Theme) => t.isDefault) || obsPrayerThemes[0];
          }
          setSelectedOBSPrayerTheme(prayerTheme);
          // NO automatic apply - themes are only applied on explicit user action
        }
      }

      // Process Prayer themes
      setPrayerThemes(prayerThemeList || []);
      if (prayerThemeList && prayerThemeList.length > 0) {
        let themeToSelect = savedThemeIds.prayerThemeId
          ? prayerThemeList.find((t: Theme) => t.id === savedThemeIds.prayerThemeId)
          : null;
        if (!themeToSelect) {
          themeToSelect = prayerThemeList.find((t: Theme) => t.isDefault) || prayerThemeList[0];
        }
        setSelectedPrayerTheme(themeToSelect);
        // NO automatic apply - themes are only applied on explicit user action
      }

      // Process Dual Translation themes
      setDualTranslationThemes(dualTranslationThemeList || []);
      if (dualTranslationThemeList && dualTranslationThemeList.length > 0) {
        let themeToSelect = savedThemeIds.dualTranslationThemeId
          ? dualTranslationThemeList.find((t: Theme) => t.id === savedThemeIds.dualTranslationThemeId)
          : null;
        if (!themeToSelect) {
          themeToSelect = dualTranslationThemeList.find((t: Theme) => t.isDefault) || dualTranslationThemeList[0];
        }
        setSelectedDualTranslationTheme(themeToSelect);
        // NO automatic apply - themes are only applied on explicit user action
      }

      // Mark as loaded (module-level to persist across navigation)
      hasLoadedThemes = true;
    } catch (error) {
      console.error('Failed to load themes:', error);
    }
  }, []);

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

  // Apply Dual Translation theme (accepts theme object)
  // This uses the same viewer display channel since dual translation themes are viewer themes with 4 lines
  const applyDualTranslationTheme = useCallback((theme: any) => {
    if (theme) {
      setSelectedDualTranslationTheme(theme);
      window.electronAPI.applyTheme(theme);
      window.electronAPI.saveSelectedThemeId('dualTranslation', theme.id);
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
    dualTranslationThemes,

    // Selected themes
    selectedTheme,
    selectedStageTheme,
    selectedBibleTheme,
    selectedPrayerTheme,
    selectedOBSTheme,
    selectedOBSSongsTheme,
    selectedOBSBibleTheme,
    selectedOBSPrayerTheme,
    selectedDualTranslationTheme,

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
    applyDualTranslationTheme,

    // Getters
    getMemoizedLivePreviewTheme
  };
}
