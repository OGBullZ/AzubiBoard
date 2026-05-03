import { Component } from 'react';

export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0e14', color: '#f0f6fc', flexDirection: 'column', padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Etwas ist schiefgelaufen</div>
          <div style={{ fontSize: 13, color: '#8b949e', marginBottom: 24, maxWidth: 400 }}>
            {this.state.error?.message || 'Unbekannter Fehler'}
          </div>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            style={{ padding: '10px 24px', background: '#0071E3', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
            Seite neu laden
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
