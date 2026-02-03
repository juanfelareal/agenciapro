import { useState, useRef } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI, setAuthToken } from '../utils/api';
import {
  Mail, Lock, User, Building2, UserPlus, AlertCircle,
  Upload, X, Check, ChevronRight, ChevronLeft, Target, ArrowRight, SkipForward,
} from 'lucide-react';
import OrbitLogo from '../components/OrbitLogo';

const BUSINESS_TYPES = [
  { value: 'agencia_marketing', label: 'Agencia de marketing' },
  { value: 'agencia_diseno', label: 'Agencia de diseno/creativa' },
  { value: 'desarrollo_software', label: 'Desarrollo de software' },
  { value: 'consultoria', label: 'Consultoria' },
  { value: 'freelancer', label: 'Freelancer / Independiente' },
  { value: 'ecommerce', label: 'E-commerce / Tienda online' },
  { value: 'startup', label: 'Startup / Tecnologia' },
  { value: 'servicios_profesionales', label: 'Servicios profesionales' },
  { value: 'educacion', label: 'Educacion / Academia' },
  { value: 'otro', label: 'Otro' },
];

const TEAM_SIZES = [
  { value: 'solo', label: 'Solo yo' },
  { value: '2-5', label: '2-5 personas' },
  { value: '6-15', label: '6-15 personas' },
  { value: '16-50', label: '16-50 personas' },
  { value: '50+', label: 'Mas de 50' },
];

const GOALS = [
  'Gestionar proyectos',
  'Controlar finanzas',
  'Organizar mi equipo',
  'Seguimiento de clientes',
  'Reportes y metricas',
  'Automatizar procesos',
  'Control de horas',
  'Facturacion',
];

const ALTERNATIVES = [
  'Monday.com',
  'ClickUp',
  'Asana',
  'Trello',
  'Notion',
  'Google Sheets / Excel',
  'Otra herramienta',
  'Ninguna',
];

const HOW_FOUND_US = [
  { value: 'referido', label: 'Referido' },
  { value: 'redes_sociales', label: 'Redes sociales' },
  { value: 'google', label: 'Google' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'otro', label: 'Otro' },
];

const STEPS = [
  { label: 'Cuenta', icon: User },
  { label: 'Organizacion', icon: Building2 },
  { label: 'Objetivos', icon: Target },
];

// Compress image to max 200x200 JPEG base64
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 200;
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) { height = (height * maxSize) / width; width = maxSize; }
        } else {
          if (height > maxSize) { width = (width * maxSize) / height; height = maxSize; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        resolve(base64);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const Register = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Account
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');

  // Step 2: Organization
  const [orgName, setOrgName] = useState('');
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoBase64, setLogoBase64] = useState(null);
  const [businessType, setBusinessType] = useState('');
  const [teamSize, setTeamSize] = useState('');

  // Step 3: Onboarding
  const [goals, setGoals] = useState([]);
  const [alternatives, setAlternatives] = useState([]);
  const [howFoundUs, setHowFoundUs] = useState('');

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
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

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Solo se permiten imagenes (PNG, JPG)');
      return;
    }
    if (file.size > 500 * 1024) {
      setError('La imagen debe ser menor a 500KB');
      return;
    }

    try {
      const compressed = await compressImage(file);
      setLogoBase64(compressed);
      setLogoPreview(compressed);
      setError('');
    } catch {
      setError('Error al procesar la imagen');
    }
  };

  const removeLogo = () => {
    setLogoBase64(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleChip = (value, list, setList) => {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const validateStep = (s) => {
    setError('');
    if (s === 0) {
      if (!name.trim()) { setError('Ingresa tu nombre'); return false; }
      if (!email.trim()) { setError('Ingresa tu correo'); return false; }
      if (pin.length < 4) { setError('El PIN debe tener al menos 4 caracteres'); return false; }
    }
    if (s === 1) {
      if (!orgName.trim()) { setError('Ingresa el nombre de tu organizacion'); return false; }
      if (!businessType) { setError('Selecciona el tipo de negocio'); return false; }
      if (!teamSize) { setError('Selecciona el tamano del equipo'); return false; }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep(step + 1);
      setError('');
    }
  };

  const prevStep = () => {
    setError('');
    setStep(step - 1);
  };

  const handleSubmit = async (skipOnboarding = false) => {
    setError('');
    setLoading(true);

    const payload = {
      name: name.trim(),
      email: email.trim(),
      pin,
      org_name: orgName.trim(),
    };

    if (logoBase64) {
      payload.logo_base64 = logoBase64;
    }

    payload.onboarding = {
      business_type: businessType,
      team_size: teamSize,
      goals: skipOnboarding ? [] : goals,
      alternatives: skipOnboarding ? [] : alternatives,
      how_found_us: skipOnboarding ? null : howFoundUs || null,
    };

    try {
      const response = await authAPI.register(payload);
      const { token, user, current_org } = response.data;

      localStorage.setItem('authToken', token);
      localStorage.setItem('authUser', JSON.stringify(user));
      if (current_org) {
        localStorage.setItem('currentOrg', JSON.stringify(current_org));
      }

      setAuthToken(token);
      window.location.href = '/';
    } catch (err) {
      const message = err.response?.data?.error || 'Error al registrar';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Input class helper
  const inputClass = 'w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-[#1A1A2E] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all';
  const selectClass = 'w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all appearance-none';

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-green-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-lg relative">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <OrbitLogo size={48} />
          </div>
          <h1 className="text-2xl font-bold text-[#1A1A2E]">Crea tu organizacion</h1>
          <p className="text-gray-500 mt-1">Registrate gratis y empieza a gestionar tu equipo</p>
        </div>

        {/* Step Progress */}
        <div className="flex items-center justify-center mb-8">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                    i < step
                      ? 'bg-green-500 text-white'
                      : i === step
                      ? 'bg-[#1A1A2E] text-white'
                      : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {i < step ? <Check size={16} /> : i + 1}
                </div>
                <span className={`text-xs mt-1.5 font-medium ${
                  i <= step ? 'text-[#1A1A2E]' : 'text-gray-400'
                }`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-16 h-0.5 mx-2 mb-5 transition-all duration-300 ${
                  i < step ? 'bg-green-500' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100 mb-6">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* ========== STEP 1: Account ========== */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tu nombre</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                    placeholder="Juan Felipe"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Correo electronico</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    placeholder="tu@email.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">PIN de acceso</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className={inputClass}
                    placeholder="Minimo 4 caracteres"
                    minLength={4}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <button
                onClick={nextStep}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#1A1A2E] hover:bg-[#2A2A3E] text-white font-medium rounded-xl transition-all duration-200"
              >
                <span>Siguiente</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* ========== STEP 2: Organization ========== */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nombre de tu organizacion</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Building2 className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className={inputClass}
                    placeholder="Mi Empresa"
                    autoFocus
                  />
                </div>
              </div>

              {/* Logo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Logo <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                {logoPreview ? (
                  <div className="flex items-center gap-4">
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="w-16 h-16 rounded-xl object-contain border border-gray-200 bg-gray-50 p-1"
                    />
                    <button
                      onClick={removeLogo}
                      className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 transition-colors"
                    >
                      <X size={16} />
                      Quitar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-all"
                  >
                    <Upload size={20} />
                    <span className="text-sm">PNG o JPG, max 500KB</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </div>

              {/* Business Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de negocio</label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Selecciona...</option>
                  {BUSINESS_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Team Size */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tamano del equipo</label>
                <select
                  value={teamSize}
                  onChange={(e) => setTeamSize(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Selecciona...</option>
                  {TEAM_SIZES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={prevStep}
                  className="flex items-center justify-center gap-1 px-4 py-3 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Atras
                </button>
                <button
                  onClick={nextStep}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-[#1A1A2E] hover:bg-[#2A2A3E] text-white font-medium rounded-xl transition-all duration-200"
                >
                  <span>Siguiente</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* ========== STEP 3: Onboarding (skippable) ========== */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Goals */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Que quieres lograr con Orbit?
                </label>
                <div className="flex flex-wrap gap-2">
                  {GOALS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleChip(g, goals, setGoals)}
                      className={`px-3.5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                        goals.includes(g)
                          ? 'bg-green-500 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Alternatives */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Que herramientas has usado?
                </label>
                <div className="flex flex-wrap gap-2">
                  {ALTERNATIVES.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => toggleChip(a, alternatives, setAlternatives)}
                      className={`px-3.5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                        alternatives.includes(a)
                          ? 'bg-green-500 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              {/* How Found Us */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Como nos encontraste?</label>
                <select
                  value={howFoundUs}
                  onChange={(e) => setHowFoundUs(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Selecciona...</option>
                  {HOW_FOUND_US.map((h) => (
                    <option key={h.value} value={h.value}>{h.label}</option>
                  ))}
                </select>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={prevStep}
                  disabled={loading}
                  className="flex items-center justify-center gap-1 px-4 py-3 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-all disabled:opacity-50"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Atras
                </button>
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={loading}
                  className="flex items-center justify-center gap-1 px-4 py-3 text-gray-500 font-medium rounded-xl hover:bg-gray-50 transition-all disabled:opacity-50"
                >
                  <SkipForward size={16} />
                  Omitir
                </button>
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-[#1A1A2E] hover:bg-[#2A2A3E] text-white font-medium rounded-xl transition-all duration-200 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                      <span>Creando cuenta...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-5 h-5" />
                      <span>Completar y empezar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-400 mt-6">
          Ya tienes cuenta?{' '}
          <Link to="/login" className="text-gray-700 font-medium hover:text-gray-900 transition-colors">
            Inicia sesion
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
