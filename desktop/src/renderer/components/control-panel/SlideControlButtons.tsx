import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import BackgroundSelector from './BackgroundSelector';
import { colors } from '../../styles/controlPanelStyles';

interface SlideControlButtonsProps {
  isBlank: boolean;
  displayMode: 'bilingual' | 'original' | 'translation';
  showBackgroundDropdown: boolean;
  selectedBackground: string;
  isRTL: boolean;
  isQuickModeActive: boolean;
  onToggleBlank: () => void;
  onQuickModeClick: () => void;
  onToggleDisplayMode: () => void;
  onToggleBackgroundDropdown: () => void;
  onSelectBackground: (value: string) => void;
  onClearBackground: () => void;
}

const SlideControlButtons = memo<SlideControlButtonsProps>(({
  isBlank,
  displayMode,
  showBackgroundDropdown,
  selectedBackground,
  isRTL,
  isQuickModeActive,
  onToggleBlank,
  onQuickModeClick,
  onToggleDisplayMode,
  onToggleBackgroundDropdown,
  onSelectBackground,
  onClearBackground
}) => {
  const { t } = useTranslation();

  return (
    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
      <button
        onClick={onToggleBlank}
        style={{
          background: isBlank ? '#ffc107' : 'rgba(255,255,255,0.1)',
          border: 'none',
          borderRadius: '6px',
          padding: '5px 10px',
          color: isBlank ? '#000' : 'white',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '0.75rem'
        }}
      >
        {isBlank ? t('controlPanel.blankOn') : t('display.blank')}
      </button>
      <button
        onClick={onQuickModeClick}
        style={{
          background: isQuickModeActive ? '#6f42c1' : '#28a745',
          border: 'none',
          borderRadius: '6px',
          padding: '5px 10px',
          color: 'white',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '0.75rem',
          boxShadow: isQuickModeActive ? '0 0 10px #6f42c1, 0 0 20px rgba(111, 66, 193, 0.5)' : 'none',
          animation: isQuickModeActive ? 'quickModePulse 2s ease-in-out infinite' : 'none'
        }}
      >
        {isQuickModeActive ? '✏️ Quick Edit' : `⚡ ${t('controlPanel.quickMode')}`}
      </button>
      <button
        onClick={onToggleDisplayMode}
        style={{
          background: colors.button.info,
          border: 'none',
          borderRadius: '6px',
          padding: '5px 10px',
          color: 'white',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '0.75rem'
        }}
      >
        {displayMode === 'original' ? t('controlPanel.original') : t('controlPanel.bilingual')}
      </button>

      {/* Background Button with Dropdown */}
      <BackgroundSelector
        isOpen={showBackgroundDropdown}
        selectedBackground={selectedBackground}
        isRTL={isRTL}
        onToggle={onToggleBackgroundDropdown}
        onSelectBackground={onSelectBackground}
        onClearBackground={onClearBackground}
      />
    </div>
  );
});

SlideControlButtons.displayName = 'SlideControlButtons';

export default SlideControlButtons;
