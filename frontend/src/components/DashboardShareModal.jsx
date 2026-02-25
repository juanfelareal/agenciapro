import { useState, useEffect } from 'react';
import {
  X, Share2, Copy, Check, Trash2, Loader2, Link2, Clock, Eye
} from 'lucide-react';
import { dashboardShareAPI } from '../utils/api';

export default function DashboardShareModal({ clientId, onClose }) {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    loadShares();
  }, [clientId]);

  const loadShares = async () => {
    try {
      const res = await dashboardShareAPI.getShares(clientId);
      setShares(res.data);
    } catch (error) {
      console.error('Error loading shares:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      await dashboardShareAPI.createShare(clientId, {
        expires_in_days: expiresInDays ? parseInt(expiresInDays) : undefined,
      });
      setExpiresInDays('');
      loadShares();
    } catch (error) {
      console.error('Error creating share:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (tokenId) => {
    if (!confirm('¿Revocar este enlace? Ya no funcionará.')) return;
    try {
      await dashboardShareAPI.revokeShare(clientId, tokenId);
      loadShares();
    } catch (error) {
      console.error('Error revoking:', error);
    }
  };

  const handleCopy = (token) => {
    const url = `${window.location.origin}/d/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(token);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (date) =>
    new Date(date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

  const activeShares = shares.filter(s => s.status === 'active');

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-[#1A1A2E] flex items-center gap-2">
            <Share2 className="w-5 h-5" /> Compartir Dashboard
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Create new share */}
          <div className="space-y-3">
            <p className="text-sm text-gray-500">Genera un enlace público para compartir el dashboard de métricas con el cliente.</p>

            <div className="flex items-center gap-2">
              <select
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#BFFF00]"
              >
                <option value="">Sin expiración</option>
                <option value="7">Expira en 7 días</option>
                <option value="30">Expira en 30 días</option>
                <option value="90">Expira en 90 días</option>
              </select>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex items-center gap-2 px-4 py-2 bg-[#1A1A2E] text-white rounded-xl text-sm font-medium hover:bg-[#252542] disabled:opacity-50"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                Generar
              </button>
            </div>
          </div>

          {/* Existing shares */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          ) : activeShares.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-4">No hay enlaces activos</p>
          ) : (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Enlaces activos</h3>
              {activeShares.map((share) => (
                <div key={share.id} className="bg-gray-50 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <code className="text-sm font-mono text-[#1A1A2E]">{share.token}</code>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopy(share.token)}
                        className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                        title="Copiar enlace"
                      >
                        {copiedId === share.token
                          ? <Check className="w-4 h-4 text-green-600" />
                          : <Copy className="w-4 h-4 text-gray-500" />
                        }
                      </button>
                      <button
                        onClick={() => handleRevoke(share.id)}
                        className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                        title="Revocar enlace"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {share.created_by_name && <span>por {share.created_by_name}</span>}
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {share.access_count || 0}</span>
                    {share.expires_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formatDate(share.expires_at)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
