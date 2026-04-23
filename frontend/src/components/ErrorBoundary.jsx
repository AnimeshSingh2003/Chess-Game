import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(e) { return { hasError: true, error: e }; }
  componentDidCatch(e, info) { console.error('App crash:', e, info); }
  render() {
    if (this.state.hasError) {
      return (
        <main className="app-shell">
          <div className="error-boundary glass-card">
            <h2>Something went wrong</h2>
            <p className="muted">{this.state.error?.message}</p>
            <button className="primary-btn" onClick={() => window.location.reload()}>Reload App</button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
