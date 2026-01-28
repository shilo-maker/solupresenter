import React, { memo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '../../styles/controlPanelStyles';

interface Display {
  id: number;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  isAssigned?: boolean;
  assignedType?: 'viewer' | 'stage';
}

interface DisplayItemProps {
  display: Display;
  index: number;
  controlDisplayId: number | null;
  onIdentifyDisplay: (displayId: number) => Promise<void>;
  onCloseDisplay: (displayId: number) => void;
  onOpenSettings: (display: Display) => void;
  onSendStageMessage: (displayId: number, message: string) => Promise<void>;
}

const DisplayItem = memo<DisplayItemProps>(({
  display,
  index,
  controlDisplayId,
  onIdentifyDisplay,
  onCloseDisplay,
  onOpenSettings,
  onSendStageMessage
}) => {
  const { t } = useTranslation();
  // Local hover state - prevents parent re-renders
  const [isHovered, setIsHovered] = useState(false);
  const [showMessageInput, setShowMessageInput] = useState(false);
  const [stageMessage, setStageMessage] = useState('');

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);

  const handleIdentify = useCallback(async () => {
    try {
      await onIdentifyDisplay(display.id);
    } catch (err) {
      console.error('Failed to identify display:', err);
    }
  }, [display.id, onIdentifyDisplay]);

  const handleClose = useCallback(() => {
    onCloseDisplay(display.id);
  }, [display.id, onCloseDisplay]);

  const handleOpenSettings = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenSettings(display);
  }, [display, onOpenSettings]);

  const handleShowMessageInput = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMessageInput(true);
  }, []);

  const handleHideMessageInput = useCallback(() => {
    setShowMessageInput(false);
    setStageMessage('');
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (!stageMessage.trim()) return;
    try {
      await onSendStageMessage(display.id, stageMessage.trim());
      setStageMessage('');
      setShowMessageInput(false);
    } catch (err) {
      console.error('Failed to send stage message:', err);
    }
  }, [display.id, stageMessage, onSendStageMessage]);

  const handleMessageKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    } else if (e.key === 'Escape') {
      handleHideMessageInput();
    }
  }, [handleSendMessage, handleHideMessageInput]);

  const handleMessageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setStageMessage(e.target.value);
  }, []);

  return (
    <div
      className="display-row"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '8px',
        marginBottom: '8px',
        position: 'relative'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Display Number - Click to Identify */}
        <button
          onClick={handleIdentify}
          title={t('controlPanel.identifyDisplays', 'Click to identify this display')}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            background: 'rgba(255, 152, 0, 0.2)',
            border: '1px solid rgba(255, 152, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FF9800',
            fontWeight: 'bold',
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          {index + 1}
        </button>
        <div>
          <div style={{ color: 'white', fontWeight: 500 }}>
            {display.label}
            {display.isAssigned && (
              <span style={{
                marginLeft: '8px',
                fontSize: '0.7rem',
                background: '#28a745',
                padding: '2px 6px',
                borderRadius: '4px'
              }}>
                {display.assignedType}
              </span>
            )}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>
            {display.bounds.width}x{display.bounds.height}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        {/* Message input for stage displays */}
        {display.isAssigned && display.assignedType === 'stage' && showMessageInput && (
          <div
            style={{ display: 'flex', gap: '4px', alignItems: 'center' }}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="text"
              value={stageMessage}
              onChange={handleMessageChange}
              onKeyDown={handleMessageKeyDown}
              placeholder={t('controlPanel.typeMessage', 'Type message...')}
              autoFocus
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(236, 72, 153, 0.5)',
                borderRadius: '6px',
                padding: '6px 10px',
                color: 'white',
                fontSize: '0.8rem',
                width: '150px',
                outline: 'none'
              }}
            />
            <button
              onClick={handleSendMessage}
              style={{
                background: '#ec4899',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 10px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.75rem'
              }}
            >
              {t('common.send', 'Send')}
            </button>
            <button
              onClick={handleHideMessageInput}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '6px',
                padding: '6px',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}
        {/* Send Message icon - visible on hover for stage displays */}
        {display.isAssigned && display.assignedType === 'stage' && !showMessageInput && (
          <button
            onClick={handleShowMessageInput}
            title={t('controlPanel.sendMessage', 'Send message to stage')}
            style={{
              background: 'rgba(236, 72, 153, 0.2)',
              border: '1px solid rgba(236, 72, 153, 0.4)',
              borderRadius: '6px',
              padding: '6px',
              color: '#ec4899',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              opacity: isHovered ? 1 : 0,
              pointerEvents: isHovered ? 'auto' : 'none'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        )}
        {/* Settings icon - visible on hover when display is assigned */}
        {display.isAssigned && !showMessageInput && (
          <button
            onClick={handleOpenSettings}
            title={t('displaySettings.title', 'Display Settings')}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '6px',
              padding: '6px',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              opacity: isHovered ? 1 : 0,
              pointerEvents: isHovered ? 'auto' : 'none'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        )}
        {display.id === controlDisplayId ? (
          <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
            {t('controlPanel.controlScreen', 'Control Screen')}
          </span>
        ) : display.isAssigned ? (
          <button
            onClick={handleClose}
            style={{
              background: colors.button.danger,
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              color: 'white',
              fontSize: '0.75rem',
              cursor: 'pointer'
            }}
          >
            {t('common.close')}
          </button>
        ) : (
          /* Single Start button - opens settings modal for unassigned displays */
          <button
            onClick={handleOpenSettings}
            style={{
              background: colors.button.success,
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              color: 'white',
              fontSize: '0.75rem',
              cursor: 'pointer'
            }}
          >
            {t('controlPanel.start', 'Start')}
          </button>
        )}
      </div>
    </div>
  );
});

DisplayItem.displayName = 'DisplayItem';

export default DisplayItem;
