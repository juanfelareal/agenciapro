import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, ExternalLink, Users, Calendar, DollarSign,
  Loader2, Plus, X, Search, Check,
  Phone, Instagram, Mail,
  Trash2, FolderOpen, ChevronDown, FileText, Edit2,
  Send, ThumbsUp, FileSignature, Package, RefreshCw, Video,
  MessageCircle, CheckCircle2, Banknote, XCircle, GripVertical, Download
} from 'lucide-react';
import { ugcAPI } from '../utils/api';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

/**
 * Generate WhatsApp message for sending the contract link
 */
const generateContractWhatsAppMessage = (creator, project) => {
  const firstName = creator.full_name?.split(' ')[0] || 'Hola';
  const clientName = project.client_nickname || project.client_name || 'la marca';
  const contractUrl = `https://juanfelareal.github.io/sin-intermediarios-brief-creador/contrato.html?token=${creator.contract_token}`;

  let message = `¡${firstName}! Qué bueno que te sumes al proyecto con ${clientName}.\n\n`;
  message += `Aquí te envío el contrato para que lo revises y firmes:\n`;
  message += `${contractUrl}\n\n`;
  message += `Es súper rápido, solo necesitas confirmar tus datos y aceptar los términos.\n\n`;
  message += `Cualquier duda me cuentas.`;

  return encodeURIComponent(message);
};

const getContractWhatsAppUrl = (creator, project) => {
  if (!creator.phone || !creator.contract_token) return null;
  const phone = creator.phone.replace(/\D/g, '');
  const message = generateContractWhatsAppMessage(creator, project);
  return `https://wa.me/${phone}?text=${message}`;
};

// Statuses where contract can be sent (after first contact accepted, before signed)
const CONTRACT_SENDABLE_STATUSES = ['negotiating', 'confirmed'];

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
  const [dropdownStyle, setDropdownStyle] = useState({});
  const buttonRef = useRef(null);
  const statusInfo = getStatusInfo(status);
  const StatusIcon = statusInfo.icon;

  const handleOpen = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownHeight = 400; // Approximate height of dropdown
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      // If not enough space below, open upward
      if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
        setDropdownStyle({
          bottom: window.innerHeight - rect.top + 4,
          left: rect.left,
          maxHeight: Math.min(spaceAbove - 20, 400)
        });
      } else {
        setDropdownStyle({
          top: rect.bottom + 4,
          left: rect.left,
          maxHeight: Math.min(spaceBelow - 20, 400)
        });
      }
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
        style={{ backgroundColor: `${statusInfo.color}15`, color: statusInfo.color }}
      >
        <StatusIcon className="w-3.5 h-3.5" />
        <span className="max-w-[120px] truncate">{statusInfo.name}</span>
        <ChevronDown className="w-3 h-3 flex-shrink-0" />
      </button>

      {isOpen && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} />
          <div
            className="fixed z-[9999] bg-white border border-gray-200 rounded-xl shadow-xl py-1 min-w-[200px] overflow-y-auto"
            style={dropdownStyle}
          >
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
        </>,
        document.body
      )}
    </div>
  );
};

// Angle assigner component for creators
const AngleAssigner = ({ creatorId, assignedAngles, projectAngles, onToggle }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const buttonRef = useRef(null);

  const handleOpen = () => {
    if (buttonRef.current && projectAngles.length > 0) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownHeight = Math.min(projectAngles.length * 40 + 20, 200);
      const spaceBelow = window.innerHeight - rect.bottom;

      if (spaceBelow < dropdownHeight) {
        setDropdownStyle({
          bottom: window.innerHeight - rect.top + 4,
          left: rect.left,
          maxHeight: Math.min(rect.top - 20, 200)
        });
      } else {
        setDropdownStyle({
          top: rect.bottom + 4,
          left: rect.left,
          maxHeight: Math.min(spaceBelow - 20, 200)
        });
      }
    }
    setIsOpen(!isOpen);
  };

  // Get assigned angle objects
  const assignedAngleObjects = projectAngles.filter(a => assignedAngles.includes(a.id));

  if (projectAngles.length === 0) {
    return <span className="text-sm text-gray-400">-</span>;
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className="flex flex-wrap items-center gap-1 max-w-[200px] min-h-[32px] px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors"
      >
        {assignedAngleObjects.length > 0 ? (
          assignedAngleObjects.map(angle => (
            <span
              key={angle.id}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: `${angle.color}20`, color: angle.color }}
            >
              {angle.name}
            </span>
          ))
        ) : (
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Plus className="w-3 h-3" />
            Asignar
          </span>
        )}
      </button>

      {isOpen && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} />
          <div
            className="fixed z-[9999] bg-white border border-gray-200 rounded-xl shadow-xl py-2 min-w-[180px] overflow-y-auto"
            style={dropdownStyle}
          >
            <div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Ángulos del proyecto
            </div>
            {projectAngles.map(angle => {
              const isAssigned = assignedAngles.includes(angle.id);
              return (
                <button
                  key={angle.id}
                  onClick={() => {
                    onToggle(creatorId, angle.id);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                    isAssigned ? 'bg-gray-50' : ''
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                      isAssigned ? 'border-green-500 bg-green-500' : 'border-gray-300'
                    }`}
                  >
                    {isAssigned && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: `${angle.color}20`, color: angle.color }}
                  >
                    {angle.name}
                  </span>
                </button>
              );
            })}
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

// Sortable row component for drag and drop
const SortableCreatorRow = ({ creator, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: creator.creator_id });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: isDragging ? '#f0fdf4' : 'white',
    position: 'relative',
    zIndex: isDragging ? 1 : 0,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="hover:bg-gray-50/50"
    >
      {/* Drag handle */}
      <td className="px-2 py-3 w-8">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing rounded hover:bg-gray-100 touch-none"
          title="Arrastrar para reordenar"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </td>
      {children}
    </tr>
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
  const [editingProjectBrief, setEditingProjectBrief] = useState(false);
  const [projectBriefValue, setProjectBriefValue] = useState('');
  const [activeId, setActiveId] = useState(null);

  // Creator details editing modal (videos, price, brief)
  const [editingCreatorDetails, setEditingCreatorDetails] = useState(null); // creator object being edited
  const [creatorDetailsForm, setCreatorDetailsForm] = useState({ video_count: 1, agreed_rate: '', brief_url: '' });
  const [savingCreatorDetails, setSavingCreatorDetails] = useState(false);

  // Signed contracts viewing
  const [signedContracts, setSignedContracts] = useState([]);
  const [viewingContract, setViewingContract] = useState(null); // signed contract being viewed

  // Sales angles management
  const [newAngleName, setNewAngleName] = useState('');
  const [newAngleColor, setNewAngleColor] = useState('#16a34a');
  const [addingAngle, setAddingAngle] = useState(false);
  const angleColors = [
    { name: 'Verde', value: '#16a34a' },
    { name: 'Azul', value: '#2563eb' },
    { name: 'Morado', value: '#9333ea' },
    { name: 'Naranja', value: '#ea580c' },
    { name: 'Rosa', value: '#db2777' },
    { name: 'Amarillo', value: '#ca8a04' },
  ];

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag start
  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  // Handle drag end - reorder creators
  const handleDragEnd = (event) => {
    const { active, over } = event;

    setActiveId(null);
    console.log('Drag end:', { activeId: active.id, overId: over?.id });

    if (!over || active.id === over.id) {
      console.log('No valid drop target or same position');
      return;
    }

    // Use functional update to avoid stale closure issues
    setCreators(prevCreators => {
      const oldIndex = prevCreators.findIndex(c => c.creator_id === active.id);
      const newIndex = prevCreators.findIndex(c => c.creator_id === over.id);

      console.log('Moving:', { oldIndex, newIndex });

      if (oldIndex === -1 || newIndex === -1) {
        console.error('Could not find indices:', { oldIndex, newIndex });
        return prevCreators;
      }

      const newOrder = arrayMove(prevCreators, oldIndex, newIndex);

      // Save to backend (fire and forget, don't block UI)
      ugcAPI.reorderProjectCreators(id, newOrder.map(c => c.creator_id))
        .then(response => console.log('Reorder saved:', response.data))
        .catch(error => {
          console.error('Error saving order:', error);
          // Reload to get correct order from server
          loadProject();
        });

      return newOrder;
    });
  };

  // Get active creator for drag overlay
  const activeCreator = activeId ? creators.find(c => c.creator_id === activeId) : null;

  useEffect(() => {
    loadProject();
  }, [id]);

  const loadProject = async () => {
    try {
      const res = await ugcAPI.getProject(id);
      setProject(res.data.project);
      setCreators(res.data.creators || []);
      // Also load signed contracts
      try {
        const contractsRes = await ugcAPI.getProjectSignedContracts(id);
        setSignedContracts(contractsRes.data || []);
      } catch (e) {
        console.error('Error loading signed contracts:', e);
      }
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

  // Creator details editing handlers (videos, price, brief)
  const handleOpenCreatorDetails = (creator) => {
    setEditingCreatorDetails(creator);
    setCreatorDetailsForm({
      video_count: creator.video_count || 1,
      agreed_rate: creator.agreed_rate || project.creator_cost_per_video || '',
      brief_url: creator.brief_url || '',
    });
  };

  const handleSaveCreatorDetails = async () => {
    if (!editingCreatorDetails) return;
    setSavingCreatorDetails(true);
    try {
      const data = {
        video_count: parseInt(creatorDetailsForm.video_count) || 1,
        agreed_rate: parseFloat(creatorDetailsForm.agreed_rate) || 0,
        brief_url: creatorDetailsForm.brief_url || null,
      };
      await ugcAPI.updateProjectCreator(id, editingCreatorDetails.creator_id, data);
      setCreators(prev => prev.map(c =>
        c.creator_id === editingCreatorDetails.creator_id
          ? { ...c, video_count: data.video_count, agreed_rate: data.agreed_rate, brief_url: data.brief_url }
          : c
      ));
      setEditingCreatorDetails(null);
    } catch (error) {
      console.error('Error saving creator details:', error);
      alert('Error al guardar los cambios');
    } finally {
      setSavingCreatorDetails(false);
    }
  };

  // Helper to get signed contract for a creator
  const getSignedContract = (creatorId) => {
    return signedContracts.find(sc => sc.creator_id === creatorId);
  };

  // Generate printable PDF document for a signed contract
  const generateContractPDF = (contract) => {
    const signedDate = new Date(contract.signed_at).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const videoCount = contract.project_details?.video_count || 1;
    const pricePerVideo = contract.project_details?.price_per_video || 0;
    const totalPayment = contract.project_details?.total_payment || (videoCount * pricePerVideo);
    const currency = contract.project_details?.currency || 'COP';

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Contrato - ${contract.signer_name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #16a34a;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      font-size: 24px;
      color: #16a34a;
      margin-bottom: 5px;
    }
    .header p {
      color: #666;
      font-size: 14px;
    }
    .section {
      margin-bottom: 25px;
    }
    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: #16a34a;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 12px;
      padding-bottom: 5px;
      border-bottom: 1px solid #e5e7eb;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }
    .info-item {
      display: flex;
      flex-direction: column;
    }
    .info-label {
      font-size: 12px;
      color: #666;
      margin-bottom: 2px;
    }
    .info-value {
      font-size: 14px;
      font-weight: 500;
    }
    .highlight-box {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 20px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-top: 1px solid #e5e7eb;
      margin-top: 10px;
    }
    .total-label {
      font-weight: 600;
      font-size: 16px;
    }
    .total-value {
      font-size: 20px;
      font-weight: 700;
      color: #16a34a;
    }
    .signature-section {
      margin-top: 40px;
      text-align: center;
    }
    .signature-box {
      display: inline-block;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 10px 20px;
      background: #fafafa;
      min-width: 250px;
    }
    .signature-img {
      max-width: 200px;
      max-height: 80px;
    }
    .signature-name {
      font-weight: 600;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #333;
    }
    .signature-cedula {
      font-size: 12px;
      color: #666;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 11px;
      color: #999;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
    }
    @media print {
      body { padding: 20px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="background:#f3f4f6; padding:10px 20px; margin:-40px -40px 30px; text-align:center;">
    <button onclick="window.print()" style="background:#16a34a; color:white; border:none; padding:10px 30px; border-radius:8px; font-weight:600; cursor:pointer; font-size:14px;">
      Imprimir / Guardar PDF
    </button>
  </div>

  <div class="header">
    <h1>CONTRATO DE SERVICIOS UGC</h1>
    <p>Proyecto: ${contract.project_title || project?.title || 'N/A'} • Cliente: ${contract.client_name || project?.client_name || 'N/A'}</p>
  </div>

  <div class="section">
    <div class="section-title">Detalles del Contrato</div>
    <div class="highlight-box">
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Cantidad de Videos</span>
          <span class="info-value">${videoCount} video${videoCount > 1 ? 's' : ''}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Tarifa por Video</span>
          <span class="info-value">$${pricePerVideo.toLocaleString()} ${currency}</span>
        </div>
      </div>
      <div class="total-row">
        <span class="total-label">Pago Total</span>
        <span class="total-value">$${totalPayment.toLocaleString()} ${currency}</span>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Datos del Creador</div>
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Nombre Completo</span>
        <span class="info-value">${contract.signer_name}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Documento de Identidad</span>
        <span class="info-value">${contract.signer_cedula}</span>
      </div>
      ${contract.signer_email ? `
      <div class="info-item">
        <span class="info-label">Correo Electrónico</span>
        <span class="info-value">${contract.signer_email}</span>
      </div>` : ''}
      ${contract.signer_phone ? `
      <div class="info-item">
        <span class="info-label">Teléfono</span>
        <span class="info-value">${contract.signer_phone}</span>
      </div>` : ''}
    </div>
  </div>

  ${contract.bank_name ? `
  <div class="section">
    <div class="section-title">Información Bancaria</div>
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Banco</span>
        <span class="info-value">${contract.bank_name}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Tipo de Cuenta</span>
        <span class="info-value">${contract.bank_account_type}</span>
      </div>
      <div class="info-item" style="grid-column: span 2;">
        <span class="info-label">Número de Cuenta</span>
        <span class="info-value" style="font-family: monospace;">${contract.bank_account_number}</span>
      </div>
    </div>
  </div>` : ''}

  <div class="signature-section">
    <div class="section-title" style="text-align:center;">Firma del Creador</div>
    <div class="signature-box">
      ${contract.signature_data && contract.signature_data.startsWith('data:') ?
        `<img src="${contract.signature_data}" alt="Firma" class="signature-img" />` :
        `<div style="font-style:italic; color:#666; padding: 20px 0;">Firma digital registrada</div>`
      }
      <div class="signature-name">${contract.signer_name}</div>
      <div class="signature-cedula">C.C. ${contract.signer_cedula}</div>
    </div>
  </div>

  <div class="footer">
    <p>Documento firmado electrónicamente el ${signedDate}</p>
    <p>Este documento tiene validez legal según la Ley 527 de 1999 de Colombia</p>
  </div>
</body>
</html>`;

    // Open in new window for printing
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
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

  // Sales angles functions
  const handleAddAngle = async () => {
    if (!newAngleName.trim()) return;
    setAddingAngle(true);
    try {
      const newAngle = {
        id: `ang_${Date.now()}`,
        name: newAngleName.trim(),
        color: newAngleColor
      };
      const currentAngles = project.sales_angles || [];
      const updatedAngles = [...currentAngles, newAngle];
      await ugcAPI.updateProject(id, { sales_angles: updatedAngles });
      setProject(prev => ({ ...prev, sales_angles: updatedAngles }));
      setNewAngleName('');
    } catch (error) {
      console.error('Error adding angle:', error);
      alert('Error agregando ángulo');
    } finally {
      setAddingAngle(false);
    }
  };

  const handleRemoveAngle = async (angleId) => {
    try {
      const currentAngles = project.sales_angles || [];
      const updatedAngles = currentAngles.filter(a => a.id !== angleId);
      await ugcAPI.updateProject(id, { sales_angles: updatedAngles });
      setProject(prev => ({ ...prev, sales_angles: updatedAngles }));
      // Also remove this angle from all creators
      const updatedCreators = creators.map(c => ({
        ...c,
        assigned_angles: (c.assigned_angles || []).filter(id => id !== angleId)
      }));
      setCreators(updatedCreators);
    } catch (error) {
      console.error('Error removing angle:', error);
      alert('Error eliminando ángulo');
    }
  };

  const handleToggleCreatorAngle = async (creatorId, angleId) => {
    const creator = creators.find(c => c.creator_id === creatorId);
    if (!creator) return;

    const currentAngles = creator.assigned_angles || [];
    const hasAngle = currentAngles.includes(angleId);
    const updatedAngles = hasAngle
      ? currentAngles.filter(id => id !== angleId)
      : [...currentAngles, angleId];

    try {
      await ugcAPI.updateProjectCreator(id, creatorId, { assigned_angles: updatedAngles });
      setCreators(prev => prev.map(c =>
        c.creator_id === creatorId ? { ...c, assigned_angles: updatedAngles } : c
      ));
    } catch (error) {
      console.error('Error updating creator angles:', error);
      alert('Error actualizando ángulos del creador');
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

        {/* Sales Angles Section */}
        <div className="mt-5 pt-5 border-t border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-sm font-medium text-gray-700">Ángulos de venta</h3>
            <div className="flex-1 h-px bg-gray-100"></div>
          </div>

          {/* Existing angles */}
          <div className="flex flex-wrap gap-2 mb-3">
            {(project.sales_angles || []).map(angle => (
              <span
                key={angle.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
                style={{ backgroundColor: `${angle.color}20`, color: angle.color }}
              >
                {angle.name}
                <button
                  onClick={() => handleRemoveAngle(angle.id)}
                  className="p-0.5 hover:bg-white/50 rounded-full transition-colors"
                  title="Eliminar ángulo"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
            {(project.sales_angles || []).length === 0 && (
              <span className="text-sm text-gray-400 italic">Sin ángulos definidos</span>
            )}
          </div>

          {/* Add new angle */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newAngleName}
              onChange={(e) => setNewAngleName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddAngle()}
              placeholder="Nombre del ángulo..."
              className="w-48 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
            />
            <div className="flex items-center gap-1 p-1 bg-gray-50 rounded-xl">
              {angleColors.map(color => (
                <button
                  key={color.value}
                  onClick={() => setNewAngleColor(color.value)}
                  className={`w-6 h-6 rounded-full transition-all ${
                    newAngleColor === color.value ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
            <button
              onClick={handleAddAngle}
              disabled={!newAngleName.trim() || addingAngle}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {addingAngle ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Agregar
            </button>
          </div>
        </div>
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis]}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="w-8"></th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Creador</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ciudad</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Videos</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ángulos</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Brief</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Carpeta Drive</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <SortableContext
                  items={creators.map(c => c.creator_id)}
                  strategy={verticalListSortingStrategy}
                >
                  <tbody className="divide-y divide-gray-100">
                    {creators.map(creator => {
                      const socialNetworks = typeof creator.social_networks === 'string'
                        ? JSON.parse(creator.social_networks || '{}')
                        : creator.social_networks || {};

                      return (
                        <SortableCreatorRow key={creator.creator_id} creator={creator}>
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
                        <div className="flex items-center gap-2">
                          <div>
                            <span className="text-sm font-medium text-gray-900">
                              {creator.video_count || 1}
                            </span>
                            {creator.agreed_rate > 0 && (
                              <p className="text-xs text-gray-500">
                                ${creator.agreed_rate.toLocaleString('es-CO')}/video
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleOpenCreatorDetails(creator)}
                            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                            title="Editar videos, tarifa y brief"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Angles */}
                      <td className="px-4 py-3">
                        <AngleAssigner
                          creatorId={creator.creator_id}
                          assignedAngles={creator.assigned_angles || []}
                          projectAngles={project.sales_angles || []}
                          onToggle={handleToggleCreatorAngle}
                        />
                      </td>

                      {/* Brief */}
                      <td className="px-4 py-3">
                        {(creator.brief_url || project.brief_url) ? (
                          <a
                            href={creator.brief_url || project.brief_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${
                              creator.brief_url
                                ? 'text-green-600 hover:text-green-700'
                                : 'text-blue-600 hover:text-blue-700'
                            }`}
                            title={creator.brief_url ? 'Brief personalizado' : 'Brief del proyecto'}
                          >
                            <FileText className="w-4 h-4" />
                            {creator.brief_url ? 'Ver brief' : 'Brief proyecto'}
                          </a>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
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
                              title="Contactar por WhatsApp"
                            >
                              <WhatsAppIcon className="w-4 h-4" />
                            </a>
                          )}
                          {/* Contract WhatsApp button - only shows when creator is negotiating/confirmed */}
                          {creator.phone && creator.contract_token && CONTRACT_SENDABLE_STATUSES.includes(creator.status) && (
                            <a
                              href={getContractWhatsAppUrl(creator, project)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                              title="Enviar contrato por WhatsApp"
                            >
                              <FileSignature className="w-4 h-4" />
                            </a>
                          )}
                          {/* View signed contract button - shows when contract has been signed */}
                          {getSignedContract(creator.creator_id) && (
                            <button
                              onClick={() => setViewingContract(getSignedContract(creator.creator_id))}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Ver contrato firmado"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
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
                    </SortableCreatorRow>
                      );
                    })}
                  </tbody>
                </SortableContext>
              </table>
            </div>
            <DragOverlay>
              {activeCreator && (
                <div className="bg-white border-2 border-green-500 rounded-lg shadow-lg p-3 flex items-center gap-3 opacity-90">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                    {activeCreator.full_name?.charAt(0) || '?'}
                  </div>
                  <span className="font-medium text-gray-900">{activeCreator.full_name}</span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
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

      {/* Creator Details Edit Modal (videos, price, brief) */}
      {editingCreatorDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Editar detalles del creador</h2>
                <p className="text-sm text-gray-500">{editingCreatorDetails.full_name}</p>
              </div>
              <button
                onClick={() => setEditingCreatorDetails(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cantidad de videos
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={creatorDetailsForm.video_count}
                    onChange={(e) => setCreatorDetailsForm(prev => ({ ...prev, video_count: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tarifa por video (COP)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={creatorDetailsForm.agreed_rate}
                    onChange={(e) => setCreatorDetailsForm(prev => ({ ...prev, agreed_rate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder={project?.creator_cost_per_video ? `${project.creator_cost_per_video.toLocaleString()}` : ''}
                  />
                </div>
              </div>

              {/* Total calculation */}
              {(creatorDetailsForm.agreed_rate || project?.creator_cost_per_video) && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total a pagar:</span>
                    <span className="font-semibold text-gray-900">
                      ${((parseFloat(creatorDetailsForm.agreed_rate) || project?.creator_cost_per_video || 0) * parseInt(creatorDetailsForm.video_count || 1)).toLocaleString('es-CO')} COP
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Brief personalizado (URL)
                </label>
                <input
                  type="url"
                  value={creatorDetailsForm.brief_url}
                  onChange={(e) => setCreatorDetailsForm(prev => ({ ...prev, brief_url: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder={project?.brief_url ? 'Dejar vacío para usar brief del proyecto' : 'https://...'}
                />
                {project?.brief_url && !creatorDetailsForm.brief_url && (
                  <p className="text-xs text-gray-400 mt-1">
                    Usando brief del proyecto: {project.brief_url.substring(0, 40)}...
                  </p>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setEditingCreatorDetails(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveCreatorDetails}
                disabled={savingCreatorDetails}
                className="px-4 py-2 bg-[#17181A] text-white rounded-xl font-medium hover:bg-black transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {savingCreatorDetails && <Loader2 className="w-4 h-4 animate-spin" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Signed Contract Modal */}
      {viewingContract && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  Contrato Firmado
                </h2>
                <p className="text-sm text-gray-500">{viewingContract.creator_name}</p>
              </div>
              <button
                onClick={() => setViewingContract(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Contract Details */}
              <div className="bg-green-50 rounded-xl p-4">
                <h3 className="text-sm font-medium text-green-800 mb-2">Detalles del Contrato</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Videos:</span>
                    <span className="ml-2 font-medium">{viewingContract.project_details?.video_count || 1}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Tarifa/video:</span>
                    <span className="ml-2 font-medium">${(viewingContract.project_details?.price_per_video || 0).toLocaleString()} {viewingContract.project_details?.currency || 'COP'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Total:</span>
                    <span className="ml-2 font-bold text-green-700">${(viewingContract.project_details?.total_payment || 0).toLocaleString()} {viewingContract.project_details?.currency || 'COP'}</span>
                  </div>
                </div>
              </div>

              {/* Signer Info */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-700">Datos del Firmante</h3>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">Nombre</span>
                    <span className="font-medium">{viewingContract.signer_name}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">Cédula</span>
                    <span className="font-medium">{viewingContract.signer_cedula}</span>
                  </div>
                  {viewingContract.signer_email && (
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-500">Email</span>
                      <span className="font-medium">{viewingContract.signer_email}</span>
                    </div>
                  )}
                  {viewingContract.signer_phone && (
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-500">Teléfono</span>
                      <span className="font-medium">{viewingContract.signer_phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bank Info */}
              {viewingContract.bank_name && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-700">Datos Bancarios</h3>
                  <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Banco</span>
                      <span className="font-medium">{viewingContract.bank_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Tipo de cuenta</span>
                      <span className="font-medium">{viewingContract.bank_account_type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Número de cuenta</span>
                      <span className="font-medium font-mono">{viewingContract.bank_account_number}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Signature Date */}
              <div className="text-center text-xs text-gray-400 pt-2">
                Firmado el {new Date(viewingContract.signed_at).toLocaleDateString('es-CO', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setViewingContract(null)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                Cerrar
              </button>
              <button
                onClick={() => generateContractPDF(viewingContract)}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Descargar PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
