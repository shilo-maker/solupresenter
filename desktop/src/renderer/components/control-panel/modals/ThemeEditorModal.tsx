import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';

interface LineStyle {
  fontSize: number;
  color: string;
  fontWeight: string;
}

interface EditingTheme {
  id?: string;
  name: string;
  viewerBackground: { type: string; color: string };
  lineStyles: Record<string, LineStyle>;
}

interface ThemeEditorModalProps {
  theme: EditingTheme;
  onThemeChange: (theme: EditingTheme) => void;
  onSave: () => void;
  onClose: () => void;
}

const ThemeEditorModal = memo<ThemeEditorModalProps>(({
  theme,
  onThemeChange,
  onSave,
  onClose
}) => {
  const { t } = useTranslation();

  const lineTypes = ['original', 'transliteration', 'translation'] as const;

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
          width: '500px',
          maxHeight: '80vh',
          overflow: 'auto',
          border: '1px solid rgba(255,255,255,0.2)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ color: 'white', margin: 0, fontSize: '1.2rem' }}>
            {theme.id ? 'Edit Theme' : 'New Theme'}
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', padding: '4px 8px', color: 'white', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Theme Name */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', marginBottom: '6px' }}>
            {t('controlPanel.themeName')}
          </label>
          <input
            type="text"
            value={theme.name}
            onChange={(e) => onThemeChange({ ...theme, name: e.target.value })}
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

        {/* Background Color */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', marginBottom: '6px' }}>
            {t('controlPanel.backgroundColor')}
          </label>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="color"
              value={theme.viewerBackground.color}
              onChange={(e) => onThemeChange({
                ...theme,
                viewerBackground: { ...theme.viewerBackground, color: e.target.value }
              })}
              style={{ width: '50px', height: '36px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            />
            <input
              type="text"
              value={theme.viewerBackground.color}
              onChange={(e) => onThemeChange({
                ...theme,
                viewerBackground: { ...theme.viewerBackground, color: e.target.value }
              })}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                padding: '8px',
                color: 'white',
                fontSize: '0.85rem',
                fontFamily: 'monospace'
              }}
            />
          </div>
        </div>

        {/* Line Styles */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', marginBottom: '10px' }}>
            {t('controlPanel.lineStyles')}
          </label>
          {lineTypes.map((lineType) => (
            <div key={lineType} style={{ marginBottom: '12px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
              <div style={{ color: 'white', fontSize: '0.85rem', marginBottom: '8px', textTransform: 'capitalize' }}>{lineType}</div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {/* Font Size */}
                <div style={{ flex: 1, minWidth: '100px' }}>
                  <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', marginBottom: '4px' }}>
                    {t('controlPanel.fontSize')}
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="range"
                      min="50"
                      max="150"
                      value={theme.lineStyles[lineType].fontSize}
                      onChange={(e) => onThemeChange({
                        ...theme,
                        lineStyles: {
                          ...theme.lineStyles,
                          [lineType]: { ...theme.lineStyles[lineType], fontSize: parseInt(e.target.value) }
                        }
                      })}
                      style={{ flex: 1 }}
                    />
                    <span style={{ color: 'white', fontSize: '0.75rem', minWidth: '35px' }}>
                      {theme.lineStyles[lineType].fontSize}%
                    </span>
                  </div>
                </div>
                {/* Color */}
                <div>
                  <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', marginBottom: '4px' }}>
                    {t('controlPanel.color')}
                  </label>
                  <input
                    type="color"
                    value={theme.lineStyles[lineType].color}
                    onChange={(e) => onThemeChange({
                      ...theme,
                      lineStyles: {
                        ...theme.lineStyles,
                        [lineType]: { ...theme.lineStyles[lineType], color: e.target.value }
                      }
                    })}
                    style={{ width: '36px', height: '28px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  />
                </div>
                {/* Font Weight */}
                <div>
                  <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', marginBottom: '4px' }}>
                    {t('controlPanel.weight')}
                  </label>
                  <select
                    value={theme.lineStyles[lineType].fontWeight}
                    onChange={(e) => onThemeChange({
                      ...theme,
                      lineStyles: {
                        ...theme.lineStyles,
                        [lineType]: { ...theme.lineStyles[lineType], fontWeight: e.target.value }
                      }
                    })}
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      color: 'white',
                      fontSize: '0.75rem'
                    }}
                  >
                    <option value="300">{t('controlPanel.light')}</option>
                    <option value="400">{t('controlPanel.normal')}</option>
                    <option value="500">{t('controlPanel.medium')}</option>
                    <option value="600">{t('controlPanel.semiBold')}</option>
                    <option value="700">{t('controlPanel.bold')}</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Preview */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', marginBottom: '6px' }}>
            {t('controlPanel.preview')}
          </label>
          <div style={{
            background: theme.viewerBackground.color,
            borderRadius: '8px',
            padding: '20px',
            textAlign: 'center',
            border: '1px solid rgba(255,255,255,0.2)'
          }}>
            <div style={{
              fontSize: `${theme.lineStyles.original.fontSize * 0.12}px`,
              color: theme.lineStyles.original.color,
              fontWeight: theme.lineStyles.original.fontWeight as any,
              marginBottom: '4px'
            }}>
              שלום עולם
            </div>
            <div style={{
              fontSize: `${theme.lineStyles.transliteration.fontSize * 0.12}px`,
              color: theme.lineStyles.transliteration.color,
              fontWeight: theme.lineStyles.transliteration.fontWeight as any,
              marginBottom: '4px'
            }}>
              {t('controlPanel.shalomOlam')}
            </div>
            <div style={{
              fontSize: `${theme.lineStyles.translation.fontSize * 0.12}px`,
              color: theme.lineStyles.translation.color,
              fontWeight: theme.lineStyles.translation.fontWeight as any
            }}>
              {t('controlPanel.helloWorld')}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
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
            onClick={onSave}
            disabled={!theme.name.trim()}
            style={{
              background: theme.name.trim() ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 24px',
              color: 'white',
              cursor: theme.name.trim() ? 'pointer' : 'not-allowed',
              fontWeight: 600
            }}
          >
            Save Theme
          </button>
        </div>
      </div>
    </div>
  );
});

ThemeEditorModal.displayName = 'ThemeEditorModal';

export default ThemeEditorModal;
