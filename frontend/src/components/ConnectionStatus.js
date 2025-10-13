import React from 'react';

const ConnectionStatus = ({ status, latency }) => {
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

  const getStatusIcon = () => {
    switch (status) {
      case 'connected':
        return '●'; // Solid circle
      case 'connecting':
      case 'reconnecting':
        return '◐'; // Half circle (spinning would be nice but let's keep it simple)
      case 'disconnected':
        return '○'; // Empty circle
      default:
        return '?';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        color: 'white',
        padding: '6px 12px',
        borderRadius: '20px',
        fontSize: '0.85rem',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        zIndex: 1000,
        backdropFilter: 'blur(10px)',
        border: `1px solid ${getStatusColor()}`,
        transition: 'all 0.3s ease'
      }}
    >
      <span
        style={{
          color: getStatusColor(),
          fontSize: '1.2rem',
          lineHeight: 1,
          animation: status === 'connecting' || status === 'reconnecting' ? 'pulse 1.5s infinite' : 'none'
        }}
      >
        {getStatusIcon()}
      </span>
      <span style={{ fontWeight: 500 }}>
        {getStatusText()}
      </span>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
};

export default ConnectionStatus;
