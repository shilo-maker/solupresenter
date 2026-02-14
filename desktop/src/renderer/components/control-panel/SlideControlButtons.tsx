import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

type UserDisplayMode = 'bilingual' | 'original' | 'custom';

interface SlideControlButtonsProps {
  isBlank: boolean;
  displayMode: 'bilingual' | 'original' | 'translation';
  showBackgroundDropdown: boolean;
  selectedBackground: string;
  isRTL: boolean;
  customModeActive: boolean;
  onToggleBlank: () => void;
  onSetDisplayMode: (mode: UserDisplayMode) => void;
  onOpenCustomConfig: () => void;
  onToggleBackgroundDropdown: () => void;
  onSelectBackground: (value: string) => void;
  onClearBackground: () => void;
}

const gearIcon = (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const chevronDown = (
  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const SlideControlButtons = memo<SlideControlButtonsProps>(({
  isBlank,
  displayMode,
  showBackgroundDropdown,
  selectedBackground,
  isRTL,
  customModeActive,
  onToggleBlank,
  onSetDisplayMode,
  onOpenCustomConfig,
  onToggleBackgroundDropdown,
  onSelectBackground,
  onClearBackground
}) => {
  const { t } = useTranslation();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);

  // Derive the user-facing mode from internal state
  const currentMode: UserDisplayMode = customModeActive ? 'custom' : (displayMode === 'original' ? 'original' : 'bilingual');

  const modeLabels: Record<UserDisplayMode, string> = {
    bilingual: t('controlPanel.bilingual', 'דו לשוני'),
    original: t('controlPanel.original', 'מקורי'),
    custom: t('controlPanel.customDisplay', 'התאמה אישית')
  };

  // Close dropdown on click outside
  useEffect(() => {
    if (!showDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  // Calculate dropdown position when opening
  const toggleDropdown = useCallback(() => {
    setShowDropdown(prev => {
      if (!prev && buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setDropdownPos({
          top: rect.top,
          left: isRTL ? rect.left : rect.right
        });
      }
      return !prev;
    });
  }, [isRTL]);

  const handleSelectMode = useCallback((mode: UserDisplayMode) => {
    onSetDisplayMode(mode);
    setShowDropdown(false);
  }, [onSetDisplayMode]);

  const handleGearClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenCustomConfig();
    setShowDropdown(false);
  }, [onOpenCustomConfig]);

  const isActive = currentMode === 'bilingual' || currentMode === 'custom';

  return (
    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
      <button
        onClick={onToggleBlank}
        style={{
          background: isBlank ? '#94a3b8' : 'rgba(255,255,255,0.1)',
          border: '1px solid #94a3b8',
          borderRadius: '6px',
          padding: '5px 10px',
          color: isBlank ? '#000' : '#94a3b8',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '0.75rem',
          transition: 'all 0.15s ease',
          boxShadow: isBlank ? '0 0 10px #94a3b8, 0 0 20px rgba(148, 163, 184, 0.5)' : 'none'
        }}
      >
        {t('display.blank')}
      </button>

      {/* Display Mode Dropdown */}
      <div style={{ position: 'relative' }}>
        <button
          ref={buttonRef}
          onClick={toggleDropdown}
          style={{
            background: isActive ? '#06b6d4' : 'rgba(255,255,255,0.1)',
            border: '1px solid #06b6d4',
            borderRadius: '6px',
            padding: '5px 10px',
            color: isActive ? '#000' : '#06b6d4',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.75rem',
            transition: 'all 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          {modeLabels[currentMode]}
          {chevronDown}
        </button>

        {showDropdown && dropdownPos && (
          <div ref={dropdownRef} style={{
            position: 'fixed',
            bottom: window.innerHeight - dropdownPos.top + 4,
            ...(isRTL ? { left: dropdownPos.left } : { right: window.innerWidth - dropdownPos.left }),
            background: '#1e1e2e',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '8px',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
            minWidth: '200px',
            zIndex: 9999
          }}>
            {(['bilingual', 'original', 'custom'] as UserDisplayMode[]).map(mode => {
              const isSelected = currentMode === mode;
              return (
                <div key={mode} style={{ display: 'flex', alignItems: 'center' }}>
                  <button
                    onClick={() => handleSelectMode(mode)}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      border: 'none',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      background: isSelected ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                      color: isSelected ? '#06b6d4' : 'rgba(255,255,255,0.8)',
                      fontWeight: isSelected ? 600 : 400
                    }}
                  >
                    {modeLabels[mode]}
                  </button>
                  {mode === 'custom' && (
                    <button
                      onClick={handleGearClick}
                      title={t('controlPanel.configureCustomDisplay', 'Configure custom display')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '6px 10px',
                        border: 'none',
                        background: 'transparent',
                        color: 'rgba(255,255,255,0.5)',
                        cursor: 'pointer',
                        borderInlineStart: '1px solid rgba(255,255,255,0.1)',
                        flexShrink: 0
                      }}
                    >
                      {gearIcon}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

SlideControlButtons.displayName = 'SlideControlButtons';

export default SlideControlButtons;
