import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AdminMeContext } from '../../components/admin/AdminConsoleContext';
import type { Me } from './api';

export type Route = (url: string, init?: RequestInit) => unknown;

/** Installs a fetch mock; `routes` maps "METHOD /path" (prefix match) → body or fn. */
export function mockFetch(routes: Record<string, unknown>) {
  const calls: { method: string; url: string; body: unknown }[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).replace('/api/admin/console', '');
    const method = (init?.method || 'GET').toUpperCase();
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url, body });
    const key = Object.keys(routes).sort((a, b) => b.length - a.length).find((k) => {
      const [m, p] = k.split(' ');
      return m === method && url.startsWith(p);
    });
    let out = key ? routes[key] : { detail: { message: 'not mocked' } };
    let status = key ? 200 : 404;
    if (typeof out === 'function') out = (out as Route)(url, init);
    if (out && typeof out === 'object' && '__status' in (out as object)) {
      status = (out as { __status: number }).__status;
      out = (out as { body: unknown }).body;
    }
    return new Response(JSON.stringify(out), { status, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fn);
  return calls;
}

export function renderAdmin(ui: ReactNode, me: Me = { username: 'mfadmin', role: 'admin', source: 'console' }, path = '/admin') {
  return render(<MemoryRouter initialEntries={[path]}><AdminMeContext.Provider value={me}>{ui}</AdminMeContext.Provider></MemoryRouter>);
}
