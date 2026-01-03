import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export interface UserSettings {
  language: 'en' | 'he';
  displayMode: 'bilingual' | 'original';
  autoConnect: boolean;
  showTutorial: boolean;
  syncEnabled: boolean;
  youtubeApiKey: string;
}

const defaultSettings: UserSettings = {
  language: 'he',
  displayMode: 'bilingual',
  autoConnect: false,
  showTutorial: true,
  syncEnabled: true,
  youtubeApiKey: ''
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
          setSettings(merged);

          // Apply language
          if (merged.language && merged.language !== i18n.language) {
            await i18n.changeLanguage(merged.language);
          }
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
          setSettings(prev => ({ ...prev, language: serverLang }));
          await i18n.changeLanguage(serverLang);
          saveToLocalStorage({ ...settings, language: serverLang });
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
      console.error('Failed to save settings to localStorage:', error);
    }
  }, []);

  const syncToServer = useCallback(async (newSettings: UserSettings) => {
    console.log('[Settings] syncToServer called, syncEnabled:', settings.syncEnabled);
    if (!settings.syncEnabled) {
      console.log('[Settings] Sync disabled, skipping');
      return;
    }
    // Skip if electronAPI is not available (e.g., in display windows)
    if (!window.electronAPI?.getAuthState) {
      console.log('[Settings] electronAPI not available, skipping sync');
      return;
    }

    try {
      const authState = await window.electronAPI.getAuthState();
      console.log('[Settings] Auth state:', { isAuthenticated: authState.isAuthenticated, hasToken: !!authState.token, serverUrl: authState.serverUrl });
      if (!authState.isAuthenticated || !authState.token) {
        console.log('[Settings] Not authenticated, skipping sync');
        return;
      }

      setIsSyncing(true);

      // Sync language preference to server
      const serverUrl = authState.serverUrl || 'https://solupresenter-backend-4rn5.onrender.com';
      console.log('[Settings] Syncing language to server:', newSettings.language, 'URL:', serverUrl);
      const response = await fetch(`${serverUrl}/auth/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authState.token}`
        },
        body: JSON.stringify({ language: newSettings.language })
      });

      if (!response.ok) {
        console.error('[Settings] Failed to sync settings to server, status:', response.status);
      } else {
        console.log('[Settings] Successfully synced language to server');
      }
    } catch (error) {
      console.error('[Settings] Failed to sync settings to server:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [settings.syncEnabled]);

  const updateSetting = useCallback(async <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveToLocalStorage(newSettings);

    // Apply language change immediately
    if (key === 'language') {
      await i18n.changeLanguage(value as string);
    }

    // Sync to server if enabled
    if (key === 'language' || key === 'syncEnabled') {
      await syncToServer(newSettings);
    }
  }, [settings, saveToLocalStorage, syncToServer, i18n]);

  const updateSettings = useCallback(async (newSettings: Partial<UserSettings>) => {
    const merged = { ...settings, ...newSettings };
    setSettings(merged);
    saveToLocalStorage(merged);

    // Apply language change if included
    if (newSettings.language && newSettings.language !== i18n.language) {
      await i18n.changeLanguage(newSettings.language);
    }

    // Sync to server
    await syncToServer(merged);
  }, [settings, saveToLocalStorage, syncToServer, i18n]);

  const resetSettings = useCallback(async () => {
    setSettings(defaultSettings);
    saveToLocalStorage(defaultSettings);
    await i18n.changeLanguage(defaultSettings.language);
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
