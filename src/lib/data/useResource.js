import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Generic polling data hook.
 * @param {(signal: AbortSignal) => Promise<any>} fetcher
 * @param {{ intervalMs?: number, fallback?: any, enabled?: boolean }} opts
 */
export function useResource(fetcher, opts = {}) {
  const { intervalMs, fallback = null, enabled = true } = opts;
  const [data, setData] = useState(fallback);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const lastGood = useRef(fallback);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async (signal) => {
    try {
      const result = await fetcherRef.current(signal);
      if (signal.aborted) return;
      lastGood.current = result;
      setData(result);
      setError(null);
    } catch (err) {
      if (signal.aborted || err.name === "AbortError") return;
      setError(err);
      setData(lastGood.current); // degrade to last-good, never to null
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    load(controller.signal);
    const id = intervalMs
      ? setInterval(() => load(controller.signal), intervalMs)
      : null;
    return () => {
      controller.abort();
      if (id) clearInterval(id);
    };
  }, [enabled, intervalMs, load]);

  return { data, error, loading, isStale: error != null && data != null };
}
