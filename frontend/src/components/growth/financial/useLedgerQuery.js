import { useCallback, useEffect, useRef, useState } from 'react';

const POLL_MS = 5000;
const POLL_MAX = 36; // ~3 minutos mientras se construye el histórico

/**
 * Carga datos del libro de pedidos y, si el backend responde `building: true`
 * (está construyendo el histórico), vuelve a preguntar cada 5 s.
 * `key` identifica la consulta (cliente + rango); `fetcher` devuelve los datos ya desenvueltos.
 */
export function useLedgerQuery(key, fetcher) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const fetcherRef = useRef(fetcher);
  const polls = useRef(0);
  const alive = useRef(true);
  useEffect(() => { fetcherRef.current = fetcher; });
  useEffect(() => () => { alive.current = false; }, []);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fetcherRef.current();
      if (alive.current) setState({ loading: false, data, error: null });
    } catch (err) {
      if (alive.current) setState((s) => ({ loading: false, data: silent ? s.data : null, error: err?.response?.data?.error || err?.message || 'No pudimos cargar los datos.' }));
    }
  }, []);

  // Nueva consulta (cambió cliente o rango)
  useEffect(() => { polls.current = 0; load(); }, [key, load]);

  // Mientras construye el histórico, refrescamos en silencio
  const building = Boolean(state.data?.building);
  useEffect(() => {
    if (!building || polls.current >= POLL_MAX) return undefined;
    const t = setTimeout(() => { polls.current += 1; load({ silent: true }); }, POLL_MS);
    return () => clearTimeout(t);
  }, [building, state.data, load]);

  const reload = useCallback(() => { polls.current = 0; load(); }, [load]);
  return { ...state, reload, pollsExhausted: building && polls.current >= POLL_MAX };
}
