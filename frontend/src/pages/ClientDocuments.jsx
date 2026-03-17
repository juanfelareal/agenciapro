import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { clientsAPI, clientDocumentsAPI } from '../utils/api';
import {
  ArrowLeft,
  Upload,
  FileText,
  File,
  Trash2,
  Download,
  Edit,
  Check,
  X,
  Loader2,
  FolderOpen,
  Plus,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';

const CATEGORIES = ['General', 'Contrato', 'Acuerdo de Confidencialidad', 'Propuesta', 'Factura', 'Otro'];

const fileIcon = (type) => {
  if (!type) return File;
  if (type.includes('pdf')) return FileText;
  return File;
};

const formatSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function ClientDocuments() {
  const { id: clientId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [client, setClient] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [uploadCategory, setUploadCategory] = useState('General');
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, [clientId]);

  const loadData = async () => {
    try {
      const [clientRes, docsRes] = await Promise.all([
        clientsAPI.getById(clientId),
        clientDocumentsAPI.getAll(clientId),
      ]);
      setClient(clientRes.data);
      setDocuments(docsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('label', file.name);
        formData.append('category', uploadCategory);
        await clientDocumentsAPI.upload(clientId, formData);
      }
      await loadData();
    } catch (error) {
      console.error('Error uploading:', error);
      alert('Error al subir archivo(s)');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (docId) => {
    if (!confirm('¿Eliminar este documento?')) return;
    try {
      await clientDocumentsAPI.delete(clientId, docId);
      setDocuments(documents.filter(d => d.id !== docId));
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const handleEditStart = (doc) => {
    setEditingId(doc.id);
    setEditLabel(doc.label);
    setEditCategory(doc.category || 'General');
  };

  const handleEditSave = async (docId) => {
    try {
      await clientDocumentsAPI.update(clientId, docId, { label: editLabel, category: editCategory });
      setDocuments(documents.map(d => d.id === docId ? { ...d, label: editLabel, category: editCategory } : d));
      setEditingId(null);
    } catch (error) {
      console.error('Error updating:', error);
    }
  };

  const categories = [...new Set(documents.map(d => d.category || 'General'))].sort();
  const filtered = activeFilter === 'all' ? documents : documents.filter(d => (d.category || 'General') === activeFilter);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/app/clients')}
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-[#1A1A2E] tracking-tight">
            Documentos — {client?.company || client?.name}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Contratos, acuerdos y archivos del cliente
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={uploadCategory}
            onChange={(e) => setUploadCategory(e.target.value)}
            className="border rounded-xl px-3 py-2.5 text-sm"
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUpload}
            className="hidden"
            multiple
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="bg-[#1A1A2E] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-[#252542] disabled:bg-gray-400 transition-colors"
          >
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
            {uploading ? 'Subiendo...' : 'Subir Documento'}
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      {categories.length > 0 && (
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl flex-wrap">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeFilter === 'all' ? 'bg-white text-[#1A1A2E] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Todos
            <span className={`ml-1.5 px-1.5 py-0.5 rounded-md text-xs ${
              activeFilter === 'all' ? 'bg-gray-200 text-gray-700' : 'bg-gray-200 text-gray-500'
            }`}>{documents.length}</span>
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeFilter === cat ? 'bg-white text-[#1A1A2E] shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {cat}
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-md text-xs ${
                activeFilter === cat ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-gray-200 text-gray-500'
              }`}>{documents.filter(d => (d.category || 'General') === cat).length}</span>
            </button>
          ))}
        </div>
      )}

      {/* Documents List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <FolderOpen size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No hay documentos</h3>
          <p className="text-gray-500 mb-4">Sube contratos, acuerdos u otros archivos del cliente</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-[#1A1A2E] text-white px-4 py-2 rounded-lg hover:bg-[#252542]"
          >
            Subir primer documento
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {filtered.map((doc) => {
              const Icon = fileIcon(doc.file_type);
              const isEditing = editingId === doc.id;

              return (
                <div key={doc.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon size={20} className="text-[#1A1A2E]" />
                  </div>

                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          className="flex-1 border rounded-lg px-2 py-1 text-sm"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          autoFocus
                        />
                        <select
                          className="border rounded-lg px-2 py-1 text-sm"
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                        >
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button onClick={() => handleEditSave(doc.id)} className="p-1 text-green-600 hover:bg-green-50 rounded">
                          <Check size={16} />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="font-medium text-[#1A1A2E] truncate">{doc.label}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                          <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">{doc.category || 'General'}</span>
                          <span>{formatSize(doc.file_size)}</span>
                          <span>{doc.file_name}</span>
                          {doc.uploaded_by_name && <span>· {doc.uploaded_by_name}</span>}
                          <span>· {new Date(doc.created_at).toLocaleDateString('es-CO')}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <a
                        href={`${API_BASE}${doc.file_path}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Descargar"
                      >
                        <Download size={18} />
                      </a>
                      <button
                        onClick={() => handleEditStart(doc)}
                        className="p-2 text-gray-400 hover:text-[#1A1A2E] hover:bg-gray-100 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
