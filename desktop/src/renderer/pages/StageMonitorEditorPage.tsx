import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  StageMonitorCanvas,
  StagePropertiesPanel,
  StageColorPanel,
  StageColors,
  StageElementConfig,
  StageCurrentSlideText
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
    original: { visible: true, color: '#ffffff', fontSize: 100, fontWeight: 'bold', opacity: 1 },
    transliteration: { visible: true, color: '#888888', fontSize: 70, fontWeight: '400', opacity: 1 },
    translation: { visible: true, color: '#ffffff', fontSize: 70, fontWeight: '400', opacity: 0.9 }
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

  const [selectedElement, setSelectedElement] = useState<'header' | 'clock' | 'songTitle' | 'currentSlide' | 'nextSlide' | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'elements' | 'colors' | 'resolution'>('elements');

  // Load theme if editing existing
  useEffect(() => {
    if (themeId) {
      window.electronAPI.getStageTheme(themeId).then((loadedTheme: any) => {
        if (loadedTheme) {
          setTheme({
            id: loadedTheme.id || '',
            name: loadedTheme.name || 'Untitled Theme',
            isBuiltIn: loadedTheme.isBuiltIn ?? false,
            isDefault: loadedTheme.isDefault ?? false,
            canvasDimensions: loadedTheme.canvasDimensions || { width: 1920, height: 1080 },
            colors: loadedTheme.colors || DEFAULT_THEME.colors,
            elements: loadedTheme.elements || DEFAULT_THEME.elements,
            currentSlideText: loadedTheme.currentSlideText || DEFAULT_THEME.currentSlideText
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

  const handleTextStyleChange = useCallback((lineType: string, updates: any) => {
    setTheme(prev => ({
      ...prev,
      currentSlideText: {
        ...prev.currentSlideText,
        [lineType]: { ...prev.currentSlideText[lineType as keyof StageCurrentSlideText], ...updates }
      }
    }));
    setHasChanges(true);
  }, []);

  const handleColorsChange = useCallback((colors: StageColors) => {
    setTheme(prev => ({ ...prev, colors }));
    setHasChanges(true);
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const themeData = {
        name: theme.name,
        canvasDimensions: theme.canvasDimensions,
        colors: theme.colors,
        elements: theme.elements,
        currentSlideText: theme.currentSlideText
      };

      if (theme.id) {
        await window.electronAPI.updateStageTheme(theme.id, themeData);
      } else {
        const created = await window.electronAPI.createStageTheme(themeData);
        setTheme(prev => ({ ...prev, id: created.id }));
      }
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save stage theme:', error);
      alert('Failed to save stage theme');
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

  const getSelectedElementConfig = () => {
    if (!selectedElement) return null;
    const elementKey = selectedElement === 'currentSlide' ? 'currentSlideArea' :
                       selectedElement === 'nextSlide' ? 'nextSlideArea' :
                       selectedElement;
    return theme.elements[elementKey as keyof typeof theme.elements];
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
            onClick={handleSave}
            disabled={isSaving || theme.isBuiltIn}
            style={{
              padding: '10px 24px',
              borderRadius: '6px',
              border: 'none',
              background: theme.isBuiltIn ? 'rgba(255,255,255,0.1)' : '#ec4899',
              color: theme.isBuiltIn ? 'rgba(255,255,255,0.5)' : 'white',
              cursor: theme.isBuiltIn ? 'not-allowed' : 'pointer',
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
            selectedElement={selectedElement}
            onSelectElement={setSelectedElement}
            onElementChange={handleElementChange}
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
                {selectedElement && getSelectedElementConfig() ? (
                  <StagePropertiesPanel
                    elementType={selectedElement}
                    element={getSelectedElementConfig()!}
                    textStyles={selectedElement === 'currentSlide' ? theme.currentSlideText : undefined}
                    onElementChange={(updates) => {
                      const elementKey = selectedElement === 'currentSlide' ? 'currentSlideArea' :
                                        selectedElement === 'nextSlide' ? 'nextSlideArea' :
                                        selectedElement;
                      handleElementChange(elementKey, updates);
                    }}
                    onTextStyleChange={selectedElement === 'currentSlide' ? handleTextStyleChange : undefined}
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
                    { label: '4:3', width: 1440, height: 1080 }
                  ].map(preset => (
                    <button
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

                <div style={{
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
