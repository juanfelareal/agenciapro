import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePortal } from '../../context/PortalContext';
import { KeyRound, ArrowRight, AlertCircle, Building2 } from 'lucide-react';

export default function PortalLogin() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated } = usePortal();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Check for code in URL
  useEffect(() => {
    const urlCode = searchParams.get('code');
    if (urlCode) {
      setCode(urlCode);
    }
  }, [searchParams]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/portal');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Por favor ingresa tu código de acceso');
      return;
    }

    setLoading(true);
    setError('');

    const result = await login(code.trim());

    if (result.success) {
      navigate('/portal');
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  const formatCode = (value) => {
    // Remove non-alphanumeric characters and convert to uppercase
    const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    // Add dash after 4 characters
    if (cleaned.length > 4) {
      return cleaned.slice(0, 4) + '-' + cleaned.slice(4, 8);
    }
    return cleaned;
  };

  const handleCodeChange = (e) => {
    const formatted = formatCode(e.target.value);
    setCode(formatted);
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-ink-900 rounded-2xl mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-ink-900">Portal de Cliente</h1>
          <p className="text-ink-500 mt-2">
            Ingresa tu código de acceso para continuar
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-soft border border-ink-100/50 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Code Input */}
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-2">
                Código de Acceso
              </label>
              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400" />
                <input
                  type="text"
                  value={code}
                  onChange={handleCodeChange}
                  placeholder="XXXX-XXXX"
                  maxLength={9}
                  className="w-full pl-12 pr-4 py-4 bg-cream-50 border border-ink-200 rounded-xl
                           text-center text-2xl font-mono tracking-widest
                           focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent
                           placeholder:text-ink-300 placeholder:text-lg"
                  autoFocus
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || code.length < 9}
              className="w-full flex items-center justify-center gap-2 py-4 px-6
                       bg-ink-900 text-white font-semibold rounded-xl
                       hover:bg-ink-800 disabled:bg-ink-300 disabled:cursor-not-allowed
                       transition-all duration-200"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verificando...</span>
                </>
              ) : (
                <>
                  <span>Acceder al Portal</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* Help Text */}
          <p className="mt-6 text-center text-sm text-ink-500">
            ¿No tienes un código? Contacta a tu agencia para obtener acceso.
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-ink-400 mt-8">
          Powered by AgenciaPro
        </p>
      </div>
    </div>
  );
}
