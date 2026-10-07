import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Instagram, Video, Link2, MapPin, Phone, Mail, CreditCard,
  Loader2, Plus, X, Edit3, DollarSign, Package, Calendar, CheckCircle,
  Clock, AlertCircle, User, Building2, FileText, Palette, Globe2, Camera,
  Baby, PawPrint, Dumbbell, Sparkles, Play, Languages, Wrench, StickyNote,
  Trash2, Send, MessageSquare
} from 'lucide-react';
import { ugcAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { departments, getCitiesByDepartment } from '../data/colombiaLocations';
import { ListChips, ListTagButton, CreatorListPicker } from '../components/ugc/CreatorLists';

const SOURCE_OPTIONS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'referido', label: 'Referido' },
  { value: 'registro_web', label: 'Registro web' },
  { value: 'evento', label: 'Evento' },
  { value: 'manual', label: 'Manual' },
  { value: 'otro', label: 'Otro' },
];

const INPUT_CLASS = 'w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D7F653] disabled:bg-gray-50 disabled:text-gray-400';

// Normalize an Instagram/TikTok handle or URL to a bare username (no @, no URL)
function normalizeHandle(input, domain) {
  if (!input) return '';
  let value = String(input).trim();
  if (value.includes(domain)) {
    const match = value.match(new RegExp(domain.replace('.', '\\.') + '/@?([^/?#]+)'));
    if (match) value = match[1];
  }
  return value.replace(/^@/, '').trim();
}

const EMPTY_EDIT_FORM = {
  full_name: '', email: '', phone: '', cedula: '',
  social_networks: { instagram: '', tiktok: '', other: '' },
  address: '', city: '', department: '', postal_code: '', shipping_notes: '',
  industries: [], bio: '', portfolio_url: '', source: '', default_rate: '', stage_id: ''
};

const ASSIGNMENT_STATUS = {
  proposed: { label: 'Propuesto', color: 'bg-gray-100 text-gray-700' },
  accepted: { label: 'Aceptado', color: 'bg-blue-100 text-blue-700' },
  in_production: { label: 'En producción', color: 'bg-yellow-100 text-yellow-700' },
  delivered: { label: 'Entregado', color: 'bg-green-100 text-green-700' },
  paid: { label: 'Pagado', color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700' }
};

const PAYMENT_STATUS = {
  pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  completed: { label: 'Completado', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  failed: { label: 'Fallido', color: 'bg-red-100 text-red-700', icon: AlertCircle }
};

export default function UGCCreatorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // Go back to wherever the user came from (project, filtered list, ...);
  // fall back to the creators list when the page was opened directly.
  const goBack = () => (location.key !== 'default' ? navigate(-1) : navigate('/app/ugc'));
  const { user } = useAuth();
  const canDelete = ['admin', 'manager'].includes(user?.role);
  const [creator, setCreator] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [stages, setStages] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');
  const [lists, setLists] = useState([]);
  const [listPicker, setListPicker] = useState(null); // rect

  // Internal notes
  const [notes, setNotes] = useState([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteProjectId, setNewNoteProjectId] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Modals
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit profile
  const [industriesCatalog, setIndustriesCatalog] = useState([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [editError, setEditError] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Delete creator
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Assignment form
  const [assignmentForm, setAssignmentForm] = useState({
    client_id: '', project_id: '', title: '', description: '', deliverables: '',
    start_date: '', end_date: '', agreed_value: '', status: 'proposed', notes: ''
  });

  // Payment form
  const [paymentForm, setPaymentForm] = useState({
    assignment_id: '', amount: '', payment_date: '', payment_method: '',
    reference_number: '', notes: ''
  });

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [creatorRes, assignmentsRes, paymentsRes, stagesRes, clientsRes, projectsRes, notesRes, listsRes, industriesRes] = await Promise.all([
        ugcAPI.getCreator(id),
        ugcAPI.getAssignments({ creator_id: id }),
        ugcAPI.getPayments({ creator_id: id }),
        ugcAPI.getStages(),
        ugcAPI.getUgcClients().catch(() => ({ data: [] })),
        ugcAPI.getProjects().catch(() => ({ data: [] })),
        ugcAPI.getCreatorNotes(id).catch(() => ({ data: [] })),
        ugcAPI.getLists().catch(() => ({ data: [] })),
        ugcAPI.getIndustries().catch(() => ({ data: [] })),
      ]);
      setCreator(creatorRes.data);
      setAssignments(assignmentsRes.data);
      setPayments(paymentsRes.data);
      setStages(stagesRes.data);
      setClients(clientsRes.data || []);
      setProjects(projectsRes.data || []);
      setNotes(notesRes.data || []);
      setLists(listsRes.data || []);
      setIndustriesCatalog(industriesRes.data || []);
    } catch (error) {
      console.error('Error loading creator:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStageChange = async (stageId) => {
    try {
      await ugcAPI.moveCreatorStage(id, stageId);
      setCreator(prev => ({ ...prev, stage_id: stageId }));
    } catch (error) {
      console.error('Error moving creator:', error);
    }
  };

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    if (!assignmentForm.client_id || !assignmentForm.title) return;

    setSaving(true);
    try {
      await ugcAPI.createAssignment({
        ...assignmentForm,
        creator_id: parseInt(id),
        agreed_value: assignmentForm.agreed_value ? parseFloat(assignmentForm.agreed_value) : 0,
      });
      setShowAssignmentModal(false);
      setAssignmentForm({
        client_id: '', project_id: '', title: '', description: '', deliverables: '',
        start_date: '', end_date: '', agreed_value: '', status: 'proposed', notes: ''
      });
      loadData();
    } catch (error) {
      console.error('Error creating assignment:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePayment = async (e) => {
    e.preventDefault();
    if (!paymentForm.amount || !paymentForm.payment_date) return;

    setSaving(true);
    try {
      await ugcAPI.createPayment({
        ...paymentForm,
        creator_id: parseInt(id),
        amount: parseFloat(paymentForm.amount),
        assignment_id: paymentForm.assignment_id || null,
      });
      setShowPaymentModal(false);
      setPaymentForm({
        assignment_id: '', amount: '', payment_date: '', payment_method: '',
        reference_number: '', notes: ''
      });
      loadData();
    } catch (error) {
      console.error('Error creating payment:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateAssignmentStatus = async (assignmentId, newStatus) => {
    try {
      await ugcAPI.updateAssignment(assignmentId, { status: newStatus });
      setAssignments(prev => prev.map(a =>
        a.id === assignmentId ? { ...a, status: newStatus } : a
      ));
    } catch (error) {
      console.error('Error updating assignment:', error);
    }
  };

  // Internal notes handlers
  const handleCreateNote = async (e) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;

    setSavingNote(true);
    try {
      const res = await ugcAPI.createCreatorNote(id, {
        content: newNoteContent.trim(),
        project_id: newNoteProjectId || null,
      });
      setNotes(prev => [res.data, ...prev]);
      setNewNoteContent('');
      setNewNoteProjectId('');
    } catch (error) {
      console.error('Error creating note:', error);
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!confirm('¿Eliminar esta nota?')) return;

    try {
      await ugcAPI.deleteCreatorNote(noteId);
      setNotes(prev => prev.filter(n => n.id !== noteId));
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  // ---- Edit profile
  const openEditModal = () => {
    if (!creator) return;
    const sn = creator.social_networks || {};
    setEditForm({
      full_name: creator.full_name || '',
      email: creator.email || '',
      phone: creator.phone || '',
      cedula: creator.cedula || '',
      social_networks: { instagram: sn.instagram || '', tiktok: sn.tiktok || '', other: sn.other || '' },
      address: creator.address || '',
      city: creator.city || '',
      department: creator.department || '',
      postal_code: creator.postal_code || '',
      shipping_notes: creator.shipping_notes || '',
      industries: Array.isArray(creator.industries) ? [...creator.industries] : [],
      bio: creator.bio || '',
      portfolio_url: creator.portfolio_url || '',
      source: creator.source || '',
      default_rate: creator.default_rate ?? creator.rate_per_video ?? '',
      stage_id: creator.stage_id || '',
    });
    setEditError(null);
    setShowEditModal(true);
  };

  const setEditField = (field, value) => setEditForm(prev => ({ ...prev, [field]: value }));

  const toggleEditIndustry = (slug) => {
    setEditForm(prev => ({
      ...prev,
      industries: prev.industries.includes(slug)
        ? prev.industries.filter(i => i !== slug)
        : [...prev.industries, slug]
    }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!editForm.full_name.trim()) { setEditError('El nombre es obligatorio'); return; }
    if (!editForm.phone.trim()) { setEditError('El teléfono es obligatorio'); return; }

    setSavingProfile(true);
    setEditError(null);
    try {
      const payload = {
        full_name: editForm.full_name.trim(),
        email: editForm.email.trim() || null,
        phone: editForm.phone.trim(),
        cedula: editForm.cedula.trim() || null,
        social_networks: {
          instagram: normalizeHandle(editForm.social_networks.instagram, 'instagram.com'),
          tiktok: normalizeHandle(editForm.social_networks.tiktok, 'tiktok.com'),
          other: (editForm.social_networks.other || '').trim(),
        },
        address: editForm.address.trim() || null,
        city: editForm.city.trim() || null,
        department: editForm.department.trim() || null,
        postal_code: editForm.postal_code.trim() || null,
        shipping_notes: editForm.shipping_notes.trim() || null,
        industries: editForm.industries,
        bio: editForm.bio.trim() || null,
        portfolio_url: editForm.portfolio_url.trim() || null,
        source: editForm.source || null,
        default_rate: editForm.default_rate === '' ? null : parseFloat(editForm.default_rate),
        stage_id: editForm.stage_id ? parseInt(editForm.stage_id) : null,
      };
      await ugcAPI.updateCreator(id, payload);
      setShowEditModal(false);
      await loadData();
    } catch (error) {
      console.error('Error updating creator:', error);
      setEditError(error.response?.data?.error || error.message || 'No se pudo guardar el perfil');
    } finally {
      setSavingProfile(false);
    }
  };

  // ---- Delete creator
  const handleDeleteCreator = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await ugcAPI.deleteCreator(id);
      navigate('/app/ugc', { state: { notice: `Se eliminó a ${creator.full_name} y todos sus vínculos.` } });
    } catch (error) {
      console.error('Error deleting creator:', error);
      setDeleteError(error.response?.data?.error || error.message || 'No se pudo eliminar el creador');
      setDeleting(false);
    }
  };

  const formatCurrency = (value) => {
    if (!value) return '$0';
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Creador no encontrado</p>
        <button onClick={goBack} className="mt-4 text-sm text-blue-600 hover:underline">
          Volver al CRM
        </button>
      </div>
    );
  }

  const socialNetworks = creator.social_networks || {};
  const currentStage = stages.find(s => s.id === creator.stage_id);

  // Calculate totals
  const totalAgreed = assignments.reduce((sum, a) => sum + (a.agreed_value || 0), 0);
  const totalPaid = payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + (p.amount || 0), 0);
  const pendingAmount = totalAgreed - totalPaid;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-6">
        <button
          onClick={goBack}
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          title="Volver"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1 min-w-[180px]">
          <h1 className="text-2xl font-semibold text-[#17181A]">{creator.full_name}</h1>
          <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-2">
            {creator.city && <><MapPin className="w-3.5 h-3.5" /> {creator.city}, {creator.department}</>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Stage Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Estado:</span>
            <select
              value={creator.stage_id || ''}
              onChange={(e) => handleStageChange(parseInt(e.target.value))}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D7F653]"
              style={{ borderLeftColor: currentStage?.color, borderLeftWidth: '3px' }}
            >
              {stages.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={openEditModal}
            className="flex items-center gap-2 px-3.5 py-2 bg-[#17181A] text-white rounded-xl text-sm font-medium hover:bg-[#26282C] transition-colors"
          >
            <Edit3 className="w-4 h-4" /> Editar perfil
          </button>

          {canDelete && (
            <button
              onClick={() => { setDeleteError(null); setShowDeleteModal(true); }}
              className="flex items-center gap-2 px-3.5 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors"
              title="Eliminar creador"
            >
              <Trash2 className="w-4 h-4" /> Eliminar
            </button>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">Asignaciones</p>
          <p className="text-2xl font-bold text-[#17181A]">{assignments.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">Total Acordado</p>
          <p className="text-2xl font-bold text-[#17181A]">{formatCurrency(totalAgreed)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">Total Pagado</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">Pendiente</p>
          <p className={`text-2xl font-bold ${pendingAmount > 0 ? 'text-orange-500' : 'text-gray-400'}`}>
            {formatCurrency(pendingAmount)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {[
          { id: 'info', label: 'Información', icon: User },
          { id: 'assignments', label: 'Asignaciones', icon: Package },
          { id: 'payments', label: 'Pagos', icon: DollarSign },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-[#17181A] text-[#17181A]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Contact Info */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-[#17181A] mb-4">Contacto</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-gray-400" />
                <span className="text-sm">{creator.phone || '-'}</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-gray-400" />
                <span className="text-sm">{creator.email || '-'}</span>
              </div>
              <div className="flex items-center gap-3">
                <CreditCard className="w-4 h-4 text-gray-400" />
                <span className="text-sm">{creator.cedula || '-'}</span>
              </div>
            </div>
          </div>

          {/* Social Networks */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-[#17181A] mb-4">Redes Sociales</h3>
            <div className="space-y-3">
              {socialNetworks.instagram && (
                <a
                  href={`https://instagram.com/${socialNetworks.instagram.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-sm text-pink-600 hover:underline"
                >
                  <Instagram className="w-4 h-4" /> {socialNetworks.instagram}
                </a>
              )}
              {socialNetworks.tiktok && (
                <a
                  href={`https://tiktok.com/@${socialNetworks.tiktok.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-sm text-gray-800 hover:underline"
                >
                  <Video className="w-4 h-4" /> {socialNetworks.tiktok}
                </a>
              )}
              {socialNetworks.other && (
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Link2 className="w-4 h-4" /> {socialNetworks.other}
                </div>
              )}
            </div>
          </div>

          {/* Shipping Label */}
          <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-5 relative">
            <div className="absolute -top-3 left-4 bg-white px-2">
              <span className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">Etiqueta de Envío</span>
            </div>

            {/* Label content - looks like a real shipping label */}
            <div className="space-y-3 font-mono">
              {/* Recipient name - bold and prominent */}
              <div className="border-b border-gray-200 pb-2">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Destinatario</p>
                <p className="text-base font-bold text-[#17181A] uppercase">{creator.full_name || '-'}</p>
              </div>

              {/* Address block */}
              <div className="space-y-1">
                <p className="text-sm text-[#17181A] font-medium">{creator.address || '-'}</p>
                {creator.shipping_notes && (
                  <p className="text-sm text-[#17181A]">{creator.shipping_notes}</p>
                )}
                <p className="text-sm text-[#17181A] font-semibold">
                  {creator.city}{creator.department ? `, ${creator.department}` : ''} {creator.postal_code || ''}
                </p>
              </div>

              {/* Contact info row */}
              <div className="border-t border-gray-200 pt-2 grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase">Teléfono</p>
                  <p className="text-sm font-medium text-[#17181A]">{creator.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase">Cédula</p>
                  <p className="text-sm font-medium text-[#17181A]">{creator.cedula || '-'}</p>
                </div>
              </div>
            </div>

            {/* Copy button */}
            <button
              onClick={() => {
                const labelText = `${creator.full_name}\n${creator.address || ''}${creator.shipping_notes ? '\n' + creator.shipping_notes : ''}\n${creator.city}, ${creator.department} ${creator.postal_code || ''}\nTel: ${creator.phone || '-'}\nCC: ${creator.cedula || '-'}`;
                navigator.clipboard.writeText(labelText);
              }}
              className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Copiar etiqueta"
            >
              <FileText className="w-4 h-4" />
            </button>
          </div>

          {/* Custom lists */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[#17181A]">Listas</h3>
              <ListTagButton listIds={creator.list_ids} onOpen={(rect) => setListPicker(rect)} className="p-1.5 hover:bg-gray-100" />
            </div>
            {creator.list_ids?.length > 0 ? (
              <ListChips lists={lists} listIds={creator.list_ids} max={20} size="sm" />
            ) : (
              <p className="text-xs text-gray-400">No está en ninguna lista. Usa el marcador para agregarlo a una.</p>
            )}
            {listPicker && (
              <CreatorListPicker
                anchorRect={listPicker}
                lists={lists}
                listIds={creator.list_ids || []}
                onToggle={async (listId, checked) => {
                  const res = checked ? await ugcAPI.addCreatorToList(listId, creator.id) : await ugcAPI.removeCreatorFromList(listId, creator.id);
                  setCreator(prev => ({ ...prev, list_ids: res.data.list_ids }));
                  setLists(prev => prev.map(l => l.id === listId ? { ...l, member_count: (l.member_count || 0) + (checked ? 1 : -1) } : l));
                }}
                onCreate={async (name) => {
                  try { const res = await ugcAPI.createList({ name, color: '#3B82F6' }); setLists(prev => [...prev, res.data]); return res.data; }
                  catch (err) { console.error(err); return null; }
                }}
                onClose={() => setListPicker(null)}
              />
            )}
          </div>

          {/* Industries & Bio */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-[#17181A] mb-4">Perfil</h3>
            {creator.industries?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {creator.industries.map((ind, i) => (
                  <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                    {ind}
                  </span>
                ))}
              </div>
            )}
            {creator.bio && <p className="text-sm text-gray-600">{creator.bio}</p>}
            <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400">
              <p>Fuente: {creator.source || '-'}</p>
              <p>Registrado: {formatDate(creator.created_at)}</p>
            </div>
          </div>

          {/* Características físicas */}
          {creator.traits && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-semibold text-[#17181A] mb-4 flex items-center gap-2">
                <Palette className="w-4 h-4 text-gray-400" /> Características
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {creator.traits.gender && (
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-gray-600">
                      {creator.traits.gender === 'male' ? 'Masculino' :
                       creator.traits.gender === 'female' ? 'Femenino' :
                       creator.traits.gender === 'non_binary' ? 'No binario' : creator.traits.gender}
                    </span>
                  </div>
                )}
                {creator.traits.hair_color && (
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-gray-600">Cabello: {creator.traits.hair_color}</span>
                  </div>
                )}
                {creator.traits.eye_color && (
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-gray-600">Ojos: {creator.traits.eye_color}</span>
                  </div>
                )}
                {creator.traits.body_type && (
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-gray-600">
                      {creator.traits.body_type === 'slim' ? 'Delgado/a' :
                       creator.traits.body_type === 'athletic' ? 'Atlético/a' :
                       creator.traits.body_type === 'average' ? 'Promedio' :
                       creator.traits.body_type === 'curvy' ? 'Curvy' :
                       creator.traits.body_type === 'plus_size' ? 'Plus size' : creator.traits.body_type}
                    </span>
                  </div>
                )}
              </div>
              {/* Lifestyle badges */}
              <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100">
                {creator.traits.is_parent && (
                  <span className="flex items-center gap-1 text-xs bg-pink-50 text-pink-600 px-2 py-1 rounded-full">
                    <Baby className="w-3 h-3" /> Es papá/mamá
                  </span>
                )}
                {creator.traits.has_pets && (
                  <span className="flex items-center gap-1 text-xs bg-amber-50 text-amber-600 px-2 py-1 rounded-full">
                    <PawPrint className="w-3 h-3" /> Tiene mascotas
                  </span>
                )}
                {creator.traits.is_fitness && (
                  <span className="flex items-center gap-1 text-xs bg-green-50 text-green-600 px-2 py-1 rounded-full">
                    <Dumbbell className="w-3 h-3" /> Fitness
                  </span>
                )}
              </div>
              {/* Hobbies */}
              {creator.traits.hobbies && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-1">Hobbies</p>
                  <p className="text-sm text-gray-600">{creator.traits.hobbies}</p>
                </div>
              )}
            </div>
          )}

          {/* Trabajo y Portfolio */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-[#17181A] mb-4 flex items-center gap-2">
              <Camera className="w-4 h-4 text-gray-400" /> Trabajo
            </h3>

            {/* Tarifa */}
            {(creator.default_rate || creator.rate_per_video) ? (
              <div className="bg-green-50 rounded-lg p-3 mb-4">
                <p className="text-xs text-green-600 mb-0.5">Tarifa base por video</p>
                <p className="text-lg font-bold text-green-700">{formatCurrency(creator.default_rate || creator.rate_per_video)}</p>
                {creator.rate_per_video && creator.default_rate && Number(creator.rate_per_video) !== Number(creator.default_rate) && (
                  <p className="text-[11px] text-green-600/70 mt-0.5">Declarada en registro: {formatCurrency(creator.rate_per_video)}</p>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-xs text-gray-400 mb-0.5">Tarifa base por video</p>
                <p className="text-sm text-gray-500">Sin definir · <button type="button" onClick={openEditModal} className="underline hover:text-[#17181A]">agregar</button></p>
              </div>
            )}

            {/* Idiomas */}
            {creator.languages?.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                  <Globe2 className="w-3 h-3" /> Idiomas
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {creator.languages.map((lang, i) => (
                    <span key={i} className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full">
                      {lang === 'es' ? 'Español' : lang === 'en' ? 'Inglés' : lang === 'pt' ? 'Portugués' : lang}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Equipo */}
            {creator.equipment?.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                  <Wrench className="w-3 h-3" /> Equipo
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {creator.equipment.map((eq, i) => (
                    <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                      {eq === 'smartphone' ? 'Smartphone' :
                       eq === 'ring_light' ? 'Aro de luz' :
                       eq === 'microphone' ? 'Micrófono' :
                       eq === 'tripod' ? 'Trípode' :
                       eq === 'professional_camera' ? 'Cámara profesional' :
                       eq === 'editing_software' ? 'Software de edición' : eq}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Portfolio videos */}
            {creator.portfolio && (creator.portfolio.video1 || creator.portfolio.video2) && (
              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                  <Play className="w-3 h-3" /> Portfolio
                </p>
                <div className="space-y-2">
                  {creator.portfolio.video1 && (
                    <a
                      href={creator.portfolio.video1}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-blue-600 hover:underline truncate"
                    >
                      <Video className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{creator.portfolio.video1}</span>
                    </a>
                  )}
                  {creator.portfolio.video2 && (
                    <a
                      href={creator.portfolio.video2}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-blue-600 hover:underline truncate"
                    >
                      <Video className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{creator.portfolio.video2}</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Disponibilidad */}
          {creator.availability && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-semibold text-[#17181A] mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" /> Disponibilidad
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {creator.availability.videos_per_week && (
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-[#17181A]">{creator.availability.videos_per_week}</p>
                    <p className="text-xs text-gray-500">videos/semana</p>
                  </div>
                )}
                {creator.availability.delivery_time && (
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-[#17181A]">{creator.availability.delivery_time}</p>
                    <p className="text-xs text-gray-500">días de entrega</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notas Internas - full width */}
          <div className="md:col-span-2 bg-amber-50/50 rounded-xl border border-amber-200 p-5">
            <h3 className="font-semibold text-[#17181A] mb-4 flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-amber-500" />
              Notas Internas
              <span className="text-xs font-normal text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full ml-auto">
                Solo visible para el equipo
              </span>
            </h3>

            {/* New note form */}
            <form onSubmit={handleCreateNote} className="mb-4">
              <div className="flex gap-2 mb-2">
                <select
                  value={newNoteProjectId}
                  onChange={(e) => setNewNoteProjectId(e.target.value)}
                  className="px-3 py-2 text-sm border border-amber-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
                >
                  <option value="">Sin proyecto</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="Ej: Tiene carro eléctrico, ideal para campaña..."
                  className="flex-1 px-4 py-2.5 border border-amber-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
                <button
                  type="submit"
                  disabled={savingNote || !newNoteContent.trim()}
                  className="px-4 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </form>

            {/* Notes list */}
            {notes.length === 0 ? (
              <div className="text-center py-6 text-amber-600/60">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Sin notas internas todavía</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notes.map(note => (
                  <div key={note.id} className="bg-white rounded-lg p-3 border border-amber-100 group">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        {note.project_title && (
                          <span className="inline-block text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full mb-1">
                            {note.project_title}
                          </span>
                        )}
                        <p className="text-sm text-gray-700">{note.content}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {note.created_by_name || 'Usuario'} • {formatDate(note.created_at)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="Eliminar nota"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'assignments' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowAssignmentModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#17181A] text-white rounded-xl text-sm font-medium hover:bg-[#26282C] transition-colors"
            >
              <Plus className="w-4 h-4" /> Nueva Asignación
            </button>
          </div>

          {assignments.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Sin asignaciones todavía</p>
            </div>
          ) : (
            <div className="space-y-3">
              {assignments.map(assignment => (
                <div key={assignment.id} className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-[#17181A]">{assignment.title}</h4>
                      <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
                        <Building2 className="w-3.5 h-3.5" /> {assignment.client_name || 'Sin cliente'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={assignment.status}
                        onChange={(e) => updateAssignmentStatus(assignment.id, e.target.value)}
                        className={`text-xs font-medium px-2 py-1 rounded-full border-0 ${ASSIGNMENT_STATUS[assignment.status]?.color}`}
                      >
                        {Object.entries(ASSIGNMENT_STATUS).map(([key, val]) => (
                          <option key={key} value={key}>{val.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {assignment.description && (
                    <p className="text-sm text-gray-600 mb-3">{assignment.description}</p>
                  )}

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4 text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(assignment.start_date)} - {formatDate(assignment.end_date)}
                      </span>
                    </div>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(assignment.agreed_value)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'payments' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowPaymentModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#17181A] text-white rounded-xl text-sm font-medium hover:bg-[#26282C] transition-colors"
            >
              <Plus className="w-4 h-4" /> Registrar Pago
            </button>
          </div>

          {payments.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Sin pagos registrados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map(payment => {
                const StatusIcon = PAYMENT_STATUS[payment.status]?.icon || Clock;
                return (
                  <div key={payment.id} className="bg-white rounded-xl border border-gray-100 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${PAYMENT_STATUS[payment.status]?.color}`}>
                          <StatusIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-[#17181A]">{formatCurrency(payment.amount)}</p>
                          <p className="text-xs text-gray-500">
                            {formatDate(payment.payment_date)} • {payment.payment_method || 'Sin método'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {payment.reference_number && (
                          <p className="text-xs text-gray-400">Ref: {payment.reference_number}</p>
                        )}
                        {payment.assignment_title && (
                          <p className="text-xs text-gray-500">{payment.assignment_title}</p>
                        )}
                      </div>
                    </div>
                    {payment.notes && (
                      <p className="text-sm text-gray-600 mt-2 pt-2 border-t border-gray-100">{payment.notes}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Assignment Modal */}
      {showAssignmentModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAssignmentModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-[#17181A]">Nueva Asignación</h2>
              <button onClick={() => setShowAssignmentModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleCreateAssignment} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Cliente *</label>
                <select
                  value={assignmentForm.client_id}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, client_id: e.target.value, project_id: '' })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D7F653]"
                  required
                >
                  <option value="">Seleccionar cliente...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.nickname || c.company || c.name}</option>
                  ))}
                </select>
              </div>

              {assignmentForm.client_id && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Proyecto UGC (opcional)</label>
                  <select
                    value={assignmentForm.project_id}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, project_id: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D7F653]"
                  >
                    <option value="">Sin proyecto específico</option>
                    {projects
                      .filter(p => p.client_id === parseInt(assignmentForm.client_id))
                      .map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                  </select>
                  {projects.filter(p => p.client_id === parseInt(assignmentForm.client_id)).length === 0 && (
                    <p className="text-xs text-gray-400 mt-1">No hay proyectos UGC para este cliente</p>
                  )}
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Título *</label>
                <input
                  type="text"
                  value={assignmentForm.title}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
                  placeholder="Ej: 3 Reels para lanzamiento"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D7F653]"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Descripción</label>
                <textarea
                  value={assignmentForm.description}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D7F653] resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Fecha inicio</label>
                  <input
                    type="date"
                    value={assignmentForm.start_date}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, start_date: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D7F653]"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Fecha fin</label>
                  <input
                    type="date"
                    value={assignmentForm.end_date}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, end_date: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D7F653]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Valor acordado (COP)</label>
                  <input
                    type="number"
                    value={assignmentForm.agreed_value}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, agreed_value: e.target.value })}
                    placeholder="0"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D7F653]"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Estado</label>
                  <select
                    value={assignmentForm.status}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, status: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D7F653]"
                  >
                    {Object.entries(ASSIGNMENT_STATUS).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssignmentModal(false)}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2.5 bg-[#17181A] text-white rounded-xl text-sm font-medium hover:bg-[#26282C] transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crear Asignación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowPaymentModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-[#17181A]">Registrar Pago</h2>
              <button onClick={() => setShowPaymentModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleCreatePayment} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Asignación (opcional)</label>
                <select
                  value={paymentForm.assignment_id}
                  onChange={(e) => setPaymentForm({ ...paymentForm, assignment_id: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D7F653]"
                >
                  <option value="">Sin asignación específica</option>
                  {assignments.map(a => (
                    <option key={a.id} value={a.id}>{a.title} - {formatCurrency(a.agreed_value)}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Monto (COP) *</label>
                  <input
                    type="number"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    placeholder="0"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D7F653]"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Fecha *</label>
                  <input
                    type="date"
                    value={paymentForm.payment_date}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D7F653]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Método de pago</label>
                  <select
                    value={paymentForm.payment_method}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D7F653]"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="nequi">Nequi</option>
                    <option value="daviplata">Daviplata</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Referencia</label>
                  <input
                    type="text"
                    value={paymentForm.reference_number}
                    onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })}
                    placeholder="# de transacción"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D7F653]"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Notas</label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D7F653] resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2.5 bg-[#17181A] text-white rounded-xl text-sm font-medium hover:bg-[#26282C] transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registrar Pago'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditModal && (() => {
        const editCities = editForm.department ? getCitiesByDepartment(editForm.department) : [];
        const departmentInCatalog = !editForm.department || departments.includes(editForm.department);
        const cityInCatalog = !editForm.city || editCities.includes(editForm.city);
        const extraIndustries = editForm.industries.filter(i => !industriesCatalog.some(c => c.slug === i));
        return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !savingProfile && setShowEditModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <h2 className="text-lg font-semibold text-[#17181A]">Editar perfil</h2>
                <p className="text-xs text-gray-500 mt-0.5">Actualiza los datos que el creador haya cambiado.</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-gray-100 rounded-lg" disabled={savingProfile}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="p-6 space-y-5">
              {/* Datos básicos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Nombre completo *</label>
                  <input type="text" value={editForm.full_name} onChange={(e) => setEditField('full_name', e.target.value)} className={INPUT_CLASS} required />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">WhatsApp / Teléfono *</label>
                  <input type="tel" value={editForm.phone} onChange={(e) => setEditField('phone', e.target.value)} placeholder="+57 300 123 4567" className={INPUT_CLASS} required />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Email</label>
                  <input type="email" value={editForm.email} onChange={(e) => setEditField('email', e.target.value)} className={INPUT_CLASS} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Cédula</label>
                  <input type="text" value={editForm.cedula} onChange={(e) => setEditField('cedula', e.target.value)} className={INPUT_CLASS} />
                </div>
              </div>

              {/* Redes */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Redes sociales</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="relative">
                    <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pink-500" />
                    <input type="text" value={editForm.social_networks.instagram}
                      onChange={(e) => setEditField('social_networks', { ...editForm.social_networks, instagram: e.target.value })}
                      placeholder="@usuario o URL" className={`${INPUT_CLASS} pl-10`} />
                  </div>
                  <div className="relative">
                    <Video className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-800" />
                    <input type="text" value={editForm.social_networks.tiktok}
                      onChange={(e) => setEditField('social_networks', { ...editForm.social_networks, tiktok: e.target.value })}
                      placeholder="@usuario o URL" className={`${INPUT_CLASS} pl-10`} />
                  </div>
                  <div className="relative">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" value={editForm.social_networks.other}
                      onChange={(e) => setEditField('social_networks', { ...editForm.social_networks, other: e.target.value })}
                      placeholder="Otro link" className={`${INPUT_CLASS} pl-10`} />
                  </div>
                </div>
              </div>

              {/* Dirección de envío */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Dirección de envío</label>
                <div className="space-y-3">
                  <input type="text" value={editForm.address} onChange={(e) => setEditField('address', e.target.value)} placeholder="Calle 123 # 45-67, Apto 801" className={INPUT_CLASS} />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <select
                      value={editForm.department}
                      onChange={(e) => setEditForm(prev => ({ ...prev, department: e.target.value, city: '' }))}
                      className={INPUT_CLASS}
                    >
                      <option value="">Departamento...</option>
                      {!departmentInCatalog && <option value={editForm.department}>{editForm.department}</option>}
                      {departments.map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                    <select
                      value={editForm.city}
                      onChange={(e) => setEditField('city', e.target.value)}
                      disabled={!editForm.department}
                      className={INPUT_CLASS}
                    >
                      <option value="">{editForm.department ? 'Ciudad...' : 'Elige departamento'}</option>
                      {!cityInCatalog && <option value={editForm.city}>{editForm.city}</option>}
                      {editCities.map((city) => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                    <input type="text" value={editForm.postal_code} onChange={(e) => setEditField('postal_code', e.target.value)} placeholder="Código postal" className={INPUT_CLASS} />
                  </div>
                  <input type="text" value={editForm.shipping_notes} onChange={(e) => setEditField('shipping_notes', e.target.value)} placeholder="Notas de envío (conjunto, torre, horario, referencias...)" className={INPUT_CLASS} />
                </div>
              </div>

              {/* Industrias */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Industrias de interés</label>
                <div className="flex flex-wrap gap-2">
                  {industriesCatalog.map((industry) => (
                    <button
                      key={industry.id}
                      type="button"
                      onClick={() => toggleEditIndustry(industry.slug)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        editForm.industries.includes(industry.slug)
                          ? 'bg-[#17181A] text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {industry.icon} {industry.name}
                    </button>
                  ))}
                  {extraIndustries.map((slug) => (
                    <button
                      key={slug}
                      type="button"
                      onClick={() => toggleEditIndustry(slug)}
                      title="Valor fuera del catálogo actual. Click para quitarlo."
                      className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#17181A] text-white"
                    >
                      {slug}
                    </button>
                  ))}
                  {industriesCatalog.length === 0 && extraIndustries.length === 0 && (
                    <span className="text-xs text-gray-400">No hay industrias en el catálogo.</span>
                  )}
                </div>
              </div>

              {/* Bio y portafolio */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Bio</label>
                <textarea value={editForm.bio} onChange={(e) => setEditField('bio', e.target.value)} rows={3} placeholder="Experiencia, estilo de contenido, etc." className={`${INPUT_CLASS} resize-none`} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Portafolio (URL)</label>
                <input type="url" value={editForm.portfolio_url} onChange={(e) => setEditField('portfolio_url', e.target.value)} placeholder="https://..." className={INPUT_CLASS} />
              </div>

              {/* Comercial */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Tarifa base (COP)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="number" min="0" step="1000" value={editForm.default_rate}
                      onChange={(e) => setEditField('default_rate', e.target.value)}
                      placeholder="Por video" className={`${INPUT_CLASS} pl-9`} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Fuente</label>
                  <select value={editForm.source} onChange={(e) => setEditField('source', e.target.value)} className={INPUT_CLASS}>
                    <option value="">Sin fuente</option>
                    {editForm.source && !SOURCE_OPTIONS.some(o => o.value === editForm.source) && (
                      <option value={editForm.source}>{editForm.source}</option>
                    )}
                    {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Etapa</label>
                  <select value={editForm.stage_id} onChange={(e) => setEditField('stage_id', e.target.value)} className={INPUT_CLASS}>
                    <option value="">Sin etapa</option>
                    {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              {editError && (
                <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  disabled={savingProfile}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-4 py-2.5 bg-[#17181A] text-white rounded-xl text-sm font-medium hover:bg-[#26282C] transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
        );
      })()}

      {/* Delete Creator Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !deleting && setShowDeleteModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-[#17181A]">Eliminar a {creator.full_name}</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Esta acción no se puede deshacer. Se borrará el perfil completo del creador y, con él:
                  </p>
                  <ul className="mt-3 space-y-1.5 text-sm text-gray-600">
                    <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" /> Su participación en proyectos UGC (incluidos contratos firmados y el historial de estados)</li>
                    <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" /> Sus asignaciones y los registros de pagos ({assignments.length} asignaciones, {payments.length} pagos)</li>
                    <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" /> Sus notas internas ({notes.length}) y su pertenencia a listas</li>
                  </ul>
                  <p className="text-xs text-gray-400 mt-3">
                    Si solo quieres sacarlo de circulación, considera moverlo a una etapa tipo "Descartado" en vez de eliminarlo.
                  </p>
                </div>
              </div>

              {deleteError && (
                <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mt-4">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeleteCreator}
                  disabled={deleting}
                  className="px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-4 h-4" /> Sí, eliminar</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
