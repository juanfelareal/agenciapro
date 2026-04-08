import { useEffect, useState, useRef } from 'react';
import { briefsAPI, clientsAPI } from '../utils/api';
import { Plus, X, Trash2, Eye, EyeOff, Upload, FileCode, ChevronDown, Maximize2, Minimize2 } from 'lucide-react';

const Briefs = () => {
  const [briefs, setBriefs] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBrief, setEditingBrief] = useState(null);
  const [previewBrief, setPreviewBrief] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [filterClient, setFilterClient] = useState('all');
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    client_id: '',
    title: '',
    html_content: '',
    visible_to_client: false,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [briefsRes, clientsRes] = await Promise.all([
        briefsAPI.getAll(),
        clientsAPI.getAll(),
      ]);
      setBriefs(briefsRes.data);
      setClients(clientsRes.data.filter(c => c.status === 'active'));
    } catch (error) {
      console.error('Error loading briefs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm')) {
      alert('Por favor selecciona un archivo HTML');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setFormData(prev => ({
        ...prev,
        html_content: event.target.result,
        title: prev.title || file.name.replace(/\.(html|htm)$/, ''),
      }));
    };
    reader.readAsText(file);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.client_id || !formData.title) {
      alert('Cliente y título son obligatorios');
      return;
    }

    try {
      if (editingBrief) {
        await briefsAPI.update(editingBrief.id, formData);
      } else {
        await briefsAPI.create(formData);
      }
      setShowModal(false);
      setEditingBrief(null);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving brief:', error);
      alert('Error al guardar el brief');
    }
  };

  const handleEdit = (brief) => {
    setEditingBrief(brief);
    setFormData({
      client_id: brief.client_id,
      title: brief.title,
      html_content: brief.html_content || '',
      visible_to_client: !!brief.visible_to_client,
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este brief?')) return;
    try {
      await briefsAPI.delete(id);
      loadData();
    } catch (error) {
      console.error('Error deleting brief:', error);
    }
  };

  const handleToggleVisibility = async (brief) => {
    try {
      await briefsAPI.update(brief.id, { visible_to_client: !brief.visible_to_client });
      loadData();
    } catch (error) {
      console.error('Error toggling visibility:', error);
    }
  };

  const resetForm = () => {
    setFormData({ client_id: '', title: '', html_content: '', visible_to_client: false });
  };

  const handleNew = () => {
    resetForm();
    setEditingBrief(null);
    setShowModal(true);
  };

  const clientName = (brief) => brief.client_nickname || brief.client_company || brief.client_name || 'Sin cliente';

  const filteredBriefs = filterClient === 'all'
    ? briefs
    : briefs.filter(b => String(b.client_id) === filterClient);

  // Group by client
  const grouped = {};
  filteredBriefs.forEach(b => {
    const key = b.client_id;
    if (!grouped[key]) grouped[key] = { name: clientName(b), briefs: [] };
    grouped[key].briefs.push(b);
  });

  if (loading) return <div className="text-center py-8">Cargando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-[#1A1A2E] tracking-tight">Briefs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Archivos HTML por cliente</p>
        </div>
        <button
          onClick={handleNew}
          className="bg-[#1A1A2E] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-[#252542] transition-colors"
        >
          <Plus size={20} />
          Nuevo Brief
        </button>
      </div>

      {/* Filter by client */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Filtrar:</span>
        <select
          value={filterClient}
          onChange={e => setFilterClient(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1A1A2E]"
        >
          <option value="all">Todos los clientes</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.nickname || c.company || c.name}</option>
          ))}
        </select>
        <span className="text-sm text-gray-400 ml-2">{filteredBriefs.length} brief{filteredBriefs.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Briefs grouped by client */}
      {Object.keys(grouped).length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <FileCode className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No hay briefs creados</p>
          <p className="text-sm text-gray-400 mt-1">Sube archivos HTML para cada marca</p>
        </div>
      ) : (
        Object.entries(grouped).map(([clientId, group]) => (
          <div key={clientId} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
              <h3 className="font-semibold text-[#1A1A2E]">{group.name}</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {group.briefs.map(brief => (
                <div key={brief.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 bg-[#1A1A2E]/5 rounded-xl flex items-center justify-center flex-shrink-0">
                      <FileCode className="w-4 h-4 text-[#1A1A2E]" />
                    </div>
                    <div className="min-w-0">
                      <p
                        className="font-medium text-[#1A1A2E] cursor-pointer hover:underline truncate"
                        onClick={() => setPreviewBrief(brief)}
                      >
                        {brief.title}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(brief.updated_at).toLocaleDateString('es-CO')}
                        {brief.html_content ? ` · ${Math.round(brief.html_content.length / 1024)}KB` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleVisibility(brief)}
                      className={`p-2 rounded-lg transition-colors ${
                        brief.visible_to_client
                          ? 'text-[#10B981] bg-[#10B981]/10 hover:bg-[#10B981]/20'
                          : 'text-gray-400 bg-gray-100 hover:bg-gray-200'
                      }`}
                      title={brief.visible_to_client ? 'Visible para el cliente' : 'Oculto para el cliente'}
                    >
                      {brief.visible_to_client ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                    <button
                      onClick={() => setPreviewBrief(brief)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Vista previa"
                    >
                      <Maximize2 size={16} />
                    </button>
                    <button
                      onClick={() => handleEdit(brief)}
                      className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(brief.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Preview Modal */}
      {previewBrief && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`bg-white shadow-xl flex flex-col ${fullscreen ? 'w-full h-full' : 'rounded-2xl w-full max-w-5xl h-[85vh]'}`}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
              <div>
                <h3 className="font-semibold text-[#1A1A2E]">{previewBrief.title}</h3>
                <p className="text-xs text-gray-400">{clientName(previewBrief)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFullscreen(!fullscreen)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
                <button
                  onClick={() => { setPreviewBrief(null); setFullscreen(false); }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe
                srcDoc={
                  previewBrief.html_content
                    ? previewBrief.html_content.replace(
                        /<\/body>/i,
                        `<script>
                          document.addEventListener('click', function(e) {
                            var a = e.target.closest('a');
                            if (!a) return;
                            var href = a.getAttribute('href');
                            if (!href) return;
                            if (href.startsWith('#')) {
                              e.preventDefault();
                              var el = document.querySelector(href);
                              if (el) el.scrollIntoView({ behavior: 'smooth' });
                            } else if (href.startsWith('http')) {
                              e.preventDefault();
                              window.open(href, '_blank');
                            }
                          });
                        <\/script></body>`
                      )
                    : '<p style="padding:2rem;color:#999">Sin contenido HTML</p>'
                }
                className="w-full h-full border-0"
                title={previewBrief.title}
                sandbox="allow-scripts allow-same-origin allow-popups"
              />
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-[#1A1A2E]">
                {editingBrief ? 'Editar Brief' : 'Nuevo Brief'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Cliente *</label>
                <select
                  required
                  value={formData.client_id}
                  onChange={e => setFormData({ ...formData, client_id: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1A1A2E]"
                >
                  <option value="">Seleccionar cliente...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.nickname || c.company || c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Título *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ej: Brief Campaña Navidad 2026"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1A1A2E]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Archivo HTML</label>
                <div
                  className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-[#1A1A2E]/30 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".html,.htm"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  {formData.html_content ? (
                    <p className="text-sm text-[#10B981] font-medium">
                      Archivo cargado ({Math.round(formData.html_content.length / 1024)}KB)
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400">Click para subir archivo HTML</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="visible_to_client"
                  checked={formData.visible_to_client}
                  onChange={e => setFormData({ ...formData, visible_to_client: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="visible_to_client" className="text-sm">
                  Visible para el cliente en su portal
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-[#1A1A2E] text-white rounded-xl hover:bg-[#252542] transition-colors"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Briefs;
