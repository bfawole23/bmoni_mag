import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from "react";
import { api } from "../mock/api";
import type { Snapshot } from "../types";
import { LS, uid } from "../lib/utils";

export type Route =
  | "dashboard" | "wallet" | "fund" | "move" | "kyc" | "rails" | "account";

export interface Toast {
  id: string;
  kind: "success" | "error" | "info" | "warning";
  title: string;
  body?: string;
}

interface Settings {
  compactNumbers: boolean;
  notifyFunding: boolean;
  notifyTransfers: boolean;
  notifyKyc: boolean;
}

interface Store {
  ready: boolean;
  snap: Snapshot;
  route: Route;
  routeParam: string | null;
  nav: (r: Route, param?: string) => void;
  toasts: Toast[];
  toast: (kind: Toast["kind"], title: string, body?: string) => void;
  dismissToast: (id: string) => void;
  signOut: () => Promise<void>;
  settings: Settings;
  setSettings: (patch: Partial<Settings>) => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (v: boolean) => void;
}

const Ctx = createContext<Store | null>(null);

const SETTINGS_KEY = "bmoni.settings.v1";
const EMPTY: Snapshot = {
  user: null, wallet: null, kyc: null, rails: [], beneficiaries: [], funding: [],
  transfers: [], transactions: [], notifications: [], devices: [],
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [snap, setSnap] = useState<Snapshot>(EMPTY);
  const [route, setRoute] = useState<Route>("dashboard");
  const [routeParam, setRouteParam] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [settings, setSettingsState] = useState<Settings>(() =>
    LS.get<Settings>(SETTINGS_KEY, { compactNumbers: false, notifyFunding: true, notifyTransfers: true, notifyKyc: true }),
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const seenNotis = useRef<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    const sync = () => { if (alive) setSnap(api.getSnapshot()); };
    const unsub = api.subscribe(sync);
    api.init().then(() => { sync(); if (alive) setReady(true); });
    return () => { alive = false; unsub(); };
  }, []);

  /* turn fresh notifications into toasts */
  useEffect(() => {
    if (!snap.user) { seenNotis.current = new Set(); return; }
    const fresh = snap.notifications.filter((n) => !n.read && !seenNotis.current.has(n.id));
    for (const n of fresh.slice(0, 2)) {
      seenNotis.current.add(n.id);
      const kind = n.kind === "error" ? "error" : n.kind === "warning" ? "warning" : n.kind === "success" ? "success" : "info";
      pushToast(kind, n.title, n.body);
    }
    snap.notifications.forEach((n) => seenNotis.current.add(n.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.notifications]);

  const pushToast = useCallback((kind: Toast["kind"], title: string, body?: string) => {
    const id = uid("T");
    setToasts((t) => [...t.slice(-3), { id, kind, title, body }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const nav = useCallback((r: Route, param?: string) => {
    setRoute(r);
    setRouteParam(param ?? null);
    setMobileNavOpen(false);
    window.scrollTo({ top: 0 });
  }, []);

  const signOut = useCallback(async () => {
    await api.logout();
    setRoute("dashboard");
  }, []);

  const setSettings = useCallback((patch: Partial<Settings>) => {
    setSettingsState((s) => {
      const next = { ...s, ...patch };
      LS.set(SETTINGS_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo<Store>(() => ({
    ready, snap, route, routeParam, nav, toasts, toast: pushToast, dismissToast,
    signOut, settings, setSettings, mobileNavOpen, setMobileNavOpen,
  }), [ready, snap, route, routeParam, nav, toasts, pushToast, dismissToast, signOut, settings, setSettings, mobileNavOpen]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}
