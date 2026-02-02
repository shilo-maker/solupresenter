import React from 'react';

const ToolsOverlay = React.memo(function ToolsOverlay({ toolsData, textColor, countdownMessageKey, rotatingMessageIndex }) {
  const toolsStyle = {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: textColor,
    textAlign: 'center'
  };

  // Countdown timer display
  if (toolsData.type === 'countdown') {
    const message = toolsData.message || '';
    const messageTranslation = toolsData.messageTranslation || '';
    const remaining = toolsData.remaining || '00:00';
    return (
      <div style={toolsStyle}>
        {message && (
          <div
            key={countdownMessageKey}
            style={{
              fontSize: 'clamp(2rem, 5vw, 4rem)',
              fontWeight: '300',
              fontFamily: "'Montserrat', sans-serif",
              marginBottom: '0.3em',
              lineHeight: '1',
              textShadow: '2px 2px 8px rgba(0, 0, 0, 0.8)',
              animation: 'messageUpdate 0.5s ease-out, breathing 3s ease-in-out 0.5s infinite',
              direction: 'rtl'
            }}>
            {message}
          </div>
        )}
        {messageTranslation && (
          <div style={{
            fontSize: 'clamp(1.5rem, 3.5vw, 3rem)',
            fontWeight: '300',
            fontFamily: "'Montserrat', sans-serif",
            marginBottom: '0.5em',
            lineHeight: '1',
            opacity: 0.8,
            textShadow: '2px 2px 8px rgba(0, 0, 0, 0.8)'
          }}>
            {messageTranslation}
          </div>
        )}
        <div style={{
          fontSize: 'clamp(4rem, 15vw, 12rem)',
          fontWeight: '300',
          fontFamily: "'Montserrat', sans-serif",
          letterSpacing: '-0.02em',
          lineHeight: '1',
          fontVariantNumeric: 'tabular-nums',
          textShadow: '3px 3px 10px rgba(0, 0, 0, 0.9)'
        }}>
          {remaining}
        </div>
      </div>
    );
  }

  // Clock display
  if (toolsData.type === 'clock') {
    return (
      <div style={toolsStyle}>
        <div style={{
          fontSize: 'clamp(4rem, 15vw, 12rem)',
          fontWeight: '200',
          fontFamily: 'monospace',
          letterSpacing: '0.05em',
          textShadow: '3px 3px 10px rgba(0, 0, 0, 0.9)'
        }}>
          {toolsData.time || '--:--:--'}
        </div>
        {toolsData.date && (
          <div style={{
            fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
            fontWeight: '300',
            marginTop: '20px',
            textShadow: '2px 2px 6px rgba(0, 0, 0, 0.8)'
          }}>
            {toolsData.date}
          </div>
        )}
      </div>
    );
  }

  // Stopwatch display
  if (toolsData.type === 'stopwatch') {
    return (
      <div style={toolsStyle}>
        <div style={{
          fontSize: 'clamp(4rem, 15vw, 12rem)',
          fontWeight: '200',
          fontFamily: 'monospace',
          letterSpacing: '0.05em',
          textShadow: '3px 3px 10px rgba(0, 0, 0, 0.9)'
        }}>
          {toolsData.time || '00:00.0'}
        </div>
        {toolsData.running !== undefined && (
          <div style={{
            fontSize: 'clamp(0.8rem, 2vw, 1.2rem)',
            fontWeight: '300',
            marginTop: '10px',
            opacity: 0.6,
            textShadow: '1px 1px 4px rgba(0, 0, 0, 0.8)'
          }}>
            {toolsData.running ? 'RUNNING' : 'PAUSED'}
          </div>
        )}
      </div>
    );
  }

  // Rotating message display (legacy single message format)
  if (toolsData.type === 'rotatingMessage') {
    const text = toolsData.text || '';
    return (
      <div style={{
        ...toolsStyle,
        animation: 'fadeIn 0.5s ease-in-out'
      }}>
        <div style={{
          fontSize: 'clamp(3rem, 10vw, 8rem)',
          fontWeight: '300',
          maxWidth: '90%',
          lineHeight: 1.3,
          textShadow: '3px 3px 10px rgba(0, 0, 0, 0.9)'
        }}>
          {text}
        </div>
      </div>
    );
  }

  // Rotating messages display (desktop app format: array of messages)
  if (toolsData.type === 'rotatingMessages' && toolsData.messages?.length > 0) {
    const currentMessage = toolsData.messages[rotatingMessageIndex % toolsData.messages.length];
    return (
      <div style={{
        ...toolsStyle,
        animation: 'fadeIn 0.5s ease-in-out'
      }}>
        <div style={{
          fontSize: 'clamp(3rem, 10vw, 8rem)',
          fontWeight: '300',
          maxWidth: '90%',
          lineHeight: 1.3,
          textShadow: '3px 3px 10px rgba(0, 0, 0, 0.9)',
          textAlign: 'center'
        }}>
          {currentMessage}
        </div>
      </div>
    );
  }

  // Fallback for unknown tool types
  // Fallback for unknown tool types - prevents falling through to "Waiting"
  console.warn('⚠️ Unknown toolsData type:', toolsData.type);
  return (
    <div style={toolsStyle}>
      <div style={{ fontSize: '2rem', opacity: 0.7 }}>
        Tool: {toolsData.type || 'unknown'}
      </div>
    </div>
  );
});

export default ToolsOverlay;
