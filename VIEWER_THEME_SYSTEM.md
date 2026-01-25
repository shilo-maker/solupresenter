# Viewer Theme System - Complete Documentation

## Overview
A comprehensive theme system allowing presenters to customize how slides appear on viewer screens, with live broadcast capabilities. Themes control text styling, line ordering, positioning, and backgrounds.

## Status: FULLY IMPLEMENTED

---

## Architecture & Design

### Core Concept
Themes are **per-user** (each user can create multiple themes). When an operator selects a theme in PresenterMode, it broadcasts to all connected viewers in real-time via Socket.IO.

### Hybrid Viewer Control
- **Operator-controlled** (viewers cannot override): Line order, line colors, positioning, container styling, font sizes
- **Viewer-controlled** (can override locally): Visibility toggles (showOriginal, showTransliteration, showTranslation), local font size multiplier

### Data Flow
```
1. Operator selects theme in ThemeSelector dropdown
2. Client emits `operator:applyTheme` with { roomId, themeId }
3. Server stores in `roomActiveTheme` Map (in-memory for speed)
4. Server broadcasts `theme:update` to all viewers in room
5. Viewers receive theme and apply styles immediately
6. New viewers get theme in `viewer:joined` response
```

---

## Theme Data Structure

```javascript
{
  id: UUID,
  name: string,
  createdById: UUID | null,  // null for built-in themes
  isBuiltIn: boolean,        // true for "Classic" theme

  // Line rendering order (drag-drop reorderable)
  lineOrder: ['original', 'transliteration', 'translation'],

  // Per-line styling
  lineStyles: {
    original: {
      fontSize: 100,        // percentage (100 = base size)
      fontWeight: '500',    // CSS font-weight
      color: '#FFFFFF',     // hex color
      opacity: 1,           // 0-1
      visible: true         // can hide line entirely
    },
    transliteration: { fontSize: 90, fontWeight: '400', color: '#FFFFFF', opacity: 0.95, visible: true },
    translation: { fontSize: 90, fontWeight: '400', color: '#FFFFFF', opacity: 0.95, visible: true }
  },

  // Text positioning within viewport
  positioning: {
    vertical: 'center',     // 'top' | 'center' | 'bottom'
    horizontal: 'center'    // 'left' | 'center' | 'right'
  },

  // Text container styling
  container: {
    maxWidth: '100%',
    padding: '2vh 6vw',
    backgroundColor: 'transparent',  // can add semi-transparent bg behind text
    borderRadius: '0px'
  },

  // Viewer page background
  viewerBackground: {
    type: 'inherit',  // 'inherit' | 'color' | 'transparent'
    color: null       // hex color when type='color'
  }
}
```

---

## Backend Implementation

### Model: `backend/models/ViewerTheme.js`
- Sequelize model with UUID primary key
- JSON fields for complex nested data (lineOrder, lineStyles, positioning, container, viewerBackground)
- `CLASSIC_THEME_ID` constant: `'00000000-0000-0000-0000-000000000001'`
- `seedClassicTheme()` static method for initial setup

### Routes: `backend/routes/viewerThemes.js`
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/viewer-themes` | List all themes (built-in + user's) |
| GET | `/api/viewer-themes/:id` | Get single theme |
| POST | `/api/viewer-themes` | Create theme |
| PUT | `/api/viewer-themes/:id` | Update theme |
| DELETE | `/api/viewer-themes/:id` | Delete theme (not built-in) |
| POST | `/api/viewer-themes/:id/duplicate` | Duplicate theme |

### Socket Events in `backend/server.js`
- `roomActiveTheme` Map stores active theme per room PIN (in-memory)
- `operator:applyTheme` handler: Validates room, fetches theme, stores in Map, broadcasts
- Theme included in `viewer:joined` response for new viewers

---

## Frontend Implementation

### Theme Editor: `frontend/src/pages/Themes.js`
- Full-page editor at `/themes` route
- Three tabs: **Lines** (drag-drop reorder), **Styling** (per-line controls), **Position**
- Uses `@hello-pangea/dnd` for drag-and-drop
- Accessible from Dashboard via "Viewer Themes" card

### Theme Selector: `frontend/src/components/ThemeSelector.js`
- Dropdown in PresenterMode toolbar
- Shows all available themes with active indicator
- "Clear Theme" option to remove theme
- "Manage Themes..." navigates to /themes

### Viewer Rendering: `frontend/src/pages/ViewerPage.js`
Key helper functions:
- `getThemeLineStyle(lineType)` - Returns { fontSize, fontWeight, color, opacity } for a line
- `isLineVisible(lineType)` - Checks theme visibility setting for a line
- `getThemePositioningStyle()` - Returns flexbox alignment styles
- `getThemeContainerStyle()` - Returns container padding, background, border-radius
- `getViewerBackgroundStyle()` - Returns page background based on theme settings

Bilingual mode rendering iterates over `viewerTheme.lineOrder` array to render lines in theme-specified order, applying per-line styles.

### API Service: `frontend/src/services/api.js`
```javascript
export const themeAPI = {
  getAll: () => api.get('/api/viewer-themes'),
  getById: (id) => api.get(`/api/viewer-themes/${id}`),
  create: (themeData) => api.post('/api/viewer-themes', themeData),
  update: (id, themeData) => api.put(`/api/viewer-themes/${id}`, themeData),
  delete: (id) => api.delete(`/api/viewer-themes/${id}`),
  duplicate: (id, name) => api.post(`/api/viewer-themes/${id}/duplicate`, { name })
};
```

### Socket Service: `frontend/src/services/socket.js`
- `operatorApplyTheme(roomId, themeId)` - Emit theme selection
- `onThemeUpdate(callback)` - Listen for theme broadcasts

---

## Files Reference

### Backend
| File | Purpose |
|------|---------|
| `backend/models/ViewerTheme.js` | Theme model with Classic seeding |
| `backend/models/index.js` | Model registration, User-ViewerTheme relationship |
| `backend/models/Room.js` | Added `activeThemeId` field |
| `backend/routes/viewerThemes.js` | REST API endpoints |
| `backend/server.js` | Socket handlers, route registration, theme seeding |

### Frontend
| File | Purpose |
|------|---------|
| `frontend/src/pages/Themes.js` | Theme editor page |
| `frontend/src/components/ThemeSelector.js` | Toolbar dropdown |
| `frontend/src/pages/ViewerPage.js` | Theme-aware slide rendering |
| `frontend/src/pages/PresenterMode.js` | ThemeSelector integration |
| `frontend/src/pages/Dashboard.js` | "Viewer Themes" card |
| `frontend/src/App.js` | `/themes` route |
| `frontend/src/services/api.js` | `themeAPI` endpoints |
| `frontend/src/services/socket.js` | Theme socket methods |
| `frontend/src/locales/en.json` | English translations |
| `frontend/src/locales/he.json` | Hebrew translations |

---

## Socket Events

| Event | Direction | Payload | Purpose |
|-------|-----------|---------|---------|
| `operator:applyTheme` | Client -> Server | `{ roomId, themeId }` | Operator selects theme |
| `theme:update` | Server -> Clients | `{ theme: ThemeObject }` | Broadcast to all viewers |

---

## Test Status

- Backend: 59/59 tests passing
- Frontend: 97/97 tests passing

---

## Dependencies

- `@hello-pangea/dnd` - React 18/19 compatible drag-and-drop (for theme editor line reordering)

---

## Future Enhancements (Optional)

1. **Live Preview** - Show sample text in theme editor with styles applied
2. **Theme Import/Export** - JSON export/import for backup and sharing
3. **Theme Sharing** - Share themes between users
4. **Default Theme Preference** - User setting for default theme per room
