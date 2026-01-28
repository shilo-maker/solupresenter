import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { theme as appTheme } from '../styles/theme';
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

type BibleLineType = 'hebrew' | 'english' | 'reference' | 'referenceEnglish';

interface BibleTheme {
  id: string;
  name: string;
  isBuiltIn: boolean;
  viewerBackground: ViewerBackground;
  canvasDimensions: CanvasDimensions;
  lineOrder: BibleLineType[];
  linePositions: Record<string, LinePosition>;
  lineStyles: Record<string, LineStyle>;
  referenceStyle: LineStyle;
  referencePosition: LinePosition;
  referenceEnglishStyle: LineStyle;
  referenceEnglishPosition: LinePosition;
  backgroundBoxes: BackgroundBox[];
}

const LINE_LABELS: Record<string, string> = {
  hebrew: 'Hebrew',
  english: 'English',
  reference: '📖 Hebrew Reference',
  referenceEnglish: '📖 English Reference'
};

const DEFAULT_LINE_POSITIONS: Record<string, LinePosition> = {
  hebrew: {
    x: 0, y: 25, width: 100, height: 20,
    paddingTop: 2, paddingBottom: 2,
    alignH: 'center', alignV: 'center'
  },
  english: {
    x: 0, y: 45, width: 100, height: 20,
    paddingTop: 1, paddingBottom: 1,
    alignH: 'center', alignV: 'center'
  }
};

const DEFAULT_LINE_STYLES: Record<string, LineStyle> = {
  hebrew: {
    fontSize: 160, fontWeight: '700', color: '#ffffff', opacity: 1, visible: true
  },
  english: {
    fontSize: 120, fontWeight: '400', color: '#e0e0e0', opacity: 0.9, visible: true
  }
};

// Hebrew reference (bottom-left)
const DEFAULT_REFERENCE_POSITION: LinePosition = {
  x: 2, y: 44, width: 50, height: 5,
  paddingTop: 0, paddingBottom: 0,
  alignH: 'left', alignV: 'center'
};

const DEFAULT_REFERENCE_STYLE: LineStyle = {
  fontSize: 50, fontWeight: '400', color: '#a0a0a0', opacity: 1, visible: true
};

// English reference (bottom-right)
const DEFAULT_REFERENCE_ENGLISH_POSITION: LinePosition = {
  x: 48, y: 90, width: 50, height: 8,
  paddingTop: 0, paddingBottom: 0,
  alignH: 'right', alignV: 'center'
};

const DEFAULT_REFERENCE_ENGLISH_STYLE: LineStyle = {
  fontSize: 50, fontWeight: '400', color: '#a0a0a0', opacity: 1, visible: true
};

const BibleThemeEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const themeId = searchParams.get('id');

  const [theme, setTheme] = useState<BibleTheme>({
    id: '',
    name: 'New Bible Theme',
    isBuiltIn: false,
    viewerBackground: { type: 'color', color: '#000000' },
    canvasDimensions: { width: 1920, height: 1080 },
    lineOrder: ['hebrew', 'english', 'reference', 'referenceEnglish'],
    linePositions: DEFAULT_LINE_POSITIONS,
    lineStyles: DEFAULT_LINE_STYLES,
    referenceStyle: DEFAULT_REFERENCE_STYLE,
    referencePosition: DEFAULT_REFERENCE_POSITION,
    referenceEnglishStyle: DEFAULT_REFERENCE_ENGLISH_STYLE,
    referenceEnglishPosition: DEFAULT_REFERENCE_ENGLISH_POSITION,
    backgroundBoxes: []
  });

  const [selectedElement, setSelectedElement] = useState<{ type: 'line' | 'box' | 'reference'; id: string } | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'layout' | 'background' | 'resolution'>('layout');

  // Drag and drop state for layer reordering
  const [draggedItem, setDraggedItem] = useState<{ type: 'line' | 'box'; id: string; index: number } | null>(null);
  const [dragOverItem, setDragOverItem] = useState<{ type: 'line' | 'box'; index: number } | null>(null);

  // Preview text for testing (not saved with theme)
  const [previewTexts, setPreviewTexts] = useState<Record<string, string>>({
    hebrew: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים',
    english: 'In the beginning God created',
    reference: 'בראשית א:א',
    referenceEnglish: 'Genesis 1:1'
  });

  const handlePreviewTextChange = useCallback((lineType: string, text: string) => {
    setPreviewTexts(prev => ({ ...prev, [lineType]: text }));
  }, []);

  // Load theme if editing existing
  useEffect(() => {
    if (themeId) {
      window.electronAPI.getBibleTheme(themeId).then((loadedTheme: any) => {
        if (loadedTheme) {
          // Ensure lineOrder includes reference types (for backwards compatibility with old themes)
          let lineOrder = loadedTheme.lineOrder || ['hebrew', 'english'];
          if (!lineOrder.includes('reference')) {
            lineOrder = [...lineOrder, 'reference'];
          }
          if (!lineOrder.includes('referenceEnglish')) {
            lineOrder = [...lineOrder, 'referenceEnglish'];
          }

          setTheme({
            id: loadedTheme.id || '',
            name: loadedTheme.name || 'Untitled Theme',
            isBuiltIn: loadedTheme.isBuiltIn ?? false,
            viewerBackground: loadedTheme.viewerBackground || { type: 'color', color: '#000000' },
            canvasDimensions: loadedTheme.canvasDimensions || { width: 1920, height: 1080 },
            lineOrder: lineOrder as BibleLineType[],
            linePositions: loadedTheme.linePositions || DEFAULT_LINE_POSITIONS,
            lineStyles: loadedTheme.lineStyles || DEFAULT_LINE_STYLES,
            referenceStyle: { ...DEFAULT_REFERENCE_STYLE, ...loadedTheme.referenceStyle },
            referencePosition: { ...DEFAULT_REFERENCE_POSITION, ...loadedTheme.referencePosition },
            referenceEnglishStyle: { ...DEFAULT_REFERENCE_ENGLISH_STYLE, ...loadedTheme.referenceEnglishStyle },
            referenceEnglishPosition: { ...DEFAULT_REFERENCE_ENGLISH_POSITION, ...loadedTheme.referenceEnglishPosition },
            backgroundBoxes: loadedTheme.backgroundBoxes || []
          });
        }
      }).catch((error) => {
        console.error('Failed to load bible theme:', error);
      });
    }
  }, [themeId]);

  const handleLinePositionChange = useCallback((lineType: string, position: LinePosition) => {
    if (lineType === 'reference') {
      setTheme(prev => ({ ...prev, referencePosition: position }));
    } else if (lineType === 'referenceEnglish') {
      setTheme(prev => ({ ...prev, referenceEnglishPosition: position }));
    } else {
      setTheme(prev => ({
        ...prev,
        linePositions: { ...prev.linePositions, [lineType]: position }
      }));
    }
    setHasChanges(true);
  }, []);

  const handleLineStyleChange = useCallback((lineType: string, style: LineStyle) => {
    if (lineType === 'reference') {
      setTheme(prev => ({ ...prev, referenceStyle: style }));
    } else if (lineType === 'referenceEnglish') {
      setTheme(prev => ({ ...prev, referenceEnglishStyle: style }));
    } else {
      setTheme(prev => ({
        ...prev,
        lineStyles: { ...prev.lineStyles, [lineType]: style }
      }));
    }
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
      setTheme(prev => ({ ...prev, lineOrder: newLineOrder as BibleLineType[] }));
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
        referenceStyle: theme.referenceStyle,
        referencePosition: theme.referencePosition,
        referenceEnglishStyle: theme.referenceEnglishStyle,
        referenceEnglishPosition: theme.referenceEnglishPosition,
        backgroundBoxes: theme.backgroundBoxes
      };

      if (theme.id) {
        await window.electronAPI.updateBibleTheme(theme.id, themeData);
      } else {
        const created = await window.electronAPI.createBibleTheme(themeData);
        setTheme(prev => ({ ...prev, id: created.id }));
      }
      setHasChanges(false);

      // Broadcast the updated theme to all connected displays showing Bible content
      await window.electronAPI.applyBibleTheme({ ...themeData, id: theme.id });

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

  const selectedLineType = selectedElement?.type === 'line' ? selectedElement.id as 'hebrew' | 'english' :
                           selectedElement?.type === 'reference' ? selectedElement.id as 'reference' | 'referenceEnglish' : null;
  const selectedBox = selectedElement?.type === 'box'
    ? theme.backgroundBoxes.find(b => b.id === selectedElement.id)
    : null;

  // Get the style/position for selected element
  const getSelectedStyle = () => {
    if (selectedLineType === 'reference') return theme.referenceStyle;
    if (selectedLineType === 'referenceEnglish') return theme.referenceEnglishStyle;
    if (selectedLineType) return theme.lineStyles[selectedLineType];
    return null;
  };

  const getSelectedPosition = () => {
    if (selectedLineType === 'reference') return theme.referencePosition;
    if (selectedLineType === 'referenceEnglish') return theme.referenceEnglishPosition;
    if (selectedLineType) return theme.linePositions[selectedLineType];
    return null;
  };

  // Build combined positions and styles including both references
  const allLinePositions = {
    ...theme.linePositions,
    reference: theme.referencePosition,
    referenceEnglish: theme.referenceEnglishPosition
  };

  const allLineStyles = {
    ...theme.lineStyles,
    reference: theme.referenceStyle,
    referenceEnglish: theme.referenceEnglishStyle
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
            borderRadius: '4px',
            background: 'rgba(76, 175, 80, 0.3)',
            color: '#81c784',
            fontSize: '12px',
            fontWeight: 600
          }}>
            Bible Theme
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
                background: saveStatus === 'saved' ? '#28a745' : '#4CAF50',
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
            linePositions={allLinePositions}
            lineStyles={allLineStyles}
            backgroundBoxes={theme.backgroundBoxes}
            selectedElement={selectedElement}
            onSelectElement={setSelectedElement as any}
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
                  background: activeTab === tab.id ? 'rgba(76,175,80,0.15)' : 'transparent',
                  color: activeTab === tab.id ? '#4CAF50' : 'rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  borderBottom: activeTab === tab.id ? '2px solid #4CAF50' : '2px solid transparent'
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
                      Layers (drag to reorder)
                    </div>
                    {theme.lineOrder.map((lineType, index) => {
                      // Get the correct style based on line type
                      const isReference = lineType === 'reference' || lineType === 'referenceEnglish';
                      const style = lineType === 'reference'
                        ? theme.referenceStyle
                        : lineType === 'referenceEnglish'
                          ? theme.referenceEnglishStyle
                          : theme.lineStyles[lineType];
                      const isSelected = (selectedElement?.type === 'line' && selectedElement.id === lineType) ||
                                        (selectedElement?.type === 'reference' && selectedElement.id === lineType);
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
                          onClick={() => setSelectedElement({
                            type: isReference ? 'reference' : 'line',
                            id: lineType
                          })}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 10px',
                            marginBottom: '4px',
                            borderRadius: '4px',
                            background: isSelected
                              ? (isReference ? 'rgba(6,182,212,0.2)' : 'rgba(76,175,80,0.2)')
                              : 'rgba(255,255,255,0.05)',
                            border: isDragOver
                              ? '2px dashed #4CAF50'
                              : isSelected
                                ? (isReference ? '1px solid rgba(6,182,212,0.5)' : '1px solid rgba(76,175,80,0.5)')
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
                            color: isVisible
                              ? (isReference ? '#06b6d4' : 'rgba(255,255,255,0.9)')
                              : 'rgba(255,255,255,0.4)'
                          }}>
                            {LINE_LABELS[lineType] || lineType}
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
                              background: isSelected ? 'rgba(76,175,80,0.2)' : 'rgba(255,255,255,0.05)',
                              border: isDragOver
                                ? '2px dashed #4CAF50'
                                : isSelected
                                  ? '1px solid rgba(76,175,80,0.5)'
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
                    position={getSelectedPosition()!}
                    style={getSelectedStyle()!}
                    onPositionChange={(pos) => handleLinePositionChange(selectedLineType, pos)}
                    onStyleChange={(style) => handleLineStyleChange(selectedLineType, style)}
                    availableLineTypes={[...theme.lineOrder, 'reference', 'referenceEnglish']}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                    <span style={{ fontSize: '13px' }}>Transparent (Inherit)</span>
                  </label>
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

export default BibleThemeEditorPage;
