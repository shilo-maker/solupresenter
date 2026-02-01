import React, { useState, memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import MediaGrid from '../../MediaGrid';
import { SetlistItem, YouTubeSearchResult } from './types';

export interface MediaPanelProps {
  // YouTube state
  youtubeUrlInput: string;
  youtubeLoading: boolean;
  youtubeSearchLoading: boolean;
  youtubeSearchResults: YouTubeSearchResult[];
  showYoutubeSearchResults: boolean;
  // Handlers
  onYoutubeUrlInputChange: (value: string) => void;
  onYoutubeInputSubmit: () => void;
  onCloseYoutubeSearchResults: () => void;
  onDisplayMedia: (type: 'image' | 'video', path: string) => void;
  onPlayAudio: (path: string, name: string) => void;
  onAddMediaToSetlist: (media: { type: 'image' | 'video' | 'audio'; path: string; name: string; duration?: number | null; thumbnailPath?: string | null }) => void;
  onAddPlaylistToSetlist: (playlist: { name: string; tracks: Array<{ path: string; name: string; duration?: number | null }>; shuffle: boolean }) => void;
  onAddYoutubeToSetlist: (videoId: string, title: string, thumbnail: string) => void;
  isYouTubeUrl: (url: string) => boolean;
}

const MediaPanel = memo<MediaPanelProps>(({
  youtubeUrlInput,
  youtubeLoading,
  youtubeSearchLoading,
  youtubeSearchResults,
  showYoutubeSearchResults,
  onYoutubeUrlInputChange,
  onYoutubeInputSubmit,
  onCloseYoutubeSearchResults,
  onDisplayMedia,
  onPlayAudio,
  onAddMediaToSetlist,
  onAddPlaylistToSetlist,
  onAddYoutubeToSetlist,
  isYouTubeUrl
}) => {
  const { t } = useTranslation();
  const [activeMediaSubTab, setActiveMediaSubTab] = useState<'library' | 'links'>('library');
  const [hoveredYoutubeId, setHoveredYoutubeId] = useState<string | null>(null);

  const handleYoutubeResultClick = useCallback((result: YouTubeSearchResult) => {
    onAddYoutubeToSetlist(result.videoId, result.title, result.thumbnail);
    onCloseYoutubeSearchResults();
  }, [onAddYoutubeToSetlist, onCloseYoutubeSearchResults]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Media Sub-tabs */}
      <div style={{
        display: 'flex',
        gap: '2px',
        padding: '8px 12px',
        background: 'rgba(0,0,0,0.2)',
        borderBottom: '1px solid rgba(255,255,255,0.05)'
      }}>
        <button
          onClick={() => setActiveMediaSubTab('library')}
          onMouseEnter={(e) => { if (activeMediaSubTab !== 'library') e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
          onMouseLeave={(e) => { if (activeMediaSubTab !== 'library') e.currentTarget.style.background = 'transparent'; }}
          style={{
            flex: 1,
            padding: '8px 12px',
            background: activeMediaSubTab === 'library' ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
            border: activeMediaSubTab === 'library' ? '1px solid rgba(6, 182, 212, 0.4)' : '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            color: activeMediaSubTab === 'library' ? '#06b6d4' : 'rgba(255,255,255,0.6)',
            fontSize: '0.8rem',
            fontWeight: activeMediaSubTab === 'library' ? 600 : 400,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.2s ease'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          {t('media.library')}
        </button>
        <button
          onClick={() => setActiveMediaSubTab('links')}
          onMouseEnter={(e) => { if (activeMediaSubTab !== 'links') e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
          onMouseLeave={(e) => { if (activeMediaSubTab !== 'links') e.currentTarget.style.background = 'transparent'; }}
          style={{
            flex: 1,
            padding: '8px 12px',
            background: activeMediaSubTab === 'links' ? 'rgba(255, 0, 0, 0.15)' : 'transparent',
            border: activeMediaSubTab === 'links' ? '1px solid rgba(255, 0, 0, 0.4)' : '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            color: activeMediaSubTab === 'links' ? '#ff4444' : 'rgba(255,255,255,0.6)',
            fontSize: '0.8rem',
            fontWeight: activeMediaSubTab === 'links' ? 600 : 400,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.2s ease'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/>
            <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/>
          </svg>
          {t('media.youtube')}
        </button>
      </div>

      {/* Library Content */}
      {activeMediaSubTab === 'library' && (
        <div style={{ padding: '12px', overflowY: 'auto', flex: 1 }}>
          <MediaGrid
            onSelectImage={(path) => onDisplayMedia('image', path)}
            onSelectVideo={(path) => onDisplayMedia('video', path)}
            onSelectAudio={(path, name) => onPlayAudio(path, name)}
            onAddToSetlist={onAddMediaToSetlist}
            onAddPlaylistToSetlist={onAddPlaylistToSetlist}
          />
        </div>
      )}

      {/* YouTube Links Content */}
      {activeMediaSubTab === 'links' && (
        <div style={{ padding: '12px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* URL/Search Input */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder={t('media.youtubeSearchPlaceholder') || "Search YouTube or paste URL..."}
              value={youtubeUrlInput}
              onChange={(e) => onYoutubeUrlInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onYoutubeInputSubmit();
              }}
              style={{
                flex: 1,
                padding: '10px 12px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255, 0, 0, 0.3)',
                borderRadius: '8px',
                color: 'white',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            />
            <button
              onClick={onYoutubeInputSubmit}
              disabled={youtubeLoading || youtubeSearchLoading || !youtubeUrlInput.trim()}
              style={{
                padding: '10px 16px',
                background: (youtubeLoading || youtubeSearchLoading) ? 'rgba(255,0,0,0.1)' : 'rgba(255, 0, 0, 0.2)',
                border: '1px solid rgba(255, 0, 0, 0.4)',
                borderRadius: '8px',
                color: '#ff4444',
                fontWeight: 600,
                cursor: (youtubeLoading || youtubeSearchLoading) ? 'wait' : 'pointer',
                fontSize: '0.85rem'
              }}
            >
              {youtubeLoading || youtubeSearchLoading ? '...' : (isYouTubeUrl(youtubeUrlInput.trim()) ? (t('common.add') || 'Add') : (t('common.search') || 'Search'))}
            </button>
          </div>

          {/* YouTube Search Results */}
          {showYoutubeSearchResults && (
            <div style={{
              background: 'rgba(255, 0, 0, 0.05)',
              border: '1px solid rgba(255, 0, 0, 0.2)',
              borderRadius: '8px',
              padding: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ color: '#ff4444', fontWeight: 600, fontSize: '0.85rem' }}>
                  {t('media.searchResults') || 'Search Results'}
                </span>
                <button
                  onClick={onCloseYoutubeSearchResults}
                  style={{
                    padding: '4px 8px',
                    background: 'transparent',
                    border: '1px solid rgba(255, 0, 0, 0.3)',
                    borderRadius: '4px',
                    color: '#ff4444',
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  {t('common.close') || 'Close'}
                </button>
              </div>

              {youtubeSearchLoading ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.6)' }}>
                  {t('common.loading') || 'Loading...'}
                </div>
              ) : youtubeSearchResults.length > 0 ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                  gap: '10px',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {youtubeSearchResults.map((result) => (
                    <div
                      key={result.videoId}
                      style={{
                        position: 'relative',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        border: hoveredYoutubeId === result.videoId ? '2px solid rgba(255, 0, 0, 0.8)' : '2px solid rgba(255, 0, 0, 0.3)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        transform: hoveredYoutubeId === result.videoId ? 'scale(1.02)' : 'scale(1)'
                      }}
                      onMouseEnter={() => setHoveredYoutubeId(result.videoId)}
                      onMouseLeave={() => setHoveredYoutubeId(null)}
                      onClick={() => handleYoutubeResultClick(result)}
                    >
                      <img
                        src={result.thumbnail}
                        alt={result.title}
                        style={{
                          width: '100%',
                          aspectRatio: '16/9',
                          objectFit: 'cover',
                          display: 'block'
                        }}
                      />
                      {/* Add to setlist overlay - only on hover */}
                      {hoveredYoutubeId === result.videoId && (
                        <div style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: '32px',
                          height: '32px',
                          background: 'rgba(255, 0, 0, 0.9)',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                        }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                        </div>
                      )}
                      {/* Title and channel overlay */}
                      <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        padding: '6px 8px',
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.95))',
                        color: 'white'
                      }}>
                        <div style={{
                          fontSize: '0.7rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginBottom: '2px'
                        }}>
                          {result.title}
                        </div>
                        <div style={{
                          fontSize: '0.6rem',
                          color: 'rgba(255,255,255,0.6)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {result.channelTitle}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>
                  {t('media.noSearchResults') || 'No results found'}
                </div>
              )}
            </div>
          )}

          {/* Empty state when no search */}
          {!showYoutubeSearchResults && (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: 'rgba(255,255,255,0.4)'
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ marginBottom: '12px', opacity: 0.5 }}>
                <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/>
                <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/>
              </svg>
              <div style={{ fontSize: '0.85rem', marginBottom: '4px' }}>{t('media.searchYoutube') || 'Search YouTube'}</div>
              <div style={{ fontSize: '0.75rem' }}>{t('media.searchYoutubeHint') || 'Type a search query above to find videos'}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

MediaPanel.displayName = 'MediaPanel';

export default MediaPanel;
