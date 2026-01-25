import React, { memo, useCallback } from 'react';

interface AudioPlayerBarProps {
  name: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onStop: () => void;
}

const AudioPlayerBar: React.FC<AudioPlayerBarProps> = memo(({
  name,
  isPlaying,
  currentTime,
  duration,
  volume,
  onPlayPause,
  onSeek,
  onVolumeChange,
  onStop
}) => {
  const handleSeekChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onSeek(parseFloat(e.target.value));
  }, [onSeek]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onVolumeChange(parseFloat(e.target.value));
  }, [onVolumeChange]);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  return (
    <div
      data-audio-player
      style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: '48px',
      background: 'linear-gradient(to right, rgba(156, 39, 176, 0.95), rgba(103, 58, 183, 0.95))',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: '12px',
      boxShadow: '0 -2px 10px rgba(0,0,0,0.3)',
      zIndex: 1000,
      direction: 'ltr'
    }}>
      {/* Music icon */}
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>

      {/* Song name */}
      <span style={{
        color: 'white',
        fontSize: '13px',
        fontWeight: 500,
        flex: '0 0 auto',
        maxWidth: '200px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }}>
        {name}
      </span>

      {/* Play/Pause button */}
      <button
        onClick={onPlayPause}
        style={{
          padding: '6px',
          background: 'rgba(255,255,255,0.2)',
          border: 'none',
          borderRadius: '50%',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {isPlaying ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        )}
      </button>

      {/* Progress bar */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '11px', minWidth: '40px' }}>
          {formatTime(currentTime)}
        </span>
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSeekChange}
          style={{
            flex: 1,
            height: '4px',
            accentColor: 'white',
            cursor: 'pointer'
          }}
        />
        <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '11px', minWidth: '40px' }}>
          {duration ? formatTime(duration) : '--:--'}
        </span>
      </div>

      {/* Volume control */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '100px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2">
          <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={handleVolumeChange}
          style={{
            width: '70px',
            height: '4px',
            accentColor: 'white',
            cursor: 'pointer'
          }}
        />
      </div>

      {/* Stop button */}
      <button
        onClick={onStop}
        title="Stop music"
        style={{
          padding: '6px 12px',
          background: 'rgba(255,255,255,0.2)',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: 'white',
          fontSize: '12px',
          fontWeight: 500
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
        Stop
      </button>
    </div>
  );
});

AudioPlayerBar.displayName = 'AudioPlayerBar';

export default AudioPlayerBar;
