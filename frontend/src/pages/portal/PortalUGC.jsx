import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { portalUGCAPI } from '../../utils/portalApi';
import {
  Loader2,
  Video,
  Instagram,
  User,
  Package,
  ExternalLink,
  Clock,
  CheckCircle2,
  Play
} from 'lucide-react';

const ASSIGNMENT_STATUS = {
  accepted: { label: 'Aceptado', color: 'bg-blue-100 text-blue-700' },
  in_production: { label: 'En producción', color: 'bg-yellow-100 text-yellow-700' },
  delivered: { label: 'Entregado', color: 'bg-green-100 text-green-700' },
  paid: { label: 'Pagado', color: 'bg-emerald-100 text-emerald-700' },
};

export default function PortalUGC() {
  const [creators, setCreators] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('creators');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [creatorsRes, assignmentsRes] = await Promise.all([
        portalUGCAPI.getCreators(),
        portalUGCAPI.getAssignments(),
      ]);
      setCreators(creatorsRes || []);
      setAssignments(assignmentsRes || []);
    } catch (error) {
      console.error('Error loading UGC data:', error);
    } finally {
      setLoading(false);
    }
  };

  const parseSocialNetworks = (social) => {
    if (!social) return {};
    if (typeof social === 'string') {
      try {
        return JSON.parse(social);
      } catch {
        return {};
      }
    }
    return social;
  };

  const parseIndustries = (industries) => {
    if (!industries) return [];
    if (typeof industries === 'string') {
      try {
        return JSON.parse(industries);
      } catch {
        return [];
      }
    }
    return industries;
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
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center">
            <Video className="w-6 h-6 text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[#17181A]">Creadores de Contenido</h1>
            <p className="text-sm text-gray-500">
              {creators.length} {creators.length === 1 ? 'creador asignado' : 'creadores asignados'} · {assignments.length} {assignments.length === 1 ? 'asignación' : 'asignaciones'}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-100 pb-1">
        <button
          onClick={() => setActiveTab('creators')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'creators'
              ? 'bg-[#17181A] text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <span className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Creadores ({creators.length})
          </span>
        </button>
        <button
          onClick={() => setActiveTab('assignments')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'assignments'
              ? 'bg-[#17181A] text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <span className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Asignaciones ({assignments.length})
          </span>
        </button>
      </div>

      {/* Content */}
      {activeTab === 'creators' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {creators.length === 0 ? (
            <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-gray-100">
              <Video className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No hay creadores asignados aún</p>
            </div>
          ) : (
            creators.map((creator) => {
              const social = parseSocialNetworks(creator.social_networks);
              const industries = parseIndustries(creator.industries);
              return (
                <div
                  key={creator.id}
                  className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    {creator.profile_photo_url ? (
                      <img
                        src={creator.profile_photo_url}
                        alt={creator.full_name}
                        className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 bg-violet-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <User className="w-7 h-7 text-violet-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-[#17181A] truncate">{creator.full_name}</h3>
                      {industries.length > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {industries.slice(0, 2).join(', ')}
                          {industries.length > 2 && ` +${industries.length - 2}`}
                        </p>
                      )}
                    </div>
                  </div>

                  {creator.bio && (
                    <p className="text-sm text-gray-500 mt-3 line-clamp-2">{creator.bio}</p>
                  )}

                  {/* Social Links */}
                  {(social.instagram || social.tiktok) && (
                    <div className="flex gap-2 mt-4">
                      {social.instagram && (
                        <a
                          href={`https://instagram.com/${social.instagram.replace('@', '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-pink-50 text-pink-600 rounded-lg text-xs font-medium hover:bg-pink-100 transition-colors"
                        >
                          <Instagram className="w-3.5 h-3.5" />
                          {social.instagram}
                        </a>
                      )}
                      {social.tiktok && (
                        <a
                          href={`https://tiktok.com/@${social.tiktok.replace('@', '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-800 transition-colors"
                        >
                          <Play className="w-3.5 h-3.5" />
                          {social.tiktok}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'assignments' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {assignments.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No hay asignaciones activas</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {assignments.map((assignment) => {
                const status = ASSIGNMENT_STATUS[assignment.status] || { label: assignment.status, color: 'bg-gray-100 text-gray-700' };
                return (
                  <div key={assignment.id} className="p-5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        {assignment.creator_photo ? (
                          <img
                            src={assignment.creator_photo}
                            alt={assignment.creator_name}
                            className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-violet-50 rounded-lg flex items-center justify-center flex-shrink-0">
                            <User className="w-5 h-5 text-violet-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-[#17181A] truncate">{assignment.title}</h3>
                          <p className="text-sm text-gray-500">{assignment.creator_name}</p>
                          {assignment.description && (
                            <p className="text-sm text-gray-400 mt-1 line-clamp-2">{assignment.description}</p>
                          )}
                          {assignment.deliverables && (
                            <p className="text-xs text-gray-400 mt-2">
                              <span className="font-medium">Entregables:</span> {assignment.deliverables}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                        {assignment.end_date && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(assignment.end_date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Delivery link */}
                    {assignment.delivery_url && (
                      <div className="mt-4 flex items-center gap-2">
                        <a
                          href={assignment.delivery_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Ver entrega
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        {assignment.delivered_at && (
                          <span className="text-xs text-gray-400">
                            Entregado el {new Date(assignment.delivered_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
