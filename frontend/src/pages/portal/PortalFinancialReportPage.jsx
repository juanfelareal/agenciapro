import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePortal } from '../../context/PortalContext';
import { portalFinancialsAPI } from '../../utils/portalApi';
import FinancialReport from '../../components/growth/financial/FinancialReport';
import PrintShell from '../../components/growth/financial/PrintShell';
import { currentPeriod } from '../../components/growth/financial/format';

/** Portal del cliente: /portal/imprimir/finanzas?period=YYYY-MM → informe imprimible. */
export default function PortalFinancialReportPage() {
  const { client } = usePortal();
  const [params] = useSearchParams();
  const period = /^\d{4}-\d{2}$/.test(params.get('period') || '') ? params.get('period') : currentPeriod();
  const [state, setState] = useState({ loading: true, error: null, data: null, patterns: null, mix: null, scenarios: [] });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [fin, patterns, mix, scen] = await Promise.all([
          portalFinancialsAPI.get(period),
          portalFinancialsAPI.patterns(90).then((d) => (d?.heatmap ? d : null)).catch(() => null),
          portalFinancialsAPI.customerMix().then((d) => (d?.new ? d : null)).catch(() => null),
          portalFinancialsAPI.scenarios({ period }).then((d) => d?.scenarios || []).catch(() => []),
        ]);
        if (cancelled) return;
        document.title = `Finanzas ${client?.nickname || client?.company || ''} ${period}`.trim();
        setState({ loading: false, error: null, data: fin, patterns, mix, scenarios: scen });
      } catch (e) {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: e.response?.data?.error || 'No pudimos cargar el informe.' }));
      }
    })();
    return () => { cancelled = true; };
  }, [period, client]);

  return (
    <PrintShell loading={state.loading} error={state.error} autoPrint={!params.get('noprint')}>
      <FinancialReport data={state.data} client={client} period={period} patterns={state.patterns} mix={state.mix} scenarios={state.scenarios} portal />
    </PrintShell>
  );
}
