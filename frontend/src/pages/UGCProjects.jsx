import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  FolderKanban, Plus, Users, Calendar, ExternalLink,
  Loader2, Search, Filter, MoreVertical, Trash2, Edit2,
  ChevronRight, Clock, CheckCircle2, Archive, Video, Package, DollarSign
} from 'lucide-react';
import { ugcAPI, clientsAPI } from '../utils/api';

const PROJECT_STATUSES = {
  draft: { label: 'Borrador', color: '#9CA3AF', icon: Clock },
  active: { label: 'Activo', color: '#3B82F6', icon: FolderKanban },
  completed: { label: 'Completado', color: '#10B981', icon: CheckCircle2 },
  archived: { label: 'Archivado', color: '#6B7280', icon: Archive }
};

export default function UGCProjects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [search, setSearch] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const [newProject, setNewProject] = useState({
    client_id: '',
    title: '',
    description: '',
    brief_url: '',
    package_id: '',
    video_count: '',
    price_per_video: '',
    creator_cost_per_video: '',
    product_value: '',
    deadline: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [projectsRes, clientsRes, packagesRes] = await Promise.all([
        ugcAPI.getProjects(),
        clientsAPI.getAll(),
        ugcAPI.getPackages()
      ]);
      setProjects(projectsRes.data);
      setClients(clientsRes.data);
      setPackages(packagesRes.data);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePackageChange = (packageId) => {
    const selectedPackage = packages.find(p => p.id === parseInt(packageId));
    if (selectedPackage) {
      if (selectedPackage.is_custom) {
        // Custom package - let user fill in values
        setNewProject(prev => ({
          ...prev,
          package_id: packageId,
          video_count: '',
          price_per_video: '',
          creator_cost_per_video: ''
        }));
      } else {
        // Preset package - auto-fill values
        setNewProject(prev => ({
          ...prev,
          package_id: packageId,
          video_count: selectedPackage.video_count.toString(),
          price_per_video: selectedPackage.price_per_video.toString(),
          creator_cost_per_video: ''
        }));
      }
    } else {
      setNewProject(prev => ({
        ...prev,
        package_id: '',
        video_count: '',
        price_per_video: '',
        creator_cost_per_video: ''
      }));
    }
  };

  const selectedPackage = packages.find(p => p.id === parseInt(newProject.package_id));
  const isCustomPackage = selectedPackage?.is_custom;
  const videoCount = parseInt(newProject.video_count) || 0;
  const pricePerVideo = parseFloat(newProject.price_per_video) || 0;
  const creatorCost = parseFloat(newProject.creator_cost_per_video) || 0;
  const totalBudget = videoCount * pricePerVideo;
  const totalCreatorCost = videoCount * creatorCost;
  const agencyMargin = totalBudget - totalCreatorCost;

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProject.client_id || !newProject.title) return;

    setSaving(true);
    try {
      const res = await ugcAPI.createProject({
        ...newProject,
        budget: totalBudget,
        video_count: videoCount,
        price_per_video: pricePerVideo,
        creator_cost_per_video: creatorCost,
        product_value: parseFloat(newProject.product_value) || 0,
        package_id: newProject.package_id ? parseInt(newProject.package_id) : null
      });
      setShowNewModal(false);
      setNewProject({
        client_id: '', title: '', description: '', brief_url: '',
        package_id: '', video_count: '', price_per_video: '', creator_cost_per_video: '', product_value: '', deadline: ''
      });
      // Navigate to the new project
      navigate(`/app/ugc/projects/${res.data.id}`);
    } catch (error) {
      console.error('Error creating project:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProject = async (id, e) => {
    e.stopPropagation();
    if (!confirm('¿Eliminar este proyecto?')) return;
    try {
      await ugcAPI.deleteProject(id);
      setProjects(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  const filteredProjects = projects.filter(p => {
    if (search && !p.title.toLowerCase().includes(search.toLowerCase()) &&
        !p.client_name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterClient && p.client_id !== parseInt(filterClient)) return false;
    if (filterStatus && p.status !== filterStatus) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <FolderKanban className="w-6 h-6" />
            Proyectos UGC
          </h1>
          <p className="text-sm text-gray-500 mt-1">Campañas de contenido con creadores</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar proyectos..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm w-56 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
            />
          </div>

          {/* Filter by Client */}
          <select
            value={filterClient}
            onChange={e => setFilterClient(e.target.value)}
            className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
          >
            <option value="">Todos los clientes</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.nickname || c.company}</option>
            ))}
          </select>

          {/* Filter by Status */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"
          >
            <option value="">Todos los estados</option>
            {Object.entries(PROJECT_STATUSES).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>

          {/* New Project Button */}
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#17181A] text-white rounded-xl text-sm font-medium hover:bg-black transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo Proyecto
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 mb-5 border-b border-gray-100">
        <Link
          to="/app/ugc"
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent hover:border-gray-200 -mb-px transition-colors"
        >
          <Users className="w-4 h-4" />
          Creadores
        </Link>
        <Link
          to="/app/ugc/projects"
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 border-[#17181A] text-[#17181A] -mb-px"
        >
          <FolderKanban className="w-4 h-4" />
          Proyectos
        </Link>
      </div>

      {/* Projects List */}
      <div className="flex-1 overflow-auto">
        {filteredProjects.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <FolderKanban className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No hay proyectos</p>
            <p className="text-sm mt-1">Crea tu primer proyecto para organizar campañas UGC</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map(project => {
              const statusInfo = PROJECT_STATUSES[project.status] || PROJECT_STATUSES.draft;
              const StatusIcon = statusInfo.icon;

              return (
                <div
                  key={project.id}
                  onClick={() => navigate(`/app/ugc/projects/${project.id}`)}
                  className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:border-gray-200 transition-all cursor-pointer group"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 group-hover:text-green-600 transition-colors">
                        {project.title}
                      </h3>
                      <p className="text-sm text-gray-500 truncate">
                        {project.client_nickname || project.client_name}
                      </p>
                    </div>
                    <div
                      className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                      style={{ backgroundColor: `${statusInfo.color}20`, color: statusInfo.color }}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {statusInfo.label}
                    </div>
                  </div>

                  {/* Description */}
                  {project.description && (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                      {project.description}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{project.creator_count || 0} creadores</span>
                    </div>
                    {project.deadline && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(project.deadline).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    )}
                    {project.brief_url && (
                      <a
                        href={project.brief_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1 text-green-600 hover:text-green-700"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Brief
                      </a>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                    {project.budget > 0 && (
                      <span className="text-sm font-medium text-gray-700">
                        ${project.budget.toLocaleString('es-CO')} {project.currency}
                      </span>
                    )}
                    <button
                      onClick={(e) => handleDeleteProject(project.id, e)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Project Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold">Nuevo Proyecto UGC</h2>
              <p className="text-sm text-gray-500 mt-1">Crea una campaña para asignar creadores</p>
            </div>

            <form onSubmit={handleCreateProject} className="p-6 space-y-4">
              {/* Client */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cliente <span className="text-red-500">*</span>
                </label>
                <select
                  value={newProject.client_id}
                  onChange={e => setNewProject({ ...newProject, client_id: e.target.value })}
                  required
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                >
                  <option value="">Selecciona un cliente</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.nickname || c.company}</option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del proyecto <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newProject.title}
                  onChange={e => setNewProject({ ...newProject, title: e.target.value })}
                  placeholder="Ej: Campaña Lanzamiento Verano"
                  required
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <textarea
                  value={newProject.description}
                  onChange={e => setNewProject({ ...newProject, description: e.target.value })}
                  placeholder="Describe el objetivo de la campaña..."
                  rows={3}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 resize-none"
                />
              </div>

              {/* Brief URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Link al Brief
                </label>
                <input
                  type="url"
                  value={newProject.brief_url}
                  onChange={e => setNewProject({ ...newProject, brief_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                />
              </div>

              {/* Package Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Paquete de contenido <span className="text-red-500">*</span>
                </label>
                <select
                  value={newProject.package_id}
                  onChange={e => handlePackageChange(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                >
                  <option value="">Selecciona un paquete</option>
                  {packages.map(pkg => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} {!pkg.is_custom && `- ${pkg.video_count} videos ($${pkg.price_per_video.toLocaleString('es-CO')}/video)`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Package Details */}
              {newProject.package_id && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cantidad de videos
                      </label>
                      <input
                        type="number"
                        value={newProject.video_count}
                        onChange={e => setNewProject({ ...newProject, video_count: e.target.value })}
                        placeholder="20"
                        disabled={!isCustomPackage}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 disabled:bg-gray-50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Precio por video (COP)
                      </label>
                      <input
                        type="number"
                        value={newProject.price_per_video}
                        onChange={e => setNewProject({ ...newProject, price_per_video: e.target.value })}
                        placeholder="230000"
                        disabled={!isCustomPackage}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 disabled:bg-gray-50"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Pago por video al creador
                      </label>
                      <input
                        type="number"
                        value={newProject.creator_cost_per_video}
                        onChange={e => setNewProject({ ...newProject, creator_cost_per_video: e.target.value })}
                        placeholder="Ej: 100000"
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Valor del producto
                      </label>
                      <input
                        type="number"
                        value={newProject.product_value}
                        onChange={e => setNewProject({ ...newProject, product_value: e.target.value })}
                        placeholder="Ej: 150000"
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 -mt-2">Cuánto le pagas al creador por video + valor del producto que recibe</p>

                  {/* Margin Calculator */}
                  {videoCount > 0 && pricePerVideo > 0 && (
                    <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Resumen del proyecto
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Total del cliente</p>
                          <p className="font-semibold text-gray-900">${totalBudget.toLocaleString('es-CO')}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Costo creadores</p>
                          <p className="font-semibold text-gray-900">
                            {creatorCost > 0 ? `$${totalCreatorCost.toLocaleString('es-CO')}` : '-'}
                          </p>
                        </div>
                      </div>
                      {creatorCost > 0 && (
                        <div className="pt-2 border-t border-gray-200">
                          <div className="flex items-center justify-between">
                            <p className="text-gray-500">Margen agencia</p>
                            <p className={`font-bold text-lg ${agencyMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ${agencyMargin.toLocaleString('es-CO')}
                            </p>
                          </div>
                          <p className="text-xs text-gray-400">
                            {totalBudget > 0 ? ((agencyMargin / totalBudget) * 100).toFixed(1) : 0}% de margen
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Deadline */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha límite
                </label>
                <input
                  type="date"
                  value={newProject.deadline}
                  onChange={e => setNewProject({ ...newProject, deadline: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !newProject.client_id || !newProject.title || !newProject.package_id || videoCount <= 0}
                  className="px-4 py-2 bg-[#17181A] text-white rounded-xl font-medium hover:bg-black transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Crear Proyecto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
