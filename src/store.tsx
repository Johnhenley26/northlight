import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, Bootstrap } from './api';

type Toast = { id: number; message: string; tone: 'ok' | 'error' | 'info' };

type Ctx = {
  data: Bootstrap | null;
  ready: boolean;
  authed: boolean;
  refresh: () => Promise<void>;
  apply: (next: Partial<Bootstrap>) => void;
  run: (fn: () => Promise<unknown>, okMessage?: string) => Promise<boolean>;
  signup: (form: {
    name: string;
    handle: string;
    pin: string;
    highSchool?: string;
    college?: string;
    gradYear?: string;
  }) => Promise<void>;
  login: (handle: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  toast: (message: string, tone?: Toast['tone']) => void;
  toasts: Toast[];
  dismiss: (id: number) => void;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [ready, setReady] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, tone: Toast['tone'] = 'ok') => {
      const id = ++counter.current;
      setToasts((t) => [...t.slice(-2), { id, message, tone }]);
      window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 5200 : 3600);
    },
    []
  );

  const refresh = useCallback(async () => {
    try {
      const next = await api<Bootstrap>('/bootstrap');
      setData(next);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setData(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // light polling keeps a family thread feeling alive without a socket dependency
  useEffect(() => {
    if (!data) return;
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 20000);
    return () => window.clearInterval(t);
  }, [data, refresh]);

  const run = useCallback(
    async (fn: () => Promise<unknown>, okMessage?: string) => {
      try {
        await fn();
        await refresh();
        if (okMessage) toast(okMessage, 'ok');
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'That did not go through. Try again.';
        toast(msg, 'error');
        return false;
      }
    },
    [refresh, toast]
  );

  const signup = useCallback(
    async (form: {
      name: string;
      handle: string;
      pin: string;
      highSchool?: string;
      college?: string;
      gradYear?: string;
    }) => {
      await api('/auth/signup', { method: 'POST', body: form });
      await refresh();
    },
    [refresh]
  );

  const login = useCallback(
    async (handle: string, pin: string) => {
      await api('/auth/login', { method: 'POST', body: { handle, pin } });
      await refresh();
    },
    [refresh]
  );

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      setData(null);
    }
  }, []);

  const apply = useCallback((next: Partial<Bootstrap>) => {
    setData((d) => (d ? { ...d, ...next } : d));
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      data,
      ready,
      authed: !!data,
      refresh,
      apply,
      run,
      signup,
      login,
      logout,
      toast,
      toasts,
      dismiss,
    }),
    [data, ready, refresh, apply, run, signup, login, logout, toast, toasts, dismiss]
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

/* ------------------------------ small helpers ----------------------------- */

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'recently';
  const diff = Math.max(0, Date.now() - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function clockTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function mapsUrl(lat: number, lng: number, label = 'Northlight spot'): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}&layers=N`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}
