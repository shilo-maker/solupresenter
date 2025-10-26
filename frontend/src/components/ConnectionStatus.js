import React, { useState } from 'react';

const ConnectionStatus = ({ status, latency }) => {
  const [isHovered, setIsHovered] = useState(false);

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return latency < 100 ? '#28a745' : latency < 300 ? '#ffc107' : '#fd7e14';
      case 'connecting':
      case 'reconnecting':
        return '#ffc107';
      case 'disconnected':
        return '#dc3545';
      default:
        return '#6c757d';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return latency ? `${latency}ms` : 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'reconnecting':
        return 'Reconnecting...';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Unknown';
    }
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'fixed',
        top: '10px',
        left: '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        zIndex: 1000,
        transition: 'all 0.3s ease',
        cursor: 'default'
      }}
    >
      {/* Dot indicator */}
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: getStatusColor(),
          boxShadow: `0 0 ${isHovered ? '8px' : '4px'} ${getStatusColor()}`,
          transition: 'all 0.3s ease',
          animation: status === 'connecting' || status === 'reconnecting' ? 'pulse 1.5s infinite' : 'none'
        }}
      />

      {/* Text (only shows on hover or when not connected) */}
      {(isHovered || status !== 'connected') && (
        <span
          style={{
            color: 'white',
            fontSize: '0.75rem',
            fontWeight: '500',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            padding: '4px 8px',
            borderRadius: '8px',
            backdropFilter: 'blur(10px)',
            whiteSpace: 'nowrap'
          }}
        >
          {getStatusText()}
        </span>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
};

export default ConnectionStatus;
