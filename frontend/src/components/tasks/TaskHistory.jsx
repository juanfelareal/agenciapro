import { useState, useEffect } from 'react';
import {
  History, ChevronDown, ChevronUp, Loader2, MessageSquare,
  CheckCircle2, XCircle, AlertCircle, UserPlus, UserMinus,
  Calendar, Flag, FolderKanban, Eye, EyeOff, Edit3, Trash2,
  Sparkles, ShieldCheck
} from 'lucide-react';
import { taskHistoryAPI } from '../../utils/api';

// Visual mapping per action type
const ACTION_META = {
  created: { icon: Sparkles, color: 'bg-indigo-100 text-indigo-700' },
  deleted: { icon: Trash2, color: 'bg-red-100 text-red-700' },
  status_changed: { icon: CheckCircle2, color: 'bg-blue-100 text-blue-700' },
  priority_changed: { icon: Flag, color: 'bg-amber-100 text-amber-700' },
  due_date_changed: { icon: Calendar, color: 'bg-purple-100 text-purple-700' },
  title_changed: { icon: Edit3, color: 'bg-gray-100 text-gray-700' },
  project_changed: { icon: FolderKanban, color: 'bg-teal-100 text-teal-700' },
  assignees_added: { icon: UserPlus, color: 'bg-green-100 text-green-700' },
  assignees_removed: { icon: UserMinus, color: 'bg-orange-100 text-orange-700' },
  visibility_changed: { icon: Eye, color: 'bg-sky-100 text-sky-700' },
  approval_requested: { icon: ShieldCheck, color: 'bg-violet-100 text-violet-700' },
  approval_disabled: { icon: ShieldCheck, color: 'bg-gray-100 text-gray-700' },
  client_approved: { icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700' },
  client_rejected: { icon: XCircle, color: 'bg-red-100 text-red-700' },
  client_changes_requested: { icon: AlertCircle, color: 'bg-yellow-100 text-yellow-700' },
  team_comment: { icon: MessageSquare, color: 'bg-blue-50 text-blue-700' },
  client_comment: { icon: MessageSquare, color: 'bg-pink-50 text-pink-700' },
};

const DEFAULT_META = { icon: History, color: 'bg-gray-100 text-gray-600' };

function formatRelative(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'hace un momento';
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `hace ${diffD} ${diffD === 1 ? 'día' : 'días'}`;
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatAbsolute(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase())
    .join('') || '?';
}

export default function TaskHistory({ taskId, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    if (!taskId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await taskHistoryAPI.get(taskId);
      setEntries(data || []);
      setLoaded(true);
    } catch (err) {
      console.error('Error loading task history:', err);
      setError('No se pudo cargar el historial');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && !loaded) load();
  }, [open, taskId]);

  // Reset when task changes
  useEffect(() => {
    setEntries([]);
    setLoaded(false);
  }, [taskId]);

  if (!taskId) return null;

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden bg-white">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
            <History size={15} className="text-gray-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-[#17181A]">Historial</p>
            <p className="text-xs text-gray-500">
              {loaded
                ? `${entries.length} ${entries.length === 1 ? 'evento' : 'eventos'}`
                : 'Cambios, comentarios y acciones del cliente'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {open && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); load(); }}
              className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
              disabled={loading}
            >
              {loading ? 'Actualizando…' : 'Refrescar'}
            </button>
          )}
          {open ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100">
          {loading && entries.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          ) : error ? (
            <div className="px-4 py-6 text-center text-sm text-red-600">{error}</div>
          ) : entries.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              Sin movimientos aún. Cualquier cambio que hagas a la tarea quedará registrado aquí.
            </div>
          ) : (
            <ol className="relative p-4 pl-12 space-y-3">
              {/* Vertical guide line */}
              <span className="absolute left-7 top-5 bottom-5 w-px bg-gray-100" aria-hidden />
              {entries.map((e) => {
                const meta = ACTION_META[e.action] || DEFAULT_META;
                const Icon = meta.icon;
                const isComment = e.kind === 'comment';
                return (
                  <li key={e.id} className="relative">
                    {/* Icon bubble on the timeline */}
                    <span
                      className={`absolute -left-8 top-0 w-7 h-7 rounded-full flex items-center justify-center ring-4 ring-white ${meta.color}`}
                    >
                      <Icon size={13} />
                    </span>

                    <div className="text-sm">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className={`font-medium ${e.author_type === 'client' ? 'text-pink-700' : 'text-[#17181A]'}`}>
                          {e.author_name}
                        </span>
                        {e.author_type === 'client' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pink-50 text-pink-700 font-medium">
                            CLIENTE
                          </span>
                        )}
                        <span className="text-xs text-gray-400" title={formatAbsolute(e.created_at)}>
                          · {formatRelative(e.created_at)}
                        </span>
                      </div>

                      {isComment ? (
                        <div className={`mt-1 p-2.5 rounded-lg text-sm whitespace-pre-wrap ${
                          e.author_type === 'client' ? 'bg-pink-50 text-pink-900' : 'bg-gray-50 text-gray-700'
                        }`}>
                          {e.body}
                        </div>
                      ) : (
                        <p className="text-gray-600 mt-0.5">{e.description || e.action}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
