import { useState, useEffect } from 'react';
import {
  Zap,
  Plus,
  Edit2,
  Trash2,
  Power,
  PowerOff,
  RefreshCw,
  MessageCircle,
  Clock,
  Tag,
  AlertCircle,
  X,
  Check,
} from 'lucide-react';
import { zernioAPI } from '../../utils/api';

const SocialAutomations = ({ account }) => {
  const [loading, setLoading] = useState(true);
  const [automations, setAutomations] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState(null);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    triggerKeywords: '',
    replyMessage: '',
    isActive: true,
  });

  useEffect(() => {
    if (account?.id) {
      fetchAutomations();
    }
  }, [account?.id]);

  const fetchAutomations = async () => {
    setLoading(true);
    try {
      const res = await zernioAPI.getAutomations({ accountId: account.id });
      setAutomations(res.data || []);
    } catch (error) {
      console.error('Error fetching automations:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingAutomation(null);
    setFormData({
      name: '',
      triggerKeywords: '',
      replyMessage: '',
      isActive: true,
    });
    setShowModal(true);
  };

  const openEditModal = (automation) => {
    setEditingAutomation(automation);
    setFormData({
      name: automation.name || '',
      triggerKeywords: (automation.triggerKeywords || []).join(', '),
      replyMessage: automation.replyMessage || '',
      isActive: automation.isActive !== false,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAutomation(null);
    setFormData({
      name: '',
      triggerKeywords: '',
      replyMessage: '',
      isActive: true,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.triggerKeywords.trim() || !formData.replyMessage.trim()) {
      return;
    }

    setSaving(true);
    try {
      const keywords = formData.triggerKeywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);

      if (editingAutomation) {
        await zernioAPI.updateAutomation(editingAutomation.id, {
          name: formData.name,
          triggerKeywords: keywords,
          replyMessage: formData.replyMessage,
          isActive: formData.isActive,
        });
      } else {
        await zernioAPI.createAutomation({
          accountId: account.id,
          name: formData.name,
          triggerKeywords: keywords,
          replyMessage: formData.replyMessage,
          isActive: formData.isActive,
        });
      }

      closeModal();
      fetchAutomations();
    } catch (error) {
      console.error('Error saving automation:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (automation) => {
    setActionLoading(automation.id);
    try {
      await zernioAPI.updateAutomation(automation.id, {
        isActive: !automation.isActive,
      });
      setAutomations(prev =>
        prev.map(a => a.id === automation.id ? { ...a, isActive: !a.isActive } : a)
      );
    } catch (error) {
      console.error('Error toggling automation:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (automationId) => {
    if (!window.confirm('¿Eliminar esta automatización?')) return;
    setActionLoading(automationId);
    try {
      await zernioAPI.deleteAutomation(automationId);
      setAutomations(prev => prev.filter(a => a.id !== automationId));
    } catch (error) {
      console.error('Error deleting automation:', error);
    } finally {
      setActionLoading(null);
    }
  };

  if (!account) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <Zap className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Selecciona una cuenta</h3>
        <p className="text-gray-500">
          Elige una cuenta para gestionar automatizaciones de comentarios
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Automatizaciones</h2>
          <p className="text-sm text-gray-500">
            Respuestas automaticas a comentarios que contengan palabras clave
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAutomations}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Nueva automatizacion
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">Como funcionan las automatizaciones</p>
          <p>
            Cuando alguien comenta en tus publicaciones y su comentario contiene alguna de
            las palabras clave configuradas, Zernio respondera automaticamente con el mensaje
            que hayas definido.
          </p>
        </div>
      </div>

      {/* Automations List */}
      {automations.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Zap className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Sin automatizaciones
          </h3>
          <p className="text-gray-500 mb-4">
            Crea tu primera automatizacion para responder comentarios automaticamente
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Crear automatizacion
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {automations.map((automation) => (
            <div
              key={automation.id}
              className={`p-4 hover:bg-gray-50 ${!automation.isActive ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Name and Status */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-gray-900">{automation.name}</span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        automation.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {automation.isActive ? (
                        <>
                          <Power className="w-3 h-3" />
                          Activa
                        </>
                      ) : (
                        <>
                          <PowerOff className="w-3 h-3" />
                          Pausada
                        </>
                      )}
                    </span>
                  </div>

                  {/* Keywords */}
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="w-4 h-4 text-gray-400" />
                    <div className="flex flex-wrap gap-1">
                      {(automation.triggerKeywords || []).map((keyword, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Reply Message */}
                  <div className="flex items-start gap-2">
                    <MessageCircle className="w-4 h-4 text-gray-400 mt-0.5" />
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {automation.replyMessage}
                    </p>
                  </div>

                  {/* Stats */}
                  {automation.executionCount !== undefined && (
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        {automation.executionCount} ejecuciones
                      </span>
                      {automation.lastExecutedAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Ultima: {new Date(automation.lastExecutedAt).toLocaleDateString('es-CO')}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleToggleActive(automation)}
                    disabled={actionLoading === automation.id}
                    className={`p-2 rounded-lg ${
                      automation.isActive
                        ? 'text-orange-600 hover:bg-orange-50'
                        : 'text-green-600 hover:bg-green-50'
                    }`}
                    title={automation.isActive ? 'Pausar' : 'Activar'}
                  >
                    {automation.isActive ? (
                      <PowerOff className="w-5 h-5" />
                    ) : (
                      <Power className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={() => openEditModal(automation)}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                    title="Editar"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(automation.id)}
                    disabled={actionLoading === automation.id}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    title="Eliminar"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div
              className="fixed inset-0 bg-black/50"
              onClick={closeModal}
            />

            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingAutomation ? 'Editar Automatizacion' : 'Nueva Automatizacion'}
                </h3>
                <button
                  onClick={closeModal}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre de la automatizacion
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej: Respuesta a preguntas de precio"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Keywords */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Palabras clave (separadas por coma)
                  </label>
                  <input
                    type="text"
                    value={formData.triggerKeywords}
                    onChange={(e) => setFormData(prev => ({ ...prev, triggerKeywords: e.target.value }))}
                    placeholder="Ej: precio, cuanto cuesta, valor, costo"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    La automatizacion se dispara si el comentario contiene alguna de estas palabras
                  </p>
                </div>

                {/* Reply Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mensaje de respuesta
                  </label>
                  <textarea
                    value={formData.replyMessage}
                    onChange={(e) => setFormData(prev => ({ ...prev, replyMessage: e.target.value }))}
                    placeholder="Ej: ¡Hola! Gracias por tu interes. Te enviamos un DM con toda la info de precios 💬"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                    required
                  />
                </div>

                {/* Active Toggle */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, isActive: !prev.isActive }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      formData.isActive ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.isActive ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className="text-sm text-gray-700">
                    {formData.isActive ? 'Activa' : 'Pausada'}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        {editingAutomation ? 'Guardar cambios' : 'Crear automatizacion'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SocialAutomations;
