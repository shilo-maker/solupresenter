import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ThemeCanvas,
  PropertiesPanel,
  BoxPropertiesPanel,
  ResolutionSelector,
  CanvasDimensions,
  ViewerBackground,
  LinePosition,
  LineStyle,
  BackgroundBox
} from '../components/theme-editor';

interface OBSTheme {
  id: string;
  name: string;
  type: 'songs';
  isBuiltIn: boolean;
  viewerBackground: ViewerBackground;
  canvasDimensions: CanvasDimensions;
  lineOrder: ('original' | 'transliteration' | 'translation')[];
  linePositions: Record<string, LinePosition>;
  lineStyles: Record<string, LineStyle>;
  backgroundBoxes: BackgroundBox[];
}

const DEFAULT_LINE_POSITIONS: Record<string, LinePosition> = {
  original: {
    x: 0, y: 70, width: 100, height: 10,
    paddingTop: 1, paddingBottom: 1,
    alignH: 'center', alignV: 'center'
  },
  transliteration: {
    x: 0, y: 80, width: 100, height: 8,
    paddingTop: 1, paddingBottom: 1,
    alignH: 'center', alignV: 'center'
  },
  translation: {
    x: 0, y: 88, width: 100, height: 10,
    paddingTop: 1, paddingBottom: 1,
    alignH: 'center', alignV: 'center'
  }
};

const DEFAULT_LINE_STYLES: Record<string, LineStyle> = {
  original: {
    fontSize: 120, fontWeight: '700', color: '#ffffff', opacity: 1, visible: true
  },
  transliteration: {
    fontSize: 90, fontWeight: '400', color: '#e0e0e0', opacity: 0.9, visible: true
  },
  translation: {
    fontSize: 100, fontWeight: '400', color: '#b0b0b0', opacity: 0.85, visible: true
  }
};

const OBSSongsThemeEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const themeId = searchParams.get('id');

  const [theme, setTheme] = useState<OBSTheme>({
    id: '',
    name: 'New OBS Songs Theme',
    type: 'songs',
    isBuiltIn: false,
    viewerBackground: { type: 'transparent', color: null },
    canvasDimensions: { width: 1920, height: 1080 },
    lineOrder: ['original', 'transliteration', 'translation'],
    linePositions: DEFAULT_LINE_POSITIONS,
    lineStyles: DEFAULT_LINE_STYLES,
    backgroundBoxes: [{ id: 'default-box', x: 0, y: 68, width: 100, height: 32, color: '#000000', opacity: 0.7, borderRadius: 0 }]
  });

  const [selectedElement, setSelectedElement] = useState<{ type: 'line' | 'box' | 'reference'; id: string } | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'layout' | 'background' | 'resolution'>('layout');

  const [previewTexts, setPreviewTexts] = useState<Record<string, string>>({});

  const handlePreviewTextChange = useCallback((lineType: string, text: string) => {
    setPreviewTexts(prev => ({ ...prev, [lineType]: text }));
  }, []);

  useEffect(() => {
    if (themeId) {
      window.electronAPI.getOBSTheme(themeId).then((loadedTheme: any) => {
        if (loadedTheme) {
          setTheme({
            id: loadedTheme.id,
            name: loadedTheme.name,
            type: 'songs',
            isBuiltIn: loadedTheme.isBuiltIn,
            viewerBackground: loadedTheme.viewerBackground || { type: 'transparent', color: null },
            canvasDimensions: loadedTheme.canvasDimensions || { width: 1920, height: 1080 },
            lineOrder: loadedTheme.lineOrder || ['original', 'transliteration', 'translation'],
            linePositions: loadedTheme.linePositions || DEFAULT_LINE_POSITIONS,
            lineStyles: loadedTheme.lineStyles || DEFAULT_LINE_STYLES,
            backgroundBoxes: loadedTheme.backgroundBoxes || []
          });
        }
      });
    }
  }, [themeId]);

  const handleLinePositionChange = useCallback((lineType: string, position: LinePosition) => {
    setTheme(prev => ({
      ...prev,
      linePositions: { ...prev.linePositions, [lineType]: position }
    }));
    setHasChanges(true);
  }, []);

  const handleLineStyleChange = useCallback((lineType: string, style: LineStyle) => {
    setTheme(prev => ({
      ...prev,
      lineStyles: { ...prev.lineStyles, [lineType]: style }
    }));
    setHasChanges(true);
  }, []);

  const handleBoxUpdate = useCallback((updatedBox: BackgroundBox) => {
    setTheme(prev => ({
      ...prev,
      backgroundBoxes: prev.backgroundBoxes.map(box =>
        box.id === updatedBox.id ? updatedBox : box
      )
    }));
    setHasChanges(true);
  }, []);

  const handleBoxDelete = useCallback((boxId: string) => {
    setTheme(prev => ({
      ...prev,
      backgroundBoxes: prev.backgroundBoxes.filter(box => box.id !== boxId)
    }));
    setSelectedElement(null);
    setHasChanges(true);
  }, []);

  const handleAddBox = useCallback(() => {
    if (theme.backgroundBoxes.length >= 3) {
      alert('Maximum 3 background boxes allowed');
      return;
    }
    const newBox: BackgroundBox = {
      id: `box-${Date.now()}`,
      x: 10 + theme.backgroundBoxes.length * 5,
      y: 60,
      width: 80,
      height: 30,
      color: '#1a1a2e',
      opacity: 0.8,
      borderRadius: 8
    };
    setTheme(prev => ({
      ...prev,
      backgroundBoxes: [...prev.backgroundBoxes, newBox]
    }));
    setSelectedElement({ type: 'box', id: newBox.id });
    setHasChanges(true);
  }, [theme.backgroundBoxes.length]);

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const themeData = {
        name: theme.name,
        type: 'songs' as const,
        viewerBackground: theme.viewerBackground,
        canvasDimensions: theme.canvasDimensions,
        lineOrder: theme.lineOrder,
        linePositions: theme.linePositions,
        lineStyles: theme.lineStyles,
        backgroundBoxes: theme.backgroundBoxes
      };

      if (theme.id) {
        await window.electronAPI.updateOBSTheme(theme.id, themeData);
      } else {
        const created = await window.electronAPI.createOBSTheme(themeData);
        setTheme(prev => ({ ...prev, id: created.id }));
      }
      setHasChanges(false);

      await window.electronAPI.applyOBSTheme({
        ...themeData,
        id: theme.id
      });

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save theme:', error);
      alert('Failed to save theme');
      setSaveStatus('idle');
    }
  };

  const handleBack = () => {
    if (hasChanges && !confirm('You have unsaved changes. Discard?')) {
      return;
    }
    navigate('/');
  };

  const selectedLineType = selectedElement?.type === 'line' ? selectedElement.id as 'original' | 'transliteration' | 'translation' : null;
  const selectedBox = selectedElement?.type === 'box'
    ? theme.backgroundBoxes.find(b => b.id === selectedElement.id)
    : null;

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
            borderRadius: '4px',
            background: 'rgba(23, 162, 184, 0.3)',
            color: '#5bc0de',
            fontSize: '12px',
            fontWeight: 600
          }}>
            OBS Songs Theme
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
          {(hasChanges || saveStatus !== 'idle') && !theme.isBuiltIn && (
            <button
              onClick={handleSave}
              disabled={saveStatus !== 'idle'}
              style={{
                padding: '10px 24px',
                borderRadius: '6px',
                border: 'none',
                background: saveStatus === 'saved' ? '#28a745' : '#17a2b8',
                color: 'white',
                cursor: saveStatus !== 'idle' ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                transition: 'background 0.2s, color 0.2s'
              }}
            >
              {saveStatus === 'saving'
                ? 'Saving...'
                : saveStatus === 'saved'
                  ? 'Saved ✓'
                  : 'Save Theme'}
            </button>
          )}
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
          <ThemeCanvas
            canvasDimensions={theme.canvasDimensions}
            viewerBackground={theme.viewerBackground}
            lineOrder={theme.lineOrder}
            linePositions={theme.linePositions}
            lineStyles={theme.lineStyles}
            backgroundBoxes={theme.backgroundBoxes}
            selectedElement={selectedElement}
            onSelectElement={setSelectedElement}
            onLinePositionChange={handleLinePositionChange}
            onBoxUpdate={handleBoxUpdate}
            onBoxDelete={handleBoxDelete}
            previewTexts={previewTexts}
            onPreviewTextChange={handlePreviewTextChange}
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
              { id: 'layout', label: 'Layout' },
              { id: 'background', label: 'Background' },
              { id: 'resolution', label: 'Resolution' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: 'none',
                  background: activeTab === tab.id ? 'rgba(23,162,184,0.15)' : 'transparent',
                  color: activeTab === tab.id ? '#17a2b8' : 'rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  borderBottom: activeTab === tab.id ? '2px solid #17a2b8' : '2px solid transparent'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
            {activeTab === 'layout' && (
              <div>
                {/* Layers Panel */}
                <div style={{
                  marginBottom: '16px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '8px',
                  padding: '12px'
                }}>
                  <h4 style={{
                    margin: '0 0 12px 0',
                    fontSize: '12px',
                    color: 'rgba(255,255,255,0.7)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Layers
                  </h4>

                  {/* Text Lines */}
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{
                      fontSize: '10px',
                      color: 'rgba(255,255,255,0.5)',
                      marginBottom: '6px',
                      textTransform: 'uppercase'
                    }}>
                      Text Lines
                    </div>
                    {(['original', 'transliteration', 'translation'] as const).map((lineType) => {
                      const style = theme.lineStyles[lineType];
                      const isSelected = selectedElement?.type === 'line' && selectedElement.id === lineType;
                      const isVisible = style?.visible !== false;
                      return (
                        <div
                          key={lineType}
                          onClick={() => setSelectedElement({ type: 'line', id: lineType })}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 10px',
                            marginBottom: '4px',
                            borderRadius: '4px',
                            background: isSelected ? 'rgba(23,162,184,0.2)' : 'rgba(255,255,255,0.05)',
                            border: isSelected ? '1px solid rgba(23,162,184,0.5)' : '1px solid transparent',
                            cursor: 'pointer',
                            opacity: isVisible ? 1 : 0.5
                          }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLineStyleChange(lineType, { ...style, visible: !isVisible });
                            }}
                            style={{
                              width: '24px',
                              height: '24px',
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '14px'
                            }}
                            title={isVisible ? 'Hide layer' : 'Show layer'}
                          >
                            {isVisible ? '👁️' : '👁️‍🗨️'}
                          </button>
                          <span style={{
                            flex: 1,
                            fontSize: '12px',
                            color: isVisible ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)',
                            textTransform: 'capitalize'
                          }}>
                            {lineType}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Background Boxes */}
                  {theme.backgroundBoxes.length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      <div style={{
                        fontSize: '10px',
                        color: 'rgba(255,255,255,0.5)',
                        marginBottom: '6px',
                        textTransform: 'uppercase'
                      }}>
                        Background Boxes
                      </div>
                      {theme.backgroundBoxes.map((box, index) => {
                        const isSelected = selectedElement?.type === 'box' && selectedElement.id === box.id;
                        return (
                          <div
                            key={box.id}
                            onClick={() => setSelectedElement({ type: 'box', id: box.id })}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 10px',
                              marginBottom: '4px',
                              borderRadius: '4px',
                              background: isSelected ? 'rgba(23,162,184,0.2)' : 'rgba(255,255,255,0.05)',
                              border: isSelected ? '1px solid rgba(23,162,184,0.5)' : '1px solid transparent',
                              cursor: 'pointer'
                            }}
                          >
                            <span style={{ fontSize: '14px' }}>◻️</span>
                            <span style={{
                              flex: 1,
                              fontSize: '12px',
                              color: 'rgba(255,255,255,0.9)'
                            }}>
                              Box {index + 1}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add Box Button */}
                  <button
                    onClick={handleAddBox}
                    style={{
                      width: '100%',
                      padding: '8px',
                      marginTop: '12px',
                      border: '1px dashed rgba(255,255,255,0.3)',
                      borderRadius: '4px',
                      background: 'transparent',
                      color: 'rgba(255,255,255,0.6)',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    + Add Background Box
                  </button>
                </div>

                {/* Properties Panel */}
                {selectedLineType && (
                  <PropertiesPanel
                    lineType={selectedLineType}
                    position={theme.linePositions[selectedLineType]}
                    style={theme.lineStyles[selectedLineType]}
                    onPositionChange={(pos) => handleLinePositionChange(selectedLineType, pos)}
                    onStyleChange={(style) => handleLineStyleChange(selectedLineType, style)}
                  />
                )}

                {selectedBox && (
                  <BoxPropertiesPanel
                    box={selectedBox}
                    onUpdate={handleBoxUpdate}
                    onDelete={() => handleBoxDelete(selectedBox.id)}
                  />
                )}
              </div>
            )}

            {activeTab === 'background' && (
              <div>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '14px' }}>Background</h4>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '16px' }}>
                  OBS overlays typically use transparent backgrounds. Use background boxes for text backing.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      checked={theme.viewerBackground.type === 'transparent'}
                      onChange={() => {
                        setTheme(prev => ({
                          ...prev,
                          viewerBackground: { type: 'transparent', color: null }
                        }));
                        setHasChanges(true);
                      }}
                    />
                    <span style={{ fontSize: '13px' }}>Transparent</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      checked={theme.viewerBackground.type === 'color'}
                      onChange={() => setTheme(prev => ({
                        ...prev,
                        viewerBackground: { type: 'color', color: prev.viewerBackground.color || '#000000' }
                      }))}
                    />
                    <span style={{ fontSize: '13px' }}>Solid Color</span>
                  </label>
                  {theme.viewerBackground.type === 'color' && (
                    <input
                      type="color"
                      value={theme.viewerBackground.color || '#000000'}
                      onChange={(e) => {
                        setTheme(prev => ({
                          ...prev,
                          viewerBackground: { type: 'color', color: e.target.value }
                        }));
                        setHasChanges(true);
                      }}
                      style={{ width: '100%', height: '40px', cursor: 'pointer' }}
                    />
                  )}
                </div>
              </div>
            )}

            {activeTab === 'resolution' && (
              <ResolutionSelector
                dimensions={theme.canvasDimensions}
                onChange={(dims) => {
                  setTheme(prev => ({ ...prev, canvasDimensions: dims }));
                  setHasChanges(true);
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OBSSongsThemeEditorPage;
