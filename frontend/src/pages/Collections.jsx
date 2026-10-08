import { useCallback, useEffect, useState } from 'react';
import { collectionsAPI } from '../utils/api';
import {
  Send, Clock, CheckCircle, ChevronLeft, X, Calendar, Eye, RefreshCw, StickyNote, Users, FileText, CalendarDays, Mail, MessageCircle,
} from 'lucide-react';
import AgingStats from '../components/collections/AgingStats';
import ClientsView from '../components/collections/ClientsView';
import InvoicesView from '../components/collections/InvoicesView';
import MonthlyView from '../components/collections/MonthlyView';
import BulkSendModal from '../components/collections/BulkSendModal';
import {
  BUCKET_STYLES, COLLECTION_STATUSES, EMPTY_INVOICE_FILTERS, formatCurrency, formatDate, formatDateTime, daysLabel, todayStr,
} from '../components/collections/collectionsUtils';

const TABS = [
  { id: 'clients', label: 'Por cliente', icon: Users },
  { id: 'invoices', label: 'Por factura', icon: FileText },
  { id: 'months', label: 'Por mes', icon: CalendarDays },
];

const Collections = () => {
  const [summary, setSummary] = useState({ clients: [], stats: {}, recentlyPaid: [] });
  const [invoices, setInvoices] = useState([]);
  const [byMonth, setByMonth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [loadingByMonth, setLoadingByMonth] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);
  const [notice, setNotice] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientDetail, setClientDetail] = useState(null);
  const [clientNotes, setClientNotes] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Pestañas y filtros de la vista "Por factura"
  const [activeTab, setActiveTab] = useState('clients');
  const [invoiceFilters, setInvoiceFilters] = useState({ ...EMPTY_INVOICE_FILTERS });
  const [savingInvoiceId, setSavingInvoiceId] = useState(null);

  // Send reminder modal
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderStep, setReminderStep] = useState('edit'); // edit | preview
  const [reminderData, setReminderData] = useState({ email_to: '', subject: '', custom_message: '' });
  const [reminderInvoiceIds, setReminderInvoiceIds] = useState(null); // null = todas las facturas del cliente
  const [reminderInvoiceLabel, setReminderInvoiceLabel] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [reminderResult, setReminderResult] = useState(null);
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  // Canal del recordatorio: correo (default) o WhatsApp vía Kapso
  const [channel, setChannel] = useState('email');
  const [waPhone, setWaPhone] = useState('');
  const [waText, setWaText] = useState('');
  const [waInfo, setWaInfo] = useState(null); // { configured, template_available, template_name, phone_formatted }
  const [waLoading, setWaLoading] = useState(false);

  // Bulk send modal
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Note modal
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteData, setNoteData] = useState({ note: '', follow_up_date: '' });

  // Mark paid modal
  const [markPaidInvoice, setMarkPaidInvoice] = useState(null);
  const [paidDate, setPaidDate] = useState(todayStr());

  // Reminder history
  const [showHistory, setShowHistory] = useState(false);
  const [reminderHistory, setReminderHistory] = useState([]);

  // Scheduled reminders
  const [showScheduled, setShowScheduled] = useState(false);
  const [scheduledList, setScheduledList] = useState([]);
  const [processingScheduled, setProcessingScheduled] = useState(false);

  // View mode
  const [view, setView] = useState('overview'); // overview | detail

  const showNotice = (type, text) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 6000);
  };

  const loadInvoices = useCallback(async () => {
    try {
      setLoadingInvoices(true);
      const res = await collectionsAPI.getInvoices({ status: 'open' });
      setInvoices(res.data || []);
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoadingInvoices(false);
    }
  }, []);

  const loadByMonth = useCallback(async () => {
    try {
      setLoadingByMonth(true);
      const res = await collectionsAPI.getByMonth();
      setByMonth(res.data);
    } catch (error) {
      console.error('Error loading by-month:', error);
    } finally {
      setLoadingByMonth(false);
    }
  }, []);

  // Recarga resumen + facturas + meses. Se mantiene el nombre loadSummary porque lo usa el flujo de Siigo.
  const loadSummary = useCallback(async (initial = false) => {
    try {
      if (initial) setLoading(true);
      const [summaryRes] = await Promise.all([
        collectionsAPI.getSummary(),
        loadInvoices(),
        loadByMonth(),
      ]);
      setSummary(summaryRes.data);
    } catch (error) {
      console.error('Error loading collections:', error);
    } finally {
      if (initial) setLoading(false);
    }
  }, [loadInvoices, loadByMonth]);

  useEffect(() => {
    loadSummary(true);
  }, [loadSummary]);

  // Sincroniza con Siigo (facturas nuevas + marcar pagadas las de saldo 0) y recarga la cartera
  const syncWithSiigo = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      await collectionsAPI.syncSiigo({ days: 30 });
      // Corre en segundo plano: consultamos el avance cada 3 s
      let st = { status: 'running' };
      while (st.status === 'running') {
        await new Promise((r) => setTimeout(r, 3000));
        st = (await collectionsAPI.syncSiigoStatus()).data;
        if (st.status === 'running' && st.progress?.total) {
          setSyncMsg({ type: 'info', text: `Revisando saldos en Siigo… ${st.progress.done}/${st.progress.total} facturas (${st.progress.markedPaid} ya pagadas)` });
        }
      }
      setSyncMsg({ type: st.status === 'done' ? 'success' : 'error', text: st.message });
      await loadSummary();
    } catch (error) {
      setSyncMsg({ type: 'error', text: error.response?.data?.error || 'No se pudo sincronizar con Siigo' });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 12000);
    }
  };

  const loadClientDetail = async (clientId) => {
    try {
      setLoadingDetail(true);
      const [detailRes, notesRes] = await Promise.all([
        collectionsAPI.getClientDetail(clientId),
        collectionsAPI.getNotes(clientId),
      ]);
      setClientDetail(detailRes.data);
      setClientNotes(notesRes.data);
      setView('detail');
    } catch (error) {
      console.error('Error loading client detail:', error);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Edición inline de promesa de pago / estado de cobro / vencimiento (optimista)
  const updateInvoiceField = async (inv, patch) => {
    const apply = (list) => list.map((i) => (i.id === inv.id ? { ...i, ...patch } : i));
    setInvoices((prev) => apply(prev));
    if (clientDetail) setClientDetail((prev) => (prev ? { ...prev, invoices: apply(prev.invoices) } : prev));
    try {
      setSavingInvoiceId(inv.id);
      const res = await collectionsAPI.updateInvoice(inv.id, patch);
      const saved = res.data || {};
      const merge = (list) => list.map((i) => (i.id === inv.id ? { ...i, promise_date: saved.promise_date, collection_status: saved.collection_status, due_date: saved.due_date ?? i.due_date } : i));
      setInvoices((prev) => merge(prev));
      if (clientDetail) setClientDetail((prev) => (prev ? { ...prev, invoices: merge(prev.invoices) } : prev));
      // Afecta "Esperado este mes", la proyección y el estado por cliente
      const summaryRes = await collectionsAPI.getSummary();
      setSummary(summaryRes.data);
      loadByMonth();
    } catch (error) {
      showNotice('error', error.response?.data?.error || 'No se pudo guardar el cambio');
      loadInvoices();
      if (clientDetail) loadClientDetail(clientDetail.client.id);
    } finally {
      setSavingInvoiceId(null);
    }
  };

  const messageTemplates = [
    {
      id: 'cordial',
      label: 'Cordial',
      description: 'Tono amable y profesional',
      message: 'Esperamos que se encuentren bien. Les enviamos el estado de cuenta actualizado. Les agradecemos nos envíen el comprobante de pago de las facturas relacionadas a continuación para poderlo registrar en nuestra contabilidad.',
      closing: 'Si ya realizaron el pago, por favor envíennos el comprobante para actualizar su estado de cuenta. Quedamos atentos a cualquier inquietud.',
    },
    {
      id: 'firme',
      label: 'Firme',
      description: 'Directo y claro sobre el cobro',
      message: 'Les escribimos para hacer seguimiento al pago de las facturas pendientes que se detallan a continuación. Les pedimos el favor nos envíen el comprobante de pago de cada una de estas facturas a la mayor brevedad posible para poderlo relacionar en nuestra contabilidad y poder seguir prestando un excelente servicio.',
      closing: 'Agradecemos su pronta gestión con el pago. En caso de tener algún inconveniente, por favor comuníquense con nosotros para buscar una solución.',
    },
    {
      id: 'urgente',
      label: 'Urgente',
      description: 'Para facturas muy vencidas',
      message: 'Nos permitimos informarles que a la fecha registramos facturas pendientes de pago que se encuentran vencidas. Es indispensable que se realice el pago y nos envíen el respectivo comprobante de forma inmediata. El incumplimiento en los tiempos de pago afecta la continuidad de los servicios prestados.',
      closing: 'Les solicitamos gestionar el pago de manera urgente y enviarnos el comprobante a este mismo correo. De no recibir respuesta, nos veremos en la necesidad de tomar las medidas correspondientes.',
    },
  ];

  // invoiceIds = null → todas las facturas pendientes del cliente; [id] → solo esa factura
  const openReminderModal = (client, invoiceIds = null, invoiceLabel = '') => {
    setSelectedClient(client);
    const defaultTemplate = messageTemplates[0];
    setReminderData({
      email_to: client.client_email || '',
      subject: '',
      custom_message: defaultTemplate.message,
      closing_message: defaultTemplate.closing,
      selectedTemplate: 'cordial',
    });
    setReminderInvoiceIds(invoiceIds && invoiceIds.length ? invoiceIds : null);
    setReminderInvoiceLabel(invoiceLabel);
    setReminderStep('edit');
    setPreviewHtml('');
    setReminderResult(null);
    setScheduleMode(false);
    setScheduleDate('');
    setChannel('email');
    setWaPhone(client.client_phone || '');
    setWaText('');
    setWaInfo(null);
    setShowReminderModal(true);
  };

  const openReminderForInvoice = (inv) => {
    openReminderModal(
      { client_id: inv.client_id, client_phone: inv.client_phone || clientDetail?.client?.phone || '', client_email: inv.client_email || clientDetail?.client?.email || '', siigo_email: inv.siigo_email || clientDetail?.client?.siigo_email || '', orbit_email: inv.orbit_email || clientDetail?.client?.orbit_email || '', client_name: inv.client_name || clientDetail?.client?.company || clientDetail?.client?.name, total_owed: inv.pending_amount ?? inv.amount },
      [inv.id],
      inv.invoice_number,
    );
  };

  const loadPreview = async () => {
    try {
      setLoadingPreview(true);
      const res = await collectionsAPI.previewReminder({
        client_id: selectedClient.client_id,
        custom_message: reminderData.custom_message || undefined,
        closing_message: reminderData.closing_message || undefined,
        invoice_ids: reminderInvoiceIds || undefined,
      });
      setPreviewHtml(res.data.html);
      setPreviewSubject(reminderData.subject || res.data.subject);
      setReminderStep('preview');
    } catch (error) {
      setReminderResult({ success: false, message: error.response?.data?.error || 'Error generando preview' });
    } finally {
      setLoadingPreview(false);
    }
  };

  // Genera el texto del estado de cuenta para WhatsApp (y dice si hay plantilla aprobada)
  const loadWaPreview = async () => {
    if (!selectedClient) return;
    try {
      setWaLoading(true);
      const res = await collectionsAPI.previewWhatsApp({
        client_id: selectedClient.client_id,
        invoice_ids: reminderInvoiceIds || undefined,
      });
      setWaInfo(res.data);
      setWaText(res.data.text || '');
      if (!waPhone && res.data.phone) setWaPhone(res.data.phone);
    } catch (error) {
      setReminderResult({ success: false, message: error.response?.data?.error || 'Error generando el mensaje de WhatsApp' });
    } finally {
      setWaLoading(false);
    }
  };

  const switchChannel = (next) => {
    setChannel(next);
    if (next === 'whatsapp' && !waInfo) loadWaPreview();
  };

  const sendWhatsApp = async () => {
    try {
      setSendingReminder(true);
      // El texto editado se envía como cierre; la lista de facturas la arma el backend
      const res = await collectionsAPI.sendWhatsApp({
        client_id: selectedClient.client_id,
        phone: waPhone,
        invoice_ids: reminderInvoiceIds || undefined,
        custom_message: waClosingFromText(waText, waInfo?.text),
        mode: 'auto',
      });
      setReminderResult({ success: true, message: res.data.message });
      loadSummary();
      if (clientDetail) loadClientDetail(clientDetail.client.id);
    } catch (error) {
      setReminderResult({ success: false, message: error.response?.data?.error || 'Error enviando por WhatsApp' });
    } finally {
      setSendingReminder(false);
    }
  };

  // Si el usuario editó el último párrafo (cierre), lo mandamos como custom_message; si no, undefined
  const waClosingFromText = (edited, original) => {
    if (!edited || edited === original) return undefined;
    const paras = edited.trim().split(/\n\s*\n/);
    return paras[paras.length - 1]?.trim() || undefined;
  };

  const sendReminder = async () => {
    try {
      setSendingReminder(true);

      if (scheduleMode && scheduleDate) {
        await collectionsAPI.scheduleReminder({
          client_id: selectedClient.client_id,
          email_to: reminderData.email_to,
          subject: previewSubject || reminderData.subject || undefined,
          custom_message: reminderData.custom_message || undefined,
          closing_message: reminderData.closing_message || undefined,
          invoice_ids: reminderInvoiceIds || undefined,
          scheduled_for: scheduleDate,
        });
        setReminderResult({ success: true, message: `Correo programado para ${new Date(scheduleDate).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}` });
      } else {
        const res = await collectionsAPI.sendReminder({
          client_id: selectedClient.client_id,
          email_to: reminderData.email_to,
          subject: previewSubject || reminderData.subject || undefined,
          custom_message: reminderData.custom_message || undefined,
          closing_message: reminderData.closing_message || undefined,
          invoice_ids: reminderInvoiceIds || undefined,
        });
        setReminderResult({ success: true, message: res.data.message });
      }
      loadSummary();
      if (clientDetail) loadClientDetail(clientDetail.client.id);
    } catch (error) {
      setReminderResult({ success: false, message: error.response?.data?.error || 'Error enviando recordatorio' });
    } finally {
      setSendingReminder(false);
    }
  };

  const addNote = async () => {
    try {
      await collectionsAPI.addNote({
        client_id: selectedClient?.client_id || clientDetail?.client?.id,
        note: noteData.note,
        follow_up_date: noteData.follow_up_date || undefined,
      });
      setShowNoteModal(false);
      setNoteData({ note: '', follow_up_date: '' });
      if (clientDetail) {
        const notesRes = await collectionsAPI.getNotes(clientDetail.client.id);
        setClientNotes(notesRes.data);
      }
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  const handleMarkPaid = async () => {
    try {
      await collectionsAPI.markPaid({
        invoice_id: markPaidInvoice.id,
        paid_date: paidDate,
      });
      setMarkPaidInvoice(null);
      showNotice('success', `Factura ${markPaidInvoice.invoice_number} marcada como pagada`);
      if (clientDetail) {
        loadClientDetail(clientDetail.client.id);
      }
      loadSummary();
    } catch (error) {
      showNotice('error', error.response?.data?.error || 'No se pudo marcar como pagada');
    }
  };

  const loadReminderHistory = async (clientId) => {
    try {
      const res = await collectionsAPI.getReminders(clientId ? { client_id: clientId } : {});
      setReminderHistory(res.data);
      setShowHistory(true);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const loadScheduledList = async () => {
    try {
      const res = await collectionsAPI.getScheduled();
      setScheduledList(res.data);
      setShowScheduled(true);
    } catch (error) {
      console.error('Error loading scheduled:', error);
    }
  };

  const retryScheduled = async () => {
    try {
      setProcessingScheduled(true);
      const res = await collectionsAPI.processScheduled();
      setScheduledList(res.data.results || []);
    } catch (error) {
      console.error('Error processing scheduled:', error);
    } finally {
      setProcessingScheduled(false);
    }
  };

  const cancelScheduledReminder = async (id) => {
    try {
      await collectionsAPI.cancelScheduled(id);
      setScheduledList(scheduledList.filter(s => s.id !== id));
    } catch (error) {
      console.error('Error canceling:', error);
    }
  };

  // Navegación entre vistas: tarjeta de bucket → Por factura filtrado; mes → Por factura filtrado por mes
  const goToInvoicesWithBucket = (bucket) => {
    setInvoiceFilters({ ...EMPTY_INVOICE_FILTERS, bucket: invoiceFilters.bucket === bucket && activeTab === 'invoices' ? '' : bucket });
    setActiveTab('invoices');
  };
  const goToInvoicesWithMonth = (month) => {
    setInvoiceFilters({ ...EMPTY_INVOICE_FILTERS, month });
    setActiveTab('invoices');
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#17181A]"></div>
      </div>
    );
  }

  // ==================== SHARED MODALS ====================
  const { clients: debtors, stats, recentlyPaid } = summary;

  const renderReminderModal = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowReminderModal(false)}>
      <div className={`bg-white rounded-2xl w-full flex flex-col ${reminderStep === 'preview' ? 'max-w-3xl max-h-[90vh]' : 'max-w-xl max-h-[90vh]'}`} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            {reminderStep === 'preview' && !reminderResult && (
              <button onClick={() => setReminderStep('edit')} className="text-gray-400 hover:text-[#17181A] transition-colors">
                <ChevronLeft size={20} />
              </button>
            )}
            <h3 className="text-lg font-bold text-[#17181A]">
              {reminderResult ? (reminderResult.success ? 'Enviado' : 'Error') : reminderStep === 'edit' ? 'Enviar Estado de Cuenta' : 'Preview del Correo'}
            </h3>
          </div>
          <button onClick={() => setShowReminderModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {/* Result message */}
        {reminderResult && (
          <div className="px-6 pt-4">
            <div className={`p-4 rounded-xl ${reminderResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              <p className="text-sm font-medium">{reminderResult.message}</p>
            </div>
            {reminderResult.success && (
              <div className="flex justify-end mt-4 pb-4">
                <button onClick={() => setShowReminderModal(false)} className="px-4 py-2 rounded-xl bg-[#17181A] text-[#D7F653] text-sm font-medium">Cerrar</button>
              </div>
            )}
          </div>
        )}

        {/* STEP 1: Edit */}
        {reminderStep === 'edit' && !reminderResult && (
          <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Cliente</p>
                  <p className="font-medium text-[#17181A]">{selectedClient?.client_name}</p>
                </div>
                {reminderInvoiceIds ? (
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#D7F653]/40 text-[#17181A] border border-[#D7F653]">
                      <FileText size={12} /> Solo factura {reminderInvoiceLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setReminderInvoiceIds(null); setReminderInvoiceLabel(''); }}
                      className="block text-xs text-gray-400 hover:text-[#17181A] underline mt-1 ml-auto"
                    >
                      Incluir todas las facturas del cliente
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400 mt-1">Todas las facturas pendientes</span>
                )}
              </div>

              {/* Canal: correo o WhatsApp */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Canal</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => switchChannel('email')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${channel === 'email' ? 'bg-[#17181A] text-[#D7F653] border-[#17181A]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                  >
                    <Mail size={15} /> Correo
                  </button>
                  <button
                    type="button"
                    onClick={() => switchChannel('whatsapp')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${channel === 'whatsapp' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                  >
                    <MessageCircle size={15} /> WhatsApp
                  </button>
                </div>
              </div>

              {channel === 'whatsapp' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Número de WhatsApp *</label>
                    <input
                      type="tel"
                      value={waPhone}
                      onChange={(e) => setWaPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                      placeholder="57 300 123 4567"
                    />
                    <p className="mt-1 text-[11px] text-gray-400">Tomado del teléfono del cliente en Orbit. Si no tiene indicativo se asume Colombia (+57).</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje</label>
                    {waLoading ? (
                      <p className="text-sm text-gray-400 py-3">Generando estado de cuenta…</p>
                    ) : (
                      <textarea
                        value={waText}
                        onChange={(e) => setWaText(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none font-mono text-[12.5px]"
                        rows={9}
                      />
                    )}
                    {waInfo && (
                      waInfo.configured === false ? (
                        <p className="mt-1 text-[11px] text-red-600">WhatsApp no está configurado en el backend (KAPSO_API_KEY).</p>
                      ) : waInfo.template_available ? (
                        <p className="mt-1 text-[11px] text-emerald-700">Se enviará con la plantilla aprobada “{waInfo.template_name}”, así llega aunque el cliente no haya escrito antes. Solo el último párrafo (cierre) es editable en la plantilla.</p>
                      ) : (
                        <p className="mt-1 text-[11px] text-amber-600">La plantilla “{waInfo.template_name}” aún no está aprobada en Meta: se enviará como texto libre y solo llega si el cliente escribió en las últimas 24 h.</p>
                      )
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Sale desde el número de WhatsApp de LA REAL y queda registrado en la bandeja de WhatsApp y en el historial de cobros.</p>
                  </div>
                </>
              )}

              {channel === 'email' && (<>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email destino *</label>
                <input
                  type="email"
                  value={reminderData.email_to}
                  onChange={(e) => setReminderData({ ...reminderData, email_to: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                  placeholder="email@cliente.com"
                />
                {selectedClient?.siigo_email && reminderData.email_to === selectedClient.siigo_email ? (
                  <p className="mt-1 text-[11px] text-gray-500">Correo de contacto tomado de Siigo{selectedClient.siigo_contact_name ? ` (${selectedClient.siigo_contact_name})` : ''}.{selectedClient.orbit_email && selectedClient.orbit_email !== selectedClient.siigo_email && (<> <button type="button" className="underline" onClick={() => setReminderData({ ...reminderData, email_to: selectedClient.orbit_email })}>Usar el de Orbit ({selectedClient.orbit_email})</button></>)}</p>
                ) : selectedClient?.siigo_email && reminderData.email_to !== selectedClient.siigo_email ? (
                  <p className="mt-1 text-[11px] text-gray-500"><button type="button" className="underline" onClick={() => setReminderData({ ...reminderData, email_to: selectedClient.siigo_email })}>Usar el correo de Siigo ({selectedClient.siigo_email})</button></p>
                ) : !selectedClient?.siigo_email ? (
                  <p className="mt-1 text-[11px] text-amber-600">Este cliente no tiene correo de contacto en Siigo; se usa el de Orbit.</p>
                ) : null}
                <p className="mt-1 text-[11px] text-gray-400">Todos los cobros salen con copia a juanfe@larealmarketing.com. Varios destinatarios: sepáralos con coma.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Asunto (opcional)</label>
                <input
                  type="text"
                  value={reminderData.subject}
                  onChange={(e) => setReminderData({ ...reminderData, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                  placeholder="Estado de Cuenta - [Cliente]"
                />
              </div>

              {/* Template selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tono del mensaje</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  {messageTemplates.map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => setReminderData({
                        ...reminderData,
                        custom_message: tpl.message,
                        closing_message: tpl.closing,
                        selectedTemplate: tpl.id,
                      })}
                      className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                        reminderData.selectedTemplate === tpl.id
                          ? 'bg-[#17181A] text-[#D7F653] border-[#17181A]'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="block">{tpl.label}</span>
                      <span className={`block text-xs mt-0.5 ${
                        reminderData.selectedTemplate === tpl.id ? 'text-[#D7F653]/70' : 'text-gray-400'
                      }`}>{tpl.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje principal</label>
                <textarea
                  value={reminderData.custom_message}
                  onChange={(e) => setReminderData({ ...reminderData, custom_message: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none"
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje de cierre</label>
                <textarea
                  value={reminderData.closing_message}
                  onChange={(e) => setReminderData({ ...reminderData, closing_message: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none"
                  rows={3}
                />
              </div>

              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500">El correo sera enviado a nombre de:</p>
                <p className="text-sm font-medium text-[#17181A] mt-1">Estefania Hernandez - Administración y Cartera</p>
              </div>
              </>)}
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <button
                onClick={() => setShowReminderModal(false)}
                className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </button>
              {channel === 'whatsapp' ? (
                <button
                  onClick={sendWhatsApp}
                  disabled={sendingReminder || waLoading || !waPhone || !waText || waInfo?.configured === false}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  <MessageCircle size={16} />
                  {sendingReminder ? 'Enviando...' : 'Enviar por WhatsApp'}
                </button>
              ) : (
                <button
                  onClick={loadPreview}
                  disabled={loadingPreview || !reminderData.email_to}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#17181A] text-[#D7F653] text-sm font-medium hover:bg-[#2D2D4E] disabled:opacity-50 transition-colors"
                >
                  <Eye size={16} />
                  {loadingPreview ? 'Cargando...' : 'Ver Preview'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: Preview */}
        {reminderStep === 'preview' && !reminderResult && (
          <>
            {/* Subject bar */}
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Para:</span>
                <span className="font-medium text-[#17181A]">{reminderData.email_to}</span>
              </div>
              <div className="flex items-center gap-2 text-sm mt-1">
                <span className="text-gray-500">Asunto:</span>
                <span className="font-medium text-[#17181A]">{previewSubject}</span>
              </div>
            </div>

            {/* Email preview iframe */}
            <div className="flex-1 overflow-auto px-6 py-4" style={{ minHeight: '400px' }}>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <iframe
                  srcDoc={previewHtml}
                  title="Email Preview"
                  className="w-full border-0"
                  style={{ height: '500px' }}
                  sandbox=""
                />
              </div>
            </div>

            {/* Schedule toggle + Actions */}
            <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0 space-y-3">
              {/* Schedule option */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => { setScheduleMode(!scheduleMode); if (scheduleMode) setScheduleDate(''); }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    scheduleMode
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Clock size={15} />
                  Programar envio
                </button>
                {scheduleMode && (
                  <input
                    type="datetime-local"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
                  />
                )}
              </div>

              <div className="flex gap-2 justify-between">
                <button
                  onClick={() => setReminderStep('edit')}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100"
                >
                  <ChevronLeft size={16} />
                  Editar
                </button>
                <button
                  onClick={sendReminder}
                  disabled={sendingReminder || (scheduleMode && !scheduleDate)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#17181A] text-[#D7F653] text-sm font-medium hover:bg-[#2D2D4E] disabled:opacity-50 transition-colors"
                >
                  {scheduleMode ? <Clock size={16} /> : <Send size={16} />}
                  {sendingReminder ? 'Procesando...' : scheduleMode ? 'Programar Envio' : 'Confirmar y Enviar'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  const renderNoteModal = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowNoteModal(false)}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[#17181A]">Agregar Nota de Seguimiento</h3>
          <button onClick={() => setShowNoteModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nota *</label>
            <textarea
              value={noteData.note}
              onChange={(e) => setNoteData({ ...noteData, note: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none"
              rows={4}
              placeholder="Ej: Hable con contabilidad, prometen pagar el viernes..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de seguimiento (opcional)</label>
            <input
              type="date"
              value={noteData.follow_up_date}
              onChange={(e) => setNoteData({ ...noteData, follow_up_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-6">
          <button onClick={() => setShowNoteModal(false)} className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100">Cancelar</button>
          <button
            onClick={addNote}
            disabled={!noteData.note.trim()}
            className="px-4 py-2 rounded-xl bg-[#17181A] text-[#D7F653] text-sm font-medium hover:bg-[#2D2D4E] disabled:opacity-50"
          >
            Guardar Nota
          </button>
        </div>
      </div>
    </div>
  );

  const renderMarkPaidModal = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setMarkPaidInvoice(null)}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[#17181A]">Marcar como Pagada</h3>
          <button onClick={() => setMarkPaidInvoice(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Factura <strong>{markPaidInvoice.invoice_number}</strong>{markPaidInvoice.client_name ? <> de <strong>{markPaidInvoice.client_name}</strong></> : null} por <strong>{formatCurrency(markPaidInvoice.amount)}</strong>
        </p>
        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de pago</label>
        <input
          type="date"
          value={paidDate}
          onChange={(e) => setPaidDate(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm mb-4"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={() => setMarkPaidInvoice(null)} className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100">Cancelar</button>
          <button onClick={handleMarkPaid} className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700">Confirmar Pago</button>
        </div>
      </div>
    </div>
  );

  const renderSharedModals = () => (
    <>
      {showReminderModal && renderReminderModal()}
      {showNoteModal && renderNoteModal()}
      {markPaidInvoice && renderMarkPaidModal()}
      {showBulkModal && (
        <BulkSendModal
          debtors={debtors}
          onClose={() => setShowBulkModal(false)}
          onDone={() => loadSummary()}
        />
      )}
    </>
  );

  const renderNotice = () => notice && (
    <div className={`mb-6 px-4 py-3 rounded-xl text-sm ${notice.type === 'success' ? 'bg-green-50 text-green-700' : notice.type === 'info' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
      {notice.text}
    </div>
  );

  // ==================== DETAIL VIEW ====================
  if (view === 'detail' && clientDetail) {
    const { client, invoices: clientInvoices, reminders } = clientDetail;
    const totalOwed = clientInvoices.reduce((sum, inv) => sum + Number(inv.pending_amount ?? inv.amount), 0);
    const clientForActions = { client_id: client.id, client_email: client.email, siigo_email: client.siigo_email, orbit_email: client.orbit_email, client_name: client.company || client.name, total_owed: totalOwed };

    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => { setView('overview'); setClientDetail(null); }}
          className="flex items-center gap-2 text-gray-500 hover:text-[#17181A] mb-6 transition-colors"
        >
          <ChevronLeft size={20} />
          <span className="text-sm font-medium">Volver a Cartera</span>
        </button>

        {renderNotice()}

        {/* Client Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#17181A]">{client.company || client.name}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
              {client.nit && <span>NIT: {client.nit}</span>}
              {client.email && <span>{client.email}</span>}
              {client.phone && <span>{client.phone}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setSelectedClient(clientForActions);
                setShowNoteModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <StickyNote size={16} />
              Agregar Nota
            </button>
            <button
              onClick={() => openReminderModal(clientForActions)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#17181A] text-[#D7F653] text-sm font-medium hover:bg-[#2D2D4E] transition-colors"
            >
              <Send size={16} />
              Enviar Estado de Cuenta
            </button>
          </div>
        </div>

        {/* Total Card */}
        <div className="bg-gradient-to-r from-[#17181A] to-[#2D2D4E] rounded-2xl p-6 mb-6">
          <p className="text-white/60 text-sm uppercase tracking-wider">Saldo Pendiente Total</p>
          <p className="text-[#D7F653] text-3xl font-extrabold mt-1">{formatCurrency(totalOwed)}</p>
          <p className="text-white/50 text-sm mt-1">{clientInvoices.length} factura{clientInvoices.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Invoices */}
        <div className="glass-card overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#17181A]">Facturas Pendientes</h2>
            {loadingDetail && <RefreshCw size={16} className="animate-spin text-gray-400" />}
          </div>
          {clientInvoices.length === 0 ? (
            <p className="p-10 text-center text-sm text-gray-400">Este cliente ya no tiene facturas pendientes</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px]">
                <thead>
                  <tr className="bg-gray-50/70 text-xs text-gray-500 uppercase tracking-wider text-left">
                    <th className="px-5 py-3">Factura</th>
                    <th className="px-3 py-3">Proyecto</th>
                    <th className="px-3 py-3">Emisión</th>
                    <th className="px-3 py-3">Días</th>
                    <th className="px-3 py-3">Vence</th>
                    <th className="px-3 py-3">Promesa</th>
                    <th className="px-3 py-3">Estado de cobro</th>
                    <th className="px-3 py-3 text-right">Monto</th>
                    <th className="px-3 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {clientInvoices.map((inv) => {
                    const bStyle = BUCKET_STYLES[inv.aging_bucket] || BUCKET_STYLES['0-30'];
                    const statusClass = (COLLECTION_STATUSES.find((s) => s.value === inv.collection_status) || COLLECTION_STATUSES[0]).className;
                    return (
                      <tr key={inv.id} className={`hover:bg-white/60 transition-colors ${savingInvoiceId === inv.id ? 'opacity-60' : ''}`}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-[#17181A]">{inv.invoice_number}</span>
                            {inv.pdf_url && (
                              <a href={inv.pdf_url} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-[#17181A]" title="Ver PDF (Siigo)"><FileText size={14} /></a>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-600 max-w-[160px] truncate">{inv.project_name || '-'}</td>
                        <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDate(inv.issue_date)}</td>
                        <td className="px-3 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${bStyle.badge}`}>{daysLabel(inv.days_outstanding)}</span></td>
                        <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">{inv.due_date ? formatDate(inv.due_date) : <span className="text-gray-300">-</span>}</td>
                        <td className="px-3 py-3">
                          <input
                            type="date"
                            value={inv.promise_date || ''}
                            onChange={(e) => updateInvoiceField(inv, { promise_date: e.target.value || null })}
                            className="px-2 py-1 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D7F653] w-[130px]"
                            title="Promesa de pago"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <select
                            value={inv.collection_status || 'pending'}
                            onChange={(e) => updateInvoiceField(inv, { collection_status: e.target.value })}
                            className={`px-2 py-1 rounded-lg text-xs font-medium border-0 focus:outline-none focus:ring-2 focus:ring-[#D7F653] cursor-pointer ${statusClass}`}
                          >
                            {COLLECTION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-3 text-sm font-semibold text-[#17181A] text-right whitespace-nowrap">
                          {formatCurrency(inv.pending_amount ?? inv.amount)}
                          {inv.siigo_total != null && Number(inv.pending_amount) < Number(inv.siigo_total) && (
                            <span className="block text-[10px] font-medium text-amber-600">pago parcial · total {formatCurrency(inv.siigo_total)}</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openReminderForInvoice({ ...inv, client_id: client.id, client_email: client.email, siigo_email: client.siigo_email, orbit_email: client.orbit_email, client_name: client.company || client.name })}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#17181A] text-[#D7F653] text-xs font-medium hover:bg-[#2D2D4E] transition-colors"
                              title="Cobrar solo esta factura"
                            >
                              <Send size={12} /> Cobrar
                            </button>
                            <button
                              onClick={() => { setMarkPaidInvoice({ ...inv, client_name: client.company || client.name }); setPaidDate(todayStr()); }}
                              className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
                              title="Marcar pagada"
                            >
                              <CheckCircle size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Two columns: Notes + Reminder History */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Notes */}
          <div className="glass-card overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#17181A]">Notas de Seguimiento</h2>
            </div>
            <div className="p-6">
              {clientNotes.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Sin notas aun</p>
              ) : (
                <div className="space-y-4">
                  {clientNotes.map((n) => (
                    <div key={n.id} className="bg-gray-50 rounded-xl p-4">
                      <p className="text-sm text-gray-700">{n.note}</p>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-400">
                        <span>{formatDateTime(n.created_at)}</span>
                        {n.created_by_name && <span>por {n.created_by_name}</span>}
                        {n.follow_up_date && (
                          <span className="flex items-center gap-1 text-yellow-600">
                            <Calendar size={12} />
                            Seguimiento: {formatDate(n.follow_up_date)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Reminder History */}
          <div className="glass-card overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-[#17181A]">Recordatorios Enviados</h2>
            </div>
            <div className="p-6">
              {reminders.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No se han enviado recordatorios</p>
              ) : (
                <div className="space-y-4">
                  {reminders.map((r) => (
                    <div key={r.id} className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#17181A] truncate">{r.subject}</p>
                          <p className="text-xs text-gray-500 mt-1 truncate">{r.channel === 'whatsapp' ? <span className="inline-flex items-center gap-1 text-emerald-700"><MessageCircle size={11} /> WhatsApp</span> : 'Para:'} {r.sent_to}</p>
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap">{formatDateTime(r.sent_at)}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span>{r.invoice_count} factura{r.invoice_count !== 1 ? 's' : ''}</span>
                        <span className="font-semibold">{formatCurrency(r.total_amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {renderSharedModals()}
      </div>
    );
  }

  // ==================== OVERVIEW ====================
  const debtorsWithEmail = debtors.filter((d) => d.client_email && d.client_email.trim()).length;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#17181A]">Cartera</h1>
          <p className="text-sm text-gray-500 mt-1">Gestión de cobros y estados de cuenta</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={loadScheduledList}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Calendar size={16} />
            Programados
          </button>
          <button
            onClick={() => loadReminderHistory()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Clock size={16} />
            Historial
          </button>
          <button
            onClick={syncWithSiigo}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60"
            title="Trae facturas nuevas de Siigo y marca pagadas las que ya tienen saldo 0"
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando con Siigo…' : 'Sincronizar Siigo'}
          </button>
          <button
            onClick={() => setShowBulkModal(true)}
            disabled={debtors.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#17181A] text-[#D7F653] text-sm font-medium hover:bg-[#2D2D4E] transition-colors disabled:opacity-50"
            title="Enviar el estado de cuenta a todos los clientes con saldo y email"
          >
            <Mail size={16} />
            Cobrar a todos
            {debtorsWithEmail > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[#D7F653] text-[#17181A] text-[11px] font-bold">{debtorsWithEmail}</span>}
          </button>
        </div>
      </div>
      {syncMsg && (
        <div className={`mb-6 px-4 py-3 rounded-xl text-sm ${syncMsg.type === 'success' ? 'bg-green-50 text-green-700' : syncMsg.type === 'info' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
          {syncMsg.text}
        </div>
      )}
      {renderNotice()}

      {/* Stats + antigüedad */}
      <AgingStats
        stats={stats}
        clientsCount={debtors.length}
        activeBucket={activeTab === 'invoices' ? invoiceFilters.bucket : null}
        onBucketClick={goToInvoicesWithBucket}
      />

      {/* Pestañas */}
      <div className="flex items-center gap-1 mb-4 bg-white/50 border border-white/80 rounded-xl p-1 w-fit max-w-full overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          const count = t.id === 'clients' ? debtors.length : t.id === 'invoices' ? invoices.length : null;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${active ? 'bg-[#17181A] text-white shadow-sm' : 'text-gray-600 hover:bg-white/80'}`}
            >
              <Icon size={15} className={active ? 'text-[#D7F653]' : ''} />
              {t.label}
              {count !== null && <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-white/15 text-white' : 'bg-gray-100 text-gray-500'}`}>{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="mb-6">
        {activeTab === 'clients' && (
          <ClientsView
            clients={debtors}
            onCollect={(client) => openReminderModal(client)}
            onOpenDetail={loadClientDetail}
          />
        )}
        {activeTab === 'invoices' && (
          <InvoicesView
            invoices={invoices}
            loading={loadingInvoices && invoices.length === 0}
            filters={invoiceFilters}
            onFiltersChange={setInvoiceFilters}
            onCollectInvoice={openReminderForInvoice}
            onMarkPaid={(inv) => { setMarkPaidInvoice(inv); setPaidDate(todayStr()); }}
            onUpdateInvoice={updateInvoiceField}
            savingId={savingInvoiceId}
          />
        )}
        {activeTab === 'months' && (
          <MonthlyView
            data={byMonth}
            loading={loadingByMonth && !byMonth}
            onSelectMonth={goToInvoicesWithMonth}
            onGoToInvoices={() => { setInvoiceFilters({ ...EMPTY_INVOICE_FILTERS }); setActiveTab('invoices'); }}
          />
        )}
      </div>

      {/* Recently Paid */}
      {recentlyPaid.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-[#17181A]">Pagos Recientes (30 dias)</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {recentlyPaid.map((inv) => (
              <div key={inv.id} className="px-6 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <CheckCircle size={16} className="text-green-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{inv.client_name}</p>
                    <p className="text-xs text-gray-400">{inv.invoice_number} - {formatDate(inv.paid_date)}</p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-green-600 whitespace-nowrap">{formatCurrency(inv.amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {renderSharedModals()}

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowHistory(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-[#17181A]">Historial de Recordatorios</h3>
              <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {reminderHistory.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No hay recordatorios enviados</p>
              ) : (
                <div className="space-y-3">
                  {reminderHistory.map((r) => (
                    <div key={r.id} className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#17181A]">{r.client_name}</p>
                          <p className="text-xs text-gray-500 mt-1 truncate">{r.subject}</p>
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{r.channel === 'whatsapp' ? <span className="inline-flex items-center gap-1 text-emerald-700"><MessageCircle size={11} /> WhatsApp</span> : 'Para:'} {r.sent_to}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-[#17181A]">{formatCurrency(r.total_amount)}</p>
                          <p className="text-xs text-gray-400 mt-1">{formatDateTime(r.sent_at)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {showScheduled && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowScheduled(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-[#17181A]">Correos Programados</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={retryScheduled}
                  disabled={processingScheduled}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#17181A] text-[#D7F653] text-xs font-medium hover:bg-[#2D2D4E] disabled:opacity-50 transition-colors"
                >
                  <RefreshCw size={14} className={processingScheduled ? 'animate-spin' : ''} />
                  {processingScheduled ? 'Procesando...' : 'Reintentar fallidos'}
                </button>
                <button onClick={() => setShowScheduled(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {scheduledList.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No hay correos programados</p>
              ) : (
                <div className="space-y-3">
                  {scheduledList.map((s) => (
                    <div key={s.id} className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#17181A]">{s.client_name}</p>
                          <p className="text-xs text-gray-500 mt-1 truncate">Para: {s.email_to}</p>
                          <p className="text-xs text-gray-400 mt-0.5">Programado: {formatDateTime(s.scheduled_for)}</p>
                          {s.error_message && <p className="text-xs text-red-500 mt-1">Error: {s.error_message}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            s.status === 'sent' ? 'bg-green-100 text-green-700' :
                            s.status === 'failed' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {s.status === 'sent' ? 'Enviado' : s.status === 'failed' ? 'Fallido' : 'Pendiente'}
                          </span>
                          {s.status === 'pending' && (
                            <button
                              onClick={() => cancelScheduledReminder(s.id)}
                              className="text-xs text-red-500 hover:text-red-700"
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Collections;
