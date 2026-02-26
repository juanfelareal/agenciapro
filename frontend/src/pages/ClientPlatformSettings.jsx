import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Facebook,
  ShoppingBag,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Trash2,
  Loader2,
  Check
} from 'lucide-react';
import { clientsAPI, platformCredentialsAPI, facebookOAuthAPI, shopifyOAuthAPI } from '../utils/api';

function ClientPlatformSettings() {
  const { id: clientId } = useParams();
  const navigate = useNavigate();

  const [client, setClient] = useState(null);
  const [credentials, setCredentials] = useState({ facebook: [], shopify: null });
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState({});

  // Facebook OAuth state
  const [connectingFacebook, setConnectingFacebook] = useState(false);
  const [showAccountsModal, setShowAccountsModal] = useState(false);
  const [availableAccounts, setAvailableAccounts] = useState([]);
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [oauthSessionId, setOauthSessionId] = useState(null);
  const [linkingAccounts, setLinkingAccounts] = useState(false);

  // Shopify OAuth state
  const [connectingShopify, setConnectingShopify] = useState(false);
  const [shopifyOauthSessionId, setShopifyOauthSessionId] = useState(null);
  const [showStoreConfirmModal, setShowStoreConfirmModal] = useState(false);
  const [storeInfo, setStoreInfo] = useState(null);
  const [linkingStore, setLinkingStore] = useState(false);
  const [shopifyStoreUrlInput, setShopifyStoreUrlInput] = useState('');
  const [testResults, setTestResults] = useState({ shopify: null });

  // Load client and credentials
  useEffect(() => {
    loadData();
  }, [clientId]);

  // Listen for OAuth popup messages
  useEffect(() => {
    const handleMessage = async (event) => {
      if (event.data?.type === 'facebook_oauth_success') {
        setConnectingFacebook(false);
        setOauthSessionId(event.data.sessionId);
        // Fetch available ad accounts
        await loadAdAccounts(event.data.sessionId);
      } else if (event.data?.type === 'facebook_oauth_error') {
        setConnectingFacebook(false);
        alert('Error al conectar con Facebook: ' + event.data.error);
      } else if (event.data?.type === 'shopify_oauth_success') {
        setConnectingShopify(false);
        setShopifyOauthSessionId(event.data.sessionId);
        // Load store info for confirmation
        await loadStoreInfo(event.data.sessionId);
      } else if (event.data?.type === 'shopify_oauth_error') {
        setConnectingShopify(false);
        alert('Error al conectar con Shopify: ' + event.data.error);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [clientRes, credentialsRes] = await Promise.all([
        clientsAPI.getById(clientId),
        platformCredentialsAPI.getByClient(clientId)
      ]);

      setClient(clientRes.data);

      // Handle both old (single account) and new (multiple accounts) format
      const fbCredentials = credentialsRes.data.facebook;
      if (fbCredentials) {
        // If it's an array, use it; if it's a single object, wrap in array
        setCredentials({
          facebook: Array.isArray(fbCredentials) ? fbCredentials : [fbCredentials],
          shopify: credentialsRes.data.shopify
        });
      } else {
        setCredentials({
          facebook: [],
          shopify: credentialsRes.data.shopify
        });
      }

      // Pre-fill Shopify store URL input if credentials exist
      if (credentialsRes.data.shopify) {
        setShopifyStoreUrlInput(credentialsRes.data.shopify.store_url || '');
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Facebook OAuth flow
  const connectWithFacebook = async () => {
    try {
      setConnectingFacebook(true);
      const res = await facebookOAuthAPI.getAuthUrl(clientId);

      // Open popup
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.innerWidth - width) / 2;
      const top = window.screenY + (window.innerHeight - height) / 2;

      window.open(
        res.data.authUrl,
        'facebook_oauth',
        `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
      );
    } catch (error) {
      setConnectingFacebook(false);
      alert('Error al iniciar conexión: ' + (error.response?.data?.error || error.message));
    }
  };

  const loadAdAccounts = async (sessionId) => {
    try {
      const res = await facebookOAuthAPI.getAdAccounts(sessionId);
      setAvailableAccounts(res.data.accounts || []);
      setSelectedAccounts([]);
      setShowAccountsModal(true);
    } catch (error) {
      alert('Error al obtener cuentas: ' + (error.response?.data?.error || error.message));
    }
  };

  const toggleAccountSelection = (accountId) => {
    setSelectedAccounts((prev) =>
      prev.includes(accountId)
        ? prev.filter((id) => id !== accountId)
        : [...prev, accountId]
    );
  };

  const linkSelectedAccounts = async () => {
    if (selectedAccounts.length === 0) {
      alert('Selecciona al menos una cuenta');
      return;
    }

    try {
      setLinkingAccounts(true);
      await facebookOAuthAPI.linkAccounts({
        session_id: oauthSessionId,
        client_id: parseInt(clientId),
        account_ids: selectedAccounts
      });

      setShowAccountsModal(false);
      setOauthSessionId(null);
      setSelectedAccounts([]);
      loadData();
      alert('Cuentas vinculadas exitosamente');
    } catch (error) {
      alert('Error al vincular cuentas: ' + (error.response?.data?.error || error.message));
    } finally {
      setLinkingAccounts(false);
    }
  };

  // Test Facebook connection
  const testFacebookAccount = async (credentialId) => {
    try {
      setTesting((prev) => ({ ...prev, [credentialId]: true }));
      await platformCredentialsAPI.testFacebook(credentialId);
      loadData();
    } catch (error) {
      alert('Error al probar conexión: ' + (error.response?.data?.error || error.message));
    } finally {
      setTesting((prev) => ({ ...prev, [credentialId]: false }));
    }
  };

  // Disconnect Facebook account
  const disconnectFacebookAccount = async (credentialId) => {
    if (!confirm('¿Seguro que quieres desconectar esta cuenta?')) return;

    try {
      await facebookOAuthAPI.unlinkAccount(credentialId);
      loadData();
    } catch (error) {
      alert('Error al desconectar: ' + error.message);
    }
  };

  // Shopify OAuth functions
  const connectWithShopify = async () => {
    const storeUrl = shopifyStoreUrlInput.trim();
    if (!storeUrl) {
      alert('Ingresa la URL de tu tienda Shopify');
      return;
    }

    try {
      setConnectingShopify(true);
      const res = await shopifyOAuthAPI.getAuthUrl(clientId, storeUrl);

      // Open popup
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.innerWidth - width) / 2;
      const top = window.screenY + (window.innerHeight - height) / 2;

      window.open(
        res.data.authUrl,
        'shopify_oauth',
        `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
      );
    } catch (error) {
      setConnectingShopify(false);
      alert('Error al iniciar conexión: ' + (error.response?.data?.error || error.message));
    }
  };

  const loadStoreInfo = async (sessionId) => {
    try {
      const res = await shopifyOAuthAPI.getStoreInfo(sessionId);
      setStoreInfo(res.data);
      setShowStoreConfirmModal(true);
    } catch (error) {
      alert('Error al obtener info de la tienda: ' + (error.response?.data?.error || error.message));
    }
  };

  const linkShopifyStore = async () => {
    if (!shopifyOauthSessionId) return;

    try {
      setLinkingStore(true);
      await shopifyOAuthAPI.linkStore({
        session_id: shopifyOauthSessionId,
        client_id: parseInt(clientId)
      });

      setShowStoreConfirmModal(false);
      setShopifyOauthSessionId(null);
      setStoreInfo(null);
      loadData();
      alert('Tienda vinculada exitosamente');
    } catch (error) {
      alert('Error al vincular tienda: ' + (error.response?.data?.error || error.message));
    } finally {
      setLinkingStore(false);
    }
  };

  const testShopify = async () => {
    if (!credentials.shopify?.id) return;

    try {
      setTesting((prev) => ({ ...prev, shopify: true }));
      const res = await platformCredentialsAPI.testShopify(credentials.shopify.id);
      setTestResults((prev) => ({ ...prev, shopify: res.data }));
      loadData();
    } catch (error) {
      setTestResults((prev) => ({
        ...prev,
        shopify: { success: false, error: error.response?.data?.error || error.message }
      }));
    } finally {
      setTesting((prev) => ({ ...prev, shopify: false }));
    }
  };

  const disconnectShopifyOAuth = async () => {
    if (!credentials.shopify?.id) return;
    if (!confirm('¿Seguro que quieres desconectar Shopify?')) return;

    try {
      await shopifyOAuthAPI.unlinkStore(credentials.shopify.id);
      setShopifyStoreUrlInput('');
      setTestResults((prev) => ({ ...prev, shopify: null }));
      loadData();
    } catch (error) {
      alert('Error al desconectar: ' + (error.response?.data?.error || error.message));
    }
  };

  // Status badge component
  const StatusBadge = ({ status }) => {
    const config = {
      active: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Activo' },
      error: { color: 'bg-red-100 text-red-700', icon: XCircle, label: 'Error' },
      expired: { color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle, label: 'Expirado' },
      inactive: { color: 'bg-gray-100 text-gray-700', icon: XCircle, label: 'Inactivo' }
    };

    const cfg = config[status] || config.inactive;
    const Icon = cfg.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
        <Icon className="w-3 h-3" />
        {cfg.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#1A1A2E]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/app/clients')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-[#1A1A2E] tracking-tight">Configurar Plataformas</h1>
          <p className="text-sm text-gray-500 mt-0.5">{client?.company || client?.name}</p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Facebook Ads Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Facebook className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Facebook Ads</h2>
                <p className="text-sm text-gray-500">
                  {credentials.facebook.length > 0
                    ? `${credentials.facebook.length} cuenta(s) conectada(s)`
                    : 'Sin cuentas conectadas'}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6">
            {/* Connected Accounts List */}
            {credentials.facebook.length > 0 && (
              <div className="mb-4 space-y-3">
                {credentials.facebook.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                        <Facebook className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {account.ad_account_name || account.ad_account_id}
                        </p>
                        <p className="text-xs text-gray-500">ID: {account.ad_account_id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={account.status} />
                      <button
                        onClick={() => testFacebookAccount(account.id)}
                        disabled={testing[account.id]}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                        title="Probar conexión"
                      >
                        {testing[account.id] ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => disconnectFacebookAccount(account.id)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Desconectar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Connect Button */}
            <button
              onClick={connectWithFacebook}
              disabled={connectingFacebook}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {connectingFacebook ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  <Facebook className="w-5 h-5" />
                  {credentials.facebook.length > 0 ? 'Agregar otra cuenta' : 'Conectar con Facebook'}
                </>
              )}
            </button>

            <p className="text-xs text-gray-400 mt-3 text-center">
              Se abrirá una ventana para autorizar el acceso a tus cuentas de anuncios
            </p>
          </div>
        </div>

        {/* Shopify Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Shopify</h2>
                <p className="text-sm text-gray-500">
                  {credentials.shopify ? 'Tienda conectada' : 'Sin tienda conectada'}
                </p>
              </div>
            </div>
            {credentials.shopify && <StatusBadge status={credentials.shopify.status} />}
          </div>

          <div className="p-6">
            {/* Connected Store */}
            {credentials.shopify ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                      <ShoppingBag className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{credentials.shopify.store_url}</p>
                      {credentials.shopify.last_sync_at && (
                        <p className="text-xs text-gray-500">
                          Última sync: {new Date(credentials.shopify.last_sync_at).toLocaleString('es-CO')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={testShopify}
                      disabled={testing.shopify}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                      title="Probar conexión"
                    >
                      {testing.shopify ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={disconnectShopifyOAuth}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Desconectar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Test result */}
                {testResults.shopify && (
                  <div className={`p-3 rounded-lg ${testResults.shopify.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {testResults.shopify.success ? (
                      <p>Conexión exitosa: {testResults.shopify.storeName}</p>
                    ) : (
                      <p>Error: {testResults.shopify.error}</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL de la tienda
                  </label>
                  <input
                    type="text"
                    value={shopifyStoreUrlInput}
                    onChange={(e) => setShopifyStoreUrlInput(e.target.value)}
                    placeholder="mi-tienda.myshopify.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <button
                  onClick={connectWithShopify}
                  disabled={connectingShopify}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {connectingShopify ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Conectando...
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-5 h-5" />
                      Conectar con Shopify
                    </>
                  )}
                </button>

                <p className="text-xs text-gray-400 text-center">
                  Se abrirá una ventana para autorizar el acceso a tu tienda
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Shopify Store Confirmation Modal */}
      {showStoreConfirmModal && storeInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Confirmar Tienda</h3>
                <p className="text-sm text-gray-500">Verifica que sea la tienda correcta</p>
              </div>
              <button
                onClick={() => {
                  setShowStoreConfirmModal(false);
                  setShopifyOauthSessionId(null);
                  setStoreInfo(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6">
              <div className="bg-green-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{storeInfo.store.name}</p>
                    <p className="text-sm text-gray-500">{storeInfo.store.url}</p>
                  </div>
                </div>
                <div className="flex gap-4 text-sm text-gray-600">
                  {storeInfo.store.email && (
                    <span>{storeInfo.store.email}</span>
                  )}
                  {storeInfo.store.currency && (
                    <span>Moneda: {storeInfo.store.currency}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowStoreConfirmModal(false);
                  setShopifyOauthSessionId(null);
                  setStoreInfo(null);
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={linkShopifyStore}
                disabled={linkingStore}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {linkingStore ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Vinculando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Vincular tienda
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Selection Modal */}
      {showAccountsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Seleccionar Cuentas de Anuncios</h3>
                <p className="text-sm text-gray-500">Elige las cuentas que deseas vincular</p>
              </div>
              <button
                onClick={() => {
                  setShowAccountsModal(false);
                  setOauthSessionId(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6 max-h-96 overflow-y-auto">
              {availableAccounts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No se encontraron cuentas de anuncios.</p>
                  <p className="text-sm mt-1">Verifica que tengas acceso a cuentas publicitarias en Facebook.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableAccounts.map((account) => (
                    <label
                      key={account.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        account.isLinked
                          ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                          : selectedAccounts.includes(account.id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedAccounts.includes(account.id) || account.isLinked}
                        disabled={account.isLinked}
                        onChange={() => !account.isLinked && toggleAccountSelection(account.id)}
                        className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-50"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{account.name}</p>
                        <p className="text-xs text-gray-500">
                          {account.id} {account.business && `• ${account.business}`}
                        </p>
                      </div>
                      {account.isLinked && (
                        <span className="text-xs text-gray-400 bg-gray-200 px-2 py-1 rounded">
                          Ya vinculada
                        </span>
                      )}
                      {account.status === 'inactive' && !account.isLinked && (
                        <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded">
                          Inactiva
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAccountsModal(false);
                  setOauthSessionId(null);
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={linkSelectedAccounts}
                disabled={selectedAccounts.length === 0 || linkingAccounts}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {linkingAccounts ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Vinculando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Vincular {selectedAccounts.length > 0 && `(${selectedAccounts.length})`}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClientPlatformSettings;
