import { useState, useEffect } from 'react';
import {
  Settings,
  Key,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Link2,
  Unlink,
  Instagram,
  Video,
} from 'lucide-react';
import { zernioAPI } from '../../utils/api';

const ZernioSettings = () => {
  const [settings, setSettings] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await zernioAPI.getSettings();
      setSettings(res.data);

      if (res.data?.is_configured) {
        fetchAccounts();
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const res = await zernioAPI.getAccounts();
      setAccounts(res.data || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const res = await zernioAPI.saveSettings(apiKey);

      if (res.data.success) {
        setMessage({ type: 'success', text: 'API key guardada y verificada correctamente' });
        setApiKey('');
        setAccounts(res.data.accounts || []);
        fetchSettings();
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message;
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setMessage(null);

    try {
      const res = await zernioAPI.testConnection();

      if (res.data.success) {
        setMessage({ type: 'success', text: `Conexion exitosa - ${res.data.accountCount} cuentas conectadas` });
        setAccounts(res.data.accounts || []);
      } else {
        setMessage({ type: 'error', text: res.data.error || 'Error de conexion' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || error.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('¿Estas seguro de desconectar Zernio? Perderas acceso a todas las funciones de Social Media.')) {
      return;
    }

    try {
      await zernioAPI.disconnect();
      setSettings({ is_configured: false });
      setAccounts([]);
      setMessage({ type: 'success', text: 'Zernio desconectado' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || error.message });
    }
  };

  const getPlatformIcon = (platform) => {
    switch (platform?.toLowerCase()) {
      case 'instagram':
        return <Instagram className="w-5 h-5 text-pink-500" />;
      case 'tiktok':
        return <Video className="w-5 h-5 text-gray-800" />;
      default:
        return <Link2 className="w-5 h-5 text-gray-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              settings?.is_configured ? 'bg-green-100' : 'bg-gray-100'
            }`}>
              <Settings className={`w-5 h-5 ${
                settings?.is_configured ? 'text-green-600' : 'text-gray-400'
              }`} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Estado de Conexion</h3>
              <p className="text-sm text-gray-500">
                {settings?.is_configured
                  ? 'Zernio esta conectado y funcionando'
                  : 'Configura tu API key de Zernio para empezar'
                }
              </p>
            </div>
          </div>
          {settings?.is_configured && (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 text-sm font-medium rounded-full">
                <CheckCircle className="w-4 h-4" />
                Conectado
              </span>
            </div>
          )}
        </div>

        {settings?.last_sync_at && (
          <p className="text-xs text-gray-400">
            Ultima sincronizacion: {new Date(settings.last_sync_at).toLocaleString()}
          </p>
        )}

        {settings?.last_error && (
          <div className="mt-3 p-3 bg-red-50 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{settings.last_error}</p>
          </div>
        )}
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success'
            ? <CheckCircle className="w-5 h-5" />
            : <XCircle className="w-5 h-5" />
          }
          <span>{message.text}</span>
        </div>
      )}

      {/* API Key Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <Key className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">API Key de Zernio</h3>
            <p className="text-sm text-gray-500">
              Obten tu API key desde Zernio &gt; Settings &gt; API Keys
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={settings?.is_configured ? '••••••••••••••••' : 'Ingresa tu API key'}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!apiKey || isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Key className="w-4 h-4" />
                  {settings?.is_configured ? 'Actualizar API Key' : 'Conectar Zernio'}
                </>
              )}
            </button>

            {settings?.is_configured && (
              <>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2"
                >
                  {isTesting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Probando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Probar Conexion
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2"
                >
                  <Unlink className="w-4 h-4" />
                  Desconectar
                </button>
              </>
            )}
          </div>
        </form>
      </div>

      {/* Connected Accounts */}
      {settings?.is_configured && accounts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Cuentas Conectadas</h3>
              <p className="text-sm text-gray-500">
                {accounts.length} cuenta{accounts.length !== 1 ? 's' : ''} vinculada{accounts.length !== 1 ? 's' : ''} en Zernio
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {getPlatformIcon(account.platform)}
                  <div>
                    <p className="font-medium text-gray-900">
                      @{account.username || account.displayName || account.id}
                    </p>
                    <p className="text-sm text-gray-500 capitalize">{account.platform}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">
                    {account.followers?.toLocaleString() || account.followerCount?.toLocaleString() || '—'}
                  </p>
                  <p className="text-xs text-gray-500">seguidores</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Help */}
      <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
        <h4 className="font-semibold text-blue-900 mb-2">¿Como obtener tu API Key?</h4>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Inicia sesion en <a href="https://app.zernio.com" target="_blank" rel="noopener noreferrer" className="underline">Zernio</a></li>
          <li>Ve a Settings &gt; API Keys</li>
          <li>Crea una nueva API Key o copia una existente</li>
          <li>Pegala aqui y haz clic en "Conectar Zernio"</li>
        </ol>
      </div>
    </div>
  );
};

export default ZernioSettings;
