import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { clientsAPI, clientReportsAPI } from '../utils/api';
import {
  ArrowLeft, Upload, FileText, Trash2, Download, Loader2, Calendar, BarChart3, X,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';
const fileUrl = (p) => (p?.startsWith('http') ? p : `${API_BASE}${p}`);

const formatSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (d) => {
  if (!d) return '';
  const [y, m, day] = d.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
};

const TYPE_LABELS = {
  monthly: 'Cierre de mes',
  biweekly: 'Reporte parcial (quincenal)',
  other: 'Otro',
};

export default function ClientReports() {
  const { id: clientId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [client, setClient] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    report_type: 'monthly',
    period_label: '',
    period_start: '',
    period_end: '',
  });
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => { load(); }, [clientId]);

  const load = async () => {
    setLoading(true);
    try {
      const [c, r] = await Promise.all([
        clientsAPI.getById(clientId),
        clientReportsAPI.list(clientId),
      ]);
      setClient(c.data);
      setReports(r.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Selecciona un archivo PDF');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      fd.append('title', formData.title || selectedFile.name);
      fd.append('report_type', formData.report_type);
      if (formData.period_label) fd.append('period_label', formData.period_label);
      if (formData.period_start) fd.append('period_start', formData.period_start);
      if (formData.period_end) fd.append('period_end', formData.period_end);
      await clientReportsAPI.upload(clientId, fd);
      setShowUploadModal(false);
      setFormData({ title: '', report_type: 'monthly', period_label: '', period_start: '', period_end: '' });
      setSelectedFile(null);
      await load();
    } catch (err) {
      alert('Error al subir reporte: ' + (err?.response?.data?.error || err.message));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (reportId) => {
    if (!confirm('¿Eliminar este reporte? El cliente dejará de verlo.')) return;
    try {
      await clientReportsAPI.delete(clientId, reportId);
      setReports(reports.filter((r) => r.id !== reportId));
    } catch (err) {
      alert('No se pudo eliminar');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/app/clients')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-[#1A1A2E] tracking-tight">Reportes</h1>
            <p className="text-sm text-gray-500 mt-0.5">{client?.company || client?.name}</p>
          </div>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1A1A2E] text-white rounded-xl hover:bg-[#252542] transition-colors text-sm font-medium"
        >
          <Upload size={16} />
          Subir reporte
        </button>
      </div>

      {reports.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl py-16 text-center text-gray-500">
          <BarChart3 className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p>Aún no has subido reportes para este cliente.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Título</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Período</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subido</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-red-500" />
                      <div>
                        <p className="text-sm font-medium text-[#1A1A2E]">{r.title}</p>
                        <p className="text-xs text-gray-400">{r.file_name} · {formatSize(r.file_size)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {TYPE_LABELS[r.report_type] || r.report_type}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {r.period_label || (r.period_start && r.period_end
                      ? `${formatDate(r.period_start)} – ${formatDate(r.period_end)}`
                      : '—')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDate(r.created_at)}
                    {r.uploaded_by_name && <span className="text-xs text-gray-400 block">{r.uploaded_by_name}</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={fileUrl(r.file_path)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-[#1A1A2E] p-1.5 rounded-lg hover:bg-gray-100 inline-block"
                      title="Descargar"
                    >
                      <Download size={16} />
                    </a>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 ml-1"
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-[#1A1A2E]">Subir reporte</h2>
              <button onClick={() => setShowUploadModal(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tipo *</label>
                <select
                  value={formData.report_type}
                  onChange={(e) => setFormData({ ...formData, report_type: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="monthly">Cierre de mes</option>
                  <option value="biweekly">Reporte parcial (quincenal)</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Período</label>
                <input
                  type="text"
                  placeholder={formData.report_type === 'monthly' ? 'Ej: Mayo 2026' : 'Ej: 1-15 Mayo 2026'}
                  value={formData.period_label}
                  onChange={(e) => setFormData({ ...formData, period_label: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Desde</label>
                  <input
                    type="date"
                    value={formData.period_start}
                    onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Hasta</label>
                  <input
                    type="date"
                    value={formData.period_end}
                    onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Título (opcional)</label>
                <input
                  type="text"
                  placeholder="Por defecto, el nombre del archivo"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Archivo PDF *</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  required
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 border rounded-xl hover:bg-gray-50 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  className="px-4 py-2 bg-[#1A1A2E] text-white rounded-xl hover:bg-[#252542] text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                >
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  {uploading ? 'Subiendo…' : 'Subir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
