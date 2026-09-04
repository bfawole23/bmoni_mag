export const cx = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

export const uid = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`.toUpperCase();

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const fmtMoney = (cents: number, opts: { sign?: boolean; compact?: boolean } = {}) => {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const body = (abs / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const compact = opts.compact && abs >= 100000
    ? `$${(abs / 100000).toFixed(1)}k`
    : `$${body}`;
  if (opts.compact && abs >= 100000) return `${neg ? "−" : ""}${compact}`;
  return `${neg ? "−" : opts.sign ? "+" : ""}${compact}`;
};

export const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export const fmtTime = (ts: number) =>
  new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export const fmtDateTime = (ts: number) => `${fmtDate(ts)} · ${fmtTime(ts)}`;

export const timeAgo = (ts: number) => {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return fmtDate(ts);
};

export const maskAccount = (account: string) =>
  account.replace(/\s/g, "").length <= 4
    ? account
    : `•••• ${account.replace(/\s/g, "").slice(-4)}`;

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");

export const parseAmount = (raw: string): number | null => {
  const n = Number(raw.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
};

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }
}

export const LS = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch { /* storage full — non-fatal in sandbox */ }
  },
  del(key: string) {
    try { localStorage.removeItem(key); } catch { /* noop */ }
  },
};
