import { useMemo } from "react";
import { useStore } from "../state/store";
import { Button, Card, CountUp, StatusPill } from "../components/ui";
import {
  IconFund, IconSend, IconId, IconBank, IconArrowR, IconCheck, IconClock,
  IconWallet, IconBolt, IconReceipt, IconDownload,
} from "../components/icons";
import { cx, fmtMoney, timeAgo } from "../lib/utils";
import type { Transaction } from "../types";

function Sparkline({ txs }: { txs: Transaction[] }) {
  const pts = useMemo(() => {
    const sorted = [...txs].sort((a, b) => a.ts - b.ts);
    let run = 0;
    const series = sorted.map((t) => { run += t.amountCents - t.feeCents; return run; });
    if (series.length < 2) return null;
    const min = Math.min(...series), max = Math.max(...series);
    const W = 520, Hh = 96, pad = 6;
    const x = (i: number) => pad + (i / (series.length - 1)) * (W - pad * 2);
    const y = (v: number) => Hh - pad - ((v - min) / (max - min || 1)) * (Hh - pad * 2);
    const line = series.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    const area = `${line} L${x(series.length - 1)},${Hh} L${x(0)},${Hh} Z`;
    return { line, area, W, H: Hh };
  }, [txs]);
  if (!pts) return null;
  return (
    <svg viewBox={`0 0 ${pts.W} ${pts.H}`} className="h-[96px] w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2c8a67" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#2c8a67" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={pts.area} fill="url(#sparkfill)" />
      <path d={pts.line} fill="none" stroke="#1f7f56" strokeWidth="2.2" strokeLinecap="round" className="spark-draw" />
    </svg>
  );
}

const txTone = (t: Transaction) =>
  ["FAILED", "REJECTED", "EXPIRED"].includes(t.status) ? "text-bad"
  : ["REVERSED"].includes(t.status) ? "text-rev"
  : ["CANCELLED"].includes(t.status) ? "text-mute line-through decoration-mute/50"
  : t.amountCents >= 0 ? "text-ok" : "text-ink";

export function Dashboard() {
  const { snap, nav, settings } = useStore();
  const u = snap.user!;
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = u.name.split(" ")[0];

  const kycDone = snap.kyc?.status === "VERIFIED";
  const hasRail = snap.rails.some((r) => r.status === "ACTIVE");
  const hasFunded = snap.funding.some((f) => f.status === "SUCCEEDED") ||
    snap.transactions.some((t) => t.kind === "FUNDING" && t.status === "SUCCEEDED");
  const hasMoved = snap.transfers.some((t) => t.status === "COMPLETED");

  const checklist = [
    { done: kycDone, label: "Verify your identity", sub: "Unlocks funding & transfers", go: () => nav("kyc"), icon: <IconId className="text-[16px]" /> },
    { done: hasRail, label: "Link a bank rail", sub: "ACH · SEPA · FPS · WIRE", go: () => nav("rails"), icon: <IconBank className="text-[16px]" /> },
    { done: hasFunded, label: "Fund the wallet", sub: "Card, wire, or open banking", go: () => nav("fund"), icon: <IconFund className="text-[16px]" /> },
    { done: hasMoved, label: "Move money", sub: "Send, withdraw, or internal", go: () => nav("move"), icon: <IconSend className="text-[16px]" /> },
  ];
  const allDone = checklist.every((c) => c.done);

  const pipeline = [
    { label: "KYC", status: snap.kyc?.status ?? "NOT_STARTED", go: () => nav("kyc") },
    { label: "Rails", status: snap.rails.length === 0 ? "NOT_STARTED" : snap.rails[0].status, go: () => nav("rails") },
    { label: "Last funding", status: snap.funding[0]?.status ?? "NOT_STARTED", go: () => nav("fund") },
    { label: "Last transfer", status: snap.transfers[0]?.status ?? "NOT_STARTED", go: () => nav("move") },
  ];

  return (
    <div className="space-y-6">
      {/* balance board */}
      <div className="stagger grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Card className="relative overflow-hidden p-6 sm:p-7">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-pine/8 blur-2xl" />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-display text-[12px] font-semibold uppercase tracking-[0.14em] text-mute">{greet}, {firstName}</p>
              <div className="mt-2 flex items-baseline gap-3">
                <CountUp cents={snap.wallet?.availableCents ?? 0} className="text-[42px] font-semibold leading-none text-ink sm:text-[50px]" />
              </div>
              <p className="mt-2 text-[13px] text-mute">
                available · USD
                {snap.wallet && snap.wallet.pendingCents > 0 && (
                  <span className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-warn-soft px-2 py-0.5 font-mono text-[11px] font-medium text-warn">
                    <IconClock className="text-[11px]" /> {fmtMoney(snap.wallet.pendingCents)} in flight
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => nav("wallet")}><IconReceipt className="text-[14px]" /> Ledger</Button>
              <Button size="sm" onClick={() => nav("fund")}><IconFund className="text-[14px]" /> Fund</Button>
            </div>
          </div>
          <div className="mt-5 -mx-1"><Sparkline txs={snap.transactions} /></div>
          <div className="mt-1 flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.14em] text-mute">
            <span>balance · last {Math.min(snap.transactions.length, 12)} movements</span>
            <span className="flex items-center gap-1.5 text-ok"><span className="h-1.5 w-1.5 rounded-full bg-ok dot-live" />projected from ledger</span>
          </div>
        </Card>

        {/* onboarding checklist / pipeline */}
        <Card className="flex flex-col p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[13px] font-bold uppercase tracking-[0.12em] text-ink-soft">
              {allDone ? "Pipeline status" : "Get operational"}
            </h2>
            <span className="font-mono text-[11px] text-mute">{checklist.filter((c) => c.done).length}/{checklist.length}</span>
          </div>
          <div className="mt-4 space-y-2">
            {checklist.map((c) => (
              <button
                key={c.label} onClick={c.go}
                className={cx(
                  "group flex w-full items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-all duration-150",
                  c.done ? "border-line bg-paper/60" : "border-line-strong bg-surface hover:-translate-y-px hover:border-pine hover:shadow-card",
                )}
              >
                <span className={cx(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors",
                  c.done ? "bg-ok-soft text-ok" : "bg-pine-mist text-pine-deep",
                )}>
                  {c.done ? <IconCheck className="text-[15px]" /> : c.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cx("block text-[14px] font-semibold", c.done ? "text-mute line-through decoration-mute/40" : "text-ink")}>{c.label}</span>
                  <span className="block text-[11.5px] text-mute">{c.sub}</span>
                </span>
                {!c.done && <IconArrowR className="shrink-0 text-[15px] text-mute transition-all group-hover:translate-x-0.5 group-hover:text-pine" />}
              </button>
            ))}
          </div>
          <div className="mt-auto border-t border-line pt-4">
            <p className="mb-2.5 font-display text-[11px] font-bold uppercase tracking-[0.12em] text-mute">Live pipeline</p>
            <div className="flex flex-wrap gap-2">
              {pipeline.map((p) => (
                <button key={p.label} onClick={p.go} className="group flex items-center gap-2 rounded-lg border border-line bg-paper/70 px-2.5 py-1.5 transition-all hover:border-line-strong hover:bg-surface">
                  <span className="font-mono text-[10px] uppercase tracking-wide text-mute">{p.label}</span>
                  <StatusPill status={p.status} />
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* quick actions + recent activity */}
      <div className="stagger grid gap-4 lg:grid-cols-[1fr_1.5fr]">
        <Card className="p-6">
          <h2 className="font-display text-[13px] font-bold uppercase tracking-[0.12em] text-ink-soft">Move money</h2>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {[
              { label: "Fund", desc: "Add cash", icon: <IconFund className="text-[18px]" />, go: () => nav("fund"), tone: "text-pine-deep bg-pine-mist" },
              { label: "Send", desc: "Pay a beneficiary", icon: <IconSend className="text-[18px]" />, go: () => nav("move", "SEND"), tone: "text-gold-ink bg-gold-soft" },
              { label: "Withdraw", desc: "To your bank", icon: <IconDownload className="text-[18px]" />, go: () => nav("move", "WITHDRAW"), tone: "text-info bg-info-soft" },
              { label: "Internal", desc: "Between BMONI users", icon: <IconBolt className="text-[18px]" />, go: () => nav("move", "INTERNAL"), tone: "text-rev bg-rev-soft" },
            ].map((a) => (
              <button key={a.label} onClick={a.go}
                className="group rounded-xl border border-line bg-paper/50 p-4 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-line-strong hover:bg-surface hover:shadow-card">
                <span className={cx("mb-3 flex h-10 w-10 items-center justify-center rounded-lg", a.tone)}>{a.icon}</span>
                <span className="block font-display text-[15px] font-bold text-ink group-hover:text-pine-deep">{a.label}</span>
                <span className="block text-[12px] text-mute">{a.desc}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-line bg-paper/60 px-3.5 py-3">
            <p className="flex items-center gap-2 text-[12.5px] text-mute">
              <IconWallet className="shrink-0 text-[14px] text-pine" />
              Wallet <span className="font-mono text-[11.5px] text-ink-soft">{snap.wallet?.id}</span> · status{" "}
              <StatusPill status={snap.wallet?.status ?? "ACTIVE"} />
            </p>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-6 pb-3 pt-6">
            <h2 className="font-display text-[13px] font-bold uppercase tracking-[0.12em] text-ink-soft">Recent activity</h2>
            <button onClick={() => nav("wallet")} className="flex items-center gap-1 text-[13px] font-semibold text-pine transition-colors hover:text-pine-deep">
              View ledger <IconArrowR className="text-[13px]" />
            </button>
          </div>
          <div className="divide-y divide-line/70">
            {snap.transactions.slice(0, 6).map((t) => (
              <button key={t.id} onClick={() => nav("wallet", t.id)}
                className="group flex w-full items-center gap-4 px-6 py-3.5 text-left transition-colors hover:bg-pine-mist/30">
                <span className={cx(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  t.amountCents >= 0 ? "bg-ok-soft text-ok" : "bg-paper text-ink-soft",
                )}>
                  {t.amountCents >= 0 ? <IconFund className="text-[16px]" /> : <IconSend className="text-[16px]" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-ink group-hover:text-pine-deep">{t.title}</span>
                  <span className="block truncate text-[12px] text-mute">{t.counterparty} · {timeAgo(t.ts)}</span>
                </span>
                <span className="text-right">
                  <span className={cx("block font-mono text-[14px] font-semibold tabular", txTone(t))}>
                    {t.amountCents >= 0 ? "+" : ""}{fmtMoney(t.amountCents, { compact: settings.compactNumbers })}
                  </span>
                  <StatusPill status={t.status} className="mt-0.5" />
                </span>
              </button>
            ))}
            {snap.transactions.length === 0 && (
              <p className="px-6 py-10 text-center text-[13.5px] text-mute">
                No movements yet — fund the wallet to put the ledger to work.
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* state machine strip */}
      <div className="animate-fade-up rounded-xl border border-dashed border-line-strong bg-surface/60 px-5 py-4">
        <p className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-mute">
          Every record exposes its full state machine — hover any status pill above, then open its details for the timeline.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-[11px] text-mute">
          <span>funding: CREATED → REQUIRES_ACTION → PROCESSING → <b className="text-ok">SUCCEEDED</b> / <b className="text-bad">FAILED · CANCELLED · EXPIRED</b></span>
          <span>transfer: CREATED → PROCESSING → <b className="text-ok">COMPLETED</b> / <b className="text-bad">FAILED · CANCELLED</b> / <b className="text-rev">REVERSED</b></span>
          <span>kyc: NOT_STARTED → PENDING → <b className="text-ok">VERIFIED</b> / <b className="text-bad">REJECTED</b> / <b className="text-flip">RETRY_REQUIRED</b></span>
        </div>
      </div>
    </div>
  );
}

