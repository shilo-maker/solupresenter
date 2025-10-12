import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ViewerPage from './pages/ViewerPage';
import SongList from './pages/SongList';
import SongCreate from './pages/SongCreate';
import SongView from './pages/SongView';
import SongEdit from './pages/SongEdit';
import PresenterMode from './pages/PresenterMode';
import SetlistList from './pages/SetlistList';
import SetlistCreate from './pages/SetlistCreate';
import SetlistView from './pages/SetlistView';
import SetlistEdit from './pages/SetlistEdit';
import Admin from './pages/Admin';
import MediaLibrary from './pages/MediaLibrary';

// Import Bootstrap CSS
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
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
      </Router>
    </AuthProvider>
  );
}

export default App;
