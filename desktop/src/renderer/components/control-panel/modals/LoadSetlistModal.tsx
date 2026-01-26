import React from 'react';
import { useTranslation } from 'react-i18next';

interface SetlistItem {
  id: string;
  type: string;
  title: string;
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
}

const LoadSetlistModal: React.FC<LoadSetlistModalProps> = ({
  savedSetlists,
  onClose,
  onLoad,
  onDelete
}) => {
  const { t } = useTranslation();

  const sortedSetlists = [...savedSetlists].sort(
    (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')
  );

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
        style={{
          background: 'rgba(30,30,50,0.98)',
          borderRadius: '16px',
          padding: '24px',
          minWidth: '400px',
          maxHeight: '80vh',
          overflow: 'auto',
          border: '1px solid rgba(255,255,255,0.2)'
        }}
      >
        <h3 style={{ color: 'white', marginBottom: '16px' }}>
          {t('controlPanel.loadSetlist')}
        </h3>

        {sortedSetlists.length === 0 ? (
          <p style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
            {t('controlPanel.noSavedSetlists')}
          </p>
        ) : (
          sortedSetlists.map((saved) => {
            const dateStr = saved.createdAt
              ? new Date(saved.createdAt).toLocaleDateString()
              : saved.updatedAt
                ? new Date(saved.updatedAt).toLocaleDateString()
                : '';
            const validDate = dateStr && dateStr !== 'Invalid Date' ? dateStr : '';

            return (
              <div
                key={saved.id}
                onClick={() => onLoad(saved)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '8px',
                  marginBottom: '8px',
                  cursor: 'pointer'
                }}
              >
                <div>
                  <div style={{ color: 'white', fontWeight: 600 }}>{saved.name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>
                    {validDate}
                    {saved.venue && ` • ${saved.venue}`}
                    {' • '}
                    {saved.items?.length || 0} items
                  </div>
                </div>
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
              </div>
            );
          })
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
