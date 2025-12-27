import React, { useState, useEffect } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import { v4 as uuidv4 } from 'uuid';
import PresentationCanvas from './PresentationCanvas';
import TextPropertiesPanel from './TextPropertiesPanel';
import SlidesThumbnailPanel from './SlidesThumbnailPanel';
import { presentationAPI } from '../../services/api';

const DEFAULT_CANVAS_DIMENSIONS = { width: 1920, height: 1080 };

const createDefaultSlide = () => ({
  id: uuidv4(),
  order: 0,
  textBoxes: [],
  backgroundColor: null
});

const createDefaultTextBox = () => ({
  id: uuidv4(),
  text: 'New Text',
  x: 30,
  y: 40,
  width: 40,
  height: 20,
  fontSize: 100,
  fontWeight: '400',
  color: '#FFFFFF',
  textAlign: 'center',
  verticalAlign: 'center',
  bold: false,
  italic: false,
  underline: false,
  backgroundColor: '',
  opacity: 1
});

const PresentationEditor = ({
  show,
  onHide,
  presentation, // Existing presentation to edit, or null for new
  onSave // (presentation) => void
}) => {
  const [title, setTitle] = useState('');
  const [slides, setSlides] = useState([createDefaultSlide()]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [selectedTextBoxId, setSelectedTextBoxId] = useState(null);
  const [canvasDimensions] = useState(DEFAULT_CANVAS_DIMENSIONS);
  const [backgroundSettings, setBackgroundSettings] = useState({ type: 'color', value: '#000000' });
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  // Load existing presentation data
  useEffect(() => {
    if (presentation) {
      setTitle(presentation.title || '');
      setSlides(presentation.slides && presentation.slides.length > 0
        ? presentation.slides
        : [createDefaultSlide()]);
      setBackgroundSettings(presentation.backgroundSettings || { type: 'color', value: '#000000' });
      setCurrentSlideIndex(0);
      setSelectedTextBoxId(null);
      setHasChanges(false);
    } else {
      // New presentation
      setTitle('');
      setSlides([createDefaultSlide()]);
      setCurrentSlideIndex(0);
      setSelectedTextBoxId(null);
      setBackgroundSettings({ type: 'color', value: '#000000' });
      setHasChanges(false);
    }
  }, [presentation, show]);

  const currentSlide = slides[currentSlideIndex];
  const selectedTextBox = currentSlide?.textBoxes?.find(tb => tb.id === selectedTextBoxId);

  // Mark as having changes
  const markChanged = () => setHasChanges(true);

  // Update a slide
  const updateSlide = (index, updatedSlide) => {
    const newSlides = [...slides];
    newSlides[index] = updatedSlide;
    setSlides(newSlides);
    markChanged();
  };

  // Add a new text box to current slide
  const handleAddTextBox = () => {
    const newTextBox = createDefaultTextBox();
    const updatedSlide = {
      ...currentSlide,
      textBoxes: [...(currentSlide.textBoxes || []), newTextBox]
    };
    updateSlide(currentSlideIndex, updatedSlide);
    setSelectedTextBoxId(newTextBox.id);
  };

  // Update a text box
  const handleTextBoxChange = (updatedTextBox) => {
    const updatedTextBoxes = currentSlide.textBoxes.map(tb =>
      tb.id === updatedTextBox.id ? updatedTextBox : tb
    );
    updateSlide(currentSlideIndex, { ...currentSlide, textBoxes: updatedTextBoxes });
  };

  // Delete a text box
  const handleDeleteTextBox = (textBoxId) => {
    const updatedTextBoxes = currentSlide.textBoxes.filter(tb => tb.id !== textBoxId);
    updateSlide(currentSlideIndex, { ...currentSlide, textBoxes: updatedTextBoxes });
    if (selectedTextBoxId === textBoxId) {
      setSelectedTextBoxId(null);
    }
  };

  // Add a new slide
  const handleAddSlide = () => {
    const newSlide = createDefaultSlide();
    newSlide.order = slides.length;
    setSlides([...slides, newSlide]);
    setCurrentSlideIndex(slides.length);
    setSelectedTextBoxId(null);
    markChanged();
  };

  // Delete a slide
  const handleDeleteSlide = (index) => {
    if (slides.length <= 1) return;
    const newSlides = slides.filter((_, i) => i !== index);
    setSlides(newSlides);
    if (currentSlideIndex >= newSlides.length) {
      setCurrentSlideIndex(newSlides.length - 1);
    } else if (currentSlideIndex > index) {
      setCurrentSlideIndex(currentSlideIndex - 1);
    }
    setSelectedTextBoxId(null);
    markChanged();
  };

  // Move a slide
  const handleMoveSlide = (fromIndex, toIndex) => {
    const newSlides = [...slides];
    const [movedSlide] = newSlides.splice(fromIndex, 1);
    newSlides.splice(toIndex, 0, movedSlide);
    setSlides(newSlides);
    setCurrentSlideIndex(toIndex);
    markChanged();
  };

  // Select a slide
  const handleSelectSlide = (index) => {
    setCurrentSlideIndex(index);
    setSelectedTextBoxId(null);
  };

  // Update slide background
  const handleSlideBackgroundChange = (color) => {
    updateSlide(currentSlideIndex, { ...currentSlide, backgroundColor: color || null });
  };

  // Save presentation
  const handleSave = async () => {
    if (!title.trim()) {
      alert('Please enter a title for the presentation');
      return;
    }

    setIsSaving(true);
    try {
      const presentationData = {
        title: title.trim(),
        slides: slides.map((slide, index) => ({ ...slide, order: index })),
        canvasDimensions,
        backgroundSettings
      };

      let savedPresentation;
      if (presentation?.id) {
        // Update existing
        const response = await presentationAPI.update(presentation.id, presentationData);
        savedPresentation = response.data.presentation;
      } else {
        // Create new
        const response = await presentationAPI.create(presentationData);
        savedPresentation = response.data.presentation;
      }

      setHasChanges(false);
      if (onSave) {
        onSave(savedPresentation);
      }
      onHide();
    } catch (error) {
      console.error('Error saving presentation:', error);
      alert('Failed to save presentation. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle close with unsaved changes warning
  const handleClose = () => {
    if (hasChanges) {
      setShowConfirmClose(true);
    } else {
      onHide();
    }
  };

  // Confirm close without saving
  const handleConfirmClose = () => {
    setShowConfirmClose(false);
    onHide();
  };

  return (
    <Modal
      show={show}
      onHide={handleClose}
      size="xl"
      fullscreen="lg-down"
      centered
      backdrop="static"
      dialogClassName="presentation-editor-modal"
    >
      <Modal.Header
        closeButton={false}
        style={{
          backgroundColor: '#1a1a2e',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Button
            variant="outline-light"
            size="sm"
            onClick={handleClose}
            style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.5)' }}
          >
            ← Back
          </Button>
          <Form.Control
            type="text"
            placeholder="Presentation Title"
            value={title}
            onChange={(e) => { setTitle(e.target.value); markChanged(); }}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#fff',
              maxWidth: '300px'
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Button
            variant="light"
            size="sm"
            onClick={handleAddTextBox}
            style={{ backgroundColor: '#6366f1', color: '#fff', border: 'none' }}
          >
            + Add Text
          </Button>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={handleClose}
            style={{ color: '#ccc', borderColor: 'rgba(255,255,255,0.3)' }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !title.trim()}
            style={{ color: '#fff' }}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          <Button
            variant="link"
            size="sm"
            onClick={handleClose}
            style={{ color: '#999', fontSize: '20px', padding: '0 8px', textDecoration: 'none' }}
            title="Close"
          >
            ×
          </Button>
        </div>
      </Modal.Header>

      <Modal.Body
        style={{
          backgroundColor: '#16161d',
          padding: 0,
          display: 'flex',
          height: 'calc(100vh - 200px)',
          minHeight: '500px'
        }}
      >
        {/* Left panel - Slides */}
        <SlidesThumbnailPanel
          slides={slides}
          currentSlideIndex={currentSlideIndex}
          onSelectSlide={handleSelectSlide}
          onAddSlide={handleAddSlide}
          onDeleteSlide={handleDeleteSlide}
          onMoveSlide={handleMoveSlide}
          canvasDimensions={canvasDimensions}
        />

        {/* Center - Canvas */}
        <div
          style={{
            flex: 1,
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'auto'
          }}
        >
          <PresentationCanvas
            canvasDimensions={canvasDimensions}
            textBoxes={currentSlide?.textBoxes || []}
            backgroundColor={currentSlide?.backgroundColor}
            selectedTextBoxId={selectedTextBoxId}
            onTextBoxChange={handleTextBoxChange}
            onSelectTextBox={setSelectedTextBoxId}
            onDeleteTextBox={handleDeleteTextBox}
          />

          {/* Slide background control */}
          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px' }}>Slide Background:</span>
            <Form.Control
              type="color"
              value={currentSlide?.backgroundColor || '#000000'}
              onChange={(e) => handleSlideBackgroundChange(e.target.value)}
              style={{ width: '40px', height: '28px', padding: '2px' }}
            />
            <Button
              size="sm"
              variant="outline-secondary"
              onClick={() => handleSlideBackgroundChange(null)}
            >
              Reset
            </Button>
          </div>
        </div>

        {/* Right panel - Properties */}
        <div
          style={{
            width: '220px',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            borderLeft: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          <TextPropertiesPanel
            textBox={selectedTextBox}
            onTextBoxChange={handleTextBoxChange}
            onDelete={() => selectedTextBoxId && handleDeleteTextBox(selectedTextBoxId)}
          />
        </div>
      </Modal.Body>

      <style>{`
        .presentation-editor-modal {
          max-width: 95vw;
        }
        .presentation-editor-modal .modal-content {
          background-color: #16161d;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
      `}</style>

      {/* Confirm close dialog */}
      <Modal
        show={showConfirmClose}
        onHide={() => setShowConfirmClose(false)}
        centered
        size="sm"
        style={{ zIndex: 1060 }}
      >
        <Modal.Header style={{ backgroundColor: '#1a1a2e', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Modal.Title style={{ color: '#fff', fontSize: '16px' }}>Unsaved Changes</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ backgroundColor: '#1a1a2e', color: '#ccc' }}>
          You have unsaved changes. Are you sure you want to close without saving?
        </Modal.Body>
        <Modal.Footer style={{ backgroundColor: '#1a1a2e', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <Button variant="secondary" size="sm" onClick={() => setShowConfirmClose(false)}>
            Keep Editing
          </Button>
          <Button variant="danger" size="sm" onClick={handleConfirmClose}>
            Discard Changes
          </Button>
        </Modal.Footer>
      </Modal>
    </Modal>
  );
};

export default PresentationEditor;
