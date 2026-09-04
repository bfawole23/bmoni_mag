import { useEffect, useMemo, useState } from "react";
import { useStore } from "../state/store";
import { Button, Card, CopyChip, CountUp, Drawer, EmptyState, Segmented, Skeleton, StatusPill, Timeline } from "../components/ui";
import { IconSearch, IconFund, IconSend, IconReceipt, IconWallet, IconClock, IconInfo, IconDownload } from "../components/icons";
import { cx, fmtDateTime, fmtMoney, timeAgo } from "../lib/utils";
import type { Transaction } from "../types";

type Filter = "ALL" | "CREDITS" | "DEBITS" | "IN_FLIGHT";
const IN_FLIGHT = ["CREATED", "REQUIRES_ACTION", "PROCESSING", "PENDING", "VALIDATING"];

function TxRow({ t, onOpen, compact }: { t: Transaction; onOpen: () => void; compact?: boolean }) {
  const { settings } = useStore();
  const inflight = IN_FLIGHT.includes(t.status);
  const failed = ["FAILED", "REJECTED", "EXPIRED"].includes(t.status);
  return (
    <button onClick={onOpen}
      className="group flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-pine-mist/30 sm:px-6">
      <span className={cx(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
        failed ? "bg-bad-soft text-bad"
        : t.status === "REVERSED" ? "bg-rev-soft text-rev"
        : inflight ? "bg-info-soft text-info"
        : t.amountCents >= 0 ? "bg-ok-soft text-ok" : "bg-paper text-ink-soft",
      )}>
        {t.kind === "FUNDING" ? <IconFund className="text-[17px]" /> : t.status === "REVERSED" ? <IconClock className="text-[17px]" /> : <IconSend className="text-[17px]" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-semibold text-ink group-hover:text-pine-deep">{t.title}</span>
        <span className="block truncate text-[12px] text-mute">
          {t.counterparty} · {timeAgo(t.ts)} · <span className="font-mono text-[11px]">{t.providerRef}</span>
        </span>
      </span>
      {!compact && (
        <span className="hidden text-right sm:block">
          <span className={cx(
            "block font-mono text-[14.5px] font-semibold tabular",
            failed ? "text-bad" : t.status === "REVERSED" ? "text-rev"
            : t.status === "CANCELLED" ? "text-mute line-through decoration-mute/50"
            : t.amountCents >= 0 ? "text-ok" : "text-ink",
          )}>
            {t.amountCents >= 0 ? "+" : ""}{fmtMoney(t.amountCents, { compact: settings.compactNumbers })}
          </span>
          {t.feeCents > 0 && <span className="block font-mono text-[10.5px] text-mute">fee {fmtMoney(t.feeCents)}</span>}
        </span>
      )}
      <StatusPill status={t.status} />
    </button>
  );
}

export function WalletScreen() {
  const { snap, routeParam, nav, settings, toast } = useStore();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const [openTx, setOpenTx] = useState<Transaction | null>(null);

  useEffect(() => { const t = setTimeout(() => setLoading(false), 650); return () => clearTimeout(t); }, []);
  useEffect(() => {
    if (routeParam) {
      const t = snap.transactions.find((x) => x.id === routeParam);
      if (t) setOpenTx(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeParam]);

  /* keep the drawer's record live as its status updates */
  const liveOpen = openTx ? snap.transactions.find((x) => x.id === openTx.id) ?? openTx : null;

  const filtered = useMemo(() => {
    return snap.transactions.filter((t) => {
      if (filter === "CREDITS" && t.amountCents < 0) return false;
      if (filter === "DEBITS" && t.amountCents >= 0) return false;
      if (filter === "IN_FLIGHT" && !IN_FLIGHT.includes(t.status)) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!`${t.title} ${t.counterparty} ${t.providerRef} ${t.id}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [snap.transactions, filter, query]);

  const w = snap.wallet;

  /* real behaviour: download the filtered movements as CSV */
  const exportCsv = () => {
    const keyFor = (t: Transaction) =>
      snap.funding.find((f) => f.id === t.id)?.idempotencyKey ?? snap.transfers.find((x) => x.id === t.id)?.idempotencyKey ?? "";
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [
      ["id", "timestamp", "title", "counterparty", "kind", "status", "amount_usd", "fee_usd", "provider_ref", "idempotency_key"],
      ...filtered.map((t) => [
        t.id, new Date(t.ts).toISOString(), t.title, t.counterparty, `${t.kind}/${t.subKind}`, t.status,
        (t.amountCents / 100).toFixed(2), (t.feeCents / 100).toFixed(2), t.providerRef, keyFor(t),
      ]),
    ];
    const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bmoni-${w?.id?.toLowerCase() ?? "wallet"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("success", "Ledger exported", `${filtered.length} movement${filtered.length === 1 ? "" : "s"} → CSV.`);
  };

  const postedIn = snap.transactions.filter((t) => t.amountCents > 0 && !IN_FLIGHT.includes(t.status) && t.status !== "CANCELLED" && t.status !== "FAILED").reduce((s, t) => s + t.amountCents - t.feeCents, 0);
  const postedOut = snap.transactions.filter((t) => t.amountCents < 0 && !IN_FLIGHT.includes(t.status) && t.status !== "CANCELLED" && t.status !== "REVERSED").reduce((s, t) => s + t.amountCents - t.feeCents, 0);

  return (
    <div className="space-y-5">
      {/* wallet header */}
      <div className="stagger grid gap-4 md:grid-cols-3">
        <Card className="relative overflow-hidden p-6 md:col-span-2">
          <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-gold/10 blur-2xl" />
          <div className="flex items-center gap-2">
            <IconWallet className="text-[16px] text-pine" />
            <span className="font-display text-[12px] font-semibold uppercase tracking-[0.14em] text-mute">Wallet {w?.id}</span>
            <StatusPill status={w?.status ?? "ACTIVE"} />
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-x-10 gap-y-4">
            <div>
              <p className="text-[12px] font-medium uppercase tracking-wide text-mute">Available</p>
              {loading ? <Skeleton className="mt-2 h-9 w-44" /> : <CountUp cents={w?.availableCents ?? 0} className="text-[36px] font-semibold leading-none text-ink" />}
            </div>
            <div>
              <p className="text-[12px] font-medium uppercase tracking-wide text-mute">Pending / in flight</p>
              {loading ? <Skeleton className="mt-2 h-9 w-32" /> : (
                <CountUp cents={w?.pendingCents ?? 0} className={cx("text-[36px] font-semibold leading-none", (w?.pendingCents ?? 0) > 0 ? "text-warn" : "text-mute")} />
              )}
            </div>
            <div className="ml-auto flex gap-2">
              <Button size="sm" onClick={() => nav("fund")}>Fund</Button>
              <Button size="sm" variant="secondary" onClick={() => nav("move")}>Move</Button>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <p className="font-display text-[12px] font-semibold uppercase tracking-[0.14em] text-mute">30-day flow</p>
          <div className="mt-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-ink-soft">Money in (posted)</span>
              {loading ? <Skeleton className="h-5 w-20" /> : <span className="font-mono text-[14px] font-semibold tabular text-ok">+{fmtMoney(postedIn, { compact: settings.compactNumbers })}</span>}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-paper">
              <div className="h-full rounded-full bg-ok transition-all duration-700" style={{ width: `${postedIn + -postedOut > 0 ? (postedIn / (postedIn + -postedOut)) * 100 : 0}%` }} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-ink-soft">Money out (posted)</span>
              {loading ? <Skeleton className="h-5 w-20" /> : <span className="font-mono text-[14px] font-semibold tabular text-ink">−{fmtMoney(-postedOut, { compact: settings.compactNumbers })}</span>}
            </div>
            <div className="border-t border-line pt-3 text-[11.5px] leading-relaxed text-mute">
              Balances are projected from double-entry ledger entries — reserves reduce available until settlement.
            </div>
          </div>
        </Card>
      </div>

      {/* history */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4 sm:px-6">
          <h2 className="mr-auto font-display text-[15px] font-bold text-ink">Transaction history</h2>
          <Button size="sm" variant="secondary" onClick={exportCsv} title="Export the filtered movements as CSV">
            <IconDownload className="text-[13px]" /> CSV
          </Button>
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-mute" />
            <input
              value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search ledger…"
              className="w-[190px] rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-[13.5px] placeholder:text-mute/60 focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20"
            />
          </div>
          <Segmented<Filter>
            value={filter} onChange={setFilter}
            options={[
              { value: "ALL", label: "All" },
              { value: "CREDITS", label: "In" },
              { value: "DEBITS", label: "Out" },
              { value: "IN_FLIGHT", label: "In flight" },
            ]}
          />
        </div>

        {loading ? (
          <div className="space-y-3 p-6">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-2/5" /><Skeleton className="h-3 w-1/4" /></div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<IconReceipt className="text-[26px]" />}
            title={query || filter !== "ALL" ? "No matching entries" : "The ledger is empty"}
            body={query || filter !== "ALL" ? "Try a different search term or clear the filter." : "Fund the wallet or move money — every movement posts here as ledger entries."}
            action={<Button onClick={() => nav("fund")}>Fund wallet</Button>}
          />
        ) : (
          <div className="divide-y divide-line/70">
            {filtered.map((t) => <TxRow key={t.id} t={t} onOpen={() => setOpenTx(t)} />)}
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <p className="border-t border-line px-6 py-3 font-mono text-[11px] text-mute">
            {filtered.length} of {snap.transactions.length} movements · click any row for the state timeline & ledger entries
          </p>
        )}
      </Card>

      {/* detail drawer */}
      <Drawer open={!!liveOpen} onClose={() => setOpenTx(null)} title={liveOpen?.kind === "FUNDING" ? "Funding intent" : "Transfer"}>
        {liveOpen && (
          <div className="space-y-6">
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-[18px] font-bold leading-snug text-ink">{liveOpen.title}</h3>
                  <p className="mt-0.5 text-[13px] text-mute">{liveOpen.counterparty}</p>
                </div>
                <StatusPill status={liveOpen.status} />
              </div>
              <div className="mt-4 rounded-xl border border-line bg-surface p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-[12px] uppercase tracking-wide text-mute">Amount</span>
                  <span className={cx("font-mono text-[24px] font-semibold tabular", liveOpen.amountCents >= 0 ? "text-ok" : "text-ink")}>
                    {liveOpen.amountCents >= 0 ? "+" : ""}{fmtMoney(liveOpen.amountCents)}
                  </span>
                </div>
                {liveOpen.feeCents > 0 && (
                  <div className="mt-1.5 flex items-center justify-between text-[13px]">
                    <span className="text-mute">Provider / network fee</span>
                    <span className="font-mono tabular text-ink-soft">−{fmtMoney(liveOpen.feeCents)}</span>
                  </div>
                )}
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-line pt-3 text-[12px]">
                  <span className="text-mute">Reference</span>
                  <span className="text-right"><CopyChip text={liveOpen.providerRef} /></span>
                  <span className="text-mute">Idempotency-Key</span>
                  <span className="text-right">
                    {(() => {
                      const key = snap.funding.find((f) => f.id === liveOpen.id)?.idempotencyKey
                        ?? snap.transfers.find((x) => x.id === liveOpen.id)?.idempotencyKey;
                      return key ? <CopyChip text={key} label={`${key.slice(0, 14)}…`} /> : <span className="font-mono text-[11px] text-mute">seeded record</span>;
                    })()}
                  </span>
                  <span className="text-mute">Created</span>
                  <span className="text-right font-mono text-ink-soft">{fmtDateTime(liveOpen.ts)}</span>
                  <span className="text-mute">Method</span>
                  <span className="text-right font-medium text-ink-soft">{liveOpen.subKind.replace(/_/g, " ")}</span>
                </div>
              </div>
            </div>

            {["FAILED", "REVERSED", "EXPIRED", "CANCELLED", "REJECTED"].includes(liveOpen.status) && (
              <div className="rounded-lg border border-bad/25 bg-bad-soft px-4 py-3 text-[13px] font-medium leading-relaxed text-bad">
                {liveOpen.status === "REVERSED" ? "Settled, then recalled by the provider — the full amount was returned to available balance."
                  : liveOpen.status === "CANCELLED" ? "Cancelled before settlement — no funds moved, reservations released."
                  : liveOpen.status === "EXPIRED" ? "The payment instructions were not completed within the window."
                  : (snap.funding.find((f) => f.id === liveOpen.id)?.failReason ?? snap.transfers.find((t) => t.id === liveOpen.id)?.failReason ?? "The provider did not settle this intent.")}
              </div>
            )}

            <section>
              <h4 className="mb-3 font-display text-[12px] font-bold uppercase tracking-[0.12em] text-ink-soft">State timeline</h4>
              <Timeline events={liveOpen.events} failed={["FAILED", "REVERSED", "EXPIRED", "CANCELLED"].includes(liveOpen.status)} />
            </section>

            <section>
              <h4 className="mb-3 font-display text-[12px] font-bold uppercase tracking-[0.12em] text-ink-soft">
                Ledger entries <span className="ml-1 font-mono text-[10.5px] font-normal normal-case text-mute">({liveOpen.entries.length})</span>
              </h4>
              {liveOpen.entries.length === 0 ? (
                <p className="flex items-center gap-2 rounded-lg border border-dashed border-line-strong bg-surface px-3.5 py-3 text-[12.5px] text-mute">
                  <IconInfo className="shrink-0 text-[14px]" /> Nothing posted yet — entries land when the provider webhook is verified.
                </p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-line bg-surface">
                  {liveOpen.entries.map((e) => (
                    <div key={e.id} className="flex items-center justify-between gap-3 border-b border-line/60 px-3.5 py-2.5 last:border-0">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-ink">{e.description}</p>
                        <p className="font-mono text-[10.5px] text-mute">{e.type} · {fmtDateTime(e.ts)}</p>
                      </div>
                      <div className="text-right">
                        <p className={cx("font-mono text-[13px] font-semibold tabular", e.amountCents >= 0 ? "text-ok" : "text-ink")}>
                          {e.amountCents >= 0 ? "+" : ""}{fmtMoney(e.amountCents)}
                        </p>
                        <StatusPill status={e.status} className="mt-0.5" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {IN_FLIGHT.includes(liveOpen.status) && (
              <p className="rounded-lg bg-info-soft px-4 py-3 text-[12.5px] leading-relaxed text-info">
                This record is still moving through its state machine — the drawer updates live as webhooks arrive.
              </p>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}

