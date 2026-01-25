# Desktop App Feature Roadmap

## Current State

The desktop app (SoluCast Desktop) is a lightweight presenter/operator interface focused on real-time control during presentations. The web app is a full-featured content management system.

**Desktop App Pages:** 3 (ControlPanel, DisplayViewer, DisplayStage)
**Web App Pages:** 28

---

## Missing Features (Web App → Desktop)

### Priority 1: High Impact, Reasonable Effort

#### 1. Theme Editor
**What it does:** Visual theme designer with draggable elements for customizing viewer and stage monitor displays.

**Web app location:** `frontend/src/pages/Themes.tsx`

**Features to port:**
- Line styles (font size, color, opacity, weight)
- Text positioning (vertical/horizontal alignment)
- Background settings (color, gradient, image)
- Resolution selector for different displays
- Live preview canvas

**Effort:** Medium
**Impact:** High - Currently no way to customize themes in desktop

---

#### 2. Media Library
**What it does:** Upload, organize, and manage background images and videos.

**Web app location:** `frontend/src/pages/MediaLibrary.tsx`

**Features to port:**
- Image/video upload
- Gradient presets
- Media browser with thumbnails
- Delete/organize media

**Effort:** Medium
**Impact:** High - Desktop has "Add Media Folder" button but no full library UI

---

#### 3. Settings Page
**What it does:** User preferences and configuration.

**Web app location:** `frontend/src/pages/Settings.tsx`

**Features to port:**
- Language preferences
- Public room management
- Default display mode
- Connection settings

**Effort:** Low
**Impact:** Medium - Improves user experience

---

### Priority 2: Medium Impact

#### 4. Song Management (Full CRUD)
**What it does:** Dedicated pages for browsing, creating, editing, and deleting songs.

**Web app locations:**
- `frontend/src/pages/SongList.tsx`
- `frontend/src/pages/SongCreate.tsx`
- `frontend/src/pages/SongEdit.tsx`

**Features to port:**
- Search/filter by language, tags, author
- Bulk import from CSV
- Full song editor (not just modal)
- Personal copy management

**Effort:** Medium-High
**Impact:** Medium - Desktop already has inline song editing in ControlPanel

---

#### 5. Setlist Management (Full CRUD)
**What it does:** Dedicated pages for creating and managing setlists with scheduling.

**Web app locations:**
- `frontend/src/pages/SetlistList.tsx`
- `frontend/src/pages/SetlistCreate.tsx`
- `frontend/src/pages/SetlistEdit.tsx`

**Features to port:**
- Browse all saved setlists
- Date/time/venue scheduling
- Setlist templates
- Share setlists

**Effort:** Medium
**Impact:** Medium - Desktop has inline setlist in ControlPanel

---

### Priority 3: Lower Priority / Advanced

#### 6. Presentation Editor
**What it does:** Create custom slide presentations with text boxes, images, positioning.

**Web app locations:**
- `frontend/src/pages/PresentationCreate.tsx`
- `frontend/src/components/PresentationEditor.tsx`

**Features:**
- Canvas-based slide designer
- Text boxes with formatting
- Background images
- Slide thumbnails

**Effort:** High
**Impact:** Medium - Adds new capability but songs/setlists cover most use cases

---

#### 7. Remote Screens / Kiosk Management
**What it does:** Create and manage remote display URLs for kiosk deployment.

**Web app location:** `frontend/src/pages/RemoteScreens.tsx`

**Features:**
- Create up to 5 remote screen URLs
- Configure auto-connect displays
- Per-screen theme selection

**Effort:** Medium
**Impact:** Low for desktop (desktop IS the local presenter)

---

#### 8. OBS Overlay Mode
**What it does:** Transparent overlay optimized for OBS streaming.

**Web app location:** `frontend/src/pages/OBSOverlay.tsx`

**Features:**
- Transparent background
- Fade in/out animations
- Minimal chrome

**Effort:** Low
**Impact:** Medium for streamers

---

#### 9. Admin Panel
**What it does:** Song approval workflow, user management.

**Web app location:** `frontend/src/pages/Admin.tsx`

**Effort:** Medium
**Impact:** Low for most users (admin-only)

---

## Recommended Implementation Order

### Phase 1: Quick Wins
1. **Settings Page** - Low effort, improves UX
2. **OBS Overlay mode** - Low effort, valuable for streamers

### Phase 2: Core Enhancements
3. **Theme Editor** - High impact, unlocks customization
4. **Media Library** - Enables background images/videos

### Phase 3: Full Management
5. **Song Management pages** - Full CRUD outside ControlPanel
6. **Setlist Management pages** - Full CRUD with scheduling

### Phase 4: Advanced
7. **Presentation Editor** - New capability
8. **Remote Screens** - Kiosk management

---

## Technical Considerations

### Shared Code Opportunities
Many web app components can be adapted for desktop:
- `frontend/src/components/ThemeCanvas.tsx` → Reusable for theme editor
- `frontend/src/components/ConnectionStatus.tsx` → Already similar in desktop
- `frontend/src/services/` → API services can be adapted

### Desktop-Specific Considerations
- Desktop uses Electron IPC instead of direct API calls
- Desktop has local SQLite database for offline capability
- Desktop manages physical display windows (viewer, stage)
- Desktop has ML translation model running locally

### State Management
- Web app: React Context + localStorage
- Desktop app: React state + Electron IPC + SQLite

---

## Session Notes

### Performance Optimizations Applied (This Session)
1. Clock interval only runs when clock/stopwatch is active
2. Viewer capture changed from 500ms interval to on-demand (with 150ms delay)
3. Memoized callbacks: selectSong, selectSlide, goToSlide, nextSlide, prevSlide, etc.
4. Created memoized SongItem component for song list
5. Memoized loadSongs, addToSetlist, startEditingSong, deleteSongById

### Bug Fixes Applied (This Session)
1. Bilingual/Original toggle now works for viewer page
2. Bilingual/Original toggle now works for Live Preview
3. Live Preview shows combined slides in Original mode
4. Song editor defaults to Express mode
5. Song editor dialog is larger (1000px × 85vh)

---

## How to Continue

To add a feature from the web app to desktop:

1. **Study the web implementation:**
   ```
   frontend/src/pages/[FeatureName].tsx
   frontend/src/components/[RelatedComponents].tsx
   ```

2. **Create desktop equivalent:**
   ```
   desktop/src/renderer/pages/[FeatureName].tsx
   desktop/src/renderer/components/[RelatedComponents].tsx
   ```

3. **Add IPC handlers if needed:**
   ```
   desktop/src/main/ipc/index.ts
   desktop/src/preload/control.ts
   ```

4. **Add navigation** in ControlPanel or create new routing

5. **Test thoroughly** - Desktop has different constraints (offline mode, display windows, etc.)

---

## Files Modified This Session

- `desktop/src/renderer/pages/ControlPanel.tsx` - Performance optimizations, bug fixes, song editor improvements
- `desktop/src/renderer/pages/DisplayViewer.tsx` - (referenced for display mode fixes)

---

*Last updated: December 30, 2025*
