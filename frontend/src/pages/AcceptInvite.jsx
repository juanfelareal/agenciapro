// [email] Aceptar invitación al equipo: la persona define su PIN y entra.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Lock, AlertCircle, Building2 } from 'lucide-react';
import { teamAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import OrbitLogo from '../components/OrbitLogo';

const inputClass = 'w-full pl-12 pr-4 py-3 bg-gray-50 border border-ink-200 rounded-xl text-[#17181A] placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all';
const buttonClass = 'w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-[#17181A] to-ink-800 hover:from-ink-800 hover:to-ink-700 text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-[#17181A]/20 disabled:opacity-50 disabled:cursor-not-allowed';

const AcceptInvite = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [invite, setInvite] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    let active = true;
    teamAPI.getInvite(token)
      .then((res) => { if (active) setInvite(res.data); })
      .catch((err) => { if (active) setLoadError(err.response?.data?.error || 'Invitación no válida'); });
    return () => { active = false; };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!invite?.has_pin) {
      if (pin.length < 4) return setError('El PIN debe tener al menos 4 caracteres');
      if (pin !== confirmPin) return setError('Los PINs no coinciden');
    }
    setLoading(true);
    try {
      const res = await teamAPI.acceptInvite(token, invite?.has_pin ? '' : pin);
      if (res.data?.has_pin) {
        setDone({ existing: true, email: res.data.email });
        return;
      }
      const result = await login(invite.email, pin);
      if (result.success) {
        navigate(result.needsOrgSelection ? '/select-org' : '/app', { replace: true });
        return;
      }
      setDone({ existing: false, email: invite.email });
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo aceptar la invitación');
    } finally {
      setLoading(false);
    }
  };

  const Shell = ({ children }) => (
    <div className="min-h-screen app-mist flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#D7F653]/25 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#D7F653]/15 rounded-full blur-3xl"></div>
      </div>
      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-2"><OrbitLogo size={56} /></div>
        </div>
        <div className="card p-8">{children}</div>
        <p className="text-center text-sm text-ink-400 mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-ink-700 font-medium hover:text-ink-900 transition-colors">Inicia sesión</Link>
        </p>
      </div>
    </div>
  );

  if (loadError) {
    return (
      <Shell>
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-700">{loadError}</p>
            <p className="text-sm text-red-600 mt-1">Pide a un administrador de tu equipo que te reenvíe la invitación desde Orbit.</p>
          </div>
        </div>
      </Shell>
    );
  }

  if (!invite) {
    return (
      <Shell>
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent mx-auto"></div>
        <p className="mt-4 text-ink-600 text-center text-sm">Verificando invitación...</p>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-[#17181A] tracking-tight mb-2">
          {done.existing ? 'Ya eres parte del equipo' : 'PIN definido'}
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          {done.existing
            ? `Tu cuenta ${done.email} ya existía en Orbit, así que tu PIN no cambió. Entra con el PIN que ya usas.`
            : `Inicia sesión con ${done.email} y tu PIN nuevo.`}
        </p>
        <Link to="/login" className={buttonClass}>Ir a iniciar sesión</Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex items-center gap-3 mb-6">
        {invite.org_logo ? (
          <img src={invite.org_logo} alt={invite.org_name} className="w-12 h-12 object-contain rounded-xl border border-gray-200 bg-white p-1" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-[#17181A] flex items-center justify-center"><Building2 size={20} className="text-[#D7F653]" /></div>
        )}
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">Invitación de</p>
          <p className="text-base font-semibold text-[#17181A]">{invite.org_name}</p>
        </div>
      </div>

      <h1 className="text-xl font-semibold text-[#17181A] tracking-tight mb-1">
        {invite.member_name ? `Hola, ${invite.member_name.split(' ')[0]}` : 'Hola'}
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        {invite.has_pin
          ? `Ya tienes cuenta en Orbit con ${invite.email}. Confirma para unirte a ${invite.org_name} y entra con tu PIN actual.`
          : `Define el PIN con el que entrarás a Orbit con ${invite.email}.`}
      </p>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100 mb-5">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {!invite.has_pin && (
          <>
            <div>
              <label htmlFor="pin" className="block text-sm font-medium text-ink-700 mb-2">PIN de acceso</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Lock className="w-5 h-5 text-ink-400" /></div>
                <input id="pin" type="password" value={pin} onChange={(e) => setPin(e.target.value)} className={inputClass} placeholder="Mínimo 4 caracteres" required autoComplete="new-password" autoFocus />
              </div>
            </div>
            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-ink-700 mb-2">Confirma tu PIN</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Lock className="w-5 h-5 text-ink-400" /></div>
                <input id="confirm" type="password" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} className={inputClass} placeholder="Repite el PIN" required autoComplete="new-password" />
              </div>
            </div>
          </>
        )}
        <button type="submit" disabled={loading} className={buttonClass}>
          {loading ? 'Guardando...' : invite.has_pin ? 'Unirme al equipo' : 'Definir PIN y entrar'}
        </button>
      </form>
    </Shell>
  );
};

export default AcceptInvite;
