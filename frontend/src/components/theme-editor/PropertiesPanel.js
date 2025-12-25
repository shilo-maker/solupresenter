import React from 'react';
import { Card, Form, Row, Col, ButtonGroup, Button } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';

const LINE_TYPE_NAMES = {
  original: 'Original Text',
  transliteration: 'Transliteration',
  translation: 'Translation'
};

const PropertiesPanel = ({
  selectedLine, // 'original' | 'transliteration' | 'translation' | null
  lineStyle, // { fontSize, fontWeight, color, opacity, visible }
  linePosition, // { x, y, width, height, paddingTop, paddingBottom }
  onStyleChange, // (field, value) => void
  onPositionChange, // (field, value) => void
  disabled
}) => {
  const { t } = useTranslation();

  if (!selectedLine) {
    return (
      <Card
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}
      >
        <Card.Body
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '200px',
            color: 'rgba(255, 255, 255, 0.4)'
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <i className="bi bi-cursor" style={{ fontSize: '2rem', marginBottom: '8px', display: 'block' }}></i>
            {t('themes.selectBox', 'Click a text box to edit its style')}
          </div>
        </Card.Body>
      </Card>
    );
  }

  const style = lineStyle || {
    fontSize: 100,
    fontWeight: '400',
    color: '#FFFFFF',
    opacity: 1,
    visible: true
  };

  const position = linePosition || {
    paddingTop: 0,
    paddingBottom: 0
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
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        <i className="bi bi-brush" style={{ color: '#a5b4fc' }}></i>
        <span style={{ color: '#e2e8f0', fontWeight: '500' }}>
          {LINE_TYPE_NAMES[selectedLine]}
        </span>
      </Card.Header>
      <Card.Body>
        <Row className="g-3">
          {/* Visibility Toggle */}
          <Col xs={12}>
            <Form.Check
              type="switch"
              id="visibility-switch"
              label={t('themes.visible', 'Visible')}
              checked={style.visible !== false}
              onChange={(e) => onStyleChange('visible', e.target.checked)}
              disabled={disabled}
              style={{ color: '#a0aec0' }}
            />
          </Col>

          {/* Color */}
          <Col xs={6}>
            <Form.Group>
              <Form.Label style={{ color: '#a0aec0', fontSize: '0.85rem' }}>
                {t('themes.color', 'Color')}
              </Form.Label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Form.Control
                  type="color"
                  value={style.color || '#FFFFFF'}
                  onChange={(e) => onStyleChange('color', e.target.value)}
                  disabled={disabled}
                  style={{ width: '50px', height: '38px', padding: '2px' }}
                />
                <Form.Control
                  type="text"
                  value={style.color || '#FFFFFF'}
                  onChange={(e) => onStyleChange('color', e.target.value)}
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

          {/* Font Weight */}
          <Col xs={6}>
            <Form.Group>
              <Form.Label style={{ color: '#a0aec0', fontSize: '0.85rem' }}>
                {t('themes.fontWeight', 'Font Weight')}
              </Form.Label>
              <Form.Select
                value={style.fontWeight || '400'}
                onChange={(e) => onStyleChange('fontWeight', e.target.value)}
                disabled={disabled}
                style={{
                  backgroundColor: '#2d3748',
                  color: '#e2e8f0',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
              >
                <option value="300">{t('themes.light', 'Light')}</option>
                <option value="400">{t('themes.normal', 'Normal')}</option>
                <option value="500">{t('themes.medium', 'Medium')}</option>
                <option value="600">{t('themes.semibold', 'Semi-Bold')}</option>
                <option value="700">{t('themes.bold', 'Bold')}</option>
              </Form.Select>
            </Form.Group>
          </Col>

          {/* Font Size */}
          <Col xs={12}>
            <Form.Group>
              <Form.Label style={{ color: '#a0aec0', fontSize: '0.85rem' }}>
                {t('themes.fontSize', 'Font Size')} ({style.fontSize || 100}%)
              </Form.Label>
              <Form.Range
                min={50}
                max={150}
                value={style.fontSize || 100}
                onChange={(e) => onStyleChange('fontSize', parseInt(e.target.value))}
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
                <span>50%</span>
                <span>100%</span>
                <span>150%</span>
              </div>
            </Form.Group>
          </Col>

          {/* Opacity */}
          <Col xs={12}>
            <Form.Group>
              <Form.Label style={{ color: '#a0aec0', fontSize: '0.85rem' }}>
                {t('themes.opacity', 'Opacity')} ({Math.round((style.opacity ?? 1) * 100)}%)
              </Form.Label>
              <Form.Range
                min={0}
                max={100}
                value={Math.round((style.opacity ?? 1) * 100)}
                onChange={(e) => onStyleChange('opacity', parseInt(e.target.value) / 100)}
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

          {/* Padding Section */}
          {onPositionChange && (
            <>
              <Col xs={12}>
                <hr style={{ borderColor: 'rgba(255, 255, 255, 0.1)', margin: '8px 0' }} />
                <Form.Label style={{ color: '#a0aec0', fontSize: '0.85rem', marginBottom: '12px', display: 'block' }}>
                  <i className="bi bi-arrows-expand" style={{ marginRight: '6px' }}></i>
                  {t('themes.padding', 'Padding')}
                </Form.Label>
              </Col>

              {/* Padding Top */}
              <Col xs={6}>
                <Form.Group>
                  <Form.Label style={{ color: '#a0aec0', fontSize: '0.8rem' }}>
                    {t('themes.paddingTop', 'Top')} ({position.paddingTop || 0}%)
                  </Form.Label>
                  <Form.Range
                    min={0}
                    max={45}
                    value={position.paddingTop || 0}
                    onChange={(e) => onPositionChange('paddingTop', parseInt(e.target.value))}
                    disabled={disabled}
                  />
                </Form.Group>
              </Col>

              {/* Padding Bottom */}
              <Col xs={6}>
                <Form.Group>
                  <Form.Label style={{ color: '#a0aec0', fontSize: '0.8rem' }}>
                    {t('themes.paddingBottom', 'Bottom')} ({position.paddingBottom || 0}%)
                  </Form.Label>
                  <Form.Range
                    min={0}
                    max={45}
                    value={position.paddingBottom || 0}
                    onChange={(e) => onPositionChange('paddingBottom', parseInt(e.target.value))}
                    disabled={disabled}
                  />
                </Form.Group>
              </Col>

              {/* Alignment Section */}
              <Col xs={12}>
                <hr style={{ borderColor: 'rgba(255, 255, 255, 0.1)', margin: '8px 0' }} />
                <Form.Label style={{ color: '#a0aec0', fontSize: '0.85rem', marginBottom: '12px', display: 'block' }}>
                  <i className="bi bi-text-center" style={{ marginRight: '6px' }}></i>
                  {t('themes.alignment', 'Alignment')}
                </Form.Label>
              </Col>

              {/* Horizontal Alignment */}
              <Col xs={6}>
                <Form.Group>
                  <Form.Label style={{ color: '#a0aec0', fontSize: '0.8rem' }}>
                    {t('themes.horizontal', 'Horizontal')}
                  </Form.Label>
                  <ButtonGroup className="w-100" size="sm">
                    <Button
                      variant={position.alignH === 'left' ? 'primary' : 'outline-secondary'}
                      onClick={() => onPositionChange('alignH', 'left')}
                      disabled={disabled}
                      title={t('themes.left', 'Left')}
                    >
                      <i className="bi bi-text-left"></i>
                    </Button>
                    <Button
                      variant={(!position.alignH || position.alignH === 'center') ? 'primary' : 'outline-secondary'}
                      onClick={() => onPositionChange('alignH', 'center')}
                      disabled={disabled}
                      title={t('themes.center', 'Center')}
                    >
                      <i className="bi bi-text-center"></i>
                    </Button>
                    <Button
                      variant={position.alignH === 'right' ? 'primary' : 'outline-secondary'}
                      onClick={() => onPositionChange('alignH', 'right')}
                      disabled={disabled}
                      title={t('themes.right', 'Right')}
                    >
                      <i className="bi bi-text-right"></i>
                    </Button>
                  </ButtonGroup>
                </Form.Group>
              </Col>

              {/* Vertical Alignment */}
              <Col xs={6}>
                <Form.Group>
                  <Form.Label style={{ color: '#a0aec0', fontSize: '0.8rem' }}>
                    {t('themes.vertical', 'Vertical')}
                  </Form.Label>
                  <ButtonGroup className="w-100" size="sm">
                    <Button
                      variant={position.alignV === 'top' ? 'primary' : 'outline-secondary'}
                      onClick={() => onPositionChange('alignV', 'top')}
                      disabled={disabled}
                      title={t('themes.top', 'Top')}
                    >
                      <i className="bi bi-align-top"></i>
                    </Button>
                    <Button
                      variant={(!position.alignV || position.alignV === 'center') ? 'primary' : 'outline-secondary'}
                      onClick={() => onPositionChange('alignV', 'center')}
                      disabled={disabled}
                      title={t('themes.center', 'Center')}
                    >
                      <i className="bi bi-align-middle"></i>
                    </Button>
                    <Button
                      variant={position.alignV === 'bottom' ? 'primary' : 'outline-secondary'}
                      onClick={() => onPositionChange('alignV', 'bottom')}
                      disabled={disabled}
                      title={t('themes.bottom', 'Bottom')}
                    >
                      <i className="bi bi-align-bottom"></i>
                    </Button>
                  </ButtonGroup>
                </Form.Group>
              </Col>
            </>
          )}
        </Row>
      </Card.Body>
    </Card>
  );
};

export default PropertiesPanel;
