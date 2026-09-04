import { useEffect, useMemo, useState } from "react";
import { api, methodLabel, methodSource } from "../mock/api";
import { ApiError, type FundingIntent, type FundingMethod } from "../types";
import { useStore } from "../state/store";
import { Button, Card, CopyChip, CountUp, ErrorBanner, Field, InfoBanner, StatusPill, Timeline } from "../components/ui";
import { IconBolt, IconBank, IconFund, IconGlobe, IconArrowR, IconLock, IconCheck, IconX, IconAlert, IconRefresh, IconClock, IconId } from "../components/icons";
import { cx, fmtDateTime, fmtMoney, parseAmount, timeAgo } from "../lib/utils";

const METHODS: Array<{ type: FundingMethod; name: string; desc: string; feeNote: string; eta: string; icon: React.ReactNode }> = [
  { type: "CARD", name: "Debit card", desc: "Visa / Mastercard, captured instantly", feeNote: "1.5% (min $0.50)", eta: "Instant", icon: <IconFund className="text-[19px]" /> },
  { type: "BANK_TRANSFER", name: "Bank transfer", desc: "Push a wire with your reference code", feeNote: "Free", eta: "Same day", icon: <IconBank className="text-[19px]" /> },
  { type: "OPEN_BANKING", name: "Open banking", desc: "Authorise via your bank's API", feeNote: "Free", eta: "Instant", icon: <IconGlobe className="text-[19px]" /> },
];

type Stage = "method" | "amount" | "confirm" | "action" | "live" | "done";

export function FundScreen() {
  const { snap, nav, toast } = useStore();
  const kycOk = snap.kyc?.status === "VERIFIED";

  const [stage, setStage] = useState<Stage>("method");
  const [method, setMethod] = useState<FundingMethod>("CARD");
  const [amountRaw, setAmountRaw] = useState("250.00");
  const [err, setErr] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [expiry, setExpiry] = useState<number | null>(null);

  const active = useMemo(() => snap.funding.find((f) => f.id === activeId) ?? null, [snap.funding, activeId]);
  const amountCents = parseAmount(amountRaw);
  const fee = amountCents ? api.quoteFundingFee(method, amountCents) : 0;

  /* expiry countdown while instructions are open (seconds remaining) */
  useEffect(() => {
    if (!active || active.status !== "REQUIRES_ACTION") { setExpiry(null); return; }
    const end = active.createdAt + 90_000;
    const tick = () => setExpiry(Math.max(0, Math.round((end - Date.now()) / 1000)));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [active?.status, active?.createdAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const secsLeft = expiry;

  const gotoLive = (id: string) => { setActiveId(id); setStage("live"); };

  async function run(fn: () => Promise<void>) {
    setBusy(true); setErr(null); setFields({});
    try { await fn(); }
    catch (e) {
      const ae = e as ApiError;
      if (ae.fields) setFields(ae.fields);
      setErr(ae.message);
    } finally { setBusy(false); }
  }

  /* ---------- KYC eligibility gate ---------- */
  if (!kycOk) {
    return (
      <div className="mx-auto max-w-[640px]">
        <Card className="overflow-hidden">
          <div className="relative overflow-hidden bg-[#241b10] px-7 py-9">
            <div className="relative z-10 flex items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-gold text-pine-ink"><IconLock className="text-[24px]" /></span>
              <div>
                <h2 className="font-display text-[22px] font-bold tracking-tight text-[#f4efe4]">Funding is gated on KYC</h2>
                <p className="mt-1 text-[13.5px] text-[#cbbfa4]">The eligibility gate from the build plan: no verified identity, no funding intents.</p>
              </div>
            </div>
          </div>
          <div className="space-y-4 px-7 py-6">
            <div className="flex items-center justify-between rounded-lg border border-line bg-paper/60 px-4 py-3">
              <span className="text-[13.5px] font-medium text-ink-soft">Your KYC status</span>
              <StatusPill status={snap.kyc?.status ?? "NOT_STARTED"} />
            </div>
            <InfoBanner>Every <code className="font-mono text-[11.5px]">POST /api/v1/funding/intents</code> call checks the KYC state machine before creating anything — the same check the FastAPI service will enforce in Phase 7.</InfoBanner>
            <Button size="lg" className="w-full" onClick={() => nav("kyc")}><IconId className="text-[16px]" /> Complete identity verification</Button>
          </div>
        </Card>
      </div>
    );
  }

  const inFlow = stage === "action" || stage === "live" || stage === "done";

  return (
    <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
      <div className="space-y-5">
        <Card className="p-6 sm:p-7">
          {/* progress rail */}
          <div className="mb-6 flex items-center gap-1.5">
            {(["method", "amount", "confirm", "live"] as Stage[]).map((s, i) => {
              const order = ["method", "amount", "confirm", "action", "live", "done"];
              const cur = order.indexOf(stage === "action" ? "live" : stage);
              const idx = order.indexOf(s === "live" ? "live" : s);
              return <span key={s} className={cx("h-1.5 flex-1 rounded-full transition-colors", idx <= cur ? "bg-pine" : "bg-line")} aria-hidden />;
            })}
          </div>

          {stage === "method" && (
            <div className="stagger">
              <h2 className="font-display text-[19px] font-bold tracking-tight text-ink">Choose a funding method</h2>
              <p className="mt-1 text-[13.5px] text-mute">Each method maps to a PaymentProviderAdapter call with its own fee schedule.</p>
              <div className="mt-5 grid gap-3">
                {METHODS.map((m) => (
                  <button key={m.type} onClick={() => { setMethod(m.type); setStage("amount"); }}
                    className="group flex items-center gap-4 rounded-xl border border-line bg-surface px-5 py-4 text-left transition-all hover:-translate-y-px hover:border-pine hover:shadow-card">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-pine-mist text-pine-deep">{m.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 font-display text-[15.5px] font-bold text-ink group-hover:text-pine-deep">
                        {m.name}
                        <span className="rounded bg-paper px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-mute">{m.eta}</span>
                      </span>
                      <span className="block text-[12.5px] text-mute">{m.desc} · fee: {m.feeNote}</span>
                    </span>
                    <IconArrowR className="shrink-0 text-[17px] text-mute transition-all group-hover:translate-x-0.5 group-hover:text-pine" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {stage === "amount" && (
            <div className="animate-fade-up">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-[19px] font-bold tracking-tight text-ink">Enter amount</h2>
                <button onClick={() => setStage("method")} className="text-[13px] font-semibold text-pine hover:text-pine-deep">Change method</button>
              </div>
              <div className="mt-5 rounded-xl border border-line bg-paper/50 p-5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[26px] text-mute">$</span>
                  <input
                    value={amountRaw} onChange={(e) => setAmountRaw(e.target.value)} inputMode="decimal" autoFocus
                    className="w-full bg-transparent font-mono text-[34px] font-semibold tabular text-ink outline-none placeholder:text-mute/40"
                    placeholder="0.00"
                  />
                </div>
                {fields.amount && <p className="mt-2 flex items-center gap-1.5 text-[12.5px] font-medium text-bad"><IconAlert className="text-[13px]" />{fields.amount}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  {["50.00", "100.00", "250.00", "1,000.00", "2,500.00"].map((v) => (
                    <button key={v} onClick={() => setAmountRaw(v)}
                      className={cx("rounded-full border px-3.5 py-1.5 font-mono text-[12.5px] transition-all",
                        amountRaw === v ? "border-pine bg-pine-mist font-semibold text-pine-deep" : "border-line-strong bg-surface text-ink-soft hover:border-pine hover:text-pine")}>
                      ${v}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3 text-[13.5px]">
                <span className="text-mute">Network / provider fee</span>
                <span className="font-mono font-semibold tabular text-ink">{fee ? fmtMoney(fee) : "Free"}</span>
              </div>
              <div className="mt-5 flex justify-between gap-2.5">
                <Button variant="ghost" onClick={() => setStage("method")}>Back</Button>
                <Button size="lg" onClick={() => { setErr(null); setFields({}); if (!amountCents) { setFields({ amount: "Enter an amount greater than zero." }); return; } setStage("confirm"); }}>
                  Review intent <IconArrowR className="text-[15px]" />
                </Button>
              </div>
            </div>
          )}

          {stage === "confirm" && amountCents && (
            <div className="animate-fade-up">
              <h2 className="font-display text-[19px] font-bold tracking-tight text-ink">Review funding intent</h2>
              <div className="mt-5 overflow-hidden rounded-xl border border-line">
                {[
                  ["Method", METHODS.find((m) => m.type === method)!.name],
                  ["Amount", fmtMoney(amountCents)],
                  ["Fee", fee ? fmtMoney(fee) : "Free"],
                  ["Credited to wallet", snap.wallet?.id ?? "—"],
                  ["Total charge", fmtMoney(amountCents + fee)],
                ].map(([k, v], i) => (
                  <div key={k} className={cx("flex items-center justify-between px-4 py-3", i % 2 === 0 ? "bg-surface" : "bg-paper/60")}>
                    <span className="text-[12px] font-semibold uppercase tracking-wide text-mute">{k}</span>
                    <span className={cx("font-mono text-[14px] tabular", k === "Total charge" ? "font-bold text-ink text-[16px]" : "font-medium text-ink-soft")}>{v}</span>
                  </div>
                ))}
              </div>
              {err && <div className="mt-4"><ErrorBanner message={err} /></div>}
              <p className="mt-4 text-[12px] leading-relaxed text-mute">
                Sandbox: amounts ending in <span className="font-mono text-bad">.13</span> are declined by the provider;
                leaving the instructions screen open 90s expires the intent.
              </p>
              <div className="mt-5 flex justify-between gap-2.5">
                <Button variant="ghost" onClick={() => setStage("amount")}>Back</Button>
                <Button size="lg" loading={busy} onClick={() => run(async () => { const id = await api.createFunding(method, amountCents!); gotoLive(id); setStage("action"); })}>
                  Create intent <IconBolt className="text-[15px]" />
                </Button>
              </div>
            </div>
          )}

          {(stage === "action" || stage === "live" || stage === "done") && active && (
            <ActiveIntent
              key={active.id}
              intent={active}
              secsLeft={secsLeft}
              onPaid={() => run(async () => { await api.confirmFundingPayment(active.id); toast("info", "Payment captured", "Waiting on the provider webhook…"); setStage("live"); })}
              onCancel={() => run(async () => { await api.cancelFunding(active.id); toast("info", "Funding cancelled", "No funds moved."); setStage("done"); })}
              onRestart={() => { setActiveId(null); setStage("method"); }}
              busy={busy}
            />
          )}
        </Card>

        {!inFlow && (
          <Card className="p-5">
            <h3 className="font-display text-[13px] font-bold uppercase tracking-[0.12em] text-ink-soft">Funding history</h3>
            {snap.funding.length === 0 ? (
              <p className="mt-3 text-[13px] text-mute">No intents yet — your first one will appear here with its full state timeline.</p>
            ) : (
              <div className="mt-3 divide-y divide-line/70">
                {snap.funding.slice(0, 6).map((f) => (
                  <button key={f.id} onClick={() => gotoLive(f.id)} className="group flex w-full items-center gap-3 py-2.5 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-ink group-hover:text-pine-deep">{methodLabel(f.method)}</span>
                      <span className="font-mono text-[11px] text-mute">{f.providerRef} · {timeAgo(f.createdAt)}</span>
                    </span>
                    <span className="font-mono text-[13.5px] font-semibold tabular text-ink">{fmtMoney(f.amountCents)}</span>
                    <StatusPill status={f.status} />
                  </button>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

      {/* side rail */}
      <div className="space-y-4">
        <Card className="p-5">
          <p className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-mute">Wallet balance</p>
          <CountUp cents={snap.wallet?.availableCents ?? 0} className="mt-2 block text-[30px] font-semibold text-ink" />
          <p className="mt-1 text-[12px] text-mute">
            {snap.wallet && snap.wallet.pendingCents > 0 ? <span className="text-warn">+{fmtMoney(snap.wallet.pendingCents)} in flight</span> : "nothing in flight"}
          </p>
        </Card>
        <Card className="p-5">
          <p className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-mute">State machine</p>
          <div className="mt-3 space-y-2 font-mono text-[11.5px] leading-relaxed text-mute">
            <p><b className="text-ink-soft">CREATED</b> → intent on ledger service</p>
            <p><b className="text-warn">REQUIRES_ACTION</b> → you complete payment</p>
            <p><b className="text-info">PROCESSING</b> → webhook pending</p>
            <p><b className="text-ok">SUCCEEDED</b> · entries posted</p>
            <p><b className="text-bad">FAILED · CANCELLED · EXPIRED</b></p>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------- active intent panel ---------- */
function ActiveIntent({ intent, secsLeft, onPaid, onCancel, onRestart, busy }: {
  intent: FundingIntent;
  secsLeft: number | null;
  onPaid: () => void;
  onCancel: () => void;
  onRestart: () => void;
  busy: boolean;
}) {
  const terminal = ["SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED"].includes(intent.status);
  return (
    <div className="animate-fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-[19px] font-bold tracking-tight text-ink">{methodLabel(intent.method)}</h2>
        <StatusPill status={intent.status} />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[12px] text-mute">
        <span>{intent.providerRef} · created {fmtDateTime(intent.createdAt)}</span>
        {intent.idempotencyKey && <CopyChip text={intent.idempotencyKey} label={`key ${intent.idempotencyKey.slice(0, 12)}…`} />}
      </div>

      {intent.status === "REQUIRES_ACTION" && (
        <div className="mt-5 space-y-4">
          {secsLeft !== null && (
            <div className="flex items-center justify-between rounded-lg border border-warn/30 bg-warn-soft px-4 py-2.5">
              <span className="flex items-center gap-2 text-[13px] font-semibold text-warn"><IconClock className="text-[15px]" /> Instructions expire in</span>
              <span className="font-mono text-[15px] font-bold tabular text-warn">{Math.floor(secsLeft / 60)}:{String(secsLeft % 60).padStart(2, "0")}</span>
            </div>
          )}
          {intent.method === "CARD" && (
            <div className="rounded-xl border border-line bg-paper/50 p-5">
              <p className="text-[13.5px] font-medium text-ink-soft">Charge <b className="font-mono tabular text-ink">{fmtMoney(intent.amountCents + intent.feeCents)}</b> to your saved card <span className="font-mono">Visa •• 4412</span>.</p>
              <p className="mt-1.5 text-[12px] text-mute">Sandbox card — no real charge. Declines when the amount ends in .13.</p>
            </div>
          )}
          {intent.method === "BANK_TRANSFER" && intent.referenceCode && (
            <div className="rounded-xl border border-line bg-paper/50 p-5">
              <p className="text-[13.5px] font-medium text-ink-soft">Wire <b className="font-mono tabular text-ink">{fmtMoney(intent.amountCents)}</b> to the account below, quoting your reference — it routes the webhook to this intent.</p>
              <div className="mt-3 space-y-2 font-mono text-[13px] text-ink">
                <div className="flex items-center justify-between gap-3"><span className="text-mute">Beneficiary</span><span>BMONI FBO Ledger</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-mute">Account</span><CopyChip text="0440000232 99887712" label="0440000232 99887712" /></div>
                <div className="flex items-center justify-between gap-3"><span className="text-mute">Reference</span><CopyChip text={intent.referenceCode} /></div>
              </div>
            </div>
          )}
          {intent.method === "OPEN_BANKING" && (
            <div className="rounded-xl border border-line bg-paper/50 p-5">
              <p className="text-[13.5px] font-medium text-ink-soft">You'll be redirected to your bank to authorise <b className="font-mono tabular text-ink">{fmtMoney(intent.amountCents)}</b> via the Teller API sandbox.</p>
            </div>
          )}
          <div className="flex flex-wrap justify-between gap-2.5">
            <Button variant="ghost" loading={busy} onClick={onCancel}><IconX className="text-[14px]" /> Cancel intent</Button>
            <Button size="lg" loading={busy} onClick={onPaid}>
              I've completed the payment <IconCheck className="text-[15px]" />
            </Button>
          </div>
        </div>
      )}

      {intent.status === "PROCESSING" && (
        <div className="mt-6 space-y-5">
          <div className="relative overflow-hidden rounded-xl border border-info/25 bg-info-soft px-5 py-6 text-center">
            <div className="stripes-bar absolute inset-x-0 top-0 h-1.5 bg-info" />
            <p className="font-display text-[16px] font-bold text-info">Waiting on the provider webhook…</p>
            <p className="mt-1 text-[12.5px] text-info/80">Payment captured. The ledger posts only after the signed webhook is verified.</p>
          </div>
          <Button variant="secondary" className="w-full" loading={busy} onClick={onCancel}><IconX className="text-[14px]" /> Cancel while processing</Button>
        </div>
      )}

      {terminal && (
        <div className="mt-6 space-y-5">
          <div className={cx("rounded-xl border px-5 py-6 text-center",
            intent.status === "SUCCEEDED" ? "border-ok/30 bg-ok-soft" : intent.status === "CANCELLED" ? "border-line bg-paper" : "border-bad/25 bg-bad-soft")}>
            <span className={cx("mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full text-white animate-pop",
              intent.status === "SUCCEEDED" ? "bg-ok" : intent.status === "CANCELLED" ? "bg-mute" : "bg-bad")}>
              {intent.status === "SUCCEEDED" ? <IconCheck className="text-[22px]" /> : intent.status === "CANCELLED" ? <IconX className="text-[22px]" /> : <IconAlert className="text-[22px]" />}
            </span>
            <p className={cx("font-display text-[18px] font-bold", intent.status === "SUCCEEDED" ? "text-ok" : intent.status === "CANCELLED" ? "text-ink-soft" : "text-bad")}>
              {intent.status === "SUCCEEDED" ? `${fmtMoney(intent.amountCents)} credited` : intent.status === "CANCELLED" ? "Intent cancelled" : intent.status === "EXPIRED" ? "Intent expired" : "Funding failed"}
            </p>
            <p className="mx-auto mt-1 max-w-[380px] text-[12.5px] leading-relaxed text-mute">
              {intent.status === "SUCCEEDED" && "Webhook signature verified — a CREDIT entry (and the fee entry) posted to your ledger. Balance is already updated."}
              {intent.status === "FAILED" && (intent.failReason ?? "The provider declined this intent.")}
              {intent.status === "CANCELLED" && "You cancelled before settlement. Nothing was posted to the ledger."}
              {intent.status === "EXPIRED" && "The payment window closed. Create a fresh intent to try again."}
            </p>
          </div>
          <div className="flex gap-2.5">
            {intent.status === "SUCCEEDED" ? (
              <Button className="flex-1" onClick={onRestart}>Fund again <IconRefresh className="text-[14px]" /></Button>
            ) : (
              <Button className="flex-1" onClick={onRestart}><IconRefresh className="text-[14px]" /> Try again</Button>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 border-t border-line pt-5">
        <h4 className="mb-3 font-display text-[12px] font-bold uppercase tracking-[0.12em] text-ink-soft">State timeline</h4>
        <Timeline events={intent.events} failed={["FAILED", "EXPIRED", "CANCELLED"].includes(intent.status)} />
      </div>
      <p className="mt-4 font-mono text-[11px] text-mute">source: {methodSource(intent.method)} · gross {fmtMoney(intent.amountCents)} · fee {intent.feeCents ? fmtMoney(intent.feeCents) : "—"}</p>
    </div>
  );
}
