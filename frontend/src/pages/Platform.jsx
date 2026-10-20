// [modules] Panel de plataforma (LA REAL): todas las agencias, plan, estado, prueba y uso.
import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Building2, Pencil, RefreshCw, Search, X } from 'lucide-react';
import { useOrgPlan } from '../hooks/useOrgPlan';
import { platformAPI } from '../utils/orgApi';
import { PLAN_LABELS, STATUS_LABELS } from '../utils/modules';

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const fmtRelative = (v) => {
  if (!v) return 'Nunca';
  const diff = Date.now() - new Date(v).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `hace ${Math.max(1, mins)} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} días`;
};
const toDateInput = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

const statusTone = (org) => {
  if (org.trial_expired || org.status === 'canceled') return 'bg-red-50 text-red-700 border-red-200';
  if (org.status === 'trial' || org.status === 'past_due') return 'bg-amber-50 text-amber-800 border-amber-200';
  return 'bg-[#44BF47]/10 text-[#1E7A30] border-[#44BF47]/30';
};

const Usage = ({ used, limit }) => {
  const full = limit != null && used >= limit;
  return (
    <span className={full ? 'text-red-600 font-semibold' : 'text-[#121314]'}>
      {used}<span className="text-gray-400 font-normal">/{limit == null ? '∞' : limit}</span>
    </span>
  );
};

const EditModal = ({ org, plans, statuses, onClose, onSaved }) => {
  const [form, setForm] = useState({
    plan: org.plan === 'trial' ? (org.plan_selected || 'growth') : org.plan,
    plan_status: org.status,
    trial_ends_at: toDateInput(org.trial_ends_at),
    brands: org.plan_limits?.brands ?? '',
    users: org.plan_limits?.users ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        plan: form.plan,
        plan_status: form.plan_status,
        trial_ends_at: form.plan_status === 'trial' ? (form.trial_ends_at ? new Date(`${form.trial_ends_at}T23:59:59`).toISOString() : null) : null,
        plan_limits: form.brands === '' && form.users === '' ? null : { brands: form.brands === '' ? null : Number(form.brands), users: form.users === '' ? null : Number(form.users) },
      };
      await platformAPI.updateOrganizationPlan(org.id, payload);
      onSaved();
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full rounded-xl border border-[#121212]/[0.16] bg-white px-3 py-2 text-sm text-[#121314] focus:outline-none focus:ring-2 focus:ring-[#44BF47]/40';

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg shadow-xl max-h-[92dvh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#121212]/[0.09]">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Agencia</p>
            <h2 className="text-lg font-semibold text-[#121314] tracking-tight">{org.name}</h2>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-[#121314] hover:bg-[#121212]/[0.04]" aria-label="Cerrar"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-gray-500">Plan</span>
              <select className={`${field} mt-1`} value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
                {plans.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-500">Estado</span>
              <select className={`${field} mt-1`} value={form.plan_status} onChange={(e) => setForm({ ...form, plan_status: e.target.value })}>
                {statuses.map((s) => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
              </select>
            </label>
          </div>
          {form.plan_status === 'trial' && (
            <label className="block">
              <span className="text-xs font-semibold text-gray-500">Fin de la prueba</span>
              <input type="date" className={`${field} mt-1`} value={form.trial_ends_at} onChange={(e) => setForm({ ...form, trial_ends_at: e.target.value })} />
              <span className="text-[11px] text-gray-400">Vacío = sin fecha (no se bloquea).</span>
            </label>
          )}
          <div>
            <p className="text-xs font-semibold text-gray-500">Límites manuales <span className="font-normal text-gray-400">(vacío = los del plan)</span></p>
            <div className="grid grid-cols-2 gap-3 mt-1">
              <input type="number" min="0" placeholder={`Marcas (plan: ${org.limits?.brands ?? '∞'})`} className={field} value={form.brands} onChange={(e) => setForm({ ...form, brands: e.target.value })} />
              <input type="number" min="0" placeholder={`Usuarios (plan: ${org.limits?.users ?? '∞'})`} className={field} value={form.users} onChange={(e) => setForm({ ...form, users: e.target.value })} />
            </div>
          </div>
          {org.plan_selected && org.status === 'trial' && (
            <p className="text-xs rounded-xl bg-[#44BF47]/10 text-[#1E7A30] px-3 py-2">
              Solicitó el plan <strong>{PLAN_LABELS[org.plan_selected] || org.plan_selected}</strong> {org.plan_requested_at ? `el ${fmtDate(org.plan_requested_at)}` : ''}. Para activarlo: plan = {PLAN_LABELS[org.plan_selected]}, estado = Activo.
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#121212]/[0.09]">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-[#121212]/[0.04]">Cancelar</button>
          <button type="submit" disabled={saving} className="rounded-full bg-[#121314] text-white px-5 py-2 text-sm font-semibold hover:bg-[#1C1D1F] disabled:opacity-60">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
};

const Platform = () => {
  const { isPlatformAdmin, loaded } = useOrgPlan();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await platformAPI.listOrganizations();
      setData(res.data);
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudo cargar el panel.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const orgs = useMemo(() => {
    const list = data?.organizations || [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((o) => [o.name, o.slug, o.admin_email].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [data, query]);

  const totals = useMemo(() => {
    const list = data?.organizations || [];
    return {
      total: list.length,
      trial: list.filter((o) => o.status === 'trial' && !o.trial_expired).length,
      active: list.filter((o) => o.status === 'active').length,
      requested: list.filter((o) => o.plan_selected && o.status === 'trial').length,
    };
  }, [data]);

  if (loaded && !isPlatformAdmin) return <Navigate to="/app" replace />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#121314] tracking-tight">Plataforma</h1>
          <p className="text-sm text-gray-500 mt-0.5">Agencias en Orbit: plan, estado, prueba y uso. Solo LA REAL ve esto.</p>
        </div>
        <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-full border border-[#121212]/[0.16] text-sm font-semibold text-[#121314] px-4 py-2 hover:bg-[#121212]/[0.04]">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Agencias', totals.total],
          ['En prueba', totals.trial],
          ['Activas', totals.active],
          ['Solicitudes de plan', totals.requested],
        ].map(([label, value]) => (
          <div key={label} className="glass-card p-4">
            <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">{label}</p>
            <p className="text-2xl font-semibold text-[#121314] tracking-tight mt-1">{value}</p>
          </div>
        ))}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 border-b border-[#121212]/[0.09] flex items-center gap-2">
          <Search size={16} className="text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar agencia, slug o email…"
            className="flex-1 bg-transparent text-sm text-[#121314] placeholder:text-gray-400 focus:outline-none"
          />
        </div>
        {error && <div className="px-4 py-3 text-sm text-red-700 bg-red-50">{error}</div>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3 font-semibold">Agencia</th>
                <th className="px-4 py-3 font-semibold">Plan</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Prueba</th>
                <th className="px-4 py-3 font-semibold">Marcas</th>
                <th className="px-4 py-3 font-semibold">Usuarios</th>
                <th className="px-4 py-3 font-semibold">Tiendas</th>
                <th className="px-4 py-3 font-semibold">Creada</th>
                <th className="px-4 py-3 font-semibold">Último acceso</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#121212]/[0.06]">
              {orgs.map((o) => (
                <tr key={o.id} className="glass-row-hover">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 min-w-[180px]">
                      {o.logo_url ? (
                        <img src={o.logo_url} alt="" className="w-8 h-8 rounded-lg object-contain bg-white border border-[#121212]/[0.09]" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-[#121314] flex items-center justify-center"><Building2 size={14} className="text-[#44BF47]" /></div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-[#121314] truncate">{o.name} <span className="text-gray-400 font-normal">#{o.id}</span></p>
                        <p className="text-xs text-gray-500 truncate">{o.admin_email || o.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#121314]">{o.plan_name}</p>
                    {o.plan_selected && o.status === 'trial' && (
                      <p className="text-[11px] text-[#1E7A30] font-semibold">Pidió {PLAN_LABELS[o.plan_selected] || o.plan_selected}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex text-[11px] font-semibold border rounded-full px-2 py-0.5 ${statusTone(o)}`}>
                      {o.trial_expired ? 'Prueba vencida' : STATUS_LABELS[o.status] || o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {o.status === 'trial'
                      ? (o.days_left == null ? 'Sin fecha' : o.trial_expired ? `Venció ${fmtDate(o.trial_ends_at)}` : `${o.days_left} ${o.days_left === 1 ? 'día' : 'días'}`)
                      : '—'}
                  </td>
                  <td className="px-4 py-3"><Usage used={o.usage.brands} limit={o.limits.brands} /></td>
                  <td className="px-4 py-3"><Usage used={o.usage.users} limit={o.limits.users} /></td>
                  <td className="px-4 py-3 text-[#121314]">{o.usage.stores}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(o.created_at)}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap" title={o.last_access_at || ''}>{fmtRelative(o.last_access_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => setEditing(o)} className="inline-flex items-center gap-1 rounded-full border border-[#121212]/[0.16] px-3 py-1.5 text-xs font-semibold text-[#121314] hover:bg-[#121212]/[0.04]">
                      <Pencil size={12} /> Plan
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && !orgs.length && (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-gray-500">No hay agencias que coincidan.</td></tr>
              )}
              {loading && !data && (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-gray-500">Cargando…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <EditModal
          org={editing}
          plans={data?.catalog?.plans || []}
          statuses={data?.statuses || ['trial', 'active', 'past_due', 'canceled']}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
            window.dispatchEvent(new CustomEvent('orbit:plan-changed'));
          }}
        />
      )}
    </div>
  );
};

export default Platform;
