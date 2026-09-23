import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bookmark, Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { ugcAPI } from '../../utils/api';

const LIST_COLORS = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#14B8A6', '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280'];

const listLabel = (l) => `${l.emoji ? l.emoji + ' ' : ''}${l.name}`;

/** Small colored chips with the lists a creator belongs to. */
export function ListChips({ lists, listIds, max = 2, size = 'xs' }) {
  const ids = Array.isArray(listIds) ? listIds : [];
  if (!ids.length || !lists?.length) return null;
  const mine = lists.filter(l => ids.includes(l.id));
  const shown = mine.slice(0, max);
  const cls = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-[10px] px-1.5 py-0.5';
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map(l => (
        <span
          key={l.id}
          className={`${cls} rounded-full font-medium inline-flex items-center gap-1 whitespace-nowrap`}
          style={{ backgroundColor: `${l.color}1A`, color: l.color }}
          title={l.name}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: l.color }} />
          {listLabel(l)}
        </span>
      ))}
      {mine.length > shown.length && <span className="text-[10px] text-gray-400">+{mine.length - shown.length}</span>}
    </div>
  );
}

/** Button that opens the list picker for one creator. */
export function ListTagButton({ listIds, onOpen, className = '' }) {
  const active = Array.isArray(listIds) && listIds.length > 0;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onOpen(e.currentTarget.getBoundingClientRect()); }}
      className={`p-1 rounded-full transition-colors ${active ? 'text-[#17181A]' : 'text-gray-300 hover:text-gray-600'} ${className}`}
      title="Listas"
    >
      <Bookmark className="w-4 h-4" fill={active ? 'currentColor' : 'none'} />
    </button>
  );
}

/**
 * Popover (fixed, portal) with checkboxes for every list + quick "new list".
 * Props: anchorRect, lists, listIds, onToggle(listId, checked), onCreate(name) → new list, onClose, onManage
 */
export function CreatorListPicker({ anchorRect, lists, listIds, onToggle, onCreate, onClose, onManage }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ top: anchorRect.bottom + 6, left: anchorRect.left });
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState({});

  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    let left = anchorRect.left, top = anchorRect.bottom + 6;
    if (left + w > window.innerWidth - 8) left = Math.max(8, anchorRect.right - w);
    if (top + h > window.innerHeight - 8) top = Math.max(8, anchorRect.top - h - 6);
    setPos({ top, left });
  }, [anchorRect, lists.length]);

  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const toggle = async (l) => {
    const checked = listIds.includes(l.id);
    setBusy(b => ({ ...b, [l.id]: true }));
    try { await onToggle(l.id, !checked); } finally { setBusy(b => ({ ...b, [l.id]: false })); }
  };

  const create = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const l = await onCreate(newName.trim());
      if (l) await onToggle(l.id, true);
      setNewName('');
    } finally { setCreating(false); }
  };

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
      className="w-64 bg-white rounded-xl border border-gray-200 shadow-xl p-2"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs font-semibold text-[#17181A]">Agregar a lista</span>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded"><X className="w-3.5 h-3.5" /></button>
      </div>
      <div className="max-h-56 overflow-y-auto">
        {lists.length === 0 && <p className="px-2 py-2 text-xs text-gray-400">Aún no tienes listas. Crea la primera abajo.</p>}
        {lists.map(l => {
          const checked = listIds.includes(l.id);
          return (
            <button
              key={l.id}
              onClick={() => toggle(l)}
              disabled={busy[l.id]}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-left disabled:opacity-60"
            >
              <span
                className="w-4 h-4 rounded border flex items-center justify-center shrink-0"
                style={{ borderColor: l.color, backgroundColor: checked ? l.color : 'transparent' }}
              >
                {checked && <Check className="w-3 h-3 text-white" />}
              </span>
              <span className="text-sm text-gray-800 truncate flex-1">{listLabel(l)}</span>
              <span className="text-[10px] text-gray-400">{l.member_count ?? ''}</span>
            </button>
          );
        })}
      </div>
      <form onSubmit={create} className="mt-1 pt-2 border-t border-gray-100 flex items-center gap-1 px-1">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nueva lista…"
          className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D7F653]"
        />
        <button type="submit" disabled={creating || !newName.trim()} className="p-1.5 rounded-lg bg-[#17181A] text-white disabled:opacity-40" title="Crear lista">
          {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        </button>
      </form>
      {onManage && (
        <button onClick={() => { onClose(); onManage(); }} className="w-full mt-1 px-2 py-1.5 text-[11px] text-gray-500 hover:text-[#17181A] text-left">
          Administrar listas…
        </button>
      )}
    </div>,
    document.body
  );
}

/** Horizontal bar of lists used as quick filter. */
export function ListBar({ lists, activeListId, onSelect, onManage }) {
  if (!lists?.length) {
    return (
      <div className="flex items-center gap-2 mb-4 text-xs text-gray-400">
        <Bookmark className="w-3.5 h-3.5" />
        <span>Crea listas personalizadas (ej. "Favoritos mujeres", "Fitness") para agrupar creadores.</span>
        <button onClick={onManage} className="text-[#17181A] font-medium hover:underline">Crear lista</button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1">
      <button
        onClick={() => onSelect(null)}
        className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${!activeListId ? 'bg-[#17181A] text-white border-[#17181A]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
      >
        Todos
      </button>
      {lists.map(l => {
        const active = activeListId === l.id;
        return (
          <button
            key={l.id}
            onClick={() => onSelect(active ? null : l.id)}
            className="shrink-0 text-xs px-3 py-1.5 rounded-full border font-medium inline-flex items-center gap-1.5 transition-colors"
            style={active
              ? { backgroundColor: l.color, borderColor: l.color, color: '#fff' }
              : { backgroundColor: `${l.color}14`, borderColor: `${l.color}55`, color: l.color }}
          >
            {listLabel(l)}
            <span className={`text-[10px] ${active ? 'text-white/80' : 'opacity-70'}`}>{l.member_count}</span>
          </button>
        );
      })}
      <button onClick={onManage} className="shrink-0 p-1.5 text-gray-400 hover:text-[#17181A] rounded-full hover:bg-gray-100" title="Administrar listas">
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/** Modal to create / rename / recolor / delete lists. */
export function ManageListsModal({ lists, onClose, onChanged }) {
  const [items, setItems] = useState(lists);
  const [form, setForm] = useState({ name: '', emoji: '', color: LIST_COLORS[5] });
  const [editing, setEditing] = useState(null); // { id, name, emoji, color }
  const [saving, setSaving] = useState(false);

  useEffect(() => { setItems(lists); }, [lists]);

  const create = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await ugcAPI.createList({ name: form.name.trim(), emoji: form.emoji || null, color: form.color });
      const next = [...items, res.data];
      setItems(next); onChanged(next);
      setForm({ name: '', emoji: '', color: LIST_COLORS[(next.length) % LIST_COLORS.length] });
    } catch (err) { console.error(err); alert(err.response?.data?.error || 'No se pudo crear la lista'); }
    finally { setSaving(false); }
  };

  const saveEdit = async () => {
    if (!editing?.name.trim()) return;
    setSaving(true);
    try {
      const res = await ugcAPI.updateList(editing.id, { name: editing.name.trim(), emoji: editing.emoji || null, color: editing.color });
      const next = items.map(l => l.id === editing.id ? res.data : l);
      setItems(next); onChanged(next); setEditing(null);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const remove = async (l) => {
    if (!confirm(`¿Eliminar la lista "${l.name}"? Los creadores no se borran, solo dejan de estar en la lista.`)) return;
    try {
      await ugcAPI.deleteList(l.id);
      const next = items.filter(x => x.id !== l.id);
      setItems(next); onChanged(next);
    } catch (err) { console.error(err); }
  };

  const ColorPicker = ({ value, onChange }) => (
    <div className="flex items-center gap-1">
      {LIST_COLORS.map(c => (
        <button key={c} type="button" onClick={() => onChange(c)} className="w-5 h-5 rounded-full border-2" style={{ backgroundColor: c, borderColor: value === c ? '#17181A' : 'transparent' }} title={c} />
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#17181A] flex items-center gap-2"><Bookmark className="w-4 h-4" /> Listas de creadores</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <form onSubmit={create} className="bg-gray-50 rounded-xl p-3 space-y-2">
            <p className="text-xs font-medium text-gray-600">Nueva lista</p>
            <div className="flex items-center gap-2">
              <input value={form.emoji} onChange={(e) => setForm(f => ({ ...f, emoji: e.target.value.slice(0, 2) }))} placeholder="😀" className="w-12 px-2 py-2 text-sm text-center border border-gray-200 rounded-lg bg-white" />
              <input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder='Ej. "Favoritos mujeres", "Fitness"' className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#D7F653]" />
              <button type="submit" disabled={saving || !form.name.trim()} className="px-3 py-2 text-sm font-medium rounded-lg bg-[#17181A] text-white disabled:opacity-40 inline-flex items-center gap-1">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Crear
              </button>
            </div>
            <ColorPicker value={form.color} onChange={(c) => setForm(f => ({ ...f, color: c }))} />
          </form>

          {items.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Todavía no hay listas.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {items.map(l => (
                <li key={l.id} className="py-2.5">
                  {editing?.id === l.id ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input value={editing.emoji || ''} onChange={(e) => setEditing(ed => ({ ...ed, emoji: e.target.value.slice(0, 2) }))} className="w-12 px-2 py-1.5 text-sm text-center border border-gray-200 rounded-lg" />
                        <input value={editing.name} onChange={(e) => setEditing(ed => ({ ...ed, name: e.target.value }))} className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg" autoFocus />
                        <button onClick={saveEdit} disabled={saving} className="p-1.5 rounded-lg bg-[#17181A] text-white"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-4 h-4" /></button>
                      </div>
                      <ColorPicker value={editing.color} onChange={(c) => setEditing(ed => ({ ...ed, color: c }))} />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                      <span className="text-sm text-gray-800 flex-1 truncate">{listLabel(l)}</span>
                      <span className="text-xs text-gray-400">{l.member_count} {l.member_count === 1 ? 'creador' : 'creadores'}</span>
                      <button onClick={() => setEditing({ id: l.id, name: l.name, emoji: l.emoji || '', color: l.color })} className="p-1.5 text-gray-400 hover:text-[#17181A] hover:bg-gray-100 rounded-lg" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => remove(l)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
