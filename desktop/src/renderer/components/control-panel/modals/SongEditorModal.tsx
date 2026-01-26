import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../styles/controlPanelStyles';

interface SongSlide {
  originalText: string;
  transliteration: string;
  translation: string;
  translationOverflow: string;
  verseType: string;
}

interface EditingSong {
  id?: string;
  title: string;
  author: string;
  originalLanguage: string;
  tags: string[];
  slides: SongSlide[];
}

interface SongEditorModalProps {
  song: EditingSong | null;
  onClose: () => void;
  onSave: (song: EditingSong) => Promise<void>;
}

const songLanguages = [
  { code: 'he', name: 'Hebrew (עברית)' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish (Español)' },
  { code: 'fr', name: 'French (Français)' },
  { code: 'de', name: 'German (Deutsch)' },
  { code: 'ru', name: 'Russian (Русский)' },
  { code: 'ar', name: 'Arabic (العربية)' },
  { code: 'other', name: 'Other' }
];

const SongEditorModal: React.FC<SongEditorModalProps> = ({ song, onClose, onSave }) => {
  const { t } = useTranslation();

  // Initialize editing state from the provided song
  const [editingSong, setEditingSong] = useState<EditingSong>(() => song || {
    title: '',
    author: '',
    originalLanguage: 'he',
    tags: [],
    slides: [{ originalText: '', transliteration: '', translation: '', translationOverflow: '', verseType: 'Verse' }]
  });

  const [editingSlideIndex, setEditingSlideIndex] = useState(0);
  const [expressMode, setExpressMode] = useState(true);
  const [expressText, setExpressText] = useState(() => {
    // Initialize express text from song slides if editing existing song
    if (song && song.slides.length > 0) {
      let lastVerseType = '';
      return song.slides
        .filter(slide => slide.originalText)
        .map(slide => {
          const lines: string[] = [];
          if (slide.verseType && slide.verseType !== lastVerseType) {
            lines.push(`[${slide.verseType}]`);
            lastVerseType = slide.verseType;
          }
          lines.push(slide.originalText);
          if (slide.transliteration) lines.push(slide.transliteration);
          if (slide.translation) lines.push(slide.translation);
          if (slide.translationOverflow) lines.push(slide.translationOverflow);
          return lines.join('\n');
        }).join('\n\n');
    }
    return '';
  });
  const [tagInput, setTagInput] = useState('');

  // Check if language needs transliteration structure
  const isTransliterationLanguage = editingSong.originalLanguage === 'he' || editingSong.originalLanguage === 'ar';

  // Slide management functions
  const addSlide = () => {
    const newSlides = [...editingSong.slides, {
      originalText: '',
      transliteration: '',
      translation: '',
      translationOverflow: '',
      verseType: 'Verse'
    }];
    setEditingSong({ ...editingSong, slides: newSlides });
    setEditingSlideIndex(newSlides.length - 1);
  };

  const removeSlide = (index: number) => {
    if (editingSong.slides.length <= 1) return;
    const newSlides = editingSong.slides.filter((_, i) => i !== index);
    setEditingSong({ ...editingSong, slides: newSlides });
    if (editingSlideIndex >= newSlides.length) {
      setEditingSlideIndex(newSlides.length - 1);
    }
  };

  const updateSlide = (field: string, value: string) => {
    const newSlides = [...editingSong.slides];
    newSlides[editingSlideIndex] = { ...newSlides[editingSlideIndex], [field]: value };
    setEditingSong({ ...editingSong, slides: newSlides });
  };

  const autoGenerateContent = async () => {
    const slide = editingSong.slides[editingSlideIndex];
    if (!slide.originalText.trim()) return;

    try {
      const result = await window.electronAPI.processQuickSlide(slide.originalText);
      const newSlides = [...editingSong.slides];
      newSlides[editingSlideIndex] = {
        ...newSlides[editingSlideIndex],
        transliteration: result.transliteration,
        translation: result.translation
      };
      setEditingSong({ ...editingSong, slides: newSlides });
    } catch (error) {
      console.error('Failed to auto-generate:', error);
    }
  };

  // Express mode functions
  const parseExpressText = (): SongSlide[] => {
    const slideBlocks = expressText.split(/\n\s*\n/);
    let currentVerseType = 'Verse';

    const parsedSlides: SongSlide[] = [];

    for (const block of slideBlocks) {
      const lines = block.split('\n').map(line => line.trim()).filter(line => line);
      if (lines.length === 0) continue;

      const verseTypeMatch = lines[0].match(/^\[(.+)\]$/);
      if (verseTypeMatch) {
        currentVerseType = verseTypeMatch[1];
        lines.shift();
        if (lines.length === 0) continue;
      }

      const originalText = lines[0] || '';
      if (originalText) {
        parsedSlides.push({
          originalText,
          transliteration: lines[1] || '',
          translation: lines[2] || '',
          translationOverflow: lines[3] || '',
          verseType: currentVerseType
        });
      }
    }

    return parsedSlides.length > 0 ? parsedSlides : [{
      originalText: '',
      transliteration: '',
      translation: '',
      translationOverflow: '',
      verseType: 'Verse'
    }];
  };

  const convertSlidesToExpressText = (): string => {
    let lastVerseType = '';
    return editingSong.slides
      .filter(slide => slide.originalText)
      .map(slide => {
        const lines: string[] = [];
        if (slide.verseType && slide.verseType !== lastVerseType) {
          lines.push(`[${slide.verseType}]`);
          lastVerseType = slide.verseType;
        }
        lines.push(slide.originalText);
        if (slide.transliteration) lines.push(slide.transliteration);
        if (slide.translation) lines.push(slide.translation);
        if (slide.translationOverflow) lines.push(slide.translationOverflow);
        return lines.join('\n');
      }).join('\n\n');
  };

  const toggleExpressMode = () => {
    if (!expressMode) {
      setExpressText(convertSlidesToExpressText());
    } else {
      const parsed = parseExpressText();
      setEditingSong(prev => ({ ...prev, slides: parsed }));
      setEditingSlideIndex(0);
    }
    setExpressMode(!expressMode);
  };

  // Tag functions
  const addTag = (tag: string) => {
    const trimmedTag = tag.trim().toLowerCase();
    if (trimmedTag && !editingSong.tags.includes(trimmedTag)) {
      setEditingSong({ ...editingSong, tags: [...editingSong.tags, trimmedTag] });
    }
    setTagInput('');
  };

  const removeTag = (tagToRemove: string) => {
    setEditingSong({ ...editingSong, tags: editingSong.tags.filter(tag => tag !== tagToRemove) });
  };

  // Save handler
  const handleSave = async () => {
    if (!editingSong.title.trim()) return;

    let slidesToSave = editingSong.slides;
    if (expressMode) {
      slidesToSave = parseExpressText();
    }

    const validSlides = slidesToSave.filter(slide => slide.originalText.trim());
    if (validSlides.length === 0) {
      alert('Please add at least one slide with content');
      return;
    }

    await onSave({ ...editingSong, slides: validSlides });
  };

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
          width: '1000px',
          height: '85vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid rgba(255,255,255,0.2)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ color: 'white', margin: 0, fontSize: '1.2rem' }}>
            {editingSong.id ? 'Edit Song' : 'New Song'}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={toggleExpressMode}
              style={{
                background: expressMode ? '#17a2b8' : 'rgba(255,255,255,0.1)',
                border: expressMode ? 'none' : '1px solid rgba(255,255,255,0.2)',
                borderRadius: '6px',
                padding: '6px 12px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 500
              }}
            >
              {expressMode ? 'Standard Mode' : 'Express Mode ⚡'}
            </button>
            <button
              onClick={onClose}
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', padding: '4px 8px', color: 'white', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Song Info Row */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
          <div style={{ flex: 2 }}>
            <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginBottom: '4px' }}>Song Title *</label>
            <input
              type="text"
              value={editingSong.title}
              onChange={(e) => setEditingSong({ ...editingSong, title: e.target.value })}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                padding: '10px',
                color: 'white',
                fontSize: '0.9rem'
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginBottom: '4px' }}>{t('controlPanel.author')}</label>
            <input
              type="text"
              value={editingSong.author}
              onChange={(e) => setEditingSong({ ...editingSong, author: e.target.value })}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                padding: '10px',
                color: 'white',
                fontSize: '0.9rem'
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginBottom: '4px' }}>{t('controlPanel.language')}</label>
            <select
              value={editingSong.originalLanguage}
              onChange={(e) => setEditingSong({ ...editingSong, originalLanguage: e.target.value })}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                padding: '10px',
                color: 'white',
                fontSize: '0.9rem'
              }}
            >
              {songLanguages.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tags Row */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem' }}>Tags:</span>
            {editingSong.tags.map(tag => (
              <span
                key={tag}
                onClick={() => removeTag(tag)}
                style={{
                  background: colors.button.info,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  color: 'white',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {tag} <span style={{ opacity: 0.7 }}>✕</span>
              </span>
            ))}
            <input
              type="text"
              placeholder="Add tag..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); } }}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                padding: '4px 10px',
                color: 'white',
                fontSize: '0.75rem',
                width: '100px'
              }}
            />
          </div>
        </div>

        {/* Main Content Area */}
        {expressMode ? (
          /* Express Mode Editor */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{
              padding: '12px',
              background: 'rgba(23, 162, 184, 0.1)',
              borderRadius: '8px',
              marginBottom: '12px',
              border: '1px solid rgba(23, 162, 184, 0.3)'
            }}>
              <div style={{ color: '#17a2b8', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>{t('controlPanel.expressModeInstructions')}</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', lineHeight: 1.5 }}>
                • Separate slides with a blank line<br/>
                • Use [VerseType] markers: [Verse1], [Chorus], [Bridge], [Intro], etc.<br/>
                {isTransliterationLanguage ? (
                  <>• Line 1: Original text, Line 2: Transliteration, Line 3: Translation, Line 4: Overflow</>
                ) : (
                  <>• Each line becomes a lyric line for the slide</>
                )}
              </div>
            </div>
            <textarea
              value={expressText}
              onChange={(e) => setExpressText(e.target.value)}
              placeholder={isTransliterationLanguage
                ? "[Verse1]\nשָׁלוֹם עֲלֵיכֶם\nShalom Aleichem\nPeace be upon you\n\n[Chorus]\nמַלְאֲכֵי הַשָּׁרֵת\nMalachei HaShareit\nAngels of service"
                : "[Verse1]\nAmazing grace, how sweet the sound\nThat saved a wretch like me\n\n[Chorus]\nI once was lost, but now I'm found\nWas blind, but now I see"
              }
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                padding: '12px',
                color: 'white',
                fontSize: '0.95rem',
                fontFamily: 'monospace',
                resize: 'none',
                direction: 'ltr',
                lineHeight: 1.6
              }}
            />
          </div>
        ) : (
          /* Standard Mode Editor */
          <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0 }}>
            {/* Slide Navigator */}
            <div style={{ width: '130px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginBottom: '4px' }}>Slides ({editingSong.slides.length})</div>
              <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {editingSong.slides.map((slide, idx) => (
                  <div
                    key={idx}
                    onClick={() => setEditingSlideIndex(idx)}
                    style={{
                      padding: '8px',
                      background: editingSlideIndex === idx ? 'rgba(102, 126, 234, 0.3)' : 'rgba(255,255,255,0.05)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      border: editingSlideIndex === idx ? '1px solid #667eea' : '1px solid transparent',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <span style={{ color: 'white', fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {slide.verseType || 'Slide'} {idx + 1}
                    </span>
                    {editingSong.slides.length > 1 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); removeSlide(idx); }}
                        style={{ background: 'transparent', border: 'none', color: '#dc3545', cursor: 'pointer', fontSize: '0.7rem', padding: '0 2px' }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={addSlide}
                style={{
                  background: 'rgba(40, 167, 69, 0.3)',
                  border: '1px solid rgba(40, 167, 69, 0.5)',
                  borderRadius: '6px',
                  padding: '8px',
                  color: '#28a745',
                  cursor: 'pointer',
                  fontSize: '0.75rem'
                }}
              >
                + Add Slide
              </button>
            </div>

            {/* Slide Editor */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'auto' }}>
              {/* Verse Type */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginBottom: '4px' }}>{t('controlPanel.verseType')}</label>
                  <select
                    value={editingSong.slides[editingSlideIndex]?.verseType || 'Verse'}
                    onChange={(e) => updateSlide('verseType', e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      color: 'white',
                      fontSize: '0.85rem'
                    }}
                  >
                    <option value="Intro">Intro</option>
                    <option value="Verse">Verse</option>
                    <option value="Verse1">Verse 1</option>
                    <option value="Verse2">Verse 2</option>
                    <option value="Verse3">Verse 3</option>
                    <option value="Verse4">Verse 4</option>
                    <option value="PreChorus">Pre-Chorus</option>
                    <option value="Chorus">Chorus</option>
                    <option value="Bridge">Bridge</option>
                    <option value="Instrumental">Instrumental</option>
                    <option value="Outro">Outro</option>
                    <option value="Tag">Tag</option>
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
                    Auto-Generate ⚡
                  </button>
                )}
              </div>

              {/* Original Text */}
              <div>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginBottom: '4px' }}>
                  {isTransliterationLanguage ? 'Original Text *' : 'Lyrics *'}
                </label>
                <textarea
                  value={editingSong.slides[editingSlideIndex]?.originalText || ''}
                  onChange={(e) => updateSlide('originalText', e.target.value)}
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
                    minHeight: '50px',
                    direction: isTransliterationLanguage ? 'rtl' : 'ltr',
                    textAlign: isTransliterationLanguage ? 'right' : 'left'
                  }}
                  placeholder={isTransliterationLanguage ? 'Enter original text...' : 'Enter lyrics...'}
                />
              </div>

              {/* Transliteration / Line 2 */}
              <div>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginBottom: '4px' }}>
                  {isTransliterationLanguage ? 'Transliteration' : 'Additional Lyrics'}
                </label>
                <textarea
                  value={editingSong.slides[editingSlideIndex]?.transliteration || ''}
                  onChange={(e) => updateSlide('transliteration', e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    padding: '10px',
                    color: 'white',
                    fontSize: '0.9rem',
                    resize: 'vertical',
                    minHeight: '40px'
                  }}
                  placeholder={isTransliterationLanguage ? 'Enter transliteration...' : 'Additional lyrics...'}
                />
              </div>

              {/* Translation / Line 3 */}
              <div>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginBottom: '4px' }}>
                  {isTransliterationLanguage ? 'Translation' : 'Additional Lyrics'}
                </label>
                <textarea
                  value={editingSong.slides[editingSlideIndex]?.translation || ''}
                  onChange={(e) => updateSlide('translation', e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    padding: '10px',
                    color: 'white',
                    fontSize: '0.9rem',
                    resize: 'vertical',
                    minHeight: '40px'
                  }}
                  placeholder={isTransliterationLanguage ? 'Enter translation...' : 'Additional lyrics...'}
                />
              </div>

              {/* Translation Overflow / Line 4 */}
              <div>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginBottom: '4px' }}>
                  {isTransliterationLanguage ? 'Translation Overflow' : 'Additional Lyrics'}
                </label>
                <textarea
                  value={editingSong.slides[editingSlideIndex]?.translationOverflow || ''}
                  onChange={(e) => updateSlide('translationOverflow', e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    padding: '10px',
                    color: 'white',
                    fontSize: '0.9rem',
                    resize: 'vertical',
                    minHeight: '40px'
                  }}
                  placeholder={isTransliterationLanguage ? 'Additional translation lines...' : 'Additional lyrics...'}
                />
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
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
            disabled={!editingSong.title.trim()}
            style={{
              background: editingSong.title.trim() ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)' : 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 24px',
              color: 'white',
              cursor: editingSong.title.trim() ? 'pointer' : 'not-allowed',
              fontWeight: 600
            }}
          >
            Save Song
          </button>
        </div>
      </div>
    </div>
  );
};

export default SongEditorModal;
