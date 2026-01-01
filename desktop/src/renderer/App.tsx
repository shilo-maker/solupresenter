import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';

// Lazy load pages
const ControlPanel = lazy(() => import('./pages/ControlPanel'));
const DisplayViewer = lazy(() => import('./pages/DisplayViewer'));
const DisplayStage = lazy(() => import('./pages/DisplayStage'));
const ThemeEditorPage = lazy(() => import('./pages/ThemeEditorPage'));
const StageMonitorEditorPage = lazy(() => import('./pages/StageMonitorEditorPage'));
const PresentationEditorPage = lazy(() => import('./pages/PresentationEditorPage'));

// Loading fallback
const LoadingFallback: React.FC = () => (
  <div className="loading-container">
    <div className="loading-spinner"></div>
  </div>
);

const App: React.FC = () => {
  return (
    <HashRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Control panel (main window) */}
          <Route path="/" element={<ControlPanel />} />

          {/* Display windows */}
          <Route path="/display/viewer" element={<DisplayViewer />} />
          <Route path="/display/stage" element={<DisplayStage />} />

          {/* Editor pages */}
          <Route path="/theme-editor" element={<ThemeEditorPage />} />
          <Route path="/stage-monitor-editor" element={<StageMonitorEditorPage />} />
          <Route path="/presentation-editor" element={<PresentationEditorPage />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
};

export default App;
