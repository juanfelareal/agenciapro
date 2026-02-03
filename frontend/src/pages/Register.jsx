import { useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI, setAuthToken } from '../utils/api';
import { Mail, Lock, User, Building2, UserPlus, AlertCircle } from 'lucide-react';

const Register = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    pin: '',
    org_name: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-warm flex items-center justify-center">
        <div className="card p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
          <p className="mt-4 text-ink-600 text-center">Verificando sesion...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.register(form);
      const { token, user, current_org } = response.data;

      // Save to localStorage
      localStorage.setItem('authToken', token);
      localStorage.setItem('authUser', JSON.stringify(user));
      if (current_org) {
        localStorage.setItem('currentOrg', JSON.stringify(current_org));
      }

      // Set token in API headers
      setAuthToken(token);

      // Redirect to dashboard (full reload to init auth context)
      window.location.href = '/';
    } catch (err) {
      const message = err.response?.data?.error || 'Error al registrar';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-warm flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-accent/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md relative">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-ink-900 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-ink-900">Crea tu organizacion</h1>
          <p className="text-ink-500 mt-1">Registrate gratis y empieza a gestionar tu equipo</p>
        </div>

        {/* Register Card */}
        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error */}
            {error && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-ink-700 mb-2">
                Tu nombre
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="w-5 h-5 text-ink-400" />
                </div>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  className="w-full pl-12 pr-4 py-3 bg-cream-50 border border-ink-200 rounded-xl text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                  placeholder="Juan Felipe"
                  required
                />
              </div>
            </div>

            {/* Org Name */}
            <div>
              <label htmlFor="org_name" className="block text-sm font-medium text-ink-700 mb-2">
                Nombre de tu organizacion
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Building2 className="w-5 h-5 text-ink-400" />
                </div>
                <input
                  type="text"
                  id="org_name"
                  name="org_name"
                  value={form.org_name}
                  onChange={handleChange}
                  className="w-full pl-12 pr-4 py-3 bg-cream-50 border border-ink-200 rounded-xl text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                  placeholder="Mi Empresa"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ink-700 mb-2">
                Correo electronico
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="w-5 h-5 text-ink-400" />
                </div>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full pl-12 pr-4 py-3 bg-cream-50 border border-ink-200 rounded-xl text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                  placeholder="tu@email.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* PIN */}
            <div>
              <label htmlFor="pin" className="block text-sm font-medium text-ink-700 mb-2">
                PIN de acceso
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-ink-400" />
                </div>
                <input
                  type="password"
                  id="pin"
                  name="pin"
                  value={form.pin}
                  onChange={handleChange}
                  className="w-full pl-12 pr-4 py-3 bg-cream-50 border border-ink-200 rounded-xl text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                  placeholder="Minimo 4 caracteres"
                  required
                  minLength={4}
                  autoComplete="new-password"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-ink-900 to-ink-800 hover:from-ink-800 hover:to-ink-700 text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-ink-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  <span>Creando cuenta...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  <span>Crear Cuenta</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-ink-400 mt-6">
          Ya tienes cuenta?{' '}
          <Link to="/login" className="text-ink-700 font-medium hover:text-ink-900 transition-colors">
            Inicia sesion
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
