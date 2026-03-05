import { useEffect, useState } from 'react';
import { collectionsAPI } from '../utils/api';
import {
  DollarSign, Send, Clock, CheckCircle, AlertTriangle, ChevronRight,
  ChevronLeft, Mail, StickyNote, X, Calendar, Eye, Filter, RefreshCw
} from 'lucide-react';

const Collections = () => {
  const [summary, setSummary] = useState({ clients: [], stats: {}, recentlyPaid: [] });
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientDetail, setClientDetail] = useState(null);
  const [clientNotes, setClientNotes] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Send reminder modal
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderData, setReminderData] = useState({ email_to: '', subject: '', custom_message: '' });
  const [sendingReminder, setSendingReminder] = useState(false);
  const [reminderResult, setReminderResult] = useState(null);

  // Note modal
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteData, setNoteData] = useState({ note: '', follow_up_date: '' });

  // Mark paid modal
  const [markPaidInvoice, setMarkPaidInvoice] = useState(null);
  const [paidDate, setPaidDate] = useState(new Date().toISOString().split('T')[0]);

  // Reminder history
  const [showHistory, setShowHistory] = useState(false);
  const [reminderHistory, setReminderHistory] = useState([]);

  // View mode
  const [view, setView] = useState('overview'); // overview | detail

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    try {
      setLoading(true);
      const res = await collectionsAPI.getSummary();
      setSummary(res.data);
    } catch (error) {
      console.error('Error loading collections:', error);
    } finally {
      setLoading(false);
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

  const openReminderModal = (client) => {
    setSelectedClient(client);
    setReminderData({
      email_to: client.client_email || '',
      subject: '',
      custom_message: '',
    });
    setReminderResult(null);
    setShowReminderModal(true);
  };

  const sendReminder = async () => {
    try {
      setSendingReminder(true);
      const res = await collectionsAPI.sendReminder({
        client_id: selectedClient.client_id,
        email_to: reminderData.email_to,
        subject: reminderData.subject || undefined,
        custom_message: reminderData.custom_message || undefined,
      });
      setReminderResult({ success: true, message: res.data.message });
      loadSummary();
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
      if (clientDetail) {
        loadClientDetail(clientDetail.client.id);
      }
      loadSummary();
    } catch (error) {
      console.error('Error marking paid:', error);
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

  const getDaysOverdue = (dueDate) => {
    if (!dueDate) return null;
    const today = new Date();
    const due = new Date(dueDate + 'T00:00:00');
    const diff = Math.floor((today - due) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getAgingBadge = (dueDate) => {
    const days = getDaysOverdue(dueDate);
    if (days === null) return <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Sin vencimiento</span>;
    if (days <= 0) return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Al dia</span>;
    if (days <= 15) return <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">{days}d vencida</span>;
    if (days <= 30) return <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">{days}d vencida</span>;
    return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">{days}d vencida</span>;
  };

  const formatCurrency = (amount) => {
    return `$${Number(amount || 0).toLocaleString('es-CO')}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1A1A2E]"></div>
      </div>
    );
  }

  // ==================== SHARED MODALS ====================
  const { clients: debtors, stats, recentlyPaid } = summary;

  const renderReminderModal = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowReminderModal(false)}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[#1A1A2E]">Enviar Estado de Cuenta</h3>
          <button onClick={() => setShowReminderModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {reminderResult ? (
          <div className={`p-4 rounded-xl mb-4 ${reminderResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            <p className="text-sm font-medium">{reminderResult.message}</p>
          </div>
        ) : null}

        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">Cliente</p>
            <p className="font-medium text-[#1A1A2E]">{selectedClient?.client_name}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email destino *</label>
            <input
              type="email"
              value={reminderData.email_to}
              onChange={(e) => setReminderData({ ...reminderData, email_to: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
              placeholder="email@cliente.com"
            />
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje personalizado (opcional)</label>
            <textarea
              value={reminderData.custom_message}
              onChange={(e) => setReminderData({ ...reminderData, custom_message: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none"
              rows={3}
              placeholder="Se usara un mensaje por defecto si lo dejas vacio..."
            />
          </div>

          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">El correo sera enviado a nombre de:</p>
            <p className="text-sm font-medium text-[#1A1A2E] mt-1">Estefania Hernandez - Administracion y Cartera</p>
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-6">
          <button
            onClick={() => setShowReminderModal(false)}
            className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            onClick={sendReminder}
            disabled={sendingReminder || !reminderData.email_to}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1A1A2E] text-[#BFFF00] text-sm font-medium hover:bg-[#2D2D4E] disabled:opacity-50 transition-colors"
          >
            <Send size={16} />
            {sendingReminder ? 'Enviando...' : 'Enviar Recordatorio'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderNoteModal = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowNoteModal(false)}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[#1A1A2E]">Agregar Nota de Seguimiento</h3>
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
            className="px-4 py-2 rounded-xl bg-[#1A1A2E] text-[#BFFF00] text-sm font-medium hover:bg-[#2D2D4E] disabled:opacity-50"
          >
            Guardar Nota
          </button>
        </div>
      </div>
    </div>
  );

  // ==================== DETAIL VIEW ====================
  if (view === 'detail' && clientDetail) {
    const { client, invoices, reminders } = clientDetail;
    const totalOwed = invoices.reduce((sum, inv) => sum + inv.amount, 0);

    return (
      <div className="p-6 max-w-6xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => { setView('overview'); setClientDetail(null); }}
          className="flex items-center gap-2 text-gray-500 hover:text-[#1A1A2E] mb-6 transition-colors"
        >
          <ChevronLeft size={20} />
          <span className="text-sm font-medium">Volver a Cartera</span>
        </button>

        {/* Client Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A2E]">{client.company || client.name}</h1>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
              {client.nit && <span>NIT: {client.nit}</span>}
              {client.email && <span>{client.email}</span>}
              {client.phone && <span>{client.phone}</span>}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setSelectedClient({ client_id: client.id, client_email: client.email, client_name: client.company || client.name });
                setShowNoteModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <StickyNote size={16} />
              Agregar Nota
            </button>
            <button
              onClick={() => openReminderModal({ client_id: client.id, client_email: client.email, client_name: client.company || client.name, total_owed: totalOwed })}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1A1A2E] text-[#BFFF00] text-sm font-medium hover:bg-[#2D2D4E] transition-colors"
            >
              <Send size={16} />
              Enviar Estado de Cuenta
            </button>
          </div>
        </div>

        {/* Total Card */}
        <div className="bg-gradient-to-r from-[#1A1A2E] to-[#2D2D4E] rounded-2xl p-6 mb-6">
          <p className="text-white/60 text-sm uppercase tracking-wider">Saldo Pendiente Total</p>
          <p className="text-[#BFFF00] text-3xl font-extrabold mt-1">{formatCurrency(totalOwed)}</p>
          <p className="text-white/50 text-sm mt-1">{invoices.length} factura{invoices.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Invoices */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-[#1A1A2E]">Facturas Pendientes</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3 text-left">Factura</th>
                <th className="px-6 py-3 text-left">Proyecto</th>
                <th className="px-6 py-3 text-left">Emision</th>
                <th className="px-6 py-3 text-left">Vencimiento</th>
                <th className="px-6 py-3 text-right">Monto</th>
                <th className="px-6 py-3 text-center">Estado</th>
                <th className="px-6 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-[#1A1A2E]">{inv.invoice_number}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{inv.project_name || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{formatDate(inv.issue_date)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{formatDate(inv.due_date)}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-[#1A1A2E] text-right">{formatCurrency(inv.amount)}</td>
                  <td className="px-6 py-4 text-center">{getAgingBadge(inv.due_date)}</td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => { setMarkPaidInvoice(inv); setPaidDate(new Date().toISOString().split('T')[0]); }}
                      className="text-xs font-medium text-green-600 hover:text-green-800 transition-colors"
                    >
                      Marcar Pagada
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Two columns: Notes + Reminder History */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Notes */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#1A1A2E]">Notas de Seguimiento</h2>
            </div>
            <div className="p-6">
              {clientNotes.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Sin notas aun</p>
              ) : (
                <div className="space-y-4">
                  {clientNotes.map((n) => (
                    <div key={n.id} className="bg-gray-50 rounded-xl p-4">
                      <p className="text-sm text-gray-700">{n.note}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
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
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-[#1A1A2E]">Recordatorios Enviados</h2>
            </div>
            <div className="p-6">
              {reminders.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No se han enviado recordatorios</p>
              ) : (
                <div className="space-y-4">
                  {reminders.map((r) => (
                    <div key={r.id} className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-[#1A1A2E]">{r.subject}</p>
                          <p className="text-xs text-gray-500 mt-1">Para: {r.sent_to}</p>
                        </div>
                        <span className="text-xs text-gray-400">{formatDateTime(r.sent_at)}</span>
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

        {/* Mark Paid Modal */}
        {markPaidInvoice && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setMarkPaidInvoice(null)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[#1A1A2E]">Marcar como Pagada</h3>
                <button onClick={() => setMarkPaidInvoice(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Factura <strong>{markPaidInvoice.invoice_number}</strong> por <strong>{formatCurrency(markPaidInvoice.amount)}</strong>
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
        )}

        {/* Reminder Modal */}
        {showReminderModal && renderReminderModal()}

        {/* Note Modal */}
        {showNoteModal && renderNoteModal()}
      </div>
    );
  }

  // ==================== OVERVIEW ====================
  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A2E]">Cartera</h1>
          <p className="text-sm text-gray-500 mt-1">Gestion de cobros y estados de cuenta</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => loadReminderHistory()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Clock size={16} />
            Historial
          </button>
          <button
            onClick={loadSummary}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={16} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <DollarSign size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Total Pendiente</p>
              <p className="text-xl font-bold text-[#1A1A2E]">{formatCurrency(stats.total_amount)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center">
              <Clock size={20} className="text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Facturas Pendientes</p>
              <p className="text-xl font-bold text-[#1A1A2E]">{stats.total_invoices || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Vencidas</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(stats.overdue_amount)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <CheckCircle size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Clientes por Cobrar</p>
              <p className="text-xl font-bold text-[#1A1A2E]">{debtors.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Client List */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-[#1A1A2E]">Clientes con Saldo Pendiente</h2>
        </div>

        {debtors.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle size={48} className="text-green-400 mx-auto mb-3" />
            <p className="text-lg font-medium text-gray-600">No hay cartera pendiente</p>
            <p className="text-sm text-gray-400 mt-1">Todas las facturas estan al dia</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {debtors.map((client) => {
              const daysOverdue = getDaysOverdue(client.oldest_due_date);
              const isOverdue = daysOverdue !== null && daysOverdue > 0;

              return (
                <div
                  key={client.client_id}
                  className="px-6 py-4 hover:bg-gray-50/50 transition-colors flex items-center gap-4"
                >
                  {/* Client info */}
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => loadClientDetail(client.client_id)}>
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-semibold text-[#1A1A2E] truncate">{client.client_name}</h3>
                      {isOverdue && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          {daysOverdue}d vencida
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span>{client.invoice_count} factura{client.invoice_count > 1 ? 's' : ''}</span>
                      {client.last_reminder_sent && (
                        <span className="flex items-center gap-1">
                          <Mail size={12} />
                          Ultimo recordatorio: {formatDate(client.last_reminder_sent)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="text-right mr-4">
                    <p className="text-lg font-bold text-[#1A1A2E]">{formatCurrency(client.total_owed)}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openReminderModal(client)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A1A2E] text-[#BFFF00] text-xs font-medium hover:bg-[#2D2D4E] transition-colors"
                      title="Enviar estado de cuenta"
                    >
                      <Send size={14} />
                      Cobrar
                    </button>
                    <button
                      onClick={() => loadClientDetail(client.client_id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-[#1A1A2E] hover:bg-gray-100 transition-colors"
                      title="Ver detalle"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recently Paid */}
      {recentlyPaid.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-[#1A1A2E]">Pagos Recientes (30 dias)</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {recentlyPaid.map((inv) => (
              <div key={inv.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle size={16} className="text-green-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">{inv.client_name}</p>
                    <p className="text-xs text-gray-400">{inv.invoice_number} - {formatDate(inv.paid_date)}</p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-green-600">{formatCurrency(inv.amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reminder Modal */}
      {showReminderModal && renderReminderModal()}

      {/* Note Modal */}
      {showNoteModal && renderNoteModal()}

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowHistory(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-[#1A1A2E]">Historial de Recordatorios</h3>
              <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {reminderHistory.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No hay recordatorios enviados</p>
              ) : (
                <div className="space-y-3">
                  {reminderHistory.map((r) => (
                    <div key={r.id} className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[#1A1A2E]">{r.client_name}</p>
                          <p className="text-xs text-gray-500 mt-1">{r.subject}</p>
                          <p className="text-xs text-gray-400 mt-0.5">Para: {r.sent_to}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-[#1A1A2E]">{formatCurrency(r.total_amount)}</p>
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
    </div>
  );
};

export default Collections;
