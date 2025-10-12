# SoluCast Web App - Product Specification

## Overview
A free, web-based church projection application designed primarily for mobile devices, allowing operators to control presentations that viewers can access through virtual rooms in real-time.

## Problem Statement
Existing solutions like ProPresenter are:
- Expensive
- Require installation
- Output to specific screens only
- Primarily PC-focused

This app provides a modern, accessible alternative that's free, web-based, mobile-first, and uses a virtual room approach for display output.

---

## Core Concepts

### User Roles
1. **Viewer** (No account required)
   - Access virtual rooms using a PIN
   - View presentation output in real-time
   - No control capabilities

2. **Operator** (Account required)
   - Create and manage presentations
   - Control slides in real-time
   - Create and manage setlists
   - One active room per operator
   - Automatically generated unique room PIN

3. **Admin** (Single super admin)
   - Approve songs for public database
   - Full access to public song database
   - Manage user submissions

### Virtual Room System
- **One active room per operator** at a time
- **Automatically generated unique PIN** for each room
- **Up to 500 viewers** per room
- **Room expiration**: Rooms expire after 2 hours of inactivity
- **Real-time synchronization**: All viewers see slides controlled by the operator instantly
- **Access**: Anyone with the PIN can join as a viewer

---

## Features

### 1. Authentication & User Management
- **Registration options**:
  - Standard email/password registration
  - Google OAuth
- **User accounts include**:
  - Personal song database
  - Personal preferences
  - Saved setlists
  - Usage history

### 2. Song Database Architecture

#### Public Database
- Songs added by the admin are automatically public
- Songs submitted by users require admin approval
- All operators can access public songs
- Editing a public song creates a personal copy

#### Personal Database
- Each user has their own private song collection
- Users can create songs for personal use
- Users can submit songs for public approval (admin notification sent)
- Personal songs remain private unless approved for public use

### 3. Slide Structure & Display

#### Slide Layout (4-line maximum)
1. **Line 1**: Original language text
2. **Line 2**: Transliteration
3. **Line 3**: Translation
4. **Line 4**: Overflow for translation (if needed)

#### Display Modes
- **Original language only**: Shows only line 1
- **Bilingual mode**: Shows all 4 lines

#### Visual Specifications
- **Color scheme**: Black background, white text
- **Text sizing**: Automatic font size adjustment to maximize screen width without line wrapping or overflow
- **Aspect ratio**: Optimized for 16:9 (projector standard)
- **Responsive**: Works on mobile and desktop

#### Language Support
- **Primary support**: Hebrew
- Full RTL (right-to-left) text support
- Multi-language capability for translations

### 4. Presentation Creation & Management

#### Creating a Song/Presentation
- **Input options**:
  - Original language only (line by line)
  - Original language + transliteration + translation
  - Can add transliteration/translation later to existing songs
- **Language selection**:
  - Each presentation must specify the original language (dropdown selection)
  - Supports Hebrew, English, and other languages
  - Helps with proper RTL/LTR text rendering
  - Enables language-based filtering and search
- **Tagging system**:
  - Add tags during creation
  - Auto-suggest existing tags as user types
  - Create new tags if they don't exist
  - Multiple tags per song
- **Personal copy creation**: Editing a public song automatically creates a personal copy

#### Song Management Features
- **Search & Filter**:
  - Priority 1: Title match
  - Priority 2: Text content match
  - Priority 3: Other attributes (tags, usage, etc.)
- **Usage Tracking**: 
  - Track how many times a song appears in setlists
  - All-time usage count
  - Visible to operators for popular song identification

### 5. Operator Control Interface

#### Song Selection Methods
1. **Spontaneous selection**: Click on any song to open and control
2. **Search database**: Find songs using search functionality
3. **Setlist-based**: Pre-arrange songs in a setlist

#### Slide Control
- Navigate through slides of selected song
- Choose which slide displays on output screen
- Switch between original language only / bilingual mode
- Insert blank/black slides between songs

#### Real-time Control
- Changes appear instantly on all viewer screens
- No delay in slide transitions
- Smooth navigation between slides

### 6. Setlist Functionality

#### Creating Setlists
- Search and add songs from database
- Arrange songs in desired order
- Save and name setlists
- Add blank slides between songs

#### Managing Setlists
- **Edit while presenting**: Add, remove, or reorder songs during live presentation
- **Save for future use**: Named setlists stored in user account
- **Share setlists**: Generate shareable link containing setlist data
  - Link includes all setlist information
  - Recipients can import/use the setlist

#### Setlist Tracking
- Songs in setlists count toward usage statistics
- Track which setlists are most frequently used

---

## Technical Specifications

### Technology Stack
- **Frontend**: React, Bootstrap, JavaScript
- **Backend**: Node.js
- **Database**: MongoDB
- **Real-time Communication**: Socket.IO (for instant slide synchronization between operator and viewers)
- **Authentication**: Custom + Google OAuth

### Design Principles
- **Mobile-first**: Primary focus on mobile UX
- **Responsive**: Full functionality on desktop as well
- **Progressive Web App**: Works like a native app without installation
- **Real-time**: Socket.IO for instant synchronization between operator and all viewers

### Performance Requirements
- Support up to 500 concurrent viewers per room
- Real-time slide updates with minimal latency (<200ms)
- Responsive interface on mobile devices
- Optimized for Hebrew text rendering and RTL layouts

---

## User Flows

### Viewer Flow
1. Visit web app
2. Select "Viewer" mode
3. Enter room PIN
4. View presentation in real-time
5. Automatic updates as operator changes slides

### Operator Flow - Quick Presentation
1. Sign in
2. Room automatically created with unique PIN
3. Share PIN with viewers
4. Select song from database
5. Control slides during presentation
6. Choose display mode (original/bilingual)

### Operator Flow - Planned Service
1. Sign in
2. Create new setlist
3. Search and add songs
4. Arrange order
5. Save setlist with name
6. During service: Open setlist
7. Room created automatically
8. Share PIN with viewers
9. Navigate through setlist
10. Edit setlist on-the-fly if needed

### Song Creation Flow
1. Navigate to "Create New Song"
2. Enter song title
3. Select original language from dropdown
4. Input lyrics (line by line):
   - Original language (required)
   - Transliteration (optional)
   - Translation (optional)
5. Add tags (auto-suggest existing)
6. Choose to keep private or submit for public approval
7. Save song

### Admin Approval Flow
1. Receive notification of song submission
2. Review song content
3. Approve or reject for public database
4. If approved, song becomes available to all users

---

## Development Roadmap

### 🎨 Important: UI/UX Review Process
Throughout development, **UI/UX checkpoints are scheduled at the end of each major milestone**. At these checkpoints:
- Deploy the current build to a staging environment
- Review layout, styling, and interactions
- Test on multiple devices (especially mobile)
- Provide feedback and request adjustments
- Developer implements changes before moving to next phase

This ensures the look and feel meets expectations early and often, preventing major redesigns later in the process.

---

### Phase 1: Foundation (Weeks 1-3)
**Goal**: Core infrastructure and basic functionality

#### Week 1: Project Setup & Authentication
- Initialize React + Node.js project structure
- Set up MongoDB database and schema design
- Implement user registration (email/password)
- Implement Google OAuth integration
- Create basic routing and navigation
- Set up Bootstrap responsive framework
- **🎨 UI/UX Checkpoint**: Create initial mockups/wireframes for approval before coding begins

#### Week 2: Database & Models
- Design and implement MongoDB schemas:
  - User model (account info, preferences)
  - Song/Presentation model (lyrics, language, tags, usage count)
  - Setlist model (song order, name, created by)
  - Room model (PIN, operator, active status, expiration)
- Create API endpoints for CRUD operations
- Implement personal vs public database logic
- Set up admin approval system structure
- **🎨 UI/UX Checkpoint**: Build basic layout prototypes for main screens (login, home, song library)
  - Deploy to staging for review
  - Gather feedback on navigation and overall structure

#### Week 3: Basic Song Management
- Create song creation interface
  - Text input for original language
  - Optional transliteration and translation fields
  - Language dropdown selection
  - Tag system with auto-suggest
- Implement song search functionality
  - Priority-based search (title > content > other)
  - Filter by tags and language
- Build song list/library view
- Create song edit functionality (creates personal copy for public songs)
- **🎨 UI/UX Checkpoint**: Review song management screens
  - Deploy to staging
  - Test usability on mobile devices
  - Adjust styling, spacing, and interactions based on feedback

### Phase 2: Real-time Room System (Weeks 4-5)
**Goal**: Virtual rooms and real-time synchronization

#### Week 4: Socket.IO Integration
- Set up Socket.IO server
- Implement room creation and PIN generation
- Create room join/leave logic
- Build basic operator control interface
- Implement slide navigation controls
- Test real-time message broadcasting
- **🎨 UI/UX Checkpoint**: Review operator control interface layout
  - Deploy to staging
  - Test mobile controls and button placement
  - Ensure intuitive slide navigation

#### Week 5: Viewer Experience
- Create viewer interface (PIN entry)
- Build fullscreen slide display
  - Black background, white text
  - Automatic font sizing for 16:9 aspect ratio
  - Support for 1-line and 4-line modes
- Implement real-time slide updates for viewers
- Add room capacity limit (500 viewers)
- Implement 2-hour inactivity room expiration
- Test synchronization with multiple viewers
- **🎨 UI/UX Checkpoint**: Review viewer display and PIN entry screens
  - Test on various screen sizes and devices
  - Verify text sizing and readability
  - Adjust font sizing algorithm if needed

### Phase 3: Operator Features (Weeks 6-7)
**Goal**: Complete operator control and presentation management

#### Week 6: Advanced Slide Control
- Build slide preview for operator
- Implement bilingual/original language toggle
- Create blank slide insertion
- Add keyboard shortcuts for slide navigation
- Build spontaneous song selection workflow
- Implement display mode switching (operator sees preview, viewers see output)
- **🎨 UI/UX Checkpoint**: Review operator preview and control layout
  - Test workflow efficiency
  - Ensure clear visual distinction between preview and live output
  - Verify mobile usability for all controls

#### Week 7: Setlist Management
- Create setlist builder interface
  - Search and add songs
  - Drag-and-drop reordering
  - Insert blank slides
- Implement setlist save/load functionality
- Build live setlist editing during presentation
- Create setlist sharing (generate shareable links)
- Add setlist to usage tracking
- **🎨 UI/UX Checkpoint**: Review setlist builder interface
  - Test drag-and-drop on mobile
  - Verify intuitive add/remove/reorder actions
  - Ensure clear visual feedback for all actions

### Phase 4: Admin & Database Features (Week 8)
**Goal**: Public database management and admin tools

- Build admin dashboard
- Implement song submission for public approval
  - User submission flow
  - Admin notification system
- Create admin approval interface
- Add song usage statistics display
- Implement public/private database filtering
- Build tag management system
- **🎨 UI/UX Checkpoint**: Review admin dashboard and user submission flow
  - Ensure clear approval/rejection workflow
  - Test notification visibility
  - Verify statistics are easy to read and understand

### Phase 5: Polish & Optimization (Weeks 9-10)
**Goal**: RTL support, mobile optimization, and user experience

#### Week 9: Hebrew & RTL Support
- Implement proper RTL text rendering
- Test Hebrew input and display
- Ensure transliteration displays correctly
- Optimize font rendering for Hebrew characters
- Test mixed RTL/LTR content (bilingual mode)

#### Week 10: Mobile Optimization & UX
- Optimize mobile interface (primary focus)
- Improve touch interactions
- Add loading states and error handling
- Implement user preferences storage
- Create onboarding/tutorial for new users
- Performance optimization (lazy loading, caching)
- Cross-browser testing

### Phase 6: Testing & Deployment (Weeks 11-12)
**Goal**: Comprehensive testing and production launch

#### Week 11: Testing
- Unit testing for critical functions
- Integration testing for API endpoints
- End-to-end testing for user flows
- Load testing for 500 concurrent viewers
- Socket.IO connection stability testing
- Mobile device testing (iOS/Android)
- Browser compatibility testing

#### Week 12: Deployment & Launch
- Set up production environment
- Configure production MongoDB
- Deploy backend (Node.js + Socket.IO)
- Deploy frontend (React app)
- Set up SSL certificates
- Configure domain and DNS
- Create backup and monitoring systems
- Soft launch with beta testers
- Gather initial feedback
- Bug fixes and adjustments

---

## Post-Launch: Maintenance & Iteration
- Monitor server performance and user feedback
- Fix bugs and address user issues
- Collect feature requests
- Plan future enhancements (Phase 7+)

---

## Estimated Timeline
- **Total development time**: 12 weeks (3 months)
- **Team size assumption**: 1-2 developers
- **Post-launch support**: Ongoing

---

## Future Considerations (Not in Initial Scope)
- Background images/videos for slides
- Additional aspect ratios
- Multiple simultaneous rooms per operator
- Team collaboration features
- More detailed analytics
- Song import/export functionality
- Slide templates and themes
- Audio integration

---

## Success Metrics
- Number of active operators
- Songs created and shared
- Average viewers per room
- User engagement and retention
- Mobile vs desktop usage ratio
- Most popular songs (by usage count)

---

## Project Goals
1. Create a free alternative to expensive projection software
2. Prioritize mobile accessibility
3. Eliminate installation requirements
4. Enable remote/distributed viewing
5. Support Hebrew and multilingual content
6. Build a community-driven song database
7. Maintain simplicity and ease of use