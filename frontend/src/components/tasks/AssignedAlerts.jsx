import { useCallback, useEffect, useState } from 'react';
import { X, UserPlus, CalendarDays, ChevronRight } from 'lucide-react';
import { tasksAPI } from '../../utils/api';

/**
 * Barras de anuncio: una por tarea que le asignaron al usuario y aún no ha visto.
 * - X → la quita (marca leída la notificación) sin abrir la tarea.
 * - Clic en la barra → abre la tarea (y también la marca vista).
 * Se alimenta de /tasks/assigned-alerts y avisa al menú con `tasks:alerts-changed`.
 */
const emit = (count) => window.dispatchEvent(new CustomEvent('tasks:alerts-changed', { detail: typeof count === 'number' ? { count } : undefined }));

const PRIORITY = {
  urgent: { label: 'Urgente', cls: 'bg-red-100 text-red-700' },
  high: { label: 'Alta', cls: 'bg-orange-100 text-orange-700' },
  medium: { label: 'Media', cls: 'bg-amber-100 text-amber-700' },
  low: { label: 'Baja', cls: 'bg-gray-100 text-gray-600' },
};

const fmtDue = (iso) => {
  if (!iso) return null;
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  if (diff === 0) return 'hoy';
  if (diff === 1) return 'mañana';
  if (diff < 0) return `venció ${d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`;
  return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '');
};
const firstName = (name) => (name ? name.trim().split(/\s+/).slice(0, /^(maria|juan|jose|ana)$/i.test(name.trim().split(/\s+/)[0]) ? 2 : 1).join(' ') : null);

export default function AssignedAlerts({ onOpenTask }) {
  const [items, setItems] = useState([]);
  const [hidden, setHidden] = useState(() => new Set());

  const load = useCallback(() => {
    tasksAPI.assignedAlerts()
      .then((res) => { setItems(res.data?.items || []); emit(res.data?.count || 0); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const onVisibility = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [load]);

  const dismiss = async (item, e) => {
    e?.stopPropagation();
    setHidden((prev) => new Set(prev).add(item.task_id));
    try {
      const { data } = await tasksAPI.dismissAssignedAlert({ task_id: item.task_id });
      emit(data?.count);
    } catch { emit(); }
  };

  const open = async (item) => {
    await dismiss(item);
    onOpenTask?.(item.task_id);
  };

  const visible = items.filter((i) => !hidden.has(i.task_id));
  if (!visible.length) return null;

  const dismissAll = async () => {
    setHidden((prev) => { const n = new Set(prev); visible.forEach((i) => n.add(i.task_id)); return n; });
    try { const { data } = await tasksAPI.dismissAssignedAlert({ all: true }); emit(data?.count); } catch { emit(); }
  };

  return (
    <div className="space-y-2">
      {visible.length >= 3 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-medium text-gray-500">{visible.length} tareas nuevas asignadas a ti</span>
          <button type="button" onClick={dismissAll} className="text-xs text-gray-500 hover:text-[var(--ink)] underline underline-offset-2">Quitar todos los avisos</button>
        </div>
      )}
      {visible.map((item) => {
        const pr = PRIORITY[item.priority];
        const due = fmtDue(item.due_date);
        const overdue = due?.startsWith('venció');
        return (
          <div
            key={item.task_id}
            role="button"
            tabIndex={0}
            onClick={() => open(item)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(item); } }}
            className="group flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-3 sm:px-4 py-2.5 cursor-pointer hover:bg-sky-100/80 transition-colors"
          >
            <span className="shrink-0 w-8 h-8 rounded-full bg-sky-500 text-white flex items-center justify-center"><UserPlus size={15} /></span>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-[var(--ink)] truncate">
                {item.assigned_by_name
                  ? <><span className="font-semibold">{firstName(item.assigned_by_name)}</span> te asignó: </>
                  : <span className="font-semibold">Te asignaron: </span>}
                <span className="font-medium">{item.title}</span>
              </div>
              <div className="text-xs text-gray-600 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                {item.client_name && <span>{item.client_name}</span>}
                {item.project_name && <span className="text-gray-400">· {item.project_name}</span>}
                {due && <span className={`inline-flex items-center gap-1 ${overdue ? 'text-red-600 font-medium' : ''}`}><CalendarDays size={11} /> {due}</span>}
                {pr && pr.label !== 'Media' && <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${pr.cls}`}>{pr.label}</span>}
              </div>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-sky-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity">Ver tarea <ChevronRight size={14} /></span>
            <button
              type="button"
              onClick={(e) => dismiss(item, e)}
              className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-[var(--ink)] hover:bg-[rgb(var(--ink-rgb)/0.03)]"
              title="Quitar aviso"
              aria-label="Quitar aviso"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
