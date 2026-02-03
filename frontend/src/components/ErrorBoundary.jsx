import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, fontFamily: 'system-ui, sans-serif', maxWidth: 600, margin: '80px auto' }}>
          <h1 style={{ fontSize: 24, marginBottom: 16 }}>Algo salio mal</h1>
          <p style={{ color: '#666', marginBottom: 16 }}>
            Intenta recargar la pagina. Si el problema persiste, cierra sesion y vuelve a entrar.
          </p>
          <pre style={{
            background: '#f5f5f5', padding: 16, borderRadius: 8,
            fontSize: 13, overflow: 'auto', whiteSpace: 'pre-wrap', color: '#c00'
          }}>
            {this.state.error?.toString()}
          </pre>
          <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 20px', background: '#1A1A2E', color: '#fff',
                border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14
              }}
            >
              Recargar pagina
            </button>
            <button
              onClick={() => {
                localStorage.removeItem('authToken');
                localStorage.removeItem('authUser');
                localStorage.removeItem('currentOrg');
                window.location.href = '/login';
              }}
              style={{
                padding: '10px 20px', background: '#fff', color: '#333',
                border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer', fontSize: 14
              }}
            >
              Cerrar sesion
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
