# Video Seeking Debug Progress

## Problem
Video in desktop app media tab doesn't show full duration (shows ~21 seconds instead of 5 minutes) and can't seek.

## Root Cause
MP4 files have a "moov" atom containing duration metadata. This atom can be at the beginning (fast-start/web-optimized) or end of the file. Browser needs to read this to know the duration.

## What We've Tried

1. **Data URLs** - Failed, too large and no seeking support
2. **media:// protocol with fs.createReadStream** - Streams don't work properly as web Response
3. **media:// with full file buffer** - Works for seeking but slow initial load
4. **Chunked streaming (2MB chunks)** - Fast but browser doesn't get duration metadata
5. **Moov atom detection** - Check if moov at end, serve full file if so - Still not working

## Current Code Location
`desktop/src/main/index.ts` - protocol.handle('media', ...) around line 157

## Current Approach
- Check if video file and initial request (bytes=0-)
- Read last 1MB to check for 'moov' string
- If moov at end, serve full file
- Otherwise use chunked streaming

## SOLUTION: Media Import System

### The Plan
Create a media import system that pre-processes videos for instant playback:

1. **Import Function**
   - User clicks "Import Media" button
   - Select video files
   - ffmpeg remuxes with `-movflags faststart` (moves moov atom to beginning)
   - Stores processed video in app data folder
   - Adds to media library database

2. **Media Library Database**
   - Table: media_items (id, name, type, originalPath, processedPath, duration, thumbnail, createdAt)

3. **Benefits**
   - Videos load INSTANTLY (moov at beginning)
   - Seeking works perfectly
   - Thumbnails pre-generated
   - Duration known upfront

4. **Implementation Files**
   - `desktop/src/main/database/media.ts` - Media library DB operations
   - `desktop/src/main/services/mediaProcessor.ts` - ffmpeg processing
   - `desktop/src/main/ipc/index.ts` - IPC handlers for import
   - `desktop/src/renderer/components/MediaGrid.tsx` - Show imported media

### ffmpeg command
```
ffmpeg -i input.mp4 -c copy -movflags faststart output.mp4
```
This just remuxes (copies) the video with moov at start - very fast, no re-encoding.

## Files Modified
- `desktop/src/main/index.ts` - Protocol handler
- `desktop/src/renderer/pages/ControlPanel.tsx` - Video element with native controls
