# Development Roadmap - SoluPresenter

## High Priority (Must Have - Core Functionality)

### 1. Song Library Management
- [x] Bulk import songs from .txt files (fully functional)
- [x] Song search and filtering (by query, tags, language)
- [x] Song categories/tags organization
- [x] Edit existing songs (with express mode and standard mode)
- [x] Delete songs
- [x] Song approval workflow for admin (backend complete, needs testing)

### 2. Admin Panel Enhancements
- [x] Create admin account functionality (via backend script)
- [x] User management dashboard (fully functional)
- [x] View all users and their roles
- [x] Promote users to admin
- [x] Delete/suspend users
- [x] View pending songs for approval

### 3. Display Mode Improvements
- [ ] Test and fix all display modes (Hebrew, English, Bilingual, Chords)
- [x] Add font size controls for viewer (with +/- buttons and reset)
- [x] Add text color/contrast controls (6 preset colors + custom color picker)
- [x] Add verse type labels to viewer (Verse1, Chorus, Bridge, etc.)
- [x] Add text shadow for better readability on any background
- [x] Ensure Hebrew text displays right-to-left correctly (auto-detect with Unicode bidi)
- [ ] Test chord display formatting

### 4. Real-time Synchronization Fixes
- [ ] Test viewer sync across multiple devices
- [ ] Fix any lag or delay issues
- [ ] Ensure background changes sync properly
- [ ] Test with 10+ viewers simultaneously
- [x] Add connection status indicator (component created, needs integration)

### 5. Background Management
- [x] Background image support (URL-based)
- [ ] Upload custom background images (file upload)
- [ ] Background library/gallery
- [ ] Preview backgrounds before applying
- [ ] Delete uploaded backgrounds
- [ ] Set default background for room

---

## Medium Priority (Should Have - Enhanced Features)

### 1. Setlist Management Improvements
- [ ] Reorder songs in setlist (drag and drop)
- [ ] Duplicate setlists
- [ ] Export setlist to PDF/print
- [ ] Share setlist via link (view-only)
- [ ] Setlist templates (e.g., "Shabbat Morning")
- [ ] Search within setlist

### 2. Presentation Controls
- [x] Keyboard shortcuts for slide navigation (Arrow keys, Space/B for blank)
- [x] Blank screen toggle (hotkey)
- [x] Keyboard shortcuts help modal (? button)
- [ ] Auto-advance slides (timer)
- [ ] Quick jump to specific slide number
- [ ] Preview next slide for operator
- [ ] Slide transition animations

### 3. Room Management
- [ ] Room settings (name, description)
- [ ] Room history (track usage)
- [ ] Multiple rooms per user
- [ ] Schedule rooms in advance
- [ ] Room templates with preset backgrounds/settings
- [ ] Viewer limit configuration

### 4. User Experience
- [ ] Remember last used setlist
- [ ] Recently used songs quick access
- [ ] Favorite songs feature
- [ ] Song usage statistics
- [ ] Quick search from anywhere (global search)
- [ ] Undo/redo for slide changes

### 5. Mobile Optimization
- [ ] Responsive design for tablets
- [ ] Touch controls for operator on iPad
- [ ] Mobile viewer optimizations
- [ ] PWA (Progressive Web App) support
- [ ] Offline mode for viewer

### 6. Media Support
- [ ] Upload images for individual slides
- [ ] Video backgrounds
- [ ] Audio playback for songs
- [ ] Image gallery per song
- [ ] Slide-specific backgrounds

---

## Low Priority (Nice to Have - Future Enhancements)

### 1. Advanced Song Features
- [ ] Transpose chords to different keys
- [ ] Chord diagram display
- [ ] Multiple versions of same song
- [ ] Song arrangements (verse order)
- [ ] Print individual songs
- [ ] Song notes/annotations

### 2. Collaboration Features
- [ ] Multiple operators per room
- [ ] Permission levels (operator, assistant)
- [ ] Chat between operator and viewers
- [ ] Viewer song requests
- [ ] Collaborative setlist editing

### 3. Themes and Customization
- [ ] Custom color themes for viewer
- [ ] Font selection (multiple Hebrew fonts)
- [ ] Layout templates (centered, left-aligned, etc.)
- [ ] Custom CSS for advanced users
- [ ] Branding (logo, organization name)

### 4. Analytics and Reporting
- [ ] Usage statistics dashboard
- [ ] Most popular songs
- [ ] Room attendance tracking
- [ ] Export usage reports
- [ ] Song performance metrics

### 5. Integration Features
- [ ] Import from popular worship software
- [ ] Export to PowerPoint
- [ ] Import from SongSelect/CCLI
- [ ] Embed viewer in external websites
- [ ] API for third-party integrations

### 6. Accessibility
- [ ] Screen reader support
- [ ] High contrast mode
- [ ] Font size presets (small, medium, large, extra large)
- [ ] Dyslexia-friendly fonts
- [ ] Color blind friendly palette options

### 7. Advanced Admin Features
- [ ] Backup/restore database
- [ ] Export all songs to file
- [ ] System health monitoring
- [ ] Error logging dashboard
- [ ] Email notifications for system events

### 8. Community Features
- [ ] Public song library (opt-in sharing)
- [ ] Rate and review songs
- [ ] User comments on songs
- [ ] Featured setlists from community
- [ ] Song recommendations

---

## Current Status

✅ **Completed:**
- User authentication (register/login)
- Room creation and PIN-based joining
- Real-time slide synchronization
- Basic display modes (Hebrew, English, Bilingual, Chords)
- Background image management
- Setlist creation and management
- Song library (CRUD operations)
- Admin role system
- Viewer page with real-time updates
- Operator control panel
- WebSocket communication
- Mobile-responsive viewer
- Deployed to AWS (production-ready)

🚧 **In Progress:**
- None currently

📋 **Next Up (Highest Priority):**
1. Test all display modes (Hebrew RTL, English, Bilingual, Chords)
2. Test Hebrew text rendering and ensure RTL is working
3. Test chord display formatting
4. Test multi-viewer synchronization
5. Add keyboard shortcuts for operator (arrow keys, blank screen toggle)

---

## Technical Debt / Bug Fixes

### High Priority Bugs
- [ ] Test all display modes thoroughly
- [ ] Verify Hebrew text rendering (RTL)
- [ ] Check chord formatting
- [ ] Test with multiple simultaneous viewers
- [ ] Verify WebSocket reconnection logic

### Code Quality
- [ ] Add error boundaries to React components
- [ ] Improve loading states across the app
- [ ] Add proper TypeScript types (if migrating)
- [ ] Write unit tests for critical functions
- [ ] Add integration tests for key workflows

### Performance
- [ ] Optimize image loading
- [ ] Reduce bundle size
- [ ] Implement code splitting
- [ ] Add caching strategies
- [ ] Optimize database queries

### Security
- [ ] Add rate limiting to API endpoints
- [ ] Implement CSRF protection
- [ ] Add input sanitization
- [ ] Audit dependencies for vulnerabilities
- [ ] Add request validation

---

## Notes

- **High Priority** items are essential for the app to be production-ready and user-friendly
- **Medium Priority** items significantly enhance user experience
- **Low Priority** items are nice-to-have features for future versions

This roadmap should be reviewed and updated regularly based on user feedback and business needs.
