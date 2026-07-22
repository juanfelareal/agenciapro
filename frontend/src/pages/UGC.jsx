import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext, closestCorners, PointerSensor, useSensor, useSensors,
  DragOverlay, useDroppable
} from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus, Search, Video, Instagram, Phone, MapPin,
  Loader2, X, GripVertical, Link2, Settings, Users, Copy, CheckCircle,
  Filter, ChevronDown, LayoutGrid, List, RefreshCw, ExternalLink, FolderKanban,
  Pencil, Check
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ugcAPI } from '../utils/api';
import { departments, getCitiesByDepartment } from '../data/colombiaLocations';

// ========================================
// CREATOR CARD (Draggable)
// ========================================
function CreatorCard({ creator, onClick }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging
  } = useSortable({ id: `creator-${creator.id}`, data: { creator } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const socialNetworks = creator.social_networks || {};

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white rounded-xl border border-gray-100 p-3.5 cursor-pointer hover:shadow-md transition-shadow group"
      onClick={() => onClick(creator)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2.5">
          {creator.profile_photo_url ? (
            <img
              src={creator.profile_photo_url}
              alt={creator.full_name}
              className="w-9 h-9 rounded-full object-cover"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-sm font-bold">
              {creator.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <h4 className="text-sm font-semibold text-[#17181A] line-clamp-1">{creator.full_name}</h4>
            {creator.city && (
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {creator.city}
              </p>
            )}
          </div>
        </div>
        <div
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-4 h-4 text-gray-400" />
        </div>
      </div>

      {/* Social Networks */}
      <div className="flex items-center gap-2 mb-2">
        {socialNetworks.instagram && (
          <a
            href={`https://instagram.com/${socialNetworks.instagram.replace('@', '')}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-pink-500 hover:text-pink-600"
          >
            <Instagram className="w-4 h-4" />
          </a>
        )}
        {socialNetworks.tiktok && (
          <a
            href={`https://tiktok.com/@${socialNetworks.tiktok.replace('@', '')}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-gray-800 hover:text-black"
          >
            <Video className="w-4 h-4" />
          </a>
        )}
        {socialNetworks.other && (
          <span className="text-gray-400">
            <Link2 className="w-4 h-4" />
          </span>
        )}
      </div>

      {/* Industries */}
      {creator.industries?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {creator.industries.slice(0, 3).map((ind, i) => (
            <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
              {ind}
            </span>
          ))}
          {creator.industries.length > 3 && (
            <span className="text-[10px] text-gray-400">+{creator.industries.length - 3}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ========================================
// CREATOR CARD OVERLAY (for drag preview)
// ========================================
function CreatorCardOverlay({ creator }) {
  return (
    <div className="bg-white rounded-xl border-2 border-[#D7F653] shadow-lg p-3.5 w-[240px]">
      <div className="flex items-center gap-2.5">
        {creator.profile_photo_url ? (
          <img
            src={creator.profile_photo_url}
            alt={creator.full_name}
            className="w-9 h-9 rounded-full object-cover"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-sm font-bold">
            {creator.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
        )}
        <div>
          <h4 className="text-sm font-semibold text-[#17181A]">{creator.full_name}</h4>
          {creator.city && (
            <p className="text-xs text-gray-400">{creator.city}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ========================================
// STAGE COLUMN (Droppable)
// ========================================
function StageColumn({ stage, creators, onCreatorClick }) {
  const { setNodeRef, isOver } = useDroppable({ id: `stage-${stage.id}` });

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-[260px] flex flex-col max-h-full rounded-2xl transition-colors ${
        isOver ? 'bg-[#D7F653]/10' : 'bg-gray-50/80'
      }`}
    >
      {/* Column Header */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
            <h3 className="text-sm font-semibold text-[#17181A]">{stage.name}</h3>
            <span className="text-xs text-gray-400 bg-white px-1.5 py-0.5 rounded-full">{creators.length}</span>
          </div>
        </div>
        {stage.description && (
          <p className="text-xs text-gray-400 ml-4.5">{stage.description}</p>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2 min-h-[100px]">
        {creators.map((creator) => (
          <CreatorCard key={creator.id} creator={creator} onClick={onCreatorClick} />
        ))}
      </div>
    </div>
  );
}

// ========================================
// MAIN UGC PAGE
// ========================================
export default function UGC() {
  const navigate = useNavigate();
  const [stages, setStages] = useState([]);
  const [creators, setCreators] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCreator, setActiveCreator] = useState(null);
  const [showNewCreator, setShowNewCreator] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [registrationLinks, setRegistrationLinks] = useState([]);
  const [viewMode, setViewMode] = useState('list'); // 'kanban' or 'list'
  const [syncingInstagram, setSyncingInstagram] = useState(false);
  const [hoveredCreator, setHoveredCreator] = useState(null);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('');
  const filterRef = useRef(null);
  const [newCreator, setNewCreator] = useState({
    full_name: '', email: '', phone: '', cedula: '',
    social_networks: { instagram: '', tiktok: '', other: '' },
    address: '', city: '', department: '', postal_code: '',
    shipping_notes: '', industries: [], bio: '', source: ''
  });
  const [saving, setSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState(null);
  const [newLinkTag, setNewLinkTag] = useState('');
  const [editingLinkId, setEditingLinkId] = useState(null);
  const [editingLinkTag, setEditingLinkTag] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => {
    loadData();
  }, []);

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setShowFilters(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = async () => {
    try {
      const [stagesRes, creatorsRes, industriesRes] = await Promise.all([
        ugcAPI.getStages(),
        ugcAPI.getCreators({
          search: search || undefined,
          department: filterDepartment || undefined,
          city: filterCity || undefined,
          industry: filterIndustry || undefined
        }),
        ugcAPI.getIndustries(),
      ]);
      setStages(stagesRes.data);
      setCreators(creatorsRes.data);
      setIndustries(industriesRes.data);
    } catch (error) {
      console.error('Error loading UGC:', error);
    } finally {
      setLoading(false);
    }
  };

  // Reload creators when filters change
  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        ugcAPI.getCreators({
          search: search || undefined,
          department: filterDepartment || undefined,
          city: filterCity || undefined,
          industry: filterIndustry || undefined
        })
          .then(res => setCreators(res.data))
          .catch(() => {});
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [search, filterDepartment, filterCity, filterIndustry]);

  // Reset city when department changes
  const handleFilterDepartmentChange = (dept) => {
    setFilterDepartment(dept);
    setFilterCity('');
  };

  const activeFilterCount = [filterDepartment, filterCity, filterIndustry].filter(Boolean).length;
  const filterCities = filterDepartment ? getCitiesByDepartment(filterDepartment) : [];

  const clearFilters = () => {
    setFilterDepartment('');
    setFilterCity('');
    setFilterIndustry('');
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) return;

    const creator = active.data.current?.creator;
    if (!creator) return;

    const overId = over.id.toString();
    let targetStageId;

    if (overId.startsWith('stage-')) {
      targetStageId = parseInt(overId.replace('stage-', ''));
    } else if (overId.startsWith('creator-')) {
      const targetCreator = creators.find(c => `creator-${c.id}` === overId);
      targetStageId = targetCreator?.stage_id;
    }

    if (!targetStageId || targetStageId === creator.stage_id) return;

    // Optimistic update
    setCreators(prev => prev.map(c =>
      c.id === creator.id ? { ...c, stage_id: targetStageId } : c
    ));

    try {
      await ugcAPI.moveCreatorStage(creator.id, targetStageId);
    } catch (error) {
      // Revert on error
      setCreators(prev => prev.map(c =>
        c.id === creator.id ? { ...c, stage_id: creator.stage_id } : c
      ));
    }

    setActiveCreator(null);
  };

  const handleDragStart = (event) => {
    setActiveCreator(event.active.data.current?.creator);
  };

  const handleCreateCreator = async (e) => {
    e.preventDefault();
    if (!newCreator.full_name || !newCreator.phone) return;

    setSaving(true);
    try {
      await ugcAPI.createCreator(newCreator);
      setShowNewCreator(false);
      setNewCreator({
        full_name: '', email: '', phone: '', cedula: '',
        social_networks: { instagram: '', tiktok: '', other: '' },
        address: '', city: '', department: '', postal_code: '',
        shipping_notes: '', industries: [], bio: '', source: ''
      });
      loadData();
    } catch (error) {
      console.error('Error creating creator:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCreatorClick = (creator) => {
    navigate(`/app/ugc/${creator.id}`);
  };

  const handleIndustryToggle = (slug) => {
    setNewCreator(prev => ({
      ...prev,
      industries: prev.industries.includes(slug)
        ? prev.industries.filter(i => i !== slug)
        : [...prev.industries, slug]
    }));
  };

  const loadRegistrationLinks = async () => {
    try {
      const res = await ugcAPI.getRegistrationLinks();
      setRegistrationLinks(res.data);
    } catch (error) {
      console.error('Error loading links:', error);
    }
  };

  const handleShowLinks = async () => {
    await loadRegistrationLinks();
    setShowLinkModal(true);
  };

  const handleCreateLink = async () => {
    try {
      await ugcAPI.createRegistrationLink(newLinkTag || null);
      setNewLinkTag('');
      loadRegistrationLinks();
    } catch (error) {
      console.error('Error creating link:', error);
    }
  };

  const handleCopyLink = (token) => {
    const url = `${window.location.origin}/ugc/register/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(token);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const handleEditLinkTag = (link) => {
    setEditingLinkId(link.id);
    setEditingLinkTag(link.tag || '');
  };

  const handleSaveLinkTag = async (linkId) => {
    try {
      await ugcAPI.updateRegistrationLink(linkId, editingLinkTag || null);
      setEditingLinkId(null);
      setEditingLinkTag('');
      loadRegistrationLinks();
    } catch (error) {
      console.error('Error updating link tag:', error);
    }
  };

  const handleCancelEditLinkTag = () => {
    setEditingLinkId(null);
    setEditingLinkTag('');
  };

  const handleSyncInstagram = async () => {
    setSyncingInstagram(true);
    try {
      const result = await ugcAPI.fetchAllInstagram();
      // Reload creators to show updated photos
      const creatorsRes = await ugcAPI.getCreators({
        search: search || undefined,
        department: filterDepartment || undefined,
        city: filterCity || undefined,
        industry: filterIndustry || undefined
      });
      setCreators(creatorsRes.data);
      alert(`Instagram sincronizado: ${result.data.updated} actualizados, ${result.data.failed} fallidos, ${result.data.skipped} sin Instagram`);
    } catch (error) {
      console.error('Error syncing Instagram:', error);
      alert('Error al sincronizar Instagram');
    } finally {
      setSyncingInstagram(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  // Group creators by stage
  const creatorsByStage = {};
  stages.forEach(s => { creatorsByStage[s.id] = []; });
  creators.forEach(c => {
    if (creatorsByStage[c.stage_id]) {
      creatorsByStage[c.stage_id].push(c);
    }
  });

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-semibold text-[#17181A] tracking-tight flex items-center gap-2">
            <Video className="w-6 h-6" /> UGC Creators
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestiona tu red de creadores de contenido</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar creadores..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 glass-solid rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D7F653] w-[200px]"
            />
          </div>

          {/* Filter Dropdown */}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2.5 border rounded-xl text-sm transition-colors ${
                activeFilterCount > 0
                  ? 'border-[#D7F653] bg-[#D7F653]/10 text-[#17181A]'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">Filtros</span>
              {activeFilterCount > 0 && (
                <span className="flex items-center justify-center w-5 h-5 bg-[#17181A] text-white text-[10px] font-bold rounded-full">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>

            {showFilters && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl border border-gray-200 shadow-xl p-4 z-50">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-[#17181A]">Filtros</h4>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={clearFilters}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Limpiar todo
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {/* Department Filter */}
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Departamento</label>
                    <select
                      value={filterDepartment}
                      onChange={(e) => handleFilterDepartmentChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#D7F653]"
                    >
                      <option value="">Todos los departamentos</option>
                      {departments.map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>

                  {/* City Filter */}
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Ciudad</label>
                    <select
                      value={filterCity}
                      onChange={(e) => setFilterCity(e.target.value)}
                      disabled={!filterDepartment}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#D7F653] disabled:bg-gray-50 disabled:text-gray-400"
                    >
                      <option value="">Todas las ciudades</option>
                      {filterCities.map((city) => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                  </div>

                  {/* Industry Filter */}
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Industria</label>
                    <select
                      value={filterIndustry}
                      onChange={(e) => setFilterIndustry(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#D7F653]"
                    >
                      <option value="">Todas las industrias</option>
                      {industries.map((ind) => (
                        <option key={ind.id} value={ind.slug}>{ind.icon} {ind.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Active Filters Summary */}
                {activeFilterCount > 0 && (
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500">
                      Mostrando <span className="font-semibold text-[#17181A]">{creators.length}</span> creadores
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* View Toggle */}
          <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-2.5 transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-[#17181A] text-white'
                  : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
              title="Vista Kanban"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2.5 transition-colors ${
                viewMode === 'list'
                  ? 'bg-[#17181A] text-white'
                  : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
              title="Vista Lista"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleSyncInstagram}
            disabled={syncingInstagram}
            className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
            title="Sincronizar fotos de Instagram"
          >
            <Instagram className={`w-4 h-4 ${syncingInstagram ? 'animate-pulse' : ''}`} />
            {syncingInstagram && <Loader2 className="w-3 h-3 animate-spin" />}
          </button>
          <button
            onClick={handleShowLinks}
            className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition-colors"
            title="Links de registro"
          >
            <Link2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate('/app/ugc/settings')}
            className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition-colors"
            title="Configuración"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowNewCreator(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#17181A] text-white rounded-xl text-sm font-medium hover:bg-[#26282C] transition-colors"
          >
            <Plus className="w-4 h-4" /> Nuevo Creador
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 mb-5 border-b border-gray-100">
        <Link
          to="/app/ugc"
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 border-[#17181A] text-[#17181A] -mb-px"
        >
          <Users className="w-4 h-4" />
          Creadores
        </Link>
        <Link
          to="/app/ugc/projects"
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent hover:border-gray-200 -mb-px transition-colors"
        >
          <FolderKanban className="w-4 h-4" />
          Proyectos
        </Link>
      </div>

      {/* Kanban Board */}
      {viewMode === 'kanban' && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 overflow-x-auto pb-4">
            <div className="flex gap-3 min-h-[500px]" style={{ minWidth: `${stages.length * 276}px` }}>
              {stages.map((stage) => (
                <StageColumn
                  key={stage.id}
                  stage={stage}
                  creators={creatorsByStage[stage.id] || []}
                  onCreatorClick={handleCreatorClick}
                />
              ))}
            </div>
          </div>

          <DragOverlay>
            {activeCreator ? <CreatorCardOverlay creator={activeCreator} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="flex-1 overflow-auto bg-white rounded-2xl border border-gray-100">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Creador</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Ubicación</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Redes</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Industrias</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Etapa</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Contacto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {creators.map((creator) => {
                const stage = stages.find(s => s.id === creator.stage_id);
                const socialNetworks = creator.social_networks || {};
                return (
                  <tr
                    key={creator.id}
                    onClick={() => handleCreatorClick(creator)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {creator.profile_photo_url ? (
                          <img
                            src={creator.profile_photo_url}
                            alt={creator.full_name}
                            className="w-9 h-9 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-sm font-bold">
                            {creator.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-[#17181A]">{creator.full_name}</p>
                          {creator.email && (
                            <p className="text-xs text-gray-400">{creator.email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {creator.city ? (
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" />
                          {creator.city}{creator.department ? `, ${creator.department}` : ''}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 relative">
                        {socialNetworks.instagram && (
                          <div
                            className="relative"
                            onMouseEnter={() => setHoveredCreator(creator.id)}
                            onMouseLeave={() => setHoveredCreator(null)}
                          >
                            <a
                              href={`https://instagram.com/${socialNetworks.instagram.replace('@', '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-pink-500 hover:text-pink-600 flex items-center gap-1"
                            >
                              <Instagram className="w-4 h-4" />
                              <span className="text-xs">@{socialNetworks.instagram.replace('@', '')}</span>
                            </a>
                            {/* Instagram Embed Popup */}
                            {hoveredCreator === creator.id && (
                              <div
                                className="fixed z-[100] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
                                style={{
                                  width: '320px',
                                  top: '50%',
                                  left: '50%',
                                  transform: 'translate(-50%, -50%)'
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="p-2 border-b border-gray-100 flex items-center justify-between">
                                  <span className="text-xs font-medium text-gray-500">Vista previa de Instagram</span>
                                  <div className="flex items-center gap-2">
                                    <a
                                      href={`https://instagram.com/${socialNetworks.instagram.replace('@', '')}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-pink-500 flex items-center gap-1 hover:underline"
                                    >
                                      Abrir <ExternalLink className="w-3 h-3" />
                                    </a>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setHoveredCreator(null); }}
                                      className="text-gray-400 hover:text-gray-600"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                                <iframe
                                  src={`https://www.instagram.com/${socialNetworks.instagram.replace('@', '')}/embed`}
                                  width="320"
                                  height="400"
                                  frameBorder="0"
                                  scrolling="no"
                                  allowTransparency="true"
                                  className="bg-white"
                                />
                              </div>
                            )}
                          </div>
                        )}
                        {socialNetworks.tiktok && (
                          <a
                            href={`https://tiktok.com/@${socialNetworks.tiktok.replace('@', '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-gray-800 hover:text-black"
                          >
                            <Video className="w-4 h-4" />
                          </a>
                        )}
                        {!socialNetworks.instagram && !socialNetworks.tiktok && (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {creator.industries?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {creator.industries.slice(0, 2).map((ind, i) => (
                            <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                              {ind}
                            </span>
                          ))}
                          {creator.industries.length > 2 && (
                            <span className="text-[10px] text-gray-400">+{creator.industries.length - 2}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {stage && (
                        <span
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full"
                          style={{ backgroundColor: `${stage.color}20`, color: stage.color }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stage.color }} />
                          {stage.name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {creator.phone ? (
                        <a
                          href={`https://wa.me/${creator.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700 bg-green-50 px-2 py-1 rounded-lg"
                        >
                          <Phone className="w-3 h-3" /> WhatsApp
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {creators.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No hay creadores que coincidan con los filtros
            </div>
          )}
        </div>
      )}

      {/* New Creator Modal */}
      {showNewCreator && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNewCreator(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-[#17181A]">Nuevo Creador</h2>
              <button onClick={() => setShowNewCreator(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleCreateCreator} className="p-6 space-y-5">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Nombre completo *</label>
                  <input
                    type="text"
                    value={newCreator.full_name}
                    onChange={(e) => setNewCreator({ ...newCreator, full_name: e.target.value })}
                    placeholder="Juan Pérez"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D7F653]"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">WhatsApp *</label>
                  <input
                    type="tel"
                    value={newCreator.phone}
                    onChange={(e) => setNewCreator({ ...newCreator, phone: e.target.value })}
                    placeholder="+57 300 123 4567"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D7F653]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Email</label>
                  <input
                    type="email"
                    value={newCreator.email}
                    onChange={(e) => setNewCreator({ ...newCreator, email: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D7F653]"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Cédula</label>
                  <input
                    type="text"
                    value={newCreator.cedula}
                    onChange={(e) => setNewCreator({ ...newCreator, cedula: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D7F653]"
                  />
                </div>
              </div>

              {/* Social Networks */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Redes Sociales</label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="relative">
                    <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pink-500" />
                    <input
                      type="text"
                      value={newCreator.social_networks.instagram}
                      onChange={(e) => setNewCreator({
                        ...newCreator,
                        social_networks: { ...newCreator.social_networks, instagram: e.target.value }
                      })}
                      placeholder="@usuario"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D7F653]"
                    />
                  </div>
                  <div className="relative">
                    <Video className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-800" />
                    <input
                      type="text"
                      value={newCreator.social_networks.tiktok}
                      onChange={(e) => setNewCreator({
                        ...newCreator,
                        social_networks: { ...newCreator.social_networks, tiktok: e.target.value }
                      })}
                      placeholder="@usuario"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D7F653]"
                    />
                  </div>
                  <div className="relative">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={newCreator.social_networks.other}
                      onChange={(e) => setNewCreator({
                        ...newCreator,
                        social_networks: { ...newCreator.social_networks, other: e.target.value }
                      })}
                      placeholder="Otro link"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D7F653]"
                    />
                  </div>
                </div>
              </div>

              {/* Industries */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Industrias de interés</label>
                <div className="flex flex-wrap gap-2">
                  {industries.map((industry) => (
                    <button
                      key={industry.id}
                      type="button"
                      onClick={() => handleIndustryToggle(industry.slug)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        newCreator.industries.includes(industry.slug)
                          ? 'bg-[#17181A] text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {industry.icon} {industry.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Ubicación</label>
                <div className="grid grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={newCreator.city}
                    onChange={(e) => setNewCreator({ ...newCreator, city: e.target.value })}
                    placeholder="Ciudad"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D7F653]"
                  />
                  <input
                    type="text"
                    value={newCreator.department}
                    onChange={(e) => setNewCreator({ ...newCreator, department: e.target.value })}
                    placeholder="Departamento"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D7F653]"
                  />
                  <select
                    value={newCreator.source}
                    onChange={(e) => setNewCreator({ ...newCreator, source: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D7F653]"
                  >
                    <option value="">Fuente...</option>
                    <option value="instagram">Instagram</option>
                    <option value="referido">Referido</option>
                    <option value="registro_web">Registro web</option>
                    <option value="evento">Evento</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              </div>

              {/* Bio */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Bio / Notas</label>
                <textarea
                  value={newCreator.bio}
                  onChange={(e) => setNewCreator({ ...newCreator, bio: e.target.value })}
                  rows={2}
                  placeholder="Experiencia, estilo de contenido, etc."
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D7F653] resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewCreator(false)}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2.5 bg-[#17181A] text-white rounded-xl text-sm font-medium hover:bg-[#26282C] transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crear Creador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Registration Links Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowLinkModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-[#17181A]">Links de Registro</h2>
                <p className="text-sm text-gray-500 mt-0.5">Comparte estos links para que creadores se registren</p>
              </div>
              <button onClick={() => setShowLinkModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-3 max-h-[400px] overflow-y-auto">
              {registrationLinks.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No hay links creados</p>
              ) : (
                registrationLinks.map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      {editingLinkId === link.id ? (
                        <div className="flex items-center gap-2 mb-1">
                          <input
                            type="text"
                            value={editingLinkTag}
                            onChange={(e) => setEditingLinkTag(e.target.value)}
                            placeholder="Ej: Instagram Bio, WhatsApp..."
                            className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D7F653]"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveLinkTag(link.id);
                              if (e.key === 'Escape') handleCancelEditLinkTag();
                            }}
                          />
                          <button
                            onClick={() => handleSaveLinkTag(link.id)}
                            className="p-1 text-green-600 hover:bg-green-100 rounded"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={handleCancelEditLinkTag}
                            className="p-1 text-gray-400 hover:bg-gray-200 rounded"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 mb-1">
                          {link.tag ? (
                            <span className="inline-block text-[10px] font-medium bg-[#D7F653] text-[#17181A] px-2 py-0.5 rounded-full">
                              {link.tag}
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400 italic">Sin etiqueta</span>
                          )}
                          <button
                            onClick={() => handleEditLinkTag(link)}
                            className="p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"
                            title="Editar etiqueta"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      <p className="text-xs text-gray-500 truncate">
                        {window.location.origin}/ugc/register/{link.token}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {link.uses_count} registros • {link.status === 'active' ? '✅ Activo' : '⏸️ Inactivo'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleCopyLink(link.token)}
                      className={`p-2 rounded-lg transition-colors ${
                        copiedLink === link.token
                          ? 'bg-green-100 text-green-600'
                          : 'hover:bg-gray-200 text-gray-500'
                      }`}
                    >
                      {copiedLink === link.token ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="p-6 border-t border-gray-100 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Etiqueta (opcional)
                </label>
                <input
                  type="text"
                  value={newLinkTag}
                  onChange={(e) => setNewLinkTag(e.target.value)}
                  placeholder="Ej: Instagram Bio, WhatsApp, Evento Mayo..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D7F653]"
                />
              </div>
              <button
                onClick={handleCreateLink}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#17181A] text-white rounded-xl text-sm font-medium hover:bg-[#26282C] transition-colors"
              >
                <Plus className="w-4 h-4" /> Crear Nuevo Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
