import { useState, useEffect, useMemo } from 'react';
import {
  Megaphone, Plus, Search, X, Trash2, Edit2, ExternalLink, Users, Loader2,
  Link2, Facebook, Instagram, Youtube, Globe, Twitter, Linkedin, Music2, Check
} from 'lucide-react';
import { referenceAdsAPI, clientGroupsAPI, clientsAPI } from '../utils/api';

// ---------- helpers ----------
const PLATFORMS = [
  { value: 'facebook', label: 'Facebook', icon: Facebook, color: 'bg-blue-100 text-blue-700' },
  { value: 'instagram', label: 'Instagram', icon: Instagram, color: 'bg-pink-100 text-pink-700' },
  { value: 'tiktok', label: 'TikTok', icon: Music2, color: 'bg-slate-900 text-white' },
  { value: 'youtube', label: 'YouTube', icon: Youtube, color: 'bg-red-100 text-red-700' },
  { value: 'twitter', label: 'X / Twitter', icon: Twitter, color: 'bg-slate-100 text-slate-700' },
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: 'bg-sky-100 text-sky-700' },
  { value: 'web', label: 'Web', icon: Globe, color: 'bg-gray-100 text-gray-700' },
  { value: 'other', label: 'Otro', icon: Link2, color: 'bg-gray-100 text-gray-700' },
];

const platformMeta = (value) => PLATFORMS.find(p => p.value === value) || PLATFORMS[PLATFORMS.length - 1];

function detectPlatformFromUrl(url = '') {
  const u = url.toLowerCase();
  if (u.includes('facebook.com') || u.includes('fb.com') || u.includes('fb.watch')) return 'facebook';
  if (u.includes('instagram.com')) return 'instagram';
  if (u.includes('tiktok.com')) return 'tiktok';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('twitter.com') || u.includes('x.com')) return 'twitter';
  if (u.includes('linkedin.com')) return 'linkedin';
  return 'web';
}

const COLOR_OPTIONS = [
  '#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6',
  '#8B5CF6', '#EF4444', '#14B8A6', '#F97316', '#64748B',
];

export default function Anuncios() {
  const [tab, setTab] = useState('ads'); // 'ads' | 'groups'

  // Shared data
  const [clients, setClients] = useState([]);
  const [groups, setGroups] = useState([]);

  // Ads state
  const [ads, setAds] = useState([]);
  const [loadingAds, setLoadingAds] = useState(true);
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [adModal, setAdModal] = useState(null); // null | 'new' | adObject (edit)

  // Groups state
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [groupModal, setGroupModal] = useState(null); // null | 'new' | groupObject

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    await Promise.all([loadAds(), loadGroups(), loadClients()]);
  };

  const loadAds = async () => {
    try {
      setLoadingAds(true);
      const { data } = await referenceAdsAPI.getAll();
      setAds(data);
    } catch (err) {
      console.error('Error loading ads:', err);
    } finally {
      setLoadingAds(false);
    }
  };

  const loadGroups = async () => {
    try {
      setLoadingGroups(true);
      const { data } = await clientGroupsAPI.getAll();
      setGroups(data);
    } catch (err) {
      console.error('Error loading groups:', err);
    } finally {
      setLoadingGroups(false);
    }
  };

  const loadClients = async () => {
    try {
      const { data } = await clientsAPI.getAll();
      setClients(data || []);
    } catch (err) {
      console.error('Error loading clients:', err);
    }
  };

  const filteredAds = useMemo(() => {
    return ads.filter(ad => {
      if (platformFilter && ad.platform !== platformFilter) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        (ad.title || '').toLowerCase().includes(s) ||
        (ad.url || '').toLowerCase().includes(s) ||
        (ad.notes || '').toLowerCase().includes(s)
      );
    });
  }, [ads, search, platformFilter]);

  // -------- Header --------
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-indigo-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Anuncios de referencia</h1>
          </div>
          <p className="text-sm text-gray-500 ml-13">
            Biblioteca de anuncios que tus clientes ven en su portal como inspiración
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        <button
          onClick={() => setTab('ads')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'ads'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Anuncios ({ads.length})
        </button>
        <button
          onClick={() => setTab('groups')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'groups'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Grupos de clientes ({groups.length})
        </button>
      </div>

      {tab === 'ads' ? (
        <AdsTab
          ads={filteredAds}
          loading={loadingAds}
          search={search}
          setSearch={setSearch}
          platformFilter={platformFilter}
          setPlatformFilter={setPlatformFilter}
          onNew={() => setAdModal('new')}
          onEdit={(ad) => setAdModal(ad)}
          onDelete={async (ad) => {
            if (!confirm(`¿Eliminar el anuncio "${ad.title || ad.url}"?`)) return;
            await referenceAdsAPI.delete(ad.id);
            loadAds();
          }}
        />
      ) : (
        <GroupsTab
          groups={groups}
          loading={loadingGroups}
          onNew={() => setGroupModal('new')}
          onEdit={(g) => setGroupModal(g)}
          onDelete={async (g) => {
            if (!confirm(`¿Eliminar el grupo "${g.name}"? Los clientes no se eliminan.`)) return;
            await clientGroupsAPI.delete(g.id);
            loadGroups();
            loadAds(); // ads may have referenced this group
          }}
        />
      )}

      {adModal && (
        <AdModal
          ad={adModal === 'new' ? null : adModal}
          clients={clients}
          groups={groups}
          onClose={() => setAdModal(null)}
          onSaved={() => { setAdModal(null); loadAds(); }}
        />
      )}

      {groupModal && (
        <GroupModal
          group={groupModal === 'new' ? null : groupModal}
          clients={clients}
          onClose={() => setGroupModal(null)}
          onSaved={() => { setGroupModal(null); loadGroups(); }}
        />
      )}
    </div>
  );
}

// ============================================================
// ADS TAB
// ============================================================
function AdsTab({ ads, loading, search, setSearch, platformFilter, setPlatformFilter, onNew, onEdit, onDelete }) {
  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por título, URL o notas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none"
          />
        </div>
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 outline-none bg-white"
        >
          <option value="">Todas las plataformas</option>
          {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <button
          onClick={onNew}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Subir anuncio
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-gray-400 animate-spin" /></div>
      ) : ads.length === 0 ? (
        <EmptyState onNew={onNew} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ads.map(ad => <AdCard key={ad.id} ad={ad} onEdit={onEdit} onDelete={onDelete} />)}
        </div>
      )}
    </>
  );
}

function AdCard({ ad, onEdit, onDelete }) {
  const meta = platformMeta(ad.platform);
  const Icon = meta.icon;
  const total = (ad.audience_count ?? 0);

  return (
    <div className="group bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md hover:border-gray-300 transition-all">
      <div className="relative bg-gray-100 aspect-video overflow-hidden">
        {ad.thumbnail_url ? (
          <img
            src={ad.thumbnail_url}
            alt={ad.title || 'Anuncio'}
            className="w-full h-full object-cover"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <Megaphone className="w-10 h-10" />
          </div>
        )}
        <div className={`absolute top-2 left-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium ${meta.color}`}>
          <Icon className="w-3 h-3" />
          {meta.label}
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-1">
          {ad.title || 'Sin título'}
        </h3>
        {ad.notes && (
          <p className="text-xs text-gray-500 line-clamp-2 mb-3">{ad.notes}</p>
        )}

        {/* Audience chips */}
        {(ad.groups?.length > 0 || ad.clients?.length > 0) && (
          <div className="flex flex-wrap gap-1 mb-3">
            {ad.groups?.slice(0, 3).map(g => (
              <span
                key={`g-${g.id}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                style={{ backgroundColor: `${g.color}20`, color: g.color }}
              >
                <Users className="w-2.5 h-2.5" />{g.name}
              </span>
            ))}
            {ad.clients?.slice(0, 3).map(c => (
              <span
                key={`c-${c.id}`}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-700"
              >
                {c.company}
              </span>
            ))}
            {((ad.groups?.length || 0) + (ad.clients?.length || 0)) > 6 && (
              <span className="text-[10px] text-gray-400 px-1">+más</span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{total} cliente{total === 1 ? '' : 's'} verán esto</span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <a
              href={ad.url}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 hover:bg-gray-100 rounded text-gray-500"
              title="Abrir"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={() => onEdit(ad)}
              className="p-1.5 hover:bg-gray-100 rounded text-gray-500"
              title="Editar"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(ad)}
              className="p-1.5 hover:bg-red-50 rounded text-red-500"
              title="Eliminar"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onNew }) {
  return (
    <div className="bg-white border border-dashed border-gray-300 rounded-xl py-16 text-center">
      <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mx-auto mb-3">
        <Megaphone className="w-6 h-6 text-indigo-600" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">Aún no hay anuncios referente</h3>
      <p className="text-sm text-gray-500 mb-4 max-w-sm mx-auto">
        Sube links de anuncios que inspiren a tus clientes y aparecerán en su portal.
      </p>
      <button
        onClick={onNew}
        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg"
      >
        <Plus className="w-4 h-4" />Subir primer anuncio
      </button>
    </div>
  );
}

// ============================================================
// AD MODAL
// ============================================================
function AdModal({ ad, clients, groups, onClose, onSaved }) {
  const editing = !!ad;
  const [url, setUrl] = useState(ad?.url || '');
  const [title, setTitle] = useState(ad?.title || '');
  const [notes, setNotes] = useState(ad?.notes || '');
  const [platform, setPlatform] = useState(ad?.platform || '');
  const [thumbnailUrl, setThumbnailUrl] = useState(ad?.thumbnail_url || '');
  const [clientIds, setClientIds] = useState(ad?.clients?.map(c => c.id) || []);
  const [groupIds, setGroupIds] = useState(ad?.groups?.map(g => g.id) || []);
  const [saving, setSaving] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  const autoPlatform = useMemo(() => detectPlatformFromUrl(url), [url]);

  const toggleClient = (id) => {
    setClientIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleGroup = (id) => {
    setGroupIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients;
    const s = clientSearch.toLowerCase();
    return clients.filter(c => (c.company || '').toLowerCase().includes(s));
  }, [clients, clientSearch]);

  const audienceCount = useMemo(() => {
    const ids = new Set(clientIds);
    for (const gid of groupIds) {
      const g = groups.find(x => x.id === gid);
      g?.members?.forEach(m => ids.add(m.id));
    }
    return ids.size;
  }, [clientIds, groupIds, groups]);

  const handleSave = async () => {
    if (!url.trim()) return alert('La URL es requerida');
    setSaving(true);
    try {
      const payload = {
        url: url.trim(),
        title: title.trim() || null,
        notes: notes.trim() || null,
        platform: platform || autoPlatform,
        thumbnail_url: thumbnailUrl.trim() || null,
        client_ids: clientIds,
        group_ids: groupIds,
      };
      if (editing) await referenceAdsAPI.update(ad.id, payload);
      else await referenceAdsAPI.create(payload);
      onSaved();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-lg font-semibold text-gray-900">
            {editing ? 'Editar anuncio' : 'Nuevo anuncio referente'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">URL del anuncio *</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.facebook.com/..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none"
            />
            {url && !platform && (
              <p className="text-xs text-gray-500 mt-1">Plataforma detectada: <span className="font-medium">{platformMeta(autoPlatform).label}</span></p>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Título</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='Ej. "Hook de pain point — primer 3s"'
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Por qué es un referente</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Explica al cliente qué hace funcionar este anuncio"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Plataforma</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 outline-none bg-white"
              >
                <option value="">Auto-detectar</option>
                {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Imagen miniatura (URL)</label>
              <input
                type="url"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="Opcional"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none"
              />
            </div>
          </div>

          {/* Audience */}
          <div className="border-t border-gray-100 pt-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">¿Quién lo verá?</h3>
              <span className="text-xs text-indigo-600 font-medium">{audienceCount} cliente{audienceCount === 1 ? '' : 's'}</span>
            </div>

            {/* Groups */}
            {groups.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-2">Grupos</p>
                <div className="flex flex-wrap gap-2">
                  {groups.map(g => {
                    const selected = groupIds.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => toggleGroup(g.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          selected ? 'border-transparent text-white' : 'border-gray-200 text-gray-700 hover:border-gray-300'
                        }`}
                        style={selected ? { backgroundColor: g.color } : {}}
                      >
                        {selected && <Check className="w-3 h-3" />}
                        <Users className="w-3 h-3" />
                        {g.name}
                        <span className="opacity-60">({g.member_count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Clients */}
            <div>
              <p className="text-xs text-gray-500 mb-2">Clientes individuales</p>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Buscar cliente..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div className="max-h-44 overflow-y-auto border border-gray-100 rounded-lg p-1">
                {filteredClients.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-gray-400 text-center">Sin clientes</div>
                ) : filteredClients.map(c => {
                  const selected = clientIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleClient(c.id)}
                      className={`w-full text-left px-3 py-1.5 rounded-md flex items-center justify-between text-xs transition-colors ${
                        selected ? 'bg-indigo-50 text-indigo-700 font-medium' : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <span>{c.company}</span>
                      {selected && <Check className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-end gap-2 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
          >Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving || !url.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium rounded-lg"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {editing ? 'Guardar cambios' : 'Crear anuncio'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// GROUPS TAB
// ============================================================
function GroupsTab({ groups, loading, onNew, onEdit, onDelete }) {
  return (
    <>
      <div className="flex justify-between items-center mb-5">
        <p className="text-sm text-gray-500">
          Agrupa clientes (ej. "E-commerce moda", "Servicios B2B") para enviarles anuncios juntos
        </p>
        <button
          onClick={onNew}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg"
        >
          <Plus className="w-4 h-4" />
          Nuevo grupo
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-gray-400 animate-spin" /></div>
      ) : groups.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl py-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mx-auto mb-3">
            <Users className="w-6 h-6 text-indigo-600" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">Sin grupos aún</h3>
          <p className="text-sm text-gray-500 mb-4">Crea tu primer grupo para clasificar audiencias</p>
          <button
            onClick={onNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg"
          >
            <Plus className="w-4 h-4" />Crear grupo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map(g => (
            <div key={g.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm hover:border-gray-300 transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${g.color}20` }}
                  >
                    <Users className="w-4 h-4" style={{ color: g.color }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">{g.name}</h3>
                    <p className="text-xs text-gray-500">{g.member_count} cliente{g.member_count === 1 ? '' : 's'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onEdit(g)} className="p-1.5 hover:bg-gray-100 rounded text-gray-500"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => onDelete(g)} className="p-1.5 hover:bg-red-50 rounded text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              {g.description && (
                <p className="text-xs text-gray-500 line-clamp-2 mb-3">{g.description}</p>
              )}

              <div className="flex flex-wrap gap-1">
                {g.members?.slice(0, 4).map(m => (
                  <span key={m.id} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                    {m.company}
                  </span>
                ))}
                {g.members?.length > 4 && (
                  <span className="text-[10px] px-2 py-0.5 text-gray-400">+{g.members.length - 4}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ============================================================
// GROUP MODAL
// ============================================================
function GroupModal({ group, clients, onClose, onSaved }) {
  const editing = !!group;
  const [name, setName] = useState(group?.name || '');
  const [description, setDescription] = useState(group?.description || '');
  const [color, setColor] = useState(group?.color || COLOR_OPTIONS[0]);
  const [clientIds, setClientIds] = useState(group?.members?.map(c => c.id) || []);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleClient = (id) => {
    setClientIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const filtered = useMemo(() => {
    if (!search) return clients;
    const s = search.toLowerCase();
    return clients.filter(c => (c.company || '').toLowerCase().includes(s));
  }, [clients, search]);

  const handleSave = async () => {
    if (!name.trim()) return alert('El nombre es requerido');
    setSaving(true);
    try {
      let groupId;
      if (editing) {
        await clientGroupsAPI.update(group.id, { name: name.trim(), description, color });
        groupId = group.id;
      } else {
        const { data } = await clientGroupsAPI.create({ name: name.trim(), description, color, client_ids: clientIds });
        groupId = data.id;
      }
      if (editing) {
        await clientGroupsAPI.setMembers(groupId, clientIds);
      }
      onSaved();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-lg font-semibold text-gray-900">
            {editing ? 'Editar grupo' : 'Nuevo grupo de clientes'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. E-commerce moda"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="¿Qué clientes incluye este grupo?"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-indigo-400 scale-110' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Clientes en el grupo ({clientIds.length})
            </label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div className="max-h-52 overflow-y-auto border border-gray-100 rounded-lg p-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-xs text-gray-400 text-center">Sin clientes</div>
              ) : filtered.map(c => {
                const selected = clientIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleClient(c.id)}
                    className={`w-full text-left px-3 py-1.5 rounded-md flex items-center justify-between text-xs transition-colors ${
                      selected ? 'bg-indigo-50 text-indigo-700 font-medium' : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <span>{c.company}</span>
                    {selected && <Check className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-end gap-2 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium rounded-lg"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {editing ? 'Guardar cambios' : 'Crear grupo'}
          </button>
        </div>
      </div>
    </div>
  );
}
