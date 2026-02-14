import React, { useState, useEffect, useMemo, memo } from 'react';
import { gradientPresets } from '../../../utils/gradients';

interface MediaItem {
  id?: string;
  name: string;
  type: 'image' | 'video' | 'audio';
  processedPath: string;
  thumbnailPath?: string;
}

interface ItemBackgroundModalProps {
  isOpen: boolean;
  currentBackground: string;
  onSelect: (background: string) => void;
  onClose: () => void;
}

const buildMediaUrl = (processedPath: string) => {
  const encodedPath = processedPath
    .replace(/\\/g, '/')
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
  return `media://file/${encodedPath}`;
};

const ItemBackgroundModal = memo<ItemBackgroundModalProps>(({
  isOpen,
  currentBackground,
  onSelect,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'gradients' | 'images' | 'videos'>('gradients');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);

  // Fetch media library once when modal opens (not per-tab)
  useEffect(() => {
    if (!isOpen) {
      setMediaItems([]);
      return;
    }
    setLoadingMedia(true);
    window.electronAPI.getMediaLibrary()
      .then((items: MediaItem[]) => {
        setMediaItems(items);
      })
      .catch((err: Error) => {
        console.error('Failed to load media library:', err);
      })
      .finally(() => setLoadingMedia(false));
  }, [isOpen]);

  // Memoize filtered + URL-built media lists to avoid recalculating on every render
  const imageItems = useMemo(() =>
    mediaItems
      .filter(item => item.type === 'image')
      .map(item => {
        const url = buildMediaUrl(item.processedPath);
        const thumbUrl = item.thumbnailPath
          ? buildMediaUrl(item.thumbnailPath)
          : url;
        return { ...item, url, value: url, thumbUrl };
      }),
    [mediaItems]
  );

  const videoItems = useMemo(() =>
    mediaItems
      .filter(item => item.type === 'video')
      .map(item => {
        const url = buildMediaUrl(item.processedPath);
        const thumbUrl = item.thumbnailPath
          ? buildMediaUrl(item.thumbnailPath)
          : undefined;
        return { ...item, url, value: `video:${url}`, thumbUrl };
      }),
    [mediaItems]
  );

  if (!isOpen) return null;

  const filteredItems = activeTab === 'images' ? imageItems : videoItems;
  const isSelected = (value: string) => currentBackground === value;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'rgba(24, 24, 27, 0.98)',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.15)',
          width: '420px',
          maxHeight: '520px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          <h3 style={{ margin: 0, color: 'white', fontSize: '0.95rem', fontWeight: 600 }}>
            Item Background
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              fontSize: '1.2rem',
              padding: '2px 6px'
            }}
          >
            ×
          </button>
        </div>

        {/* Quick actions */}
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.05)'
        }}>
          <button
            onClick={() => onSelect('')}
            style={{
              flex: 1,
              padding: '8px',
              background: isSelected('') || !currentBackground ? 'rgba(6,182,212,0.2)' : 'rgba(255,255,255,0.08)',
              border: isSelected('') || !currentBackground ? '1px solid #06b6d4' : '1px solid rgba(255,255,255,0.15)',
              borderRadius: '6px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 500
            }}
          >
            None (Global)
          </button>
          <button
            onClick={() => onSelect('transparent')}
            style={{
              flex: 1,
              padding: '8px',
              background: isSelected('transparent') ? 'rgba(6,182,212,0.2)' : 'rgba(255,255,255,0.08)',
              border: isSelected('transparent') ? '1px solid #06b6d4' : '1px solid rgba(255,255,255,0.15)',
              borderRadius: '6px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 500
            }}
          >
            Transparent (Black)
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '4px',
          padding: '8px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.05)'
        }}>
          {(['gradients', 'images', 'videos'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '6px 14px',
                background: activeTab === tab ? 'rgba(6,182,212,0.2)' : 'transparent',
                border: activeTab === tab ? '1px solid rgba(6,182,212,0.5)' : '1px solid transparent',
                borderRadius: '6px',
                color: activeTab === tab ? '#06b6d4' : 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 500,
                textTransform: 'capitalize'
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '12px 16px'
        }}>
          {activeTab === 'gradients' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '6px'
            }}>
              {gradientPresets.map(gradient => {
                const selected = isSelected(gradient.value);
                return (
                  <div
                    key={gradient.id}
                    onClick={() => onSelect(gradient.value)}
                    title={gradient.name}
                    style={{
                      aspectRatio: '16/9',
                      background: gradient.value,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      border: selected ? '2px solid #06b6d4' : '2px solid transparent',
                      boxShadow: selected ? '0 0 8px rgba(6, 182, 212, 0.4)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  />
                );
              })}
            </div>
          )}

          {(activeTab === 'images' || activeTab === 'videos') && (
            loadingMedia ? (
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: '20px' }}>
                Loading...
              </div>
            ) : filteredItems.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: '20px' }}>
                No {activeTab} found in media library
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '6px'
              }}>
                {filteredItems.map((item) => {
                  const selected = isSelected(item.value);
                  return (
                    <div
                      key={item.id || item.processedPath}
                      onClick={() => onSelect(item.value)}
                      title={item.name}
                      style={{
                        aspectRatio: '16/9',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        border: selected ? '2px solid #06b6d4' : '2px solid transparent',
                        boxShadow: selected ? '0 0 8px rgba(6, 182, 212, 0.4)' : 'none',
                        overflow: 'hidden',
                        background: '#111',
                        position: 'relative',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {item.thumbUrl ? (
                        <img
                          src={item.thumbUrl}
                          alt={item.name}
                          loading="lazy"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2">
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                        </div>
                      )}
                      <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        padding: '2px 4px',
                        background: 'rgba(0,0,0,0.7)',
                        color: 'rgba(255,255,255,0.8)',
                        fontSize: '0.6rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {item.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
});

ItemBackgroundModal.displayName = 'ItemBackgroundModal';

export default ItemBackgroundModal;
