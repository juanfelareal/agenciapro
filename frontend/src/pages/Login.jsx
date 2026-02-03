import { useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, LogIn, AlertCircle } from 'lucide-react';
import OrbitLogo from '../components/OrbitLogo';

const Login = () => {
  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already authenticated
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="card p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
          <p className="mt-4 text-ink-600 text-center">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, pin);

    if (!result.success) {
      setError(result.error);
    } else if (result.needsOrgSelection) {
      // Multiple orgs — redirect to selector
      navigate('/select-org', { replace: true });
      return;
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-accent/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-2">
            <OrbitLogo size={56} />
          </div>
          <p className="text-gray-500 mt-1">Inicia sesión para continuar</p>
        </div>

        {/* Login Card */}
        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ink-700 mb-2">
                Correo electrónico
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="w-5 h-5 text-ink-400" />
                </div>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-ink-200 rounded-xl text-[#1A1A2E] placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                  placeholder="tu@email.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* PIN Field */}
            <div>
              <label htmlFor="pin" className="block text-sm font-medium text-ink-700 mb-2">
                PIN o Palabra clave
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-ink-400" />
                </div>
                <input
                  type="password"
                  id="pin"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-ink-200 rounded-xl text-[#1A1A2E] placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                  placeholder="Tu PIN de acceso"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-[#1A1A2E] to-ink-800 hover:from-ink-800 hover:to-ink-700 text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-[#1A1A2E]/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  <span>Iniciando sesión...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Iniciar Sesión</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-ink-400 mt-6">
          ¿No tienes cuenta?{' '}
          <Link to="/register" className="text-ink-700 font-medium hover:text-ink-900 transition-colors">
            Crea tu organizacion
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
