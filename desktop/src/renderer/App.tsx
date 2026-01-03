import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SettingsProvider } from './contexts/SettingsContext';
import { SetlistProvider } from './contexts/SetlistContext';

// Lazy load pages
const ControlPanel = lazy(() => import('./pages/ControlPanel'));
const DisplayViewer = lazy(() => import('./pages/DisplayViewer'));
const DisplayStage = lazy(() => import('./pages/DisplayStage'));
const OBSOverlay = lazy(() => import('./pages/OBSOverlay'));
const ThemeEditorPage = lazy(() => import('./pages/ThemeEditorPage'));
const StageMonitorEditorPage = lazy(() => import('./pages/StageMonitorEditorPage'));
const PresentationEditorPage = lazy(() => import('./pages/PresentationEditorPage'));
const BibleThemeEditorPage = lazy(() => import('./pages/BibleThemeEditorPage'));
const PrayerThemeEditorPage = lazy(() => import('./pages/PrayerThemeEditorPage'));
const OBSSongsThemeEditorPage = lazy(() => import('./pages/OBSSongsThemeEditorPage'));
const OBSBibleThemeEditorPage = lazy(() => import('./pages/OBSBibleThemeEditorPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

// Loading fallback
const LoadingFallback: React.FC = () => (
  <div className="loading-container">
    <div className="loading-spinner"></div>
  </div>
);

const App: React.FC = () => {
  return (
    <SettingsProvider>
      <SetlistProvider>
        <HashRouter>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
            {/* Control panel (main window) */}
            <Route path="/" element={<ControlPanel />} />

            {/* Settings */}
            <Route path="/settings" element={<SettingsPage />} />

            {/* Display windows */}
            <Route path="/display/viewer" element={<DisplayViewer />} />
            <Route path="/display/stage" element={<DisplayStage />} />
            <Route path="/display/obs" element={<OBSOverlay />} />

            {/* Editor pages */}
            <Route path="/theme-editor" element={<ThemeEditorPage />} />
            <Route path="/stage-monitor-editor" element={<StageMonitorEditorPage />} />
            <Route path="/presentation-editor" element={<PresentationEditorPage />} />
            <Route path="/bible-theme-editor" element={<BibleThemeEditorPage />} />
            <Route path="/prayer-theme-editor" element={<PrayerThemeEditorPage />} />
            <Route path="/obs-songs-theme-editor" element={<OBSSongsThemeEditorPage />} />
            <Route path="/obs-bible-theme-editor" element={<OBSBibleThemeEditorPage />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </HashRouter>
      </SetlistProvider>
    </SettingsProvider>
  );
};

export default App;
