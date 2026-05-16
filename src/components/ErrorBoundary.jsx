import { Component } from 'react';
import { captureException } from '../lib/sentry.js';

export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // L3: Boundary-Crashes nach Sentry forwarden (no-op ohne DSN)
    captureException(error, { componentStack: info?.componentStack });
  }

  render() {
    if (this.state.error) {
      const inline = this.props.inline;
      const containerStyle = inline
        ? { padding: 32, textAlign: 'center', color: 'var(--c-br)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320 }
        : { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--c-bg)', color: 'var(--c-br)', flexDirection: 'column', padding: 32, textAlign: 'center' };
      const resetError = () => this.setState({ error: null });
      return (
        <div style={containerStyle} role="alert" aria-live="assertive">
          <div style={{ fontSize: inline ? 32 : 40, marginBottom: 16 }}>⚠</div>
          <div style={{ fontSize: inline ? 16 : 18, fontWeight: 800, marginBottom: 8 }}>
            {inline ? 'Dieser Bereich konnte nicht geladen werden' : 'Etwas ist schiefgelaufen'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--c-mu)', marginBottom: 24, maxWidth: 400 }}>
            {this.state.error?.message || 'Unbekannter Fehler'}
          </div>
          <button
            onClick={inline ? resetError : () => { resetError(); window.location.reload(); }}
            style={{ padding: '10px 24px', background: 'var(--c-ac)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
            {inline ? 'Erneut versuchen' : 'Seite neu laden'}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
