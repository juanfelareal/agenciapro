import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, ExternalLink, Users, Calendar, DollarSign,
  Loader2, Plus, X, GripVertical, Search, Check,
  MessageCircle, Phone, Instagram, Mail, MoreVertical,
  Trash2, Edit2, Clock, CheckCircle2, Banknote, XCircle
} from 'lucide-react';
import { ugcAPI, clientsAPI } from '../utils/api';

const CREATOR_STATUSES = [
  { id: 'contacted', name: 'Contactado', color: '#9CA3AF', icon: MessageCircle },
  { id: 'negotiating', name: 'Negociando', color: '#F59E0B', icon: Clock },
  { id: 'confirmed', name: 'Confirmado', color: '#3B82F6', icon: CheckCircle2 },
  { id: 'producing', name: 'Produciendo', color: '#8B5CF6', icon: Edit2 },
  { id: 'delivered', name: 'Entregado', color: '#10B981', icon: Check },
  { id: 'paid', name: 'Pagado', color: '#059669', icon: Banknote },
  { id: 'rejected', name: 'Rechazado', color: '#EF4444', icon: XCircle }
];

export default function UGCProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [creators, setCreators] = useState([]);
  const [allCreators, setAllCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCreatorModal, setShowCreatorModal] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedCreators, setSelectedCreators] = useState([]);
  const [saving, setSaving] = useState(false);
  const [draggedCreator, setDraggedCreator] = useState(null);

  useEffect(() => {
    loadProject();
  }, [id]);

  const loadProject = async () => {
    try {
      const res = await ugcAPI.getProject(id);
      setProject(res.data.project);
      setCreators(res.data.creators || []);
    } catch (error) {
      console.error('Error loading project:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllCreators = async () => {
    try {
      const res = await ugcAPI.getAll();
      // Filter out creators already in the project
      const existingIds = creators.map(c => c.creator_id);
      setAllCreators(res.data.filter(c => !existingIds.includes(c.id)));
    } catch (error) {
      console.error('Error loading creators:', error);
    }
  };

  const handleOpenAddModal = () => {
    loadAllCreators();
    setShowAddModal(true);
    setSearch('');
    setSelectedCreators([]);
  };

  const handleAddCreators = async () => {
    if (selectedCreators.length === 0) return;
    setSaving(true);
    try {
      await ugcAPI.addProjectCreators(id, { creator_ids: selectedCreators });
      await loadProject();
      setShowAddModal(false);
      setSelectedCreators([]);
    } catch (error) {
      console.error('Error adding creators:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCreatorStatus = async (creatorId, newStatus) => {
    try {
      await ugcAPI.updateProjectCreator(id, creatorId, { status: newStatus });
      setCreators(prev => prev.map(c =>
        c.creator_id === creatorId ? { ...c, status: newStatus } : c
      ));
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleRemoveCreator = async (creatorId) => {
    if (!confirm('¿Eliminar este creador del proyecto?')) return;
    try {
      await ugcAPI.removeProjectCreator(id, creatorId);
      setCreators(prev => prev.filter(c => c.creator_id !== creatorId));
    } catch (error) {
      console.error('Error removing creator:', error);
    }
  };

  const handleDragStart = (e, creator) => {
    setDraggedCreator(creator);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, newStatus) => {
    e.preventDefault();
    if (draggedCreator && draggedCreator.status !== newStatus) {
      handleUpdateCreatorStatus(draggedCreator.creator_id, newStatus);
    }
    setDraggedCreator(null);
  };

  const getCreatorsByStatus = (status) => {
    return creators.filter(c => c.status === status);
  };

  const filteredAllCreators = allCreators.filter(c =>
    c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.social_networks?.instagram?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <p className="text-gray-500 mb-4">Proyecto no encontrado</p>
        <button
          onClick={() => navigate('/app/ugc/projects')}
          className="text-green-600 hover:text-green-700 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a proyectos
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => navigate('/app/ugc/projects')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-gray-900">{project.title}</h1>
            <p className="text-sm text-gray-500">
              {project.client_nickname || project.client_name}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {project.brief_url && (
              <a
                href={project.brief_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Ver Brief
              </a>
            )}
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#17181A] text-white rounded-xl text-sm font-medium hover:bg-black transition-colors"
            >
              <Plus className="w-4 h-4" />
              Agregar Creadores
            </button>
          </div>
        </div>

        {/* Project Stats */}
        <div className="flex items-center gap-6 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>{creators.length} creadores</span>
          </div>
          {project.budget > 0 && (
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              <span>${project.budget.toLocaleString('es-CO')} {project.currency}</span>
            </div>
          )}
          {project.deadline && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>Entrega: {new Date(project.deadline).toLocaleDateString('es-CO', { month: 'long', day: 'numeric' })}</span>
            </div>
          )}
        </div>

        {project.description && (
          <p className="text-sm text-gray-600 mt-3 max-w-2xl">{project.description}</p>
        )}
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max h-full">
          {CREATOR_STATUSES.map(status => {
            const statusCreators = getCreatorsByStatus(status.id);
            const StatusIcon = status.icon;

            return (
              <div
                key={status.id}
                className="w-72 flex flex-col bg-gray-50 rounded-2xl"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, status.id)}
              >
                {/* Column Header */}
                <div className="p-3 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${status.color}20` }}
                      >
                        <StatusIcon className="w-3.5 h-3.5" style={{ color: status.color }} />
                      </div>
                      <span className="font-medium text-gray-700 text-sm">{status.name}</span>
                    </div>
                    <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">
                      {statusCreators.length}
                    </span>
                  </div>
                </div>

                {/* Column Content */}
                <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                  {statusCreators.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      Sin creadores
                    </div>
                  ) : (
                    statusCreators.map(creator => (
                      <div
                        key={creator.creator_id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, creator)}
                        onClick={() => setShowCreatorModal(creator)}
                        className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group"
                      >
                        <div className="flex items-start gap-3">
                          {/* Avatar */}
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                            {creator.full_name?.charAt(0) || '?'}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 text-sm truncate">
                              {creator.full_name}
                            </h4>
                            {creator.social_networks?.instagram && (
                              <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                                <Instagram className="w-3 h-3" />
                                @{creator.social_networks.instagram.replace('@', '')}
                              </p>
                            )}
                          </div>

                          <GripVertical className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
                        </div>

                        {creator.agreed_rate > 0 && (
                          <div className="mt-2 text-xs text-gray-500">
                            ${creator.agreed_rate.toLocaleString('es-CO')}
                          </div>
                        )}

                        {creator.deliverables && (
                          <p className="mt-2 text-xs text-gray-500 line-clamp-2">
                            {creator.deliverables}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Creators Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Agregar Creadores</h2>
                <p className="text-sm text-gray-500">Selecciona creadores para este proyecto</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar creadores..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                />
              </div>
            </div>

            {/* Creators List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredAllCreators.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No hay creadores disponibles</p>
                </div>
              ) : (
                filteredAllCreators.map(creator => {
                  const isSelected = selectedCreators.includes(creator.id);
                  return (
                    <div
                      key={creator.id}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedCreators(prev => prev.filter(id => id !== creator.id));
                        } else {
                          setSelectedCreators(prev => [...prev, creator.id]);
                        }
                      }}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {/* Checkbox */}
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                        isSelected ? 'border-green-500 bg-green-500' : 'border-gray-300'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>

                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                        {creator.full_name?.charAt(0) || '?'}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 text-sm truncate">
                          {creator.full_name}
                        </h4>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          {creator.social_networks?.instagram && (
                            <span className="flex items-center gap-1">
                              <Instagram className="w-3 h-3" />
                              @{creator.social_networks.instagram.replace('@', '')}
                            </span>
                          )}
                          {creator.city && <span>{creator.city}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-sm text-gray-500">
                {selectedCreators.length} seleccionado{selectedCreators.length !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddCreators}
                  disabled={saving || selectedCreators.length === 0}
                  className="px-4 py-2 bg-[#17181A] text-white rounded-xl font-medium hover:bg-black transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Agregar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Creator Detail Modal */}
      {showCreatorModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Detalle del Creador</h2>
              <button
                onClick={() => setShowCreatorModal(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6">
              {/* Creator Info */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-bold text-xl">
                  {showCreatorModal.full_name?.charAt(0) || '?'}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {showCreatorModal.full_name}
                  </h3>
                  {showCreatorModal.city && (
                    <p className="text-sm text-gray-500">{showCreatorModal.city}</p>
                  )}
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-3 mb-6">
                {showCreatorModal.social_networks?.instagram && (
                  <a
                    href={`https://instagram.com/${showCreatorModal.social_networks.instagram.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-sm text-gray-600 hover:text-green-600"
                  >
                    <Instagram className="w-4 h-4" />
                    @{showCreatorModal.social_networks.instagram.replace('@', '')}
                  </a>
                )}
                {showCreatorModal.phone && (
                  <a
                    href={`https://wa.me/${showCreatorModal.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-sm text-gray-600 hover:text-green-600"
                  >
                    <Phone className="w-4 h-4" />
                    {showCreatorModal.phone}
                  </a>
                )}
                {showCreatorModal.email && (
                  <a
                    href={`mailto:${showCreatorModal.email}`}
                    className="flex items-center gap-3 text-sm text-gray-600 hover:text-green-600"
                  >
                    <Mail className="w-4 h-4" />
                    {showCreatorModal.email}
                  </a>
                )}
              </div>

              {/* Status Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
                <select
                  value={showCreatorModal.status}
                  onChange={(e) => {
                    handleUpdateCreatorStatus(showCreatorModal.creator_id, e.target.value);
                    setShowCreatorModal({ ...showCreatorModal, status: e.target.value });
                  }}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                >
                  {CREATOR_STATUSES.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <Link
                  to={`/app/ugc/${showCreatorModal.creator_id}`}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium text-center hover:bg-gray-200 transition-colors"
                >
                  Ver Perfil Completo
                </Link>
                <button
                  onClick={() => {
                    handleRemoveCreator(showCreatorModal.creator_id);
                    setShowCreatorModal(null);
                  }}
                  className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
