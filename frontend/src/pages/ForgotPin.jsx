// [email] Recuperar PIN en dos pasos: correo → código de 6 dígitos + PIN nuevo.
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, KeyRound, Lock, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { authAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import OrbitLogo from '../components/OrbitLogo';

const inputClass = 'w-full pl-12 pr-4 py-3 bg-gray-50 border border-ink-200 rounded-xl text-[#17181A] placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all';
const buttonClass = 'w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-[#17181A] to-ink-800 hover:from-ink-800 hover:to-ink-700 text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-[#17181A]/20 disabled:opacity-50 disabled:cursor-not-allowed';

const ForgotPin = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(searchParams.get('email') ? 2 : 1);
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [code, setCode] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const requestCode = async (e) => {
    e?.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authAPI.forgotPin(email.trim());
      setInfo('Si el correo existe, te enviamos un código de 6 dígitos. Vence en 15 minutos.');
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'No pudimos enviar el código. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const resetPin = async (e) => {
    e.preventDefault();
    setError('');
    if (newPin.length < 4) return setError('El PIN debe tener al menos 4 caracteres');
    if (newPin !== confirmPin) return setError('Los PINs no coinciden');
    setLoading(true);
    try {
      await authAPI.resetPinWithCode(email.trim(), code.replace(/\s+/g, ''), newPin);
      const result = await login(email.trim(), newPin);
      if (result.success) {
        navigate(result.needsOrgSelection ? '/select-org' : '/app', { replace: true });
        return;
      }
      setInfo('PIN actualizado. Inicia sesión con tu PIN nuevo.');
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || 'Código inválido o vencido.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen app-mist flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#D7F653]/25 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#D7F653]/15 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-2">
            <OrbitLogo size={56} />
          </div>
          <h1 className="text-xl font-semibold text-[#17181A] tracking-tight">Recuperar PIN</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {step === 1 && 'Te enviamos un código a tu correo para definir un PIN nuevo.'}
            {step === 2 && 'Escribe el código que llegó a tu correo y elige tu PIN nuevo.'}
            {step === 3 && 'Listo. Tu PIN cambió.'}
          </p>
        </div>

        <div className="card p-8">
          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100 mb-5">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          {info && !error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100 mb-5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <p className="text-sm text-emerald-700">{info}</p>
            </div>
          )}

          {step === 1 && (
            <form onSubmit={requestCode} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-ink-700 mb-2">Correo electrónico</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Mail className="w-5 h-5 text-ink-400" /></div>
                  <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="tu@email.com" required autoComplete="email" autoFocus />
                </div>
              </div>
              <button type="submit" disabled={loading} className={buttonClass}>
                {loading ? 'Enviando...' : 'Enviarme el código'}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={resetPin} className="space-y-5">
              <div>
                <label htmlFor="email2" className="block text-sm font-medium text-ink-700 mb-2">Correo electrónico</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Mail className="w-5 h-5 text-ink-400" /></div>
                  <input id="email2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} required autoComplete="email" />
                </div>
              </div>
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-ink-700 mb-2">Código de 6 dígitos</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><KeyRound className="w-5 h-5 text-ink-400" /></div>
                  <input id="code" type="text" inputMode="numeric" pattern="[0-9 ]*" maxLength={7} value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d\s]/g, ''))} className={`${inputClass} tracking-[0.4em] font-semibold`} placeholder="000000" required autoComplete="one-time-code" autoFocus />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="newPin" className="block text-sm font-medium text-ink-700 mb-2">PIN nuevo</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Lock className="w-5 h-5 text-ink-400" /></div>
                    <input id="newPin" type="password" value={newPin} onChange={(e) => setNewPin(e.target.value)} className={inputClass} placeholder="Mínimo 4" required autoComplete="new-password" />
                  </div>
                </div>
                <div>
                  <label htmlFor="confirmPin" className="block text-sm font-medium text-ink-700 mb-2">Confirmar</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Lock className="w-5 h-5 text-ink-400" /></div>
                    <input id="confirmPin" type="password" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} className={inputClass} placeholder="Repite el PIN" required autoComplete="new-password" />
                  </div>
                </div>
              </div>
              <button type="submit" disabled={loading} className={buttonClass}>
                {loading ? 'Guardando...' : 'Cambiar PIN y entrar'}
              </button>
              <button type="button" onClick={requestCode} disabled={loading || !email} className="w-full text-sm text-ink-500 hover:text-ink-900 transition-colors">
                ¿No llegó? Enviar otro código
              </button>
            </form>
          )}

          {step === 3 && (
            <Link to="/login" className={buttonClass}>Ir a iniciar sesión</Link>
          )}
        </div>

        <p className="text-center text-sm text-ink-400 mt-6">
          <Link to="/login" className="inline-flex items-center gap-1 text-ink-700 font-medium hover:text-ink-900 transition-colors">
            <ArrowLeft size={14} /> Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPin;
