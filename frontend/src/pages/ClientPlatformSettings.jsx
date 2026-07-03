import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Facebook,
  ShoppingBag,
  Chrome,
  Music2,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Trash2,
  Loader2,
  Check
} from 'lucide-react';
import { clientsAPI, platformCredentialsAPI, facebookOAuthAPI, googleAdsOAuthAPI, tiktokOAuthAPI, shopifyOAuthAPI, portalAdminAPI } from '../utils/api';

// WIP: la integración Google Ads / TikTok Ads tiene el backend sin desplegar
// (faltan tablas ga_/tt_ y env vars en prod). Ocultamos las cards hasta terminarla.
const GOOGLE_TIKTOK_ENABLED = false;

function ClientPlatformSettings() {
  const { id: clientId } = useParams();
  const navigate = useNavigate();

  const [client, setClient] = useState(null);
  const [credentials, setCredentials] = useState({ facebook: [], google_ads: [], tiktok: [], shopify: null });
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState({});

  // Facebook OAuth state
  const [connectingFacebook, setConnectingFacebook] = useState(false);
  const [showAccountsModal, setShowAccountsModal] = useState(false);
  const [availableAccounts, setAvailableAccounts] = useState([]);
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [oauthSessionId, setOauthSessionId] = useState(null);
  const [linkingAccounts, setLinkingAccounts] = useState(false);

  // Google Ads OAuth state
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [showGoogleAccountsModal, setShowGoogleAccountsModal] = useState(false);
  const [availableGoogleAccounts, setAvailableGoogleAccounts] = useState([]);
  const [selectedGoogleAccounts, setSelectedGoogleAccounts] = useState([]);
  const [googleOauthSessionId, setGoogleOauthSessionId] = useState(null);
  const [linkingGoogleAccounts, setLinkingGoogleAccounts] = useState(false);

  // TikTok Ads OAuth state
  const [connectingTiktok, setConnectingTiktok] = useState(false);
  const [showTiktokAccountsModal, setShowTiktokAccountsModal] = useState(false);
  const [availableTiktokAccounts, setAvailableTiktokAccounts] = useState([]);
  const [selectedTiktokAccounts, setSelectedTiktokAccounts] = useState([]);
  const [tiktokOauthSessionId, setTiktokOauthSessionId] = useState(null);
  const [linkingTiktokAccounts, setLinkingTiktokAccounts] = useState(false);

  // Shopify OAuth state
  const [connectingShopify, setConnectingShopify] = useState(false);
  const [shopifyOauthSessionId, setShopifyOauthSessionId] = useState(null);
  const [showStoreConfirmModal, setShowStoreConfirmModal] = useState(false);
  const [storeInfo, setStoreInfo] = useState(null);
  const [linkingStore, setLinkingStore] = useState(false);
  const [shopifyStoreUrlInput, setShopifyStoreUrlInput] = useState('');
  const [testResults, setTestResults] = useState({ shopify: null });
  const [shopifyApiKey, setShopifyApiKey] = useState('');
  const [shopifyApiSecret, setShopifyApiSecret] = useState('');
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [hasCustomApp, setHasCustomApp] = useState(false);

  // Portal revenue metric setting
  const [portalRevenueMetric, setPortalRevenueMetric] = useState('confirmed');
  const [savingRevenueMetric, setSavingRevenueMetric] = useState(false);


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
      } else if (event.data?.type === 'google_ads_oauth_success') {
        setConnectingGoogle(false);
        setGoogleOauthSessionId(event.data.sessionId);
        await loadGoogleAccounts(event.data.sessionId);
      } else if (event.data?.type === 'google_ads_oauth_error') {
        setConnectingGoogle(false);
        alert('Error al conectar con Google Ads: ' + event.data.error);
      } else if (event.data?.type === 'tiktok_oauth_success') {
        setConnectingTiktok(false);
        setTiktokOauthSessionId(event.data.sessionId);
        await loadTiktokAccounts(event.data.sessionId);
      } else if (event.data?.type === 'tiktok_oauth_error') {
        setConnectingTiktok(false);
        alert('Error al conectar con TikTok: ' + event.data.error);
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
      const gaCredentials = credentialsRes.data.google_ads || [];
      const ttCredentials = credentialsRes.data.tiktok || [];
      setCredentials({
        facebook: fbCredentials
          ? (Array.isArray(fbCredentials) ? fbCredentials : [fbCredentials])
          : [],
        google_ads: Array.isArray(gaCredentials) ? gaCredentials : [gaCredentials],
        tiktok: Array.isArray(ttCredentials) ? ttCredentials : [ttCredentials],
        shopify: credentialsRes.data.shopify
      });

      // Pre-fill Shopify store URL input and custom app state
      if (credentialsRes.data.shopify) {
        setShopifyStoreUrlInput(credentialsRes.data.shopify.store_url || '');
        setHasCustomApp(!!credentialsRes.data.shopify.has_custom_app);
        if (credentialsRes.data.shopify.shopify_api_key) {
          setShopifyApiKey(credentialsRes.data.shopify.shopify_api_key);
        }
      }

      // Load portal settings for revenue metric
      try {
        const portalRes = await portalAdminAPI.getSettings(clientId);
        if (portalRes.settings?.portal_revenue_metric) {
          setPortalRevenueMetric(portalRes.settings.portal_revenue_metric);
        }
      } catch (e) {
        // Settings may not exist yet, use default
      }

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveRevenueMetric = async (value) => {
    setSavingRevenueMetric(true);
    try {
      await portalAdminAPI.updateSettings(clientId, { portal_revenue_metric: value });
      setPortalRevenueMetric(value);
    } catch (error) {
      console.error('Error saving revenue metric:', error);
      alert('Error al guardar configuración');
    } finally {
      setSavingRevenueMetric(false);
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
      const res = await platformCredentialsAPI.testFacebook(credentialId);
      if (res?.data?.success === false) {
        alert('La conexión falló:\n\n' + (res.data.error || 'Error desconocido'));
      }
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

  // Google Ads OAuth flow
  const connectWithGoogle = async () => {
    try {
      setConnectingGoogle(true);
      const res = await googleAdsOAuthAPI.getAuthUrl(clientId);

      const width = 600;
      const height = 700;
      const left = window.screenX + (window.innerWidth - width) / 2;
      const top = window.screenY + (window.innerHeight - height) / 2;

      window.open(
        res.data.authUrl,
        'google_ads_oauth',
        `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
      );
    } catch (error) {
      setConnectingGoogle(false);
      alert('Error al iniciar conexión: ' + (error.response?.data?.error || error.message));
    }
  };

  const loadGoogleAccounts = async (sessionId) => {
    try {
      const res = await googleAdsOAuthAPI.getCustomers(sessionId);
      setAvailableGoogleAccounts(res.data.accounts || []);
      setSelectedGoogleAccounts([]);
      setShowGoogleAccountsModal(true);
    } catch (error) {
      alert('Error al obtener cuentas: ' + (error.response?.data?.error || error.message));
    }
  };

  const toggleGoogleAccountSelection = (accountId) => {
    setSelectedGoogleAccounts((prev) =>
      prev.includes(accountId)
        ? prev.filter((id) => id !== accountId)
        : [...prev, accountId]
    );
  };

  const linkSelectedGoogleAccounts = async () => {
    if (selectedGoogleAccounts.length === 0) {
      alert('Selecciona al menos una cuenta');
      return;
    }

    try {
      setLinkingGoogleAccounts(true);
      const accounts = availableGoogleAccounts
        .filter((a) => selectedGoogleAccounts.includes(a.id))
        .map((a) => ({ id: a.id, name: a.name, login_customer_id: a.login_customer_id }));

      await googleAdsOAuthAPI.linkAccounts({
        session_id: googleOauthSessionId,
        client_id: parseInt(clientId),
        accounts
      });

      setShowGoogleAccountsModal(false);
      setGoogleOauthSessionId(null);
      setSelectedGoogleAccounts([]);
      loadData();
      alert('Cuentas vinculadas exitosamente');
    } catch (error) {
      alert('Error al vincular cuentas: ' + (error.response?.data?.error || error.message));
    } finally {
      setLinkingGoogleAccounts(false);
    }
  };

  // Test Google Ads connection
  const testGoogleAccount = async (credentialId) => {
    try {
      setTesting((prev) => ({ ...prev, [credentialId]: true }));
      const res = await platformCredentialsAPI.testGoogleAds(credentialId);
      if (res?.data?.success === false) {
        alert('La conexión falló:\n\n' + (res.data.error || 'Error desconocido'));
      }
      loadData();
    } catch (error) {
      alert('Error al probar conexión: ' + (error.response?.data?.error || error.message));
    } finally {
      setTesting((prev) => ({ ...prev, [credentialId]: false }));
    }
  };

  // Disconnect Google Ads account
  const disconnectGoogleAccount = async (credentialId) => {
    if (!confirm('¿Seguro que quieres desconectar esta cuenta?')) return;

    try {
      await googleAdsOAuthAPI.unlinkAccount(credentialId);
      loadData();
    } catch (error) {
      alert('Error al desconectar: ' + error.message);
    }
  };

  // TikTok Ads OAuth flow
  const connectWithTiktok = async () => {
    try {
      setConnectingTiktok(true);
      const res = await tiktokOAuthAPI.getAuthUrl(clientId);

      const width = 600;
      const height = 700;
      const left = window.screenX + (window.innerWidth - width) / 2;
      const top = window.screenY + (window.innerHeight - height) / 2;

      window.open(
        res.data.authUrl,
        'tiktok_oauth',
        `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
      );
    } catch (error) {
      setConnectingTiktok(false);
      alert('Error al iniciar conexión: ' + (error.response?.data?.error || error.message));
    }
  };

  const loadTiktokAccounts = async (sessionId) => {
    try {
      const res = await tiktokOAuthAPI.getAdvertisers(sessionId);
      setAvailableTiktokAccounts(res.data.accounts || []);
      setSelectedTiktokAccounts([]);
      setShowTiktokAccountsModal(true);
    } catch (error) {
      alert('Error al obtener cuentas: ' + (error.response?.data?.error || error.message));
    }
  };

  const toggleTiktokAccountSelection = (accountId) => {
    setSelectedTiktokAccounts((prev) =>
      prev.includes(accountId)
        ? prev.filter((id) => id !== accountId)
        : [...prev, accountId]
    );
  };

  const linkSelectedTiktokAccounts = async () => {
    if (selectedTiktokAccounts.length === 0) {
      alert('Selecciona al menos una cuenta');
      return;
    }

    try {
      setLinkingTiktokAccounts(true);
      const accounts = availableTiktokAccounts
        .filter((a) => selectedTiktokAccounts.includes(a.id))
        .map((a) => ({ id: a.id, name: a.name }));

      await tiktokOAuthAPI.linkAccounts({
        session_id: tiktokOauthSessionId,
        client_id: parseInt(clientId),
        accounts
      });

      setShowTiktokAccountsModal(false);
      setTiktokOauthSessionId(null);
      setSelectedTiktokAccounts([]);
      loadData();
      alert('Cuentas vinculadas exitosamente');
    } catch (error) {
      alert('Error al vincular cuentas: ' + (error.response?.data?.error || error.message));
    } finally {
      setLinkingTiktokAccounts(false);
    }
  };

  // Test TikTok Ads connection
  const testTiktokAccount = async (credentialId) => {
    try {
      setTesting((prev) => ({ ...prev, [credentialId]: true }));
      const res = await platformCredentialsAPI.testTiktok(credentialId);
      if (res?.data?.success === false) {
        alert('La conexión falló:\n\n' + (res.data.error || 'Error desconocido'));
      }
      loadData();
    } catch (error) {
      alert('Error al probar conexión: ' + (error.response?.data?.error || error.message));
    } finally {
      setTesting((prev) => ({ ...prev, [credentialId]: false }));
    }
  };

  // Disconnect TikTok Ads account
  const disconnectTiktokAccount = async (credentialId) => {
    if (!confirm('¿Seguro que quieres desconectar esta cuenta?')) return;

    try {
      await tiktokOAuthAPI.unlinkAccount(credentialId);
      loadData();
    } catch (error) {
      alert('Error al desconectar: ' + error.message);
    }
  };

  // Save per-client Shopify app credentials
  const saveShopifyCredentials = async () => {
    if (!shopifyApiKey.trim() || !shopifyApiSecret.trim()) {
      alert('Ingresa el Client ID y Client Secret de la app de Shopify');
      return;
    }
    try {
      setSavingCredentials(true);
      await shopifyOAuthAPI.saveCredentials({
        client_id: parseInt(clientId),
        shopify_api_key: shopifyApiKey.trim(),
        shopify_api_secret: shopifyApiSecret.trim()
      });
      setHasCustomApp(true);
      alert('Credenciales guardadas. Ahora puedes conectar la tienda.');
    } catch (error) {
      alert('Error al guardar credenciales: ' + (error.response?.data?.error || error.message));
    } finally {
      setSavingCredentials(false);
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
      const oauthState = res.data.state;

      // Open popup
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.innerWidth - width) / 2;
      const top = window.screenY + (window.innerHeight - height) / 2;

      const popup = window.open(
        res.data.authUrl,
        'shopify_oauth',
        `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
      );

      // Poll for callback result (fallback since window.opener is lost in cross-origin redirects)
      const pollInterval = setInterval(async () => {
        try {
          const pollRes = await shopifyOAuthAPI.pollCallbackStatus(oauthState);

          // Result found — handle it
          if (!pollRes.data.pending) {
            clearInterval(pollInterval);
            if (pollRes.data.type === 'shopify_oauth_success') {
              setConnectingShopify(false);
              setShopifyOauthSessionId(pollRes.data.sessionId);
              await loadStoreInfo(pollRes.data.sessionId);
            } else {
              setConnectingShopify(false);
              alert('Error al conectar con Shopify: ' + (pollRes.data.error || 'Error desconocido'));
            }
            return;
          }

          // Still pending — if popup is closed, give up
          if (popup && popup.closed) {
            clearInterval(pollInterval);
            setConnectingShopify(false);
          }
        } catch {
          // Ignore polling errors, will retry
        }
      }, 2000);

      // Stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        setConnectingShopify(false);
      }, 5 * 60 * 1000);
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
        <Loader2 className="w-8 h-8 animate-spin text-[#17181A]" />
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
          <h1 className="text-2xl font-semibold text-[#17181A] tracking-tight">Configurar Plataformas</h1>
          <p className="text-sm text-gray-500 mt-0.5">{client?.company || client?.name}</p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Facebook Ads Card */}
        <div className="glass rounded-xl overflow-hidden">
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
                    className="p-3 bg-gray-50 rounded-lg space-y-2"
                  >
                    <div className="flex items-center justify-between">
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
                    {account.status === 'error' && account.last_error && (
                      <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded px-2 py-1.5">
                        <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span className="break-words">{account.last_error}</span>
                      </div>
                    )}
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

        {/* Google Ads Card — oculta hasta desplegar el backend (GOOGLE_TIKTOK_ENABLED) */}
        {GOOGLE_TIKTOK_ENABLED && (<>
        <div className="glass rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Chrome className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Google Ads</h2>
                <p className="text-sm text-gray-500">
                  {credentials.google_ads.length > 0
                    ? `${credentials.google_ads.length} cuenta(s) conectada(s)`
                    : 'Sin cuentas conectadas'}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6">
            {/* Connected Accounts List */}
            {credentials.google_ads.length > 0 && (
              <div className="mb-4 space-y-3">
                {credentials.google_ads.map((account) => (
                  <div key={account.id} className="p-3 bg-gray-50 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                          <Chrome className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {account.customer_name || account.customer_id}
                          </p>
                          <p className="text-xs text-gray-500">ID: {account.customer_id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={account.status} />
                        <button
                          onClick={() => testGoogleAccount(account.id)}
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
                          onClick={() => disconnectGoogleAccount(account.id)}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Desconectar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {account.status === 'error' && account.last_error && (
                      <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded px-2 py-1.5">
                        <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span className="break-words">{account.last_error}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Connect Button */}
            <button
              onClick={connectWithGoogle}
              disabled={connectingGoogle}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
            >
              {connectingGoogle ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  <Chrome className="w-5 h-5" />
                  {credentials.google_ads.length > 0 ? 'Agregar otra cuenta' : 'Conectar con Google Ads'}
                </>
              )}
            </button>

            <p className="text-xs text-gray-400 mt-3 text-center">
              Se abrirá una ventana para autorizar el acceso a tus cuentas de Google Ads
            </p>
          </div>
        </div>

        {/* TikTok Ads Card */}
        <div className="glass rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center">
                <Music2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">TikTok Ads</h2>
                <p className="text-sm text-gray-500">
                  {credentials.tiktok.length > 0
                    ? `${credentials.tiktok.length} cuenta(s) conectada(s)`
                    : 'Sin cuentas conectadas'}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6">
            {/* Connected Accounts List */}
            {credentials.tiktok.length > 0 && (
              <div className="mb-4 space-y-3">
                {credentials.tiktok.map((account) => (
                  <div key={account.id} className="p-3 bg-gray-50 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                          <Music2 className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {account.advertiser_name || account.advertiser_id}
                          </p>
                          <p className="text-xs text-gray-500">ID: {account.advertiser_id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={account.status} />
                        <button
                          onClick={() => testTiktokAccount(account.id)}
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
                          onClick={() => disconnectTiktokAccount(account.id)}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Desconectar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {account.status === 'error' && account.last_error && (
                      <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded px-2 py-1.5">
                        <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span className="break-words">{account.last_error}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Connect Button */}
            <button
              onClick={connectWithTiktok}
              disabled={connectingTiktok}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors disabled:opacity-50"
            >
              {connectingTiktok ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  <Music2 className="w-5 h-5" />
                  {credentials.tiktok.length > 0 ? 'Agregar otra cuenta' : 'Conectar con TikTok'}
                </>
              )}
            </button>

            <p className="text-xs text-gray-400 mt-3 text-center">
              Se abrirá una ventana para autorizar el acceso a tus cuentas de TikTok Ads
            </p>
          </div>
        </div>
        </>)}

        {/* Shopify Card */}
        <div className="glass rounded-xl overflow-hidden">
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
                {/* Step 1: App Credentials */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        {hasCustomApp ? <CheckCircle className="w-4 h-4 text-green-500" /> : <span className="w-5 h-5 bg-gray-300 rounded-full flex items-center justify-center text-xs text-white font-bold">1</span>}
                        Credenciales de la App
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">Client ID y Secret del Dev Dashboard de Shopify Partners</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Client ID</label>
                      <input
                        type="text"
                        value={shopifyApiKey}
                        onChange={(e) => setShopifyApiKey(e.target.value)}
                        placeholder="ej: 8a7b6c5d4e3f2g1h"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Client Secret</label>
                      <input
                        type="password"
                        value={shopifyApiSecret}
                        onChange={(e) => setShopifyApiSecret(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  </div>
                  {!hasCustomApp && (
                    <button
                      onClick={saveShopifyCredentials}
                      disabled={savingCredentials || !shopifyApiKey.trim() || !shopifyApiSecret.trim()}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#17181A] text-white rounded-lg hover:bg-[#26282C] transition-colors disabled:opacity-50 text-sm"
                    >
                      {savingCredentials ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Guardar Credenciales
                    </button>
                  )}
                  {hasCustomApp && (
                    <button
                      onClick={saveShopifyCredentials}
                      disabled={savingCredentials}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      Actualizar credenciales
                    </button>
                  )}
                </div>

                {/* Step 2: Connect Store */}
                <div className={`space-y-3 ${!hasCustomApp ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-xs text-white font-bold">2</span>
                    <h3 className="text-sm font-semibold text-gray-900">Conectar Tienda</h3>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">URL de la tienda</label>
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
                    disabled={connectingShopify || !hasCustomApp}
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
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Portal Revenue Metric Setting */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Métrica de Ventas en Portal del Cliente</h2>
          <p className="text-sm text-gray-500 mt-1">Elige qué métrica de ventas ve el cliente en su portal</p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { value: 'total', label: 'Venta Total', desc: 'Incluye pedidos pendientes de pago' },
              { value: 'confirmed', label: 'Venta Total Confirmada', desc: 'Solo pedidos pagados (con envío e impuesto)' },
              { value: 'net_confirmed', label: 'Venta Neta Confirmada', desc: 'Solo pedidos pagados (sin envío ni impuesto)' },
            ].map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPortalRevenueMetric(option.value)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  portalRevenueMetric === option.value
                    ? 'border-[#17181A] bg-[#17181A]/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    portalRevenueMetric === option.value ? 'border-[#17181A]' : 'border-gray-300'
                  }`}>
                    {portalRevenueMetric === option.value && (
                      <div className="w-2 h-2 rounded-full bg-[#17181A]" />
                    )}
                  </div>
                  <span className="font-medium text-sm text-gray-900">{option.label}</span>
                </div>
                <p className="text-xs text-gray-500 ml-6">{option.desc}</p>
              </button>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => saveRevenueMetric(portalRevenueMetric)}
              disabled={savingRevenueMetric}
              className="px-5 py-2.5 bg-[#17181A] text-white rounded-xl hover:bg-[#26282C] transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {savingRevenueMetric ? 'Guardando...' : 'Guardar'}
            </button>
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

      {/* Google Ads Account Selection Modal */}
      {showGoogleAccountsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Seleccionar Cuentas de Google Ads</h3>
                <p className="text-sm text-gray-500">Elige las cuentas que deseas vincular</p>
              </div>
              <button
                onClick={() => {
                  setShowGoogleAccountsModal(false);
                  setGoogleOauthSessionId(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6 max-h-96 overflow-y-auto">
              {availableGoogleAccounts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No se encontraron cuentas de Google Ads.</p>
                  <p className="text-sm mt-1">Verifica que tengas acceso a cuentas publicitarias en Google Ads.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableGoogleAccounts.map((account) => (
                    <label
                      key={account.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        account.isLinked
                          ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                          : selectedGoogleAccounts.includes(account.id)
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-gray-200 hover:border-amber-300 hover:bg-amber-50/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedGoogleAccounts.includes(account.id) || account.isLinked}
                        disabled={account.isLinked}
                        onChange={() => !account.isLinked && toggleGoogleAccountSelection(account.id)}
                        className="w-5 h-5 text-amber-600 rounded border-gray-300 focus:ring-amber-500 disabled:opacity-50"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{account.name}</p>
                        <p className="text-xs text-gray-500">
                          {account.id} {account.currency && `• ${account.currency}`}
                        </p>
                      </div>
                      {account.isLinked && (
                        <span className="text-xs text-gray-400 bg-gray-200 px-2 py-1 rounded">
                          Ya vinculada
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
                  setShowGoogleAccountsModal(false);
                  setGoogleOauthSessionId(null);
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={linkSelectedGoogleAccounts}
                disabled={selectedGoogleAccounts.length === 0 || linkingGoogleAccounts}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                {linkingGoogleAccounts ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Vinculando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Vincular {selectedGoogleAccounts.length > 0 && `(${selectedGoogleAccounts.length})`}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TikTok Ads Account Selection Modal */}
      {showTiktokAccountsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Seleccionar Cuentas de TikTok Ads</h3>
                <p className="text-sm text-gray-500">Elige las cuentas que deseas vincular</p>
              </div>
              <button
                onClick={() => {
                  setShowTiktokAccountsModal(false);
                  setTiktokOauthSessionId(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6 max-h-96 overflow-y-auto">
              {availableTiktokAccounts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No se encontraron cuentas de TikTok Ads.</p>
                  <p className="text-sm mt-1">Verifica que tengas acceso a cuentas publicitarias en TikTok.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableTiktokAccounts.map((account) => (
                    <label
                      key={account.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        account.isLinked
                          ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                          : selectedTiktokAccounts.includes(account.id)
                          ? 'border-gray-900 bg-gray-100'
                          : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTiktokAccounts.includes(account.id) || account.isLinked}
                        disabled={account.isLinked}
                        onChange={() => !account.isLinked && toggleTiktokAccountSelection(account.id)}
                        className="w-5 h-5 text-gray-900 rounded border-gray-300 focus:ring-gray-700 disabled:opacity-50"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{account.name}</p>
                        <p className="text-xs text-gray-500">{account.id}</p>
                      </div>
                      {account.isLinked && (
                        <span className="text-xs text-gray-400 bg-gray-200 px-2 py-1 rounded">
                          Ya vinculada
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
                  setShowTiktokAccountsModal(false);
                  setTiktokOauthSessionId(null);
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={linkSelectedTiktokAccounts}
                disabled={selectedTiktokAccounts.length === 0 || linkingTiktokAccounts}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors disabled:opacity-50"
              >
                {linkingTiktokAccounts ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Vinculando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Vincular {selectedTiktokAccounts.length > 0 && `(${selectedTiktokAccounts.length})`}
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
