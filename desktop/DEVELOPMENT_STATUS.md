# SoluCast Desktop App - Development Status

Last updated: 2024-12-29 17:55

## Quick Resume

To continue development:
```bash
cd desktop
npm run build:main   # Rebuild if you changed main process files
npm run dev          # Start in dev mode
```

If app doesn't start, kill existing processes: `taskkill /F /IM electron.exe`

## Current Status: WORKING (Development Mode)

The desktop app is functional and can be run in development mode.

### Current UI Layout (ControlPanel.tsx)
```
┌─────────────────────────────────────────────────────────────┐
│ Header: [Displays] [Online Status] [Display Mode] [Logo]    │
├───────────────┬───────────────┬─────────────────────────────┤
│   Database    │    Setlist    │       Live Preview          │
│  (Songs/      │  (drag/drop   │   (screen capture from      │
│   Media/      │   reorder)    │    viewer window)           │
│   Tools)      │               │                             │
├───────────────┴───────────────┴─────────────────────────────┤
│                    Slides Grid                              │
│  [Slide 1] [Slide 2] [Slide 3] [Slide 4] [Slide 5] ...     │
└─────────────────────────────────────────────────────────────┘
```

---

## Completed Tasks

### 1. Project Setup
- [x] Electron + Vite + React project structure created
- [x] TypeScript configuration (tsconfig.json, tsconfig.main.json)
- [x] Dependencies installed (electron, vite, react, sql.js, socket.io-client, etc.)
- [x] Build scripts configured in package.json

### 2. Main Process (Electron)
- [x] `src/main/index.ts` - App entry point with hardware acceleration flags
- [x] `src/main/windows/displayManager.ts` - Multi-display window management
- [x] `src/main/ipc/index.ts` - IPC handlers for all features
- [x] `src/main/database/index.ts` - SQLite database with sql.js
- [x] `src/main/database/songs.ts` - Song CRUD operations + backend import
- [x] `src/main/database/setlists.ts` - Setlist management
- [x] `src/main/database/themes.ts` - Theme management
- [x] `src/main/services/textProcessing.ts` - Transliteration/translation
- [x] `src/main/services/mediaManager.ts` - Local media folder management
- [x] `src/main/services/socketService.ts` - Online mode connection

### 3. Preload Scripts
- [x] `src/preload/control.ts` - Control window API (electronAPI)
- [x] `src/preload/display.ts` - Display window API (displayAPI)

### 4. Renderer (React UI)
- [x] `src/renderer/App.tsx` - Router with lazy loading
- [x] `src/renderer/pages/ControlPanel.tsx` - Main operator UI (two-row 50/50 layout)
  - Top row: Database (songs/media/tools) | Setlist | Live Preview (screen capture)
  - Bottom row: Full-width slide grid for selecting specific slides
  - Features implemented:
    - Drag & drop songs from database to setlist
    - Drag & drop reorder within setlist
    - Double-click to add/remove from setlist
    - Search songs by title, author, and content
    - Songs sorted א to ת (Hebrew alphabetical)
    - Live Preview shows actual screen capture from viewer window (100ms refresh)
    - 16:9 aspect ratio maintained for preview
- [x] `src/renderer/pages/DisplayViewer.tsx` - Fullscreen viewer display
- [x] `src/renderer/pages/DisplayStage.tsx` - Stage monitor display
- [x] `src/renderer/styles/index.css` - Modern dark theme CSS

### 5. Configuration
- [x] `vite.config.ts` - Vite bundler config
- [x] `src/renderer/index.html` - HTML template with CSP
- [x] Custom `media://` protocol for local file access

### 6. Dictionaries
- [x] Copied transliteration dictionary (3,907 words)
- [x] Copied translation line dictionary (3,037 phrases)
- [x] Copied translation word dictionary (132 words)
- [x] Located in `resources/dictionaries/`

---

## How to Run

```bash
cd desktop
npm install          # Install dependencies
npm run build:main   # Build main process TypeScript
npm run dev          # Start in development mode
```

---

## Known Issues

1. **GPU Cache Errors**: Harmless permission errors on Windows, don't affect functionality
2. **Autofill DevTools Errors**: Chromium DevTools warnings, can be ignored
3. **Single Instance Lock**: If app doesn't start, kill existing electron.exe processes

---

## Recent Session Changes (2024-12-29)

### ML Translation with NLLB-200 (Session 2b)
Added proper ML translation using Hugging Face Transformers.js:
1. **NLLB-200 Model** - Meta's multilingual model (200 languages including Hebrew)
2. **Offline Translation** - Model downloads once (~1.4GB), then works offline
3. **Dictionary Fallback** - Uses word dictionary if ML not available
4. **Background Loading** - Model loads in background on app start

New Files:
- `src/main/services/mlTranslation.ts` - ML translation service using transformers.js

Dependencies Added:
- `@huggingface/transformers` - Hugging Face transformers.js library

Model Cache Location:
- `%APPDATA%/solucast-desktop/ml-models/Xenova/nllb-200-distilled-600M`

### Quick Slide Feature (Session 2a)
Added Quick Slide feature to ControlPanel:
1. **Quick Slide Modal** - Type text, each slide separated by blank line
2. **Auto-Generate Button** - Processes Hebrew text to add transliteration & translation
3. **Numbered Slide Buttons** - Click to broadcast individual slides
4. **Green "Quick" Button** - Next to Blank button in Live Preview header

Usage:
- Click ⚡ Quick button
- Type Hebrew text (e.g., "הללויה")
- Click "Auto-Generate" to fill transliteration/translation
- Click numbered buttons (1, 2, 3...) to broadcast each slide

Files Modified:
- `src/renderer/pages/ControlPanel.tsx` - Added Quick Slide UI and logic
- `src/main/services/textProcessing.ts` - Added ML translation support

### UI Layout Overhaul (Session 1)
1. Changed to two-row 50/50 layout:
   - Top row: Database | Setlist | Live Preview
   - Bottom row: Slides grid (full width)

2. Live Preview improvements:
   - Removed manual text rendering
   - Now uses actual screen capture from viewer window (`displays:captureViewer` IPC)
   - Captures at 100ms intervals for smooth updates
   - Shows "NO DISPLAY" when no viewer is connected
   - Maintains 16:9 aspect ratio

3. Database panel:
   - Removed Import button (not needed)
   - Search now checks title, author, AND slide content
   - Songs sorted א to ת (Hebrew locale)

4. Setlist panel:
   - Drag & drop from database to add songs
   - Drag & drop within setlist to reorder
   - Double-click to remove items
   - Removed up/down arrow buttons (replaced by drag)

5. Slides grid:
   - Grid layout with auto-fill columns (min 200px)
   - Shows verse type, original text, transliteration
   - Click to jump to slide
   - Selected slide highlighted with cyan border

### New IPC Handlers
- `displays:captureViewer` - Captures viewer window as thumbnail (480x270)

### Files Modified This Session
- `src/renderer/pages/ControlPanel.tsx` - Major UI changes
- `src/main/windows/displayManager.ts` - Added `captureViewerThumbnail()`
- `src/main/ipc/index.ts` - Added capture handler
- `src/preload/control.ts` - Exposed `captureViewer` API

---

## Pending Tasks / Future Work

### High Priority
- [ ] Test multi-display functionality with external monitors
- [ ] Test song import from backend server
- [ ] Verify video playback with hardware acceleration
- [ ] Add keyboard shortcuts (arrow keys, space, B for blank)

### Medium Priority
- [ ] Package for distribution (electron-builder)
- [ ] Add app icon resources
- [ ] Auto-updater integration
- [ ] Settings persistence (default theme, online server URL)

### Low Priority
- [ ] Offline song sync
- [ ] Bible verse display
- [x] Quick Slide feature (type Hebrew, auto-generate transliteration/translation)
- [ ] Stage monitor differentiated view

---

## File Structure

```
desktop/
├── src/
│   ├── main/           # Electron main process
│   │   ├── index.ts    # Entry point
│   │   ├── windows/    # Window management
│   │   ├── ipc/        # IPC handlers
│   │   ├── database/   # SQLite operations
│   │   └── services/   # Business logic
│   ├── preload/        # Context bridge scripts
│   │   ├── control.ts
│   │   └── display.ts
│   └── renderer/       # React UI
│       ├── App.tsx
│       ├── pages/
│       └── styles/
├── resources/
│   └── dictionaries/   # Transliteration/translation dicts
├── dist/               # Build output
├── package.json
├── tsconfig.json
├── tsconfig.main.json
└── vite.config.ts
```

---

## Architecture Notes

- **Database**: Uses sql.js (WebAssembly SQLite) instead of better-sqlite3 for better cross-platform compatibility
- **IPC**: All main-renderer communication goes through typed IPC handlers
- **Display Windows**: Opens fullscreen windows on external displays, broadcasts slide updates via IPC
- **Online Mode**: Connects to solucast.app for remote viewers (socket.io)
- **Dictionaries**: Loaded from `resources/dictionaries/` folder with fallback paths

---

## Dependencies

Key packages:
- `electron`: 33.2.1
- `vite`: 6.0.5
- `react`: 19.0.0
- `sql.js`: 1.13.0
- `socket.io-client`: 4.8.1
- `axios`: 1.12.2

---

## Contact / Resume Point

If continuing development:
1. Run `npm run dev` in the desktop folder
2. The app should open with DevTools
3. Check this file for pending tasks
4. Refer to `DESKTOP_APP_PLAN.md` for full architecture vision
