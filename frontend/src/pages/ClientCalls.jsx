import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { clientsAPI } from '../utils/api';
import { Phone, Plus, Edit, Trash2, X, Clock, Calendar, ArrowLeft, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const callsAPI = {
  getAll: async (clientId) => {
    const res = await fetch(`${API_URL}/client-calls/${clientId}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    return res.json();
  },
  create: async (clientId, data) => {
    const res = await fetch(`${API_URL}/client-calls/${clientId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  update: async (clientId, callId, data) => {
    const res = await fetch(`${API_URL}/client-calls/${clientId}/${callId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  delete: async (clientId, callId) => {
    const res = await fetch(`${API_URL}/client-calls/${clientId}/${callId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    return res.json();
  }
};

export default function ClientCalls() {
  const { id: clientId } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [form, setForm] = useState({
    title: '', call_date: new Date().toISOString().slice(0, 16), duration_minutes: '', summary: '', transcription: ''
  });

  useEffect(() => {
    loadData();
  }, [clientId]);

  const loadData = async () => {
    try {
      const [clientRes, callsRes] = await Promise.all([
        clientsAPI.getById(clientId),
        callsAPI.getAll(clientId)
      ]);
      setClient(clientRes);
      setCalls(Array.isArray(callsRes) ? callsRes : []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ title: '', call_date: new Date().toISOString().slice(0, 16), duration_minutes: '', summary: '', transcription: '' });
    setEditing(null);
  };

  const handleNew = () => {
    resetForm();
    setShowModal(true);
  };

  const handleEdit = (call) => {
    setForm({
      title: call.title,
      call_date: call.call_date ? new Date(call.call_date).toISOString().slice(0, 16) : '',
      duration_minutes: call.duration_minutes || '',
      summary: call.summary || '',
      transcription: call.transcription || ''
    });
    setEditing(call);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    try {
      if (editing) {
        await callsAPI.update(clientId, editing.id, form);
      } else {
        await callsAPI.create(clientId, form);
      }
      setShowModal(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving call:', error);
    }
  };

  const handleDelete = async (callId) => {
    if (!confirm('¿Eliminar esta llamada?')) return;
    try {
      await callsAPI.delete(clientId, callId);
      loadData();
    } catch (error) {
      console.error('Error deleting call:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/app/clients')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-500" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-[#1A1A2E] tracking-tight">
              Llamadas — {client?.company || client?.name}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Transcripciones y resúmenes de reuniones</p>
          </div>
        </div>
        <button
          onClick={handleNew}
          className="bg-[#1A1A2E] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-[#252542] transition-colors"
        >
          <Plus size={20} />
          Nueva Llamada
        </button>
      </div>

      {/* Calls List */}
      {calls.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Phone className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-[#1A1A2E]">Sin llamadas registradas</h2>
          <p className="text-gray-500 mt-2">Agrega la primera llamada con el botón de arriba.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {calls.map((call) => (
            <div key={call.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div
                className="flex items-center gap-4 p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedId(expandedId === call.id ? null : call.id)}
              >
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Phone className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-[#1A1A2E] truncate">{call.title}</h3>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(call.call_date).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                    {call.duration_minutes && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {call.duration_minutes} min
                      </span>
                    )}
                    {call.created_by_name && (
                      <span className="text-xs text-gray-400">por {call.created_by_name}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEdit(call); }}
                    className="p-1.5 text-gray-400 hover:text-[#1A1A2E] hover:bg-gray-100 rounded-lg"
                    title="Editar"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(call.id); }}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                    title="Eliminar"
                  >
                    <Trash2 size={16} />
                  </button>
                  {expandedId === call.id ? <ChevronUp size={18} className="text-gray-400 ml-1" /> : <ChevronDown size={18} className="text-gray-400 ml-1" />}
                </div>
              </div>

              {expandedId === call.id && (
                <div className="border-t border-gray-100 p-5 space-y-4">
                  {call.summary && (
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Resumen</h4>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{call.summary}</p>
                    </div>
                  )}
                  {call.transcription && (
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Transcripción</h4>
                      <div className="bg-gray-50 rounded-xl p-4 max-h-96 overflow-y-auto">
                        <p className="text-xs text-gray-600 whitespace-pre-wrap font-mono leading-relaxed">{call.transcription}</p>
                      </div>
                    </div>
                  )}
                  {!call.summary && !call.transcription && (
                    <p className="text-sm text-gray-400 text-center py-4">Sin resumen ni transcripción.</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-[#1A1A2E]">
                {editing ? 'Editar Llamada' : 'Nueva Llamada'}
              </h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-2 hover:bg-gray-100 rounded-xl">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#1A1A2E]/20 focus:border-[#1A1A2E]"
                  placeholder="Ej: Reunión de kickoff, Revisión mensual..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha y hora</label>
                <input
                  type="datetime-local"
                  value={form.call_date}
                  onChange={(e) => setForm({ ...form, call_date: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#1A1A2E]/20 focus:border-[#1A1A2E]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Resumen</label>
                <textarea
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                  rows={4}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#1A1A2E]/20 focus:border-[#1A1A2E] resize-none"
                  placeholder="Puntos clave de la llamada..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Transcripción</label>
                <textarea
                  value={form.transcription}
                  onChange={(e) => setForm({ ...form, transcription: e.target.value })}
                  rows={8}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#1A1A2E]/20 focus:border-[#1A1A2E] resize-none font-mono text-sm"
                  placeholder="Pega la transcripción completa aquí..."
                />
              </div>

              <button
                onClick={handleSave}
                disabled={!form.title.trim()}
                className="w-full py-2.5 bg-[#1A1A2E] text-white rounded-xl hover:bg-[#252542] font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {editing ? 'Guardar Cambios' : 'Crear Llamada'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
