import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';

// Loading component
const LoadingFallback = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '1.2rem',
    color: '#666'
  }}>
    Loading...
  </div>
);

// Lazy load pages for code splitting
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ViewerPage = lazy(() => import('./pages/ViewerPage'));
const SongList = lazy(() => import('./pages/SongList'));
const SongCreate = lazy(() => import('./pages/SongCreate'));
const SongView = lazy(() => import('./pages/SongView'));
const SongEdit = lazy(() => import('./pages/SongEdit'));
const PresenterMode = lazy(() => import('./pages/PresenterMode'));
const SetlistList = lazy(() => import('./pages/SetlistList'));
const SetlistCreate = lazy(() => import('./pages/SetlistCreate'));
const SetlistView = lazy(() => import('./pages/SetlistView'));
const SetlistEdit = lazy(() => import('./pages/SetlistEdit'));
const Admin = lazy(() => import('./pages/Admin'));
const MediaLibrary = lazy(() => import('./pages/MediaLibrary'));

// Import Bootstrap CSS
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/modern.css';  // Modern theme overrides
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/viewer" element={<ViewerPage />} />

          {/* Private routes */}
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/operator"
            element={
              <PrivateRoute>
                <PresenterMode />
              </PrivateRoute>
            }
          />

          {/* Song Management Routes */}
          <Route
            path="/songs"
            element={
              <PrivateRoute>
                <SongList />
              </PrivateRoute>
            }
          />
          <Route
            path="/songs/new"
            element={
              <PrivateRoute>
                <SongCreate />
              </PrivateRoute>
            }
          />
          <Route
            path="/songs/:id"
            element={
              <PrivateRoute>
                <SongView />
              </PrivateRoute>
            }
          />
          <Route
            path="/songs/:id/edit"
            element={
              <PrivateRoute>
                <SongEdit />
              </PrivateRoute>
            }
          />

          {/* Setlist Management Routes */}
          <Route
            path="/setlists"
            element={
              <PrivateRoute>
                <SetlistList />
              </PrivateRoute>
            }
          />
          <Route
            path="/setlists/new"
            element={
              <PrivateRoute>
                <SetlistCreate />
              </PrivateRoute>
            }
          />
          <Route
            path="/setlists/:id"
            element={
              <PrivateRoute>
                <SetlistView />
              </PrivateRoute>
            }
          />
          <Route
            path="/setlists/:id/edit"
            element={
              <PrivateRoute>
                <SetlistEdit />
              </PrivateRoute>
            }
          />

          {/* Admin Route */}
          <Route
            path="/admin"
            element={
              <PrivateRoute>
                <Admin />
              </PrivateRoute>
            }
          />

          {/* Media Library Route */}
          <Route
            path="/media"
            element={
              <PrivateRoute>
                <MediaLibrary />
              </PrivateRoute>
            }
          />

            {/* Root shows viewer page */}
            <Route path="/" element={<ViewerPage />} />
          </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
}

export default App;
