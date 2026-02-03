import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings,
  Key,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  CreditCard,
  Percent,
  Link2,
  ExternalLink,
  Users,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const SiigoSettings = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(null);
  const [username, setUsername] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState(null);
  const [referenceData, setReferenceData] = useState({
    documentTypes: [],
    paymentTypes: [],
    taxes: []
  });

  useEffect(() => {
    fetchSettings();
    fetchReferenceData();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/siigo/settings`);
      const data = await res.json();
      setSettings(data);
      if (data?.username) {
        setUsername(data.username);
      }
      if (data?.partner_id) {
        setPartnerId(data.partner_id);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchReferenceData = async () => {
    try {
      const [docTypes, payTypes, taxes] = await Promise.all([
        fetch(`${API_URL}/siigo/document-types`).then(r => r.json()),
        fetch(`${API_URL}/siigo/payment-types`).then(r => r.json()),
        fetch(`${API_URL}/siigo/taxes`).then(r => r.json())
      ]);
      setReferenceData({
        documentTypes: docTypes || [],
        paymentTypes: payTypes || [],
        taxes: taxes || []
      });
    } catch (error) {
      console.error('Error fetching reference data:', error);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`${API_URL}/siigo/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, access_key: accessKey, partner_id: partnerId })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error saving credentials');
      }

      setMessage({ type: 'success', text: 'Credenciales guardadas y verificadas correctamente' });
      setAccessKey('');
      fetchSettings();
      fetchReferenceData();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setMessage(null);

    try {
      const res = await fetch(`${API_URL}/siigo/test-connection`, {
        method: 'POST'
      });
      const data = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Conexión exitosa con Siigo' });
      } else {
        setMessage({ type: 'error', text: data.message || 'Error de conexión' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSyncReferenceData = async () => {
    setIsSyncing(true);
    setMessage(null);

    try {
      const res = await fetch(`${API_URL}/siigo/sync-reference-data`, {
        method: 'POST'
      });
      const data = await res.json();

      if (data.success) {
        setMessage({
          type: 'success',
          text: `Datos sincronizados: ${data.documentTypes} tipos de documento, ${data.paymentTypes} métodos de pago, ${data.taxes} impuestos`
        });
        fetchReferenceData();
        fetchSettings();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsSyncing(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Nunca';
    return new Date(dateStr).toLocaleString('es-CO');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#1A1A2E]">Integración Siigo</h1>
          <p className="text-gray-500 text-sm mt-1">
            Configura la conexión con Siigo para facturación electrónica
          </p>
        </div>
        <a
          href="https://siigonube.portaldeclientes.siigo.com/informacion-siigo-api/"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary flex items-center gap-2"
        >
          <ExternalLink size={16} />
          Documentación
        </a>
      </div>

      {/* Connection Status */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#1A1A2E] flex items-center gap-2">
            <Link2 size={20} />
            Estado de Conexión
          </h2>
          {settings?.has_token ? (
            <span className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-sm font-medium">
              <CheckCircle size={16} />
              Conectado
            </span>
          ) : (
            <span className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1 rounded-full text-sm font-medium">
              <AlertCircle size={16} />
              No configurado
            </span>
          )}
        </div>

        {settings && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Usuario</p>
              <p className="font-medium text-[#1A1A2E]">{settings.username || '-'}</p>
            </div>
            <div>
              <p className="text-gray-500">Token válido hasta</p>
              <p className="font-medium text-[#1A1A2E]">{formatDate(settings.token_expires_at)}</p>
            </div>
            <div>
              <p className="text-gray-500">Última sincronización</p>
              <p className="font-medium text-[#1A1A2E]">{formatDate(settings.last_sync_at)}</p>
            </div>
            <div>
              <p className="text-gray-500">Creado</p>
              <p className="font-medium text-[#1A1A2E]">{formatDate(settings.created_at)}</p>
            </div>
          </div>
        )}

        {settings?.has_token && (
          <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100">
            <button
              onClick={handleTestConnection}
              disabled={isTesting}
              className="btn-secondary flex items-center gap-2"
            >
              {isTesting ? <RefreshCw className="animate-spin" size={16} /> : <CheckCircle size={16} />}
              Probar Conexión
            </button>
            <button
              onClick={handleSyncReferenceData}
              disabled={isSyncing}
              className="btn-secondary flex items-center gap-2"
            >
              {isSyncing ? <RefreshCw className="animate-spin" size={16} /> : <RefreshCw size={16} />}
              Sincronizar Datos
            </button>
            <button
              onClick={() => navigate('/app/siigo/customers')}
              className="btn-primary flex items-center gap-2"
            >
              <Users size={16} />
              Ver Clientes de Siigo
            </button>
            <button
              onClick={() => navigate('/app/siigo/invoices')}
              className="btn-primary flex items-center gap-2"
            >
              <FileText size={16} />
              Ver Facturas de Siigo
            </button>
          </div>
        )}
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.type === 'success' ? <CheckCircle size={20} /> : <XCircle size={20} />}
          {message.text}
        </div>
      )}

      {/* Credentials Form */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-[#1A1A2E] flex items-center gap-2 mb-4">
          <Key size={20} />
          Credenciales de API
        </h2>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="label">Usuario (Email)</label>
              <input
                type="email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="usuario@empresa.com"
                className="input"
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                Email registrado en Siigo
              </p>
            </div>
            <div>
              <label className="label">Access Key</label>
              <input
                type="password"
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                placeholder={settings?.has_token ? '••••••••••••' : 'Ingresa tu access key'}
                className="input"
                required={!settings?.has_token}
              />
              <p className="text-xs text-gray-400 mt-1">
                Obtén tu clave en Siigo → Alianzas e Integraciones
              </p>
            </div>
          </div>

          <div>
            <label className="label">Partner ID</label>
            <input
              type="text"
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
              placeholder="Tu Partner ID de Siigo"
              className="input"
            />
            <p className="text-xs text-gray-400 mt-1">
              El Partner ID es proporcionado por Siigo al registrarte como integrador.
              Contacta a Siigo si no lo tienes.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="btn-primary flex items-center gap-2"
            >
              {isSaving ? <RefreshCw className="animate-spin" size={16} /> : <Settings size={16} />}
              {settings?.has_token ? 'Actualizar Credenciales' : 'Guardar y Conectar'}
            </button>
          </div>
        </form>
      </div>

      {/* Reference Data */}
      {(referenceData.documentTypes.length > 0 || referenceData.paymentTypes.length > 0 || referenceData.taxes.length > 0) && (
        <div className="grid md:grid-cols-3 gap-6">
          {/* Document Types */}
          <div className="card p-4">
            <h3 className="font-semibold text-[#1A1A2E] flex items-center gap-2 mb-3">
              <FileText size={18} />
              Tipos de Documento ({referenceData.documentTypes.length})
            </h3>
            <div className="space-y-2 max-h-48 overflow-auto">
              {referenceData.documentTypes.map(doc => (
                <div key={doc.id} className="flex justify-between text-sm p-2 bg-gray-50 rounded-lg">
                  <span className="text-gray-700">{doc.name}</span>
                  <span className="text-gray-400">{doc.code}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Types */}
          <div className="card p-4">
            <h3 className="font-semibold text-[#1A1A2E] flex items-center gap-2 mb-3">
              <CreditCard size={18} />
              Métodos de Pago ({referenceData.paymentTypes.length})
            </h3>
            <div className="space-y-2 max-h-48 overflow-auto">
              {referenceData.paymentTypes.map(pay => (
                <div key={pay.id} className="flex justify-between text-sm p-2 bg-gray-50 rounded-lg">
                  <span className="text-gray-700">{pay.name}</span>
                  <span className="text-gray-400">{pay.type}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Taxes */}
          <div className="card p-4">
            <h3 className="font-semibold text-[#1A1A2E] flex items-center gap-2 mb-3">
              <Percent size={18} />
              Impuestos ({referenceData.taxes.length})
            </h3>
            <div className="space-y-2 max-h-48 overflow-auto">
              {referenceData.taxes.map(tax => (
                <div key={tax.id} className="flex justify-between text-sm p-2 bg-gray-50 rounded-lg">
                  <span className="text-gray-700">{tax.name}</span>
                  <span className="text-gray-400">{tax.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="card p-6 bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">¿Cómo obtener las credenciales?</h3>
        <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
          <li>Ingresa a tu cuenta de <strong>Siigo Nube</strong></li>
          <li>Ve a <strong>Configuración → Alianzas e Integraciones</strong></li>
          <li>Selecciona <strong>"Credenciales de integración a Plataformas Digitales (Siigo API)"</strong></li>
          <li>Copia el <strong>Usuario API</strong> y el <strong>Access Key</strong></li>
          <li>Pega las credenciales en el formulario de arriba</li>
        </ol>
      </div>
    </div>
  );
};

export default SiigoSettings;
