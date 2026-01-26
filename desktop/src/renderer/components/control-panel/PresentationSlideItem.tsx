import React, { memo } from 'react';

interface ImageBox {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  objectFit?: string;
  opacity?: number;
  borderRadius?: number;
  zIndex?: number;
}

interface TextBox {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  backgroundColor?: string;
  verticalAlign?: 'top' | 'center' | 'bottom';
  textAlign?: string;
  textDirection?: 'ltr' | 'rtl';
  bold?: boolean;
  italic?: boolean;
  opacity?: number;
  zIndex?: number;
}

interface PresentationSlide {
  id: string;
  backgroundType?: 'color' | 'gradient' | 'transparent';
  backgroundColor?: string;
  backgroundGradient?: string;
  imageBoxes?: ImageBox[];
  textBoxes: TextBox[];
}

interface PresentationSlideItemProps {
  slide: PresentationSlide;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}

const PresentationSlideItem = memo<PresentationSlideItemProps>(({
  slide,
  index,
  isSelected,
  onSelect
}) => {
  return (
    <div
      onClick={onSelect}
      style={{
        position: 'relative',
        border: isSelected ? '2px solid #00d4ff' : '2px solid rgba(255,255,255,0.1)',
        borderRadius: '6px',
        padding: '8px 10px',
        cursor: 'pointer',
        backgroundColor: isSelected ? 'rgba(0, 212, 255, 0.2)' : 'rgba(0,0,0,0.3)',
        boxShadow: isSelected ? '0 0 10px rgba(0, 212, 255, 0.5)' : 'none',
        minHeight: '80px',
        overflow: 'hidden'
      }}
    >
      {/* Slide header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        color: isSelected ? '#00d4ff' : 'rgba(255,255,255,0.6)',
        fontWeight: 'bold',
        marginBottom: '6px',
        fontSize: '0.7rem'
      }}>
        {isSelected && <span>▶</span>}
        Slide {index + 1}
      </div>
      {/* Mini preview of image and text boxes */}
      <div style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 9',
        background: slide.backgroundType === 'gradient' && slide.backgroundGradient
          ? slide.backgroundGradient
          : slide.backgroundType === 'transparent'
          ? 'repeating-conic-gradient(#2a2a2a 0% 25%, #1a1a1a 0% 50%) 50% / 16px 16px'
          : slide.backgroundColor || '#000',
        borderRadius: '4px',
        overflow: 'hidden'
      }}>
        {/* Image boxes */}
        {slide.imageBoxes?.map((imageBox) => (
          <img
            key={imageBox.id}
            src={imageBox.src}
            alt=""
            style={{
              position: 'absolute',
              left: `${imageBox.x}%`,
              top: `${imageBox.y}%`,
              width: `${imageBox.width}%`,
              height: `${imageBox.height}%`,
              objectFit: (imageBox.objectFit as any) || 'contain',
              opacity: imageBox.opacity ?? 1,
              borderRadius: `${imageBox.borderRadius || 0}px`,
              zIndex: imageBox.zIndex ?? 0
            }}
          />
        ))}
        {/* Text boxes */}
        {slide.textBoxes.map((textBox) => (
          <div
            key={textBox.id}
            style={{
              position: 'absolute',
              left: `${textBox.x}%`,
              top: `${textBox.y}%`,
              width: `${textBox.width}%`,
              height: `${textBox.height}%`,
              backgroundColor: textBox.backgroundColor || 'transparent',
              display: 'flex',
              alignItems: textBox.verticalAlign === 'top' ? 'flex-start' : textBox.verticalAlign === 'bottom' ? 'flex-end' : 'center',
              overflow: 'hidden',
              padding: '1px',
              zIndex: textBox.zIndex ?? 0
            }}
          >
            <span
              dir={textBox.textDirection || 'ltr'}
              style={{
                width: '100%',
                fontSize: '6px',
                color: textBox.color || '#fff',
                opacity: textBox.opacity ?? 1,
                fontWeight: textBox.bold ? '700' : '400',
                fontStyle: textBox.italic ? 'italic' : 'normal',
                textAlign: textBox.textAlign as any,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                direction: textBox.textDirection || 'ltr'
              }}
            >
              {textBox.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});

PresentationSlideItem.displayName = 'PresentationSlideItem';

export default PresentationSlideItem;
