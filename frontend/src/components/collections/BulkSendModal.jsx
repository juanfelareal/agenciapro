import { useMemo, useState } from 'react';
import { X, Send, Clock, CheckSquare, Square, AlertCircle, CheckCircle } from 'lucide-react';
import { collectionsAPI } from '../../utils/api';
import { formatCurrency, formatDateTime } from './collectionsUtils';

// "Cobrar a todos": envía (o programa) el estado de cuenta estándar a todos los clientes con saldo y email
const BulkSendModal = ({ debtors = [], onClose, onDone }) => {
  const withEmail = useMemo(() => debtors.filter((d) => d.client_email && d.client_email.trim()), [debtors]);
  const withoutEmail = useMemo(() => debtors.filter((d) => !d.client_email || !d.client_email.trim()), [debtors]);

  const [selected, setSelected] = useState(() => new Set(withEmail.map((d) => d.client_id)));
  const [mode, setMode] = useState('now'); // now | schedule
  const [scheduleDate, setScheduleDate] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const selectedClients = withEmail.filter((d) => selected.has(d.client_id));
  const selectedTotal = selectedClients.reduce((s, d) => s + Number(d.total_owed || 0), 0);
  const allSelected = selected.size === withEmail.length && withEmail.length > 0;

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(withEmail.map((d) => d.client_id)));

  const submit = async () => {
    if (selectedClients.length === 0) return;
    setSending(true);
    setError(null);
    try {
      const payload = { client_ids: selectedClients.map((d) => d.client_id) };
      // La fecha del input es hora local del navegador: se convierte a ISO (UTC) para que el servidor no la malinterprete
      if (mode === 'schedule' && scheduleDate) payload.scheduled_for = new Date(scheduleDate).toISOString();
      const res = await collectionsAPI.sendBulk(payload);
      setResult(res.data);
      if (onDone) onDone();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo completar el cobro masivo');
    } finally {
      setSending(false);
    }
  };

  const nameOf = (id) => debtors.find((d) => d.client_id === id)?.client_name || `Cliente #${id}`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h3 className="text-lg font-bold text-[#17181A]">{result ? 'Cobro masivo completado' : 'Cobrar a todos'}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {result ? (
          <div className="p-6 overflow-y-auto space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-emerald-50 p-4">
                <p className="text-xs text-emerald-700 uppercase tracking-wider">{result.scheduled > 0 ? 'Programados' : 'Enviados'}</p>
                <p className="text-2xl font-bold text-emerald-700">{result.scheduled > 0 ? result.scheduled : result.sent}</p>
                {result.scheduled_for && <p className="text-xs text-emerald-700/70 mt-1">para {formatDateTime(result.scheduled_for)}</p>}
              </div>
              <div className={`rounded-xl p-4 ${result.skipped?.length ? 'bg-amber-50' : 'bg-gray-50'}`}>
                <p className={`text-xs uppercase tracking-wider ${result.skipped?.length ? 'text-amber-700' : 'text-gray-500'}`}>Omitidos</p>
                <p className={`text-2xl font-bold ${result.skipped?.length ? 'text-amber-700' : 'text-gray-500'}`}>{result.skipped?.length || 0}</p>
              </div>
            </div>

            {result.results?.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-[#17181A] mb-2">Clientes {result.scheduled > 0 ? 'programados' : 'cobrados'}</p>
                <div className="space-y-1.5">
                  {result.results.map((r) => (
                    <div key={r.client_id} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-gray-50">
                      <span className="flex items-center gap-2 text-gray-700"><CheckCircle size={14} className="text-emerald-500" />{r.client_name} <span className="text-gray-400 text-xs">{r.email}</span></span>
                      <span className="font-semibold text-[#17181A]">{formatCurrency(r.total_owed)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.skipped?.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-[#17181A] mb-2">Omitidos y por qué</p>
                <div className="space-y-1.5">
                  {result.skipped.map((s) => (
                    <div key={s.client_id} className="flex items-start gap-2 text-sm px-3 py-2 rounded-lg bg-amber-50 text-amber-800">
                      <AlertCircle size={14} className="mt-0.5 shrink-0" />
                      <span><strong>{s.client_name || nameOf(s.client_id)}</strong>: {s.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-[#17181A] text-[#D7F653] text-sm font-medium">Cerrar</button>
            </div>
          </div>
        ) : (
          <>
            <div className="p-6 overflow-y-auto space-y-5">
              <p className="text-sm text-gray-600">
                Se enviará el <strong>estado de cuenta estándar</strong> (tono cordial, todas las facturas pendientes de cada cliente) a nombre de Estefania Hernandez. Máximo un correo por cliente.
              </p>

              {withEmail.length === 0 ? (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 flex items-start gap-2">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  Ningún cliente con saldo pendiente tiene email registrado. Agrega los correos en Clientes para poder cobrar en bloque.
                </div>
              ) : (
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button type="button" onClick={toggleAll} className="flex items-center gap-2 hover:text-[#17181A]">
                      {allSelected ? <CheckSquare size={15} /> : <Square size={15} />}
                      {selectedClients.length} de {withEmail.length} clientes
                    </button>
                    <span className="text-[#17181A] font-bold normal-case tracking-normal text-sm">{formatCurrency(selectedTotal)}</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
                    {withEmail.map((d) => {
                      const checked = selected.has(d.client_id);
                      return (
                        <button
                          key={d.client_id}
                          type="button"
                          onClick={() => toggle(d.client_id)}
                          className={`w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50 transition-colors ${checked ? '' : 'opacity-50'}`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            {checked ? <CheckSquare size={15} className="text-[#17181A] shrink-0" /> : <Square size={15} className="text-gray-300 shrink-0" />}
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-[#17181A] truncate">{d.client_name}</span>
                              <span className="block text-xs text-gray-400 truncate">{d.client_email} · {d.invoice_count} factura{d.invoice_count !== 1 ? 's' : ''}</span>
                            </span>
                          </span>
                          <span className="text-sm font-semibold text-[#17181A] whitespace-nowrap ml-3">{formatCurrency(d.total_owed)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {withoutEmail.length > 0 && (
                <div className="rounded-xl bg-gray-50 p-3 text-xs text-gray-500">
                  <p className="font-medium text-gray-600 mb-1">Se omitirán por no tener email ({withoutEmail.length}):</p>
                  <p>{withoutEmail.map((d) => d.client_name).join(', ')}</p>
                </div>
              )}

              {/* Enviar ahora / programar */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">¿Cuándo?</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('now')}
                    className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${mode === 'now' ? 'bg-[#17181A] text-[#D7F653] border-[#17181A]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                  >
                    <Send size={15} /> Enviar ahora
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('schedule')}
                    className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${mode === 'schedule' ? 'bg-[#17181A] text-[#D7F653] border-[#17181A]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                  >
                    <Clock size={15} /> Programar para…
                  </button>
                </div>
                {mode === 'schedule' && (
                  <input
                    type="datetime-local"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                    className="w-full sm:w-auto px-3 py-2 border border-gray-200 rounded-xl text-sm"
                  />
                )}
              </div>

              {error && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-2 justify-end shrink-0">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100">Cancelar</button>
              <button
                type="button"
                onClick={submit}
                disabled={sending || selectedClients.length === 0 || (mode === 'schedule' && !scheduleDate)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#17181A] text-[#D7F653] text-sm font-medium hover:bg-[#2D2D4E] disabled:opacity-50 transition-colors"
              >
                {mode === 'schedule' ? <Clock size={16} /> : <Send size={16} />}
                {sending ? 'Procesando…' : mode === 'schedule' ? `Programar ${selectedClients.length} correo${selectedClients.length !== 1 ? 's' : ''}` : `Enviar a ${selectedClients.length} cliente${selectedClients.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BulkSendModal;
