import { useState } from "react";
import { api } from "../mock/api";
import { ApiError, type Beneficiary, type RailAccount, type RailType } from "../types";
import { useStore } from "../state/store";
import { Button, Card, Drawer, EmptyState, ErrorBanner, Field, Modal, Select, StatusPill, Timeline } from "../components/ui";
import { IconBank, IconPlus, IconLink, IconGlobe, IconBolt, IconTrash, IconRefresh, IconAlert, IconCheck } from "../components/icons";
import { cx, fmtDateTime, timeAgo } from "../lib/utils";

const RAILS: Array<{ type: RailType; name: string; region: string; note: string; icon: React.ReactNode }> = [
  { type: "ACH", name: "ACH", region: "United States", note: "1–2 day settlement, low cost", icon: <IconBank className="text-[18px]" /> },
  { type: "SEPA", name: "SEPA", region: "Eurozone", note: "Instant & credit-transfer schemes", icon: <IconGlobe className="text-[18px]" /> },
  { type: "FPS", name: "Faster Payments", region: "United Kingdom", note: "Near-instant, 24/7", icon: <IconBolt className="text-[18px]" /> },
  { type: "WIRE", name: "Wire", region: "Global (SWIFT)", note: "High-value, correspondent banks", icon: <IconLink className="text-[18px]" /> },
];

type ModalState =
  | { kind: "rail-step1" }
  | { kind: "rail-step2"; rail: RailType }
  | { kind: "beneficiary" }
  | { kind: "retry"; b: Beneficiary }
  | { kind: "confirm"; what: "rail" | "beneficiary"; id: string; label: string }
  | null;

export function RailsScreen() {
  const { snap, toast } = useStore();
  const [modal, setModal] = useState<ModalState>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const [institution, setInstitution] = useState("");
  const [account, setAccount] = useState("");
  const [bName, setBName] = useState("");
  const [bRail, setBRail] = useState<RailType>("ACH");
  const [bInstitution, setBInstitution] = useState("");
  const [bAccount, setBAccount] = useState("");
  const [retryName, setRetryName] = useState("");

  const [openRail, setOpenRail] = useState<RailAccount | null>(null);
  const [openB, setOpenB] = useState<Beneficiary | null>(null);
  const liveRail = openRail ? snap.rails.find((r) => r.id === openRail.id) ?? openRail : null;
  const liveB = openB ? snap.beneficiaries.find((b) => b.id === openB.id) ?? openB : null;

  const reset = () => { setErr(null); setFields({}); };

  async function run(fn: () => Promise<void>, then?: () => void) {
    setBusy(true); reset();
    try { await fn(); then?.(); }
    catch (e) {
      const ae = e as ApiError;
      if (ae.fields) setFields(ae.fields);
      setErr(ae.message);
    } finally { setBusy(false); }
  }

  const closeModals = () => { setModal(null); reset(); setInstitution(""); setAccount(""); setBName(""); setBInstitution(""); setBAccount(""); };

  return (
    <div className="space-y-6">
      {/* linked accounts */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-[15px] font-bold text-ink">Linked accounts <span className="ml-1 font-mono text-[12px] font-normal text-mute">({snap.rails.length})</span></h2>
          <Button size="sm" onClick={() => { reset(); setModal({ kind: "rail-step1" }); }}><IconPlus className="text-[14px]" /> Link account</Button>
        </div>
        {snap.rails.length === 0 ? (
          <Card><EmptyState icon={<IconBank className="text-[26px]" />} title="No accounts linked"
            body="Link a bank account over a payment rail — withdrawals and beneficiary payouts settle onto it."
            action={<Button onClick={() => setModal({ kind: "rail-step1" })}>Link your first account</Button>} /></Card>
        ) : (
          <div className="stagger grid gap-3 md:grid-cols-2">
            {snap.rails.map((r) => (
              <Card key={r.id} onClick={() => setOpenRail(r)} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <span className={cx("flex h-11 w-11 items-center justify-center rounded-lg",
                      r.status === "ACTIVE" ? "bg-pine-mist text-pine-deep" : r.status === "FAILED" ? "bg-bad-soft text-bad" : "bg-paper text-mute")}>
                      <IconBank className="text-[19px]" />
                    </span>
                    <div>
                      <p className="font-display text-[15.5px] font-bold text-ink">{r.institution}</p>
                      <p className="font-mono text-[12px] text-mute">{r.rail} · {r.accountMasked}</p>
                    </div>
                  </div>
                  <StatusPill status={r.status} />
                </div>
                {r.status === "VALIDATING" && (
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-paper">
                    <div className="stripes-bar h-full w-full rounded-full bg-warn" />
                  </div>
                )}
                {r.status === "FAILED" && r.failReason && (
                  <p className="mt-3 flex items-start gap-2 rounded-lg bg-bad-soft px-3 py-2 text-[12px] font-medium leading-snug text-bad">
                    <IconAlert className="mt-0.5 shrink-0 text-[13px]" />{r.failReason}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3.5" onClick={(e) => e.stopPropagation()}>
                  {r.status === "ACTIVE" && (
                    <Button size="sm" variant="secondary" onClick={() => run(() => api.deactivateRail(r.id), () => toast("info", "Rail deactivated", `${r.institution} can no longer settle transfers.`))}>Deactivate</Button>
                  )}
                  {r.status === "DEACTIVATED" && (
                    <Button size="sm" variant="secondary" onClick={() => run(() => api.reactivateRail(r.id), () => toast("info", "Re-validation started", "The account is being re-checked on the rail."))}>
                      <IconRefresh className="text-[13px]" /> Reactivate
                    </Button>
                  )}
                  {(r.status === "FAILED" || r.status === "DEACTIVATED") && (
                    <Button size="sm" variant="ghost" className="text-bad hover:bg-bad-soft hover:text-bad"
                      onClick={() => setModal({ kind: "confirm", what: "rail", id: r.id, label: `${r.institution} ${r.accountMasked}` })}>
                      <IconTrash className="text-[13px]" /> Remove
                    </Button>
                  )}
                  {r.status === "FAILED" && (
                    <Button size="sm" onClick={() => { reset(); setModal({ kind: "rail-step2", rail: r.rail }); }}>
                      <IconRefresh className="text-[13px]" /> Retry
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* beneficiaries */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-[15px] font-bold text-ink">Beneficiaries <span className="ml-1 font-mono text-[12px] font-normal text-mute">({snap.beneficiaries.length})</span></h2>
          <Button size="sm" variant="secondary" onClick={() => { reset(); setModal({ kind: "beneficiary" }); }}><IconPlus className="text-[14px]" /> Add beneficiary</Button>
        </div>
        {snap.beneficiaries.length === 0 ? (
          <Card><EmptyState icon={<IconLink className="text-[26px]" />} title="No beneficiaries yet"
            body="Beneficiaries are the accounts you pay out to. Each one is verified over its rail before it can receive money."
            action={<Button variant="secondary" onClick={() => setModal({ kind: "beneficiary" })}>Add a beneficiary</Button>} /></Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="divide-y divide-line/70">
              {snap.beneficiaries.map((b) => (
                <button key={b.id} onClick={() => setOpenB(b)} className="group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-pine-mist/30 sm:px-6">
                  <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-display text-[13px] font-bold",
                    b.status === "VERIFIED" ? "bg-pine-ink text-gold" : b.status === "REJECTED" ? "bg-bad-soft text-bad" : "bg-paper text-mute")}>
                    {b.name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold text-ink group-hover:text-pine-deep">{b.name}</span>
                    <span className="block font-mono text-[11.5px] text-mute">{b.rail} · {b.institution} · {b.accountMasked} · added {timeAgo(b.createdAt)}</span>
                  </span>
                  {b.status === "PENDING" && <span className="hidden font-mono text-[10.5px] text-warn sm:block">verifying…</span>}
                  <StatusPill status={b.status} />
                </button>
              ))}
            </div>
          </Card>
        )}
      </section>

      {/* ---- modals ---- */}
      <Modal open={modal?.kind === "rail-step1"} onClose={closeModals} title="Choose a rail">
        <div className="grid gap-2.5">
          {RAILS.map((r) => (
            <button key={r.type} onClick={() => { reset(); setModal({ kind: "rail-step2", rail: r.type }); }}
              className="group flex items-center gap-3.5 rounded-xl border border-line bg-surface px-4 py-3.5 text-left transition-all hover:-translate-y-px hover:border-pine hover:shadow-card">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-pine-mist text-pine-deep">{r.icon}</span>
              <span className="flex-1">
                <span className="flex items-center gap-2 font-display text-[14.5px] font-bold text-ink">{r.name}
                  <span className="rounded bg-paper px-1.5 py-0.5 font-mono text-[9.5px] font-medium uppercase tracking-wide text-mute">{r.region}</span>
                </span>
                <span className="block text-[12px] text-mute">{r.note}</span>
              </span>
              <IconPlus className="text-[16px] text-mute transition-colors group-hover:text-pine" />
            </button>
          ))}
        </div>
      </Modal>

      <Modal open={modal?.kind === "rail-step2"} onClose={closeModals}
        title={`Link ${modal?.kind === "rail-step2" ? RAILS.find((r) => r.type === modal.rail)?.name : ""} account`}>
        <div className="space-y-4">
          {err && <ErrorBanner message={err} />}
          <Field label="Institution" placeholder="e.g. Chase, Mercury, Wise" value={institution} error={fields.institution} onChange={(e) => setInstitution(e.target.value)} />
          <Field label={modal?.kind === "rail-step2" && modal.rail === "SEPA" ? "IBAN" : "Account number"}
            placeholder={modal?.kind === "rail-step2" && modal.rail === "SEPA" ? "DE89 3704 0044 0532 0130 00" : "12 digits"}
            value={account} error={fields.accountNumber} onChange={(e) => setAccount(e.target.value)} className="font-mono"
            hint="ends 0000 → fails" />
          <div className="flex justify-end gap-2.5 pt-1">
            <Button variant="ghost" onClick={closeModals}>Cancel</Button>
            <Button loading={busy} onClick={() =>
              modal?.kind === "rail-step2" && run(
                () => api.addRail(modal.rail, institution, account),
                () => { closeModals(); toast("info", "Validation started", "The adapter is confirming the account over the rail…"); },
              )
            }>Validate account</Button>
          </div>
        </div>
      </Modal>

      <Modal open={modal?.kind === "beneficiary"} onClose={closeModals} title="Add beneficiary">
        <div className="space-y-4">
          {err && <ErrorBanner message={err} />}
          <Field label="Beneficiary name" placeholder="Acme Supplies Co." value={bName} error={fields.name} onChange={(e) => setBName(e.target.value)} hint={"“reject” → rejected"} />
          <Select label="Rail" value={bRail} error={fields.rail} onChange={(e) => setBRail(e.target.value as RailType)}>
            {RAILS.map((r) => (
              <option key={r.type} value={r.type}>{r.name} — {r.region}</option>
            ))}
          </Select>
          <Field label="Institution" placeholder="Receiving bank" value={bInstitution} error={fields.institution} onChange={(e) => setBInstitution(e.target.value)} />
          <Field label="Account number" placeholder="Full account / IBAN" value={bAccount} error={fields.accountNumber} onChange={(e) => setBAccount(e.target.value)} className="font-mono" />
          <div className="flex justify-end gap-2.5 pt-1">
            <Button variant="ghost" onClick={closeModals}>Cancel</Button>
            <Button loading={busy} onClick={() => run(
              () => api.addBeneficiary(bName, bRail, bInstitution, bAccount),
              () => { closeModals(); toast("info", "Verification requested", "The receiving institution is confirming the account…"); },
            )}>Verify beneficiary</Button>
          </div>
        </div>
      </Modal>

      <Modal open={modal?.kind === "retry"} onClose={closeModals} title="Fix & resubmit">
        <div className="space-y-4">
          {err && <ErrorBanner message={err} />}
          <p className="rounded-lg bg-flip-soft px-3.5 py-2.5 text-[12.5px] leading-relaxed text-flip">
            {modal?.kind === "retry" ? modal.b.failReason : ""} Update the name and resubmit — the adapter re-runs verification.
          </p>
          <Field label="Beneficiary name" value={retryName} onChange={(e) => setRetryName(e.target.value)} />
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={closeModals}>Cancel</Button>
            <Button loading={busy} onClick={() =>
              modal?.kind === "retry" && run(
                () => api.retryBeneficiary(modal.b.id, retryName),
                () => { closeModals(); toast("info", "Resubmitted", "Verification is running again…"); },
              )
            }>Resubmit</Button>
          </div>
        </div>
      </Modal>

      <Modal open={modal?.kind === "confirm"} onClose={() => setModal(null)} title="Remove permanently?">
        <p className="text-[14px] leading-relaxed text-ink-soft">
          {modal?.kind === "confirm" && <><span className="font-semibold text-ink">{modal.label}</span> will be removed. This cannot be undone — you can always link it again later.</>}
        </p>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="secondary" onClick={() => setModal(null)}>Keep it</Button>
          <Button variant="danger" loading={busy} onClick={() =>
            modal?.kind === "confirm" && run(
              () => modal.what === "rail" ? api.removeRail(modal.id) : api.removeBeneficiary(modal.id),
              () => { setModal(null); toast("info", "Removed", "The record was deleted from the sandbox store."); },
            )
          }><IconTrash className="text-[14px]" /> Remove</Button>
        </div>
      </Modal>

      {/* rail drawer */}
      <Drawer open={!!liveRail} onClose={() => setOpenRail(null)} title="Linked account">
        {liveRail && (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-[18px] font-bold text-ink">{liveRail.institution}</h3>
                <p className="mt-0.5 font-mono text-[12.5px] text-mute">{liveRail.rail} · {liveRail.accountMasked} · added {fmtDateTime(liveRail.addedAt)}</p>
              </div>
              <StatusPill status={liveRail.status} />
            </div>
            {liveRail.failReason && (
              <p className="rounded-lg border border-bad/25 bg-bad-soft px-4 py-3 text-[13px] font-medium leading-relaxed text-bad">{liveRail.failReason}</p>
            )}
            <section>
              <h4 className="mb-3 font-display text-[12px] font-bold uppercase tracking-[0.12em] text-ink-soft">Validation timeline</h4>
              <Timeline events={liveRail.events} failed={liveRail.status === "FAILED"} />
            </section>
          </div>
        )}
      </Drawer>

      {/* beneficiary drawer */}
      <Drawer open={!!liveB} onClose={() => setOpenB(null)} title="Beneficiary">
        {liveB && (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-[18px] font-bold text-ink">{liveB.name}</h3>
                <p className="mt-0.5 font-mono text-[12.5px] text-mute">{liveB.rail} · {liveB.institution} · {liveB.accountMasked}</p>
              </div>
              <StatusPill status={liveB.status} />
            </div>
            {liveB.failReason && (
              <p className="rounded-lg border border-bad/25 bg-bad-soft px-4 py-3 text-[13px] font-medium leading-relaxed text-bad">{liveB.failReason}</p>
            )}
            <section>
              <h4 className="mb-3 font-display text-[12px] font-bold uppercase tracking-[0.12em] text-ink-soft">Verification timeline</h4>
              <Timeline events={liveB.events} failed={liveB.status === "REJECTED"} />
            </section>
            <div className="flex flex-wrap gap-2.5 border-t border-line pt-4">
              {liveB.status === "REJECTED" && (
                <Button onClick={() => { reset(); setRetryName(liveB.name); setOpenB(null); setModal({ kind: "retry", b: liveB }); }}>
                  <IconRefresh className="text-[14px]" /> Fix & resubmit
                </Button>
              )}
              {liveB.status === "VERIFIED" && (
                <Button variant="secondary" onClick={() => run(() => api.deactivateBeneficiary(liveB.id), () => toast("info", "Beneficiary deactivated", `${liveB.name} can't receive payouts until reactivated.`))}>
                  Deactivate
                </Button>
              )}
              {liveB.status !== "PENDING" && (
                <Button variant="ghost" className="text-bad hover:bg-bad-soft hover:text-bad"
                  onClick={() => { setOpenB(null); setModal({ kind: "confirm", what: "beneficiary", id: liveB.id, label: liveB.name }); }}>
                  <IconTrash className="text-[14px]" /> Remove
                </Button>
              )}
            </div>
            <p className="flex items-center gap-2 rounded-lg bg-paper px-3.5 py-2.5 text-[12px] text-mute">
              <IconCheck className="shrink-0 text-[13px] text-ok" /> Only VERIFIED beneficiaries can be selected on the Send flow.
            </p>
          </div>
        )}
      </Drawer>
    </div>
  );
}

