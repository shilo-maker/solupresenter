import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export type CustomLineSource =
  | { type: 'original' }
  | { type: 'transliteration' }
  | { type: 'translation'; lang?: string }
  | { type: 'none' };

export interface CustomDisplayLines {
  line1: CustomLineSource;
  line2: CustomLineSource;
  line3: CustomLineSource;
  line4: CustomLineSource;
}

export interface UserSettings {
  language: 'en' | 'he';
  displayMode: 'bilingual' | 'original';
  autoConnect: boolean;
  showTutorial: boolean;
  syncEnabled: boolean;
  youtubeApiKey: string;
  // Timeout settings (in seconds for user-friendly display)
  mediaLoadTimeout: number;
  thumbnailGenerationTimeout: number;
  youtubeSearchTimeout: number;
  // UI Scale (zoom factor: 0.8 = 80%, 1.0 = 100%, 1.5 = 150%)
  uiScale: number;
  // Translation language for multi-translation songs (e.g. 'en', 'cs', 'es')
  translationLanguage: string;
  // Custom display line assignments for custom display mode
  customDisplayLines: CustomDisplayLines;
}

const defaultSettings: UserSettings = {
  language: 'he',
  displayMode: 'bilingual',
  autoConnect: false,
  showTutorial: true,
  syncEnabled: true,
  youtubeApiKey: '',
  // Default timeout values (in seconds)
  mediaLoadTimeout: 15,
  thumbnailGenerationTimeout: 8,
  youtubeSearchTimeout: 15,
  // Default UI scale (100%)
  uiScale: 1.0,
  // Default translation language
  translationLanguage: 'en',
  // Default custom display lines
  customDisplayLines: {
    line1: { type: 'original' },
    line2: { type: 'transliteration' },
    line3: { type: 'translation' },
    line4: { type: 'none' }
  }
};

interface SettingsContextType {
  settings: UserSettings;
  updateSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => Promise<void>;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
  isLoading: boolean;
  isSyncing: boolean;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

const STORAGE_KEY = 'solucast-settings';

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          const merged = { ...defaultSettings, ...parsed };
          // Migrate: ensure customDisplayLines has line4 (added in v2)
          if (merged.customDisplayLines && !('line4' in merged.customDisplayLines)) {
            merged.customDisplayLines = { ...merged.customDisplayLines, line4: { type: 'none' } };
          }
          setSettings(merged);

          // Apply language
          if (merged.language && merged.language !== i18n.language) {
            await i18n.changeLanguage(merged.language);
          }

          // Apply UI scale
          if (merged.uiScale && window.electronAPI?.setZoomFactor) {
            window.electronAPI.setZoomFactor(merged.uiScale);
          }
        } else {
          // Fresh install: sync settings.language to what i18n detected from browser
          const detectedLang = (i18n.language === 'he' || i18n.language === 'en') ? i18n.language : 'en';
          setSettings(prev => ({ ...prev, language: detectedLang as 'en' | 'he' }));
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Try to sync with server when authenticated
  useEffect(() => {
    const syncWithServer = async () => {
      if (!settings.syncEnabled) return;
      // Skip if electronAPI is not available (e.g., in display windows)
      if (!window.electronAPI?.getAuthState) return;

      try {
        const authState = await window.electronAPI.getAuthState();
        if (!authState.isAuthenticated || !authState.user) return;

        // Get server preferences
        const serverLang = authState.user.preferences?.language as 'en' | 'he' | undefined;
        if (serverLang && (serverLang === 'en' || serverLang === 'he') && serverLang !== settings.language) {
          // Server has different language - use server's preference
          let updatedSettings: UserSettings;
          setSettings(prev => {
            updatedSettings = { ...prev, language: serverLang };
            return updatedSettings;
          });
          await i18n.changeLanguage(serverLang);
          saveToLocalStorage(updatedSettings!);
        }
      } catch (error) {
        console.error('Failed to sync settings with server:', error);
      }
    };

    if (!isLoading) {
      syncWithServer();
    }
  }, [isLoading, settings.syncEnabled]);

  const saveToLocalStorage = useCallback((newSettings: UserSettings) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    } catch (error) {
      // Handle QuotaExceededError specifically
      if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22)) {
        console.error('[SettingsContext] localStorage quota exceeded. Attempting to clear old data...');
        try {
          // Try to clear non-essential cached data
          const keysToPreserve = [STORAGE_KEY, 'solupresenter_draft_setlist'];
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && !keysToPreserve.includes(key)) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key));
          // Retry save after clearing
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
          console.log('[SettingsContext] Successfully saved after clearing old data');
        } catch (retryError) {
          console.error('[SettingsContext] Failed to save even after clearing data:', retryError);
        }
      } else {
        console.error('[SettingsContext] Failed to save settings to localStorage:', error);
      }
    }
  }, []);

  const syncToServer = useCallback(async (newSettings: UserSettings) => {
    if (!settings.syncEnabled) return;
    // Skip if electronAPI is not available (e.g., in display windows)
    if (!window.electronAPI?.getAuthState) return;

    try {
      const authState = await window.electronAPI.getAuthState();
      if (!authState.isAuthenticated || !authState.token) return;

      setIsSyncing(true);

      // Sync language preference to server
      const serverUrl = authState.serverUrl || 'https://solupresenter-backend-4rn5.onrender.com';
      const response = await fetch(`${serverUrl}/auth/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authState.token}`
        },
        body: JSON.stringify({ language: newSettings.language })
      });

      if (!response.ok) {
        console.error('Failed to sync settings to server, status:', response.status);
      }
    } catch (error) {
      console.error('Failed to sync settings to server:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [settings.syncEnabled]);

  const updateSetting = useCallback(async <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ) => {
    let newSettings: UserSettings;
    setSettings(prev => {
      newSettings = { ...prev, [key]: value };
      return newSettings;
    });
    saveToLocalStorage(newSettings!);

    // Apply language change immediately
    if (key === 'language') {
      try {
        await i18n.changeLanguage(value as string);
      } catch (error) {
        console.error('Failed to change language:', error);
      }
    }

    // Apply UI scale immediately
    if (key === 'uiScale' && window.electronAPI?.setZoomFactor) {
      window.electronAPI.setZoomFactor(value as number);
    }

    // Sync to server if enabled
    if (key === 'language' || key === 'syncEnabled') {
      await syncToServer(newSettings);
    }
  }, [saveToLocalStorage, syncToServer, i18n]);

  const updateSettings = useCallback(async (newSettings: Partial<UserSettings>) => {
    let merged: UserSettings;
    setSettings(prev => {
      merged = { ...prev, ...newSettings };
      return merged;
    });
    saveToLocalStorage(merged!);

    // Apply language change if included
    if (newSettings.language && newSettings.language !== i18n.language) {
      try {
        await i18n.changeLanguage(newSettings.language);
      } catch (error) {
        console.error('Failed to change language:', error);
      }
    }

    // Sync to server
    await syncToServer(merged);
  }, [saveToLocalStorage, syncToServer, i18n]);

  const resetSettings = useCallback(async () => {
    setSettings(defaultSettings);
    saveToLocalStorage(defaultSettings);
    try {
      await i18n.changeLanguage(defaultSettings.language);
    } catch (error) {
      console.error('Failed to change language:', error);
    }
    await syncToServer(defaultSettings);
  }, [saveToLocalStorage, syncToServer, i18n]);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSetting,
        updateSettings,
        resetSettings,
        isLoading,
        isSyncing
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

export default SettingsContext;
