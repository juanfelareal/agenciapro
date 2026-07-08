import { useState, useEffect } from 'react';
import { documentTemplatesAPI, clientsAPI } from '../utils/api';
import {
  FileSignature,
  Plus,
  Edit2,
  Trash2,
  Send,
  CheckCircle2,
  Clock,
  X,
  Eye,
  Users
} from 'lucide-react';

export default function DocumentTemplates() {
  const [templates, setTemplates] = useState([]);
  const [signatures, setSignatures] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('templates');

  // Modal states
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'nda',
    content: ''
  });

  const [assignData, setAssignData] = useState({
    client_id: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [templatesRes, signaturesRes, clientsRes] = await Promise.all([
        documentTemplatesAPI.getAll(),
        documentTemplatesAPI.getAllSignatures(),
        clientsAPI.getAll()
      ]);
      setTemplates(templatesRes.data);
      setSignatures(signaturesRes.data);
      setClients(clientsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    try {
      await documentTemplatesAPI.create(formData);
      setShowTemplateModal(false);
      setFormData({ name: '', description: '', category: 'nda', content: '' });
      loadData();
    } catch (error) {
      console.error('Error creating template:', error);
    }
  };

  const handleUpdateTemplate = async (e) => {
    e.preventDefault();
    try {
      await documentTemplatesAPI.update(editingTemplate.id, formData);
      setShowTemplateModal(false);
      setEditingTemplate(null);
      setFormData({ name: '', description: '', category: 'nda', content: '' });
      loadData();
    } catch (error) {
      console.error('Error updating template:', error);
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!confirm('¿Eliminar esta plantilla?')) return;
    try {
      await documentTemplatesAPI.delete(id);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Error al eliminar');
    }
  };

  const handleAssignDocument = async (e) => {
    e.preventDefault();
    try {
      await documentTemplatesAPI.assign(selectedTemplate.id, assignData.client_id, {});
      setShowAssignModal(false);
      setSelectedTemplate(null);
      setAssignData({ client_id: '' });
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Error al asignar');
    }
  };

  const openEditModal = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      category: template.category,
      content: template.content
    });
    setShowTemplateModal(true);
  };

  const openAssignModal = (template) => {
    setSelectedTemplate(template);
    setShowAssignModal(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getCategoryLabel = (category) => {
    const labels = { nda: 'NDA', contract: 'Contrato', agreement: 'Acuerdo', other: 'Otro' };
    return labels[category] || category;
  };

  const getCategoryColor = (category) => {
    const colors = {
      nda: 'bg-purple-100 text-purple-700',
      contract: 'bg-blue-100 text-blue-700',
      agreement: 'bg-green-100 text-green-700',
      other: 'bg-gray-100 text-gray-700'
    };
    return colors[category] || colors.other;
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ink-900"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Documentos para Firma</h1>
          <p className="text-ink-500 mt-1">Gestiona plantillas de NDA, contratos y acuerdos</p>
        </div>
        <button
          onClick={() => {
            setEditingTemplate(null);
            setFormData({ name: '', description: '', category: 'nda', content: '' });
            setShowTemplateModal(true);
          }}
          className="bg-ink-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-ink-800"
        >
          <Plus className="w-4 h-4" />
          Nueva plantilla
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-ink-200">
        <button
          onClick={() => setActiveTab('templates')}
          className={`pb-3 px-1 font-medium border-b-2 transition-colors ${
            activeTab === 'templates'
              ? 'border-ink-900 text-ink-900'
              : 'border-transparent text-ink-500 hover:text-ink-700'
          }`}
        >
          Plantillas ({templates.length})
        </button>
        <button
          onClick={() => setActiveTab('signatures')}
          className={`pb-3 px-1 font-medium border-b-2 transition-colors ${
            activeTab === 'signatures'
              ? 'border-ink-900 text-ink-900'
              : 'border-transparent text-ink-500 hover:text-ink-700'
          }`}
        >
          Firmas ({signatures.length})
        </button>
      </div>

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="grid gap-4">
          {templates.length === 0 ? (
            <div className="text-center py-12 bg-ink-50 rounded-xl">
              <FileSignature className="w-12 h-12 text-ink-300 mx-auto mb-3" />
              <p className="text-ink-600 font-medium">No hay plantillas</p>
              <p className="text-ink-400 text-sm">Crea tu primera plantilla de documento</p>
            </div>
          ) : (
            templates.map((template) => (
              <div key={template.id} className="bg-white border border-ink-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-ink-100 rounded-xl flex items-center justify-center">
                      <FileSignature className="w-6 h-6 text-ink-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-ink-900">{template.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getCategoryColor(template.category)}`}>
                          {getCategoryLabel(template.category)}
                        </span>
                        <span className="text-xs text-ink-400">
                          {template.signed_count || 0} firmados
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openAssignModal(template)}
                      className="p-2 text-ink-500 hover:text-ink-700 hover:bg-ink-100 rounded-lg"
                      title="Asignar a cliente"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEditModal(template)}
                      className="p-2 text-ink-500 hover:text-ink-700 hover:bg-ink-100 rounded-lg"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Signatures Tab */}
      {activeTab === 'signatures' && (
        <div className="bg-white border border-ink-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-ink-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-ink-500 uppercase">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-ink-500 uppercase">Documento</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-ink-500 uppercase">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-ink-500 uppercase">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {signatures.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-ink-500">
                    No hay firmas registradas
                  </td>
                </tr>
              ) : (
                signatures.map((sig) => (
                  <tr key={sig.id} className="hover:bg-ink-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-ink-900">
                        {sig.client_nickname || sig.client_company}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getCategoryColor(sig.category)}`}>
                        {sig.template_name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {sig.status === 'signed' ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="w-4 h-4" />
                          Firmado
                        </span>
                      ) : sig.status === 'pending' ? (
                        <span className="flex items-center gap-1 text-amber-600">
                          <Clock className="w-4 h-4" />
                          Pendiente
                        </span>
                      ) : (
                        <span className="text-ink-500">{sig.status}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-500 text-sm">
                      {sig.status === 'signed' ? formatDate(sig.signed_at) : formatDate(sig.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-ink-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-ink-900">
                {editingTemplate ? 'Editar plantilla' : 'Nueva plantilla'}
              </h2>
              <button onClick={() => setShowTemplateModal(false)} className="text-ink-400 hover:text-ink-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={editingTemplate ? handleUpdateTemplate : handleCreateTemplate} className="p-6">
              <div className="grid gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-ink-200 rounded-lg focus:ring-2 focus:ring-ink-200 outline-none"
                    placeholder="Ej: Acuerdo de Confidencialidad"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-1">Categoría</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 border border-ink-200 rounded-lg focus:ring-2 focus:ring-ink-200 outline-none"
                  >
                    <option value="nda">NDA / Confidencialidad</option>
                    <option value="contract">Contrato</option>
                    <option value="agreement">Acuerdo</option>
                    <option value="other">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-1">Descripción (opcional)</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 border border-ink-200 rounded-lg focus:ring-2 focus:ring-ink-200 outline-none"
                    placeholder="Breve descripción del documento"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-1">
                    Contenido (HTML)
                  </label>
                  <p className="text-xs text-ink-400 mb-2">
                    Variables disponibles: {"{{CLIENT_NAME}}"}, {"{{CLIENT_COMPANY}}"}, {"{{DATE}}"}, {"{{SIGNER_NAME}}"}
                  </p>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full px-4 py-2 border border-ink-200 rounded-lg focus:ring-2 focus:ring-ink-200 outline-none font-mono text-sm"
                    rows={12}
                    placeholder="<h1>Acuerdo de Confidencialidad</h1>..."
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  className="px-4 py-2 text-ink-600 hover:bg-ink-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-ink-900 text-white rounded-lg hover:bg-ink-800"
                >
                  {editingTemplate ? 'Guardar cambios' : 'Crear plantilla'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-ink-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-ink-900">Asignar documento</h2>
              <button onClick={() => setShowAssignModal(false)} className="text-ink-400 hover:text-ink-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAssignDocument} className="p-6">
              <p className="text-ink-600 mb-4">
                Asignar <strong>{selectedTemplate.name}</strong> a un cliente para que lo firme.
              </p>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Cliente</label>
                <select
                  value={assignData.client_id}
                  onChange={(e) => setAssignData({ client_id: e.target.value })}
                  className="w-full px-4 py-2 border border-ink-200 rounded-lg focus:ring-2 focus:ring-ink-200 outline-none"
                  required
                >
                  <option value="">Seleccionar cliente...</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.nickname || client.company}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 text-ink-600 hover:bg-ink-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-ink-900 text-white rounded-lg hover:bg-ink-800 flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Enviar para firma
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
