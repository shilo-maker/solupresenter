import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Maximum number of auto-retry attempts (default: 0 = no auto-retry) */
  maxRetries?: number;
  /** Delay between retry attempts in ms (default: 1000) */
  retryDelay?: number;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

/**
 * Error boundary component for catching errors in media-related components.
 * Prevents the entire app from crashing when media components fail.
 */
class MediaErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[MediaErrorBoundary] Caught error:', error);
    console.error('[MediaErrorBoundary] Error info:', errorInfo.componentStack);

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Auto-retry if enabled and under max retries
    const maxRetries = this.props.maxRetries ?? 0;
    if (maxRetries > 0 && this.state.retryCount < maxRetries) {
      const retryDelay = this.props.retryDelay ?? 1000;
      console.log(`[MediaErrorBoundary] Auto-retrying in ${retryDelay}ms (attempt ${this.state.retryCount + 1}/${maxRetries})`);

      this.retryTimeoutId = setTimeout(() => {
        this.setState(prevState => ({
          hasError: false,
          error: null,
          retryCount: prevState.retryCount + 1
        }));
      }, retryDelay);
    }
  }

  componentWillUnmount(): void {
    // Clean up any pending retry timeout
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
  }

  handleRetry = (): void => {
    // Clear any pending auto-retry
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
    this.setState({ hasError: false, error: null, retryCount: 0 });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            backgroundColor: 'rgba(255, 0, 0, 0.1)',
            borderRadius: '8px',
            margin: '10px',
            minHeight: '100px'
          }}
        >
          <div
            style={{
              color: '#ff6b6b',
              fontSize: '14px',
              marginBottom: '10px',
              textAlign: 'center'
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ marginBottom: '8px' }}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>Media failed to load</div>
            {this.state.error && (
              <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>
                {this.state.error.message}
              </div>
            )}
            {this.state.retryCount > 0 && (
              <div style={{ fontSize: '11px', opacity: 0.5, marginTop: '2px' }}>
                Retry attempts: {this.state.retryCount}
              </div>
            )}
          </div>
          <button
            onClick={this.handleRetry}
            style={{
              padding: '8px 16px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default MediaErrorBoundary;
