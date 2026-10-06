// Utilidades compartidas del módulo Cartera

export const AGING_BUCKETS = ['0-30', '31-60', '61-90', '90+'];

// Filtros por defecto de la vista "Por factura"
export const EMPTY_INVOICE_FILTERS = { bucket: '', client_id: '', search: '', month: '' };

export const BUCKET_STYLES = {
  '0-30': { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', text: 'text-emerald-700', bar: 'bg-emerald-400', label: '0-30 días' },
  '31-60': { badge: 'bg-yellow-50 text-yellow-700 border-yellow-200', text: 'text-yellow-700', bar: 'bg-yellow-400', label: '31-60 días' },
  '61-90': { badge: 'bg-orange-50 text-orange-700 border-orange-200', text: 'text-orange-700', bar: 'bg-orange-400', label: '61-90 días' },
  '90+': { badge: 'bg-red-50 text-red-700 border-red-200', text: 'text-red-700', bar: 'bg-red-500', label: '90+ días' },
};

export const COLLECTION_STATUSES = [
  { value: 'pending', label: 'Sin gestión', className: 'bg-gray-100 text-gray-600' },
  { value: 'contacted', label: 'Contactado', className: 'bg-blue-50 text-blue-700' },
  { value: 'promised', label: 'Promesa de pago', className: 'bg-emerald-50 text-emerald-700' },
  { value: 'disputed', label: 'En disputa', className: 'bg-red-50 text-red-700' },
];

export const statusMeta = (value) => COLLECTION_STATUSES.find((s) => s.value === value) || COLLECTION_STATUSES[0];

export const bucketFor = (days) => {
  if (days === null || days === undefined) return null;
  const d = Number(days);
  if (d <= 30) return '0-30';
  if (d <= 60) return '31-60';
  if (d <= 90) return '61-90';
  return '90+';
};

export const formatCurrency = (amount) => `$${Math.round(Number(amount || 0)).toLocaleString('es-CO')}`;

// Formato compacto para tarjetas: $1,2M / $850K
export const formatCompact = (amount) => {
  const n = Number(amount || 0);
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toLocaleString('es-CO', { maximumFractionDigits: 1 })}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000).toLocaleString('es-CO')}K`;
  return formatCurrency(n);
};

export const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateShort = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
};

export const formatDateTime = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// 'YYYY-MM' -> 'oct 2026'
export const formatMonth = (ym) => {
  if (!ym) return '-';
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' });
};

export const daysLabel = (days) => {
  if (days === null || days === undefined) return '-';
  const d = Number(days);
  if (d <= 0) return 'Hoy';
  if (d === 1) return '1 día';
  return `${d} días`;
};

export const todayStr = () => new Date().toISOString().split('T')[0];
