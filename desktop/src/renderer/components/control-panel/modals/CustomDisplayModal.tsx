import React, { memo, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomLineSource, CustomDisplayLines } from '../../../contexts/SettingsContext';

interface CustomDisplayModalProps {
  currentConfig: CustomDisplayLines;
  availableTranslationLangs: string[];
  onSave: (config: CustomDisplayLines) => void;
  onClose: () => void;
}

type LineSourceKey = 'original' | 'transliteration' | 'translation' | 'none' | string;

function sourceToKey(source: CustomLineSource): LineSourceKey {
  if (source.type === 'translation' && source.lang) return `translation:${source.lang}`;
  return source.type;
}

function keyToSource(key: LineSourceKey): CustomLineSource {
  if (key === 'original') return { type: 'original' };
  if (key === 'transliteration') return { type: 'transliteration' };
  if (key === 'none') return { type: 'none' };
  if (key === 'translation') return { type: 'translation' };
  if (key.startsWith('translation:')) return { type: 'translation', lang: key.slice('translation:'.length) };
  return { type: 'none' };
}

const LANG_LABELS: Record<string, string> = {
  en: 'English',
  cs: 'Czech',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
  ru: 'Russian',
  ar: 'Arabic',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  it: 'Italian',
  pl: 'Polish',
  nl: 'Dutch',
  sv: 'Swedish',
  tr: 'Turkish',
  uk: 'Ukrainian',
  ro: 'Romanian',
  hu: 'Hungarian'
};

const CustomDisplayModal = memo<CustomDisplayModalProps>(({
  currentConfig,
  availableTranslationLangs,
  onSave,
  onClose
}) => {
  const { t } = useTranslation();
  const [line1, setLine1] = useState<LineSourceKey>(sourceToKey(currentConfig.line1));
  const [line2, setLine2] = useState<LineSourceKey>(sourceToKey(currentConfig.line2));
  const [line3, setLine3] = useState<LineSourceKey>(sourceToKey(currentConfig.line3));
  const [line4, setLine4] = useState<LineSourceKey>(sourceToKey(currentConfig.line4));

  const options = useMemo(() => {
    const opts: { value: string; label: string }[] = [
      { value: 'original', label: t('controlPanel.customLine.original', 'טקסט מקורי') },
      { value: 'transliteration', label: t('controlPanel.customLine.transliteration', 'תעתיק') },
      { value: 'translation', label: t('controlPanel.customLine.translation', 'תרגום') + ' - ' + (LANG_LABELS['en'] || 'English') }
    ];
    // Add extra translation languages from the current song
    for (const lang of availableTranslationLangs) {
      if (lang === 'en') continue; // already added as default
      const label = LANG_LABELS[lang] || lang;
      opts.push({ value: `translation:${lang}`, label: t('controlPanel.customLine.translation', 'תרגום') + ' - ' + label });
    }
    opts.push({ value: 'none', label: t('controlPanel.customLine.none', 'ללא') });
    return opts;
  }, [t, availableTranslationLangs]);

  const handleSave = () => {
    onSave({
      line1: keyToSource(line1),
      line2: keyToSource(line2),
      line3: keyToSource(line3),
      line4: keyToSource(line4)
    });
    onClose();
  };

  const lineLabels = [
    t('controlPanel.customLine.line1', 'שורה 1 (מיקום מקורי)'),
    t('controlPanel.customLine.line2', 'שורה 2 (מיקום תעתיק)'),
    t('controlPanel.customLine.line3', 'שורה 3 (מיקום תרגום)'),
    t('controlPanel.customLine.line4', 'שורה 4 (תרגום ב)')
  ];
  const lineValues = [line1, line2, line3, line4];
  const lineSetters = [setLine1, setLine2, setLine3, setLine4];

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
          background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.98), rgba(18, 18, 21, 0.98))',
          borderRadius: '16px',
          padding: '24px',
          minWidth: '340px',
          maxWidth: '420px',
          border: '1px solid rgba(255,255,255,0.2)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ color: 'white', margin: 0, fontSize: '1.1rem' }}>
            {t('controlPanel.customDisplayTitle', 'הגדרת תצוגה מותאמת')}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              fontSize: '1.2rem',
              padding: '4px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Line selectors */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {lineLabels.map((label, i) => (
            <div key={i}>
              <label style={{
                display: 'block',
                color: 'rgba(255,255,255,0.7)',
                fontSize: '0.8rem',
                marginBottom: '4px',
                fontWeight: 500
              }}>
                {label}
              </label>
              <select
                value={lineValues[i]}
                onChange={(e) => lineSetters[i](e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                {options.map(opt => (
                  <option key={opt.value} value={opt.value} style={{ background: '#1e1e2e', color: 'white' }}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {/* Footer buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '6px',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            {t('common.cancel', 'ביטול')}
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '8px 16px',
              background: '#06b6d4',
              border: 'none',
              borderRadius: '6px',
              color: '#000',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem'
            }}
          >
            {t('common.save', 'שמירה')}
          </button>
        </div>
      </div>
    </div>
  );
});

CustomDisplayModal.displayName = 'CustomDisplayModal';

export default CustomDisplayModal;
