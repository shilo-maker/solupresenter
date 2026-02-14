import React, { Suspense, lazy, Component, ErrorInfo, ReactNode } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { SettingsProvider } from './contexts/SettingsContext';
import { SetlistProvider } from './contexts/SetlistContext';
import { ToastProvider } from './contexts/ToastContext';

// Error Boundary Component
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          color: 'white',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h1 style={{ fontSize: '24px', marginBottom: '16px', color: '#f87171' }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', marginBottom: '24px', maxWidth: '400px' }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={this.handleReload}
            style={{
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: 600,
              background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

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
const OBSPrayerThemeEditorPage = lazy(() => import('./pages/OBSPrayerThemeEditorPage'));
const DualTranslationThemeEditorPage = lazy(() => import('./pages/DualTranslationThemeEditorPage'));
const MidiBuilderPage = lazy(() => import('./pages/MidiBuilderPage'));

// Loading fallback - uses CSS classes from index.html for consistent style
const LoadingFallback: React.FC = () => (
  <div className="loading-container" style={{
    background: 'radial-gradient(ellipse at center, #0f0f12 0%, #09090b 70%)'
  }}>
    <div className="loading-bar-container">
      <div className="loading-bar" />
    </div>
  </div>
);

const AppContent: React.FC = () => {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const isDisplayWindow = location.pathname.startsWith('/display/');

  return (
    <>
      {!isDisplayWindow && (
        <div style={{ display: isHome ? 'contents' : 'none' }}>
          <ControlPanel />
        </div>
      )}
      <Routes>
        <Route path="/" element={null} />

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
        <Route path="/obs-prayer-theme-editor" element={<OBSPrayerThemeEditorPage />} />
        <Route path="/dual-translation-theme-editor" element={<DualTranslationThemeEditorPage />} />
        <Route path="/midi-builder" element={<MidiBuilderPage />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <SettingsProvider>
        <SetlistProvider>
          <ToastProvider>
            <HashRouter>
              <Suspense fallback={<LoadingFallback />}>
                <AppContent />
              </Suspense>
            </HashRouter>
          </ToastProvider>
        </SetlistProvider>
      </SettingsProvider>
    </ErrorBoundary>
  );
};

export default App;
