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

type PrayerLineType = 'title' | 'titleTranslation' | 'subtitle' | 'subtitleTranslation' | 'description' | 'descriptionTranslation' | 'reference' | 'referenceTranslation';

interface OBSPrayerTheme {
  id: string;
  name: string;
  type: 'prayer';
  isBuiltIn: boolean;
  viewerBackground: ViewerBackground;
  canvasDimensions: CanvasDimensions;
  lineOrder: PrayerLineType[];
  linePositions: Record<string, LinePosition>;
  lineStyles: Record<string, LineStyle>;
  backgroundBoxes: BackgroundBox[];
}

// OBS Prayer positions - matches NewClassicPrayer structure for lower-third layout
const DEFAULT_LINE_POSITIONS: Record<string, LinePosition> = {
  title: {
    x: 0, y: 58, width: 100, height: 6,
    paddingTop: 1, paddingBottom: 1,
    alignH: 'center', alignV: 'center'
  },
  titleTranslation: {
    x: 0, y: 64, width: 100, height: 6,
    paddingTop: 1, paddingBottom: 1,
    alignH: 'center', alignV: 'center'
  },
  subtitle: {
    x: 0, y: 70, width: 100, height: 6,
    paddingTop: 1, paddingBottom: 1,
    alignH: 'center', alignV: 'center'
  },
  subtitleTranslation: {
    x: 0, y: 76, width: 100, height: 6,
    paddingTop: 1, paddingBottom: 1,
    alignH: 'center', alignV: 'center'
  },
  description: {
    x: 0, y: 82, width: 100, height: 5,
    paddingTop: 1, paddingBottom: 1,
    alignH: 'center', alignV: 'center'
  },
  descriptionTranslation: {
    x: 0, y: 87, width: 100, height: 5,
    paddingTop: 1, paddingBottom: 1,
    alignH: 'center', alignV: 'center'
  },
  reference: {
    x: 0, y: 92, width: 100, height: 4,
    paddingTop: 0, paddingBottom: 0,
    alignH: 'center', alignV: 'center'
  },
  referenceTranslation: {
    x: 0, y: 96, width: 100, height: 4,
    paddingTop: 0, paddingBottom: 0,
    alignH: 'center', alignV: 'center'
  }
};

// OBS Prayer styles - matches NewClassicPrayer structure
const DEFAULT_LINE_STYLES: Record<string, LineStyle> = {
  title: {
    fontSize: 130, fontWeight: '700', color: '#06b6d4', opacity: 1, visible: true
  },
  titleTranslation: {
    fontSize: 129, fontWeight: '700', color: '#06b6d4', opacity: 0.9, visible: true
  },
  subtitle: {
    fontSize: 94, fontWeight: '700', color: '#ffffff', opacity: 1, visible: true
  },
  subtitleTranslation: {
    fontSize: 94, fontWeight: '700', color: '#e0e0e0', opacity: 0.9, visible: true
  },
  description: {
    fontSize: 90, fontWeight: '400', color: '#e0e0e0', opacity: 0.9, visible: true
  },
  descriptionTranslation: {
    fontSize: 90, fontWeight: '400', color: '#b0b0b0', opacity: 0.85, visible: true
  },
  reference: {
    fontSize: 56, fontWeight: '500', color: '#ffffff', opacity: 0.8, visible: true
  },
  referenceTranslation: {
    fontSize: 60, fontWeight: '400', color: '#ffffff', opacity: 0.7, visible: true
  }
};

const LINE_TYPE_LABELS: Record<PrayerLineType, string> = {
  title: 'Title (Hebrew)',
  titleTranslation: 'Title Translation',
  subtitle: 'Subtitle (Hebrew)',
  subtitleTranslation: 'Subtitle Translation',
  description: 'Description',
  descriptionTranslation: 'Description Translation',
  reference: 'Reference (Hebrew)',
  referenceTranslation: 'Reference Translation'
};

const OBSPrayerThemeEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const themeId = searchParams.get('id');

  const [theme, setTheme] = useState<OBSPrayerTheme>({
    id: '',
    name: 'New OBS Prayer Theme',
    type: 'prayer',
    isBuiltIn: false,
    viewerBackground: { type: 'transparent', color: null },
    canvasDimensions: { width: 1920, height: 1080 },
    lineOrder: ['title', 'titleTranslation', 'subtitle', 'subtitleTranslation', 'description', 'descriptionTranslation', 'reference', 'referenceTranslation'],
    linePositions: DEFAULT_LINE_POSITIONS,
    lineStyles: DEFAULT_LINE_STYLES,
    backgroundBoxes: [{ id: 'default-box', x: 0, y: 56, width: 100, height: 44, color: '#000000', opacity: 0.7, borderRadius: 0 }]
  });

  const [selectedElement, setSelectedElement] = useState<{ type: 'line' | 'box' | 'reference' | 'referenceTranslation' | 'referenceEnglish'; id: string } | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'layout' | 'background' | 'resolution'>('layout');

  const [previewTexts, setPreviewTexts] = useState<Record<string, string>>({});

  // Drag and drop state for layer reordering
  const [draggedItem, setDraggedItem] = useState<{ type: 'line' | 'box'; id: string; index: number } | null>(null);
  const [dragOverItem, setDragOverItem] = useState<{ type: 'line' | 'box'; index: number } | null>(null);

  const handlePreviewTextChange = useCallback((lineType: string, text: string) => {
    setPreviewTexts(prev => ({ ...prev, [lineType]: text }));
  }, []);

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
      setTheme(prev => ({ ...prev, lineOrder: newLineOrder as PrayerLineType[] }));
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

  useEffect(() => {
    if (themeId) {
      window.electronAPI.getOBSTheme(themeId).then((loadedTheme: any) => {
        if (loadedTheme) {
          setTheme({
            id: loadedTheme.id || '',
            name: loadedTheme.name || 'Untitled Theme',
            type: 'prayer',
            isBuiltIn: loadedTheme.isBuiltIn ?? false,
            viewerBackground: loadedTheme.viewerBackground || { type: 'transparent', color: null },
            canvasDimensions: loadedTheme.canvasDimensions || { width: 1920, height: 1080 },
            lineOrder: loadedTheme.lineOrder || ['title', 'titleTranslation', 'subtitle', 'subtitleTranslation', 'description', 'descriptionTranslation', 'reference', 'referenceTranslation'],
            linePositions: loadedTheme.linePositions || DEFAULT_LINE_POSITIONS,
            lineStyles: loadedTheme.lineStyles || DEFAULT_LINE_STYLES,
            backgroundBoxes: loadedTheme.backgroundBoxes || []
          });
        }
      }).catch((error) => {
        console.error('Failed to load OBS prayer theme:', error);
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
        type: 'prayer' as const,
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

  // Handle both 'line' type and specific reference types from ThemeCanvas
  const selectedLineType = selectedElement && ['line', 'reference', 'referenceTranslation', 'referenceEnglish'].includes(selectedElement.type)
    ? selectedElement.id as PrayerLineType
    : null;
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
            background: 'rgba(6, 182, 212, 0.3)',
            color: '#06b6d4',
            fontSize: '12px',
            fontWeight: 600
          }}>
            OBS Prayer/Sermon Theme
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
                background: saveStatus === 'saved' ? '#28a745' : '#06b6d4',
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
                  background: activeTab === tab.id ? 'rgba(6,182,212,0.15)' : 'transparent',
                  color: activeTab === tab.id ? '#06b6d4' : 'rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  borderBottom: activeTab === tab.id ? '2px solid #06b6d4' : '2px solid transparent'
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
                    {(theme.lineOrder as PrayerLineType[]).map((lineType, index) => {
                      const style = theme.lineStyles[lineType];
                      // Handle both 'line' type and specific reference types from ThemeCanvas
                      const isSelected = selectedElement?.id === lineType &&
                        ['line', 'reference', 'referenceTranslation', 'referenceEnglish'].includes(selectedElement?.type || '');
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
                            background: isSelected ? 'rgba(6,182,212,0.2)' : 'rgba(255,255,255,0.05)',
                            border: isDragOver
                              ? '2px dashed #06b6d4'
                              : isSelected ? '1px solid rgba(6,182,212,0.5)' : '1px solid transparent',
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
                            <div style={{ width: '12px', height: '2px', background: 'rgba(255,255,255,0.3)', borderRadius: '1px' }} />
                            <div style={{ width: '12px', height: '2px', background: 'rgba(255,255,255,0.3)', borderRadius: '1px' }} />
                            <div style={{ width: '12px', height: '2px', background: 'rgba(255,255,255,0.3)', borderRadius: '1px' }} />
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const currentStyle = style || DEFAULT_LINE_STYLES[lineType] || { fontSize: 100, fontWeight: '400', color: '#ffffff', opacity: 1, visible: true };
                              handleLineStyleChange(lineType, { ...currentStyle, visible: !isVisible });
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
                            color: isVisible ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)'
                          }}>
                            {LINE_TYPE_LABELS[lineType]}
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
                              background: isSelected ? 'rgba(6,182,212,0.2)' : 'rgba(255,255,255,0.05)',
                              border: isDragOver
                                ? '2px dashed #06b6d4'
                                : isSelected ? '1px solid rgba(6,182,212,0.5)' : '1px solid transparent',
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
                              <div style={{ width: '12px', height: '2px', background: 'rgba(255,255,255,0.3)', borderRadius: '1px' }} />
                              <div style={{ width: '12px', height: '2px', background: 'rgba(255,255,255,0.3)', borderRadius: '1px' }} />
                              <div style={{ width: '12px', height: '2px', background: 'rgba(255,255,255,0.3)', borderRadius: '1px' }} />
                            </div>
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

export default OBSPrayerThemeEditorPage;
