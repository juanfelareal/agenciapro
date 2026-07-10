import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BarChart3,
  FileText,
  MessageCircle,
  Inbox,
  Zap,
  Settings,
  RefreshCw,
  AlertCircle,
  Instagram,
  Video,
  ChevronDown,
} from 'lucide-react';
import { zernioAPI } from '../utils/api';
import ZernioSettings from '../components/social/ZernioSettings';
import SocialAnalytics from '../components/social/SocialAnalytics';
import SocialPosts from '../components/social/SocialPosts';
import SocialComments from '../components/social/SocialComments';
import SocialInbox from '../components/social/SocialInbox';
import SocialAutomations from '../components/social/SocialAutomations';

const TABS = [
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'posts', label: 'Publicaciones', icon: FileText },
  { id: 'comments', label: 'Comentarios', icon: MessageCircle },
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'automations', label: 'Automations', icon: Zap },
  { id: 'settings', label: 'Configuracion', icon: Settings },
];

const Social = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'analytics';
  const setActiveTab = (tab) => setSearchParams({ tab });

  const [isConfigured, setIsConfigured] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAccountSelector, setShowAccountSelector] = useState(false);

  useEffect(() => {
    checkConfiguration();
  }, []);

  const checkConfiguration = async () => {
    try {
      const res = await zernioAPI.getSettings();
      const configured = res.data?.is_configured;
      setIsConfigured(configured);

      if (configured) {
        const accountsRes = await zernioAPI.getAccounts();
        const accountsList = accountsRes.data || [];
        setAccounts(accountsList);
        if (accountsList.length > 0) {
          setSelectedAccount(accountsList[0]);
        }
      }
    } catch (error) {
      console.error('Error checking configuration:', error);
      setIsConfigured(false);
    } finally {
      setLoading(false);
    }
  };

  const getPlatformIcon = (platform) => {
    switch (platform?.toLowerCase()) {
      case 'instagram':
        return <Instagram className="w-4 h-4 text-pink-500" />;
      case 'tiktok':
        return <Video className="w-4 h-4" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  // If not configured, show settings
  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Social Media</h1>
            <p className="text-gray-500 mt-1">
              Gestiona tus redes sociales desde AgenciaPro
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-800">Configura Zernio</h3>
                <p className="text-yellow-700 text-sm mt-1">
                  Para empezar a gestionar tus redes sociales, necesitas conectar tu cuenta de Zernio.
                </p>
              </div>
            </div>
          </div>

          <ZernioSettings />
        </div>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'analytics':
        return <SocialAnalytics account={selectedAccount} />;
      case 'posts':
        return <SocialPosts account={selectedAccount} />;
      case 'comments':
        return <SocialComments account={selectedAccount} />;
      case 'inbox':
        return <SocialInbox account={selectedAccount} />;
      case 'automations':
        return <SocialAutomations account={selectedAccount} />;
      case 'settings':
        return <ZernioSettings />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Social Media</h1>
              <p className="text-gray-500 text-sm">
                Gestiona tus redes sociales desde AgenciaPro
              </p>
            </div>

            {/* Account Selector */}
            {activeTab !== 'settings' && accounts.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowAccountSelector(!showAccountSelector)}
                  className="flex items-center gap-3 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  {selectedAccount && (
                    <>
                      {getPlatformIcon(selectedAccount.platform)}
                      <span className="font-medium text-gray-900">
                        @{selectedAccount.username || selectedAccount.displayName}
                      </span>
                      <span className="text-xs text-gray-500 capitalize">
                        {selectedAccount.platform}
                      </span>
                    </>
                  )}
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>

                {showAccountSelector && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl border border-gray-200 shadow-lg z-50">
                    <div className="p-2">
                      {accounts.map((account) => (
                        <button
                          key={account.id}
                          onClick={() => {
                            setSelectedAccount(account);
                            setShowAccountSelector(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left ${
                            selectedAccount?.id === account.id
                              ? 'bg-blue-50 text-blue-700'
                              : 'hover:bg-gray-100'
                          }`}
                        >
                          {getPlatformIcon(account.platform)}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              @{account.username || account.displayName}
                            </p>
                            <p className="text-xs text-gray-500 capitalize">
                              {account.platform} • {account.followers?.toLocaleString() || account.followerCount?.toLocaleString() || '—'} seguidores
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6">
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {renderTabContent()}
      </div>

      {/* Click outside to close account selector */}
      {showAccountSelector && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowAccountSelector(false)}
        />
      )}
    </div>
  );
};

export default Social;
