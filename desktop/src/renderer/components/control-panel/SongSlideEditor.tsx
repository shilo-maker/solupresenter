import React, { memo, useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

// Hook to block keyboard events from propagating to global handlers
const useKeyboardIsolation = (containerRef: React.RefObject<HTMLDivElement>, isActive: boolean) => {
  useEffect(() => {
    if (!isActive) return;
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (container.contains(e.target as Node)) {
        e.stopPropagation();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [containerRef, isActive]);
};

interface SongSlide {
  originalText: string;
  transliteration: string;
  translation: string;
  translationOverflow: string;
  verseType: string;
  translations?: Record<string, string>;
}

interface Song {
  id: string;
  title: string;
  originalLanguage?: string;
  slides: SongSlide[];
}

// Check if text contains Hebrew characters
const isHebrewText = (text: string) => /[\u0590-\u05FF]/.test(text);

const VERSE_TYPES = [
  'Intro', 'Verse', 'Verse1', 'Verse2', 'Verse3', 'Verse4',
  'PreChorus', 'Chorus', 'Bridge', 'Instrumental', 'Outro', 'Tag'
];

// Static styles extracted outside component
const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    overflow: 'hidden'
  },
  grid: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '8px',
    minHeight: 0,
    overflow: 'auto',
    alignContent: 'start',
    padding: '4px'
  },
  previewCard: {
    position: 'relative' as const,
    borderRadius: '6px',
    padding: '8px 10px',
    paddingLeft: '14px',
    cursor: 'pointer'
  },
  editCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    padding: '12px',
    background: 'rgba(102, 126, 234, 0.1)',
    border: '2px solid rgba(102, 126, 234, 0.5)',
    borderRadius: '10px',
    position: 'relative' as const
  },
  editHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    marginBottom: '4px'
  },
  label: { display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem', marginBottom: '3px' },
  input: {
    width: '100%',
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '5px',
    padding: '6px 8px',
    color: 'white',
    fontSize: '0.8rem',
    boxSizing: 'border-box' as const
  },
  buttonGroup: { display: 'flex', gap: '6px', marginTop: '8px' },
  cancelBtn: {
    flex: 1,
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '6px',
    padding: '6px 12px',
    color: 'white',
    cursor: 'pointer',
    fontSize: '0.75rem'
  },
  saveBtn: {
    flex: 1,
    background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 12px',
    color: 'white',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: 600
  },
  deleteBtn: {
    background: 'rgba(220, 53, 69, 0.2)',
    border: 'none',
    borderRadius: '4px',
    padding: '4px 8px',
    color: '#dc3545',
    cursor: 'pointer',
    fontSize: '0.7rem'
  },
  addButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '12px',
    background: 'rgba(255,255,255,0.02)',
    border: '2px dashed rgba(255,255,255,0.15)',
    borderRadius: '8px',
    color: 'rgba(255,255,255,0.5)',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: 500,
    minHeight: '60px'
  },
  selectedIndicator: {
    position: 'absolute' as const,
    left: '0',
    top: '0',
    bottom: '0',
    width: '4px',
    background: 'linear-gradient(180deg, #00d4ff 0%, #0099ff 100%)',
    borderRadius: '6px 0 0 6px'
  },
  originalText: {
    fontSize: '0.85rem',
    lineHeight: '1.3',
    color: 'white',
    textAlign: 'right' as const,
    direction: 'rtl' as const
  },
  autoGenBtn: {
    border: 'none',
    borderRadius: '4px',
    padding: '6px 10px',
    color: 'white',
    fontSize: '0.7rem',
    fontWeight: 600
  }
} as const;

// Memoized preview card component
interface SlidePreviewCardProps {
  slide: SongSlide;
  index: number;
  isSelected: boolean;
  slideColor: string;
  onSelectSlide: (index: number) => void;
}

const SlidePreviewCard = memo<SlidePreviewCardProps>(({
  slide,
  index,
  isSelected,
  slideColor,
  onSelectSlide
}) => {
  const handleClick = useCallback(() => onSelectSlide(index), [index, onSelectSlide]);

  const cardStyle = useMemo(() => ({
    ...styles.previewCard,
    border: isSelected ? '2px solid #00d4ff' : '2px solid rgba(255,255,255,0.1)',
    backgroundColor: slideColor && slideColor !== 'transparent'
      ? (isSelected ? slideColor : `${slideColor}99`)
      : (isSelected ? 'rgba(0, 212, 255, 0.2)' : 'rgba(0,0,0,0.3)'),
    boxShadow: isSelected ? '0 0 12px rgba(0, 212, 255, 0.6)' : 'none'
  }), [isSelected, slideColor]);

  const headerStyle = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: isSelected ? '#00d4ff' : 'rgba(255,255,255,0.7)',
    fontWeight: 'bold' as const,
    marginBottom: '4px',
    fontSize: '0.75rem'
  }), [isSelected]);

  return (
    <div onClick={handleClick} style={cardStyle}>
      {isSelected && <div style={styles.selectedIndicator} />}
      <div style={headerStyle}>
        {isSelected && <span style={{ fontSize: '0.7rem' }}>▶</span>}
        <span>{slide.verseType}</span>
      </div>
      <div style={styles.originalText}>{slide.originalText}</div>
    </div>
  );
});

SlidePreviewCard.displayName = 'SlidePreviewCard';

// Memoized edit form component
interface SlideEditFormProps {
  editedSlide: SongSlide;
  isAddingNew: boolean;
  isTransliterationLanguage: boolean;
  canDelete: boolean;
  selectStyle: React.CSSProperties;
  textareaStyle: React.CSSProperties;
  onUpdateField: (field: keyof SongSlide, value: string) => void;
  onAutoGenerate: () => void;
  onDelete: () => void;
  onSave: () => void;
  onCancel: () => void;
  isGenerating: boolean;
  saving: boolean;
}

const SlideEditForm = memo<SlideEditFormProps>(({
  editedSlide,
  isAddingNew,
  isTransliterationLanguage,
  canDelete,
  selectStyle,
  textareaStyle,
  onUpdateField,
  onAutoGenerate,
  onDelete,
  onSave,
  onCancel,
  isGenerating,
  saving
}) => {
  const { t } = useTranslation();

  const handleVerseTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdateField('verseType', e.target.value);
  }, [onUpdateField]);

  const handleOriginalChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdateField('originalText', e.target.value);
  }, [onUpdateField]);

  const handleTranslitChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateField('transliteration', e.target.value);
  }, [onUpdateField]);

  const handleTranslationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateField('translation', e.target.value);
  }, [onUpdateField]);

  const showAutoGenerate = useMemo(() =>
    isTransliterationLanguage &&
    editedSlide.originalText &&
    isHebrewText(editedSlide.originalText) &&
    (!editedSlide.transliteration || !editedSlide.translation),
    [isTransliterationLanguage, editedSlide.originalText, editedSlide.transliteration, editedSlide.translation]
  );

  const autoGenBtnStyle = useMemo(() => ({
    ...styles.autoGenBtn,
    background: isGenerating ? 'rgba(255,255,255,0.1)' : '#6f42c1',
    cursor: isGenerating ? 'not-allowed' : 'pointer'
  }), [isGenerating]);

  return (
    <div style={styles.editCard}>
      <div style={styles.editHeader}>
        <select value={editedSlide.verseType} onChange={handleVerseTypeChange} style={selectStyle}>
          {VERSE_TYPES.map(vt => <option key={vt} value={vt}>{vt}</option>)}
        </select>
        {isAddingNew ? (
          <span style={{ color: '#667eea', fontSize: '0.7rem', fontWeight: 600 }}>New Slide</span>
        ) : canDelete && (
          <button onClick={onDelete} style={styles.deleteBtn} disabled={saving}>
            {t('common.delete', 'Delete')}
          </button>
        )}
      </div>

      <div>
        <label style={styles.label}>{isTransliterationLanguage ? 'Original' : 'Lyrics'}</label>
        <textarea
          value={editedSlide.originalText}
          onChange={handleOriginalChange}
          placeholder={isTransliterationLanguage ? "הללויה" : "Enter lyrics..."}
          style={textareaStyle}
          autoFocus
        />
      </div>

      {isTransliterationLanguage && (
        <div>
          <label style={styles.label}>Transliteration</label>
          <input
            type="text"
            value={editedSlide.transliteration}
            onChange={handleTranslitChange}
            placeholder="Hallelujah"
            style={styles.input}
          />
        </div>
      )}

      <div>
        <label style={styles.label}>Translation</label>
        <input
          type="text"
          value={editedSlide.translation}
          onChange={handleTranslationChange}
          placeholder="Praise the Lord"
          style={styles.input}
        />
      </div>

      {showAutoGenerate && (
        <button onClick={onAutoGenerate} disabled={isGenerating} style={autoGenBtnStyle}>
          {isGenerating ? 'Generating...' : '✨ Auto-Generate'}
        </button>
      )}

      <div style={styles.buttonGroup}>
        <button onClick={onCancel} style={styles.cancelBtn} disabled={saving}>
          {t('common.cancel', 'Cancel')}
        </button>
        <button onClick={onSave} style={styles.saveBtn} disabled={saving}>
          {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
        </button>
      </div>
    </div>
  );
});

SlideEditForm.displayName = 'SlideEditForm';

// Main editor props
interface SongSlideEditorProps {
  song: Song;
  editingSlideIndex: number;
  displayMode: 'bilingual' | 'original' | 'translation';
  currentSlideIndex: number;
  liveSongId: string | null;
  isBlank: boolean;
  getVerseTypeColor: (verseType?: string) => string;
  onSave: (updatedSlides: SongSlide[]) => Promise<void>;
  onCancel: () => void;
  onSelectSlide: (index: number) => void;
}

const SongSlideEditor = memo<SongSlideEditorProps>(({
  song,
  editingSlideIndex,
  displayMode,
  currentSlideIndex,
  liveSongId,
  isBlank,
  getVerseTypeColor,
  onSave,
  onCancel,
  onSelectSlide
}) => {
  const { t } = useTranslation();
  const editFormRef = useRef<HTMLDivElement>(null);
  const isAddingNew = editingSlideIndex === -1;

  const [editedSlide, setEditedSlide] = useState<SongSlide>(() => {
    if (isAddingNew) {
      return {
        originalText: '',
        transliteration: '',
        translation: '',
        translationOverflow: '',
        verseType: 'Verse',
        translations: {}
      };
    }
    const existing = song.slides[editingSlideIndex];
    return {
      originalText: existing?.originalText || '',
      transliteration: existing?.transliteration || '',
      translation: existing?.translation || '',
      translationOverflow: existing?.translationOverflow || '',
      verseType: existing?.verseType || 'Verse',
      translations: (existing as any)?.translations || {}
    };
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  useKeyboardIsolation(editFormRef, true);

  const isTransliterationLanguage = useMemo(
    () => song.originalLanguage === 'he' || song.originalLanguage === 'ar',
    [song.originalLanguage]
  );

  const updateField = useCallback((field: keyof SongSlide, value: string) => {
    setEditedSlide(prev => {
      const updated = { ...prev, [field]: value };
      // Sync translations map when translation field changes
      if (field === 'translation') {
        const translations = { ...(prev.translations || {}) };
        const parts = [value || '', prev.translationOverflow || ''].filter(Boolean);
        if (parts.length > 0) {
          translations['en'] = parts.join('\n');
        } else {
          delete translations['en'];
        }
        updated.translations = translations;
      }
      return updated;
    });
  }, []);

  const handleAutoGenerate = useCallback(async () => {
    if (!editedSlide.originalText || !isHebrewText(editedSlide.originalText)) return;

    setIsGenerating(true);
    try {
      const result = await window.electronAPI.processQuickSlide(editedSlide.originalText);
      setEditedSlide(prev => {
        const newTranslation = result?.translation ?? prev.translation;
        const translations = { ...(prev.translations || {}) };
        if (newTranslation) {
          translations['en'] = newTranslation;
        }
        return {
          ...prev,
          transliteration: result?.transliteration ?? prev.transliteration,
          translation: newTranslation,
          translations
        };
      });
    } catch (error) {
      console.error('Error auto-generating:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [editedSlide.originalText]);

  const handleSave = useCallback(async () => {
    if (!editedSlide.originalText.trim()) {
      alert('Please enter slide content');
      return;
    }

    setSaving(true);
    try {
      const newSlides = [...song.slides];
      if (isAddingNew) {
        newSlides.push(editedSlide);
      } else {
        newSlides[editingSlideIndex] = editedSlide;
      }
      await onSave(newSlides);
    } catch (error) {
      console.error('Error saving slide:', error);
    } finally {
      setSaving(false);
    }
  }, [editedSlide, song.slides, isAddingNew, editingSlideIndex, onSave]);

  const handleDelete = useCallback(async () => {
    if (isAddingNew || song.slides.length <= 1) return;
    if (!confirm('Delete this slide?')) return;

    setSaving(true);
    try {
      const newSlides = song.slides.filter((_, i) => i !== editingSlideIndex);
      await onSave(newSlides);
    } catch (error) {
      console.error('Error deleting slide:', error);
    } finally {
      setSaving(false);
    }
  }, [isAddingNew, song.slides, editingSlideIndex, onSave]);

  // Memoized styles
  const bgColor = useMemo(
    () => getVerseTypeColor(editedSlide.verseType),
    [editedSlide.verseType, getVerseTypeColor]
  );

  const selectStyle = useMemo(() => ({
    background: bgColor || 'rgba(30,30,30,0.9)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '4px',
    padding: '4px 8px',
    color: 'white',
    fontSize: '0.7rem',
    fontWeight: 600,
    cursor: 'pointer',
    colorScheme: 'dark' as const
  }), [bgColor]);

  const textareaStyle = useMemo(() => ({
    ...styles.input,
    padding: '8px',
    fontSize: '0.85rem',
    lineHeight: '1.4',
    resize: 'none' as const,
    minHeight: '60px',
    direction: isTransliterationLanguage ? 'rtl' as const : 'ltr' as const
  }), [isTransliterationLanguage]);

  // Memoized cancel button hover handlers
  const handleCancelMouseEnter = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
  }, []);

  const handleCancelMouseLeave = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.grid}>
        {/* Render all slides */}
        {song.slides.map((slide, idx) => {
          const isSelected = idx === currentSlideIndex && !isBlank && liveSongId === song.id;
          const slideColor = getVerseTypeColor(slide.verseType);
          const isEditing = idx === editingSlideIndex;

          if (isEditing) {
            return (
              <div key={`slide-edit-${idx}`} ref={editFormRef}>
                <SlideEditForm
                  editedSlide={editedSlide}
                  isAddingNew={false}
                  isTransliterationLanguage={isTransliterationLanguage}
                  canDelete={song.slides.length > 1}
                  selectStyle={selectStyle}
                  textareaStyle={textareaStyle}
                  onUpdateField={updateField}
                  onAutoGenerate={handleAutoGenerate}
                  onDelete={handleDelete}
                  onSave={handleSave}
                  onCancel={onCancel}
                  isGenerating={isGenerating}
                  saving={saving}
                />
              </div>
            );
          }

          return (
            <SlidePreviewCard
              key={`slide-preview-${idx}`}
              slide={slide}
              index={idx}
              isSelected={isSelected}
              slideColor={slideColor}
              onSelectSlide={onSelectSlide}
            />
          );
        })}

        {/* Add new slide form or cancel button */}
        {isAddingNew ? (
          <div ref={editFormRef}>
            <SlideEditForm
              editedSlide={editedSlide}
              isAddingNew={true}
              isTransliterationLanguage={isTransliterationLanguage}
              canDelete={false}
              selectStyle={selectStyle}
              textareaStyle={textareaStyle}
              onUpdateField={updateField}
              onAutoGenerate={handleAutoGenerate}
              onDelete={handleDelete}
              onSave={handleSave}
              onCancel={onCancel}
              isGenerating={isGenerating}
              saving={saving}
            />
          </div>
        ) : (
          <button
            style={styles.addButton}
            onClick={onCancel}
            onMouseEnter={handleCancelMouseEnter}
            onMouseLeave={handleCancelMouseLeave}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            {t('common.cancel', 'Cancel Edit')}
          </button>
        )}
      </div>
    </div>
  );
});

SongSlideEditor.displayName = 'SongSlideEditor';

export default SongSlideEditor;
