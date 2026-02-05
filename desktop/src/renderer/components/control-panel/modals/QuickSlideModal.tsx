import React, { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

interface QuickSlideModalProps {
  quickSlideText: string;
  quickSlideCount: number;
  quickSlideBroadcastIndex: number;
  isAutoGenerating: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  onClose: (text: string) => void;
  onUpdateCount: (text: string) => void;
  onAutoGenerate: () => void;
  onBroadcastSlide: (index: number) => void;
}

const QuickSlideModal = memo<QuickSlideModalProps>(({
  quickSlideText,
  quickSlideCount,
  quickSlideBroadcastIndex,
  isAutoGenerating,
  textareaRef,
  onClose,
  onUpdateCount,
  onAutoGenerate,
  onBroadcastSlide
}) => {
  const { t } = useTranslation();

  const getCurrentText = useCallback(() => {
    return textareaRef.current?.value || quickSlideText;
  }, [textareaRef, quickSlideText]);

  const handleClose = useCallback(() => {
    onClose(getCurrentText());
  }, [onClose, getCurrentText]);

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2100
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(24, 24, 27, 0.98)',
          borderRadius: '16px',
          padding: '24px',
          width: '600px',
          maxHeight: '80vh',
          overflow: 'auto',
          border: '1px solid rgba(255,255,255,0.2)'
        }}
      >
        <h3 style={{ color: 'white', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          ⚡ {t('quickSlide.title')}
        </h3>

        {/* Instructions */}
        <div style={{
          marginBottom: '16px',
          padding: '12px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '8px',
          fontSize: '0.85rem',
          color: 'rgba(255,255,255,0.7)'
        }}>
          <strong style={{ color: 'white' }}>How to use:</strong>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
            <li>{t('controlPanel.slidesSeparatedByBlankLine')}</li>
            <li>Line 1: Original text (Hebrew)</li>
            <li>Line 2: Transliteration</li>
            <li>Line 3: Translation</li>
          </ul>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          defaultValue={quickSlideText}
          onChange={(e) => onUpdateCount(e.target.value)}
          placeholder={"Slide 1:\nהללויה\nHallelujah\nPraise the Lord\n\nSlide 2:\nשלום\nShalom\nPeace"}
          style={{
            width: '100%',
            height: '200px',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            padding: '12px',
            color: 'white',
            fontSize: '1rem',
            fontFamily: 'monospace',
            lineHeight: '1.6',
            resize: 'vertical'
          }}
        />

        {/* Auto-generate button */}
        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={onAutoGenerate}
            disabled={isAutoGenerating}
            style={{
              background: isAutoGenerating ? 'rgba(255,255,255,0.1)' : '#6f42c1',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              color: 'white',
              cursor: isAutoGenerating ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {isAutoGenerating ? (
              <>
                <span style={{
                  display: 'inline-block',
                  width: '14px',
                  height: '14px',
                  border: '2px solid white',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                Processing...
              </>
            ) : (
              <>✨ Auto-Generate</>
            )}
          </button>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>
            Fill transliteration & translation for Hebrew lines
          </span>
        </div>

        {/* Slide buttons */}
        {quickSlideCount > 0 && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>Click to broadcast:</span>
              {Array.from({ length: quickSlideCount }, (_, idx) => (
                <button
                  key={`quick-slide-btn-${idx}`}
                  onClick={() => onBroadcastSlide(idx)}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    border: idx === quickSlideBroadcastIndex ? '2px solid #1e7e34' : '1px solid rgba(255,255,255,0.3)',
                    background: idx === quickSlideBroadcastIndex ? '#28a745' : 'rgba(255,255,255,0.1)',
                    color: 'white',
                    fontWeight: idx === quickSlideBroadcastIndex ? 700 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontSize: '1rem'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 24px',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
});

QuickSlideModal.displayName = 'QuickSlideModal';

export default QuickSlideModal;
