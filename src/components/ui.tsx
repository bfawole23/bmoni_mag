import { useEffect, useRef, useState, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type ButtonHTMLAttributes } from "react";
import { cx, copyText, fmtMoney } from "../lib/utils";
import { IconCheck, IconCopy, IconX, IconAlert, IconInfo } from "./icons";
import type { Toast } from "../state/store";

/* ---------------- spinner ---------------- */
export const Spinner = ({ className = "" }: { className?: string }) => (
  <svg className={cx("animate-spin", className)} viewBox="0 0 24 24" width="1em" height="1em" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

/* ---------------- button ---------------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "gold" | "dark";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};
export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }: BtnProps) {
  const base = "inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine active:translate-y-px disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";
  const sizes = { sm: "text-[13px] px-3 py-1.5", md: "text-sm px-4 py-2.5", lg: "text-[15px] px-6 py-3" };
  const variants = {
    primary: "bg-pine text-[#f2f7f2] hover:bg-pine-deep shadow-sm",
    dark: "bg-pine-ink text-[#e8efe8] hover:bg-[#1c3a2e] shadow-sm",
    gold: "bg-gold text-[#241703] hover:bg-[#b57722] shadow-sm",
    secondary: "bg-surface text-ink border border-line-strong hover:border-pine hover:text-pine",
    ghost: "text-ink-soft hover:bg-pine-mist hover:text-pine-deep",
    danger: "bg-bad text-[#fdf3f1] hover:bg-[#963229] shadow-sm",
  };
  return (
    <button
      className={cx(base, sizes[size], variant === "danger" ? "bg-bad text-[#fdf3f1] hover:bg-[#963229] shadow-sm" : variants[variant], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner className="text-[1em]" />}
      {children}
    </button>
  );
}

/* ---------------- status pill ---------------- */
const STATUS_STYLE: Record<string, { cls: string; dot?: "warn" | "proc" }> = {
  VERIFIED: { cls: "bg-ok-soft text-ok" },
  ACTIVE: { cls: "bg-ok-soft text-ok" },
  SUCCEEDED: { cls: "bg-ok-soft text-ok" },
  COMPLETED: { cls: "bg-ok-soft text-ok" },
  POSTED: { cls: "bg-ok-soft text-ok" },
  PENDING: { cls: "bg-warn-soft text-warn", dot: "warn" },
  IN_PROGRESS: { cls: "bg-warn-soft text-warn", dot: "warn" },
  VALIDATING: { cls: "bg-warn-soft text-warn", dot: "warn" },
  REQUIRES_ACTION: { cls: "bg-warn-soft text-warn", dot: "warn" },
  CREATED: { cls: "bg-warn-soft text-warn", dot: "warn" },
  RESERVED: { cls: "bg-warn-soft text-warn", dot: "warn" },
  PROCESSING: { cls: "bg-info-soft text-info", dot: "proc" },
  FAILED: { cls: "bg-bad-soft text-bad" },
  REJECTED: { cls: "bg-bad-soft text-bad" },
  FROZEN: { cls: "bg-bad-soft text-bad" },
  EXPIRED: { cls: "bg-bad-soft text-bad" },
  CANCELLED: { cls: "bg-[#e8ebe6] text-mute" },
  DEACTIVATED: { cls: "bg-[#e8ebe6] text-mute" },
  NOT_STARTED: { cls: "bg-[#e8ebe6] text-mute" },
  RETRY_REQUIRED: { cls: "bg-flip-soft text-flip" },
  REVERSED: { cls: "bg-rev-soft text-rev" },
};
export const statusLabel = (s: string) =>
  s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const st = STATUS_STYLE[status] ?? { cls: "bg-[#e8ebe6] text-mute" };
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide font-display", st.cls, className)}>
      {st.dot && <span className={cx("h-1.5 w-1.5 rounded-full", st.dot === "warn" ? "bg-warn dot-live" : "bg-info dot-proc")} />}
      {statusLabel(status)}
    </span>
  );
}

/* ---------------- money ---------------- */
export function CountUp({ cents, className, sign }: { cents: number; className?: string; sign?: boolean }) {
  const [val, setVal] = useState(cents);
  const prev = useRef(cents);
  useEffect(() => {
    const from = prev.current;
    prev.current = cents;
    if (from === cents) return;
    const start = performance.now();
    const dur = 620;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(from + (cents - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cents]);
  return <span className={cx("tabular font-mono", className)}>{fmtMoney(val, { sign })}</span>;
}

/* ---------------- form field ---------------- */
interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string; hint?: string; error?: string; right?: ReactNode;
}
export function Field({ label, hint, error, right, className, id, ...rest }: FieldProps) {
  const fid = id ?? `f_${label.replace(/\W/g, "")}`;
  return (
    <label htmlFor={fid} className="block text-left">
      <span className="mb-1.5 flex items-baseline justify-between">
        <span className="font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{label}</span>
        {hint && <span className="text-[11px] text-mute">{hint}</span>}
      </span>
      <span className="relative block">
        <input
          id={fid}
          className={cx(
            "w-full rounded-lg border bg-surface px-3.5 py-2.5 text-[15px] text-ink placeholder:text-mute/60 transition-all",
            "focus:outline-none focus:ring-2",
            error ? "border-bad focus:ring-bad/25" : "border-line-strong focus:border-pine focus:ring-pine/20",
            right ? "pr-11" : undefined,
            className,
          )}
          {...rest}
        />
        {right && <span className="absolute inset-y-0 right-2.5 flex items-center">{right}</span>}
      </span>
      {error && (
        <span className="mt-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-bad">
          <IconAlert className="text-[13px] shrink-0" />{error}
        </span>
      )}
    </label>
  );
}

interface SelProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string; error?: string; children: ReactNode;
}
export function Select({ label, error, children, className, id, ...rest }: SelProps) {
  const fid = id ?? `s_${label.replace(/\W/g, "")}`;
  return (
    <label htmlFor={fid} className="block text-left">
      <span className="mb-1.5 block font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{label}</span>
      <select
        id={fid}
        className={cx(
          "w-full appearance-none rounded-lg border bg-surface px-3.5 py-2.5 text-[15px] text-ink transition-all focus:outline-none focus:ring-2",
          "bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2364736b%22 stroke-width=%222%22%3E%3Cpath d=%22m6 9 6 6 6-6%22/%3E%3C/svg%3E')] bg-[right_0.7rem_center] bg-no-repeat pr-9",
          error ? "border-bad focus:ring-bad/25" : "border-line-strong focus:border-pine focus:ring-pine/20",
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      {error && <span className="mt-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-bad"><IconAlert className="text-[13px]" />{error}</span>}
    </label>
  );
}

/* ---------------- card ---------------- */
export const Card = ({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) => (
  <div
    onClick={onClick}
    className={cx(
      "rounded-xl border border-line bg-surface shadow-card",
      onClick && "cursor-pointer transition-all hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card",
      className,
    )}
  >
    {children}
  </div>
);

/* ---------------- segmented control ---------------- */
export function Segmented<T extends string>({ options, value, onChange, className }: {
  options: Array<{ value: T; label: ReactNode }>;
  value: T; onChange: (v: T) => void; className?: string;
}) {
  return (
    <div className={cx("inline-flex rounded-lg border border-line bg-paper p-1", className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value} role="tab" aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded-md px-3.5 py-1.5 font-display text-[13px] font-semibold transition-all",
            value === o.value ? "bg-pine-ink text-[#e9f0e9] shadow-sm" : "text-ink-soft hover:text-pine-deep",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- toggle ---------------- */
export function Toggle({ on, onChange, label, desc }: { on: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <button onClick={() => onChange(!on)} className="flex w-full items-center justify-between gap-4 py-1 text-left group" role="switch" aria-checked={on}>
      <span>
        <span className="block text-[14.5px] font-semibold text-ink group-hover:text-pine-deep transition-colors">{label}</span>
        {desc && <span className="block text-[12.5px] text-mute">{desc}</span>}
      </span>
      <span className={cx("relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200", on ? "bg-pine" : "bg-line-strong")}>
        <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-all duration-200", on ? "left-[22px]" : "left-0.5")} />
      </span>
    </button>
  );
}

/* ---------------- modal ---------------- */
export function Modal({ open, onClose, title, children, width = "max-w-md" }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-pine-ink/55 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div className={cx("relative w-full rounded-xl border border-line bg-surface shadow-pop animate-pop", width)}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="font-display text-[16px] font-bold text-ink">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1.5 text-mute transition-colors hover:bg-paper hover:text-ink" aria-label="Close">
            <IconX className="text-[16px]" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/* ---------------- drawer ---------------- */
export function Drawer({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-pine-ink/50 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col overflow-y-auto border-l border-line bg-paper shadow-pop animate-slide-left">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-paper/95 px-5 py-4 backdrop-blur">
          <div className="font-display text-[15px] font-bold text-ink">{title ?? "Details"}</div>
          <button onClick={onClose} className="rounded-md p-1.5 text-mute transition-colors hover:bg-surface hover:text-ink" aria-label="Close">
            <IconX className="text-[16px]" />
          </button>
        </div>
        <div className="flex-1 px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

/* ---------------- state timeline ---------------- */
export function Timeline({ events, failed }: { events: Array<{ state: string; at: number; note?: string }>; failed?: boolean }) {
  if (!events.length) return null;
  return (
    <ol className="relative ml-1.5 space-y-4 border-l-2 border-line pl-5">
      {events.map((e, i) => {
        const last = i === events.length - 1;
        const bad = ["FAILED", "REJECTED", "EXPIRED", "REVERSED", "RETRY_REQUIRED"].includes(e.state);
        const good = ["VERIFIED", "ACTIVE", "SUCCEEDED", "COMPLETED", "POSTED"].includes(e.state);
        return (
          <li key={`${e.state}_${e.at}_${i}`} className="relative">
            <span className={cx(
              "absolute -left-[27px] top-0.5 h-3.5 w-3.5 rounded-full border-2 border-paper",
              bad ? "bg-bad" : good ? "bg-ok" : last && !failed ? "bg-info" : "bg-line-strong",
              last && !bad && !good && "dot-proc",
            )} />
            <div className="flex items-center gap-2">
              <StatusPill status={e.state} />
            </div>
            {e.note && <p className="mt-1 text-[12.5px] leading-snug text-mute">{e.note}</p>}
            <p className="mt-0.5 font-mono text-[11px] text-mute/80 tabular">
              {new Date(e.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------------- misc ---------------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton rounded-md", className)} />;
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-line-strong bg-paper text-[24px] text-mute">
        {icon}
      </div>
      <h3 className="font-display text-[16px] font-bold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-[340px] text-[13.5px] leading-relaxed text-mute">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function CopyChip({ text, label }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => { if (await copyText(text)) { setDone(true); setTimeout(() => setDone(false), 1600); } }}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[12px] transition-all",
        done ? "border-ok bg-ok-soft text-ok" : "border-line-strong bg-surface text-ink-soft hover:border-pine hover:text-pine",
      )}
    >
      {done ? <IconCheck className="text-[12px]" /> : <IconCopy className="text-[12px]" />}
      {label ?? text}
    </button>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-bad/30 bg-bad-soft px-3.5 py-3 text-[13.5px] font-medium text-bad animate-pop">
      <IconAlert className="mt-0.5 shrink-0 text-[15px]" />
      <span>{message}</span>
    </div>
  );
}

export function InfoBanner({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-info/25 bg-info-soft px-3.5 py-3 text-[13px] leading-relaxed text-info">
      <IconInfo className="mt-0.5 shrink-0 text-[15px]" />
      <span>{children}</span>
    </div>
  );
}

/* ---------------- toast host ---------------- */
export function ToastHost({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  const tone = {
    success: { bar: "bg-ok", icon: <IconCheck className="text-ok" /> },
    error: { bar: "bg-bad", icon: <IconAlert className="text-bad" /> },
    warning: { bar: "bg-warn", icon: <IconAlert className="text-warn" /> },
    info: { bar: "bg-info", icon: <IconInfo className="text-info" /> },
  };
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[70] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2.5">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto relative overflow-hidden rounded-lg border border-line bg-surface shadow-pop animate-toast">
          <span className={cx("absolute inset-y-0 left-0 w-1", tone[t.kind].bar)} />
          <div className="flex items-start gap-3 py-3 pl-4 pr-3">
            <span className="mt-0.5 text-[16px]">{tone[t.kind].icon}</span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[13.5px] font-bold text-ink">{t.title}</p>
              {t.body && <p className="mt-0.5 text-[12.5px] leading-snug text-mute">{t.body}</p>}
            </div>
            <button onClick={() => onDismiss(t.id)} className="rounded p-1 text-mute transition-colors hover:bg-paper hover:text-ink" aria-label="Dismiss">
              <IconX className="text-[13px]" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
