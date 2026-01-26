import { useCallback } from 'react';

interface ThemeManagerCallbacks {
  setThemes: React.Dispatch<React.SetStateAction<any[]>>;
  setStageMonitorThemes: React.Dispatch<React.SetStateAction<any[]>>;
  setBibleThemes: React.Dispatch<React.SetStateAction<any[]>>;
  setPrayerThemes: React.Dispatch<React.SetStateAction<any[]>>;
  setObsThemes: React.Dispatch<React.SetStateAction<any[]>>;
  setSelectedTheme: React.Dispatch<React.SetStateAction<any | null>>;
  setSelectedStageTheme: React.Dispatch<React.SetStateAction<any | null>>;
  setSelectedBibleTheme: React.Dispatch<React.SetStateAction<any | null>>;
  setSelectedPrayerTheme: React.Dispatch<React.SetStateAction<any | null>>;
  setSelectedOBSTheme: React.Dispatch<React.SetStateAction<any | null>>;
  setSelectedOBSSongsTheme: React.Dispatch<React.SetStateAction<any | null>>;
  setSelectedOBSBibleTheme: React.Dispatch<React.SetStateAction<any | null>>;
  setSelectedOBSPrayerTheme: React.Dispatch<React.SetStateAction<any | null>>;
}

interface ThemeManagerState {
  selectedTheme: any | null;
  selectedStageTheme: any | null;
  selectedBibleTheme: any | null;
  selectedPrayerTheme: any | null;
  selectedOBSTheme: any | null;
  selectedOBSSongsTheme: any | null;
  selectedOBSBibleTheme: any | null;
  selectedOBSPrayerTheme: any | null;
}

export function useThemeManager(
  state: ThemeManagerState,
  callbacks: ThemeManagerCallbacks
) {
  const {
    selectedTheme,
    selectedStageTheme,
    selectedBibleTheme,
    selectedPrayerTheme,
    selectedOBSTheme,
    selectedOBSSongsTheme,
    selectedOBSBibleTheme,
    selectedOBSPrayerTheme
  } = state;

  const {
    setThemes,
    setStageMonitorThemes,
    setBibleThemes,
    setPrayerThemes,
    setObsThemes,
    setSelectedTheme,
    setSelectedStageTheme,
    setSelectedBibleTheme,
    setSelectedPrayerTheme,
    setSelectedOBSTheme,
    setSelectedOBSSongsTheme,
    setSelectedOBSBibleTheme,
    setSelectedOBSPrayerTheme
  } = callbacks;

  // Apply theme to viewer display
  const applyThemeToViewer = useCallback((theme: any) => {
    if (!theme) return;
    window.electronAPI.applyTheme(theme);
    setSelectedTheme(theme);
    window.electronAPI.saveSelectedThemeId('viewer', theme.id);
  }, [setSelectedTheme]);

  // Apply theme to stage monitor
  const applyStageThemeToMonitor = useCallback((theme: any) => {
    if (!theme) return;
    try {
      const colors = typeof theme.colors === 'string' ? JSON.parse(theme.colors) : theme.colors;
      const elements = typeof theme.elements === 'string' ? JSON.parse(theme.elements) : theme.elements;
      const currentSlideText = typeof theme.currentSlideText === 'string' ? JSON.parse(theme.currentSlideText) : theme.currentSlideText;
      window.electronAPI.applyStageTheme({ colors, elements, currentSlideText });
      setSelectedStageTheme(theme);
      window.electronAPI.saveSelectedThemeId('stage', theme.id);
    } catch (error) {
      console.error('Failed to parse stage theme data:', error);
    }
  }, [setSelectedStageTheme]);

  // Load all themes from database and apply saved selections
  const loadThemes = useCallback(async () => {
    try {
      const savedThemeIds = await window.electronAPI.getSelectedThemeIds();

      // Load songs (viewer) themes
      const themeList = await window.electronAPI.getThemes();
      setThemes(themeList);
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
        window.electronAPI.applyBibleTheme(themeToSelect);
      }

      // Load OBS themes
      const obsThemeList = await window.electronAPI.getOBSThemes();
      setObsThemes(obsThemeList || []);
      if (obsThemeList && obsThemeList.length > 0) {
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
        window.electronAPI.applyPrayerTheme(themeToSelect);
      }
    } catch (error) {
      console.error('Failed to load themes:', error);
    }
  }, [
    selectedTheme, selectedStageTheme, selectedBibleTheme, selectedPrayerTheme,
    selectedOBSTheme, selectedOBSSongsTheme, selectedOBSBibleTheme, selectedOBSPrayerTheme,
    setThemes, setStageMonitorThemes, setBibleThemes, setPrayerThemes, setObsThemes,
    setSelectedTheme, setSelectedStageTheme, setSelectedBibleTheme, setSelectedPrayerTheme,
    setSelectedOBSTheme, setSelectedOBSSongsTheme, setSelectedOBSBibleTheme, setSelectedOBSPrayerTheme,
    applyThemeToViewer, applyStageThemeToMonitor
  ]);

  // Apply callbacks for individual theme types
  const applyBibleThemeCallback = useCallback((theme: any) => {
    setSelectedBibleTheme(theme);
    window.electronAPI.applyBibleTheme(theme);
    window.electronAPI.saveSelectedThemeId('bible', theme.id);
  }, [setSelectedBibleTheme]);

  const applyOBSThemeCallback = useCallback((theme: any) => {
    setSelectedOBSTheme(theme);
    if (theme.type === 'songs') {
      setSelectedOBSSongsTheme(theme);
    } else if (theme.type === 'bible') {
      setSelectedOBSBibleTheme(theme);
    } else if (theme.type === 'prayer') {
      setSelectedOBSPrayerTheme(theme);
    }
    window.electronAPI.applyOBSTheme(theme);
    const themeKey = theme.type === 'bible' ? 'obsBible' : theme.type === 'prayer' ? 'obsPrayer' : 'obs';
    window.electronAPI.saveSelectedThemeId(themeKey, theme.id);
  }, [setSelectedOBSTheme, setSelectedOBSSongsTheme, setSelectedOBSBibleTheme, setSelectedOBSPrayerTheme]);

  const applyPrayerThemeCallback = useCallback((theme: any) => {
    setSelectedPrayerTheme(theme);
    window.electronAPI.applyPrayerTheme(theme);
    window.electronAPI.saveSelectedThemeId('prayer', theme.id);
  }, [setSelectedPrayerTheme]);

  return {
    loadThemes,
    applyThemeToViewer,
    applyStageThemeToMonitor,
    applyBibleThemeCallback,
    applyOBSThemeCallback,
    applyPrayerThemeCallback
  };
}
