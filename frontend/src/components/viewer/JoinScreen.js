import React from 'react';
import { Form, Button, Alert, Spinner } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../../i18n';

const JoinScreen = React.memo(function JoinScreen({
  pin,
  setPin,
  joinMode,
  setJoinMode,
  roomSearch,
  onRoomSearch,
  searchResults,
  searchLoading,
  error,
  setError,
  onJoinByName,
  onJoinByPin
}) {
  const { t, i18n } = useTranslation();

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(-45deg, #0a0a0a, #1a1a2e, #2d2d2d, #404040, #2a2a3e, #1a1a1a)',
      backgroundSize: '400% 400%',
      animation: 'gradientShift 15s ease infinite',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <style>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>

      {/* Language Toggle Button - Top Left */}
      <Button
        variant="outline-light"
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          borderRadius: '6px',
          padding: '8px 16px',
          fontSize: '0.9rem',
          fontWeight: '500'
        }}
        onClick={() => changeLanguage(i18n.language === 'he' ? 'en' : 'he')}
      >
        {i18n.language === 'he' ? 'English' : 'עברית'}
      </Button>

      {/* Login/Operator Button - Top Right */}
      <Button
        variant="light"
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          borderRadius: '6px',
          padding: '8px 20px',
          fontSize: '1rem',
          fontWeight: '500'
        }}
        onClick={() => window.location.href = localStorage.getItem('token') ? '/operator' : '/login'}
      >
        {localStorage.getItem('token') ? t('viewer.operator') : t('auth.login').toUpperCase()}
      </Button>

      {/* Centered Content */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px'
      }}>
        {/* SoluCast Logo */}
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <img
            src="/new_cast_logo.png"
            alt="SoluCast Logo"
            style={{
              maxWidth: 'clamp(125px, 20vw, 200px)',
              height: 'auto',
              width: '100%',
              marginBottom: '1rem'
            }}
          />
          <div style={{
            color: 'white',
            fontWeight: '600',
            fontSize: '1.8rem',
            letterSpacing: '1px',
            marginBottom: '0.3rem'
          }}>
            SoluCast
          </div>
          <div style={{
            color: 'rgba(255, 255, 255, 0.7)',
            fontWeight: '300',
            fontSize: '0.9rem',
            letterSpacing: '2px',
            textTransform: 'uppercase'
          }}>
            {t('viewer.tagline')}
          </div>
        </div>

        {error && (
          <Alert variant="danger" style={{ marginBottom: '15px', width: '100%', maxWidth: '320px' }}>
            {error}
          </Alert>
        )}

        {/* Mode Toggle */}
        <div
          onClick={() => setJoinMode(joinMode === 'name' ? 'pin' : 'name')}
          style={{
            display: 'flex',
            flexDirection: i18n.language === 'he' ? 'row' : 'row-reverse',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '20px',
            cursor: 'pointer',
            padding: '8px 16px',
            borderRadius: '20px',
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)'
          }}
        >
          <span style={{
            color: joinMode === 'pin' ? 'white' : 'rgba(255, 255, 255, 0.5)',
            fontWeight: joinMode === 'pin' ? '600' : '400',
            fontSize: '0.9rem',
            transition: 'all 0.2s ease'
          }}>
            {t('viewer.code')}
          </span>

          {/* Toggle Switch */}
          <div style={{
            width: '44px',
            height: '24px',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            position: 'relative',
            transition: 'all 0.3s ease'
          }}>
            <div style={{
              width: '20px',
              height: '20px',
              backgroundColor: 'white',
              borderRadius: '50%',
              position: 'absolute',
              top: '2px',
              left: joinMode === 'name' ? '2px' : '22px',
              transition: 'left 0.3s ease',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
            }} />
          </div>

          <span style={{
            color: joinMode === 'name' ? 'white' : 'rgba(255, 255, 255, 0.5)',
            fontWeight: joinMode === 'name' ? '600' : '400',
            fontSize: '0.9rem',
            transition: 'all 0.2s ease'
          }}>
            {t('viewer.name')}
          </span>
        </div>

        {/* PIN Input */}
        {joinMode === 'pin' && (
          <div style={{ width: '100%', maxWidth: '320px' }}>
            <div style={{ textAlign: 'center' }}>
              {/* PIN Input - Individual Boxes */}
              <div
                onClick={() => {
                  const input = document.querySelector('input[name="pin-input"]');
                  if (input) input.focus();
                }}
                style={{
                  display: 'flex',
                  gap: '12px',
                  justifyContent: 'center',
                  cursor: 'text',
                  direction: 'ltr'
                }}
              >
                {[0, 1, 2, 3].map((index) => {
                  const isActive = index === pin.length && pin.length < 4;
                  const isFilled = !!pin[index];
                  return (
                    <div
                      key={index}
                      style={{
                        width: '60px',
                        height: '70px',
                        background: isActive ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                        backdropFilter: 'blur(10px)',
                        border: isActive ? '2px solid rgba(255, 255, 255, 0.6)' : '2px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2rem',
                        fontWeight: '600',
                        color: 'white',
                        letterSpacing: '0',
                        transition: 'all 0.3s ease',
                        boxShadow: isActive ? '0 0 25px rgba(255, 255, 255, 0.3)' : (isFilled ? '0 0 20px rgba(255, 255, 255, 0.2)' : 'none'),
                        transform: isFilled ? 'scale(1.05)' : 'scale(1)',
                        cursor: 'text'
                      }}
                    >
                      {pin[index] || ''}
                    </div>
                  );
                })}
              </div>

              {/* Hidden actual input - auto-joins when 4 chars entered */}
              <input
                type="text"
                name="pin-input"
                value={pin}
                onChange={(e) => {
                  const newValue = e.target.value.toUpperCase();
                  setPin(newValue);
                  if (newValue.length === 4) {
                    onJoinByPin(newValue);
                  }
                }}
                maxLength={4}
                style={{
                  position: 'absolute',
                  opacity: 0,
                  pointerEvents: 'none',
                  width: '0',
                  height: '0',
                  overflow: 'hidden'
                }}
                autoFocus
              />
            </div>
          </div>
        )}

        {/* Room Name Search Form */}
        {joinMode === 'name' && (
          <Form onSubmit={onJoinByName} style={{ width: '100%', maxWidth: '320px' }}>
            <div style={{
              marginBottom: '20px',
              textAlign: 'center'
            }}>
              {/* Search Input */}
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder={t('viewer.typeRoomName')}
                  value={roomSearch}
                  onChange={(e) => onRoomSearch(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.08)',
                    backdropFilter: 'blur(10px)',
                    border: '2px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                    padding: '18px 20px',
                    color: 'white',
                    fontSize: '1.2rem',
                    fontWeight: '500',
                    textAlign: 'center',
                    letterSpacing: '1px',
                    outline: 'none',
                    transition: 'all 0.3s ease',
                    boxShadow: roomSearch ? '0 0 20px rgba(255, 255, 255, 0.2)' : 'none'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                    e.target.style.boxShadow = '0 0 20px rgba(255, 255, 255, 0.2)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                    if (!roomSearch) e.target.style.boxShadow = 'none';
                  }}
                  autoFocus
                />
                {searchLoading && (
                  <div style={{
                    position: 'absolute',
                    right: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)'
                  }}>
                    <Spinner animation="border" size="sm" variant="light" />
                  </div>
                )}
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div style={{
                  marginTop: '12px',
                  background: 'rgba(0, 0, 0, 0.5)',
                  borderRadius: '12px',
                  overflow: 'hidden'
                }}>
                  {searchResults.map((room) => (
                    <div
                      key={room.id}
                      onClick={() => {
                        if (room.isLive) {
                          onJoinByPin(null, room.slug);
                        } else {
                          setError(`"${room.name}" ${t('viewer.roomNotLive')}`);
                        }
                      }}
                      style={{
                        padding: '12px 16px',
                        cursor: room.isLive ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: 'transparent',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                        transition: 'background-color 0.2s',
                        opacity: room.isLive ? 1 : 0.6
                      }}
                      onMouseEnter={(e) => {
                        if (room.isLive) {
                          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <span style={{ color: 'white', fontWeight: '500' }}>{room.name}</span>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        backgroundColor: room.isLive ? '#28a745' : '#6c757d',
                        color: 'white'
                      }}>
                        {room.isLive ? t('viewer.liveJoin') : t('viewer.offline')}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {roomSearch.length >= 2 && !searchLoading && searchResults.length === 0 && (
                <div style={{
                  marginTop: '12px',
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontSize: '0.9rem'
                }}>
                  {t('viewer.noRoomsFound')}
                </div>
              )}
            </div>
          </Form>
        )}
      </div>
    </div>
  );
});

export default JoinScreen;
