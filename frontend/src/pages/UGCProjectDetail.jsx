import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, ExternalLink, Users, Calendar, DollarSign,
  Loader2, Plus, X, Search, Check,
  Phone, Instagram, Mail,
  Trash2, FolderOpen, ChevronDown, FileText, Edit2,
  Send, ThumbsUp, FileSignature, Package, RefreshCw, Video,
  MessageCircle, CheckCircle2, Banknote, XCircle
} from 'lucide-react';
import { ugcAPI } from '../utils/api';

// WhatsApp icon component
const WhatsAppIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

/**
 * Generate WhatsApp message for contacting a creator about a project
 */
const generateWhatsAppMessage = (creator, project) => {
  const firstName = creator.full_name?.split(' ')[0] || 'Hola';
  const clientName = project.client_nickname || project.client_name || 'la marca';
  const clientWebsite = project.client_website || '';
  const videoCount = creator.video_count || 1;
  const pricePerVideo = project.creator_cost_per_video || 0;
  const total = videoCount * pricePerVideo;
  const briefUrl = creator.brief_url || project.brief_url;

  let message = `¡Hola ${firstName}! Soy Juanfe del equipo de LA REAL y te escribo porque estás en nuestra base de datos de creadores UGC. Tu perfil ha sido seleccionado y aceptado por uno de nuestros clientes y queremos presentarte el proyecto y saber si podemos contar contigo.\n\n`;

  // Client info
  message += `*Cliente:* ${clientName}`;
  if (clientWebsite) {
    message += ` (${clientWebsite})`;
  }
  message += `\n`;

  // Video count
  message += `*Cantidad de videos:* ${videoCount}\n`;

  // Payment info
  if (pricePerVideo > 0) {
    message += `*Lo que recibes:* $${pricePerVideo.toLocaleString('es-CO')} x video`;
    if (videoCount > 1) {
      message += ` (total: $${total.toLocaleString('es-CO')})`;
    }
    if (project.product_value > 0) {
      message += ` + producto de la marca para hacer el contenido. Producto que NO debes devolver, es para ti.`;
    }
    message += `\n`;
  } else if (project.product_value > 0) {
    message += `*Lo que recibes:* Producto de la marca valorado en $${project.product_value.toLocaleString('es-CO')} (es para ti, no lo devuelves).\n`;
  }

  // Deadline
  if (project.deadline) {
    const deadline = new Date(project.deadline).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
    message += `*Fecha de entrega:* ${deadline}\n`;
  }

  // Brief
  if (briefUrl) {
    message += `*Brief completo:* ${briefUrl}\n`;
  }

  message += `\nConfírmame si te suena y te envío más detalles`;

  return encodeURIComponent(message);
};

const getWhatsAppUrl = (creator, project) => {
  if (!creator.phone) return null;
  const phone = creator.phone.replace(/\D/g, '');
  const message = generateWhatsAppMessage(creator, project);
  return `https://wa.me/${phone}?text=${message}`;
};

const CREATOR_STATUSES = [
  { id: 'presented', name: 'Presentado a la marca', color: '#9CA3AF', icon: Send },
  { id: 'brand_approved', name: 'Aprobado por la marca', color: '#06B6D4', icon: ThumbsUp },
  { id: 'negotiating', name: 'Contactado y negociando', color: '#F59E0B', icon: MessageCircle },
  { id: 'confirmed', name: 'Confirmado + firmar contrato', color: '#3B82F6', icon: FileSignature },
  { id: 'contract_signed', name: 'Contrato firmado', color: '#8B5CF6', icon: Package },
  { id: 'rejected', name: 'Rechazó la oferta', color: '#EF4444', icon: XCircle },
  { id: 'producing', name: 'Produciendo', color: '#A855F7', icon: Video },
  { id: 'delivered_approved', name: 'Entregado aprobado', color: '#10B981', icon: CheckCircle2 },
  { id: 'delivered_changes', name: 'En cambios', color: '#F97316', icon: RefreshCw },
  { id: 'paid', name: 'Pagado', color: '#059669', icon: Banknote }
];

const getStatusInfo = (statusId) => {
  return CREATOR_STATUSES.find(s => s.id === statusId) || CREATOR_STATUSES[0];
};

// Status badge component
const StatusBadge = ({ status, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const statusInfo = getStatusInfo(status);
  const StatusIcon = statusInfo.icon;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
        style={{ backgroundColor: `${statusInfo.color}15`, color: statusInfo.color }}
      >
        <StatusIcon className="w-3.5 h-3.5" />
        <span className="max-w-[120px] truncate">{statusInfo.name}</span>
        <ChevronDown className="w-3 h-3 flex-shrink-0" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[200px]">
            {CREATOR_STATUSES.map(s => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    onChange(s.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                    s.id === status ? 'bg-gray-50' : ''
                  }`}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${s.color}20` }}
                  >
                    <Icon className="w-3 h-3" style={{ color: s.color }} />
                  </div>
                  <span className="text-gray-700">{s.name}</span>
                  {s.id === status && <Check className="w-4 h-4 text-green-500 ml-auto" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

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
  const [creatingFolder, setCreatingFolder] = useState(null);
  const [editingBrief, setEditingBrief] = useState(null); // creator_id being edited
  const [briefValue, setBriefValue] = useState('');
  const [editingProjectBrief, setEditingProjectBrief] = useState(false);
  const [projectBriefValue, setProjectBriefValue] = useState('');

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
      const res = await ugcAPI.getCreators();
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
      const res = await ugcAPI.updateProjectCreator(id, creatorId, { status: newStatus });
      // Update with response data which includes drive folder info if created
      setCreators(prev => prev.map(c =>
        c.creator_id === creatorId ? { ...c, ...res.data } : c
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

  const handleCreateDriveFolder = async (creatorId) => {
    setCreatingFolder(creatorId);
    try {
      const res = await ugcAPI.createDriveFolder(id, creatorId);
      if (res.data.success || res.data.drive_folder_url) {
        setCreators(prev => prev.map(c =>
          c.creator_id === creatorId
            ? { ...c, drive_folder_id: res.data.drive_folder_id, drive_folder_url: res.data.drive_folder_url }
            : c
        ));
      }
    } catch (error) {
      console.error('Error creating Drive folder:', error);
      alert('Error creando carpeta en Drive');
    } finally {
      setCreatingFolder(null);
    }
  };

  const handleStartEditBrief = (creator) => {
    setEditingBrief(creator.creator_id);
    setBriefValue(creator.brief_url || project.brief_url || '');
  };

  const handleSaveBrief = async (creatorId) => {
    try {
      await ugcAPI.updateProjectCreator(id, creatorId, { brief_url: briefValue });
      setCreators(prev => prev.map(c =>
        c.creator_id === creatorId ? { ...c, brief_url: briefValue } : c
      ));
      setEditingBrief(null);
      setBriefValue('');
    } catch (error) {
      console.error('Error updating brief:', error);
      alert('Error guardando el brief');
    }
  };

  const handleCancelEditBrief = () => {
    setEditingBrief(null);
    setBriefValue('');
  };

  const handleStartEditProjectBrief = () => {
    setProjectBriefValue(project.brief_url || '');
    setEditingProjectBrief(true);
  };

  const handleSaveProjectBrief = async () => {
    try {
      await ugcAPI.updateProject(id, { brief_url: projectBriefValue });
      setProject(prev => ({ ...prev, brief_url: projectBriefValue }));
      setEditingProjectBrief(false);
    } catch (error) {
      console.error('Error updating project brief:', error);
      alert('Error guardando el brief del proyecto');
    }
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
            {editingProjectBrief ? (
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={projectBriefValue}
                  onChange={(e) => setProjectBriefValue(e.target.value)}
                  placeholder="URL del brief del proyecto..."
                  className="w-64 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                  autoFocus
                />
                <button
                  onClick={handleSaveProjectBrief}
                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                  title="Guardar"
                >
                  <Check className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setEditingProjectBrief(false)}
                  className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Cancelar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                {project.brief_url ? (
                  <a
                    href={project.brief_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Ver Brief
                  </a>
                ) : (
                  <span className="px-4 py-2 text-sm text-gray-400">Sin brief</span>
                )}
                <button
                  onClick={handleStartEditProjectBrief}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Editar brief del proyecto"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
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

      {/* Creators Table */}
      <div className="flex-1 bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {creators.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <Users className="w-12 h-12 mb-3 opacity-40" />
            <p className="text-lg font-medium mb-1">Sin creadores asignados</p>
            <p className="text-sm mb-4">Agrega creadores a este proyecto para empezar</p>
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 px-4 py-2 bg-[#17181A] text-white rounded-xl text-sm font-medium hover:bg-black transition-colors"
            >
              <Plus className="w-4 h-4" />
              Agregar Creadores
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Creador</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ciudad</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Videos</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Brief</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Carpeta Drive</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {creators.map(creator => {
                  const socialNetworks = typeof creator.social_networks === 'string'
                    ? JSON.parse(creator.social_networks || '{}')
                    : creator.social_networks || {};

                  return (
                    <tr
                      key={creator.creator_id}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      {/* Creator */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                            {creator.full_name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <Link
                              to={`/app/ugc/${creator.creator_id}`}
                              className="font-medium text-gray-900 hover:text-green-600 transition-colors"
                            >
                              {creator.full_name}
                            </Link>
                            {socialNetworks?.instagram && (
                              <a
                                href={`https://instagram.com/${socialNetworks.instagram.replace('@', '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-gray-500 hover:text-pink-500 flex items-center gap-1 transition-colors"
                              >
                                <Instagram className="w-3 h-3" />
                                @{socialNetworks.instagram.replace('@', '')}
                              </a>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusBadge
                          status={creator.status}
                          onChange={(newStatus) => handleUpdateCreatorStatus(creator.creator_id, newStatus)}
                        />
                      </td>

                      {/* City */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">
                          {creator.city || '-'}
                        </span>
                      </td>

                      {/* Videos */}
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-900">
                          {creator.video_count || 1}
                        </span>
                      </td>

                      {/* Brief */}
                      <td className="px-4 py-3">
                        {editingBrief === creator.creator_id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="url"
                              value={briefValue}
                              onChange={(e) => setBriefValue(e.target.value)}
                              placeholder="URL del brief..."
                              className="w-40 px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveBrief(creator.creator_id)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                              title="Guardar"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleCancelEditBrief}
                              className="p-1 text-gray-400 hover:bg-gray-100 rounded transition-colors"
                              title="Cancelar"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {(creator.brief_url || project.brief_url) ? (
                              <a
                                href={creator.brief_url || project.brief_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                                title={creator.brief_url ? 'Brief personalizado' : 'Brief del proyecto'}
                              >
                                <FileText className="w-4 h-4" />
                                {creator.brief_url ? 'Ver brief' : 'Brief proyecto'}
                              </a>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                            <button
                              onClick={() => handleStartEditBrief(creator)}
                              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                              title="Editar brief"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Drive Folder */}
                      <td className="px-4 py-3">
                        {creator.drive_folder_url ? (
                          <a
                            href={creator.drive_folder_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                          >
                            <FolderOpen className="w-4 h-4" />
                            Abrir carpeta
                          </a>
                        ) : (
                          <button
                            onClick={() => handleCreateDriveFolder(creator.creator_id)}
                            disabled={creatingFolder === creator.creator_id}
                            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-green-600 transition-colors disabled:opacity-50"
                          >
                            {creatingFolder === creator.creator_id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <FolderOpen className="w-4 h-4" />
                            )}
                            Crear carpeta
                          </button>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {creator.phone && (
                            <a
                              href={getWhatsAppUrl(creator, project)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-[#25D366] hover:bg-green-50 rounded-lg transition-colors"
                              title="WhatsApp"
                            >
                              <WhatsAppIcon className="w-4 h-4" />
                            </a>
                          )}
                          {creator.phone && (
                            <a
                              href={`tel:${creator.phone}`}
                              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Llamar"
                            >
                              <Phone className="w-4 h-4" />
                            </a>
                          )}
                          {creator.email && (
                            <a
                              href={`mailto:${creator.email}`}
                              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Email"
                            >
                              <Mail className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            onClick={() => handleRemoveCreator(creator.creator_id)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
    </div>
  );
}
