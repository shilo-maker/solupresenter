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

  return (
    <div className="theme-selector" ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        title={activeTheme ? activeTheme.name : t('themes.selectTheme', 'Select Theme')}
        style={{
          padding: '0.375rem 0.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3, #54a0ff)',
          border: 'none',
          borderRadius: '0.375rem',
          cursor: 'pointer',
          transition: 'transform 0.2s, box-shadow 0.2s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="white" viewBox="0 0 16 16">
          <path d="M8 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3m4 3a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M5.5 7a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m.5 6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3"/>
          <path d="M16 8c0 3.15-1.866 2.585-3.567 2.07C11.42 9.763 10.465 9.473 10 10c-.603.683-.475 1.819-.351 2.92C9.826 14.495 9.996 16 8 16a8 8 0 1 1 8-8m-8 7c.611 0 .654-.171.655-.176.078-.146.124-.464.07-1.119-.014-.168-.037-.37-.061-.591-.052-.464-.112-1.005-.118-1.462-.01-.707.083-1.61.704-2.314.369-.417.845-.578 1.272-.618.404-.038.812.026 1.16.104.343.077.702.186 1.025.284l.028.008c.346.105.658.199.953.266.653.148.904.083.991.024C14.717 9.38 15 9.161 15 8a7 7 0 1 0-7 7"/>
        </svg>
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
