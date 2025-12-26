import React from 'react';
import { Button } from 'react-bootstrap';

const SlidesThumbnailPanel = ({
  slides, // Array of slide objects
  currentSlideIndex,
  onSelectSlide, // (index) => void
  onAddSlide, // () => void
  onDeleteSlide, // (index) => void
  onMoveSlide, // (fromIndex, toIndex) => void
  canvasDimensions
}) => {
  const thumbnailWidth = 120;
  const thumbnailHeight = thumbnailWidth * (canvasDimensions.height / canvasDimensions.width);

  const renderSlideThumbnail = (slide, index) => {
    const isSelected = index === currentSlideIndex;

    return (
      <div
        key={slide.id}
        onClick={() => onSelectSlide(index)}
        style={{
          width: thumbnailWidth,
          height: thumbnailHeight,
          marginBottom: '8px',
          cursor: 'pointer',
          position: 'relative',
          borderRadius: '4px',
          overflow: 'hidden',
          border: isSelected ? '2px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.2)',
          background: slide.backgroundColor || 'linear-gradient(-45deg, #0a0a0a, #1a1a2e)',
          transition: 'border-color 0.2s'
        }}
      >
        {/* Slide number */}
        <div
          style={{
            position: 'absolute',
            top: '4px',
            left: '4px',
            fontSize: '10px',
            color: 'rgba(255, 255, 255, 0.7)',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            padding: '2px 6px',
            borderRadius: '3px'
          }}
        >
          {index + 1}
        </div>

        {/* Mini preview of text boxes */}
        {slide.textBoxes && slide.textBoxes.map((textBox) => (
          <div
            key={textBox.id}
            style={{
              position: 'absolute',
              left: `${textBox.x}%`,
              top: `${textBox.y}%`,
              width: `${textBox.width}%`,
              height: `${textBox.height}%`,
              backgroundColor: textBox.backgroundColor || 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '2px',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div
              style={{
                fontSize: '6px',
                color: textBox.color || '#fff',
                textAlign: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                padding: '1px'
              }}
            >
              {textBox.text ? textBox.text.substring(0, 15) : ''}
            </div>
          </div>
        ))}

        {/* Delete slide button */}
        {slides.length > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteSlide(index);
            }}
            style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.8)',
              border: 'none',
              color: 'white',
              fontSize: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0.7,
              transition: 'opacity 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.opacity = 1}
            onMouseLeave={(e) => e.target.style.opacity = 0.7}
            title="Delete slide"
          >
            ×
          </button>
        )}

        {/* Move buttons */}
        <div
          style={{
            position: 'absolute',
            bottom: '2px',
            right: '2px',
            display: 'flex',
            gap: '2px'
          }}
        >
          {index > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveSlide(index, index - 1);
              }}
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '2px',
                backgroundColor: 'rgba(99, 102, 241, 0.8)',
                border: 'none',
                color: 'white',
                fontSize: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Move up"
            >
              ↑
            </button>
          )}
          {index < slides.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveSlide(index, index + 1);
              }}
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '2px',
                backgroundColor: 'rgba(99, 102, 241, 0.8)',
                border: 'none',
                color: 'white',
                fontSize: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Move down"
            >
              ↓
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        width: '150px',
        padding: '12px',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderRight: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <h6 style={{ color: '#fff', marginBottom: '12px', fontSize: '12px', textAlign: 'center' }}>
        Slides
      </h6>

      {/* Slide thumbnails */}
      <div style={{ flex: 1 }}>
        {slides.map((slide, index) => renderSlideThumbnail(slide, index))}
      </div>

      {/* Add slide button */}
      <Button
        variant="outline-light"
        size="sm"
        onClick={onAddSlide}
        style={{ marginTop: '12px', width: '100%' }}
      >
        + Add Slide
      </Button>
    </div>
  );
};

export default SlidesThumbnailPanel;
