import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usePortal } from '../../context/PortalContext';
import { portalUGCAPI } from '../../utils/portalApi';
import PortalUGCOnboarding from '../../components/portal/PortalUGCOnboarding';
import {
  Loader2,
  Video,
  Instagram,
  User,
  Package,
  ExternalLink,
  Clock,
  CheckCircle2,
  Play,
  BookOpen,
  X,
  MapPin,
  Phone,
  Truck,
  Copy,
  Check,
  AlertCircle
} from 'lucide-react';

const ASSIGNMENT_STATUS = {
  // Direct assignment statuses
  accepted: { label: 'Aceptado', color: 'bg-blue-100 text-blue-700' },
  in_production: { label: 'En producción', color: 'bg-yellow-100 text-yellow-700' },
  delivered: { label: 'Entregado', color: 'bg-green-100 text-green-700' },
  paid: { label: 'Pagado', color: 'bg-emerald-100 text-emerald-700' },
  // Project creator statuses
  presented: { label: 'Presentado', color: 'bg-gray-100 text-gray-700' },
  brand_approved: { label: 'Aprobado', color: 'bg-blue-100 text-blue-700' },
  negotiating: { label: 'Negociando', color: 'bg-purple-100 text-purple-700' },
  confirmed: { label: 'Confirmado', color: 'bg-blue-100 text-blue-700' },
  contract_signed: { label: 'Contrato firmado', color: 'bg-indigo-100 text-indigo-700' },
  producing: { label: 'En producción', color: 'bg-yellow-100 text-yellow-700' },
  delivered_approved: { label: 'Entregado', color: 'bg-green-100 text-green-700' },
  delivered_changes: { label: 'Con cambios', color: 'bg-orange-100 text-orange-700' },
};

const SHIPPING_STATUS = {
  pending: { label: 'Pendiente', color: 'bg-gray-100 text-gray-600' },
  shipped: { label: 'Enviado', color: 'bg-blue-100 text-blue-700' },
  delivered: { label: 'Entregado', color: 'bg-green-100 text-green-700' },
};

const CARRIERS = [
  'Servientrega',
  'Coordinadora',
  'Interrapidísimo',
  'Envia',
  'TCC',
  '472',
  'DHL',
  'FedEx',
  'Otro'
];

export default function PortalUGC() {
  const { client } = usePortal();
  const [creators, setCreators] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('creators');
  const [showOnboarding, setShowOnboarding] = useState(() => {
    const completed = localStorage.getItem(`ugc_onboarding_completed_${client?.id}`);
    return !completed;
  });

  // Shipping modal state
  const [shippingModal, setShippingModal] = useState(null);
  const [shippingData, setShippingData] = useState(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [savingShipping, setSavingShipping] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingCarrier, setTrackingCarrier] = useState('');
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem(`ugc_onboarding_completed_${client?.id}`, 'true');
    setShowOnboarding(false);
  };

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

  const openShippingModal = async (assignment) => {
    if (assignment.source_type !== 'project' || !assignment.project_creator_id) {
      return; // Only project assignments have shipping info
    }

    setShippingModal(assignment);
    setShippingLoading(true);

    try {
      const data = await portalUGCAPI.getShippingInfo(assignment.project_creator_id);
      setShippingData(data);
      setTrackingNumber(data.tracking_number || '');
      setTrackingCarrier(data.tracking_carrier || '');
    } catch (error) {
      console.error('Error loading shipping info:', error);
      setShippingData(null);
    } finally {
      setShippingLoading(false);
    }
  };

  const closeShippingModal = () => {
    setShippingModal(null);
    setShippingData(null);
    setTrackingNumber('');
    setTrackingCarrier('');
  };

  const saveShipping = async () => {
    if (!shippingModal?.project_creator_id) return;

    setSavingShipping(true);
    try {
      const updated = await portalUGCAPI.updateShipping(shippingModal.project_creator_id, {
        tracking_number: trackingNumber,
        tracking_carrier: trackingCarrier
      });

      // Update local state
      setShippingData(prev => ({ ...prev, ...updated }));

      // Update assignments list
      setAssignments(prev => prev.map(a =>
        a.project_creator_id === shippingModal.project_creator_id
          ? { ...a, tracking_number: trackingNumber, tracking_carrier: trackingCarrier, shipping_status: trackingNumber ? 'shipped' : 'pending' }
          : a
      ));
    } catch (error) {
      console.error('Error saving shipping:', error);
    } finally {
      setSavingShipping(false);
    }
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
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

  if (showOnboarding) {
    return <PortalUGCOnboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6">
        <div className="flex items-center justify-between">
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
          <button
            onClick={() => setShowOnboarding(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Ver guía</span>
          </button>
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
              {[...assignments]
                .sort((a, b) => {
                  // Priorizar "contract_signed" primero (listos para despachar)
                  const priorityStatuses = ['contract_signed', 'confirmed', 'brand_approved'];
                  const aIndex = priorityStatuses.indexOf(a.status);
                  const bIndex = priorityStatuses.indexOf(b.status);

                  // Si ambos están en la lista de prioridad, ordenar por su posición
                  if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
                  // Si solo uno está en la lista, ese va primero
                  if (aIndex !== -1) return -1;
                  if (bIndex !== -1) return 1;
                  // Si ninguno está, mantener orden por fecha
                  return new Date(b.created_at) - new Date(a.created_at);
                })
                .map((assignment) => {
                const status = ASSIGNMENT_STATUS[assignment.status] || { label: assignment.status, color: 'bg-gray-100 text-gray-700' };
                const shippingStatus = assignment.shipping_status ? SHIPPING_STATUS[assignment.shipping_status] : null;
                const isProjectAssignment = assignment.source_type === 'project';

                return (
                  <div
                    key={`${assignment.source_type}-${assignment.id}`}
                    className={`p-5 hover:bg-gray-50 transition-colors ${isProjectAssignment ? 'cursor-pointer' : ''}`}
                    onClick={() => isProjectAssignment && openShippingModal(assignment)}
                  >
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
                        {/* Shipping status for project assignments */}
                        {isProjectAssignment && shippingStatus && (
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 ${shippingStatus.color}`}>
                            <Truck className="w-3 h-3" />
                            {shippingStatus.label}
                          </span>
                        )}
                        {assignment.end_date && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(assignment.end_date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Tracking info if shipped */}
                    {isProjectAssignment && assignment.tracking_number && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                        <Truck className="w-4 h-4" />
                        <span>{assignment.tracking_carrier}: {assignment.tracking_number}</span>
                      </div>
                    )}

                    {/* Delivery link */}
                    {assignment.delivery_url && (
                      <div className="mt-4 flex items-center gap-2" onClick={e => e.stopPropagation()}>
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

                    {/* Click hint for project assignments */}
                    {isProjectAssignment && !assignment.tracking_number && (
                      <p className="mt-3 text-xs text-violet-500 flex items-center gap-1">
                        <Truck className="w-3 h-3" />
                        Haz clic para ver datos de envío y registrar guía
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Shipping Modal */}
      {shippingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeShippingModal}>
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-violet-50 rounded-lg flex items-center justify-center">
                  <Truck className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-[#17181A]">Datos de Envío</h2>
                  <p className="text-sm text-gray-500">{shippingModal.creator_name}</p>
                </div>
              </div>
              <button
                onClick={closeShippingModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5">
              {shippingLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
                </div>
              ) : shippingData ? (
                <div className="space-y-5">
                  {/* Copy as Label Button */}
                  <button
                    onClick={() => {
                      const label = [
                        shippingData.full_name,
                        shippingData.cedula ? `CC: ${shippingData.cedula}` : null,
                        shippingData.phone ? `Tel: ${shippingData.phone}` : null,
                        shippingData.address,
                        [shippingData.city, shippingData.department].filter(Boolean).join(', '),
                        shippingData.postal_code ? `CP: ${shippingData.postal_code}` : null,
                        shippingData.shipping_notes ? `Nota: ${shippingData.shipping_notes}` : null,
                      ].filter(Boolean).join('\n');
                      copyToClipboard(label, 'label');
                    }}
                    className="w-full py-3 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {copied === 'label' ? (
                      <>
                        <Check className="w-4 h-4" />
                        ¡Etiqueta copiada!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copiar como etiqueta
                      </>
                    )}
                  </button>

                  {/* Shipping Label Preview */}
                  <div className="bg-gray-50 rounded-xl p-4 space-y-2 font-mono text-sm">
                    <p className="font-semibold text-[#17181A]">{shippingData.full_name}</p>
                    {shippingData.cedula && (
                      <p className="text-gray-600">CC: {shippingData.cedula}</p>
                    )}
                    {shippingData.phone && (
                      <p className="text-gray-600">Tel: {shippingData.phone}</p>
                    )}
                    {shippingData.address && (
                      <p className="text-gray-700">{shippingData.address}</p>
                    )}
                    {(shippingData.city || shippingData.department) && (
                      <p className="text-gray-600">
                        {[shippingData.city, shippingData.department].filter(Boolean).join(', ')}
                      </p>
                    )}
                    {shippingData.postal_code && (
                      <p className="text-gray-600">CP: {shippingData.postal_code}</p>
                    )}
                    {shippingData.shipping_notes && (
                      <p className="text-amber-600 bg-amber-50 px-2 py-1 rounded-lg mt-2 text-xs">
                        <AlertCircle className="w-3 h-3 inline mr-1" />
                        {shippingData.shipping_notes}
                      </p>
                    )}
                    {!shippingData.address && !shippingData.phone && (
                      <p className="text-gray-400 italic">Sin datos de envío registrados</p>
                    )}
                  </div>

                  {/* Tracking Form */}
                  <div className="border-t border-gray-100 pt-5">
                    <h3 className="font-medium text-[#17181A] flex items-center gap-2 mb-4">
                      <Truck className="w-4 h-4 text-gray-400" />
                      Información de Seguimiento
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Transportadora
                        </label>
                        <select
                          value={trackingCarrier}
                          onChange={(e) => setTrackingCarrier(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        >
                          <option value="">Seleccionar...</option>
                          {CARRIERS.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Número de Guía
                        </label>
                        <input
                          type="text"
                          value={trackingNumber}
                          onChange={(e) => setTrackingNumber(e.target.value)}
                          placeholder="Ej: 1234567890"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        />
                      </div>

                      <button
                        onClick={saveShipping}
                        disabled={savingShipping}
                        className="w-full py-2.5 bg-[#17181A] text-white rounded-lg font-medium text-sm hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {savingShipping ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Guardando...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            Guardar Información de Envío
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Shipped info */}
                  {shippingData.shipped_at && (
                    <p className="text-xs text-gray-400 text-center">
                      Enviado el {new Date(shippingData.shipped_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">No se pudo cargar la información</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
