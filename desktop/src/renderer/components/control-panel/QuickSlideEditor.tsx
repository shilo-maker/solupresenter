import React, { memo, useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

// Hook to block keyboard events from propagating to global handlers
const useKeyboardIsolation = (containerRef: React.RefObject<HTMLDivElement>) => {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if the event originated from inside this container
      if (container.contains(e.target as Node)) {
        // Stop the event from reaching window-level listeners
        e.stopPropagation();
      }
    };

    // Use capture phase to intercept before other handlers
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [containerRef]);
};

interface SlideData {
  originalText: string;
  transliteration: string;
  translation: string;
  verseType: string;
}

// Check if text contains Hebrew characters
const isHebrewText = (text: string) => /[\u0590-\u05FF]/.test(text);

interface QuickSlideEditorProps {
  quickSlideText: string;
  quickSlideCount: number;
  quickSlideBroadcastIndex: number;
  isAutoGenerating: boolean;
  displayMode?: 'bilingual' | 'original' | 'translation';
  onTextChange: (text: string) => void;
  onUpdateCount: (text: string) => void;
  onAutoGenerate: () => void;
  onBroadcastSlide: (index: number, text: string) => void;
}

const QuickSlideEditor = memo<QuickSlideEditorProps>(({
  quickSlideText,
  quickSlideCount,
  quickSlideBroadcastIndex,
  isAutoGenerating,
  displayMode = 'bilingual',
  onTextChange,
  onUpdateCount,
  onAutoGenerate,
  onBroadcastSlide
}) => {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [generatingSlides, setGeneratingSlides] = useState<Set<number>>(new Set());

  // Isolate keyboard events inside this component from global handlers
  useKeyboardIsolation(containerRef);

  // Focus textarea when mounted
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Split text into blocks (keep empty blocks for proper indexing)
  const textBlocks = useMemo(() => {
    if (!quickSlideText) return [''];
    const blocks = quickSlideText.split(/\n\s*\n/);
    return blocks.length > 0 ? blocks : [''];
  }, [quickSlideText]);

  // Auto-generate for a single slide
  const autoGenerateSlide = useCallback(async (slideIndex: number) => {
    const block = textBlocks[slideIndex];
    if (!block) return;

    const lines = block.split('\n').map(l => l.trim());
    const originalText = lines[0] || '';

    // Only generate if we have Hebrew text and missing lines
    if (!isHebrewText(originalText) || (lines[1] && lines[2])) return;

    setGeneratingSlides(prev => new Set(prev).add(slideIndex));

    try {
      const result = await window.electronAPI.processQuickSlide(originalText);
      const newBlock = `${result.original}\n${result.transliteration}\n${result.translation}`;

      const newBlocks = [...textBlocks];
      newBlocks[slideIndex] = newBlock;
      const newText = newBlocks.join('\n\n');
      onTextChange(newText);
      onUpdateCount(newText);
    } catch (error) {
      console.error('Error auto-generating slide:', error);
    }

    setGeneratingSlides(prev => {
      const next = new Set(prev);
      next.delete(slideIndex);
      return next;
    });
  }, [textBlocks, onTextChange, onUpdateCount]);

  // Parse blocks into slide data for preview
  const parsedSlides = useMemo((): SlideData[] => {
    return textBlocks.map((block, idx) => {
      const lines = block.split('\n').map(l => l.trim());
      return {
        originalText: lines[0] || '',
        transliteration: lines[1] || '',
        translation: lines[2] || '',
        verseType: `Slide ${idx + 1}`
      };
    });
  }, [textBlocks]);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        overflow: 'hidden'
      }}
    >
      {/* Main content area - responsive grid with smaller cards */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 280px))',
        gap: '10px',
        minHeight: 0,
        overflow: 'auto',
        alignContent: 'start',
        justifyContent: 'center'
      }}>
        {/* Slide cards */}
        {parsedSlides.map((slide, idx) => {
          // Calculate the non-empty index for this slide (for matching with broadcast index)
          const nonEmptyIndex = slide.originalText.trim()
            ? parsedSlides.slice(0, idx + 1).filter(s => s.originalText.trim()).length - 1
            : -1;
          const isSelected = nonEmptyIndex >= 0 && nonEmptyIndex === quickSlideBroadcastIndex;
          const blockText = textBlocks[idx] || '';

          return (
            <div key={`quick-slide-${idx}`} style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '10px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px',
              position: 'relative'
            }}>
              {/* Header with slide number and delete button */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '6px'
              }}>
                <span style={{
                  color: 'rgba(255,255,255,0.5)',
                  fontWeight: 600,
                  fontSize: '0.7rem'
                }}>
                  {slide.verseType}
                </span>
                {parsedSlides.length > 1 && (
                  <button
                    className="quick-slide-delete-btn"
                    onClick={() => {
                      const newBlocks = textBlocks.filter((_, i) => i !== idx);
                      const newText = newBlocks.join('\n\n');
                      onTextChange(newText || '');
                      onUpdateCount(newText || '');
                    }}
                    title={t('common.delete', 'Delete')}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Text input */}
              <textarea
                ref={idx === 0 ? textareaRef : undefined}
                value={blockText}
                onChange={(e) => {
                  const newBlocks = [...textBlocks];
                  newBlocks[idx] = e.target.value;
                  const newText = newBlocks.join('\n\n');
                  onTextChange(newText);
                  onUpdateCount(newText);
                }}
                placeholder={idx === 0 ? "הללויה\nHallelujah\nPraise the Lord" : "Enter text..."}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(111, 66, 193, 0.3)',
                  borderRadius: '5px',
                  padding: '8px 10px',
                  color: 'white',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                  lineHeight: '1.4',
                  resize: 'none',
                  minHeight: '88px',
                  boxSizing: 'border-box'
                }}
              />

              {/* Slide preview card - styled like SlideGridItem */}
              <div
                className={`quick-slide-preview${isSelected ? ' selected' : ''}${!slide.originalText ? ' empty' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (slide.originalText) {
                    const nonEmptyIndex = parsedSlides
                      .slice(0, idx + 1)
                      .filter(s => s.originalText.trim()).length - 1;
                    onBroadcastSlide(nonEmptyIndex, quickSlideText);
                  }
                }}
              >
                {/* Slide header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: isSelected ? '#c4b5fd' : '#a78bfa',
                  fontWeight: 'bold',
                  marginBottom: '6px',
                  fontSize: '0.7rem'
                }}>
                  {isSelected && <span>▶</span>}
                  <span>{slide.verseType}</span>
                </div>
                {/* Slide content */}
                {slide.originalText ? (
                  <div style={{ fontSize: '0.8rem', lineHeight: '1.4', color: 'white', textAlign: 'left' }}>
                    <div style={{ marginBottom: displayMode === 'bilingual' ? '3px' : 0, fontWeight: 500 }}>
                      {slide.originalText}
                    </div>
                    {displayMode === 'bilingual' && slide.transliteration && (
                      <div style={{ marginBottom: '3px', color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', fontStyle: 'italic' }}>
                        {slide.transliteration}
                      </div>
                    )}
                    {displayMode === 'bilingual' && slide.translation && (
                      <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem' }}>
                        {slide.translation}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', fontSize: '0.75rem', textAlign: 'center' }}>
                    {t('quickSlide.clickToBroadcast', 'Click to broadcast')}
                  </div>
                )}
              </div>

              {/* Auto-Generate button */}
              {slide.originalText && isHebrewText(slide.originalText) && (!slide.transliteration || !slide.translation) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    autoGenerateSlide(idx);
                  }}
                  disabled={generatingSlides.has(idx)}
                  style={{
                    background: generatingSlides.has(idx) ? 'rgba(255,255,255,0.1)' : '#6f42c1',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '6px 10px',
                    color: 'white',
                    cursor: generatingSlides.has(idx) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    width: '100%'
                  }}
                >
                  {generatingSlides.has(idx) ? (
                    <>
                      <span style={{
                        display: 'inline-block',
                        width: '10px',
                        height: '10px',
                        border: '2px solid white',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                      Generating...
                    </>
                  ) : (
                    <>✨ Auto-Generate</>
                  )}
                </button>
              )}
            </div>
          );
        })}

        {/* Add new slide button */}
        <button
          className="quick-slide-add-btn"
          onClick={() => {
            const newText = quickSlideText.trim() ? quickSlideText + '\n\n' : '';
            onTextChange(newText);
            onUpdateCount(newText);
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {t('quickSlide.addSlide', 'Add Slide')}
        </button>
      </div>

      {/* Bottom status bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
          {quickSlideCount > 0 ? `${quickSlideCount} slides` : t('quickSlide.enterTextToCreate', 'Enter text to create slides')}
        </span>
      </div>
    </div>
  );
});

QuickSlideEditor.displayName = 'QuickSlideEditor';

export default QuickSlideEditor;
