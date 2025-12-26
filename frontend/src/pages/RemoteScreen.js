import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import WaitingForPresentation from '../components/WaitingForPresentation';
import { remoteScreenAPI } from '../services/api';

// Lazy load display components to reduce initial bundle size
const ViewerPage = React.lazy(() => import('./ViewerPage'));
const StageMonitor = React.lazy(() => import('./StageMonitor'));
const OBSOverlay = React.lazy(() => import('./OBSOverlay'));

// Loading spinner component
function LoadingSpinner() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: '#1a202c',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        width: '50px',
        height: '50px',
        border: '3px solid rgba(255, 255, 255, 0.1)',
        borderTopColor: '#4299e1',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}

function RemoteScreen() {
  const { userId, screenId } = useParams();
  const [screenData, setScreenData] = useState(null);
  const [roomData, setRoomData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchScreenData = useCallback(async () => {
    try {
      const response = await remoteScreenAPI.getScreenAccess(userId, screenId);
      setScreenData(response.data.screen);
      setRoomData(response.data.room);
      setError(null);
    } catch (err) {
      console.error('Error fetching screen data:', err);
      if (err.response?.status === 404) {
        setError('Screen not found');
      } else {
        setError('Failed to load screen');
      }
    } finally {
      setLoading(false);
    }
  }, [userId, screenId]);

  useEffect(() => {
    fetchScreenData();

    // Poll every 5 seconds to detect room changes
    const interval = setInterval(fetchScreenData, 5000);

    return () => clearInterval(interval);
  }, [fetchScreenData]);

  // Show loading spinner on initial load
  if (loading) {
    return <LoadingSpinner />;
  }

  // Show error state
  if (error) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#1a202c',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fc8181',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
          {error}
        </div>
        <div style={{ color: '#a0aec0', opacity: 0.7 }}>
          Please check the screen URL
        </div>
      </div>
    );
  }

  // Show waiting state if no active room
  if (!roomData) {
    return <WaitingForPresentation screenName={screenData?.name} />;
  }

  // Render appropriate display component based on displayType
  // Pass the room PIN so it can connect via socket
  const config = screenData?.config || {};

  return (
    <Suspense fallback={<LoadingSpinner />}>
      {screenData?.displayType === 'stage' && (
        <StageMonitor
          remotePin={roomData.pin}
          remoteConfig={config}
        />
      )}
      {screenData?.displayType === 'obs' && (
        <OBSOverlay
          remotePin={roomData.pin}
          remoteConfig={config}
        />
      )}
      {screenData?.displayType === 'custom' && (
        <ViewerPage
          remotePin={roomData.pin}
          remoteConfig={{ ...config, initialTheme: roomData.theme }}
        />
      )}
      {(screenData?.displayType === 'viewer' || !screenData?.displayType) && (
        <ViewerPage
          remotePin={roomData.pin}
          remoteConfig={config}
        />
      )}
    </Suspense>
  );
}

export default RemoteScreen;
