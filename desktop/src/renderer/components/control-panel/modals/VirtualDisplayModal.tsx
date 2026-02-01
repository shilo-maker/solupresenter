import React, { useState, useCallback, useMemo, useEffect, memo } from 'react';
import { useTranslation } from 'react-i18next';

interface VirtualDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, type: 'viewer' | 'stage') => void;
  isLoading?: boolean;
  error?: string | null;
  userPrefix?: string;
}

const VirtualDisplayModal = memo<VirtualDisplayModalProps>(({
  isOpen,
  onClose,
  onAdd,
  isLoading = false,
  error = null,
  userPrefix = 'user'
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [type, setType] = useState<'viewer' | 'stage'>('viewer');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setType('viewer');
    }
  }, [isOpen]);

  const slug = useMemo(() => {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
    return base ? `${userPrefix}-virtual-${base}` : '';
  }, [name, userPrefix]);

  const url = useMemo(() => {
    if (!slug) return '';
    return type === 'viewer'
      ? `https://solucast.app/viewer?room=${slug}`
      : `https://solucast.app/stage-monitor?room=${slug}`;
  }, [slug, type]);

  const isValid = name.trim().length > 0 && slug.length > 0;

  const handleSubmit = useCallback(() => {
    if (isValid && !isLoading) {
      onAdd(name.trim(), type);
      setName('');
      setType('viewer');
    }
  }, [name, type, isValid, isLoading, onAdd]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValid && !isLoading) {
      handleSubmit();
    }
  }, [handleSubmit, isValid, isLoading]);

  const handleContentClick = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
      }}
    >
      <div
        onClick={handleContentClick}
        style={{
          background: 'rgba(30, 30, 50, 0.98)',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.2)',
          padding: '24px',
          width: '420px',
          maxWidth: '90vw',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
        }}
      >
        <h3 style={{ margin: '0 0 20px 0', color: 'white', fontSize: '1.1rem' }}>
          {t('virtualDisplays.addTitle', 'Add Virtual Display')}
        </h3>

        {/* Name Input */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', marginBottom: '6px' }}>
            {t('virtualDisplays.displayName', 'Display Name')}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('virtualDisplays.namePlaceholder', 'e.g. Worship, Lobby')}
            autoFocus
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              color: 'white',
              fontSize: '0.9rem',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          {slug && (
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', marginTop: '4px' }}>
              Slug: {slug}
            </div>
          )}
        </div>

        {/* Type Toggle */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', marginBottom: '6px' }}>
            {t('virtualDisplays.displayType', 'Display Type')}
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setType('viewer')}
              style={{
                flex: 1,
                padding: '10px',
                background: type === 'viewer' ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255,255,255,0.05)',
                border: type === 'viewer' ? '1px solid rgba(76, 175, 80, 0.6)' : '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: type === 'viewer' ? 600 : 400
              }}
            >
              <div style={{ marginBottom: '4px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={type === 'viewer' ? '#4caf50' : 'rgba(255,255,255,0.5)'} strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: '6px' }}>
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                  <line x1="8" y1="21" x2="16" y2="21"/>
                  <line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
                {t('virtualDisplays.viewer', 'Viewer')}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>
                {t('virtualDisplays.viewerDesc', 'Shows lyrics & slides')}
              </div>
            </button>
            <button
              onClick={() => setType('stage')}
              style={{
                flex: 1,
                padding: '10px',
                background: type === 'stage' ? 'rgba(156, 39, 176, 0.3)' : 'rgba(255,255,255,0.05)',
                border: type === 'stage' ? '1px solid rgba(156, 39, 176, 0.6)' : '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: type === 'stage' ? 600 : 400
              }}
            >
              <div style={{ marginBottom: '4px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={type === 'stage' ? '#9c27b0' : 'rgba(255,255,255,0.5)'} strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: '6px' }}>
                  <rect x="2" y="7" width="20" height="15" rx="2" ry="2"/>
                  <polyline points="17 2 12 7 7 2"/>
                </svg>
                {t('virtualDisplays.stageMonitor', 'Stage Monitor')}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>
                {t('virtualDisplays.stageDesc', 'Shows current & next slide')}
              </div>
            </button>
          </div>
        </div>

        {/* URL Preview */}
        {url && (
          <div style={{
            marginBottom: '16px',
            padding: '10px 12px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', marginBottom: '4px' }}>
              {t('virtualDisplays.shareableUrl', 'Shareable URL')}
            </div>
            <div style={{
              color: '#06b6d4',
              fontSize: '0.8rem',
              wordBreak: 'break-all',
              fontFamily: 'monospace'
            }}>
              {url}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            marginBottom: '16px',
            padding: '8px 12px',
            background: 'rgba(220, 53, 69, 0.15)',
            border: '1px solid rgba(220, 53, 69, 0.3)',
            borderRadius: '8px',
            color: '#dc3545',
            fontSize: '0.8rem'
          }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            onClick={() => { setName(''); setType('viewer'); onClose(); }}
            style={{
              padding: '8px 20px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || isLoading}
            style={{
              padding: '8px 20px',
              background: isValid && !isLoading ? '#06b6d4' : 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              cursor: isValid && !isLoading ? 'pointer' : 'not-allowed',
              fontSize: '0.85rem',
              fontWeight: 600,
              opacity: isValid && !isLoading ? 1 : 0.5
            }}
          >
            {isLoading ? t('common.adding', 'Adding...') : t('common.add', 'Add')}
          </button>
        </div>
      </div>
    </div>
  );
});

VirtualDisplayModal.displayName = 'VirtualDisplayModal';

export default VirtualDisplayModal;
