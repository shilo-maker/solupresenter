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

interface Theme {
  id: string;
  name: string;
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
    x: 0, y: 27.897104546981193, width: 100, height: 11.379800853485063,
    paddingTop: 2, paddingBottom: 2,
    alignH: 'center', alignV: 'center'
  },
  transliteration: {
    x: 0, y: 38.96539940433855, width: 100, height: 12.138454243717401,
    paddingTop: 1, paddingBottom: 1,
    alignH: 'center', alignV: 'center'
  },
  translation: {
    x: 0, y: 50.838474679449185, width: 100, height: 27.311522048364157,
    paddingTop: 1, paddingBottom: 1,
    alignH: 'center', alignV: 'top'
  }
};

const DEFAULT_LINE_STYLES: Record<string, LineStyle> = {
  original: {
    fontSize: 187, fontWeight: '700', color: '#ffffff', opacity: 1, visible: true
  },
  transliteration: {
    fontSize: 136, fontWeight: '400', color: '#e0e0e0', opacity: 0.9, visible: true
  },
  translation: {
    fontSize: 146, fontWeight: '400', color: '#b0b0b0', opacity: 0.85, visible: true
  }
};

const ThemeEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const themeId = searchParams.get('id');

  const [theme, setTheme] = useState<Theme>({
    id: '',
    name: 'New Theme',
    isBuiltIn: false,
    viewerBackground: { type: 'color', color: '#000000' },
    canvasDimensions: { width: 1920, height: 1080 },
    lineOrder: ['original', 'transliteration', 'translation'],
    linePositions: DEFAULT_LINE_POSITIONS,
    lineStyles: DEFAULT_LINE_STYLES,
    backgroundBoxes: []
  });

  const [selectedElement, setSelectedElement] = useState<{ type: 'line' | 'box' | 'reference' | 'referenceTranslation' | 'referenceEnglish'; id: string } | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'layout' | 'background' | 'resolution'>('layout');

  // Preview text for testing (not saved with theme)
  const [previewTexts, setPreviewTexts] = useState<Record<string, string>>({});

  // Drag and drop state for layer reordering
  const [draggedItem, setDraggedItem] = useState<{ type: 'line' | 'box'; id: string; index: number } | null>(null);
  const [dragOverItem, setDragOverItem] = useState<{ type: 'line' | 'box'; index: number } | null>(null);

  const handlePreviewTextChange = useCallback((lineType: string, text: string) => {
    setPreviewTexts(prev => ({ ...prev, [lineType]: text }));
  }, []);

  // Load theme if editing existing
  useEffect(() => {
    if (themeId) {
      window.electronAPI.getTheme(themeId).then((loadedTheme: any) => {
        if (loadedTheme) {
          setTheme({
            id: loadedTheme.id || '',
            name: loadedTheme.name || 'Untitled Theme',
            isBuiltIn: loadedTheme.isBuiltIn ?? false,
            viewerBackground: loadedTheme.viewerBackground || { type: 'color', color: '#000000' },
            canvasDimensions: loadedTheme.canvasDimensions || { width: 1920, height: 1080 },
            lineOrder: loadedTheme.lineOrder || ['original', 'transliteration', 'translation'],
            linePositions: loadedTheme.linePositions || DEFAULT_LINE_POSITIONS,
            lineStyles: loadedTheme.lineStyles || DEFAULT_LINE_STYLES,
            backgroundBoxes: loadedTheme.backgroundBoxes || []
          });
        }
      }).catch((error) => {
        console.error('Failed to load theme:', error);
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
      y: 10 + theme.backgroundBoxes.length * 5,
      width: 30,
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

  // Drag and drop handlers for layer reordering
  const handleDragStart = useCallback((type: 'line' | 'box', id: string, index: number) => {
    setDraggedItem({ type, id, index });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, type: 'line' | 'box', index: number) => {
    e.preventDefault();
    if (draggedItem && draggedItem.type === type) {
      setDragOverItem({ type, index });
    }
  }, [draggedItem]);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDragOverItem(null);
  }, []);

  const handleDrop = useCallback((type: 'line' | 'box', dropIndex: number) => {
    if (!draggedItem || draggedItem.type !== type) return;

    const dragIndex = draggedItem.index;
    if (dragIndex === dropIndex) {
      handleDragEnd();
      return;
    }

    if (type === 'line') {
      // Reorder line order
      const newLineOrder = [...theme.lineOrder];
      const [removed] = newLineOrder.splice(dragIndex, 1);
      newLineOrder.splice(dropIndex, 0, removed);
      setTheme(prev => ({ ...prev, lineOrder: newLineOrder as ('original' | 'transliteration' | 'translation')[] }));
    } else {
      // Reorder background boxes
      const newBoxes = [...theme.backgroundBoxes];
      const [removed] = newBoxes.splice(dragIndex, 1);
      newBoxes.splice(dropIndex, 0, removed);
      setTheme(prev => ({ ...prev, backgroundBoxes: newBoxes }));
    }

    setHasChanges(true);
    handleDragEnd();
  }, [draggedItem, theme.lineOrder, theme.backgroundBoxes, handleDragEnd]);

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const themeData = {
        name: theme.name,
        viewerBackground: theme.viewerBackground,
        canvasDimensions: theme.canvasDimensions,
        lineOrder: theme.lineOrder,
        linePositions: theme.linePositions,
        lineStyles: theme.lineStyles,
        backgroundBoxes: theme.backgroundBoxes
      };

      if (theme.id) {
        await window.electronAPI.updateTheme(theme.id, themeData);
      } else {
        const created = await window.electronAPI.createTheme(themeData);
        setTheme(prev => ({ ...prev, id: created.id }));
      }
      setHasChanges(false);

      // Note: We don't automatically broadcast the theme to displays on save.
      // The user should re-select the theme in the control panel if they want it applied.
      // This prevents accidentally changing displays when editing non-active themes.

      // Show saved state briefly
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
                background: saveStatus === 'saved' ? '#28a745' : '#00d4ff',
                color: saveStatus === 'saved' ? 'white' : 'black',
                cursor: saveStatus !== 'idle' ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                transition: 'background 0.2s, color 0.2s'
              }}
            >
              {saveStatus === 'saving'
                ? 'Saving...'
                : saveStatus === 'saved'
                  ? 'Saved \u2713'
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
                  background: activeTab === tab.id ? 'rgba(0,212,255,0.15)' : 'transparent',
                  color: activeTab === tab.id ? '#00d4ff' : 'rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  borderBottom: activeTab === tab.id ? '2px solid #00d4ff' : '2px solid transparent'
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
                      Text Lines (drag to reorder)
                    </div>
                    {theme.lineOrder.map((lineType, index) => {
                      const style = theme.lineStyles[lineType];
                      const isSelected = selectedElement?.type === 'line' && selectedElement.id === lineType;
                      const isVisible = style?.visible !== false;
                      const isDragging = draggedItem?.type === 'line' && draggedItem.id === lineType;
                      const isDragOver = dragOverItem?.type === 'line' && dragOverItem.index === index;
                      return (
                        <div
                          key={lineType}
                          draggable
                          onDragStart={() => handleDragStart('line', lineType, index)}
                          onDragOver={(e) => handleDragOver(e, 'line', index)}
                          onDragEnd={handleDragEnd}
                          onDrop={() => handleDrop('line', index)}
                          onClick={() => setSelectedElement({ type: 'line', id: lineType })}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 10px',
                            marginBottom: '4px',
                            borderRadius: '4px',
                            background: isSelected ? 'rgba(0,212,255,0.2)' : 'rgba(255,255,255,0.05)',
                            border: isDragOver
                              ? '2px dashed #00d4ff'
                              : isSelected
                                ? '1px solid rgba(0,212,255,0.5)'
                                : '1px solid transparent',
                            cursor: 'grab',
                            opacity: isDragging ? 0.5 : isVisible ? 1 : 0.5,
                            transition: 'border 0.15s, opacity 0.15s'
                          }}
                        >
                          {/* Drag Handle */}
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                            cursor: 'grab',
                            padding: '2px'
                          }}>
                            <div style={{ display: 'flex', gap: '2px' }}>
                              <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }} />
                              <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '2px' }}>
                              <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }} />
                              <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '2px' }}>
                              <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }} />
                              <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }} />
                            </div>
                          </div>

                          {/* Visibility Toggle */}
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

                          {/* Layer Name */}
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
                        Background Boxes (drag to reorder)
                      </div>
                      {theme.backgroundBoxes.map((box, index) => {
                        const isSelected = selectedElement?.type === 'box' && selectedElement.id === box.id;
                        const isDragging = draggedItem?.type === 'box' && draggedItem.id === box.id;
                        const isDragOver = dragOverItem?.type === 'box' && dragOverItem.index === index;
                        return (
                          <div
                            key={box.id}
                            draggable
                            onDragStart={() => handleDragStart('box', box.id, index)}
                            onDragOver={(e) => handleDragOver(e, 'box', index)}
                            onDragEnd={handleDragEnd}
                            onDrop={() => handleDrop('box', index)}
                            onClick={() => setSelectedElement({ type: 'box', id: box.id })}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 10px',
                              marginBottom: '4px',
                              borderRadius: '4px',
                              background: isSelected ? 'rgba(0,212,255,0.2)' : 'rgba(255,255,255,0.05)',
                              border: isDragOver
                                ? '2px dashed #00d4ff'
                                : isSelected
                                  ? '1px solid rgba(0,212,255,0.5)'
                                  : '1px solid transparent',
                              cursor: 'grab',
                              opacity: isDragging ? 0.5 : 1,
                              transition: 'border 0.15s, opacity 0.15s'
                            }}
                          >
                            {/* Drag Handle */}
                            <div style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px',
                              cursor: 'grab',
                              padding: '2px'
                            }}>
                              <div style={{ display: 'flex', gap: '2px' }}>
                                <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }} />
                                <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }} />
                              </div>
                              <div style={{ display: 'flex', gap: '2px' }}>
                                <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }} />
                                <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }} />
                              </div>
                              <div style={{ display: 'flex', gap: '2px' }}>
                                <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }} />
                                <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }} />
                              </div>
                            </div>

                            {/* Box Color Preview */}
                            <div style={{
                              width: '16px',
                              height: '16px',
                              borderRadius: '3px',
                              background: box.color,
                              border: '1px solid rgba(255,255,255,0.2)'
                            }} />

                            {/* Box Name */}
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

                  {/* Add Background Box Button */}
                  <button
                    onClick={handleAddBox}
                    disabled={theme.backgroundBoxes.length >= 3}
                    style={{
                      width: '100%',
                      padding: '8px',
                      marginTop: '8px',
                      borderRadius: '4px',
                      border: '1px dashed rgba(255,255,255,0.2)',
                      background: 'transparent',
                      color: theme.backgroundBoxes.length >= 3 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.6)',
                      cursor: theme.backgroundBoxes.length >= 3 ? 'not-allowed' : 'pointer',
                      fontSize: '11px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    + Add Box ({theme.backgroundBoxes.length}/3)
                  </button>
                </div>

                {/* Selected Element Properties */}
                {selectedLineType && (
                  <PropertiesPanel
                    lineType={selectedLineType}
                    position={theme.linePositions[selectedLineType]}
                    style={theme.lineStyles[selectedLineType]}
                    onPositionChange={(pos) => handleLinePositionChange(selectedLineType, pos)}
                    onStyleChange={(style) => handleLineStyleChange(selectedLineType, style)}
                    availableLineTypes={theme.lineOrder}
                  />
                )}

                {selectedBox && (
                  <BoxPropertiesPanel
                    box={selectedBox}
                    onUpdate={handleBoxUpdate}
                    onDelete={() => handleBoxDelete(selectedBox.id)}
                  />
                )}

                {!selectedElement && (
                  <div style={{
                    textAlign: 'center',
                    padding: '40px 20px',
                    color: 'rgba(255,255,255,0.4)'
                  }}>
                    <div style={{ fontSize: '40px', marginBottom: '12px' }}>👆</div>
                    <div>Click on a text box or background box to edit its properties</div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'background' && (
              <div>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', color: 'rgba(255,255,255,0.9)' }}>
                  Viewer Background
                </h3>

                {/* Background Type */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.6)',
                    marginBottom: '8px',
                    textTransform: 'uppercase'
                  }}>
                    Type
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[
                      { value: 'inherit', label: 'Inherit' },
                      { value: 'color', label: 'Color' },
                      { value: 'transparent', label: 'Transparent' }
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setTheme(prev => ({
                            ...prev,
                            viewerBackground: { ...prev.viewerBackground, type: opt.value as any }
                          }));
                          setHasChanges(true);
                        }}
                        style={{
                          flex: 1,
                          padding: '8px',
                          borderRadius: '4px',
                          border: theme.viewerBackground.type === opt.value
                            ? '2px solid #00d4ff'
                            : '1px solid rgba(255,255,255,0.2)',
                          background: theme.viewerBackground.type === opt.value
                            ? 'rgba(0,212,255,0.15)'
                            : 'rgba(0,0,0,0.3)',
                          color: theme.viewerBackground.type === opt.value
                            ? '#00d4ff'
                            : 'rgba(255,255,255,0.7)',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Picker (only for color type) */}
                {theme.viewerBackground.type === 'color' && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '11px',
                      color: 'rgba(255,255,255,0.6)',
                      marginBottom: '8px',
                      textTransform: 'uppercase'
                    }}>
                      Background Color
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="color"
                        value={theme.viewerBackground.color || '#000000'}
                        onChange={(e) => {
                          setTheme(prev => ({
                            ...prev,
                            viewerBackground: { ...prev.viewerBackground, color: e.target.value }
                          }));
                          setHasChanges(true);
                        }}
                        style={{
                          width: '50px',
                          height: '36px',
                          padding: '2px',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      />
                      <input
                        type="text"
                        value={theme.viewerBackground.color || '#000000'}
                        onChange={(e) => {
                          setTheme(prev => ({
                            ...prev,
                            viewerBackground: { ...prev.viewerBackground, color: e.target.value }
                          }));
                          setHasChanges(true);
                        }}
                        style={{
                          flex: 1,
                          padding: '8px',
                          borderRadius: '4px',
                          border: '1px solid rgba(255,255,255,0.1)',
                          background: 'rgba(0,0,0,0.3)',
                          color: 'white'
                        }}
                      />
                    </div>

                    {/* Color Presets */}
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '12px' }}>
                      {[
                        '#000000', '#1a1a2e', '#16213e', '#0f0f23',
                        '#1e3a5f', '#0a3d62', '#2c3e50', '#1b4f72'
                      ].map(color => (
                        <button
                          key={color}
                          onClick={() => {
                            setTheme(prev => ({
                              ...prev,
                              viewerBackground: { ...prev.viewerBackground, color }
                            }));
                            setHasChanges(true);
                          }}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '4px',
                            border: theme.viewerBackground.color === color
                              ? '2px solid #00d4ff'
                              : '1px solid rgba(255,255,255,0.2)',
                            background: color,
                            cursor: 'pointer'
                          }}
                        />
                      ))}
                    </div>

                    {/* Gradient Option */}
                    <div style={{ marginTop: '16px' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '11px',
                        color: 'rgba(255,255,255,0.6)',
                        marginBottom: '8px',
                        textTransform: 'uppercase'
                      }}>
                        Or enter gradient
                      </label>
                      <input
                        type="text"
                        placeholder="linear-gradient(135deg, #1a1a2e, #16213e)"
                        value={theme.viewerBackground.color?.startsWith('linear-gradient') || theme.viewerBackground.color?.startsWith('radial-gradient')
                          ? theme.viewerBackground.color
                          : ''}
                        onChange={(e) => {
                          setTheme(prev => ({
                            ...prev,
                            viewerBackground: { ...prev.viewerBackground, color: e.target.value }
                          }));
                          setHasChanges(true);
                        }}
                        style={{
                          width: '100%',
                          padding: '8px',
                          borderRadius: '4px',
                          border: '1px solid rgba(255,255,255,0.1)',
                          background: 'rgba(0,0,0,0.3)',
                          color: 'white',
                          fontSize: '12px'
                        }}
                      />
                    </div>
                  </div>
                )}
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

export default ThemeEditorPage;
