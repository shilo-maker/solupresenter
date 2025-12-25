import React from 'react';
import { Card, Form, Row, Col, Button } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';

const BoxPropertiesPanel = ({
  box, // { id, x, y, width, height, color, opacity, borderRadius }
  boxCount,
  onBoxChange, // (updatedBox) => void
  onAddBox, // () => void
  onDeleteBox, // (boxId) => void
  disabled
}) => {
  const { t } = useTranslation();
  const maxBoxes = 3;

  if (!box) {
    return (
      <Card
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}
      >
        <Card.Header
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-square" style={{ color: '#10b981' }}></i>
            <span style={{ color: '#e2e8f0', fontWeight: '500' }}>
              {t('themes.backgroundBoxes', 'Background Boxes')}
            </span>
          </div>
          <span style={{ fontSize: '0.8rem', color: '#a0aec0' }}>
            {boxCount}/{maxBoxes}
          </span>
        </Card.Header>
        <Card.Body
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '120px',
            color: 'rgba(255, 255, 255, 0.4)',
            gap: '12px'
          }}
        >
          {boxCount < maxBoxes && !disabled ? (
            <>
              <div style={{ textAlign: 'center', fontSize: '0.9rem' }}>
                {t('themes.addBoxHint', 'Add background boxes behind text')}
              </div>
              <Button
                variant="outline-success"
                size="sm"
                onClick={onAddBox}
              >
                <i className="bi bi-plus-lg me-2"></i>
                {t('themes.addBox', 'Add Box')}
              </Button>
            </>
          ) : boxCount >= maxBoxes ? (
            <div style={{ textAlign: 'center', fontSize: '0.9rem' }}>
              {t('themes.maxBoxesReached', 'Maximum 3 boxes allowed')}
            </div>
          ) : (
            <div style={{ textAlign: 'center', fontSize: '0.9rem' }}>
              {t('themes.selectBoxToEdit', 'Select a box on canvas to edit')}
            </div>
          )}
        </Card.Body>
      </Card>
    );
  }

  const handleChange = (field, value) => {
    onBoxChange({ ...box, [field]: value });
  };

  return (
    <Card
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}
    >
      <Card.Header
        style={{
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div className="d-flex align-items-center gap-2">
          <i className="bi bi-square-fill" style={{ color: '#10b981' }}></i>
          <span style={{ color: '#e2e8f0', fontWeight: '500' }}>
            {t('themes.editBox', 'Edit Box')}
          </span>
        </div>
        <div className="d-flex align-items-center gap-2">
          <span style={{ fontSize: '0.8rem', color: '#a0aec0' }}>
            {boxCount}/{maxBoxes}
          </span>
          {boxCount < maxBoxes && !disabled && (
            <Button
              variant="outline-success"
              size="sm"
              onClick={onAddBox}
              style={{ padding: '2px 8px', fontSize: '0.75rem' }}
            >
              <i className="bi bi-plus-lg"></i>
            </Button>
          )}
        </div>
      </Card.Header>
      <Card.Body>
        <Row className="g-3">
          {/* Color */}
          <Col xs={6}>
            <Form.Group>
              <Form.Label style={{ color: '#a0aec0', fontSize: '0.85rem' }}>
                {t('themes.fillColor', 'Fill Color')}
              </Form.Label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Form.Control
                  type="color"
                  value={box.color || '#000000'}
                  onChange={(e) => handleChange('color', e.target.value)}
                  disabled={disabled}
                  style={{ width: '50px', height: '38px', padding: '2px' }}
                />
                <Form.Control
                  type="text"
                  value={box.color || '#000000'}
                  onChange={(e) => handleChange('color', e.target.value)}
                  disabled={disabled}
                  style={{
                    backgroundColor: '#2d3748',
                    color: '#e2e8f0',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    fontSize: '0.85rem'
                  }}
                />
              </div>
            </Form.Group>
          </Col>

          {/* Border Radius */}
          <Col xs={6}>
            <Form.Group>
              <Form.Label style={{ color: '#a0aec0', fontSize: '0.85rem' }}>
                {t('themes.borderRadius', 'Corner Radius')}
              </Form.Label>
              <Form.Control
                type="number"
                min={0}
                max={100}
                value={box.borderRadius || 0}
                onChange={(e) => handleChange('borderRadius', parseInt(e.target.value) || 0)}
                disabled={disabled}
                style={{
                  backgroundColor: '#2d3748',
                  color: '#e2e8f0',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
              />
            </Form.Group>
          </Col>

          {/* Opacity */}
          <Col xs={12}>
            <Form.Group>
              <Form.Label style={{ color: '#a0aec0', fontSize: '0.85rem' }}>
                {t('themes.opacity', 'Opacity')} ({Math.round((box.opacity ?? 0.5) * 100)}%)
              </Form.Label>
              <Form.Range
                min={0}
                max={100}
                value={Math.round((box.opacity ?? 0.5) * 100)}
                onChange={(e) => handleChange('opacity', parseInt(e.target.value) / 100)}
                disabled={disabled}
              />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.75rem',
                  color: 'rgba(255, 255, 255, 0.3)'
                }}
              >
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </Form.Group>
          </Col>

          {/* Delete button */}
          {!disabled && (
            <Col xs={12}>
              <Button
                variant="outline-danger"
                size="sm"
                onClick={() => onDeleteBox(box.id)}
                className="w-100"
              >
                <i className="bi bi-trash me-2"></i>
                {t('themes.deleteBox', 'Delete Box')}
              </Button>
            </Col>
          )}
        </Row>
      </Card.Body>
    </Card>
  );
};

export default BoxPropertiesPanel;
