# SoluFlow Integration - Session Notes

## Overview

This document summarizes the work done on SoluFlow integration for mapping songs between SoluFlow (external song database) and SoluPresenter (this application).

---

## What We Were Trying To Do

### Main Goals
1. **Map SoluFlow songs to SoluPresenter songs** - Create a mapping system to link songs from SoluFlow's PostgreSQL database to songs in SoluPresenter
2. **Handle "No Match" songs** - Allow admins to mark songs that don't exist in SoluPresenter, and easily create them when needed
3. **Auto-link new songs** - When creating a song from the "No Match" list, automatically update the mapping

---

## What Was Accomplished

### 1. Marked All Unmatched Songs as "No Match"
- Created script `backend/scripts/mark-all-unmatched-no-match.js`
- Marked 128 SoluFlow songs that had no match in SoluPresenter

### 2. Made "No Match" Card Clickable
- Updated `frontend/src/pages/Admin.js`
- Clicking "No Match" stat card now opens a modal listing all songs marked as no match
- Each song has a "Create in SoluCast" button

### 3. Pre-fill Song Data from SoluFlow
- Added backend endpoint `GET /api/soluflow/songs/:id` to fetch a SoluFlow song with lyrics (chords stripped)
- When clicking "Create in SoluCast", the title and lyrics are pre-filled in the express editor
- Lyrics are passed via `sessionStorage` (URL params have length limits)

### 4. Admin-Created Songs are Automatically Public
- Modified `backend/routes/songs.js` POST endpoint
- When an admin creates a song, it's automatically set as public with approval fields filled

### 5. Added Visibility Options to Song Edit Page
- Modified `frontend/src/pages/SongEdit.js`
- Added "Visibility" card in sidebar for private songs
- Admins see a toggle to make songs public
- Non-admins see a checkbox to submit for approval
- Updated backend PUT endpoint to handle `isPublic` and `isPendingApproval` fields

### 6. Auto-Link Songs Created from "No Match" List
- Updated `frontend/src/pages/Admin.js` to pass `soluflowId` in URL when navigating to create page
- Updated `frontend/src/pages/SongCreate.js` to:
  - Read `soluflowId` from URL params
  - After saving, call `soluflowAPI.createMapping()` to link the new song
- Updated backend `POST /api/soluflow/mappings` to:
  - Accept both old and new parameter formats
  - Update existing "no_match" entries instead of failing

### 7. Manually Linked "הוא מלך המלכים"
- Created the song in SoluPresenter (ID: `fcf50a3e-c6c5-4394-a5f3-442fc2f61239`)
- Updated the mapping in the production `song_mappings` table to link it

---

## Current State

### Database Configuration
- **Backend uses PostgreSQL** (production) via `DATABASE_URL` in `.env`
- **SongMappings table**: `song_mappings` (lowercase with underscore)
- **Production database**: `postgresql://solupresenter:...@dpg-d48d283uibrs73968v2g-a.frankfurt-postgres.render.com/solupresenter`

### Current Counts (Production)
- **Total SoluFlow songs**: 367
- **Linked**: 241
- **No Match**: 126

### Important Note About Local vs Production
- The backend `.env` has `DATABASE_URL` set to production PostgreSQL
- When running locally, the backend connects to **production** database
- Scripts that use `require('./models')` may use SQLite if `DATABASE_URL` detection differs
- Always verify which database you're querying!

---

## Files Modified

### Backend
- `backend/routes/songs.js` - Admin auto-public, visibility update handling
- `backend/routes/soluflow.js` - Added `/songs/:id` endpoint, enhanced `/mappings` POST
- `backend/scripts/mark-all-unmatched-no-match.js` - New script (bulk mark no-match)

### Frontend
- `frontend/src/pages/Admin.js` - No Match modal, Create in SoluCast button
- `frontend/src/pages/SongCreate.js` - Pre-fill from SoluFlow, auto-link after save
- `frontend/src/pages/SongEdit.js` - Visibility card for making songs public
- `frontend/src/services/api.js` - Added `getSong()` to soluflowAPI

---

## Where to Pick Up

### Immediate Next Steps
1. **Test the auto-link flow**: Create another song from the "No Match" list and verify:
   - Song is created with pre-filled data
   - Mapping is automatically updated (no longer appears in No Match)
   - Stats update correctly (Linked +1, No Match -1)

2. **Sync local and production**: The local SQLite database has different data than production PostgreSQL. Consider:
   - Always using production for development, OR
   - Creating a sync script to keep them aligned

### Known Issues to Address
1. **Table name inconsistency**: The model uses `song_mappings` but some manual scripts used `SongMappings` - be careful when writing queries

2. **Database detection**: Scripts may default to SQLite even when you expect PostgreSQL. Always check the "Using SQLite/PostgreSQL" message.

### Future Enhancements
1. **Bulk operations**: Add ability to bulk-link or bulk-create songs
2. **Search in No Match modal**: Add search/filter for the No Match list
3. **Progress tracking**: Show which songs were recently linked

---

## Quick Reference

### To run backend locally (connects to production PostgreSQL):
```bash
cd backend
node server.js
```

### To query production song_mappings:
```javascript
require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');
const db = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
});
const SongMapping = db.define('SongMapping', {
  // ... fields
}, { tableName: 'song_mappings', timestamps: true });
```

### Key IDs
- SoluFlow song "הוא מלך המלכים": ID `136`
- SoluPresenter song "הוא מלך המלכים": ID `fcf50a3e-c6c5-4394-a5f3-442fc2f61239`

---

*Last updated: December 2024*
