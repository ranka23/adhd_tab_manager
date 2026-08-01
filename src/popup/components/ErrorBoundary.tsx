/**
 * Error Boundary component.
 * Catches React errors and displays a fallback UI instead of crashing.
 */

import React, { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Caught:', error, info);
  }

  handleReload = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            padding: '24px',
            textAlign: 'center',
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⚠️</div>
          <h2 style={{ margin: '0 0 8px', fontSize: '1.1rem', color: 'var(--error-color, #d32f2f)' }}>
            Something went wrong
          </h2>
          <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: 'var(--text-secondary, #666)' }}>
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </p>
          <button
            onClick={this.handleReload}
            style={{
              padding: '8px 20px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'var(--primary-color, #1976d2)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
