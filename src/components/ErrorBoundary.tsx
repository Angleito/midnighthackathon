import React, { Component, ReactNode } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary" style={{
          padding: '20px',
          margin: '20px',
          background: 'rgba(255, 0, 0, 0.1)',
          border: '1px solid rgba(255, 0, 0, 0.3)',
          borderRadius: '8px',
          color: '#ff6b6b'
        }}>
          <h2>🚫 Something went wrong</h2>
          <details style={{ marginTop: '10px' }}>
            <summary style={{ cursor: 'pointer', marginBottom: '10px' }}>
              Click to see error details
            </summary>
            <pre style={{ 
              background: 'rgba(0, 0, 0, 0.2)', 
              padding: '10px', 
              borderRadius: '4px',
              fontSize: '12px',
              overflow: 'auto'
            }}>
              {this.state.error?.toString()}
              {this.state.errorInfo?.componentStack}
            </pre>
          </details>
          <button 
            onClick={() => this.setState({ hasError: false, error: undefined, errorInfo: undefined })}
            style={{
              marginTop: '10px',
              padding: '8px 16px',
              background: '#ff6b6b',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export const WalletErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <ErrorBoundary
      fallback={
        <div className="wallet-error" style={{
          padding: '20px',
          background: 'rgba(255, 165, 0, 0.1)',
          border: '1px solid rgba(255, 165, 0, 0.3)',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <h3>🌙 Wallet Connection Error</h3>
          <p>Unable to connect to Midnight wallet. This may be due to:</p>
          <ul style={{ textAlign: 'left', marginTop: '10px' }}>
            <li>Network connectivity issues</li>
            <li>Prover server not running (expected in development)</li>
            <li>WebSocket connection problems</li>
          </ul>
          <p style={{ marginTop: '15px', fontSize: '0.9em', opacity: 0.8 }}>
            The app will work in development mode with limited functionality.
          </p>
        </div>
      }
      onError={(error, errorInfo) => {
        // Log wallet-specific errors
        console.error('Wallet Error:', error);
        console.error('Error Info:', errorInfo);
        
        // Check if it's a WebSocket or network error
        if (error.message?.includes('WebSocket') || error.message?.includes('fetch')) {
          console.log('Network-related wallet error detected');
        }
      }}
    >
      {children}
    </ErrorBoundary>
  );
};