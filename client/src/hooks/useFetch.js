import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../services/api.js';

/** GET helper with loading/error state, cancellation of stale responses, and reload(). */
export default function useFetch(url, { params, enabled = true } = {}) {
  const [state, setState] = useState({ data: null, meta: null, loading: enabled, error: null });
  const seq = useRef(0); const key = JSON.stringify([url, params]);
  const run = useCallback(async () => {
    if (!enabled || !url) return;
    const id = ++seq.current; setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { data } = await api.get(url, { params });
      if (id === seq.current) setState({ data: data.data, meta: data.meta || null, loading: false, error: null });
    } catch (e) { if (id === seq.current) setState((s) => ({ ...s, loading: false, error: e.message })); }
  }, [key, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { run(); }, [run]);
  return { ...state, reload: run };
}
