import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { portalCallsAPI } from '../../utils/portalApi';
import { Phone, Clock, ArrowRight, Loader2, FileText } from 'lucide-react';

export default function PortalCalls() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCalls();
  }, []);

  const loadCalls = async () => {
    try {
      const response = await portalCallsAPI.getAll();
      setCalls(response.calls || []);
    } catch (error) {
      console.error('Error loading calls:', error);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#1A1A2E] tracking-tight">Llamadas</h1>
        <p className="text-sm text-gray-500 mt-0.5">Resúmenes y transcripciones de reuniones</p>
      </div>

      {calls.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Phone className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-[#1A1A2E]">Sin llamadas registradas</h2>
          <p className="text-gray-500 mt-2">Aquí aparecerán los resúmenes de las reuniones con tu equipo.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {calls.map((call) => (
            <Link
              key={call.id}
              to={`/portal/calls/${call.id}`}
              className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5 flex items-center gap-4 hover:shadow-md transition-shadow group block"
            >
              <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Phone className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-[#1A1A2E] truncate">{call.title}</h3>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-gray-500">
                    {new Date(call.call_date).toLocaleDateString('es-CO', {
                      year: 'numeric', month: 'short', day: 'numeric'
                    })}
                  </span>
                  {call.duration_minutes && (
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {call.duration_minutes} min
                    </span>
                  )}
                  {call.has_transcription ? (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      Transcripción
                    </span>
                  ) : null}
                </div>
                {call.summary && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-1">{call.summary}</p>
                )}
              </div>
              <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
