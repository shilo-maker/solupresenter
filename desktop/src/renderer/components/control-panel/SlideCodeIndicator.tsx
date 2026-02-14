import React, { memo } from 'react';

interface SlideCodeIndicatorProps {
  currentInput: string;
  isTyping: boolean;
}

// Styles defined outside component to avoid recreation on each render
const containerStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: '20px',
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(0, 0, 0, 0.9)',
  border: '2px solid #00d4ff',
  borderRadius: '12px',
  padding: '12px 24px',
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  boxShadow: '0 4px 20px rgba(0, 212, 255, 0.3)'
};

const labelStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.6)',
  fontSize: '0.85rem'
};

const inputStyle: React.CSSProperties = {
  color: '#00d4ff',
  fontSize: '1.5rem',
  fontWeight: 'bold',
  fontFamily: 'monospace',
  letterSpacing: '2px',
  minWidth: '60px',
  textAlign: 'center'
};

const cursorStyle: React.CSSProperties = {
  display: 'inline-block',
  width: '2px',
  height: '1.2em',
  backgroundColor: '#00d4ff',
  marginLeft: '2px',
  animation: 'slideCodeBlink 1s infinite'
};

// @keyframes slideCodeBlink is defined in index.css

const SlideCodeIndicator = memo<SlideCodeIndicatorProps>(({ currentInput, isTyping }) => {
  if (!isTyping || !currentInput) {
    return null;
  }

  return (
    <div style={containerStyle}>
      <span style={labelStyle}>Go to:</span>
      <span style={inputStyle}>
        {currentInput}
        <span style={cursorStyle} />
      </span>
    </div>
  );
});

SlideCodeIndicator.displayName = 'SlideCodeIndicator';

export default SlideCodeIndicator;
