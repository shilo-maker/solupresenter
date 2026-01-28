import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface SlideData {
  originalText?: string;
  transliteration?: string;
  translation?: string;
  translationOverflow?: string;
  verseType?: string;
}

interface SlideEditorModalProps {
  slide: SlideData;
  slideIndex: number;
  originalLanguage: string;
  isNewSlide?: boolean;
  onClose: () => void;
  onSave: (slideIndex: number, updatedSlide: SlideData) => Promise<void>;
  onDelete?: (slideIndex: number) => Promise<void>;
}

const verseTypes = [
  'Intro',
  'Verse',
  'Verse1',
  'Verse2',
  'Verse3',
  'Verse4',
  'PreChorus',
  'Chorus',
  'Bridge',
  'Instrumental',
  'Outro',
  'Tag'
];

const SlideEditorModal: React.FC<SlideEditorModalProps> = ({
  slide,
  slideIndex,
  originalLanguage,
  isNewSlide = false,
  onClose,
  onSave,
  onDelete
}) => {
  const { t } = useTranslation();
  const [editingSlide, setEditingSlide] = useState<SlideData>({ ...slide });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!confirm('Are you sure you want to delete this slide?')) return;

    setIsDeleting(true);
    try {
      await onDelete(slideIndex);
    } finally {
      setIsDeleting(false);
    }
  };

  const isTransliterationLanguage = originalLanguage === 'he' || originalLanguage === 'ar';

  const updateField = (field: keyof SlideData, value: string) => {
    setEditingSlide(prev => ({ ...prev, [field]: value }));
  };

  const autoGenerateContent = async () => {
    if (!editingSlide.originalText?.trim()) return;

    try {
      const result = await window.electronAPI.processQuickSlide(editingSlide.originalText);
      setEditingSlide(prev => ({
        ...prev,
        transliteration: result.transliteration,
        translation: result.translation
      }));
    } catch (error) {
      console.error('Failed to auto-generate:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(slideIndex, editingSlide);
    } finally {
      setIsSaving(false);
    }
  };

  const canSave = editingSlide.originalText?.trim();

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(135deg, rgba(30,30,50,0.98), rgba(20,20,40,0.98))',
          borderRadius: '16px',
          padding: '24px',
          width: '600px',
          maxHeight: '80vh',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid rgba(255,255,255,0.2)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ color: 'white', margin: 0, fontSize: '1.2rem' }}>
            {isNewSlide ? 'Add New Slide' : `Edit Slide ${slideIndex + 1}`}
            {!isNewSlide && editingSlide.verseType && (
              <span style={{ color: 'rgba(255,255,255,0.5)', marginLeft: '8px', fontSize: '0.9rem' }}>
                ({editingSlide.verseType})
              </span>
            )}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 8px',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>

        {/* Form Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Verse Type */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginBottom: '4px' }}>
                {t('controlPanel.verseType')}
              </label>
              <select
                value={editingSlide.verseType || 'Verse'}
                onChange={(e) => updateField('verseType', e.target.value)}
                style={{
                  width: '100%',
                  background: '#2a2a3e',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  color: 'white',
                  fontSize: '0.85rem'
                }}
              >
                {verseTypes.map(type => (
                  <option key={type} value={type} style={{ background: '#2a2a3e', color: 'white' }}>{type}</option>
                ))}
              </select>
            </div>
            {isTransliterationLanguage && (
              <button
                onClick={autoGenerateContent}
                style={{
                  background: 'rgba(102, 126, 234, 0.3)',
                  border: '1px solid rgba(102, 126, 234, 0.5)',
                  borderRadius: '6px',
                  padding: '8px 14px',
                  color: '#667eea',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  whiteSpace: 'nowrap'
                }}
              >
                Auto-Generate
              </button>
            )}
          </div>

          {/* Original Text */}
          <div>
            <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginBottom: '4px' }}>
              {isTransliterationLanguage ? 'Original Text *' : 'Lyrics *'}
            </label>
            <textarea
              value={editingSlide.originalText || ''}
              onChange={(e) => updateField('originalText', e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                padding: '10px',
                color: 'white',
                fontSize: '1rem',
                fontFamily: isTransliterationLanguage ? 'Arial, sans-serif' : 'inherit',
                resize: 'vertical',
                minHeight: '60px',
                direction: isTransliterationLanguage ? 'rtl' : 'ltr',
                textAlign: isTransliterationLanguage ? 'right' : 'left'
              }}
              placeholder={isTransliterationLanguage ? 'Enter original text...' : 'Enter lyrics...'}
            />
          </div>

          {/* Transliteration */}
          <div>
            <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginBottom: '4px' }}>
              {isTransliterationLanguage ? 'Transliteration' : 'Additional Lyrics'}
            </label>
            <textarea
              value={editingSlide.transliteration || ''}
              onChange={(e) => updateField('transliteration', e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                padding: '10px',
                color: 'white',
                fontSize: '0.9rem',
                resize: 'vertical',
                minHeight: '50px'
              }}
              placeholder={isTransliterationLanguage ? 'Enter transliteration...' : 'Additional lyrics...'}
            />
          </div>

          {/* Translation */}
          <div>
            <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginBottom: '4px' }}>
              {isTransliterationLanguage ? 'Translation' : 'Additional Lyrics'}
            </label>
            <textarea
              value={editingSlide.translation || ''}
              onChange={(e) => updateField('translation', e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                padding: '10px',
                color: 'white',
                fontSize: '0.9rem',
                resize: 'vertical',
                minHeight: '50px'
              }}
              placeholder={isTransliterationLanguage ? 'Enter translation...' : 'Additional lyrics...'}
            />
          </div>
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex',
          gap: '10px',
          justifyContent: 'space-between',
          marginTop: '24px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(255,255,255,0.1)'
        }}>
          {/* Delete button - only show when editing existing slide */}
          <div>
            {!isNewSlide && onDelete && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                style={{
                  background: 'rgba(220, 53, 69, 0.2)',
                  border: '1px solid rgba(220, 53, 69, 0.5)',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  color: '#dc3545',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  fontWeight: 500
                }}
              >
                {isDeleting ? 'Deleting...' : 'Delete Slide'}
              </button>
            )}
          </div>

          {/* Save/Cancel buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                padding: '10px 20px',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave || isSaving}
              style={{
                background: canSave && !isSaving
                  ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)'
                  : 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 24px',
                color: 'white',
                cursor: canSave && !isSaving ? 'pointer' : 'not-allowed',
                fontWeight: 600
              }}
            >
              {isSaving ? 'Saving...' : (isNewSlide ? 'Add Slide' : 'Save Slide')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SlideEditorModal;
