import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ConsoleApiError } from '../../pages/admin/api';

export function useLoad<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // loader 每次渲染都是新函数：存进 ref，只按 deps 重新加载
  const loaderRef = useRef(loader);
  useLayoutEffect(() => { loaderRef.current = loader; });
  const depKey = JSON.stringify(deps);
  const run = useCallback(async () => {
    try {
      setData(await loaderRef.current());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);
  const reload = useCallback(async () => { setLoading(true); await run(); }, [run]);
  useEffect(() => { void run(); }, [run, depKey]);
  return { data, setData, error, loading, reload };
}

export function errText(e: unknown): { message: string; errors: string[] } {
  if (e instanceof ConsoleApiError) return { message: e.message, errors: e.errors };
  return { message: e instanceof Error ? e.message : '操作失败', errors: [] };
}

