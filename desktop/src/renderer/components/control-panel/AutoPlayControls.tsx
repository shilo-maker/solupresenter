import React, { memo } from 'react';

interface AutoPlayControlsProps {
  isActive: boolean;
  interval: number;
  currentSlideIndex: number;
  totalSlides: number;
  onToggle: () => void;
  onIntervalChange: (interval: number) => void;
}

const AutoPlayControls = memo<AutoPlayControlsProps>(({
  isActive,
  interval,
  currentSlideIndex,
  totalSlides,
  onToggle,
  onIntervalChange
}) => {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px',
      marginBottom: '8px',
      backgroundColor: 'rgba(0,0,0,0.3)',
      borderRadius: '6px',
      border: isActive ? '1px solid #00d4ff' : '1px solid rgba(255,255,255,0.1)'
    }}>
      <button
        onClick={onToggle}
        style={{
          padding: '6px 12px',
          backgroundColor: isActive ? '#00d4ff' : 'rgba(255,255,255,0.1)',
          color: isActive ? '#000' : '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: 'bold',
          fontSize: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}
      >
        {isActive ? '⏸ Stop' : '▶ Auto'}
      </button>
      <select
        value={interval}
        onChange={(e) => onIntervalChange(Number(e.target.value))}
        style={{
          padding: '5px 8px',
          backgroundColor: '#2a2a2a',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '4px',
          fontSize: '0.75rem',
          cursor: 'pointer'
        }}
      >
        <option value={2} style={{ backgroundColor: '#2a2a2a', color: '#fff' }}>2s</option>
        <option value={3} style={{ backgroundColor: '#2a2a2a', color: '#fff' }}>3s</option>
        <option value={5} style={{ backgroundColor: '#2a2a2a', color: '#fff' }}>5s</option>
        <option value={7} style={{ backgroundColor: '#2a2a2a', color: '#fff' }}>7s</option>
        <option value={10} style={{ backgroundColor: '#2a2a2a', color: '#fff' }}>10s</option>
        <option value={15} style={{ backgroundColor: '#2a2a2a', color: '#fff' }}>15s</option>
        <option value={20} style={{ backgroundColor: '#2a2a2a', color: '#fff' }}>20s</option>
        <option value={30} style={{ backgroundColor: '#2a2a2a', color: '#fff' }}>30s</option>
      </select>
      {isActive && (
        <span style={{
          color: '#00d4ff',
          fontSize: '0.7rem',
          marginLeft: 'auto'
        }}>
          {currentSlideIndex + 1}/{totalSlides}
        </span>
      )}
    </div>
  );
});

AutoPlayControls.displayName = 'AutoPlayControls';

export default AutoPlayControls;
