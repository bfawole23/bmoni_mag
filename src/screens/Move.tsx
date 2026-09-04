import { useMemo, useState } from "react";
import { api, kindLabel, quoteTransferFee, DAILY_LIMIT_CENTS, getDailyOutflowCents } from "../mock/api";
import { ApiError, type Transfer, type TransferKind } from "../types";
import { useStore } from "../state/store";
import { Button, Card, CopyChip, CountUp, ErrorBanner, Field, InfoBanner, Select, StatusPill, Timeline } from "../components/ui";
import { IconSend, IconDownload, IconBolt, IconArrowR, IconLock, IconCheck, IconX, IconAlert, IconRefresh, IconId, IconBank } from "../components/icons";
import { cx, fmtDateTime, fmtMoney, parseAmount, timeAgo } from "../lib/utils";

type Stage = "compose" | "review" | "live" | "done";
const TABS: Array<{ kind: TransferKind; label: string; desc: string; icon: React.ReactNode }> = [
  { kind: "SEND", label: "Send", desc: "Pay a verified beneficiary", icon: <IconSend className="text-[16px]" /> },
  { kind: "WITHDRAW", label: "Withdraw", desc: "To your own linked account", icon: <IconDownload className="text-[16px]" /> },
  { kind: "INTERNAL", label: "Internal", desc: "To another BMONI wallet", icon: <IconBolt className="text-[16px]" /> },
];

export function MoveScreen() {
  const { snap, nav, routeParam, toast } = useStore();
  const kycOk = snap.kyc?.status === "VERIFIED";

  const [kind, setKind] = useState<TransferKind>(
    routeParam === "SEND" || routeParam === "WITHDRAW" || routeParam === "INTERNAL" ? (routeParam as TransferKind) : "SEND",
  );
  const [stage, setStage] = useState<Stage>("compose");
  const [amountRaw, setAmountRaw] = useState("120.00");
  const [beneficiaryId, setBeneficiaryId] = useState("");
  const [railId, setRailId] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [reuseKey, setReuseKey] = useState<string | null>(null);

  const verified = snap.beneficiaries.filter((b) => b.status === "VERIFIED");
  const activeRails = snap.rails.filter((r) => r.status === "ACTIVE");
  const active = useMemo(() => snap.transfers.find((t) => t.id === activeId) ?? null, [snap.transfers, activeId]);

  const amountCents = parseAmount(amountRaw);
  const fee = amountCents ? quoteTransferFee(kind, amountCents) : 0;
  const avail = snap.wallet?.availableCents ?? 0;

  async function run(fn: () => Promise<void>) {
    setBusy(true); setErr(null); setFields({});
    try { await fn(); }
    catch (e) {
      const ae = e as ApiError;
      if (ae.fields) setFields(ae.fields);
      setErr(ae.message);
      setStage("compose");
    } finally { setBusy(false); }
  }

  /* safe retry: prefill the failed transfer and replay its Idempotency-Key */
  const retryFailed = (t: Transfer) => {
    setKind(t.kind);
    setAmountRaw((t.amountCents / 100).toFixed(2));
    if (t.kind === "SEND") {
      const b = snap.beneficiaries.find((x) => x.name === t.destination);
      if (b) setBeneficiaryId(b.id);
    } else if (t.kind === "WITHDRAW") {
      const r = snap.rails.find((x) => `${x.institution} ${x.accountMasked}` === t.destination);
      if (r) setRailId(r.id);
    } else setEmail(t.destination);
    setNote(t.note ?? "");
    setReuseKey(t.idempotencyKey ?? null);
    setActiveId(null);
    setStage("compose");
    toast("info", "Safe retry armed", "Same Idempotency-Key — the ledger cannot double-post.");
  };

  if (!kycOk) {
    return (
      <div className="mx-auto max-w-[640px]">
        <Card className="overflow-hidden">
          <div className="relative overflow-hidden bg-[#241b10] px-7 py-9">
            <div className="relative z-10 flex items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-gold text-pine-ink"><IconLock className="text-[24px]" /></span>
              <div>
                <h2 className="font-display text-[22px] font-bold tracking-tight text-[#f4efe4]">Money movement needs verified identity</h2>
                <p className="mt-1 text-[13.5px] text-[#cbbfa4]">Transfers, withdrawals and internal moves all pass the same KYC gate.</p>
              </div>
            </div>
          </div>
          <div className="space-y-4 px-7 py-6">
            <div className="flex items-center justify-between rounded-lg border border-line bg-paper/60 px-4 py-3">
              <span className="text-[13.5px] font-medium text-ink-soft">Your KYC status</span>
              <StatusPill status={snap.kyc?.status ?? "NOT_STARTED"} />
            </div>
            <Button size="lg" className="w-full" onClick={() => nav("kyc")}><IconId className="text-[16px]" /> Complete identity verification</Button>
          </div>
        </Card>
      </div>
    );
  }

  const destName = kind === "SEND"
    ? snap.beneficiaries.find((b) => b.id === beneficiaryId)?.name
    : kind === "WITHDRAW"
      ? (() => { const r = snap.rails.find((x) => x.id === railId); return r ? `${r.institution} ${r.accountMasked}` : undefined; })()
      : email || undefined;

  return (
    <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
      <div className="space-y-5">
        <Card className="p-6 sm:p-7">
          {/* kind tabs */}
          <div className="mb-6 grid grid-cols-3 gap-2">
            {TABS.map((t) => (
              <button key={t.kind} onClick={() => { if (stage === "compose" || stage === "review") { setKind(t.kind); setStage("compose"); setErr(null); setFields({}); } }}
                className={cx("rounded-xl border px-3 py-3 text-left transition-all",
                  kind === t.kind ? "border-pine bg-pine-mist/70 shadow-card" : "border-line bg-surface hover:border-line-strong",
                  (stage === "live" || stage === "done") && "pointer-events-none opacity-60")}>
                <span className={cx("flex items-center gap-2 font-display text-[14px] font-bold", kind === t.kind ? "text-pine-deep" : "text-ink")}>{t.icon}{t.label}</span>
                <span className="mt-0.5 hidden text-[11px] leading-tight text-mute sm:block">{t.desc}</span>
              </button>
            ))}
          </div>

          {stage === "compose" && (
            <div className="stagger space-y-4">
              {err && <ErrorBanner message={err} />}
              {kind === "SEND" && (
                verified.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-line-strong bg-paper/50 px-5 py-6 text-center">
                    <p className="font-display text-[15px] font-bold text-ink">No verified beneficiaries</p>
                    <p className="mx-auto mt-1 max-w-[320px] text-[12.5px] text-mute">Sending requires a VERIFIED beneficiary — add one over an active rail first.</p>
                    <Button className="mt-4" variant="secondary" onClick={() => nav("rails")}><IconBank className="text-[14px]" /> Manage beneficiaries</Button>
                  </div>
                ) : (
                  <Select label="Beneficiary" value={beneficiaryId} error={fields.beneficiary} onChange={(e) => setBeneficiaryId(e.target.value)}>
                    <option value="">Select…</option>
                    {verified.map((b) => <option key={b.id} value={b.id}>{b.name} — {b.rail} {b.accountMasked}</option>)}
                  </Select>
                )
              )}
              {kind === "WITHDRAW" && (
                activeRails.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-line-strong bg-paper/50 px-5 py-6 text-center">
                    <p className="font-display text-[15px] font-bold text-ink">No active linked account</p>
                    <p className="mx-auto mt-1 max-w-[320px] text-[12.5px] text-mute">Withdrawals settle to an ACTIVE account on a payment rail.</p>
                    <Button className="mt-4" variant="secondary" onClick={() => nav("rails")}><IconBank className="text-[14px]" /> Link an account</Button>
                  </div>
                ) : (
                  <Select label="Withdraw to" value={railId} error={fields.rail} onChange={(e) => setRailId(e.target.value)}>
                    <option value="">Select…</option>
                    {activeRails.map((r) => <option key={r.id} value={r.id}>{r.institution} {r.accountMasked} — {r.rail}</option>)}
                  </Select>
                )
              )}
              {kind === "INTERNAL" && (
                <>
                  <Field label="Recipient BMONI email" type="email" placeholder="jules@company.com" value={email} error={fields.email}
                    onChange={(e) => setEmail(e.target.value)} hint="@fail domain → fails" />
                  <InfoBanner>Internal transfers move ledger balances between BMONI wallets — no rail, no fee, settles in about a second.</InfoBanner>
                </>
              )}

              {destReady(kind, beneficiaryId, railId, email) && (
                <>
                  <div className="rounded-xl border border-line bg-paper/50 p-5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[24px] text-mute">$</span>
                      <input value={amountRaw} onChange={(e) => setAmountRaw(e.target.value)} inputMode="decimal"
                        className="w-full bg-transparent font-mono text-[32px] font-semibold tabular text-ink outline-none" placeholder="0.00" />
                      <button onClick={() => setAmountRaw(((avail - fee) / 100).toFixed(2))}
                        className="shrink-0 rounded-md border border-line-strong bg-surface px-2.5 py-1 font-mono text-[11px] font-semibold text-pine hover:border-pine">
                        MAX
                      </button>
                    </div>
                    {fields.amount && <p className="mt-2 flex items-center gap-1.5 text-[12.5px] font-medium text-bad"><IconAlert className="text-[13px]" />{fields.amount}</p>}
                  </div>
                  {kind === "SEND" && (
                    <Field label="Note (optional)" placeholder="INV-2052" value={note} onChange={(e) => setNote(e.target.value)} />
                  )}
                  <div className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3 text-[13.5px]">
                    <span className="text-mute">Fee · {kind === "SEND" ? "0.5% (min $0.25)" : kind === "WITHDRAW" ? "$1.00 flat" : "free"}</span>
                    <span className="font-mono font-semibold tabular text-ink">{fee ? fmtMoney(fee) : "Free"}</span>
                  </div>
                  <div className="flex justify-end">
                    <Button size="lg" onClick={() => { if (!amountCents) { setFields({ amount: "Enter an amount." }); return; } setErr(null); setStage("review"); }}>
                      Review {kindLabel(kind).toLowerCase()} <IconArrowR className="text-[15px]" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {stage === "review" && amountCents && (
            <div className="animate-fade-up">
              <h2 className="font-display text-[19px] font-bold tracking-tight text-ink">Confirm the {kindLabel(kind).toLowerCase()}</h2>
              <div className="mt-5 overflow-hidden rounded-xl border border-line">
                {[
                  ["Type", kindLabel(kind)],
                  [kind === "INTERNAL" ? "Recipient" : "Destination", destName ?? "—"],
                  ["Amount", fmtMoney(amountCents)],
                  ["Fee", fee ? fmtMoney(fee) : "Free"],
                  ["Total reserved now", fmtMoney(amountCents + fee)],
                  ["Available after reservation", fmtMoney(Math.max(0, avail - amountCents - fee))],
                ].map(([k, v], i) => (
                  <div key={k} className={cx("flex items-center justify-between px-4 py-3", i % 2 === 0 ? "bg-surface" : "bg-paper/60")}>
                    <span className="text-[12px] font-semibold uppercase tracking-wide text-mute">{k}</span>
                    <span className={cx("font-mono text-[14px] tabular", String(k).startsWith("Total") ? "text-[16px] font-bold text-ink" : "font-medium text-ink-soft")}>{v}</span>
                  </div>
                ))}
              </div>
              {err && <div className="mt-4"><ErrorBanner message={err} /></div>}
              <p className="mt-4 text-[12px] leading-relaxed text-mute">
                On confirm, the full amount + fee is <b className="text-ink-soft">reserved on the ledger</b> (RESERVE entry) and released
                at settlement. Sandbox: amounts ending <span className="font-mono text-bad">.13</span> fail, <span className="font-mono text-rev">.77</span> settle then reverse.
              </p>
              <p className="mt-2.5 flex flex-wrap items-center gap-2 text-[12px] text-mute">
                <IconLock className="shrink-0 text-[13px] text-pine" />
                Carries an <span className="font-mono text-[11px] text-ink-soft">Idempotency-Key</span> — a replayed confirm never double-posts.
                {reuseKey && <CopyChip text={reuseKey} label={`retry · ${reuseKey.slice(0, 12)}…`} />}
              </p>
              <div className="mt-5 flex justify-between gap-2.5">
                <Button variant="ghost" onClick={() => setStage("compose")}>Back</Button>
                <Button size="lg" loading={busy} onClick={() => run(async () => {
                  const id = await api.createTransfer(kind, amountCents!, { beneficiaryId, railId, email }, note, reuseKey ?? undefined);
                  setActiveId(id); setReuseKey(null); setStage("live");
                  toast("info", "Reservation placed", `${fmtMoney(amountCents! + fee)} reserved on the ledger.`);
                })}>
                  Confirm & reserve <IconCheck className="text-[15px]" />
                </Button>
              </div>
            </div>
          )}

          {(stage === "live" || stage === "done") && active && (
            <ActiveTransfer key={active.id} t={active}
              onCancel={() => run(async () => { await api.cancelTransfer(active.id); toast("info", "Transfer cancelled", "Reservation released back to available balance."); setStage("done"); })}
              onRestart={() => { setActiveId(null); setReuseKey(null); setStage("compose"); setAmountRaw("120.00"); setNote(""); }}
              onRetry={() => retryFailed(active)}
              busy={busy} />
          )}
        </Card>

        {stage !== "live" && stage !== "done" && (
          <Card className="p-5">
            <h3 className="font-display text-[13px] font-bold uppercase tracking-[0.12em] text-ink-soft">Transfer history</h3>
            {snap.transfers.length === 0 ? (
              <p className="mt-3 text-[13px] text-mute">No transfers yet — the lifecycle of each one (reserve → settle → entry) will show here.</p>
            ) : (
              <div className="mt-3 divide-y divide-line/70">
                {snap.transfers.slice(0, 6).map((t) => (
                  <button key={t.id} onClick={() => { setActiveId(t.id); setStage("live"); }} className="group flex w-full items-center gap-3 py-2.5 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-ink group-hover:text-pine-deep">{kindLabel(t.kind)} → {t.destination}</span>
                      <span className="font-mono text-[11px] text-mute">{t.providerRef} · {timeAgo(t.createdAt)}</span>
                    </span>
                    <span className="font-mono text-[13.5px] font-semibold tabular text-ink">−{fmtMoney(t.amountCents)}</span>
                    <StatusPill status={t.status} />
                  </button>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <Card className="p-5">
          <p className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-mute">Available to move</p>
          <CountUp cents={avail} className="mt-2 block text-[30px] font-semibold text-ink" />
          <p className="mt-1 text-[12px] text-mute">
            {snap.wallet && snap.wallet.pendingCents > 0 ? <span className="text-warn">{fmtMoney(snap.wallet.pendingCents)} reserved or incoming</span> : "no active reservations"}
          </p>
        </Card>
        <DailyLimitCard />
        <Card className="p-5">
          <p className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-mute">Lifecycle</p>
          <div className="mt-3 space-y-2 font-mono text-[11.5px] leading-relaxed text-mute">
            <p><b className="text-ink-soft">CREATED</b> → validated, fee quoted</p>
            <p><b className="text-info">PROCESSING</b> → funds reserved</p>
            <p><b className="text-ok">COMPLETED</b> → DEBIT + FEE posted</p>
            <p><b className="text-bad">FAILED · CANCELLED</b> → reservation released</p>
            <p><b className="text-rev">REVERSED</b> → recalled after settlement</p>
          </div>
        </Card>
        <Card className="p-5">
          <p className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-mute">Pre-flight checks</p>
          <ul className="mt-3 space-y-2 text-[12.5px] leading-snug">
            {[
              ["KYC verified", kycOk],
              ["Beneficiary / rail ready", kind === "SEND" ? verified.length > 0 : kind === "WITHDRAW" ? activeRails.length > 0 : true],
              ["Balance covers amount + fee", !!amountCents && amountCents + fee <= avail],
            ].map(([label, ok]) => (
              <li key={label as string} className="flex items-center gap-2.5">
                <span className={cx("flex h-5 w-5 items-center justify-center rounded-full", ok ? "bg-ok-soft text-ok" : "bg-paper text-mute")}>
                  {ok ? <IconCheck className="text-[11px]" /> : <IconX className="text-[11px]" />}
                </span>
                <span className={ok ? "text-ink-soft" : "text-mute"}>{label as string}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function DailyLimitCard() {
  const used = getDailyOutflowCents();
  const pct = Math.min(100, (used / DAILY_LIMIT_CENTS) * 100);
  const tight = pct > 85;
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-mute">Daily outflow limit</p>
        <span className={cx("font-mono text-[10.5px] font-semibold tabular", tight ? "text-bad" : "text-mute")}>{pct.toFixed(0)}% used</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper">
        <div className={cx("h-full rounded-full transition-all duration-700", tight ? "bg-bad" : "bg-pine")} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2.5 font-mono text-[12px] tabular text-ink-soft">
        {fmtMoney(used)} <span className="text-mute">of {fmtMoney(DAILY_LIMIT_CENTS)} today</span>
      </p>
      <p className="mt-2 text-[11.5px] leading-relaxed text-mute">
        Enforced server-side on <span className="font-mono text-[10.5px]">/transfers</span> — failed &amp; cancelled intents don't count.
      </p>
    </Card>
  );
}

function destReady(kind: TransferKind, b: string, r: string, email: string) {
  if (kind === "SEND") return !!b;
  if (kind === "WITHDRAW") return !!r;
  return email.includes("@");
}

function ActiveTransfer({ t, onCancel, onRestart, onRetry, busy }: {
  t: Transfer; onCancel: () => void; onRestart: () => void; onRetry: () => void; busy: boolean;
}) {
  const terminal = ["COMPLETED", "FAILED", "CANCELLED", "REVERSED"].includes(t.status);
  const total = t.amountCents + t.feeCents;
  return (
    <div className="animate-fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-[19px] font-bold tracking-tight text-ink">{kindLabel(t.kind)} → {t.destination}</h2>
        <StatusPill status={t.status} />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[12px] text-mute">
        <span>{t.providerRef} · created {fmtDateTime(t.createdAt)}</span>
        {t.idempotencyKey && <CopyChip text={t.idempotencyKey} label={`key ${t.idempotencyKey.slice(0, 12)}…`} />}
      </div>

      {t.status === "PROCESSING" && (
        <div className="mt-6 space-y-5">
          <div className="relative overflow-hidden rounded-xl border border-info/25 bg-info-soft px-5 py-6 text-center">
            <div className="stripes-bar absolute inset-x-0 top-0 h-1.5 bg-info" />
            <p className="font-mono text-[17px] font-bold tabular text-info">−{fmtMoney(total)} reserved</p>
            <p className="mt-1 text-[12.5px] text-info/80">Ledger reservation active — the provider is settling the {kindLabel(t.kind).toLowerCase()}.</p>
          </div>
          <Button variant="secondary" className="w-full" loading={busy} onClick={onCancel}>
            <IconX className="text-[14px]" /> Cancel & release reservation
          </Button>
        </div>
      )}

      {terminal && (
        <div className="mt-6 space-y-5">
          <div className={cx("rounded-xl border px-5 py-6 text-center",
            t.status === "COMPLETED" ? "border-ok/30 bg-ok-soft"
            : t.status === "REVERSED" ? "border-rev/30 bg-rev-soft"
            : t.status === "CANCELLED" ? "border-line bg-paper" : "border-bad/25 bg-bad-soft")}>
            <span className={cx("mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full text-white animate-pop",
              t.status === "COMPLETED" ? "bg-ok" : t.status === "REVERSED" ? "bg-rev" : t.status === "CANCELLED" ? "bg-mute" : "bg-bad")}>
              {t.status === "COMPLETED" ? <IconCheck className="text-[22px]" /> : t.status === "CANCELLED" ? <IconX className="text-[22px]" /> : t.status === "REVERSED" ? <IconRefresh className="text-[20px]" /> : <IconAlert className="text-[22px]" />}
            </span>
            <p className={cx("font-display text-[18px] font-bold",
              t.status === "COMPLETED" ? "text-ok" : t.status === "REVERSED" ? "text-rev" : t.status === "CANCELLED" ? "text-ink-soft" : "text-bad")}>
              {t.status === "COMPLETED" ? `${fmtMoney(t.amountCents)} settled` : t.status === "REVERSED" ? "Reversed after settlement" : t.status === "CANCELLED" ? "Cancelled — reservation released" : "Transfer failed"}
            </p>
            <p className="mx-auto mt-1 max-w-[400px] text-[12.5px] leading-relaxed text-mute">
              {t.status === "COMPLETED" && `DEBIT and FEE entries posted against ${t.providerRef}. The reservation entry was marked released.`}
              {t.status === "FAILED" && `${t.failReason ?? "The provider rejected the transfer."} The full reservation of ${fmtMoney(total)} was released.`}
              {t.status === "CANCELLED" && "You cancelled before the webhook landed — the ledger shows a RELEASE entry refunding the reservation."}
              {t.status === "REVERSED" && "The provider recalled settled funds (sandbox reversal). A RELEASE entry returned the full amount to your balance."}
            </p>
          </div>
          <div className="flex gap-2.5">
            {t.status === "FAILED" && (
              <Button variant="secondary" className="flex-1" onClick={onRetry}>
                <IconRefresh className="text-[14px]" /> Retry · same key
              </Button>
            )}
            <Button className={cx("flex-1", t.status !== "FAILED" && "w-full")} onClick={onRestart}>
              <IconRefresh className="text-[14px]" /> New transfer
            </Button>
          </div>
        </div>
      )}

      <div className="mt-6 border-t border-line pt-5">
        <h4 className="mb-3 font-display text-[12px] font-bold uppercase tracking-[0.12em] text-ink-soft">State timeline</h4>
        <Timeline events={t.events} failed={["FAILED", "CANCELLED", "REVERSED"].includes(t.status)} />
      </div>
    </div>
  );
}
