const fs = require('fs');
const path = require('path');

const presenterFile = path.join(__dirname, 'src/pages/PresenterMode.js');
let content = fs.readFileSync(presenterFile, 'utf8');

// First, remove the incorrectly inserted section
const badPattern = /Are you sure you want to create a new empty setlist\?\s*\\n\\n\s*\{\\/\* YouTube Preview Section \*\/\}[\s\S]*?\{\\/\* Present\/Stop Buttons \*\/\}[\s\S]*?<\/div>\s*\)\}/;

// Find and remove the bad insertion
const startMarker = "Are you sure you want to create a new empty setlist?\\n\\n\n        {/* YouTube Preview Section */}";
const endMarker = `                </Button>
              )}
            </div>
          </div>
        )}

This will clear the current setlist.`;

// Simpler approach - find the section and remove it
const youtubeStartIdx = content.indexOf("{/* YouTube Preview Section */}");
if (youtubeStartIdx > 0) {
  // Check if it's in the wrong place (inside confirm dialog)
  const prevContent = content.substring(Math.max(0, youtubeStartIdx - 100), youtubeStartIdx);
  if (prevContent.includes("Are you sure you want to create")) {
    console.log('Found incorrectly placed YouTube section, removing...');

    // Find the end of the bad section
    const youtubeEndIdx = content.indexOf("This will clear the current setlist.", youtubeStartIdx);
    if (youtubeEndIdx > youtubeStartIdx) {
      // Remove from before the {/* YouTube line to before "This will clear"
      const beforeBadSection = content.substring(0, youtubeStartIdx - 10); // -10 to remove the newlines before it
      const afterBadSection = content.substring(youtubeEndIdx);

      // Reconstruct the confirm message properly
      content = beforeBadSection.trimEnd() + "\\n\\n" + afterBadSection;
      console.log('Removed incorrectly placed section');
    }
  }
}

// Now add the YouTube preview section in the correct place
const youtubePreviewSection = `
        {/* YouTube Preview Section */}
        {slideSectionOpen && currentItem && currentItem.type === 'youtube' && (
          <div style={{ padding: '16px' }}>
            {/* YouTube Thumbnail/Preview */}
            <div style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '16/9',
              borderRadius: '12px',
              overflow: 'hidden',
              marginBottom: '16px',
              backgroundColor: '#000'
            }}>
              <img
                src={currentItem.youtubeData?.thumbnail}
                alt={currentItem.youtubeData?.title}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  opacity: youtubeOnDisplay ? 0.7 : 1
                }}
              />
              {youtubeOnDisplay && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  color: '#FF0000',
                  fontWeight: 'bold',
                  fontSize: '0.9rem'
                }}>
                  {youtubePlaying ? 'PLAYING' : 'ON DISPLAY'}
                </div>
              )}
              {/* Play overlay when not on display */}
              {!youtubeOnDisplay && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '60px',
                  height: '60px',
                  backgroundColor: 'rgba(255,0,0,0.9)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
                onClick={handleYoutubePresent}
                >
                  <svg width="24" height="24" fill="white" viewBox="0 0 16 16">
                    <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
                  </svg>
                </div>
              )}
            </div>

            {/* Video Title */}
            <div style={{
              color: 'white',
              fontSize: '1rem',
              fontWeight: '500',
              marginBottom: '12px',
              textAlign: 'center'
            }}>
              {currentItem.youtubeData?.title}
            </div>

            {/* Playback Controls - only show when on display */}
            {youtubeOnDisplay && (
              <div style={{ marginBottom: '16px' }}>
                {/* Progress Bar */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '12px'
                }}>
                  <span style={{ color: 'white', fontSize: '0.8rem', minWidth: '45px' }}>
                    {Math.floor(youtubeCurrentTime / 60)}:{String(Math.floor(youtubeCurrentTime % 60)).padStart(2, '0')}
                  </span>
                  <input
                    type="range"
                    min="0"
                    max={youtubeDuration || 100}
                    value={youtubeCurrentTime}
                    onChange={(e) => handleYoutubeSeek(parseFloat(e.target.value))}
                    style={{
                      flex: 1,
                      height: '6px',
                      cursor: 'pointer',
                      accentColor: '#FF0000'
                    }}
                  />
                  <span style={{ color: 'white', fontSize: '0.8rem', minWidth: '45px', textAlign: 'right' }}>
                    {youtubeDuration ? \`\${Math.floor(youtubeDuration / 60)}:\${String(Math.floor(youtubeDuration % 60)).padStart(2, '0')}\` : '--:--'}
                  </span>
                </div>

                {/* Play/Pause Button */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                  <Button
                    variant={youtubePlaying ? 'warning' : 'success'}
                    onClick={youtubePlaying ? handleYoutubePause : handleYoutubePlay}
                    style={{
                      borderRadius: '50%',
                      width: '50px',
                      height: '50px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0
                    }}
                  >
                    {youtubePlaying ? (
                      <svg width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"/>
                      </svg>
                    ) : (
                      <svg width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                        <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
                      </svg>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Present/Stop Buttons */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              {!youtubeOnDisplay ? (
                <Button
                  variant="danger"
                  onClick={handleYoutubePresent}
                  style={{
                    padding: '10px 24px',
                    borderRadius: '8px',
                    fontWeight: '500'
                  }}
                >
                  {t('presenter.present', 'Present')}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={handleYoutubeStop}
                  style={{
                    padding: '10px 24px',
                    borderRadius: '8px',
                    fontWeight: '500'
                  }}
                >
                  {t('presenter.stop', 'Stop')}
                </Button>
              )}
            </div>
          </div>
        )}

`;

// Find the correct insertion point - before the "no item selected" message in the slide preview section
const noItemMarker = "        {slideSectionOpen && !currentItem && !(selectedPresentation && activeResourcePanel === 'presentations') && (";
const noItemIdx = content.indexOf(noItemMarker);

if (noItemIdx > 0 && !content.includes("currentItem.type === 'youtube'")) {
  content = content.substring(0, noItemIdx) + youtubePreviewSection + content.substring(noItemIdx);
  console.log('Added YouTube preview section in correct location');
}

fs.writeFileSync(presenterFile, content, 'utf8');
console.log('Fix complete');
