import { Component } from 'react';
import { AlertTriangle, RefreshCw, LogOut } from 'lucide-react';

export default class PortalErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Portal error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleLogout = () => {
    localStorage.removeItem('portalToken');
    window.location.href = '/portal/login';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold text-[#1A1A2E] mb-2">Algo salio mal</h2>
            <p className="text-gray-500 mb-6">
              Ocurrio un error inesperado. Intenta recargar la pagina o cierra sesion e ingresa de nuevo.
            </p>

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReload}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#1A1A2E] text-white rounded-xl
                         hover:bg-gray-800 transition-colors font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                Recargar pagina
              </button>
              <button
                onClick={this.handleLogout}
                className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl
                         hover:bg-gray-50 transition-colors font-medium"
              >
                <LogOut className="w-4 h-4" />
                Cerrar sesion
              </button>
            </div>

            {this.state.error && (
              <details className="mt-6 text-left bg-gray-50 rounded-xl p-4">
                <summary className="text-sm text-gray-500 cursor-pointer">Detalle tecnico</summary>
                <pre className="mt-2 text-xs text-red-600 overflow-auto whitespace-pre-wrap">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
