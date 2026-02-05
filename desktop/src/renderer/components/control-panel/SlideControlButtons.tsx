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
  onToggleBlank: () => void;
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
  onToggleBlank,
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
      <button
        onClick={onToggleDisplayMode}
        style={{
          background: displayMode === 'bilingual' ? '#06b6d4' : 'rgba(255,255,255,0.1)',
          border: '1px solid #06b6d4',
          borderRadius: '6px',
          padding: '5px 10px',
          color: displayMode === 'bilingual' ? '#000' : '#06b6d4',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '0.75rem',
          transition: 'all 0.15s ease'
        }}
      >
        {t('controlPanel.bilingual')}
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
