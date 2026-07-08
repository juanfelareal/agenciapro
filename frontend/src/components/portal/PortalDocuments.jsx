import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { portalDocumentsAPI } from '../../utils/portalApi';
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  Download,
  FileSignature
} from 'lucide-react';

export default function PortalDocuments() {
  const [pendingDocs, setPendingDocs] = useState([]);
  const [signedDocs, setSignedDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const [pending, signed] = await Promise.all([
        portalDocumentsAPI.getPending(),
        portalDocumentsAPI.getSigned()
      ]);
      setPendingDocs(pending);
      setSignedDocs(signed);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
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
    const labels = {
      nda: 'Confidencialidad',
      contract: 'Contrato',
      agreement: 'Acuerdo',
      other: 'Documento'
    };
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
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink-900">Documentos</h1>
        <p className="text-ink-500 mt-1">Revisa y firma los documentos requeridos</p>
      </div>

      {/* Alert for pending documents */}
      {pendingDocs.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-900">
              Tienes {pendingDocs.length} documento{pendingDocs.length > 1 ? 's' : ''} pendiente{pendingDocs.length > 1 ? 's' : ''} de firma
            </p>
            <p className="text-sm text-amber-700 mt-1">
              Por favor, revisa y firma los documentos para continuar con el proceso.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-ink-100">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'pending'
              ? 'border-ink-900 text-ink-900'
              : 'border-transparent text-ink-500 hover:text-ink-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Pendientes
            {pendingDocs.length > 0 && (
              <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
                {pendingDocs.length}
              </span>
            )}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('signed')}
          className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'signed'
              ? 'border-ink-900 text-ink-900'
              : 'border-transparent text-ink-500 hover:text-ink-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Firmados
            {signedDocs.length > 0 && (
              <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
                {signedDocs.length}
              </span>
            )}
          </span>
        </button>
      </div>

      {/* Content */}
      {activeTab === 'pending' && (
        <div className="space-y-3">
          {pendingDocs.length === 0 ? (
            <div className="text-center py-12 bg-ink-50 rounded-xl">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-ink-600 font-medium">No hay documentos pendientes</p>
              <p className="text-ink-400 text-sm mt-1">Todos los documentos han sido firmados</p>
            </div>
          ) : (
            pendingDocs.map((doc) => (
              <Link
                key={doc.id}
                to={`/portal/documents/${doc.id}/sign`}
                className="block bg-white border border-ink-200 rounded-xl p-4 hover:border-ink-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                      <FileSignature className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-ink-900 group-hover:text-ink-700">
                        {doc.template_name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getCategoryColor(doc.category)}`}>
                          {getCategoryLabel(doc.category)}
                        </span>
                        <span className="text-xs text-ink-400">
                          Enviado el {formatDate(doc.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-amber-600 bg-amber-50 px-3 py-1 rounded-lg">
                      Pendiente de firma
                    </span>
                    <ChevronRight className="w-5 h-5 text-ink-300 group-hover:text-ink-500 transition-colors" />
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {activeTab === 'signed' && (
        <div className="space-y-3">
          {signedDocs.length === 0 ? (
            <div className="text-center py-12 bg-ink-50 rounded-xl">
              <FileText className="w-12 h-12 text-ink-300 mx-auto mb-3" />
              <p className="text-ink-600 font-medium">No hay documentos firmados</p>
              <p className="text-ink-400 text-sm mt-1">Los documentos firmados aparecerán aquí</p>
            </div>
          ) : (
            signedDocs.map((doc) => (
              <div
                key={doc.id}
                className="bg-white border border-ink-200 rounded-xl p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-ink-900">
                        {doc.template_name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getCategoryColor(doc.category)}`}>
                          {getCategoryLabel(doc.category)}
                        </span>
                        <span className="text-xs text-ink-400">
                          Firmado el {formatDate(doc.signed_at)} por {doc.signer_name}
                        </span>
                      </div>
                    </div>
                  </div>
                  {doc.pdf_url && (
                    <a
                      href={doc.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm font-medium text-ink-600 hover:text-ink-900 bg-ink-100 hover:bg-ink-200 px-3 py-2 rounded-lg transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Descargar
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
