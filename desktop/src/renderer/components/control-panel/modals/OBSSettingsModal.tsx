import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';

interface Theme {
  id: string;
  name: string;
}

interface OBSSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isRunning: boolean;
  obsUrl: string | null;
  themes: Theme[];
  bibleThemes: Theme[];
  prayerThemes: Theme[];
  selectedSongsTheme?: Theme | null;
  selectedBibleTheme?: Theme | null;
  selectedPrayerTheme?: Theme | null;
  onApplyTheme: (themeType: 'songs' | 'bible' | 'prayer', theme: Theme | null) => void;
  onStart: () => void;
}

const OBSSettingsModal = memo<OBSSettingsModalProps>(({
  isOpen,
  onClose,
  isRunning,
  obsUrl,
  themes,
  bibleThemes,
  prayerThemes,
  selectedSongsTheme,
  selectedBibleTheme,
  selectedPrayerTheme,
  onApplyTheme,
  onStart
}) => {
  const { t } = useTranslation();
  const [selectedSongs, setSelectedSongs] = useState<string>('');
  const [selectedBible, setSelectedBible] = useState<string>('');
  const [selectedPrayer, setSelectedPrayer] = useState<string>('');
  const [urlCopied, setUrlCopied] = useState(false);

  // Initialize selections from current themes
  useEffect(() => {
    if (isOpen) {
      setSelectedSongs(selectedSongsTheme?.id || '');
      setSelectedBible(selectedBibleTheme?.id || '');
      setSelectedPrayer(selectedPrayerTheme?.id || '');
      setUrlCopied(false);
    }
  }, [isOpen, selectedSongsTheme, selectedBibleTheme, selectedPrayerTheme]);

  const handleContentClick = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

  const handleCopyUrl = useCallback(() => {
    if (obsUrl) {
      navigator.clipboard.writeText(obsUrl);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    }
  }, [obsUrl]);

  const handleSongsChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedSongs(value);
    const theme = themes.find(t => t.id === value) || null;
    onApplyTheme('songs', theme);
  }, [themes, onApplyTheme]);

  const handleBibleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedBible(value);
    const theme = bibleThemes.find(t => t.id === value) || null;
    onApplyTheme('bible', theme);
  }, [bibleThemes, onApplyTheme]);

  const handlePrayerChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedPrayer(value);
    const theme = prayerThemes.find(t => t.id === value) || null;
    onApplyTheme('prayer', theme);
  }, [prayerThemes, onApplyTheme]);

  const handleStart = useCallback(() => {
    onStart();
    onClose();
  }, [onStart, onClose]);

  const themeOptions = useMemo(() => [
    { key: 'songs', label: t('displayThemeOverrides.songsTheme', 'Songs Theme'), themes, value: selectedSongs, onChange: handleSongsChange },
    { key: 'bible', label: t('displayThemeOverrides.bibleTheme', 'Bible Theme'), themes: bibleThemes, value: selectedBible, onChange: handleBibleChange },
    { key: 'prayer', label: t('displayThemeOverrides.prayerTheme', 'Prayer Theme'), themes: prayerThemes, value: selectedPrayer, onChange: handlePrayerChange }
  ], [t, themes, bibleThemes, prayerThemes, selectedSongs, selectedBible, selectedPrayer, handleSongsChange, handleBibleChange, handlePrayerChange]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'rgba(30, 30, 50, 0.98)',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.2)',
          padding: '24px',
          minWidth: '400px',
          maxWidth: '500px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
        }}
        onClick={handleContentClick}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{ margin: 0, color: 'white', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#17a2b8" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            {t('controlPanel.obsSettings', 'OBS Settings')}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              padding: '8px',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* OBS URL - only shown when running */}
        {isRunning && obsUrl && (
          <div style={{
            background: 'rgba(23, 162, 184, 0.15)',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '20px',
            border: '1px solid rgba(23, 162, 184, 0.3)'
          }}>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginBottom: '6px' }}>
              {t('controlPanel.browserSourceUrl', 'Browser Source URL')}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                value={obsUrl}
                readOnly
                style={{
                  flex: 1,
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  color: 'white',
                  fontSize: '0.85rem'
                }}
              />
              <button
                onClick={handleCopyUrl}
                style={{
                  background: urlCopied ? '#28a745' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  minWidth: '70px',
                  transition: 'background 0.2s'
                }}
              >
                {urlCopied ? t('common.copied', 'Copied!') : t('common.copy', 'Copy')}
              </button>
            </div>
          </div>
        )}

        {/* Info text when not running */}
        {!isRunning && (
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '20px',
            fontSize: '0.85rem',
            color: 'rgba(255,255,255,0.7)'
          }}>
            {t('controlPanel.obsDescription', 'OBS Browser Source allows you to display slides in OBS Studio or similar streaming software.')}
          </div>
        )}

        {/* Theme Settings */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '12px', color: 'white', fontSize: '0.9rem', fontWeight: 500 }}>
            {t('displaySettings.themeSettings', 'Theme Settings')}
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {themeOptions.map(({ key, label, themes: themeList, value, onChange }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', minWidth: '100px' }}>
                  {label}:
                </label>
                <select
                  value={value}
                  onChange={onChange}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: 'white',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  <option value="" style={{ background: '#1e1e32' }}>
                    {t('displayThemeOverrides.useGlobal', '-- Use Global --')}
                  </option>
                  {themeList.map(theme => (
                    <option key={theme.id} value={theme.id} style={{ background: '#1e1e32' }}>
                      {theme.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Buttons */}
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end',
          paddingTop: '16px',
          borderTop: '1px solid rgba(255,255,255,0.1)'
        }}>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            {isRunning ? t('common.close', 'Close') : t('common.cancel', 'Cancel')}
          </button>
          {!isRunning && (
            <button
              onClick={handleStart}
              style={{
                background: '#17a2b8',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 24px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 600
              }}
            >
              {t('displaySettings.startDisplay', 'Start Display')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

OBSSettingsModal.displayName = 'OBSSettingsModal';

export default OBSSettingsModal;
