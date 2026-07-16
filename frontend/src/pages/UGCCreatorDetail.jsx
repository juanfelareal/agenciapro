import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Instagram, Video, Link2, MapPin, Phone, Mail, CreditCard,
  Loader2, Plus, X, Edit3, DollarSign, Package, Calendar, CheckCircle,
  Clock, AlertCircle, User, Building2, FileText
} from 'lucide-react';
import { ugcAPI } from '../utils/api';

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
  const [creator, setCreator] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [stages, setStages] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');

  // Modals
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [saving, setSaving] = useState(false);

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
      const [creatorRes, assignmentsRes, paymentsRes, stagesRes, clientsRes, projectsRes] = await Promise.all([
        ugcAPI.getCreator(id),
        ugcAPI.getAssignments({ creator_id: id }),
        ugcAPI.getPayments({ creator_id: id }),
        ugcAPI.getStages(),
        ugcAPI.getUgcClients().catch(() => ({ data: [] })),
        ugcAPI.getProjects().catch(() => ({ data: [] })),
      ]);
      setCreator(creatorRes.data);
      setAssignments(assignmentsRes.data);
      setPayments(paymentsRes.data);
      setStages(stagesRes.data);
      setClients(clientsRes.data || []);
      setProjects(projectsRes.data || []);
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
        <button onClick={() => navigate('/app/ugc')} className="mt-4 text-sm text-blue-600 hover:underline">
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
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/app/ugc')}
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-[#17181A]">{creator.full_name}</h1>
          <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-2">
            {creator.city && <><MapPin className="w-3.5 h-3.5" /> {creator.city}, {creator.department}</>}
          </p>
        </div>

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
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
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
        <div className="grid grid-cols-2 gap-6">
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

          {/* Shipping Address */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-[#17181A] mb-4">Dirección de Envío</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>{creator.address || '-'}</p>
              <p>{creator.city}, {creator.department} {creator.postal_code}</p>
              {creator.shipping_notes && (
                <p className="text-gray-400 italic">{creator.shipping_notes}</p>
              )}
            </div>
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
    </div>
  );
}
