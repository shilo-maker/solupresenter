import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface SetlistItem {
  id: string;
  type: string;
  title?: string;
  song?: any;
  [key: string]: unknown;
}

interface SavedSetlist {
  id: string;
  name: string;
  venue?: string;
  items: SetlistItem[];
  createdAt: string;
  updatedAt?: string;
}

interface LoadSetlistModalProps {
  savedSetlists: SavedSetlist[];
  onClose: () => void;
  onLoad: (setlist: SavedSetlist) => void;
  onDelete: (id: string) => void;
  isLoggedIn?: boolean;
}

type Tab = 'local' | 'online';

const LoadSetlistModal: React.FC<LoadSetlistModalProps> = ({
  savedSetlists,
  onClose,
  onLoad,
  onDelete,
  isLoggedIn = false
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('local');
  const [onlineSetlists, setOnlineSetlists] = useState<any[]>([]);
  const [loadingOnline, setLoadingOnline] = useState(false);
  const [loadingSetlist, setLoadingSetlist] = useState<string | null>(null);
  const [skippedNotice, setSkippedNotice] = useState<string | null>(null);
  const [pendingConvertedSetlist, setPendingConvertedSetlist] = useState<SavedSetlist | null>(null);
  const hasFetchedOnline = useRef(false);
  const activeRequestId = useRef<string | null>(null);

  const sortedSetlists = useMemo(() =>
    [...savedSetlists].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [savedSetlists]
  );

  const fetchOnlineSetlists = useCallback(async () => {
    setLoadingOnline(true);
    try {
      const setlists = await window.electronAPI.fetchOnlineSetlists();
      setOnlineSetlists(setlists);
    } catch (error) {
      console.error('Failed to fetch online setlists:', error);
      setOnlineSetlists([]);
    } finally {
      setLoadingOnline(false);
      hasFetchedOnline.current = true;
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'online' && !hasFetchedOnline.current && !loadingOnline) {
      fetchOnlineSetlists();
    }
  }, [activeTab, loadingOnline, fetchOnlineSetlists]);

  const convertOnlineSetlist = async (onlineSetlist: any) => {
    const items: SetlistItem[] = [];
    let skipped = 0;
    const rawItems = onlineSetlist.items || [];

    // Collect song lookup data for batch resolution (single IPC call instead of N)
    const songLookups: Array<{ index: number; remoteId?: string; title?: string; songData: any }> = [];
    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i];
      const itemType = item.type || item.itemType;
      if (itemType === 'song') {
        const songRef = item.song;
        const songData = (songRef && typeof songRef === 'object') ? songRef : null;
        const backendSongId = songData ? (songData._id || songData.id) : (typeof songRef === 'string' ? songRef : null);
        const songTitle = songData ? songData.title : '';
        songLookups.push({
          index: i,
          remoteId: backendSongId || undefined,
          title: songTitle || undefined,
          songData
        });
      }
    }

    // Batch resolve all songs in a single IPC call
    const resolvedSongs = songLookups.length > 0
      ? await window.electronAPI.batchResolveSongs(
          songLookups.map(s => ({ remoteId: s.remoteId, title: s.title }))
        )
      : {};

    // Build a map of original item index -> resolved local song
    const localSongByItemIndex: Record<number, any> = {};
    for (let i = 0; i < songLookups.length; i++) {
      if (resolvedSongs[i]) {
        localSongByItemIndex[songLookups[i].index] = resolvedSongs[i];
      }
    }

    // Convert items using the batch-resolved data
    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i];
      const itemType = item.type || item.itemType;

      if (itemType === 'song') {
        const lookup = songLookups.find(s => s.index === i);
        if (!lookup) {
          skipped++;
          continue;
        }
        const localSong = localSongByItemIndex[i];

        if (localSong) {
          const slides = typeof localSong.slides === 'string' ? JSON.parse(localSong.slides) : localSong.slides;
          const tags = typeof localSong.tags === 'string' ? JSON.parse(localSong.tags) : localSong.tags;
          const arrangements = typeof localSong.arrangements === 'string' ? JSON.parse(localSong.arrangements) : (localSong.arrangements || []);

          items.push({
            id: crypto.randomUUID(),
            type: 'song',
            song: {
              id: localSong.id,
              title: localSong.title,
              originalLanguage: localSong.originalLanguage,
              slides,
              tags,
              author: localSong.author,
              backgroundImage: localSong.backgroundImage,
              arrangements
            }
          });
        } else if (lookup.songData && lookup.songData.title) {
          const slides = Array.isArray(lookup.songData.slides) ? lookup.songData.slides : [];
          items.push({
            id: crypto.randomUUID(),
            type: 'song',
            song: {
              id: `online-${lookup.remoteId || Date.now()}`,
              title: lookup.songData.title,
              originalLanguage: lookup.songData.originalLanguage || 'he',
              slides,
              tags: Array.isArray(lookup.songData.tags) ? lookup.songData.tags : [],
              author: lookup.songData.author || null,
              backgroundImage: lookup.songData.backgroundImage || '',
              arrangements: Array.isArray(lookup.songData.arrangements) ? lookup.songData.arrangements : []
            }
          });
        } else {
          skipped++;
        }
      } else if (itemType === 'bible') {
        const bibleData = item.bibleData || item.data || {};
        const bibleSlides = bibleData.slides || [];
        const title = bibleData.title || item.title || item.label || 'Bible';

        items.push({
          id: crypto.randomUUID(),
          type: 'bible',
          title,
          song: {
            id: `bible-${crypto.randomUUID()}`,
            title,
            originalLanguage: 'he',
            slides: bibleSlides,
            tags: [],
            author: null,
            backgroundImage: '',
            arrangements: [],
            bibleData
          }
        });
      } else if (itemType === 'blank' || itemType === 'section') {
        items.push({
          id: crypto.randomUUID(),
          type: 'section',
          title: item.sectionTitle || item.title || item.name || item.label || ''
        });
      } else {
        skipped++;
      }
    }

    return { items, skipped };
  };

  const handleOnlineSetlistClick = async (onlineSetlist: any) => {
    const setlistId = onlineSetlist._id || onlineSetlist.id;

    // Prevent concurrent loads - cancel previous if clicking a different one
    if (loadingSetlist) return;

    setLoadingSetlist(setlistId);
    setSkippedNotice(null);
    activeRequestId.current = setlistId;

    try {
      // Fetch full setlist with populated data
      const fullSetlist = await window.electronAPI.fetchOnlineSetlist(setlistId);

      // Check if this request is still the active one (user may have clicked another)
      if (activeRequestId.current !== setlistId) return;

      if (!fullSetlist) {
        setLoadingSetlist(null);
        return;
      }

      const { items, skipped } = await convertOnlineSetlist(fullSetlist);

      // Check again after async conversion
      if (activeRequestId.current !== setlistId) return;

      // Use empty id so saving creates a new local setlist instead of trying to update a non-existent one
      const convertedSetlist: SavedSetlist = {
        id: '',
        name: fullSetlist.name || onlineSetlist.name,
        items,
        createdAt: fullSetlist.createdAt || new Date().toISOString()
      };

      if (skipped > 0) {
        // Show notice and wait for user to confirm before loading
        setSkippedNotice(`${skipped} ${skipped === 1 ? 'item' : 'items'} skipped (images/videos/presentations not supported)`);
        setPendingConvertedSetlist(convertedSetlist);
      } else {
        onLoad(convertedSetlist);
      }
    } catch (error) {
      console.error('Failed to load online setlist:', error);
    } finally {
      if (activeRequestId.current === setlistId) {
        setLoadingSetlist(null);
      }
    }
  };

  const renderSetlistRow = (saved: any, isOnline: boolean) => {
    const id = isOnline ? (saved._id || saved.id) : saved.id;
    const dateStr = saved.createdAt
      ? new Date(saved.createdAt).toLocaleDateString()
      : saved.updatedAt
        ? new Date(saved.updatedAt).toLocaleDateString()
        : '';
    const validDate = dateStr && dateStr !== 'Invalid Date' ? dateStr : '';
    const itemCount = saved.items?.length || saved.itemCount || 0;
    const isLoading = loadingSetlist === id;

    return (
      <div
        key={id}
        onClick={() => isOnline ? handleOnlineSetlistClick(saved) : onLoad(saved)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px',
          background: isLoading ? 'rgba(0,200,200,0.1)' : 'rgba(255,255,255,0.05)',
          borderRadius: '8px',
          marginBottom: '8px',
          cursor: isLoading ? 'wait' : 'pointer',
          opacity: isLoading ? 0.7 : 1
        }}
      >
        <div>
          <div style={{ color: 'white', fontWeight: 600 }}>{saved.name}</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>
            {validDate}
            {saved.venue && ` \u2022 ${saved.venue}`}
            {' \u2022 '}
            {itemCount} items
            {isLoading && ' \u2022 Loading...'}
          </div>
        </div>
        {!isOnline && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(saved.id);
            }}
            style={{
              background: 'linear-gradient(135deg, #ef4444, #f87171)',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.75rem'
            }}
          >
            {t('common.delete')}
          </button>
        )}
      </div>
    );
  };

  const showTabs = isLoggedIn;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2100
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onMouseDown={() => window.focus()}
        style={{
          background: 'rgba(24, 24, 27, 0.98)',
          borderRadius: '16px',
          padding: '24px',
          minWidth: '400px',
          maxWidth: '500px',
          maxHeight: '80vh',
          overflow: 'auto',
          border: '1px solid rgba(255,255,255,0.2)'
        }}
      >
        <h3 style={{ color: 'white', marginBottom: '16px' }}>
          {t('controlPanel.loadSetlist')}
        </h3>

        {showTabs && (
          <div style={{ display: 'flex', marginBottom: '16px', gap: '4px' }}>
            <button
              onClick={() => setActiveTab('local')}
              style={{
                flex: 1,
                padding: '8px 16px',
                background: activeTab === 'local' ? 'rgba(0,200,200,0.3)' : 'rgba(255,255,255,0.05)',
                border: activeTab === 'local' ? '1px solid rgba(0,200,200,0.5)' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: activeTab === 'local' ? 600 : 400
              }}
            >
              {t('controlPanel.localSetlists', 'Local')}
            </button>
            <button
              onClick={() => setActiveTab('online')}
              style={{
                flex: 1,
                padding: '8px 16px',
                background: activeTab === 'online' ? 'rgba(0,200,200,0.3)' : 'rgba(255,255,255,0.05)',
                border: activeTab === 'online' ? '1px solid rgba(0,200,200,0.5)' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: activeTab === 'online' ? 600 : 400
              }}
            >
              {t('controlPanel.onlineSetlists', 'Online')}
            </button>
          </div>
        )}

        {skippedNotice && (
          <div style={{
            padding: '10px 12px',
            background: 'rgba(234, 179, 8, 0.15)',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            borderRadius: '8px',
            marginBottom: '12px',
            color: 'rgba(234, 179, 8, 0.9)',
            fontSize: '0.8rem'
          }}>
            <div>{skippedNotice}</div>
            {pendingConvertedSetlist && (
              <button
                onClick={() => {
                  onLoad(pendingConvertedSetlist);
                  setPendingConvertedSetlist(null);
                }}
                style={{
                  marginTop: '8px',
                  padding: '6px 16px',
                  background: 'rgba(0,200,200,0.3)',
                  border: '1px solid rgba(0,200,200,0.5)',
                  borderRadius: '6px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.8rem'
                }}
              >
                {t('controlPanel.loadAnyway', 'Load anyway')}
              </button>
            )}
          </div>
        )}

        {activeTab === 'local' && (
          <>
            {sortedSetlists.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
                {t('controlPanel.noSavedSetlists')}
              </p>
            ) : (
              sortedSetlists.map((saved) => renderSetlistRow(saved, false))
            )}
          </>
        )}

        {activeTab === 'online' && (
          <>
            {loadingOnline ? (
              <div style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: '24px' }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  border: '2px solid rgba(255,255,255,0.2)',
                  borderTopColor: 'rgba(0,200,200,0.8)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  margin: '0 auto 12px'
                }} />
                {t('common.loading', 'Loading...')}
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : onlineSetlists.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
                {t('controlPanel.noOnlineSetlists', 'No online setlists found')}
              </p>
            ) : (
              onlineSetlists.map((setlist) => renderSetlistRow(setlist, true))
            )}
          </>
        )}

        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoadSetlistModal;
