import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Phone, Mail, Building2, DollarSign, User, Calendar,
  MessageSquare, PhoneCall, Video, FileText, Loader2, Trash2, X, Plus,
  CheckCircle2, AlertTriangle, Target, ArrowRightCircle, Sparkles,
  Send, UserCheck, Pencil, Save
} from 'lucide-react';
import { crmAPI, teamAPI } from '../utils/api';
import ProposalGenerator from '../components/ProposalGenerator';

export default function CRMDealDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [deal, setDeal] = useState(null);
  const [activities, setActivities] = useState([]);
  const [stages, setStages] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Inline editing
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [savingDeal, setSavingDeal] = useState(false);

  // Activity form
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [activityType, setActivityType] = useState('note');
  const [activityTitle, setActivityTitle] = useState('');
  const [activityContent, setActivityContent] = useState('');
  const [savingActivity, setSavingActivity] = useState(false);

  // Transcript
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcriptText, setTranscriptText] = useState('');
  const [processingTranscript, setProcessingTranscript] = useState(false);
  const [transcriptResult, setTranscriptResult] = useState(null);

  // Convert
  const [converting, setConverting] = useState(false);

  // Proposal
  const [showProposal, setShowProposal] = useState(false);

  useEffect(() => {
    loadDeal();
    loadTeam();
  }, [id]);

  const loadDeal = async () => {
    try {
      const res = await crmAPI.getDeal(id);
      setDeal(res.data);
      setActivities(res.data.activities || []);
      setStages(res.data.stages || []);
    } catch (error) {
      console.error('Error loading deal:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTeam = async () => {
    try {
      const res = await teamAPI.getAll();
      setTeamMembers(res.data || []);
    } catch { /* ignore */ }
  };

  const startEditing = () => {
    setEditForm({
      name: deal.name || '',
      client_name: deal.client_name || '',
      email: deal.email || '',
      phone: deal.phone || '',
      company: deal.company || '',
      source: deal.source || '',
      estimated_value: deal.estimated_value || 0,
      notes: deal.notes || '',
      assigned_to: deal.assigned_to || '',
    });
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditForm({});
  };

  const saveDeal = async () => {
    setSavingDeal(true);
    try {
      await crmAPI.updateDeal(id, {
        ...editForm,
        estimated_value: parseFloat(editForm.estimated_value) || 0,
        assigned_to: editForm.assigned_to || null,
      });
      setEditing(false);
      loadDeal();
    } catch (error) {
      console.error('Error saving deal:', error);
    } finally {
      setSavingDeal(false);
    }
  };

  const handleMoveStage = async (stageId) => {
    try {
      await crmAPI.moveDeal(id, stageId);
      loadDeal();
    } catch (error) {
      console.error('Error moving deal:', error);
    }
  };

  const handleAddActivity = async (e) => {
    e.preventDefault();
    setSavingActivity(true);
    try {
      await crmAPI.createActivity(id, {
        type: activityType,
        title: activityTitle,
        content: activityContent,
      });
      setShowActivityForm(false);
      setActivityTitle('');
      setActivityContent('');
      loadDeal();
    } catch (error) {
      console.error('Error adding activity:', error);
    } finally {
      setSavingActivity(false);
    }
  };

  const handleDeleteActivity = async (activityId) => {
    if (!confirm('¿Eliminar esta actividad?')) return;
    try {
      await crmAPI.deleteActivity(activityId);
      loadDeal();
    } catch (error) {
      console.error('Error deleting activity:', error);
    }
  };

  const handleProcessTranscript = async () => {
    if (!transcriptText.trim()) return;
    setProcessingTranscript(true);
    setTranscriptResult(null);
    try {
      const res = await crmAPI.processTranscript(id, transcriptText);
      setTranscriptResult(res.data);
      loadDeal();
    } catch (error) {
      console.error('Error processing transcript:', error);
    } finally {
      setProcessingTranscript(false);
    }
  };

  const handleConvert = async () => {
    if (!confirm('¿Convertir este deal a cliente? Se creará un nuevo cliente con los datos del deal.')) return;
    setConverting(true);
    try {
      const res = await crmAPI.convertToClient(id);
      alert(`Cliente creado exitosamente: ${res.data.client.name}`);
      loadDeal();
    } catch (error) {
      console.error('Error converting:', error);
      alert(error.response?.data?.error || 'Error convirtiendo deal');
    } finally {
      setConverting(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const activityIcons = {
    note: <MessageSquare className="w-4 h-4" />,
    call: <PhoneCall className="w-4 h-4" />,
    email: <Mail className="w-4 h-4" />,
    meeting: <Video className="w-4 h-4" />,
    transcript: <FileText className="w-4 h-4" />,
    stage_change: <ArrowRightCircle className="w-4 h-4" />,
    proposal_sent: <Send className="w-4 h-4" />,
  };

  const activityColors = {
    note: 'bg-gray-100 text-gray-600',
    call: 'bg-blue-100 text-blue-600',
    email: 'bg-purple-100 text-purple-600',
    meeting: 'bg-amber-100 text-amber-600',
    transcript: 'bg-green-100 text-green-600',
    stage_change: 'bg-indigo-100 text-indigo-600',
    proposal_sent: 'bg-pink-100 text-pink-600',
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Deal no encontrado</p>
        <button onClick={() => navigate('/app/crm')} className="text-[#1A1A2E] underline mt-2">
          Volver al CRM
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/app/crm')}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-[#1A1A2E] tracking-tight">{deal.name}</h1>
            {deal.company && <p className="text-sm text-gray-500">{deal.company}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowTranscript(true)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition-colors"
          >
            <FileText className="w-4 h-4" /> Agregar Transcript
          </button>
          <button
            onClick={() => setShowProposal(true)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition-colors"
          >
            <Sparkles className="w-4 h-4" /> Generar Propuesta
          </button>
          {!deal.converted_client_id && (
            <button
              onClick={handleConvert}
              disabled={converting}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {converting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
              Convertir a Cliente
            </button>
          )}
          {deal.converted_client_id && (
            <span className="flex items-center gap-1 px-3 py-2 bg-green-50 text-green-700 rounded-xl text-sm font-medium">
              <CheckCircle2 className="w-4 h-4" /> Convertido
            </span>
          )}
        </div>
      </div>

      {/* Pipeline Indicator */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {stages.map((stage) => {
            const isCurrent = deal.stage_id === stage.id;
            const isPast = stage.position < (stages.find(s => s.id === deal.stage_id)?.position || 0);
            return (
              <button
                key={stage.id}
                onClick={() => handleMoveStage(stage.id)}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                  isCurrent
                    ? 'text-white shadow-md'
                    : isPast
                    ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                }`}
                style={isCurrent ? { backgroundColor: stage.color } : {}}
              >
                {stage.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content: 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Contact Info + Value + Transcript Data */}
        <div className="lg:col-span-1 space-y-4">
          {/* Edit / View toggle */}
          {!editing ? (
            <>
              {/* Contact Card (read-only) */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#1A1A2E] uppercase tracking-wider">Contacto</h3>
                  <button onClick={startEditing} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="Editar">
                    <Pencil className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                {deal.client_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-gray-400" /> <span>{deal.client_name}</span>
                  </div>
                )}
                {deal.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <a href={`mailto:${deal.email}`} className="text-blue-600 hover:underline">{deal.email}</a>
                  </div>
                )}
                {deal.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <a href={`tel:${deal.phone}`} className="text-blue-600 hover:underline">{deal.phone}</a>
                  </div>
                )}
                {deal.company && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="w-4 h-4 text-gray-400" /> <span>{deal.company}</span>
                  </div>
                )}
                {!deal.client_name && !deal.email && !deal.phone && !deal.company && (
                  <p className="text-sm text-gray-400 italic">Sin datos de contacto</p>
                )}
              </div>

              {/* Value Card (read-only) */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="text-sm font-semibold text-[#1A1A2E] uppercase tracking-wider mb-3">Valor</h3>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(deal.estimated_value)}</p>
                {deal.source && (
                  <p className="text-xs text-gray-500 mt-2">Fuente: <span className="font-medium">{deal.source}</span></p>
                )}
                {deal.assigned_to_name && (
                  <p className="text-xs text-gray-500 mt-1">Asignado a: <span className="font-medium">{deal.assigned_to_name}</span></p>
                )}
              </div>

              {/* Notes (read-only) */}
              {deal.notes && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                  <h3 className="text-sm font-semibold text-[#1A1A2E] uppercase tracking-wider mb-2">Notas</h3>
                  <p className="text-sm text-gray-600 whitespace-pre-line">{deal.notes}</p>
                </div>
              )}
            </>
          ) : (
            /* Edit Mode - full form */
            <div className="bg-white rounded-2xl border-2 border-[#BFFF00] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#1A1A2E] uppercase tracking-wider">Editar Deal</h3>
                <div className="flex items-center gap-1">
                  <button
                    onClick={cancelEditing}
                    className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={saveDeal}
                    disabled={savingDeal}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[#1A1A2E] text-white rounded-lg text-xs font-medium disabled:opacity-50"
                  >
                    {savingDeal ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Guardar
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Nombre del deal</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#BFFF00]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Nombre contacto</label>
                  <input
                    type="text"
                    value={editForm.client_name}
                    onChange={(e) => setEditForm({ ...editForm, client_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#BFFF00]"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Empresa</label>
                  <input
                    type="text"
                    value={editForm.company}
                    onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#BFFF00]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#BFFF00]"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Teléfono</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#BFFF00]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Valor estimado (COP)</label>
                  <input
                    type="number"
                    value={editForm.estimated_value}
                    onChange={(e) => setEditForm({ ...editForm, estimated_value: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#BFFF00]"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Fuente</label>
                  <select
                    value={editForm.source}
                    onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#BFFF00]"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="referido">Referido</option>
                    <option value="instagram">Instagram</option>
                    <option value="web">Sitio web</option>
                    <option value="cold_outreach">Cold outreach</option>
                    <option value="evento">Evento</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Asignar a</label>
                <select
                  value={editForm.assigned_to}
                  onChange={(e) => setEditForm({ ...editForm, assigned_to: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#BFFF00]"
                >
                  <option value="">Sin asignar</option>
                  {teamMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Notas</label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#BFFF00] resize-none"
                />
              </div>
            </div>
          )}

          {/* Transcript Extractions */}
          {activities.filter(a => a.type === 'transcript' && a.metadata).map((a) => {
            let meta;
            try { meta = typeof a.metadata === 'string' ? JSON.parse(a.metadata) : a.metadata; } catch { return null; }
            return (
              <div key={a.id} className="bg-green-50 rounded-2xl border border-green-200 p-5 space-y-3">
                <h3 className="text-sm font-semibold text-green-800 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> Datos extraídos
                </h3>
                {meta.pain_points?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-1">Pain Points:</p>
                    <ul className="text-sm text-gray-700 space-y-0.5">
                      {meta.pain_points.map((p, i) => <li key={i}>• {p}</li>)}
                    </ul>
                  </div>
                )}
                {meta.services_interested?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-1">Servicios de interés:</p>
                    <ul className="text-sm text-gray-700 space-y-0.5">
                      {meta.services_interested.map((s, i) => <li key={i}>• {s}</li>)}
                    </ul>
                  </div>
                )}
                {meta.budget_signals && (
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-1">Presupuesto:</p>
                    <p className="text-sm text-gray-700">{meta.budget_signals}</p>
                  </div>
                )}
                {meta.urgency && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-600">Urgencia:</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      meta.urgency === 'alta' ? 'bg-red-100 text-red-700' :
                      meta.urgency === 'media' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {meta.urgency}
                    </span>
                  </div>
                )}
                {meta.next_steps?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-1">Próximos pasos:</p>
                    <ul className="text-sm text-gray-700 space-y-0.5">
                      {meta.next_steps.map((n, i) => <li key={i}>• {n}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right Column: Activity Timeline */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#1A1A2E] uppercase tracking-wider">Actividades</h3>
              <button
                onClick={() => setShowActivityForm(!showActivityForm)}
                className="flex items-center gap-1 text-sm text-[#1A1A2E] font-medium hover:underline"
              >
                <Plus className="w-4 h-4" /> Agregar
              </button>
            </div>

            {/* Add Activity Form */}
            {showActivityForm && (
              <form onSubmit={handleAddActivity} className="mb-5 p-4 bg-gray-50 rounded-xl space-y-3">
                <div className="flex gap-2">
                  {[
                    { value: 'note', label: 'Nota', icon: <MessageSquare className="w-3.5 h-3.5" /> },
                    { value: 'call', label: 'Llamada', icon: <PhoneCall className="w-3.5 h-3.5" /> },
                    { value: 'email', label: 'Email', icon: <Mail className="w-3.5 h-3.5" /> },
                    { value: 'meeting', label: 'Reunión', icon: <Video className="w-3.5 h-3.5" /> },
                  ].map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setActivityType(t.value)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        activityType === t.value
                          ? 'bg-[#1A1A2E] text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={activityTitle}
                  onChange={(e) => setActivityTitle(e.target.value)}
                  placeholder="Título (opcional)"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#BFFF00]"
                />
                <textarea
                  value={activityContent}
                  onChange={(e) => setActivityContent(e.target.value)}
                  placeholder="Detalles..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#BFFF00] resize-none"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowActivityForm(false)}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingActivity}
                    className="px-4 py-1.5 bg-[#1A1A2E] text-white rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    {savingActivity ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
                  </button>
                </div>
              </form>
            )}

            {/* Activity Timeline */}
            <div className="space-y-0">
              {activities.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">Sin actividades aún</p>
              ) : (
                activities.map((activity, idx) => (
                  <div key={activity.id} className="flex gap-3 group">
                    {/* Timeline dot & line */}
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${activityColors[activity.type] || 'bg-gray-100 text-gray-500'}`}>
                        {activityIcons[activity.type] || <Target className="w-4 h-4" />}
                      </div>
                      {idx < activities.length - 1 && (
                        <div className="w-px flex-1 bg-gray-200 my-1" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-5">
                      <div className="flex items-start justify-between">
                        <div>
                          {activity.title && (
                            <p className="text-sm font-medium text-[#1A1A2E]">{activity.title}</p>
                          )}
                          {activity.content && (
                            <p className="text-sm text-gray-600 mt-0.5 whitespace-pre-line">{activity.content}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            {activity.created_by_name && `${activity.created_by_name} • `}
                            {formatDate(activity.created_at)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteActivity(activity.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Transcript Modal */}
      {showTranscript && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowTranscript(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-[#1A1A2E]">Agregar Transcripción</h2>
              <button onClick={() => { setShowTranscript(false); setTranscriptResult(null); }} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-500">
                Pega el texto de la transcripción (ej: de Tactiq, Otter, etc.) y Claude extraerá los datos clave.
              </p>
              <textarea
                value={transcriptText}
                onChange={(e) => setTranscriptText(e.target.value)}
                placeholder="Pegar transcripción aquí..."
                rows={10}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#BFFF00] resize-none"
              />

              {transcriptResult && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-green-800 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Datos extraídos exitosamente
                  </h4>
                  <p className="text-sm text-gray-700"><strong>Resumen:</strong> {transcriptResult.summary}</p>
                  {transcriptResult.pain_points?.length > 0 && (
                    <p className="text-sm text-gray-700"><strong>Pain Points:</strong> {transcriptResult.pain_points.join(', ')}</p>
                  )}
                  {transcriptResult.urgency && (
                    <p className="text-sm text-gray-700"><strong>Urgencia:</strong> {transcriptResult.urgency}</p>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setShowTranscript(false); setTranscriptResult(null); }}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50"
                >
                  Cerrar
                </button>
                <button
                  onClick={handleProcessTranscript}
                  disabled={processingTranscript || !transcriptText.trim()}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#1A1A2E] text-white rounded-xl text-sm font-medium disabled:opacity-50"
                >
                  {processingTranscript ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Procesar con IA
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Proposal Generator Modal */}
      {showProposal && (
        <ProposalGenerator
          dealId={id}
          onClose={() => setShowProposal(false)}
          onProposalSent={() => loadDeal()}
        />
      )}
    </div>
  );
}
