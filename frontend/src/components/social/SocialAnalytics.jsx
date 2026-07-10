import { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Eye,
  Heart,
  MessageCircle,
  RefreshCw,
  Calendar,
  Clock,
} from 'lucide-react';
import { zernioAPI } from '../../utils/api';

const SocialAnalytics = ({ account }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState('7d');
  const [analytics, setAnalytics] = useState({
    followers: null,
    posts: null,
    daily: null,
    bestTimes: null,
  });

  useEffect(() => {
    if (account?.id) {
      fetchAnalytics();
    }
  }, [account?.id, dateRange]);

  const getDateRange = () => {
    const end = new Date();
    const start = new Date();
    switch (dateRange) {
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      case '90d':
        start.setDate(start.getDate() - 90);
        break;
      default:
        start.setDate(start.getDate() - 7);
    }
    return {
      dateFrom: start.toISOString().split('T')[0],
      dateTo: end.toISOString().split('T')[0],
    };
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    const { dateFrom, dateTo } = getDateRange();

    try {
      const [followersRes, postsRes, dailyRes, bestTimesRes] = await Promise.all([
        zernioAPI.getFollowerAnalytics(account.id, dateFrom, dateTo).catch(() => ({ data: null })),
        zernioAPI.getPostAnalytics(account.id, { dateFrom, dateTo }).catch(() => ({ data: null })),
        zernioAPI.getDailyMetrics(account.id, dateFrom, dateTo).catch(() => ({ data: null })),
        zernioAPI.getBestTimesToPost(account.id, account.platform).catch(() => ({ data: null })),
      ]);

      setAnalytics({
        followers: followersRes.data,
        posts: postsRes.data,
        daily: dailyRes.data,
        bestTimes: bestTimesRes.data,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '—';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  const formatPercent = (num) => {
    if (num === null || num === undefined) return '—';
    return num.toFixed(2) + '%';
  };

  if (!account) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Selecciona una cuenta</h3>
        <p className="text-gray-500">
          Elige una cuenta de redes sociales para ver sus analytics
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={fetchAnalytics}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const { followers, posts, daily, bestTimes } = analytics;

  // Calculate metrics from available data
  const totalFollowers = account.followers || account.followerCount || 0;
  const followerChange = followers?.gained - followers?.lost || 0;
  const followerChangePercent = totalFollowers > 0 ? (followerChange / totalFollowers * 100) : 0;

  const totalReach = posts?.totalReach || daily?.reduce((sum, d) => sum + (d.reach || 0), 0) || 0;
  const totalImpressions = posts?.totalImpressions || daily?.reduce((sum, d) => sum + (d.impressions || 0), 0) || 0;
  const totalEngagement = posts?.totalEngagement || 0;
  const engagementRate = posts?.engagementRate || (totalReach > 0 ? (totalEngagement / totalReach * 100) : 0);

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Analytics de @{account.username || account.displayName}
        </h2>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="7d">Ultimos 7 dias</option>
            <option value="30d">Ultimos 30 dias</option>
            <option value="90d">Ultimos 90 dias</option>
          </select>
          <button
            onClick={fetchAnalytics}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            title="Actualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Followers */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Seguidores</span>
            <Users className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatNumber(totalFollowers)}</p>
          {followerChange !== 0 && (
            <div className={`flex items-center gap-1 mt-1 text-sm ${followerChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {followerChange > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span>{followerChange > 0 ? '+' : ''}{formatNumber(followerChange)}</span>
              <span className="text-gray-400">({formatPercent(followerChangePercent)})</span>
            </div>
          )}
        </div>

        {/* Reach */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Alcance</span>
            <Eye className="w-5 h-5 text-purple-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatNumber(totalReach)}</p>
          <p className="text-sm text-gray-500 mt-1">cuentas alcanzadas</p>
        </div>

        {/* Impressions */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Impresiones</span>
            <BarChart3 className="w-5 h-5 text-orange-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatNumber(totalImpressions)}</p>
          <p className="text-sm text-gray-500 mt-1">veces visto</p>
        </div>

        {/* Engagement Rate */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Engagement</span>
            <Heart className="w-5 h-5 text-pink-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatPercent(engagementRate)}</p>
          <p className="text-sm text-gray-500 mt-1">tasa de interaccion</p>
        </div>
      </div>

      {/* Daily Metrics Chart */}
      {daily && daily.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Metricas Diarias</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Fecha</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">Alcance</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">Impresiones</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">Seguidores</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">Engagement</th>
                </tr>
              </thead>
              <tbody>
                {daily.slice(0, 10).map((day, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 text-gray-900">
                      {new Date(day.date).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </td>
                    <td className="text-right py-2 px-3 text-gray-700">{formatNumber(day.reach)}</td>
                    <td className="text-right py-2 px-3 text-gray-700">{formatNumber(day.impressions)}</td>
                    <td className="text-right py-2 px-3">
                      <span className={day.newFollowers > 0 ? 'text-green-600' : day.newFollowers < 0 ? 'text-red-600' : 'text-gray-700'}>
                        {day.newFollowers > 0 ? '+' : ''}{formatNumber(day.newFollowers)}
                      </span>
                    </td>
                    <td className="text-right py-2 px-3 text-gray-700">{formatPercent(day.engagementRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Best Times to Post */}
      {bestTimes && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-gray-900">Mejores Horarios para Publicar</h3>
          </div>

          {bestTimes.days && bestTimes.days.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'].map((dayName, idx) => {
                const dayData = bestTimes.days?.find(d => d.dayIndex === idx) || {};
                return (
                  <div key={idx} className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-900 mb-1">{dayName}</p>
                    {dayData.bestHours && dayData.bestHours.length > 0 ? (
                      <div className="space-y-1">
                        {dayData.bestHours.slice(0, 2).map((hour, hIdx) => (
                          <p key={hIdx} className="text-xs text-blue-600 font-medium">
                            {hour}:00
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">—</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">
              No hay suficientes datos para calcular los mejores horarios. Sigue publicando para obtener recomendaciones.
            </p>
          )}
        </div>
      )}

      {/* Quick Stats */}
      {posts && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Total Likes</span>
            </div>
            <p className="text-2xl font-bold text-blue-900">{formatNumber(posts.totalLikes)}</p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-purple-900">Total Comentarios</span>
            </div>
            <p className="text-2xl font-bold text-purple-900">{formatNumber(posts.totalComments)}</p>
          </div>

          <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="w-5 h-5 text-pink-600" />
              <span className="text-sm font-medium text-pink-900">Total Guardados</span>
            </div>
            <p className="text-2xl font-bold text-pink-900">{formatNumber(posts.totalSaves)}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SocialAnalytics;
