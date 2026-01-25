import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface PublicRoom {
  id: string;
  name: string;
  slug: string;
}

interface BroadcastSelectorProps {
  roomPin: string | null;
  viewerCount: number;
  onlineConnected: boolean;
  serverUrl?: string;
  onConnectClick?: () => void;
  embedded?: boolean;
}

const BroadcastSelector: React.FC<BroadcastSelectorProps> = ({
  roomPin,
  viewerCount,
  onlineConnected,
  onConnectClick,
  embedded = false
}) => {
  const { t } = useTranslation();
  const [showDropdown, setShowDropdown] = useState(false);
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [selectedPublicRoom, setSelectedPublicRoom] = useState<PublicRoom | null>(null);
  const [showCopied, setShowCopied] = useState(false);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
      }
    };
  }, []);

  // Load public rooms when connected
  useEffect(() => {
    if (onlineConnected) {
      loadPublicRooms();
    }
  }, [onlineConnected]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showDropdown) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-broadcast-selector]')) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [showDropdown]);

  const loadPublicRooms = async () => {
    try {
      if (window.electronAPI && typeof window.electronAPI.getPublicRooms === 'function') {
        const rooms = await window.electronAPI.getPublicRooms();
        if (Array.isArray(rooms)) {
          setPublicRooms(rooms);
        }
      }
    } catch (error) {
      console.error('Failed to load public rooms:', error);
    }
  };

  const handleSelectRoom = async (room: PublicRoom | null) => {
    try {
      if (window.electronAPI && typeof window.electronAPI.switchToPublicRoom === 'function') {
        await window.electronAPI.switchToPublicRoom(room?.id || null);
      }
      setSelectedPublicRoom(room);
    } catch (error) {
      console.error('Failed to switch room:', error);
    }
    setShowDropdown(false);
  };

  const copyLink = () => {
    try {
      const url = selectedPublicRoom
        ? `https://solucast.app/viewer/${selectedPublicRoom.slug}`
        : `https://solucast.app/viewer?pin=${roomPin}`;
      if (window.electronAPI?.copyToClipboard) {
        window.electronAPI.copyToClipboard(url);
      } else {
        navigator.clipboard.writeText(url);
      }
      setShowCopied(true);
      // Clear any existing timeout before setting a new one
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
      }
      copiedTimeoutRef.current = setTimeout(() => setShowCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
    setShowDropdown(false);
  };

  const displayName = selectedPublicRoom
    ? selectedPublicRoom.name
    : `${t('controlPanel.privateRoom')} (${roomPin || '...'})`;

  const isPublic = !!selectedPublicRoom;

  // Embedded mode - panel-style layout
  if (embedded) {
    if (!onlineConnected) {
      return (
        <div style={{
          padding: '10px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#6c757d'
              }} />
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
                {t('controlPanel.notConnected', 'Not connected')}
              </span>
            </div>
            <button
              onClick={onConnectClick}
              style={{
                background: 'linear-gradient(135deg, #0d6efd, #0a58ca)',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                color: 'white',
                fontSize: '0.8rem',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              {t('controlPanel.connect', 'Connect')}
            </button>
          </div>
        </div>
      );
    }

    // Connected - embedded panel view
    return (
      <div data-broadcast-selector>
        {/* Connection Status */}
        <div style={{
          padding: '10px',
          background: isPublic
            ? 'rgba(40, 167, 69, 0.2)'
            : 'rgba(13, 110, 253, 0.2)',
          borderRadius: '8px',
          border: `1px solid ${isPublic ? 'rgba(40, 167, 69, 0.5)' : 'rgba(13, 110, 253, 0.5)'}`,
          marginBottom: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#28a745',
                boxShadow: '0 0 8px #28a745'
              }} />
              <div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)' }}>
                  {t('controlPanel.broadcastingTo')}
                </div>
                <div style={{
                  fontWeight: 600,
                  color: isPublic ? '#28a745' : '#0d6efd',
                  fontSize: '0.9rem'
                }}>
                  {displayName}
                </div>
              </div>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: 'rgba(255,255,255,0.7)',
              fontSize: '0.8rem'
            }}>
              <span>{viewerCount} {t('controlPanel.viewers', 'viewers')}</span>
            </div>
          </div>
        </div>

        {/* Room Selection */}
        <div style={{ marginBottom: '10px' }}>
          {/* Private Room Option */}
          <div
            onClick={() => handleSelectRoom(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px',
              cursor: 'pointer',
              background: !selectedPublicRoom ? 'rgba(13, 110, 253, 0.2)' : 'rgba(255,255,255,0.05)',
              borderRadius: '8px',
              marginBottom: '6px',
              border: !selectedPublicRoom ? '1px solid rgba(13, 110, 253, 0.5)' : '1px solid transparent'
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, color: !selectedPublicRoom ? '#0d6efd' : 'rgba(255,255,255,0.8)', fontSize: '0.85rem' }}>
                {t('controlPanel.privateRoom')}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>
                PIN: {roomPin || '...'}
              </div>
            </div>
            {!selectedPublicRoom && (
              <span style={{
                background: '#0d6efd',
                color: 'white',
                padding: '2px 8px',
                borderRadius: '10px',
                fontSize: '0.65rem',
                fontWeight: 600
              }}>
                {t('controlPanel.active')}
              </span>
            )}
          </div>

          {/* Public Rooms */}
          {publicRooms.map((room) => (
            <div
              key={room.id}
              onClick={() => handleSelectRoom(room)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px',
                cursor: 'pointer',
                background: selectedPublicRoom?.id === room.id ? 'rgba(40, 167, 69, 0.2)' : 'rgba(255,255,255,0.05)',
                borderRadius: '8px',
                marginBottom: '6px',
                border: selectedPublicRoom?.id === room.id ? '1px solid rgba(40, 167, 69, 0.5)' : '1px solid transparent'
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, color: selectedPublicRoom?.id === room.id ? '#28a745' : 'rgba(255,255,255,0.8)', fontSize: '0.85rem' }}>
                  {room.name}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>
                  {t('controlPanel.publicRoom')}
                </div>
              </div>
              {selectedPublicRoom?.id === room.id && (
                <span style={{
                  background: '#28a745',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '0.65rem',
                  fontWeight: 600
                }}>
                  {t('controlPanel.active')}
                </span>
              )}
            </div>
          ))}

          {publicRooms.length === 0 && (
            <div style={{
              padding: '8px',
              color: 'rgba(255,255,255,0.4)',
              fontSize: '0.75rem',
              textAlign: 'center'
            }}>
              {t('controlPanel.noPublicRoomsYet')}
            </div>
          )}
        </div>

        {/* Copy Link Button */}
        <button
          onClick={copyLink}
          style={{
            width: '100%',
            padding: '8px',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.8rem',
            color: 'white'
          }}
        >
          {t('controlPanel.copyViewerLink')}
        </button>

        {/* Toast notification */}
        {showCopied && (
          <div style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(40, 167, 69, 0.95)',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '0.9rem',
            fontWeight: 500,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 10000
          }}>
            {t('controlPanel.linkCopied', 'Link copied!')}
          </div>
        )}
      </div>
    );
  }

  // Not connected - show connect button (standalone mode)
  if (!onlineConnected) {
    return (
      <div
        onClick={onConnectClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '10px',
          border: '2px solid rgba(255,255,255,0.2)',
          cursor: onConnectClick ? 'pointer' : 'default'
        }}
      >
        <div style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: '#6c757d'
        }} />
        <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem' }}>
          {onConnectClick ? t('controlPanel.connectOnline', 'Connect Online') : t('controlPanel.offline', 'Offline')}
        </span>
      </div>
    );
  }

  // Connected - show room info with dropdown (standalone mode)
  return (
    <div data-broadcast-selector style={{ position: 'relative' }}>
      {/* Main Button */}
      <div
        onClick={() => setShowDropdown(!showDropdown)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '8px 14px',
          background: isPublic
            ? 'linear-gradient(135deg, rgba(40, 167, 69, 0.3), rgba(40, 167, 69, 0.1))'
            : 'linear-gradient(135deg, rgba(13, 110, 253, 0.3), rgba(13, 110, 253, 0.1))',
          borderRadius: '12px',
          border: `2px solid ${isPublic ? '#28a745' : '#0d6efd'}`,
          cursor: 'pointer',
          minWidth: '180px'
        }}
      >
        {/* Status Indicator */}
        <div style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: '#28a745',
          boxShadow: '0 0 8px #28a745'
        }} />

        {/* Room Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)' }}>
            {t('controlPanel.broadcastingTo')}
          </div>
          <div style={{
            fontWeight: 600,
            color: isPublic ? '#28a745' : '#0d6efd',
            fontSize: '0.9rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {displayName}
          </div>
        </div>

        {/* Viewer Count */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          color: 'rgba(255,255,255,0.7)',
          fontSize: '0.75rem'
        }}>
          <span>{viewerCount}</span>
        </div>

        {/* Dropdown Arrow */}
        <span style={{ color: 'white', fontSize: '0.8rem' }}>
          {showDropdown ? '▲' : '▼'}
        </span>
      </div>

      {/* Dropdown Menu */}
      {showDropdown && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '4px',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          zIndex: 1000,
          overflow: 'hidden',
          minWidth: '220px'
        }}>
          {/* Private Room Option */}
          <div
            onClick={() => handleSelectRoom(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 14px',
              cursor: 'pointer',
              background: !selectedPublicRoom ? '#e7f1ff' : 'white',
              borderLeft: !selectedPublicRoom ? '3px solid #0d6efd' : '3px solid transparent'
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, color: !selectedPublicRoom ? '#0d6efd' : '#333' }}>
                {t('controlPanel.privateRoom')}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#666' }}>
                PIN: {roomPin || '...'}
              </div>
            </div>
            {!selectedPublicRoom && (
              <span style={{
                background: '#0d6efd',
                color: 'white',
                padding: '2px 8px',
                borderRadius: '10px',
                fontSize: '0.65rem',
                fontWeight: 600
              }}>
                {t('controlPanel.active')}
              </span>
            )}
          </div>

          {/* Public Rooms */}
          {publicRooms.map((room) => (
            <div
              key={room.id}
              onClick={() => handleSelectRoom(room)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 14px',
                cursor: 'pointer',
                background: selectedPublicRoom?.id === room.id ? '#f0fff4' : 'white',
                borderLeft: selectedPublicRoom?.id === room.id ? '3px solid #28a745' : '3px solid transparent'
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, color: selectedPublicRoom?.id === room.id ? '#28a745' : '#333' }}>
                  {room.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#666' }}>
                  {t('controlPanel.publicRoom')}
                </div>
              </div>
              {selectedPublicRoom?.id === room.id && (
                <span style={{
                  background: '#28a745',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '0.65rem',
                  fontWeight: 600
                }}>
                  Active
                </span>
              )}
            </div>
          ))}

          {/* No public rooms message */}
          {publicRooms.length === 0 && (
            <div style={{
              padding: '12px 14px',
              color: '#999',
              fontSize: '0.8rem',
              textAlign: 'center',
              borderTop: '1px solid #eee'
            }}>
              {t('controlPanel.noPublicRoomsYet')}
            </div>
          )}

          {/* Copy Link */}
          <div style={{
            borderTop: '1px solid #eee',
            padding: '8px 14px'
          }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                copyLink();
              }}
              style={{
                width: '100%',
                padding: '8px',
                background: '#f8f9fa',
                border: '1px solid #dee2e6',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                color: '#333'
              }}
            >
              {t('controlPanel.copyViewerLink')}
            </button>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {showCopied && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(40, 167, 69, 0.95)',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '8px',
          fontSize: '0.9rem',
          fontWeight: 500,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 10000
        }}>
          {t('controlPanel.linkCopied', 'Link copied!')}
        </div>
      )}
    </div>
  );
};

export default BroadcastSelector;
