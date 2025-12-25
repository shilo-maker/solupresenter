import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { themeAPI } from '../services/api';
import socketService from '../services/socket';

function ThemeSelector({ roomId }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [themes, setThemes] = useState([]);
  const [activeThemeId, setActiveThemeId] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef(null);

  // Fetch themes and default theme on mount
  useEffect(() => {
    const fetchThemesAndDefault = async () => {
      try {
        // Fetch all themes and default theme in parallel
        const [themesResponse, defaultResponse] = await Promise.all([
          themeAPI.getAll(),
          themeAPI.getDefault()
        ]);

        const fetchedThemes = themesResponse.data.themes || [];
        setThemes(fetchedThemes);

        // Apply default theme if set
        const defaultThemeId = defaultResponse.data.defaultThemeId;
        if (defaultThemeId && roomId) {
          setActiveThemeId(defaultThemeId);
          // Apply the default theme to the room
          socketService.operatorApplyTheme(roomId, defaultThemeId);
        }
      } catch (error) {
        console.error('Error fetching themes:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchThemesAndDefault();
  }, [roomId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleThemeSelect = (themeId) => {
    setActiveThemeId(themeId);
    socketService.operatorApplyTheme(roomId, themeId);
    setIsOpen(false);
  };

  const activeTheme = themes.find(t => t.id === activeThemeId);
  const displayName = activeTheme ? activeTheme.name : t('themes.noTheme', 'Classic');

  return (
    <div className="theme-selector" ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        className="btn btn-outline-light btn-sm d-flex align-items-center gap-2"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '0.35rem 0.75rem',
          fontSize: '0.85rem',
          minWidth: '120px',
          justifyContent: 'space-between'
        }}
      >
        <span className="d-flex align-items-center gap-2">
          <i className="bi bi-palette" style={{ fontSize: '0.9rem' }}></i>
          <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {loading ? '...' : displayName}
          </span>
        </span>
        <i className={`bi bi-chevron-${isOpen ? 'up' : 'down'}`} style={{ fontSize: '0.7rem' }}></i>
      </button>

      {isOpen && (
        <div
          className="dropdown-menu show"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            minWidth: '200px',
            maxHeight: '300px',
            overflowY: 'auto',
            zIndex: 1050,
            marginTop: '4px',
            backgroundColor: '#2d3748',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}
        >
          {/* Theme list */}
          {themes.map(theme => (
            <button
              key={theme.id}
              className="dropdown-item d-flex align-items-center justify-content-between"
              onClick={() => handleThemeSelect(theme.id)}
              style={{
                color: '#e2e8f0',
                padding: '0.5rem 1rem',
                backgroundColor: activeThemeId === theme.id ? 'rgba(99,102,241,0.2)' : 'transparent',
                borderLeft: activeThemeId === theme.id ? '3px solid #6366f1' : '3px solid transparent'
              }}
            >
              <span className="d-flex align-items-center gap-2">
                {theme.isBuiltIn && (
                  <i className="bi bi-star-fill" style={{ fontSize: '0.7rem', color: '#fbbf24' }}></i>
                )}
                <span>{theme.name}</span>
              </span>
              {activeThemeId === theme.id && (
                <i className="bi bi-check2" style={{ color: '#6366f1' }}></i>
              )}
            </button>
          ))}

          {/* Divider */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '0.5rem 0' }}></div>

          {/* Clear theme option */}
          <button
            className="dropdown-item d-flex align-items-center gap-2"
            onClick={() => handleThemeSelect(null)}
            style={{
              color: '#a0aec0',
              padding: '0.5rem 1rem',
              fontSize: '0.85rem'
            }}
          >
            <i className="bi bi-x-circle"></i>
            <span>{t('themes.clearTheme', 'Clear Theme')}</span>
          </button>

          {/* Manage themes option */}
          <button
            className="dropdown-item d-flex align-items-center gap-2"
            onClick={() => {
              setIsOpen(false);
              navigate('/themes');
            }}
            style={{
              color: '#a0aec0',
              padding: '0.5rem 1rem',
              fontSize: '0.85rem'
            }}
          >
            <i className="bi bi-gear"></i>
            <span>{t('themes.manage', 'Manage Themes...')}</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default ThemeSelector;
