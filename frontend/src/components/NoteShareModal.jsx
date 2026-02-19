import { useState, useEffect } from 'react';
import {
  X,
  Link2,
  Copy,
  Check,
  MessageSquare,
  Edit3,
  Clock,
  Trash2,
  ExternalLink,
  Loader2,
  AlertCircle,
  Eye
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || 'http://localhost:3000';

/**
 * NoteShareModal - Modal for generating and managing share links
 *
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - noteId: string/number - The note ID to share
 * - noteTitle: string - Title of the note
 */
const NoteShareModal = ({ isOpen, onClose, noteId, noteTitle }) => {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(null);
  const [error, setError] = useState(null);

  // Options for new share
  const [allowComments, setAllowComments] = useState(true);
  const [allowEdits, setAllowEdits] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState('');

  // Fetch existing shares
  useEffect(() => {
    if (isOpen && noteId) {
      fetchShares();
    }
  }, [isOpen, noteId]);

  const fetchShares = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/api/note-share/${noteId}/shares`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Error cargando enlaces');
      }

      const data = await response.json();
      setShares(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShare = async () => {
    setCreating(true);
    setError(null);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/api/note-share/${noteId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          allow_comments: allowComments,
          allow_edits: allowEdits,
          expires_in_days: expiresInDays ? parseInt(expiresInDays) : null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error creando enlace');
      }

      const newShare = await response.json();
      setShares([newShare, ...shares]);

      // Copy to clipboard automatically
      handleCopy(newShare.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeShare = async (tokenId) => {
    if (!confirm('¿Revocar este enlace? Ya no funcionará para nadie.')) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/api/note-share/${noteId}/share/${tokenId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Error revocando enlace');
      }

      setShares(shares.map(s =>
        s.id === tokenId ? { ...s, status: 'revoked' } : s
      ));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCopy = async (shareToken) => {
    const url = `${window.location.origin}/share/${shareToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(shareToken);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      alert('Error copiando enlace');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const activeShares = shares.filter(s => s.status === 'active');
  const revokedShares = shares.filter(s => s.status === 'revoked');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Link2 size={20} className="text-slate-600" />
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Compartir nota</h2>
              <p className="text-xs text-slate-500 line-clamp-1">{noteTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Create new share */}
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-sm font-medium text-slate-700 mb-3">Crear nuevo enlace</h3>

          <div className="space-y-3">
            {/* Options */}
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowComments}
                  onChange={(e) => setAllowComments(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-600 flex items-center gap-1">
                  <MessageSquare size={14} />
                  Permitir comentarios
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowEdits}
                  onChange={(e) => setAllowEdits(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-600 flex items-center gap-1">
                  <Edit3 size={14} />
                  Permitir ediciones
                </span>
              </label>
            </div>

            {/* Expiration */}
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-slate-400" />
              <select
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sin expiración</option>
                <option value="1">Expira en 1 día</option>
                <option value="7">Expira en 7 días</option>
                <option value="30">Expira en 30 días</option>
                <option value="90">Expira en 90 días</option>
              </select>
            </div>

            {/* Create button */}
            <button
              onClick={handleCreateShare}
              disabled={creating}
              className="w-full py-2.5 bg-[#1A1A2E] text-white rounded-lg hover:bg-[#2a2a3e] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {creating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Link2 size={16} />
                  Crear enlace
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
              <AlertCircle size={14} />
              {error}
            </div>
          )}
        </div>

        {/* Existing shares */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8">
              <Loader2 size={24} className="animate-spin text-slate-400 mx-auto" />
            </div>
          ) : activeShares.length === 0 && revokedShares.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Link2 size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No hay enlaces compartidos</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Active shares */}
              {activeShares.map((share) => (
                <div
                  key={share.id}
                  className="p-3 border border-slate-200 rounded-lg bg-white"
                >
                  <div className="flex items-center justify-between mb-2">
                    <code className="text-sm font-mono bg-slate-100 px-2 py-0.5 rounded">
                      {share.token}
                    </code>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopy(share.token)}
                        className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                        title="Copiar enlace"
                      >
                        {copied === share.token ? (
                          <Check size={16} className="text-green-600" />
                        ) : (
                          <Copy size={16} className="text-slate-500" />
                        )}
                      </button>
                      <a
                        href={`/share/${share.token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                        title="Abrir enlace"
                      >
                        <ExternalLink size={16} className="text-slate-500" />
                      </a>
                      <button
                        onClick={() => handleRevokeShare(share.id)}
                        className="p-1.5 hover:bg-red-50 rounded transition-colors"
                        title="Revocar enlace"
                      >
                        <Trash2 size={16} className="text-red-500" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    {share.allow_comments === 1 && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full flex items-center gap-1">
                        <MessageSquare size={10} />
                        Comentarios
                      </span>
                    )}
                    {share.allow_edits === 1 && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full flex items-center gap-1">
                        <Edit3 size={10} />
                        Ediciones
                      </span>
                    )}
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full flex items-center gap-1">
                      <Eye size={10} />
                      {share.access_count || 0} vistas
                    </span>
                    {share.expires_at && (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full flex items-center gap-1">
                        <Clock size={10} />
                        Expira: {formatDate(share.expires_at)}
                      </span>
                    )}
                  </div>

                  {share.created_by_name && (
                    <p className="text-xs text-slate-400 mt-2">
                      Creado por {share.created_by_name} · {formatDate(share.created_at)}
                    </p>
                  )}
                </div>
              ))}

              {/* Revoked shares */}
              {revokedShares.length > 0 && (
                <>
                  <h4 className="text-xs font-medium text-slate-400 uppercase mt-4">
                    Revocados
                  </h4>
                  {revokedShares.map((share) => (
                    <div
                      key={share.id}
                      className="p-3 border border-slate-200 rounded-lg bg-slate-50 opacity-60"
                    >
                      <code className="text-sm font-mono text-slate-400 line-through">
                        {share.token}
                      </code>
                      <p className="text-xs text-slate-400 mt-1">
                        {share.access_count || 0} vistas totales
                      </p>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-500 text-center">
            Los enlaces permiten a cualquier persona ver esta nota sin necesidad de cuenta.
          </p>
        </div>
      </div>
    </div>
  );
};

export default NoteShareModal;
