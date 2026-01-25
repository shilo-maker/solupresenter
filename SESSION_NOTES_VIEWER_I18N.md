# Session Notes: Viewer Page i18n RTL Fix

## Date: 2025-12-22

## What Was Done This Session

### 1. Default Hebrew for Guests
- Modified `frontend/src/i18n.js` to set default language to Hebrew (`lng: 'he'`)
- Changed fallback language to Hebrew (`fallbackLng: 'he'`)
- Set detection to only check localStorage (ignore browser language)

### 2. Language Toggle Button on Viewer Page
- Added a language toggle button in the top-left corner of the join screen
- Button shows "English" when in Hebrew mode, "עברית" when in English mode
- Location: `frontend/src/pages/ViewerPage.js` around line 655-670

### 3. Translated Tagline
- Changed hardcoded "WORSHIP AS ONE" to use `{t('viewer.tagline')}`
- Added translation keys:
  - `en.json`: `"tagline": "WORSHIP AS ONE"`
  - `he.json`: `"tagline": "מהללים כאחד"`

### 4. Removed "Search Room Name" Header
- Removed the h3 element containing `{t('viewer.searchRoomName')}`

### 5. RTL Toggle Switch Order (IN PROGRESS - HAS BUG)
- Added `flexDirection: isRTL ? 'row-reverse' : 'row'` to switch שם/קוד order in Hebrew
- Added `isRTL` variable at top of component: `const isRTL = i18n?.language === 'he';`
- Updated toggle circle position for RTL mode

## CURRENT BUG
**White screen when clicking the toggle to switch between name/code mode in Hebrew**
- Works fine in English mode
- Crashes (white screen) in Hebrew mode when clicking the toggle
- Build compiles successfully with no errors
- Issue is a runtime error that only occurs in Hebrew mode

## Files Modified
1. `frontend/src/i18n.js` - Default Hebrew, localStorage only
2. `frontend/src/pages/ViewerPage.js` - Language toggle, RTL support
3. `frontend/src/locales/en.json` - Added viewer.tagline
4. `frontend/src/locales/he.json` - Added viewer.tagline with "מהללים כאחד"

## Key Code Changes in ViewerPage.js

### Added isRTL variable (line ~15):
```javascript
const isRTL = i18n?.language === 'he';
```

### Toggle container (line ~735-745):
```javascript
<div
  onClick={() => setJoinMode(joinMode === 'name' ? 'pin' : 'name')}
  style={{
    display: 'flex',
    flexDirection: isRTL ? 'row-reverse' : 'row',
    // ... rest of styles
  }}
>
```

### Toggle circle position (line ~775-777):
```javascript
left: isRTL
  ? (joinMode === 'name' ? '2px' : '22px')
  : (joinMode === 'name' ? '22px' : '2px'),
```

## Next Steps
1. Debug the white screen issue in Hebrew mode
2. Check browser console for the actual runtime error
3. May need to simplify or remove the RTL toggle switch logic temporarily
