# SoluCast Desktop

A desktop version of SoluCast with native multi-display support for HDMI/projector outputs.

## Features

- **Multi-Display Support**: Connect unlimited HDMI displays/projectors
- **Local Media**: Access media directly from local folders (no upload needed)
- **Zero Latency**: All processing happens locally
- **Offline Mode**: Works without internet connection
- **Online Mode**: Connect to solucast.app for remote viewers

## Development

### Prerequisites

- Node.js 18+
- npm or pnpm

### Setup

```bash
cd desktop
npm install
```

### Run in Development

```bash
npm run dev
```

This starts both the Vite dev server (for the React renderer) and Electron.

### Build for Production

```bash
npm run build
```

### Package for Distribution

```bash
# Windows
npm run package:win

# All platforms
npm run package
```

## Project Structure

```
desktop/
├── src/
│   ├── main/           # Electron main process
│   │   ├── index.ts    # Entry point
│   │   ├── windows/    # Window management
│   │   ├── ipc/        # IPC handlers
│   │   ├── services/   # Business logic
│   │   └── database/   # SQLite setup
│   │
│   ├── preload/        # Preload scripts
│   │   ├── control.ts  # Control window API
│   │   └── display.ts  # Display window API
│   │
│   └── renderer/       # React UI
│       ├── App.tsx     # Main app component
│       ├── pages/      # Page components
│       └── styles/     # CSS
│
├── resources/          # App icons
├── package.json
└── vite.config.ts
```

## Multi-Display Usage

1. Connect your display(s) to your computer
2. Launch SoluCast Desktop
3. In the "Displays" panel, you'll see all connected displays
4. Click "Viewer" to open a fullscreen viewer window on that display
5. Click "Stage" to open a stage monitor window
6. Control everything from the main window on your primary display

## Local Media

1. Go to the "Media" tab
2. Click "Add Media Folder"
3. Select a folder containing images/videos
4. Media files will be available immediately

## Online Mode

1. Click "Connect Online" in the header
2. A room PIN will be generated
3. Share the PIN with remote viewers at solucast.app
4. Slides will sync to both local displays AND online viewers

## Keyboard Shortcuts

- **Right Arrow** / **Space**: Next slide
- **Left Arrow**: Previous slide
- **B**: Toggle blank screen
- **F11**: Toggle fullscreen (display windows)

## Supported Formats

### Images
- JPEG, PNG, GIF, WebP, BMP

### Videos
- MP4, WebM, MOV, AVI, MKV, WMV, M4V
