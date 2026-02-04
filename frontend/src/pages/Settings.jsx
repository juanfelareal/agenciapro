import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { teamAPI } from '../utils/api';
import { User, Key, Eye, EyeOff, LogOut, AlertTriangle, Shield } from 'lucide-react';

const Settings = () => {
  const { user, currentOrg, logout } = useAuth();
  const navigate = useNavigate();

  // Change PIN state
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showCurrentPin, setShowCurrentPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinMessage, setPinMessage] = useState(null);

  // Leave org state
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveConfirmText, setLeaveConfirmText] = useState('');
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveError, setLeaveError] = useState('');

  const handleChangePin = async (e) => {
    e.preventDefault();
    setPinMessage(null);

    if (newPin.length < 4) {
      setPinMessage({ type: 'error', text: 'El nuevo PIN debe tener al menos 4 caracteres' });
      return;
    }

    if (newPin !== confirmPin) {
      setPinMessage({ type: 'error', text: 'Los PINs no coinciden' });
      return;
    }

    setPinLoading(true);
    try {
      await teamAPI.changePin(currentPin, newPin);
      setPinMessage({ type: 'success', text: 'PIN actualizado correctamente' });
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    } catch (error) {
      setPinMessage({ type: 'error', text: error.response?.data?.error || 'Error al cambiar el PIN' });
    } finally {
      setPinLoading(false);
    }
  };

  const handleLeaveOrg = async () => {
    setLeaveError('');
    setLeaveLoading(true);
    try {
      await teamAPI.leaveOrg();
      await logout();
      navigate('/login');
    } catch (error) {
      setLeaveError(error.response?.data?.error || 'Error al salir de la organización');
    } finally {
      setLeaveLoading(false);
    }
  };

  const roleLabels = {
    admin: 'Administrador',
    manager: 'Manager',
    member: 'Miembro',
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold text-[#1A1A2E] tracking-tight">Mi Cuenta</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configura tu perfil y preferencias</p>
      </div>

      {/* Profile Info Card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#1A1A2E] flex items-center justify-center">
            <User size={20} className="text-[#BFFF00]" />
          </div>
          <h2 className="text-lg font-semibold text-[#1A1A2E]">Información Personal</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Nombre</label>
            <p className="text-sm font-medium text-[#1A1A2E]">{user?.name || '-'}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Email</label>
            <p className="text-sm font-medium text-[#1A1A2E]">{user?.email || '-'}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Cargo</label>
            <p className="text-sm font-medium text-[#1A1A2E]">{user?.position || '-'}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Rol</label>
            <div className="flex items-center gap-2">
              <Shield size={14} className="text-gray-400" />
              <p className="text-sm font-medium text-[#1A1A2E]">{roleLabels[user?.role] || user?.role || '-'}</p>
            </div>
          </div>
        </div>

        {currentOrg && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Organización</label>
            <div className="flex items-center gap-3">
              {currentOrg.logo_url && (
                <img src={currentOrg.logo_url} alt={currentOrg.name} className="h-8 object-contain" />
              )}
              <p className="text-sm font-medium text-[#1A1A2E]">{currentOrg.name}</p>
            </div>
          </div>
        )}
      </div>

      {/* Change PIN Card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#1A1A2E] flex items-center justify-center">
            <Key size={20} className="text-[#BFFF00]" />
          </div>
          <h2 className="text-lg font-semibold text-[#1A1A2E]">Cambiar PIN</h2>
        </div>

        {pinMessage && (
          <div className={`mb-4 p-3 rounded-xl text-sm ${
            pinMessage.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-600'
          }`}>
            {pinMessage.text}
          </div>
        )}

        <form onSubmit={handleChangePin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">PIN actual</label>
            <div className="relative">
              <input
                type={showCurrentPin ? 'text' : 'password'}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-lg pr-10 focus:outline-none focus:ring-2 focus:ring-[#BFFF00]/30 focus:border-[#BFFF00]"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPin(!showCurrentPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCurrentPin ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nuevo PIN</label>
            <div className="relative">
              <input
                type={showNewPin ? 'text' : 'password'}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                required
                minLength={4}
                placeholder="Mínimo 4 caracteres"
                className="w-full px-3 py-2 border rounded-lg pr-10 focus:outline-none focus:ring-2 focus:ring-[#BFFF00]/30 focus:border-[#BFFF00]"
              />
              <button
                type="button"
                onClick={() => setShowNewPin(!showNewPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNewPin ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Confirmar nuevo PIN</label>
            <input
              type="password"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              required
              minLength={4}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BFFF00]/30 focus:border-[#BFFF00]"
            />
          </div>
          <button
            type="submit"
            disabled={pinLoading}
            className="px-4 py-2.5 bg-[#1A1A2E] text-white rounded-xl hover:bg-[#252542] transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {pinLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Actualizando...
              </>
            ) : (
              <>
                <Key size={16} />
                Cambiar PIN
              </>
            )}
          </button>
        </form>
      </div>

      {/* Danger Zone Card */}
      <div className="bg-white rounded-2xl border border-red-200 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
            <AlertTriangle size={20} className="text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-red-700">Zona de Peligro</h2>
        </div>

        <div className="p-4 bg-red-50 rounded-xl">
          <div className="flex items-start gap-3">
            <LogOut size={20} className="text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-800">Salir de la organización</h3>
              <p className="text-sm text-red-600 mt-1">
                Te desvincularás de <strong>{currentOrg?.name || 'esta organización'}</strong>. Perderás acceso a todos los datos y no podrás volver a menos que un administrador te vuelva a invitar.
              </p>
              <button
                onClick={() => setShowLeaveModal(true)}
                className="mt-3 px-4 py-2 bg-red-600 text-white text-sm rounded-xl hover:bg-red-700 transition-colors"
              >
                Salir de la organización
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Leave Org Confirmation Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                  <AlertTriangle size={20} className="text-red-600" />
                </div>
                <h2 className="text-lg font-semibold text-[#1A1A2E]">Confirmar salida</h2>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Para confirmar, escribe el nombre de la organización: <strong>{currentOrg?.name}</strong>
              </p>

              {leaveError && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
                  {leaveError}
                </div>
              )}

              <input
                type="text"
                value={leaveConfirmText}
                onChange={(e) => setLeaveConfirmText(e.target.value)}
                placeholder="Nombre de la organización"
                className="w-full px-3 py-2 border rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-300"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-gray-100">
              <button
                onClick={() => {
                  setShowLeaveModal(false);
                  setLeaveConfirmText('');
                  setLeaveError('');
                }}
                className="px-4 py-2.5 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleLeaveOrg}
                disabled={leaveLoading || leaveConfirmText !== currentOrg?.name}
                className="px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {leaveLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Saliendo...
                  </>
                ) : (
                  'Confirmar salida'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
