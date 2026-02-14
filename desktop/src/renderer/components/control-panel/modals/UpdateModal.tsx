import React, { memo } from 'react';

interface UpdateStatus {
  status: string;
  version?: string;
  releaseNotes?: string;
  progress?: number;
  error?: string;
}

interface UpdateModalProps {
  onClose: () => void;
  updateStatus: UpdateStatus;
}

const UpdateModal = memo<UpdateModalProps>(({ onClose, updateStatus }) => {
  const isDownloaded = updateStatus.status === 'downloaded';
  const isDownloading = updateStatus.status === 'downloading';
  const isAvailable = updateStatus.status === 'available';

  const handleDownload = () => {
    window.electronAPI.autoUpdate.download();
  };

  const handleInstall = () => {
    window.electronAPI.autoUpdate.install();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.98), rgba(18, 18, 21, 0.98))',
          borderRadius: '16px',
          padding: '24px',
          minWidth: '400px',
          maxWidth: '500px',
          border: '1px solid rgba(255,255,255,0.2)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ color: 'white', margin: 0, fontSize: '1.2rem' }}>
            {isDownloaded ? 'Update Ready to Install' : 'Update Available'}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 8px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            ✕
          </button>
        </div>

        {/* Version info */}
        {updateStatus.version && (
          <div style={{
            padding: '12px 16px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>New version: </span>
            <span style={{ color: '#4caf50', fontSize: '1rem', fontWeight: 600 }}>v{updateStatus.version}</span>
          </div>
        )}

        {/* Release notes */}
        {updateStatus.releaseNotes && (
          <div style={{
            padding: '12px 16px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '8px',
            marginBottom: '16px',
            maxHeight: '200px',
            overflowY: 'auto'
          }}>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', marginBottom: '8px' }}>Release Notes</div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>
              {updateStatus.releaseNotes}
            </div>
          </div>
        )}

        {/* Download progress */}
        {isDownloading && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>Downloading...</span>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>{updateStatus.progress ?? 0}%</span>
            </div>
            <div style={{
              height: '6px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '3px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${updateStatus.progress ?? 0}%`,
                background: 'linear-gradient(90deg, #4caf50, #66bb6a)',
                borderRadius: '3px',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              color: 'rgba(255,255,255,0.8)',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            Later
          </button>

          {isAvailable && (
            <button
              onClick={handleDownload}
              style={{
                padding: '8px 16px',
                background: 'linear-gradient(135deg, #4caf50, #43a047)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 600
              }}
            >
              Download Update
            </button>
          )}

          {isDownloaded && (
            <button
              onClick={handleInstall}
              style={{
                padding: '8px 16px',
                background: 'linear-gradient(135deg, #4caf50, #43a047)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 600
              }}
            >
              Install & Restart
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

UpdateModal.displayName = 'UpdateModal';

export default UpdateModal;
