# SoluCast

A free, web-based church projection application designed for mobile devices, allowing operators to control presentations that viewers can access through virtual rooms in real-time.

## Project Structure

```
solupresenter/
├── backend/          # Node.js + Express + Socket.IO server
│   ├── models/       # MongoDB models
│   ├── routes/       # API routes
│   ├── config/       # Configuration files
│   ├── middleware/   # Auth middleware
│   ├── utils/        # Utility functions
│   └── scripts/      # Setup scripts
└── frontend/         # React application
    ├── src/
    │   ├── components/  # Reusable components
    │   ├── pages/       # Page components
    │   ├── contexts/    # React contexts
    │   ├── services/    # API and socket services
    │   └── utils/       # Utility functions
    └── public/
```

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (running locally or connection URI)
- npm or yarn

## Setup Instructions

### 1. Clone the Repository

```bash
cd solupresenter
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your configuration

# Create admin account (optional)
npm run create-admin

# Start development server
npm run dev
```

The backend server will run on `http://localhost:5000`

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env

# Start development server
npm start
```

The frontend will run on `http://localhost:3000`

### 4. MongoDB Setup

Make sure MongoDB is running locally on port 27017, or update the `MONGODB_URI` in `backend/.env` with your connection string.

## Environment Variables

### Backend (.env)

```env
MONGODB_URI=mongodb://localhost:27017/solupresenter
JWT_SECRET=your_jwt_secret_here
SESSION_SECRET=your_session_secret_here
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/auth/google/callback
```

### Frontend (.env)

```env
REACT_APP_API_URL=http://localhost:5000
```

## Creating an Admin Account

Run the admin setup script:

```bash
cd backend
npm run create-admin
```

Follow the prompts to create an admin account.

## Features Implemented

### Week 1 - Phase 1 (Current)

✅ Project structure initialized
✅ Backend setup with Express + MongoDB
✅ User authentication (email/password)
✅ Google OAuth integration
✅ Admin setup script
✅ Basic routing and navigation
✅ Socket.IO for real-time communication
✅ MongoDB models for Users, Songs, Rooms, Setlists

### API Endpoints

#### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `GET /auth/google` - Google OAuth
- `GET /auth/me` - Get current user

#### Songs
- `GET /api/songs` - Get all songs
- `GET /api/songs/search` - Search songs
- `GET /api/songs/:id` - Get single song
- `POST /api/songs` - Create song
- `PUT /api/songs/:id` - Update song
- `DELETE /api/songs/:id` - Delete song

#### Rooms
- `POST /api/rooms/create` - Create/get active room
- `GET /api/rooms/join/:pin` - Join room by PIN
- `GET /api/rooms/my-room` - Get operator's room
- `POST /api/rooms/:id/close` - Close room

#### Setlists
- `GET /api/setlists` - Get all setlists
- `GET /api/setlists/:id` - Get single setlist
- `POST /api/setlists` - Create setlist
- `PUT /api/setlists/:id` - Update setlist
- `DELETE /api/setlists/:id` - Delete setlist

#### Admin
- `GET /api/admin/pending-songs` - Get pending approvals
- `POST /api/admin/approve-song/:id` - Approve song
- `POST /api/admin/reject-song/:id` - Reject song

### Socket.IO Events

#### Operator Events
- `operator:join` - Operator joins their room
- `operator:updateSlide` - Update current slide

#### Viewer Events
- `viewer:join` - Viewer joins a room
- `slide:update` - Receive slide updates
- `room:viewerCount` - Viewer count updates

## Development Status

This completes **Week 1** of the development roadmap. The foundation is now in place with:
- Full authentication system
- Database models
- API structure
- Real-time Socket.IO setup
- Basic frontend pages (Login, Register, Dashboard, Viewer)

## Next Steps (Week 2)

- Implement song management UI
- Create song creation/edit forms
- Build song library and search interface
- Add tag management
- Implement RTL text support for Hebrew

## Running Tests

```bash
# Backend tests (when implemented)
cd backend
npm test

# Frontend tests (when implemented)
cd frontend
npm test
```

## Troubleshooting

### MongoDB Connection Issues
- Ensure MongoDB is running: `mongod` or check your MongoDB service
- Verify the connection URI in `backend/.env`

### Port Already in Use
- Backend: Change `PORT` in `backend/.env`
- Frontend: Set `PORT=3001` in environment before running `npm start`

### CORS Issues
- Ensure `FRONTEND_URL` in backend `.env` matches your frontend URL

## License

This project is licensed under the ISC License.
