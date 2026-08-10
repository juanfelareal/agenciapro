import { useState, useEffect, useMemo } from 'react';
import { Mail, BarChart3, Users, Loader2, Save, ChevronDown, ChevronRight } from 'lucide-react';
import { clientMetricsAPI } from '../utils/api';

// Month names in Spanish
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// Collapsible section component (inline version)
function Section({ id, title, icon: Icon, iconBg, iconColor, defaultOpen = true, children }) {
  const storageKey = `email-metrics-${id}`;
  const [open, setOpen] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved === null ? defaultOpen : saved === 'true';
  });

  const toggle = () => {
    const next = !open;
    setOpen(next);
    localStorage.setItem(storageKey, String(next));
  };

  return (
    <div className="border border-gray-200 rounded-xl mb-4 overflow-hidden">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>
            <Icon className={`w-4 h-4 ${iconColor}`} />
          </div>
          <span className="font-semibold text-[#17181A]">{title}</span>
        </div>
        {open ? (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </button>
      {open && <div className="p-5 bg-white">{children}</div>}
    </div>
  );
}

// Input field component
function MetricInput({ label, value, onChange, prefix, suffix, type = 'number', disabled = false }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{prefix}</span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
          disabled={disabled}
          className={`
            w-full border border-gray-200 rounded-lg py-2 text-sm
            ${prefix ? 'pl-7' : 'pl-3'} ${suffix ? 'pr-8' : 'pr-3'}
            focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent
            ${disabled ? 'bg-gray-50 text-gray-400' : 'bg-white'}
          `}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{suffix}</span>
        )}
      </div>
    </div>
  );
}

// Calculated metric display
function CalculatedMetric({ label, value, suffix = '%' }) {
  const displayValue = value === null || isNaN(value) ? '—' : value.toFixed(1);
  return (
    <div className="bg-gray-50 rounded-lg px-4 py-2 text-center">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-lg font-semibold text-[#17181A]">
        {displayValue}{value !== null && !isNaN(value) ? suffix : ''}
      </div>
    </div>
  );
}

export default function EmailMarketingForm({ clientId }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-indexed
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Form data
  const [data, setData] = useState({
    // Campaigns
    campaigns_revenue: 0,
    campaigns_avg_ticket: 0,
    campaigns_deliveries: 0,
    campaigns_opens: 0,
    campaigns_clicks: 0,
    campaigns_conversions: 0,
    campaigns_bounces: 0,
    // Flows
    flows_revenue: 0,
    flows_avg_ticket: 0,
    flows_deliveries: 0,
    flows_opens: 0,
    flows_clicks: 0,
    flows_conversions: 0,
    flows_bounces: 0,
    // List Growth
    master_segment_size: 0,
    monthly_subscriptions: 0,
    monthly_unsubscribes: 0,
    popup_subscriptions: 0,
    popup_views: 0,
  });

  // Calculated metrics
  const calculated = useMemo(() => {
    const calc = (num, denom) => denom > 0 ? (num / denom) * 100 : null;
    return {
      // Campaigns
      campaigns_open_rate: calc(data.campaigns_opens, data.campaigns_deliveries),
      campaigns_ctr: calc(data.campaigns_clicks, data.campaigns_opens),
      campaigns_conv_rate: calc(data.campaigns_conversions, data.campaigns_deliveries),
      campaigns_bounce_rate: calc(data.campaigns_bounces, data.campaigns_deliveries),
      // Flows
      flows_open_rate: calc(data.flows_opens, data.flows_deliveries),
      flows_ctr: calc(data.flows_clicks, data.flows_opens),
      flows_conv_rate: calc(data.flows_conversions, data.flows_deliveries),
      flows_bounce_rate: calc(data.flows_bounces, data.flows_deliveries),
      // List Growth
      unsubscribe_rate: calc(data.monthly_unsubscribes, data.master_segment_size),
      popup_conv_rate: calc(data.popup_subscriptions, data.popup_views),
    };
  }, [data]);

  // Load data when month/year changes
  useEffect(() => {
    loadData();
  }, [clientId, year, month]);

  const loadData = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await clientMetricsAPI.getEmailMonthly(clientId, year, month);
      if (response.data) {
        setData({
          campaigns_revenue: response.data.campaigns_revenue || 0,
          campaigns_avg_ticket: response.data.campaigns_avg_ticket || 0,
          campaigns_deliveries: response.data.campaigns_deliveries || 0,
          campaigns_opens: response.data.campaigns_opens || 0,
          campaigns_clicks: response.data.campaigns_clicks || 0,
          campaigns_conversions: response.data.campaigns_conversions || 0,
          campaigns_bounces: response.data.campaigns_bounces || 0,
          flows_revenue: response.data.flows_revenue || 0,
          flows_avg_ticket: response.data.flows_avg_ticket || 0,
          flows_deliveries: response.data.flows_deliveries || 0,
          flows_opens: response.data.flows_opens || 0,
          flows_clicks: response.data.flows_clicks || 0,
          flows_conversions: response.data.flows_conversions || 0,
          flows_bounces: response.data.flows_bounces || 0,
          master_segment_size: response.data.master_segment_size || 0,
          monthly_subscriptions: response.data.monthly_subscriptions || 0,
          monthly_unsubscribes: response.data.monthly_unsubscribes || 0,
          popup_subscriptions: response.data.popup_subscriptions || 0,
          popup_views: response.data.popup_views || 0,
        });
      } else {
        // Reset to empty state for new month
        setData({
          campaigns_revenue: 0, campaigns_avg_ticket: 0, campaigns_deliveries: 0,
          campaigns_opens: 0, campaigns_clicks: 0, campaigns_conversions: 0, campaigns_bounces: 0,
          flows_revenue: 0, flows_avg_ticket: 0, flows_deliveries: 0,
          flows_opens: 0, flows_clicks: 0, flows_conversions: 0, flows_bounces: 0,
          master_segment_size: 0, monthly_subscriptions: 0, monthly_unsubscribes: 0,
          popup_subscriptions: 0, popup_views: 0,
        });
      }
    } catch (error) {
      console.error('Error loading email metrics:', error);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await clientMetricsAPI.saveEmailMonthly(clientId, {
        year,
        month,
        ...data
      });
      setMessage({ type: 'success', text: 'Guardado correctamente' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving email metrics:', error);
      setMessage({ type: 'error', text: 'Error al guardar' });
    }
    setSaving(false);
  };

  const updateField = (field) => (value) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  // Year options (current year and 2 years back)
  const yearOptions = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  // Don't allow future months
  const maxMonth = year === now.getFullYear() ? now.getMonth() + 1 : 12;

  return (
    <div className="glass rounded-xl p-6 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-pink-100 flex items-center justify-center">
            <Mail className="w-4 h-4 text-pink-600" />
          </div>
          <h2 className="text-lg font-semibold text-[#17181A]">Email Marketing</h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Month selector */}
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-500"
          >
            {MONTHS.slice(0, maxMonth).map((name, idx) => (
              <option key={idx} value={idx + 1}>{name}</option>
            ))}
          </select>

          {/* Year selector */}
          <select
            value={year}
            onChange={(e) => {
              const newYear = parseInt(e.target.value);
              setYear(newYear);
              // Adjust month if needed
              if (newYear === now.getFullYear() && month > now.getMonth() + 1) {
                setMonth(now.getMonth() + 1);
              }
            }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-500"
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-2 bg-[#17181A] text-[#BFFF00] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#2a2b2e] disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-300 mx-auto" />
        </div>
      ) : (
        <>
          {/* Email Campaigns Section */}
          <Section
            id="campaigns"
            title="Email Campaigns"
            icon={Mail}
            iconBg="bg-purple-100"
            iconColor="text-purple-600"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <MetricInput
                label="Revenue"
                value={data.campaigns_revenue}
                onChange={updateField('campaigns_revenue')}
                prefix="$"
              />
              <MetricInput
                label="Ticket Promedio"
                value={data.campaigns_avg_ticket}
                onChange={updateField('campaigns_avg_ticket')}
                prefix="$"
              />
              <MetricInput
                label="Deliveries"
                value={data.campaigns_deliveries}
                onChange={updateField('campaigns_deliveries')}
              />
              <MetricInput
                label="Opens"
                value={data.campaigns_opens}
                onChange={updateField('campaigns_opens')}
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              <MetricInput
                label="Clicks"
                value={data.campaigns_clicks}
                onChange={updateField('campaigns_clicks')}
              />
              <MetricInput
                label="Conversions"
                value={data.campaigns_conversions}
                onChange={updateField('campaigns_conversions')}
              />
              <MetricInput
                label="Bounces"
                value={data.campaigns_bounces}
                onChange={updateField('campaigns_bounces')}
              />
            </div>
            <div className="border-t border-gray-100 pt-4">
              <div className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Calculadas</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <CalculatedMetric label="Open Rate" value={calculated.campaigns_open_rate} />
                <CalculatedMetric label="CTR" value={calculated.campaigns_ctr} />
                <CalculatedMetric label="Conv. Rate" value={calculated.campaigns_conv_rate} />
                <CalculatedMetric label="Bounce Rate" value={calculated.campaigns_bounce_rate} />
              </div>
            </div>
          </Section>

          {/* Email Flows Section */}
          <Section
            id="flows"
            title="Email Flows"
            icon={BarChart3}
            iconBg="bg-teal-100"
            iconColor="text-teal-600"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <MetricInput
                label="Revenue"
                value={data.flows_revenue}
                onChange={updateField('flows_revenue')}
                prefix="$"
              />
              <MetricInput
                label="Ticket Promedio"
                value={data.flows_avg_ticket}
                onChange={updateField('flows_avg_ticket')}
                prefix="$"
              />
              <MetricInput
                label="Deliveries"
                value={data.flows_deliveries}
                onChange={updateField('flows_deliveries')}
              />
              <MetricInput
                label="Opens"
                value={data.flows_opens}
                onChange={updateField('flows_opens')}
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              <MetricInput
                label="Clicks"
                value={data.flows_clicks}
                onChange={updateField('flows_clicks')}
              />
              <MetricInput
                label="Conversions"
                value={data.flows_conversions}
                onChange={updateField('flows_conversions')}
              />
              <MetricInput
                label="Bounces"
                value={data.flows_bounces}
                onChange={updateField('flows_bounces')}
              />
            </div>
            <div className="border-t border-gray-100 pt-4">
              <div className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Calculadas</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <CalculatedMetric label="Open Rate" value={calculated.flows_open_rate} />
                <CalculatedMetric label="CTR" value={calculated.flows_ctr} />
                <CalculatedMetric label="Conv. Rate" value={calculated.flows_conv_rate} />
                <CalculatedMetric label="Bounce Rate" value={calculated.flows_bounce_rate} />
              </div>
            </div>
          </Section>

          {/* List Growth Section */}
          <Section
            id="list-growth"
            title="Conversions & List Growth"
            icon={Users}
            iconBg="bg-emerald-100"
            iconColor="text-emerald-600"
          >
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              <MetricInput
                label="Master Segment"
                value={data.master_segment_size}
                onChange={updateField('master_segment_size')}
              />
              <MetricInput
                label="Suscripciones del Mes"
                value={data.monthly_subscriptions}
                onChange={updateField('monthly_subscriptions')}
              />
              <MetricInput
                label="Bajas del Mes"
                value={data.monthly_unsubscribes}
                onChange={updateField('monthly_unsubscribes')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <MetricInput
                label="Popup Suscripciones"
                value={data.popup_subscriptions}
                onChange={updateField('popup_subscriptions')}
              />
              <MetricInput
                label="Popup Views"
                value={data.popup_views}
                onChange={updateField('popup_views')}
              />
            </div>
            <div className="border-t border-gray-100 pt-4">
              <div className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Calculadas</div>
              <div className="grid grid-cols-2 gap-3">
                <CalculatedMetric label="Unsubscribe Rate" value={calculated.unsubscribe_rate} />
                <CalculatedMetric label="Popup Conv. Rate" value={calculated.popup_conv_rate} />
              </div>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
