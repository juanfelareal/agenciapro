import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { portalCallsAPI } from '../../utils/portalApi';
import { ArrowLeft, Phone, Clock, Calendar, Loader2, AlertCircle } from 'lucide-react';

export default function PortalCallDetail() {
  const { id } = useParams();
  const [call, setCall] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');

  useEffect(() => {
    loadCall();
  }, [id]);

  const loadCall = async () => {
    try {
      const response = await portalCallsAPI.getById(id);
      setCall(response.call);
      // Default to transcription tab if no summary
      if (!response.call.summary && response.call.transcription) {
        setActiveTab('transcription');
      }
    } catch (error) {
      console.error('Error loading call:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (!call) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-semibold text-[#1A1A2E]">Llamada no encontrada</h2>
        <Link to="/portal/calls" className="text-gray-500 hover:text-[#1A1A2E] mt-4">
          Volver a llamadas
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to="/portal/calls"
        className="inline-flex items-center gap-2 text-gray-500 hover:text-[#1A1A2E] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Volver a llamadas</span>
      </Link>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Phone className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-[#1A1A2E] tracking-tight">{call.title}</h1>
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <span className="text-sm text-gray-500 flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {new Date(call.call_date).toLocaleDateString('es-CO', {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                })}
              </span>
              {call.duration_minutes && (
                <span className="text-sm text-gray-500 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {call.duration_minutes} minutos
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {call.summary && (
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'summary' ? 'bg-white text-[#1A1A2E] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Resumen
          </button>
        )}
        {call.transcription && (
          <button
            onClick={() => setActiveTab('transcription')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'transcription' ? 'bg-white text-[#1A1A2E] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Transcripción
          </button>
        )}
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6">
        {activeTab === 'summary' && call.summary && (
          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
            {call.summary}
          </div>
        )}
        {activeTab === 'transcription' && call.transcription && (
          <div className="prose prose-sm max-w-none text-gray-600 whitespace-pre-wrap font-mono text-xs leading-relaxed">
            {call.transcription}
          </div>
        )}
        {!call.summary && !call.transcription && (
          <p className="text-gray-500 text-center py-8">No hay contenido disponible para esta llamada.</p>
        )}
      </div>
    </div>
  );
}
