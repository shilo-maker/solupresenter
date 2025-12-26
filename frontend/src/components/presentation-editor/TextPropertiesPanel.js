import React from 'react';
import { Form, Button, ButtonGroup } from 'react-bootstrap';

const TextPropertiesPanel = ({
  textBox, // The selected text box
  onTextBoxChange, // (updatedTextBox) => void
  onDelete // () => void
}) => {
  if (!textBox) {
    return (
      <div style={{ padding: '16px', color: 'rgba(255, 255, 255, 0.5)', textAlign: 'center' }}>
        Select a text box to edit its properties
      </div>
    );
  }

  const handleChange = (field, value) => {
    onTextBoxChange({ ...textBox, [field]: value });
  };

  return (
    <div style={{ padding: '16px' }}>
      <h6 style={{ color: '#fff', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
        Text Properties
      </h6>

      {/* Text Content */}
      <Form.Group className="mb-3">
        <Form.Label style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px' }}>Text Content</Form.Label>
        <Form.Control
          as="textarea"
          rows={3}
          value={textBox.text || ''}
          onChange={(e) => handleChange('text', e.target.value)}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#fff',
            fontSize: '14px'
          }}
          placeholder="Enter text..."
        />
      </Form.Group>

      {/* Text Color */}
      <Form.Group className="mb-3">
        <Form.Label style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px' }}>Text Color</Form.Label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Form.Control
            type="color"
            value={textBox.color || '#FFFFFF'}
            onChange={(e) => handleChange('color', e.target.value)}
            style={{ width: '50px', height: '32px', padding: '2px' }}
          />
          <Form.Control
            type="text"
            value={textBox.color || '#FFFFFF'}
            onChange={(e) => handleChange('color', e.target.value)}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#fff',
              fontSize: '12px',
              flex: 1
            }}
          />
        </div>
      </Form.Group>

      {/* Background Color */}
      <Form.Group className="mb-3">
        <Form.Label style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px' }}>Background</Form.Label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Form.Control
            type="color"
            value={textBox.backgroundColor || '#000000'}
            onChange={(e) => handleChange('backgroundColor', e.target.value)}
            style={{ width: '50px', height: '32px', padding: '2px' }}
          />
          <Button
            size="sm"
            variant={textBox.backgroundColor ? 'outline-light' : 'outline-secondary'}
            onClick={() => handleChange('backgroundColor', textBox.backgroundColor ? '' : '#000000')}
          >
            {textBox.backgroundColor ? 'Clear' : 'Add BG'}
          </Button>
        </div>
      </Form.Group>

      {/* Font Size */}
      <Form.Group className="mb-3">
        <Form.Label style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px' }}>
          Font Size: {textBox.fontSize || 100}%
        </Form.Label>
        <Form.Range
          min="50"
          max="200"
          value={textBox.fontSize || 100}
          onChange={(e) => handleChange('fontSize', parseInt(e.target.value))}
        />
      </Form.Group>

      {/* Text Style (Bold, Italic, Underline) */}
      <Form.Group className="mb-3">
        <Form.Label style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px' }}>Text Style</Form.Label>
        <div>
          <ButtonGroup size="sm">
            <Button
              variant={textBox.bold ? 'primary' : 'outline-light'}
              onClick={() => handleChange('bold', !textBox.bold)}
              style={{ fontWeight: 'bold' }}
            >
              B
            </Button>
            <Button
              variant={textBox.italic ? 'primary' : 'outline-light'}
              onClick={() => handleChange('italic', !textBox.italic)}
              style={{ fontStyle: 'italic' }}
            >
              I
            </Button>
            <Button
              variant={textBox.underline ? 'primary' : 'outline-light'}
              onClick={() => handleChange('underline', !textBox.underline)}
              style={{ textDecoration: 'underline' }}
            >
              U
            </Button>
          </ButtonGroup>
        </div>
      </Form.Group>

      {/* Horizontal Alignment */}
      <Form.Group className="mb-3">
        <Form.Label style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px' }}>Horizontal Align</Form.Label>
        <div>
          <ButtonGroup size="sm">
            <Button
              variant={textBox.verticalAlign === 'top' ? 'primary' : 'outline-light'}
              onClick={() => handleChange('verticalAlign', 'top')}
              title="Left"
              style={{ padding: '4px 8px' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="2" width="14" height="2" />
                <rect x="6" y="6" width="9" height="2" />
                <rect x="3" y="10" width="12" height="2" />
              </svg>
            </Button>
            <Button
              variant={(!textBox.verticalAlign || textBox.verticalAlign === 'center') ? 'primary' : 'outline-light'}
              onClick={() => handleChange('verticalAlign', 'center')}
              title="Center"
              style={{ padding: '4px 8px' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="2" width="14" height="2" />
                <rect x="3.5" y="6" width="9" height="2" />
                <rect x="2" y="10" width="12" height="2" />
              </svg>
            </Button>
            <Button
              variant={textBox.verticalAlign === 'bottom' ? 'primary' : 'outline-light'}
              onClick={() => handleChange('verticalAlign', 'bottom')}
              title="Right"
              style={{ padding: '4px 8px' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="2" width="14" height="2" />
                <rect x="1" y="6" width="9" height="2" />
                <rect x="1" y="10" width="12" height="2" />
              </svg>
            </Button>
          </ButtonGroup>
        </div>
      </Form.Group>

      {/* Vertical Alignment */}
      <Form.Group className="mb-3">
        <Form.Label style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px' }}>Vertical Align</Form.Label>
        <div>
          <ButtonGroup size="sm">
            <Button
              variant={textBox.textAlign === 'left' ? 'primary' : 'outline-light'}
              onClick={() => handleChange('textAlign', 'left')}
              title="Top"
              style={{ padding: '4px 8px' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="1" width="14" height="1" rx="0.5" opacity="0.4" />
                <rect x="1" y="14" width="14" height="1" rx="0.5" opacity="0.4" />
                <rect x="5" y="3" width="6" height="2" />
              </svg>
            </Button>
            <Button
              variant={(!textBox.textAlign || textBox.textAlign === 'center') ? 'primary' : 'outline-light'}
              onClick={() => handleChange('textAlign', 'center')}
              title="Middle"
              style={{ padding: '4px 8px' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="1" width="14" height="1" rx="0.5" opacity="0.4" />
                <rect x="1" y="14" width="14" height="1" rx="0.5" opacity="0.4" />
                <rect x="5" y="7" width="6" height="2" />
              </svg>
            </Button>
            <Button
              variant={textBox.textAlign === 'right' ? 'primary' : 'outline-light'}
              onClick={() => handleChange('textAlign', 'right')}
              title="Bottom"
              style={{ padding: '4px 8px' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="1" width="14" height="1" rx="0.5" opacity="0.4" />
                <rect x="1" y="14" width="14" height="1" rx="0.5" opacity="0.4" />
                <rect x="5" y="11" width="6" height="2" />
              </svg>
            </Button>
          </ButtonGroup>
        </div>
      </Form.Group>

      {/* Opacity */}
      <Form.Group className="mb-3">
        <Form.Label style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px' }}>
          Opacity: {Math.round((textBox.opacity !== undefined ? textBox.opacity : 1) * 100)}%
        </Form.Label>
        <Form.Range
          min="0"
          max="100"
          value={(textBox.opacity !== undefined ? textBox.opacity : 1) * 100}
          onChange={(e) => handleChange('opacity', parseInt(e.target.value) / 100)}
        />
      </Form.Group>

      {/* Delete Button */}
      <Button
        variant="outline-danger"
        size="sm"
        onClick={onDelete}
        style={{ width: '100%', marginTop: '16px' }}
      >
        Delete Text Box
      </Button>
    </div>
  );
};

export default TextPropertiesPanel;
