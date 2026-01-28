import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  StageMonitorCanvas,
  StagePropertiesPanel,
  StageColorPanel,
  StageColors,
  StageElementConfig,
  StageCurrentSlideText,
  StageNextSlideText,
  StageSelectedElement,
  StageTextStyle,
  PreviewTexts
} from '../components/stage-monitor-editor';

interface StageMonitorTheme {
  id: string;
  name: string;
  isBuiltIn: boolean;
  isDefault: boolean;
  canvasDimensions: { width: number; height: number };
  colors: StageColors;
  elements: {
    header: StageElementConfig;
    clock: StageElementConfig;
    songTitle: StageElementConfig;
    currentSlideArea: StageElementConfig;
    nextSlideArea: StageElementConfig;
  };
  currentSlideText: StageCurrentSlideText;
  nextSlideText: StageNextSlideText;
}

const DEFAULT_THEME: Omit<StageMonitorTheme, 'id'> = {
  name: 'New Stage Theme',
  isBuiltIn: false,
  isDefault: false,
  canvasDimensions: { width: 1920, height: 1080 },
  colors: {
    background: '#0a0a0a',
    text: '#ffffff',
    accent: '#4a90d9',
    secondary: '#888888',
    border: '#333333'
  },
  elements: {
    header: {
      visible: true,
      x: 0, y: 0, width: 100, height: 8,
      backgroundColor: 'rgba(255,255,255,0.05)'
    },
    clock: {
      visible: true,
      x: 85, y: 1, width: 13, height: 6,
      color: '#ffffff',
      fontFamily: 'monospace',
      showSeconds: false
    },
    songTitle: {
      visible: true,
      x: 2, y: 1, width: 60, height: 6,
      color: '#4a90d9',
      fontWeight: '600'
    },
    currentSlideArea: {
      visible: true,
      x: 2, y: 12, width: 64, height: 84,
      backgroundColor: 'rgba(255,255,255,0.03)',
      borderRadius: 12
    },
    nextSlideArea: {
      visible: true,
      x: 68, y: 12, width: 30, height: 84,
      backgroundColor: '#1a1a1a',
      borderRadius: 8,
      labelText: 'Next',
      opacity: 0.8
    }
  },
  currentSlideText: {
    original: {
      visible: true,
      color: '#ffffff',
      fontSize: 100,
      fontWeight: 'bold',
      opacity: 1,
      x: 5, y: 20, width: 58, height: 15,
      alignH: 'center',
      alignV: 'center',
      positionMode: 'absolute',
      autoHeight: false,
      growDirection: 'down'
    },
    transliteration: {
      visible: true,
      color: '#888888',
      fontSize: 70,
      fontWeight: '400',
      opacity: 1,
      x: 5, y: 40, width: 58, height: 12,
      alignH: 'center',
      alignV: 'center',
      positionMode: 'absolute',
      autoHeight: false,
      growDirection: 'down'
    },
    translation: {
      visible: true,
      color: '#ffffff',
      fontSize: 70,
      fontWeight: '400',
      opacity: 0.9,
      x: 5, y: 55, width: 58, height: 12,
      alignH: 'center',
      alignV: 'center',
      positionMode: 'absolute',
      autoHeight: false,
      growDirection: 'down'
    }
  },
  nextSlideText: {
    original: {
      visible: true,
      color: '#ffffff',
      fontSize: 100,
      fontWeight: 'bold',
      opacity: 0.8,
      x: 70, y: 25, width: 26, height: 12,
      alignH: 'center',
      alignV: 'center',
      positionMode: 'absolute',
      autoHeight: false,
      growDirection: 'down'
    },
    transliteration: {
      visible: true,
      color: '#888888',
      fontSize: 70,
      fontWeight: '400',
      opacity: 0.7,
      x: 70, y: 40, width: 26, height: 10,
      alignH: 'center',
      alignV: 'center',
      positionMode: 'absolute',
      autoHeight: false,
      growDirection: 'down'
    },
    translation: {
      visible: true,
      color: '#ffffff',
      fontSize: 70,
      fontWeight: '400',
      opacity: 0.7,
      x: 70, y: 52, width: 26, height: 10,
      alignH: 'center',
      alignV: 'center',
      positionMode: 'absolute',
      autoHeight: false,
      growDirection: 'down'
    }
  }
};

const StageMonitorEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const themeId = searchParams.get('id');

  const [theme, setTheme] = useState<StageMonitorTheme>({
    id: '',
    ...DEFAULT_THEME
  });

  const [selectedElement, setSelectedElement] = useState<StageSelectedElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'elements' | 'colors' | 'resolution'>('elements');
  const [previewTexts, setPreviewTexts] = useState<PreviewTexts>({
    original: 'הללויה',
    transliteration: 'Hallelujah',
    translation: 'Praise the Lord'
  });

  // Load theme if editing existing
  useEffect(() => {
    if (themeId) {
      window.electronAPI.getStageTheme(themeId).then((loadedTheme: any) => {
        if (loadedTheme) {
          // Merge with defaults to ensure all position properties exist
          const mergedCurrentSlideText = {
            original: { ...DEFAULT_THEME.currentSlideText.original, ...(loadedTheme.currentSlideText?.original || {}) },
            transliteration: { ...DEFAULT_THEME.currentSlideText.transliteration, ...(loadedTheme.currentSlideText?.transliteration || {}) },
            translation: { ...DEFAULT_THEME.currentSlideText.translation, ...(loadedTheme.currentSlideText?.translation || {}) }
          };

          const mergedNextSlideText = {
            original: { ...DEFAULT_THEME.nextSlideText.original, ...(loadedTheme.nextSlideText?.original || {}) },
            transliteration: { ...DEFAULT_THEME.nextSlideText.transliteration, ...(loadedTheme.nextSlideText?.transliteration || {}) },
            translation: { ...DEFAULT_THEME.nextSlideText.translation, ...(loadedTheme.nextSlideText?.translation || {}) }
          };

          // Deep merge elements to ensure all properties exist
          const mergedElements = {
            header: { ...DEFAULT_THEME.elements.header, ...(loadedTheme.elements?.header || {}) },
            clock: { ...DEFAULT_THEME.elements.clock, ...(loadedTheme.elements?.clock || {}) },
            songTitle: { ...DEFAULT_THEME.elements.songTitle, ...(loadedTheme.elements?.songTitle || {}) },
            currentSlideArea: { ...DEFAULT_THEME.elements.currentSlideArea, ...(loadedTheme.elements?.currentSlideArea || {}) },
            nextSlideArea: { ...DEFAULT_THEME.elements.nextSlideArea, ...(loadedTheme.elements?.nextSlideArea || {}) }
          };

          setTheme({
            id: loadedTheme.id || '',
            name: loadedTheme.name || 'Untitled Theme',
            isBuiltIn: loadedTheme.isBuiltIn ?? false,
            isDefault: loadedTheme.isDefault ?? false,
            canvasDimensions: loadedTheme.canvasDimensions || { width: 1920, height: 1080 },
            colors: { ...DEFAULT_THEME.colors, ...(loadedTheme.colors || {}) },
            elements: mergedElements,
            currentSlideText: mergedCurrentSlideText,
            nextSlideText: mergedNextSlideText
          });
        }
      }).catch((error) => {
        console.error('Failed to load stage theme:', error);
      });
    }
  }, [themeId]);

  const handleElementChange = useCallback((elementType: string, updates: Partial<StageElementConfig>) => {
    setTheme(prev => ({
      ...prev,
      elements: {
        ...prev.elements,
        [elementType]: { ...prev.elements[elementType as keyof typeof prev.elements], ...updates }
      }
    }));
    setHasChanges(true);
  }, []);

  const handleTextStyleChange = useCallback((lineType: string, updates: Partial<StageTextStyle>) => {
    setTheme(prev => ({
      ...prev,
      currentSlideText: {
        ...prev.currentSlideText,
        [lineType]: { ...prev.currentSlideText[lineType as keyof StageCurrentSlideText], ...updates }
      }
    }));
    setHasChanges(true);
  }, []);

  const handleNextTextStyleChange = useCallback((lineType: string, updates: Partial<StageTextStyle>) => {
    setTheme(prev => ({
      ...prev,
      nextSlideText: {
        ...prev.nextSlideText,
        [lineType]: { ...prev.nextSlideText[lineType as keyof StageNextSlideText], ...updates }
      }
    }));
    setHasChanges(true);
  }, []);

  const handleColorsChange = useCallback((colors: StageColors) => {
    setTheme(prev => ({ ...prev, colors }));
    setHasChanges(true);
  }, []);

  const handleSave = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (isSaving || theme.isBuiltIn) return;

    setIsSaving(true);
    try {
      const themeData = {
        name: theme.name,
        canvasDimensions: theme.canvasDimensions,
        colors: theme.colors,
        elements: theme.elements,
        currentSlideText: theme.currentSlideText,
        nextSlideText: theme.nextSlideText
      };

      console.log('Saving stage theme...', theme.id ? 'update' : 'create', themeData);

      let savedThemeId = theme.id;

      if (theme.id) {
        await window.electronAPI.updateStageTheme(theme.id, themeData);
        console.log('Stage theme updated successfully');
      } else {
        const created = await window.electronAPI.createStageTheme(themeData);
        console.log('Stage theme created:', created);
        if (created && created.id) {
          savedThemeId = created.id;
          setTheme(prev => ({ ...prev, id: created.id }));
        }
      }

      // Apply the theme immediately to the stage display
      const fullTheme = {
        id: savedThemeId,
        ...themeData
      };
      await window.electronAPI.applyStageTheme(fullTheme);
      console.log('Stage theme applied to display');

      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save stage theme:', error);
      alert('Failed to save stage theme: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    if (hasChanges && !confirm('You have unsaved changes. Discard?')) {
      return;
    }
    navigate('/');
  };

  // Check if selected element is a text line (current or next slide)
  const isCurrentTextLineSelected = selectedElement === 'original' || selectedElement === 'transliteration' || selectedElement === 'translation';
  const isNextTextLineSelected = selectedElement === 'nextOriginal' || selectedElement === 'nextTransliteration' || selectedElement === 'nextTranslation';
  const isTextLineSelected = isCurrentTextLineSelected || isNextTextLineSelected;

  // Check if selected element is a stage element (not text line)
  const isStageElementSelected = selectedElement && !isTextLineSelected;

  const getSelectedElementConfig = () => {
    if (!selectedElement || isTextLineSelected) return null;
    const elementKey = selectedElement === 'currentSlide' ? 'currentSlideArea' :
                       selectedElement === 'nextSlide' ? 'nextSlideArea' :
                       selectedElement;
    return theme.elements[elementKey as keyof typeof theme.elements];
  };

  const getSelectedTextStyle = (): StageTextStyle | null => {
    if (!isTextLineSelected) return null;
    if (isCurrentTextLineSelected) {
      return theme.currentSlideText[selectedElement as keyof StageCurrentSlideText];
    } else {
      // Map nextOriginal -> original, nextTransliteration -> transliteration, etc.
      const lineType = selectedElement!.replace('next', '').toLowerCase() as keyof StageNextSlideText;
      return theme.nextSlideText[lineType];
    }
  };

  const getTextStyleChangeHandler = () => {
    if (isCurrentTextLineSelected) {
      return handleTextStyleChange;
    } else if (isNextTextLineSelected) {
      // Map nextOriginal -> original, etc. for the handler
      return (updates: Partial<StageTextStyle>) => {
        const lineType = selectedElement!.replace('next', '').charAt(0).toLowerCase() + selectedElement!.replace('next', '').slice(1);
        handleNextTextStyleChange(lineType, updates);
      };
    }
    return undefined;
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      color: 'white'
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(0,0,0,0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            type="button"
            onClick={handleBack}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'transparent',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            ← Back
          </button>
          <div style={{
            padding: '4px 10px',
            background: 'rgba(236,72,153,0.2)',
            borderRadius: '4px',
            fontSize: '11px',
            color: '#ec4899',
            fontWeight: 600
          }}>
            Stage Monitor
          </div>
          <input
            type="text"
            value={theme.name}
            onChange={(e) => {
              setTheme(prev => ({ ...prev, name: e.target.value }));
              setHasChanges(true);
            }}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(0,0,0,0.3)',
              color: 'white',
              fontSize: '16px',
              fontWeight: 600,
              width: '250px'
            }}
            placeholder="Theme Name"
          />
          {hasChanges && (
            <span style={{ fontSize: '12px', color: '#ffc107' }}>● Unsaved changes</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || theme.isBuiltIn || !hasChanges}
            style={{
              padding: '10px 24px',
              borderRadius: '6px',
              border: 'none',
              background: theme.isBuiltIn ? 'rgba(255,255,255,0.1)' :
                         !hasChanges ? 'rgba(236,72,153,0.3)' : '#ec4899',
              color: theme.isBuiltIn ? 'rgba(255,255,255,0.5)' :
                     !hasChanges ? 'rgba(255,255,255,0.5)' : 'white',
              cursor: (theme.isBuiltIn || !hasChanges) ? 'not-allowed' : 'pointer',
              fontWeight: 600
            }}
          >
            {isSaving ? 'Saving...' : theme.isBuiltIn ? 'Built-in (Read Only)' : 'Save Theme'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Panel - Canvas */}
        <div style={{
          flex: 1,
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto'
        }}>
          <StageMonitorCanvas
            canvasDimensions={theme.canvasDimensions}
            colors={theme.colors}
            header={theme.elements.header}
            clock={theme.elements.clock}
            songTitle={theme.elements.songTitle}
            currentSlideArea={theme.elements.currentSlideArea}
            currentSlideText={theme.currentSlideText}
            nextSlideArea={theme.elements.nextSlideArea}
            nextSlideText={theme.nextSlideText}
            selectedElement={selectedElement}
            onSelectElement={setSelectedElement}
            onElementChange={handleElementChange}
            onTextStyleChange={handleTextStyleChange}
            onNextTextStyleChange={handleNextTextStyleChange}
            previewTexts={previewTexts}
          />

        </div>

        {/* Right Panel - Properties */}
        <div style={{
          width: '350px',
          borderLeft: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Tabs */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}>
            {[
              { id: 'elements', label: 'Elements' },
              { id: 'colors', label: 'Colors' },
              { id: 'resolution', label: 'Resolution' }
            ].map(tab => (
              <button
                type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: 'none',
                  background: activeTab === tab.id ? 'rgba(236,72,153,0.15)' : 'transparent',
                  color: activeTab === tab.id ? '#ec4899' : 'rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  borderBottom: activeTab === tab.id ? '2px solid #ec4899' : '2px solid transparent'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
            {activeTab === 'elements' && (
              <div>
                {/* Stage Element Properties */}
                {isStageElementSelected && getSelectedElementConfig() ? (
                  <StagePropertiesPanel
                    elementType={selectedElement as 'header' | 'clock' | 'songTitle' | 'currentSlide' | 'nextSlide'}
                    element={getSelectedElementConfig()!}
                    onElementChange={(updates) => {
                      const elementKey = selectedElement === 'currentSlide' ? 'currentSlideArea' :
                                        selectedElement === 'nextSlide' ? 'nextSlideArea' :
                                        selectedElement;
                      handleElementChange(elementKey, updates);
                    }}
                  />
                ) : isTextLineSelected && getSelectedTextStyle() ? (
                  /* Text Line Properties */
                  <StagePropertiesPanel
                    elementType={selectedElement as 'original' | 'transliteration' | 'translation' | 'nextOriginal' | 'nextTransliteration' | 'nextTranslation'}
                    textStyle={getSelectedTextStyle()!}
                    onTextStyleChange={(updates) => {
                      if (isCurrentTextLineSelected) {
                        handleTextStyleChange(selectedElement!, updates);
                      } else {
                        // Map nextOriginal -> original, nextTransliteration -> transliteration, etc.
                        const lineType = selectedElement!.replace('next', '').charAt(0).toLowerCase() + selectedElement!.replace('next', '').slice(1);
                        handleNextTextStyleChange(lineType, updates);
                      }
                    }}
                    previewText={
                      selectedElement === 'original' || selectedElement === 'nextOriginal' ? previewTexts.original :
                      selectedElement === 'transliteration' || selectedElement === 'nextTransliteration' ? previewTexts.transliteration :
                      previewTexts.translation
                    }
                    onPreviewTextChange={(text) => {
                      if (selectedElement === 'original' || selectedElement === 'nextOriginal') {
                        setPreviewTexts(prev => ({ ...prev, original: text }));
                      } else if (selectedElement === 'transliteration' || selectedElement === 'nextTransliteration') {
                        setPreviewTexts(prev => ({ ...prev, transliteration: text }));
                      } else {
                        setPreviewTexts(prev => ({ ...prev, translation: text }));
                      }
                    }}
                  />
                ) : (
                  <div style={{
                    textAlign: 'center',
                    padding: '40px 20px',
                    color: 'rgba(255,255,255,0.4)'
                  }}>
                    <div style={{ fontSize: '40px', marginBottom: '12px' }}>👆</div>
                    <div>Click on an element in the canvas to edit its properties</div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'colors' && (
              <StageColorPanel
                colors={theme.colors}
                onChange={handleColorsChange}
              />
            )}

            {activeTab === 'resolution' && (
              <div style={{
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '8px',
                padding: '16px'
              }}>
                <h3 style={{
                  margin: '0 0 16px 0',
                  fontSize: '14px',
                  color: 'rgba(255,255,255,0.9)',
                  fontWeight: 600
                }}>
                  Canvas Resolution
                </h3>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '8px',
                  marginBottom: '16px'
                }}>
                  {[
                    { label: '1080p', width: 1920, height: 1080 },
                    { label: '720p', width: 1280, height: 720 },
                    { label: '4K', width: 3840, height: 2160 },
                    { label: '4:3', width: 1440, height: 1080 },
                    { label: 'Vertical', width: 1080, height: 1920 },
                    { label: 'Vertical 4K', width: 2160, height: 3840 }
                  ].map(preset => (
                    <button
                      type="button"
                      key={preset.label}
                      onClick={() => {
                        setTheme(prev => ({
                          ...prev,
                          canvasDimensions: { width: preset.width, height: preset.height }
                        }));
                        setHasChanges(true);
                      }}
                      style={{
                        padding: '12px',
                        borderRadius: '6px',
                        border: theme.canvasDimensions.width === preset.width && theme.canvasDimensions.height === preset.height
                          ? '2px solid #ec4899'
                          : '1px solid rgba(255,255,255,0.2)',
                        background: theme.canvasDimensions.width === preset.width && theme.canvasDimensions.height === preset.height
                          ? 'rgba(236,72,153,0.15)'
                          : 'rgba(0,0,0,0.3)',
                        color: theme.canvasDimensions.width === preset.width && theme.canvasDimensions.height === preset.height
                          ? '#ec4899'
                          : 'rgba(255,255,255,0.8)',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{preset.label}</div>
                      <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '2px' }}>
                        {preset.width}×{preset.height}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Custom Resolution */}
                <div style={{
                  marginTop: '16px',
                  padding: '12px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '6px'
                }}>
                  <div style={{
                    fontSize: '12px',
                    color: 'rgba(255,255,255,0.7)',
                    marginBottom: '8px',
                    fontWeight: 500
                  }}>
                    Custom Resolution
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '4px' }}>
                        Width
                      </label>
                      <input
                        type="number"
                        value={theme.canvasDimensions.width}
                        onChange={(e) => {
                          const width = parseInt(e.target.value) || 1920;
                          setTheme(prev => ({
                            ...prev,
                            canvasDimensions: { ...prev.canvasDimensions, width: Math.max(320, Math.min(7680, width)) }
                          }));
                          setHasChanges(true);
                        }}
                        style={{
                          width: '100%',
                          padding: '8px',
                          borderRadius: '4px',
                          border: '1px solid rgba(255,255,255,0.2)',
                          background: 'rgba(0,0,0,0.3)',
                          color: 'white',
                          fontSize: '13px'
                        }}
                        min={320}
                        max={7680}
                      />
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '16px', paddingTop: '16px' }}>×</div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '4px' }}>
                        Height
                      </label>
                      <input
                        type="number"
                        value={theme.canvasDimensions.height}
                        onChange={(e) => {
                          const height = parseInt(e.target.value) || 1080;
                          setTheme(prev => ({
                            ...prev,
                            canvasDimensions: { ...prev.canvasDimensions, height: Math.max(240, Math.min(4320, height)) }
                          }));
                          setHasChanges(true);
                        }}
                        style={{
                          width: '100%',
                          padding: '8px',
                          borderRadius: '4px',
                          border: '1px solid rgba(255,255,255,0.2)',
                          background: 'rgba(0,0,0,0.3)',
                          color: 'white',
                          fontSize: '13px'
                        }}
                        min={240}
                        max={4320}
                      />
                    </div>
                  </div>
                  <div style={{
                    marginTop: '8px',
                    fontSize: '10px',
                    color: 'rgba(255,255,255,0.4)',
                    textAlign: 'center'
                  }}>
                    Aspect ratio: {(theme.canvasDimensions.width / theme.canvasDimensions.height).toFixed(2)}:1
                  </div>
                </div>

                <div style={{
                  marginTop: '12px',
                  padding: '8px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '4px',
                  textAlign: 'center',
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.5)'
                }}>
                  Current: {theme.canvasDimensions.width} × {theme.canvasDimensions.height}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StageMonitorEditorPage;
