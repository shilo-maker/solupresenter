# SoluPresenter Desktop App - Implementation Plan

## Overview

Create an Electron-based desktop version of SoluPresenter that provides:
- Native multi-display support (unlimited HDMI/projector outputs)
- Local media library with folder management
- Zero-latency local presentation
- Offline capability
- Shared codebase with the web app

---

## Architecture

### High-Level Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     SoluPresenter Desktop                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐      ┌─────────────────┐     ┌─────────────────┐   │
│  │  Control Window │      │ Display Window 1│     │ Display Window 2│   │
│  │   (Primary)     │      │  (Projector 1)  │     │  (Projector 2)  │   │
│  │                 │      │                 │     │                 │   │
│  │  React App      │      │  Viewer Page    │     │  Stage Monitor  │   │
│  │  (Operator UI)  │      │  (Fullscreen)   │     │  (Fullscreen)   │   │
│  └────────┬────────┘      └────────┬────────┘     └────────┬────────┘   │
│           │                        │                       │            │
│           └────────────────────────┼───────────────────────┘            │
│                                    │                                     │
│                          ┌─────────▼─────────┐                          │
│                          │   Main Process    │                          │
│                          │                   │                          │
│                          │ - Display Manager │                          │
│                          │ - IPC Hub         │                          │
│                          │ - File System     │                          │
│                          │ - Local Database  │                          │
│                          │ - Services        │                          │
│                          └─────────┬─────────┘                          │
│                                    │                                     │
│                          ┌─────────▼─────────┐                          │
│                          │     SQLite DB     │                          │
│                          │  (Local Storage)  │                          │
│                          └───────────────────┘                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Process Communication

```
Control Window ◄──IPC──► Main Process ◄──IPC──► Display Windows
     │                        │
     │                        ├── Display Manager (screen detection)
     │                        ├── Media Manager (local files)
     │                        ├── Database (SQLite via Sequelize)
     │                        └── Services (transliteration, etc.)
     │
     └── React UI (shared with web app)
```

---

## Project Structure

```
solupresenter/
├── packages/
│   ├── shared/                    # Shared code between web & desktop
│   │   ├── components/            # Reusable React components
│   │   ├── utils/                 # Utility functions
│   │   ├── types/                 # TypeScript types
│   │   └── constants/             # Shared constants
│   │
│   ├── web/                       # Existing web app (renamed from frontend)
│   │   └── ... (existing structure)
│   │
│   ├── desktop/                   # NEW: Electron desktop app
│   │   ├── src/
│   │   │   ├── main/              # Electron main process
│   │   │   │   ├── index.ts       # Entry point
│   │   │   │   ├── windows/       # Window management
│   │   │   │   │   ├── controlWindow.ts
│   │   │   │   │   ├── displayWindow.ts
│   │   │   │   │   └── windowManager.ts
│   │   │   │   ├── ipc/           # IPC handlers
│   │   │   │   │   ├── displays.ts
│   │   │   │   │   ├── media.ts
│   │   │   │   │   ├── slides.ts
│   │   │   │   │   └── database.ts
│   │   │   │   ├── services/      # Backend services (embedded)
│   │   │   │   │   ├── transliteration.ts
│   │   │   │   │   ├── translation.ts
│   │   │   │   │   └── media.ts
│   │   │   │   └── database/      # SQLite setup
│   │   │   │       └── index.ts
│   │   │   │
│   │   │   ├── preload/           # Preload scripts
│   │   │   │   ├── control.ts     # For control window
│   │   │   │   └── display.ts     # For display windows
│   │   │   │
│   │   │   └── renderer/          # React app (imports from shared)
│   │   │       ├── App.tsx
│   │   │       ├── pages/
│   │   │       │   ├── ControlPanel.tsx    # Desktop-specific operator UI
│   │   │       │   ├── DisplayViewer.tsx   # Display window content
│   │   │       │   └── DisplayStage.tsx    # Stage monitor content
│   │   │       └── hooks/
│   │   │           └── useElectron.ts      # Electron-specific hooks
│   │   │
│   │   ├── resources/             # App icons, etc.
│   │   ├── package.json
│   │   ├── electron-builder.yml
│   │   └── tsconfig.json
│   │
│   └── backend/                   # Existing backend (for web)
│       └── ... (existing structure)
│
├── package.json                   # Root workspace config
└── pnpm-workspace.yaml
```

---

## Multi-Display System

### Display Manager

The core feature - managing multiple output displays:

```typescript
// main/windows/displayManager.ts

interface ManagedDisplay {
  id: number;
  electronDisplay: Electron.Display;
  window: BrowserWindow | null;
  type: 'viewer' | 'stage' | 'custom';
  config: DisplayConfig;
}

class DisplayManager {
  private displays: Map<number, ManagedDisplay> = new Map();
  private controlWindow: BrowserWindow | null = null;

  // Detect all connected displays
  getAllDisplays(): DisplayInfo[] {
    return screen.getAllDisplays().map(d => ({
      id: d.id,
      label: d.label || `Display ${d.id}`,
      bounds: d.bounds,
      isPrimary: d.id === screen.getPrimaryDisplay().id,
      scaleFactor: d.scaleFactor,
      isAssigned: this.displays.has(d.id)
    }));
  }

  // Open a display window on specific monitor
  openDisplayWindow(displayId: number, type: 'viewer' | 'stage'): void {
    const electronDisplay = screen.getAllDisplays().find(d => d.id === displayId);
    if (!electronDisplay) return;

    const window = new BrowserWindow({
      x: electronDisplay.bounds.x,
      y: electronDisplay.bounds.y,
      width: electronDisplay.bounds.width,
      height: electronDisplay.bounds.height,
      fullscreen: true,
      frame: false,
      alwaysOnTop: true,
      webPreferences: {
        preload: path.join(__dirname, '../preload/display.js'),
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false  // Critical for smooth video
      }
    });

    // Load appropriate content
    window.loadFile(`display-${type}.html`);

    this.displays.set(displayId, {
      id: displayId,
      electronDisplay,
      window,
      type,
      config: {}
    });
  }

  // Broadcast slide update to all display windows
  broadcastSlide(slideData: SlideData): void {
    for (const display of this.displays.values()) {
      if (display.window) {
        display.window.webContents.send('slide:update', slideData);
      }
    }
  }

  // Listen for display changes (connect/disconnect)
  startWatching(): void {
    screen.on('display-added', (event, newDisplay) => {
      this.notifyControlWindow('display:added', this.getAllDisplays());
    });

    screen.on('display-removed', (event, oldDisplay) => {
      // Close window if it was on this display
      const managed = this.displays.get(oldDisplay.id);
      if (managed?.window) {
        managed.window.close();
      }
      this.displays.delete(oldDisplay.id);
      this.notifyControlWindow('display:removed', this.getAllDisplays());
    });
  }
}
```

### Display Assignment UI

```tsx
// renderer/components/DisplayAssignment.tsx

function DisplayAssignment() {
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);

  useEffect(() => {
    window.electronAPI.getDisplays().then(setDisplays);

    // Listen for display changes
    return window.electronAPI.onDisplaysChanged((newDisplays) => {
      setDisplays(newDisplays);
    });
  }, []);

  const assignDisplay = async (displayId: number, type: 'viewer' | 'stage') => {
    await window.electronAPI.openDisplayWindow(displayId, type);
    // Refresh list
    setDisplays(await window.electronAPI.getDisplays());
  };

  return (
    <div className="display-manager">
      <h3>Connected Displays</h3>
      {displays.map(display => (
        <div key={display.id} className="display-item">
          <span>{display.label} {display.isPrimary && '(Primary)'}</span>
          <span>{display.bounds.width}x{display.bounds.height}</span>

          {!display.isPrimary && (
            <div className="actions">
              {display.isAssigned ? (
                <button onClick={() => window.electronAPI.closeDisplayWindow(display.id)}>
                  Close
                </button>
              ) : (
                <>
                  <button onClick={() => assignDisplay(display.id, 'viewer')}>
                    Open as Viewer
                  </button>
                  <button onClick={() => assignDisplay(display.id, 'stage')}>
                    Open as Stage Monitor
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

## Local Media Management

### Media Folders

Users can configure folders that the app watches for media:

```typescript
// main/services/mediaManager.ts

interface MediaFolder {
  id: string;
  path: string;
  name: string;
  type: 'images' | 'videos' | 'all';
}

class MediaManager {
  private folders: MediaFolder[] = [];
  private mediaCache: Map<string, MediaFile[]> = new Map();

  // Add a media folder
  async addFolder(folderPath: string, type: 'images' | 'videos' | 'all'): Promise<MediaFolder> {
    const folder: MediaFolder = {
      id: crypto.randomUUID(),
      path: folderPath,
      name: path.basename(folderPath),
      type
    };

    this.folders.push(folder);
    await this.scanFolder(folder);
    return folder;
  }

  // Scan folder for media files
  async scanFolder(folder: MediaFolder): Promise<void> {
    const extensions = {
      images: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      videos: ['.mp4', '.webm', '.mov', '.avi', '.mkv'],
      all: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm', '.mov', '.avi', '.mkv']
    };

    const files = await fs.promises.readdir(folder.path);
    const mediaFiles: MediaFile[] = [];

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (extensions[folder.type].includes(ext)) {
        const filePath = path.join(folder.path, file);
        const stats = await fs.promises.stat(filePath);

        mediaFiles.push({
          id: crypto.randomUUID(),
          name: file,
          path: filePath,
          type: extensions.images.includes(ext) ? 'image' : 'video',
          size: stats.size,
          modified: stats.mtime
        });
      }
    }

    this.mediaCache.set(folder.id, mediaFiles);
  }

  // Get all media from all folders
  getAllMedia(): MediaFile[] {
    const all: MediaFile[] = [];
    for (const files of this.mediaCache.values()) {
      all.push(...files);
    }
    return all.sort((a, b) => b.modified.getTime() - a.modified.getTime());
  }
}
```

### Custom Protocol for Local Files

Secure access to local files from renderer:

```typescript
// main/index.ts

// Register before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,  // Important for video streaming
      bypassCSP: true
    }
  }
]);

app.whenReady().then(() => {
  // Handle media:// protocol
  protocol.handle('media', async (request) => {
    const url = new URL(request.url);
    const filePath = decodeURIComponent(url.pathname);

    // Security: validate path is within allowed folders
    if (!mediaManager.isPathAllowed(filePath)) {
      return new Response('Forbidden', { status: 403 });
    }

    return net.fetch(`file://${filePath}`);
  });
});
```

---

## Video Playback

### Hardware Acceleration Setup

```typescript
// main/index.ts

// Enable hardware acceleration flags
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-accelerated-video-decode');

// Linux-specific
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('use-gl', 'egl');
}
```

### Video in Display Window

```tsx
// renderer/pages/DisplayViewer.tsx

function DisplayViewer() {
  const [currentMedia, setCurrentMedia] = useState<MediaContent | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Listen for media updates from control window
    return window.displayAPI.onMediaUpdate((media) => {
      setCurrentMedia(media);
    });
  }, []);

  useEffect(() => {
    // Handle video playback commands
    return window.displayAPI.onVideoCommand((command) => {
      if (!videoRef.current) return;

      switch (command.type) {
        case 'play':
          videoRef.current.play();
          break;
        case 'pause':
          videoRef.current.pause();
          break;
        case 'seek':
          videoRef.current.currentTime = command.time;
          break;
      }
    });
  }, []);

  if (!currentMedia) {
    return <div className="blank-screen" />;
  }

  if (currentMedia.type === 'video') {
    return (
      <video
        ref={videoRef}
        src={`media://${currentMedia.path}`}
        className="fullscreen-video"
        autoPlay
      />
    );
  }

  if (currentMedia.type === 'image') {
    return (
      <img
        src={`media://${currentMedia.path}`}
        className="fullscreen-image"
        alt=""
      />
    );
  }

  // Song slides, etc.
  return <SlideDisplay slide={currentMedia} />;
}
```

---

## IPC API Design

### Preload Script (Control Window)

```typescript
// preload/control.ts

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Display Management
  getDisplays: () => ipcRenderer.invoke('displays:getAll'),
  openDisplayWindow: (displayId: number, type: string) =>
    ipcRenderer.invoke('displays:open', displayId, type),
  closeDisplayWindow: (displayId: number) =>
    ipcRenderer.invoke('displays:close', displayId),
  onDisplaysChanged: (callback: Function) => {
    const handler = (_: any, displays: any) => callback(displays);
    ipcRenderer.on('displays:changed', handler);
    return () => ipcRenderer.removeListener('displays:changed', handler);
  },

  // Slide Control
  sendSlide: (slideData: any) => ipcRenderer.invoke('slides:send', slideData),
  sendBlank: () => ipcRenderer.invoke('slides:blank'),

  // Media Management
  getMediaFolders: () => ipcRenderer.invoke('media:getFolders'),
  addMediaFolder: () => ipcRenderer.invoke('media:addFolder'),  // Opens dialog
  removeMediaFolder: (id: string) => ipcRenderer.invoke('media:removeFolder', id),
  getMediaFiles: (folderId?: string) => ipcRenderer.invoke('media:getFiles', folderId),

  // Video Control
  playVideo: (path: string) => ipcRenderer.invoke('video:play', path),
  pauseVideo: () => ipcRenderer.invoke('video:pause'),
  seekVideo: (time: number) => ipcRenderer.invoke('video:seek', time),
  stopVideo: () => ipcRenderer.invoke('video:stop'),

  // Database
  getSongs: () => ipcRenderer.invoke('db:songs:getAll'),
  getSong: (id: string) => ipcRenderer.invoke('db:songs:get', id),
  createSong: (data: any) => ipcRenderer.invoke('db:songs:create', data),
  updateSong: (id: string, data: any) => ipcRenderer.invoke('db:songs:update', id, data),
  deleteSong: (id: string) => ipcRenderer.invoke('db:songs:delete', id),

  // Setlists
  getSetlists: () => ipcRenderer.invoke('db:setlists:getAll'),
  getSetlist: (id: string) => ipcRenderer.invoke('db:setlists:get', id),
  createSetlist: (data: any) => ipcRenderer.invoke('db:setlists:create', data),

  // Services
  transliterate: (text: string) => ipcRenderer.invoke('service:transliterate', text),
  translate: (text: string) => ipcRenderer.invoke('service:translate', text),
  processQuickSlide: (text: string) => ipcRenderer.invoke('service:quickSlide', text),

  // App
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  checkForUpdates: () => ipcRenderer.invoke('app:checkUpdates'),
  quitAndInstall: () => ipcRenderer.invoke('app:quitAndInstall')
});
```

### Preload Script (Display Window)

```typescript
// preload/display.ts

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('displayAPI', {
  // Receive updates from control window
  onSlideUpdate: (callback: Function) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('slide:update', handler);
    return () => ipcRenderer.removeListener('slide:update', handler);
  },

  onMediaUpdate: (callback: Function) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('media:update', handler);
    return () => ipcRenderer.removeListener('media:update', handler);
  },

  onVideoCommand: (callback: Function) => {
    const handler = (_: any, command: any) => callback(command);
    ipcRenderer.on('video:command', handler);
    return () => ipcRenderer.removeListener('video:command', handler);
  },

  onThemeUpdate: (callback: Function) => {
    const handler = (_: any, theme: any) => callback(theme);
    ipcRenderer.on('theme:update', handler);
    return () => ipcRenderer.removeListener('theme:update', handler);
  },

  // Report status back
  reportReady: () => ipcRenderer.send('display:ready'),
  reportVideoTime: (time: number) => ipcRenderer.send('video:timeUpdate', time)
});
```

---

## Database (Embedded SQLite)

Reuse existing Sequelize models with SQLite:

```typescript
// main/database/index.ts

import { Sequelize } from 'sequelize';
import { app } from 'electron';
import path from 'path';

const dbPath = path.join(app.getPath('userData'), 'solupresenter.sqlite');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: false
});

// Import existing models from shared package
import { defineUser } from '@solupresenter/shared/models/User';
import { defineSong } from '@solupresenter/shared/models/Song';
import { defineSetlist } from '@solupresenter/shared/models/Setlist';
// ... etc

export const User = defineUser(sequelize);
export const Song = defineSong(sequelize);
export const Setlist = defineSetlist(sequelize);

export async function initDatabase() {
  await sequelize.sync();

  // Seed built-in themes if needed
  await ViewerTheme.seedClassicTheme();
  await StageMonitorTheme.seedBuiltInThemes();
}
```

---

## Hybrid Mode (Optional)

Support both offline and online modes:

```typescript
// main/services/syncService.ts

class SyncService {
  private isOnline: boolean = false;
  private serverUrl: string = 'https://solucast.app';

  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.serverUrl}/health`);
      this.isOnline = response.ok;
    } catch {
      this.isOnline = false;
    }
    return this.isOnline;
  }

  // Sync local songs to cloud
  async syncSongs(): Promise<void> {
    if (!this.isOnline) return;

    const localSongs = await Song.findAll({ where: { needsSync: true } });

    for (const song of localSongs) {
      try {
        await this.uploadSong(song);
        song.needsSync = false;
        await song.save();
      } catch (err) {
        console.error('Sync failed for song:', song.id);
      }
    }
  }

  // Connect to online room (for remote viewers)
  async connectToCloud(roomPin: string): Promise<Socket> {
    const socket = io(this.serverUrl);
    socket.emit('operator:join', { roomPin });
    return socket;
  }
}
```

---

## Build Configuration

### electron-builder.yml

```yaml
appId: com.solupresenter.desktop
productName: SoluPresenter
copyright: Copyright © 2025

directories:
  output: release
  buildResources: resources

files:
  - dist/**/*
  - package.json

win:
  target:
    - nsis
    - portable
  icon: resources/icon.ico

mac:
  target:
    - dmg
    - zip
  icon: resources/icon.icns
  hardenedRuntime: true
  category: public.app-category.productivity

linux:
  target:
    - AppImage
    - deb
  icon: resources/icons
  category: Office

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true

publish:
  provider: github
  owner: your-username
  repo: solupresenter

# Auto-update
autoUpdate:
  publish:
    - github
```

### package.json scripts

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:renderer\" \"npm run dev:main\"",
    "dev:renderer": "vite",
    "dev:main": "electron .",
    "build": "npm run build:renderer && npm run build:main",
    "build:renderer": "vite build",
    "build:main": "tsc -p tsconfig.main.json",
    "package": "electron-builder",
    "package:win": "electron-builder --win",
    "package:mac": "electron-builder --mac",
    "package:linux": "electron-builder --linux"
  }
}
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Set up monorepo structure with pnpm workspaces
- [ ] Create desktop package with Electron boilerplate
- [ ] Implement basic window management (control + one display)
- [ ] Set up IPC communication between windows
- [ ] Embed SQLite database with existing models

### Phase 2: Core Features (Week 3-4)
- [ ] Port control panel UI (reuse React components)
- [ ] Implement display viewer window
- [ ] Add multi-display detection and assignment
- [ ] Implement slide broadcasting to display windows
- [ ] Add local media folder management

### Phase 3: Media & Video (Week 5-6)
- [ ] Implement custom protocol for local files
- [ ] Add video playback with hardware acceleration
- [ ] Video controls (play, pause, seek, stop)
- [ ] Image display with transitions
- [ ] Integrate embedded transliteration/translation services

### Phase 4: Polish & Distribution (Week 7-8)
- [ ] Stage monitor support
- [ ] Theme system integration
- [ ] Auto-update mechanism
- [ ] Build installers (Windows, Mac, Linux)
- [ ] Testing on various hardware configs

### Phase 5: Advanced Features (Future)
- [ ] Hybrid online/offline mode
- [ ] Cloud sync for songs and setlists
- [ ] FFmpeg integration for video transcoding
- [ ] NDI output support
- [ ] OBS integration via virtual camera

---

## Benefits Summary

| Feature | Web App | Desktop App |
|---------|---------|-------------|
| Multi-display | Limited (Presentation API) | Native (unlimited displays) |
| Video playback | Browser limitations | Hardware accelerated |
| Local media | Upload required | Direct folder access |
| Latency | Network dependent | Zero latency |
| Offline | Requires internet | Fully offline |
| File size limits | Server storage | Local storage |
| Processing | Server CPU | Local CPU |

---

## Questions Before Starting

1. **Monorepo approach**: Should we restructure the existing project into a monorepo, or create the desktop app as a separate repository?

2. **Code sharing priority**: What percentage of UI should be shared vs desktop-specific?

3. **Minimum supported OS versions**:
   - Windows 10+?
   - macOS 10.15+?
   - Ubuntu 20.04+?

4. **Initial platform priority**: Start with Windows only, or all platforms from the beginning?

5. **Hybrid mode**: Should online connectivity (for remote viewers) be part of Phase 1, or a later addition?
