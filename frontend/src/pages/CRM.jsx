import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext, closestCorners, PointerSensor, useSensor, useSensors,
  DragOverlay, useDroppable
} from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus, Search, Target, DollarSign, User, Building2, Phone, Mail,
  Loader2, X, GripVertical, Calendar, Filter
} from 'lucide-react';
import { crmAPI, teamAPI } from '../utils/api';

// ========================================
// DEAL CARD (Draggable)
// ========================================
function DealCard({ deal, onClick }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging
  } = useSortable({ id: `deal-${deal.id}`, data: { deal } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const daysSinceUpdate = Math.floor(
    (Date.now() - new Date(deal.updated_at || deal.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  const formatValue = (value) => {
    if (!value) return '';
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white rounded-xl border border-gray-100 p-3.5 cursor-pointer hover:shadow-md transition-shadow group"
      onClick={() => onClick(deal)}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-sm font-semibold text-[#1A1A2E] line-clamp-2 flex-1">{deal.name}</h4>
        <div
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing ml-1"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-4 h-4 text-gray-400" />
        </div>
      </div>

      {deal.company && (
        <p className="text-xs text-gray-500 flex items-center gap-1 mb-1.5">
          <Building2 className="w-3 h-3" /> {deal.company}
        </p>
      )}

      <div className="flex items-center justify-between mt-2">
        {deal.estimated_value > 0 && (
          <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
            {formatValue(deal.estimated_value)}
          </span>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {daysSinceUpdate > 0 && (
            <span className={`text-xs ${daysSinceUpdate > 7 ? 'text-red-500' : 'text-gray-400'}`}>
              {daysSinceUpdate}d
            </span>
          )}
          {deal.assigned_to_name && (
            <div className="w-6 h-6 rounded-full bg-[#1A1A2E] text-[#BFFF00] flex items-center justify-center text-[10px] font-bold">
              {deal.assigned_to_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ========================================
// DEAL CARD OVERLAY (for drag preview)
// ========================================
function DealCardOverlay({ deal }) {
  const formatValue = (value) => {
    if (!value) return '';
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
  };

  return (
    <div className="bg-white rounded-xl border-2 border-[#BFFF00] shadow-lg p-3.5 w-[240px]">
      <h4 className="text-sm font-semibold text-[#1A1A2E] line-clamp-2">{deal.name}</h4>
      {deal.company && <p className="text-xs text-gray-500 mt-1">{deal.company}</p>}
      {deal.estimated_value > 0 && (
        <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full mt-2 inline-block">
          {formatValue(deal.estimated_value)}
        </span>
      )}
    </div>
  );
}

// ========================================
// STAGE COLUMN (Droppable)
// ========================================
function StageColumn({ stage, deals, onDealClick }) {
  const { setNodeRef, isOver } = useDroppable({ id: `stage-${stage.id}` });

  const totalValue = deals.reduce((sum, d) => sum + (d.estimated_value || 0), 0);
  const formatValue = (value) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return value > 0 ? `$${value}` : '';
  };

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-[260px] flex flex-col max-h-full rounded-2xl transition-colors ${
        isOver ? 'bg-[#BFFF00]/10' : 'bg-gray-50/80'
      }`}
    >
      {/* Column Header */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
            <h3 className="text-sm font-semibold text-[#1A1A2E]">{stage.name}</h3>
            <span className="text-xs text-gray-400 bg-white px-1.5 py-0.5 rounded-full">{deals.length}</span>
          </div>
        </div>
        {totalValue > 0 && (
          <p className="text-xs text-gray-500 ml-4.5">{formatValue(totalValue)}</p>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2 min-h-[100px]">
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} onClick={onDealClick} />
        ))}
      </div>

      {/* Footer with total */}
      {totalValue > 0 && (
        <div className="px-3 py-2.5 border-t border-gray-200/60">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Total</span>
            <span className="text-xs font-bold text-[#1A1A2E]">
              {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(totalValue)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ========================================
// MAIN CRM PAGE
// ========================================
export default function CRM() {
  const navigate = useNavigate();
  const [stages, setStages] = useState([]);
  const [deals, setDeals] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeDeal, setActiveDeal] = useState(null);
  const [showNewDeal, setShowNewDeal] = useState(false);
  const [newDeal, setNewDeal] = useState({
    name: '', client_name: '', email: '', phone: '', company: '', source: '',
    estimated_value: '', notes: '', assigned_to: ''
  });
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [stagesRes, dealsRes, teamRes] = await Promise.all([
        crmAPI.getStages(),
        crmAPI.getDeals({ search: search || undefined }),
        teamAPI.getAll().catch(() => ({ data: [] })),
      ]);
      setStages(stagesRes.data);
      setDeals(dealsRes.data);
      setTeamMembers(teamRes.data || []);
    } catch (error) {
      console.error('Error loading CRM:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        crmAPI.getDeals({ search: search || undefined })
          .then(res => setDeals(res.data))
          .catch(() => {});
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [search]);

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) return;

    const deal = active.data.current?.deal;
    if (!deal) return;

    // Get target stage from droppable ID
    const overId = over.id.toString();
    let targetStageId;

    if (overId.startsWith('stage-')) {
      targetStageId = parseInt(overId.replace('stage-', ''));
    } else if (overId.startsWith('deal-')) {
      // Dropped on another deal — get its stage
      const targetDeal = deals.find(d => `deal-${d.id}` === overId);
      targetStageId = targetDeal?.stage_id;
    }

    if (!targetStageId || targetStageId === deal.stage_id) return;

    // Optimistic update
    setDeals(prev => prev.map(d =>
      d.id === deal.id ? { ...d, stage_id: targetStageId } : d
    ));

    try {
      await crmAPI.moveDeal(deal.id, targetStageId);
    } catch (error) {
      // Revert on error
      setDeals(prev => prev.map(d =>
        d.id === deal.id ? { ...d, stage_id: deal.stage_id } : d
      ));
    }

    setActiveDeal(null);
  };

  const handleDragStart = (event) => {
    setActiveDeal(event.active.data.current?.deal);
  };

  const handleCreateDeal = async (e) => {
    e.preventDefault();
    if (!newDeal.name) return;

    setSaving(true);
    try {
      await crmAPI.createDeal({
        ...newDeal,
        estimated_value: newDeal.estimated_value ? parseFloat(newDeal.estimated_value) : 0,
        assigned_to: newDeal.assigned_to || null,
      });
      setShowNewDeal(false);
      setNewDeal({ name: '', client_name: '', email: '', phone: '', company: '', source: '', estimated_value: '', notes: '', assigned_to: '' });
      loadData();
    } catch (error) {
      console.error('Error creating deal:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDealClick = (deal) => {
    navigate(`/app/crm/${deal.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  // Group deals by stage
  const dealsByStage = {};
  stages.forEach(s => { dealsByStage[s.id] = []; });
  deals.forEach(d => {
    if (dealsByStage[d.stage_id]) {
      dealsByStage[d.stage_id].push(d);
    }
  });

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-semibold text-[#1A1A2E] tracking-tight flex items-center gap-2">
            <Target className="w-6 h-6" /> CRM
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Pipeline de ventas</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar deals..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#BFFF00] w-[200px]"
            />
          </div>
          <button
            onClick={() => setShowNewDeal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1A1A2E] text-white rounded-xl text-sm font-medium hover:bg-[#252542] transition-colors"
          >
            <Plus className="w-4 h-4" /> Nuevo Deal
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-x-auto pb-4">
          <div className="flex gap-3 min-h-[500px]" style={{ minWidth: `${stages.length * 276}px` }}>
            {stages.map((stage) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                deals={dealsByStage[stage.id] || []}
                onDealClick={handleDealClick}
              />
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeDeal ? <DealCardOverlay deal={activeDeal} /> : null}
        </DragOverlay>
      </DndContext>

      {/* New Deal Modal */}
      {showNewDeal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNewDeal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-[#1A1A2E]">Nuevo Deal</h2>
              <button onClick={() => setShowNewDeal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleCreateDeal} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Nombre del deal *</label>
                <input
                  type="text"
                  value={newDeal.name}
                  onChange={(e) => setNewDeal({ ...newDeal, name: e.target.value })}
                  placeholder="Ej: Tienda Shopify - Marca XYZ"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#BFFF00]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Nombre contacto</label>
                  <input
                    type="text"
                    value={newDeal.client_name}
                    onChange={(e) => setNewDeal({ ...newDeal, client_name: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#BFFF00]"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Empresa</label>
                  <input
                    type="text"
                    value={newDeal.company}
                    onChange={(e) => setNewDeal({ ...newDeal, company: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#BFFF00]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Email</label>
                  <input
                    type="email"
                    value={newDeal.email}
                    onChange={(e) => setNewDeal({ ...newDeal, email: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#BFFF00]"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Teléfono</label>
                  <input
                    type="tel"
                    value={newDeal.phone}
                    onChange={(e) => setNewDeal({ ...newDeal, phone: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#BFFF00]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Valor estimado (COP)</label>
                  <input
                    type="number"
                    value={newDeal.estimated_value}
                    onChange={(e) => setNewDeal({ ...newDeal, estimated_value: e.target.value })}
                    placeholder="0"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#BFFF00]"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Fuente</label>
                  <select
                    value={newDeal.source}
                    onChange={(e) => setNewDeal({ ...newDeal, source: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#BFFF00]"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="referido">Referido</option>
                    <option value="instagram">Instagram</option>
                    <option value="web">Sitio web</option>
                    <option value="cold_outreach">Cold outreach</option>
                    <option value="evento">Evento</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Asignar a</label>
                <select
                  value={newDeal.assigned_to}
                  onChange={(e) => setNewDeal({ ...newDeal, assigned_to: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#BFFF00]"
                >
                  <option value="">Sin asignar</option>
                  {teamMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Notas</label>
                <textarea
                  value={newDeal.notes}
                  onChange={(e) => setNewDeal({ ...newDeal, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#BFFF00] resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewDeal(false)}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2.5 bg-[#1A1A2E] text-white rounded-xl text-sm font-medium hover:bg-[#252542] transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crear Deal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
