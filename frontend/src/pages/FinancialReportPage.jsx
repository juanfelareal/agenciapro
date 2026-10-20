import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { growthAPI, clientsAPI } from '../utils/api';
import FinancialReport from '../components/growth/financial/FinancialReport';
import PrintShell from '../components/growth/financial/PrintShell';
import { currentPeriod } from '../components/growth/financial/format';

/** Equipo: /print/finanzas/:clientId?period=YYYY-MM → informe imprimible (Guardar como PDF). */
export default function FinancialReportPage() {
  const { clientId } = useParams();
  const [params] = useSearchParams();
  const period = /^\d{4}-\d{2}$/.test(params.get('period') || '') ? params.get('period') : currentPeriod();
  const [state, setState] = useState({ loading: true, error: null, data: null, client: null, patterns: null, mix: null, scenarios: [] });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [fin, client, patterns, mix, scen] = await Promise.all([
          growthAPI.getFinancials(clientId, period),
          clientsAPI.getById(clientId).then((r) => r.data).catch(() => null),
          growthAPI.patterns(clientId, 90).then((r) => (r.data?.heatmap ? r.data : null)).catch(() => null),
          growthAPI.customerMix(clientId).then((r) => (r.data?.new ? r.data : null)).catch(() => null),
          growthAPI.scenarios(clientId, { period }).then((r) => r.data?.scenarios || []).catch(() => []),
        ]);
        if (cancelled) return;
        document.title = `Finanzas ${client?.nickname || client?.company || ''} ${period}`.trim();
        setState({ loading: false, error: null, data: fin.data, client, patterns, mix, scenarios: scen });
      } catch (e) {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: e.response?.data?.error || 'No pudimos cargar el informe.' }));
      }
    })();
    return () => { cancelled = true; };
  }, [clientId, period]);

  return (
    <PrintShell loading={state.loading} error={state.error} autoPrint={!params.get('noprint')}>
      <FinancialReport data={state.data} client={state.client} period={period} patterns={state.patterns} mix={state.mix} scenarios={state.scenarios} />
    </PrintShell>
  );
}
