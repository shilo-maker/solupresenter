# Local Media Streaming Feature - Session Notes

**Date:** December 24, 2024
**Status:** Working - Core functionality complete

---

## Overview

Implemented a local media streaming feature for SoluPresenter that displays videos and images on a local HDMI display (via the Presentation API) without streaming to online viewers.

---

## What Was Accomplished

### 1. Removed WebRTC (Previously Attempted)
- Cleaned up all WebRTC code from backend and frontend
- WebRTC was too complicated for the use case

### 2. Implemented Presentation API Video Streaming
- Videos are sent via the **Presentation API** connection in 512KB chunks
- Viewer receives chunks, reassembles into a blob, and plays the video
- No size limits (tested with 27MB video)

**Key files modified:**
- `frontend/src/pages/PresenterMode.js` - `sendVideoToDisplay()` function
- `frontend/src/pages/ViewerPage.js` - Presentation API receiver with chunk handling

### 3. Implemented Presentation API Image Streaming
- Images sent via Presentation API as Base64
- Removed the old 2MB socket.io limit
- Uses same mechanism as videos

**Key functions:**
- `sendImageToDisplay()` - Sends image via Presentation API
- `hideImageFromDisplay()` - Hides image from display

### 4. Added Operator Controls
- **Videos:**
  - "Show on Display" button - Sends video to HDMI
  - "Pause/Play" button (yellow/green) - Controls playback remotely
  - "Hide" button (red) - Stops and hides video

- **Images:**
  - "Show on Display" button - Sends image to HDMI
  - "Hide" button (red) - Hides image

### 5. Added Translations
New translation keys added to `en.json` and `he.json`:
- `pauseVideo` / `playVideo` / `hideVideo` / `hideImage`

---

## How It Works

### Architecture
```
[Presenter Browser]
    |
    | Presentation API connection (direct messaging)
    |
    v
[HDMI Viewer Browser - on external display]
```

### Video Flow
1. Operator loads video file in Media tab
2. Clicks "Show on Display"
3. Video is read as ArrayBuffer
4. Split into 512KB chunks, converted to Base64
5. Sent via `presentationConnection.send()`:
   - `videoStart` message (metadata)
   - Multiple `videoChunk` messages
   - `videoEnd` message
6. Viewer receives chunks via `navigator.presentation.receiver`
7. Chunks reassembled into Blob, creates blob URL
8. Video plays with controls

### Image Flow
1. Operator loads image file in Media tab
2. Clicks "Show on Display"
3. Image read as Base64 data URL
4. Sent via `presentationConnection.send()` as `showImage` message
5. Viewer displays image

---

## Current State

### Working:
- Video playback on HDMI display
- Image display on HDMI display
- Pause/Play video controls
- Hide video/image controls
- Audio playback (video is not muted)
- Video controls visible on HDMI display

### State Variables (PresenterMode.js):
- `videoOnDisplay` - Is video currently showing on HDMI
- `videoPlaying` - Is the displayed video playing or paused
- `imageOnDisplay` - Is image currently showing on HDMI

---

## Files Modified

### Frontend
| File | Changes |
|------|---------|
| `src/pages/PresenterMode.js` | Added Presentation API video/image sending, control functions, UI buttons |
| `src/pages/ViewerPage.js` | Added Presentation API receiver, chunk reassembly, image handling |
| `src/locales/en.json` | Added translation keys |
| `src/locales/he.json` | Added translation keys |

### Backend
| File | Changes |
|------|---------|
| `server.js` | Added socket handlers for localVideo (may not be needed now) |

---

## Potential Future Improvements

### 1. Progress Indicator
- Show upload progress when sending large videos
- Could add a progress bar in the operator UI

### 2. Video Seeking
- Add ability to seek to specific position in video
- Send `videoSeek` message with timestamp

### 3. Multiple Display Support
- Support multiple HDMI displays
- Track each presentation connection separately

### 4. Preload Videos
- Cache frequently used videos in IndexedDB
- Faster loading for repeat playback

### 5. Error Handling
- Better error messages if Presentation API not supported
- Fallback for browsers without Presentation API

### 6. Cleanup Unused Code
- Remove old `broadcastLocalImage` socket.io code if no longer needed
- Remove IndexedDB video storage code (was attempted but not used)
- Remove `storeVideoInIndexedDB` and `loadVideoFromIndexedDB` functions

---

## How to Test

1. Start backend: `cd backend && npm start`
2. Start frontend: `cd frontend && npm start`
3. Open presenter at `http://localhost:3000/operator`
4. Click "Present to Display" to open HDMI viewer
5. Go to Media tab
6. Load a video or image file
7. Click "Show on Display"
8. Use Pause/Play/Hide controls

---

## Known Issues

- None currently identified
- Video autoplay may be blocked on some browsers if audio is present (controls allow manual play)

---

## Console Logs for Debugging

**Presenter:**
- `📺 sendVideoToDisplay called:` - Video send initiated
- `📺 Sending video in N chunks...` - Chunking started
- `📺 Sent chunk X/N` - Progress
- `📺 Video sent via Presentation API` - Complete
- `🖼️ sendImageToDisplay called:` - Image send initiated
- `🖼️ Image sent via Presentation API` - Complete

**Viewer:**
- `📺 Setting up Presentation API receiver...` - Receiver ready
- `🎬 Starting video receive: filename (N chunks)` - Receiving
- `🎬 Received chunk X/N` - Progress
- `🎬 Video transfer complete, assembling...` - Reassembling
- `🖼️ Showing image: filename` - Image received
