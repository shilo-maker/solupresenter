# SoluPresenter - Complete Application Documentation

## Executive Summary

**SoluPresenter** (also branded as **SoluCast**) is a comprehensive, real-time worship presentation platform designed for churches and religious organizations. It enables operators to broadcast song lyrics, Bible verses, presentations, and multimedia content to multiple display types simultaneously, with full support for Hebrew-English bilingual content including automatic transliteration and translation.

---

## Table of Contents

1. [Technology Stack](#technology-stack)
2. [Architecture Overview](#architecture-overview)
3. [Backend Architecture](#backend-architecture)
4. [Frontend Architecture](#frontend-architecture)
5. [Database Models](#database-models)
6. [Real-Time Communication (Socket.IO)](#real-time-communication-socketio)
7. [Core Features](#core-features)
8. [Special Features](#special-features)
9. [API Reference](#api-reference)
10. [Deployment](#deployment)

---

## Technology Stack

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 18+ | Runtime environment |
| Express.js | 4.x | Web framework |
| Socket.IO | 4.8.x | Real-time bidirectional communication |
| Sequelize | 6.x | ORM for database operations |
| PostgreSQL | 15+ | Production database |
| SQLite | 3.x | Development database |
| Passport.js | 0.7.x | Authentication (Local + Google OAuth) |
| JWT | - | Token-based authentication |
| Sharp | - | Image processing and compression |
| Resend | - | Email service |

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2.x | UI framework |
| React Router | 7.9.x | Client-side routing |
| React Bootstrap | 2.10.x | UI component library |
| Socket.IO Client | 4.8.x | Real-time communication |
| i18next | 23.11.x | Internationalization (EN/HE) |
| Axios | 1.12.x | HTTP client |
| react-rnd | 10.5.x | Drag-and-drop positioning |
| @hello-pangea/dnd | 18.x | Drag-and-drop lists |

### Infrastructure
- **Hosting**: Render.com (auto-deploy from GitHub)
- **CDN**: CloudFront (optional)
- **SSL**: HTTPS with auto-certificates
- **Domain**: solucast.app

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            SOLUPRESENTER                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐   │
│  │   Operator   │    │   Viewers    │    │    Stage Monitors        │   │
│  │   (React)    │    │   (React)    │    │       (React)            │   │
│  └──────┬───────┘    └──────┬───────┘    └───────────┬──────────────┘   │
│         │                   │                        │                   │
│         └───────────────────┼────────────────────────┘                   │
│                             │                                            │
│                    ┌────────▼────────┐                                   │
│                    │   Socket.IO     │                                   │
│                    │   (WebSocket)   │                                   │
│                    └────────┬────────┘                                   │
│                             │                                            │
│                    ┌────────▼────────┐                                   │
│                    │    Express.js   │                                   │
│                    │   REST API      │                                   │
│                    └────────┬────────┘                                   │
│                             │                                            │
│         ┌───────────────────┼───────────────────┐                        │
│         │                   │                   │                        │
│  ┌──────▼──────┐    ┌───────▼───────┐   ┌──────▼──────┐                 │
│  │  Sequelize  │    │  Services     │   │  Jobs       │                 │
│  │    ORM      │    │  (Trans/Email)│   │  (Cleanup)  │                 │
│  └──────┬──────┘    └───────────────┘   └─────────────┘                 │
│         │                                                                │
│  ┌──────▼──────┐                                                         │
│  │ PostgreSQL  │                                                         │
│  │  Database   │                                                         │
│  └─────────────┘                                                         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Operator** creates a room and gets a unique 4-digit PIN
2. **Viewers** join the room using the PIN or a public slug
3. **Operator** selects songs, slides, or media to display
4. **Socket.IO** broadcasts updates to all connected viewers in real-time
5. **Viewers** render the content with applied themes and styles

---

## Backend Architecture

### Directory Structure

```
backend/
├── server.js                 # Main entry point (Express + Socket.IO)
├── package.json              # Dependencies and scripts
├── .env                      # Environment variables
├── database.sqlite           # SQLite development database
│
├── config/
│   ├── sequelize.js          # Database configuration (SQLite/PostgreSQL)
│   ├── passport.js           # Authentication strategies
│   └── database.js           # Legacy MongoDB config (deprecated)
│
├── middleware/
│   └── auth.js               # JWT verification + role-based access
│
├── models/                   # Sequelize models (13 total)
│   ├── index.js              # Model relationships
│   ├── User.js               # User accounts
│   ├── Song.js               # Song library
│   ├── Room.js               # Presentation rooms
│   ├── Setlist.js            # Song collections
│   ├── Media.js              # Images/videos
│   ├── BibleVerse.js         # Bible content
│   ├── ViewerTheme.js        # Viewer display themes
│   ├── StageMonitorTheme.js  # Stage monitor themes
│   ├── Presentation.js       # Freeform presentations
│   ├── PublicRoom.js         # Named public rooms
│   ├── RemoteScreen.js       # Kiosk displays
│   └── SongMapping.js        # SoluFlow integration
│
├── routes/                   # REST API endpoints
│   ├── auth.js               # Authentication
│   ├── songs.js              # Song management
│   ├── rooms.js              # Room management
│   ├── setlists.js           # Setlist management
│   ├── media.js              # Media uploads
│   ├── bible.js              # Bible verses
│   ├── admin.js              # Admin functions
│   ├── viewerThemes.js       # Viewer themes
│   ├── stageMonitorThemes.js # Stage themes
│   ├── presentations.js      # Presentations
│   ├── publicRooms.js        # Public rooms
│   ├── remoteScreens.js      # Remote screens
│   ├── screenAccess.js       # Public screen access
│   ├── quickSlide.js         # Hebrew processing
│   └── soluflow.js           # SoluFlow integration
│
├── services/
│   ├── transliterationService.js  # Hebrew transliteration
│   └── translationService.js      # Hebrew translation
│
├── utils/
│   ├── emailService.js       # Resend email integration
│   └── generatePin.js        # Room PIN generation
│
├── jobs/
│   ├── cleanupTemporarySetlists.js  # Hourly cleanup
│   └── cleanupExpiredRooms.js       # 15-minute cleanup
│
└── uploads/
    └── backgrounds/          # User-uploaded media
```

### Server Configuration

**Port**: 5000 (configurable via `PORT` env var)

**CORS Origins**:
- `http://localhost:3000` / `https://localhost:3000`
- `http://localhost:3456` / `https://localhost:3456`
- `http://10.100.102.27:3456`
- `https://d125ckyjvo1azi.cloudfront.net`
- `https://solupresenter-frontend.onrender.com`
- `https://solucast.app`
- `FRONTEND_URL` environment variable

**Security**:
- Helmet.js for security headers
- Rate limiting: 5 login attempts / 15 min, 3 registrations / hour
- JWT tokens with 30-day expiry
- Password hashing with bcrypt (10 rounds)

**Scheduled Jobs**:
- Temporary setlist cleanup: Every hour
- Expired room cleanup: Every 15 minutes

---

## Frontend Architecture

### Directory Structure

```
frontend/
├── public/
│   ├── index.html            # HTML template
│   └── manifest.json         # PWA manifest
│
├── src/
│   ├── index.js              # Entry point with service worker
│   ├── App.js                # Main router and layout
│   ├── App.css               # Global styles
│   ├── i18n.js               # Internationalization config
│   │
│   ├── contexts/
│   │   └── AuthContext.js    # Authentication state
│   │
│   ├── services/
│   │   ├── api.js            # REST API client
│   │   └── socket.js         # Socket.IO client
│   │
│   ├── pages/
│   │   ├── Login.js          # Authentication
│   │   ├── Register.js
│   │   ├── Dashboard.js      # User home
│   │   ├── PresenterMode.js  # Main operator interface
│   │   ├── ViewerPage.js     # Viewer display
│   │   ├── StageMonitor.js   # Stage monitor display
│   │   ├── OBSOverlay.js     # OBS streaming overlay
│   │   ├── SongList.js       # Song library
│   │   ├── SongCreate.js     # Create song
│   │   ├── SongEdit.js       # Edit song
│   │   ├── SetlistList.js    # Setlist library
│   │   ├── MediaLibrary.js   # Media management
│   │   ├── Themes.js         # Theme editor
│   │   ├── Admin.js          # Admin panel
│   │   ├── Settings.js       # User settings
│   │   ├── RemoteScreens.js  # Remote screen config
│   │   └── RemoteScreen.js   # Remote screen display
│   │
│   ├── components/
│   │   ├── PrivateRoute.js   # Auth route guard
│   │   ├── ThemeSelector.js  # Theme dropdown
│   │   ├── ConnectionStatus.js
│   │   │
│   │   ├── theme-editor/
│   │   │   ├── ThemeCanvas.js
│   │   │   ├── DraggableTextBox.js
│   │   │   └── PropertiesPanel.js
│   │   │
│   │   ├── stage-monitor-editor/
│   │   │   ├── StageMonitorCanvas.js
│   │   │   └── StageMonitorPropertiesPanel.js
│   │   │
│   │   └── presentation-editor/
│   │       ├── PresentationEditor.js
│   │       ├── PresentationCanvas.js
│   │       └── TextPropertiesPanel.js
│   │
│   ├── utils/
│   │   └── slideCombining.js # Slide pairing logic
│   │
│   ├── styles/
│   │   └── modern.css        # Design system
│   │
│   └── locales/
│       ├── en.json           # English translations
│       └── he.json           # Hebrew translations
```

### Routing Structure

| Route | Page | Auth | Purpose |
|-------|------|------|---------|
| `/` | Redirect | No | Redirects to `/viewer` |
| `/login` | Login | No | User login |
| `/register` | Register | No | User registration |
| `/verify-email` | VerifyEmail | No | Email verification |
| `/forgot-password` | ForgotPassword | No | Password recovery |
| `/reset-password` | ResetPassword | No | Password reset |
| `/viewer` | ViewerPage | No | Main viewer display |
| `/obs-overlay` | OBSOverlay | No | OBS streaming overlay |
| `/stage-monitor` | StageMonitor | No | Stage monitor display |
| `/u/:userId/screen/:screenId` | RemoteScreen | No | Remote kiosk display |
| `/dashboard` | Dashboard | Yes | User home |
| `/operator` | PresenterMode | Yes | Operator control panel |
| `/songs` | SongList | Yes | Song library |
| `/songs/new` | SongCreate | Yes | Create song |
| `/songs/:id` | SongView | Yes | View song |
| `/songs/:id/edit` | SongEdit | Yes | Edit song |
| `/setlists` | SetlistList | Yes | Setlist library |
| `/media` | MediaLibrary | Yes | Media management |
| `/themes` | Themes | Yes | Theme editor |
| `/admin` | Admin | Admin | Admin panel |
| `/settings` | Settings | Yes | User settings |
| `/remote-screens` | RemoteScreens | Yes | Remote screen config |

### State Management

- **AuthContext**: User authentication state, login/logout/register methods
- **Local State**: Component-level state using `useState` hooks
- **Socket.IO**: Real-time state synchronization across rooms
- **No Redux**: Deliberately kept simple with Context API + local state

---

## Database Models

### Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│    User     │───────│    Room     │───────│   Setlist   │
│             │ 1   M │             │ M   1 │             │
│ - email     │       │ - pin       │       │ - name      │
│ - password  │       │ - isActive  │       │ - items[]   │
│ - role      │       │ - viewerCnt │       │ - isTemp    │
└─────────────┘       └─────────────┘       └─────────────┘
       │                     │
       │ 1                   │ M
       │                     │
       ▼ M                   ▼ 1
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│    Song     │       │ ViewerTheme │       │    Media    │
│             │       │             │       │             │
│ - title     │       │ - lineStyles│       │ - type      │
│ - slides[]  │       │ - positions │       │ - url       │
│ - isPublic  │       │ - container │       │ - fileSize  │
└─────────────┘       └─────────────┘       └─────────────┘
       │
       │ 1
       │
       ▼ M
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│ SongMapping │       │ BibleVerse  │       │ PublicRoom  │
│             │       │             │       │             │
│ - flowId    │       │ - book      │       │ - name      │
│ - presentId │       │ - chapter   │       │ - slug      │
│ - confidence│       │ - hebrewTxt │       │ - ownerId   │
└─────────────┘       └─────────────┘       └─────────────┘

┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│Presentation │       │RemoteScreen │       │StageMonitor │
│             │       │             │       │   Theme     │
│ - title     │       │ - displayTyp│       │ - colors    │
│ - slides[]  │       │ - config    │       │ - positions │
│ - canvas    │       │ - userId    │       │ - elements  │
└─────────────┘       └─────────────┘       └─────────────┘
```

### Model Details

#### User
```javascript
{
  id: UUID,
  email: String (unique),
  password: String (bcrypt hashed),
  authProvider: 'local' | 'google',
  googleId: String (optional),
  role: 'operator' | 'admin',
  preferences: { language: 'he' | 'en' },
  isEmailVerified: Boolean,
  emailVerificationToken: String,
  passwordResetToken: String
}
```

#### Song
```javascript
{
  id: UUID,
  title: String,
  originalLanguage: 'he' | 'en' | 'es' | 'fr' | 'de' | 'ru' | 'ar' | 'other',
  slides: [{
    originalText: String,
    transliteration: String,
    translation: String,
    translationOverflow: String,
    verseType: String
  }],
  tags: [String],
  isPublic: Boolean,
  isPendingApproval: Boolean,
  createdById: UUID,
  approvedById: UUID,
  usageCount: Integer,
  backgroundImage: String,
  author: String
}
```

#### Room
```javascript
{
  id: UUID,
  pin: String (4 chars, unique),
  operatorId: UUID,
  isActive: Boolean,
  currentSlide: {
    songId: UUID,
    slideIndex: Integer,
    displayMode: 'bilingual' | 'original',
    isBlank: Boolean
  },
  backgroundImage: String,
  quickSlideText: String,
  viewerCount: Integer,
  temporarySetlistId: UUID,
  linkedPermanentSetlistId: UUID,
  activeThemeId: UUID,
  lastActivity: Date,
  expiresAt: Date (default: NOW + 2 hours)
}
```

#### ViewerTheme
```javascript
{
  id: UUID,
  name: String,
  createdById: UUID,
  isBuiltIn: Boolean,
  lineOrder: ['original', 'transliteration', 'translation'],
  lineStyles: {
    original: { fontSize, fontWeight, color, opacity, visible },
    transliteration: { ... },
    translation: { ... }
  },
  positioning: { vertical, horizontal, customTop, customLeft },
  container: { maxWidth, padding, backgroundColor, borderRadius },
  viewerBackground: { type: 'inherit' | 'color' | 'transparent', color },
  linePositions: { original: { x, y, width, height }, ... },
  canvasDimensions: { width: 1920, height: 1080 },
  backgroundBoxes: [{ id, x, y, width, height, color, opacity, borderRadius }]
}
```

---

## Real-Time Communication (Socket.IO)

### Connection Configuration

**Backend** (`server.js`):
```javascript
{
  cors: { origin: allowedOrigins, credentials: true },
  pingInterval: 10000,    // 10 seconds
  pingTimeout: 5000,      // 5 seconds
  transports: ['websocket', 'polling'],
  perMessageDeflate: false,
  httpCompression: false
}
```

**Frontend** (`socket.js`):
```javascript
{
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 500,
  reconnectionDelayMax: 3000,
  timeout: 10000
}
```

### Event Reference

#### Room Management Events

| Event | Direction | Data | Purpose |
|-------|-----------|------|---------|
| `operator:join` | Client→Server | `{ userId, roomId }` | Operator enters room |
| `operator:joined` | Server→Client | `{ roomPin, quickSlideText }` | Confirm operator joined |
| `viewer:join` | Client→Server | `{ pin }` or `{ slug }` | Viewer enters room |
| `viewer:joined` | Server→Client | `{ roomPin, currentSlide, theme, ... }` | Full room state |
| `room:viewerCount` | Server→Client | `{ count }` | Viewer count update |
| `room:closed` | Server→Client | `{ message }` | Room closed notification |

#### Slide Synchronization Events

| Event | Direction | Data | Purpose |
|-------|-----------|------|---------|
| `operator:updateSlide` | Client→Server | `{ roomId, songId, slideIndex, ... }` | Send slide update |
| `slide:update` | Server→Client | `{ currentSlide, slideData, ... }` | Broadcast to viewers |
| `operator:updateBackground` | Client→Server | `{ roomId, backgroundImage }` | Change background |
| `background:update` | Server→Client | `{ backgroundImage }` | Broadcast background |

#### Theme Events

| Event | Direction | Data | Purpose |
|-------|-----------|------|---------|
| `operator:applyTheme` | Client→Server | `{ roomId, themeId }` | Apply theme to room |
| `theme:update` | Server→Client | `{ theme }` | Broadcast theme to viewers |

#### YouTube Control Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `operator:youtubeLoad` | Client→Server | Load video |
| `operator:youtubePlay` | Client→Server | Play video |
| `operator:youtubePause` | Client→Server | Pause video |
| `operator:youtubeSeek` | Client→Server | Seek to position |
| `operator:youtubeStop` | Client→Server | Stop video |
| `operator:youtubeSync` | Client→Server | Sync playback state |
| `youtube:load/play/pause/seek/stop/sync` | Server→Client | Broadcast to viewers |
| `viewer:youtubeReady` | Client→Server | Viewer player ready |

#### Local Media Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `operator:localMediaStatus` | Client→Server | Show/hide local media indicator |
| `localMedia:status` | Server→Client | Notify viewers of local media |
| `operator:localVideo` | Client→Server | Broadcast video metadata |
| `localVideo:update` | Server→Client | Video info to viewers |
| `operator:stopLocalVideo` | Client→Server | Stop local video |
| `localVideo:stop` | Server→Client | Clear video from viewers |

#### Connection Health

| Event | Direction | Purpose |
|-------|-----------|---------|
| `ping` | Client→Server | Heartbeat (every 5s) |
| `pong` | Server→Client | Heartbeat response |
| `error` | Server→Client | Error notification |

### In-Memory Caches

```javascript
// Server-side caches for performance
operatorSockets: Map<userId, socketId>     // Track operator connections
viewerRooms: Map<socketId, roomPin>        // Track viewer rooms for disconnect
roomToolsData: Map<roomPin, toolsData>     // Cache tools data for new viewers
roomActiveTheme: Map<roomPin, theme>       // Cache themes for new viewers
```

---

## Core Features

### 1. Song Management

**Capabilities**:
- Create/edit songs with multi-slide support
- Hebrew text with automatic transliteration and translation
- Tag-based organization
- Public/private visibility
- Admin approval workflow
- Usage tracking

**Slide Structure**:
```javascript
{
  originalText: "שלום לכולם",           // Hebrew original
  transliteration: "Shalom lekulam",     // Latin transliteration
  translation: "Peace to everyone",       // English translation
  verseType: "Verse"                     // Optional: Verse, Chorus, Bridge
}
```

### 2. Room-Based Presentation

**Flow**:
1. Operator creates room → gets unique 4-digit PIN
2. Viewers join via PIN or public slug
3. Operator controls what's displayed
4. All viewers see synchronized content
5. Room expires after 2 hours of inactivity

**Capacity**: 500 viewers per room

### 3. Display Modes

| Mode | Description |
|------|-------------|
| `bilingual` | Shows original + transliteration + translation |
| `original` | Shows only original text (with combined slides) |
| `transliteration` | Shows only transliteration |
| `translation` | Shows only translation |

### 4. Theme System

**Viewer Themes**:
- Line order customization (drag-drop)
- Per-line styling (font size, weight, color, opacity, visibility)
- Positioning (top/center/bottom, left/center/right)
- Container styling (max width, padding, background, border radius)
- Background boxes for layered designs
- WYSIWYG positioning editor

**Stage Monitor Themes**:
- Clock display
- Song title area
- Current slide area
- Next slide preview
- Custom color scheme
- Configurable element positions

### 5. Setlist Management

**Item Types**:
- Songs (from library)
- Blank slides
- Images
- Bible verses

**Features**:
- Drag-drop reordering
- Temporary vs permanent setlists
- Share via unique token
- Usage tracking

---

## Special Features

### 1. Local Media / HDMI Display

**Purpose**: Display local videos and images on a connected HDMI display without streaming to online viewers.

**Technology**: Web Presentation API (not WebRTC)

**How It Works**:
1. Operator clicks "Present to Display" to open HDMI viewer
2. Videos/images sent via `presentationConnection.send()` in 512KB chunks
3. HDMI viewer reassembles chunks and plays content
4. Online viewers see "Local media is being displayed" notification

**Key Functions**:
- `sendVideoToDisplay()` - Split video into Base64 chunks
- `sendImageToDisplay()` - Send image to display
- `hideImageFromDisplay()` - Hide current image

### 2. Hebrew Transliteration

**Service**: `transliterationService.js`

**Approach**:
- Dictionary-based transliteration (3,907 words)
- Consonant fallback mapping for unknown words
- Hebrew niqqud (diacritical marks) handling
- Automatic Hebrew detection

**Example**:
```
Input:  "הללויה לאדון"
Output: "Halleluyah l'Adon"
```

### 3. Hebrew Translation

**Service**: `translationService.js`

**Approach**:
1. Local line dictionary (3,037 phrases) - worship context
2. Local word dictionary (132 words)
3. MyMemory API fallback

**Example**:
```
Input:  "שלום"
Output: "peace" (not "hello" - worship context)
```

### 4. Bible Verse Display

**Features**:
- 66 books (OT + NT)
- Hebrew and English text
- Hebrew numeral conversion
- Reference formatting

**API**:
```
GET /api/bible/books                    → List all books
GET /api/bible/verses/:book/:chapter    → Get chapter verses
GET /api/bible/search?q=...             → Search verses
```

### 5. YouTube Integration

**Features**:
- Load videos by URL or ID
- Synchronized playback across all viewers
- Play, pause, seek, stop controls
- Muted autoplay (browser requirement)

### 6. Quick Slide

**Purpose**: Create instant bilingual slides from Hebrew text input.

**API**:
```
POST /api/quick-slide/process
Body: { text: "שלום לכולם" }
Response: {
  original: "שלום לכולם",
  transliteration: "Shalom lekulam",
  translation: "Peace to everyone"
}
```

### 7. Presentation Editor

**Features**:
- Freeform slide creation
- Drag-drop text boxes
- Font and color customization
- Custom canvas dimensions
- Background color/image

### 8. Remote Screens

**Purpose**: Configure kiosk displays (tablets, TVs) without authentication.

**Display Types**:
- `viewer` - Standard viewer
- `stage` - Stage monitor
- `obs` - OBS overlay
- `custom` - Custom configuration

**Access**: `/u/:userId/screen/:screenId` (no auth required)

### 9. SoluFlow Integration

**Purpose**: Map songs between SoluFlow (external database) and SoluPresenter.

**Status**: 367 songs mapped (239 linked, 128 no-match)

**Features**:
- Automatic title matching with confidence scores
- Manual linking interface
- "No match" marking
- Song creation from SoluFlow data

---

## API Reference

### Authentication

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login (returns JWT) |
| POST | `/auth/google` | Google OAuth login |
| GET | `/auth/me` | Get current user |
| POST | `/auth/verify-email` | Verify email |
| POST | `/auth/forgot-password` | Request password reset |
| POST | `/auth/reset-password` | Reset password |
| POST | `/auth/change-password` | Change password |

### Songs

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/songs` | List all accessible songs |
| GET | `/api/songs/search` | Search songs |
| GET | `/api/songs/:id` | Get single song |
| POST | `/api/songs` | Create song |
| PUT | `/api/songs/:id` | Update song |
| DELETE | `/api/songs/:id` | Delete song |
| GET | `/api/songs/tags/all` | Get all tags |

### Rooms

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/rooms/create` | Create/get active room |
| GET | `/api/rooms/:id` | Get room details |
| PUT | `/api/rooms/:id` | Update room |
| DELETE | `/api/rooms/:id` | Close room |
| GET | `/api/rooms/active` | Get operator's active room |
| POST | `/api/rooms/:id/link-setlist` | Link setlist to room |

### Setlists

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/setlists` | List user's setlists |
| GET | `/api/setlists/:id` | Get setlist with items |
| GET | `/api/setlists/shared/:token` | Get shared setlist |
| POST | `/api/setlists` | Create setlist |
| PUT | `/api/setlists/:id` | Update setlist |
| DELETE | `/api/setlists/:id` | Delete setlist |
| POST | `/api/setlists/:id/share` | Generate share token |

### Media

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/media` | List user's media |
| POST | `/api/media/upload` | Upload image |
| POST | `/api/media/upload-gradient` | Create gradient |
| DELETE | `/api/media/:id` | Delete media |
| POST | `/api/media/usage-stats` | Get storage usage |

### Themes

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/viewer-themes` | List themes |
| GET | `/api/viewer-themes/:id` | Get theme |
| POST | `/api/viewer-themes` | Create theme |
| PUT | `/api/viewer-themes/:id` | Update theme |
| DELETE | `/api/viewer-themes/:id` | Delete theme |
| POST | `/api/viewer-themes/:id/duplicate` | Duplicate theme |
| POST | `/api/viewer-themes/:id/set-default` | Set as default |

### Admin (requires admin role)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/pending-songs` | List pending songs |
| POST | `/api/admin/approve-song/:id` | Approve song |
| POST | `/api/admin/reject-song/:id` | Reject song |
| GET | `/api/admin/users` | List all users |
| PUT | `/api/admin/users/:id/role` | Change user role |
| DELETE | `/api/admin/users/:id` | Delete user |

---

## Deployment

### Production Deployment

**DO NOT** deploy to Elastic Beanstalk. This project uses automatic deployment from GitHub to Render.com.

**To Deploy**:
```bash
git add .
git commit -m "Your commit message"
git push origin main
```

Render.com automatically picks up changes from GitHub and deploys.

### Environment Variables

```env
# Server
NODE_ENV=production
PORT=5000

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Authentication
JWT_SECRET=your-jwt-secret
SESSION_SECRET=your-session-secret

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=https://your-domain/auth/google/callback

# Email (Resend)
RESEND_API_KEY=your-resend-key
EMAIL_FROM=noreply@your-domain.com

# Frontend URL
FRONTEND_URL=https://your-frontend-domain.com
```

### Health Check

```
GET /health → { status: 'ok', timestamp: '...' }
```

---

## Performance Considerations

1. **Socket.IO Optimization**:
   - WebSocket-primary with polling fallback
   - Compression disabled for faster small messages
   - Theme and tools data cached in memory

2. **Database**:
   - Strategic indexes on foreign keys and common queries
   - Connection pooling (max 10 connections)
   - Asynchronous saves for slide updates

3. **Image Processing**:
   - Sharp library for compression
   - Max 1920x1080 resolution
   - WebP format at 80% quality
   - Storage limits per user

4. **Frontend**:
   - Lazy loading of all pages
   - React.memo for expensive renders
   - Virtual lists for large song libraries

---

## Security

1. **Authentication**:
   - JWT tokens with 30-day expiry
   - bcrypt password hashing (10 rounds)
   - Email verification required
   - Rate limiting on login/register

2. **Authorization**:
   - Role-based access (operator/admin)
   - Resource ownership checks
   - Admin-only routes protected

3. **Data Protection**:
   - Helmet.js security headers
   - CORS restricted to allowed origins
   - Input validation and sanitization
   - SQL injection protection via Sequelize

---

## Conclusion

SoluPresenter is a full-featured, production-ready worship presentation platform combining:
- Real-time synchronization via Socket.IO
- Bilingual Hebrew-English support
- Multiple display types (viewer, stage, OBS, remote)
- Comprehensive theming system
- HDMI/local media support
- Extensible architecture

The modular design allows for easy maintenance and feature additions while maintaining performance for real-time presentation needs.

---

*Document generated: December 2025*
*Version: 1.0*
