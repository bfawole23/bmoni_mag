import { useState } from "react";
import { api, SANDBOX_HINTS } from "../mock/api";
import { ApiError, type KycProfile } from "../types";
import { useStore } from "../state/store";
import { Button, Card, ErrorBanner, Field, InfoBanner, Select, Segmented, StatusPill, Timeline } from "../components/ui";
import { IconId, IconScan, IconShield, IconFile, IconCheck, IconArrowR, IconAlert, IconRefresh, IconLock, IconInfo } from "../components/icons";
import { cx } from "../lib/utils";

type Outcome = "APPROVE" | "REJECT" | "RETRY";
type Step = "info" | "docs" | "review";

const EMPTY_INFO = {
  legalName: "", dob: "", addressLine1: "", city: "", postalCode: "", country: "", idNumber: "",
};

function Stepper({ step }: { step: Step }) {
  const steps: Array<[Step, string]> = [["info", "Personal info"], ["docs", "Documents"], ["review", "Review & submit"]];
  const idx = steps.findIndex(([s]) => s === step);
  return (
    <div className="flex items-center gap-2">
      {steps.map(([s, label], i) => (
        <div key={s} className="flex items-center gap-2">
          <span className={cx(
            "flex h-7 w-7 items-center justify-center rounded-full font-mono text-[12px] font-semibold transition-all",
            i < idx ? "bg-ok text-white" : i === idx ? "bg-pine-ink text-gold" : "bg-paper text-mute border border-line-strong",
          )}>
            {i < idx ? <IconCheck className="text-[13px]" /> : i + 1}
          </span>
          <span className={cx("hidden text-[13px] font-medium sm:block", i === idx ? "text-ink" : "text-mute")}>{label}</span>
          {i < steps.length - 1 && <span className={cx("h-px w-6 sm:w-10", i < idx ? "bg-ok" : "bg-line-strong")} />}
        </div>
      ))}
    </div>
  );
}

function UploadCard({ label, onDone, done }: { label: string; onDone: () => void; done: boolean }) {
  const [progress, setProgress] = useState<number | null>(null);
  const start = () => {
    setProgress(0);
    let p = 0;
    const iv = setInterval(() => {
      p = Math.min(100, p + 12 + Math.random() * 18);
      setProgress(Math.round(p));
      if (p >= 100) { clearInterval(iv); setTimeout(onDone, 250); }
    }, 140);
  };
  return (
    <div className={cx("rounded-xl border p-4 transition-all", done ? "border-ok/40 bg-ok-soft/50" : "border-dashed border-line-strong bg-surface")}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cx("flex h-9 w-9 items-center justify-center rounded-lg", done ? "bg-ok text-white" : "bg-pine-mist text-pine-deep")}>
            {done ? <IconCheck className="text-[15px]" /> : <IconFile className="text-[16px]" />}
          </span>
          <div>
            <p className="text-[13.5px] font-semibold text-ink">{label}</p>
            <p className="font-mono text-[10.5px] text-mute">{done ? "encrypted · sha-256 verified" : "JPG, PNG or PDF · max 8 MB"}</p>
          </div>
        </div>
        {!done && (progress === null
          ? <Button size="sm" variant="secondary" onClick={start}>Upload</Button>
          : <span className="font-mono text-[12px] font-semibold text-pine">{progress}%</span>)}
      </div>
      {progress !== null && !done && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper">
          <div className="h-full rounded-full bg-pine transition-all duration-150" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}

export function KycScreen() {
  const { snap, toast, nav } = useStore();
  const kyc = snap.kyc as KycProfile | null;
  const status = kyc?.status ?? "NOT_STARTED";

  const [started, setStarted] = useState(false);
  const [step, setStep] = useState<Step>("info");
  const [info, setInfo] = useState({ ...EMPTY_INFO, ...(kyc?.personalInfo ?? {}) });
  const [docType, setDocType] = useState<NonNullable<KycProfile["documentType"]>>("PASSPORT");
  const [front, setFront] = useState(false);
  const [back, setBack] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<Outcome>("APPROVE");

  const set = (k: keyof typeof EMPTY_INFO) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setInfo((v) => ({ ...v, [k]: e.target.value }));

  const submit = async () => {
    setBusy(true); setErr(null); setFields({});
    try {
      await api.submitKyc({ personalInfo: info, documentType: docType, outcome });
      toast("info", "Verification submitted", "Provider sandbox is reviewing your documents…");
      setStarted(false); setStep("info"); setFront(false); setBack(false); setConsent(false);
    } catch (e) {
      const ae = e as ApiError;
      if (ae.fields) { setFields(ae.fields); setStep("info"); }
      setErr(ae.message);
    } finally { setBusy(false); }
  };

  /* ---------- verified / terminal states ---------- */
  if (!started && (status === "VERIFIED" || status === "PENDING" || status === "REJECTED" || status === "RETRY_REQUIRED" || status === "EXPIRED")) {
    return (
      <div className="mx-auto max-w-[760px] space-y-5">
        <Card className="overflow-hidden">
          <div className={cx("relative overflow-hidden px-6 py-8 sm:px-8",
            status === "VERIFIED" ? "bg-pine-ink" : status === "PENDING" ? "bg-[#2b2410]" : "bg-[#2b1512]")}>
            <div className="relative z-10 flex flex-wrap items-center gap-5">
              <span className={cx("flex h-14 w-14 items-center justify-center rounded-xl",
                status === "VERIFIED" ? "bg-ok text-white" : status === "PENDING" ? "bg-warn text-white" : "bg-bad text-white")}>
                {status === "VERIFIED" ? <IconShield className="text-[26px]" /> : status === "PENDING" ? <IconScan className="text-[26px]" /> : <IconAlert className="text-[26px]" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <h2 className="font-display text-[24px] font-bold tracking-tight text-[#f2f5f0]">
                    {status === "VERIFIED" ? "Identity verified" : status === "PENDING" ? "Verification in progress" : status === "RETRY_REQUIRED" ? "We need another look" : "Verification rejected"}
                  </h2>
                  <StatusPill status={status} />
                </div>
                <p className="mt-1 max-w-[480px] text-[13.5px] leading-relaxed text-[#b8c6ba]">
                  {status === "VERIFIED" && "Funding and money movement are unlocked. The decision is stored on your KYC profile and enforced by the eligibility gate on every intent."}
                  {status === "PENDING" && "Your documents are with the provider sandbox. Decisions usually land in a few seconds here — this panel updates live."}
                  {status === "RETRY_REQUIRED" && `${kyc?.reason ?? ""} Fix the highlighted details and resubmit — your attempt counter tracks each try.`}
                  {status === "REJECTED" && `${kyc?.reason ?? ""} In production this path branches to manual review; in the sandbox you can simply try again.`}
                  {status === "EXPIRED" && "The verification window lapsed. Start a fresh attempt below."}
                </p>
              </div>
            </div>
            {status === "PENDING" && (
              <div className="relative mt-6 h-1.5 overflow-hidden rounded-full bg-[#3a3220]">
                <div className="stripes-bar h-full w-full rounded-full bg-warn" />
              </div>
            )}
          </div>

          <div className="grid gap-6 px-6 py-6 sm:grid-cols-2 sm:px-8">
            <div>
              <h3 className="mb-3 font-display text-[12px] font-bold uppercase tracking-[0.12em] text-ink-soft">KYC events</h3>
              {kyc && kyc.events.length > 0
                ? <Timeline events={kyc.events} failed={["REJECTED", "EXPIRED", "RETRY_REQUIRED"].includes(status)} />
                : <p className="text-[13px] text-mute">No events recorded yet.</p>}
            </div>
            <div className="space-y-3">
              <div className="rounded-lg border border-line bg-paper/60 px-4 py-3 text-[12.5px] text-ink-soft">
                Attempts <span className="ml-1 font-mono font-semibold text-ink">{kyc?.attempts ?? 0}</span>
                {kyc?.documentType && <> · Document <span className="ml-1 font-mono font-semibold text-ink">{kyc.documentType.replace(/_/g, " ")}</span></>}
                {kyc?.personalInfo && <> · <span className="font-semibold">{kyc.personalInfo.legalName}</span></>}
              </div>
              {status !== "PENDING" && (
                <Button className="w-full" variant={status === "VERIFIED" ? "secondary" : "primary"}
                  onClick={() => { setStarted(true); setStep("info"); setErr(null); setFields({}); }}>
                  <IconRefresh className="text-[15px]" />
                  {status === "VERIFIED" ? "Run a sandbox re-check" : "Start new attempt"}
                </Button>
              )}
              {status === "VERIFIED" && (
                <div className="space-y-2">
                  <Button className="w-full" onClick={() => nav("fund")}>Fund wallet <IconArrowR className="text-[14px]" /></Button>
                  <InfoBanner>The eligibility gate now passes on <code className="font-mono text-[11.5px]">/funding</code> and <code className="font-mono text-[11.5px]">/transfers</code>.</InfoBanner>
                </div>
              )}
            </div>
          </div>
        </Card>
        <SandboxPanel outcome={outcome} setOutcome={setOutcome} />
      </div>
    );
  }

  /* ---------- intro ---------- */
  if (!started) {
    return (
      <div className="mx-auto max-w-[760px] space-y-5">
        <Card className="overflow-hidden">
          <div className="sidebar-grain relative bg-pine-ink px-6 py-9 sm:px-8">
            <div className="relative z-10 flex items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-gold text-pine-ink"><IconId className="text-[26px]" /></span>
              <div>
                <h2 className="font-display text-[24px] font-bold tracking-tight text-[#f2f5f0]">Verify your identity</h2>
                <p className="mt-1 text-[13.5px] text-[#b8c6ba]">Required before funding or moving money — the README's KYC-eligibility gate.</p>
              </div>
            </div>
          </div>
          <div className="grid gap-4 px-6 py-6 sm:grid-cols-3 sm:px-8">
            {[
              { icon: <IconFile className="text-[18px]" />, t: "What you'll need", d: "Legal name, date of birth, address, and one government ID (passport, licence, or national ID)." },
              { icon: <IconScan className="text-[18px]" />, t: "How it works", d: "Documents go to the KycProviderAdapter sandbox: NOT_STARTED → IN_PROGRESS → PENDING → decision." },
              { icon: <IconLock className="text-[18px]" />, t: "Privacy", d: "PII stays behind the API layer. The ledger and UI only ever see the verification status." },
            ].map((c) => (
              <div key={c.t} className="rounded-xl border border-line bg-paper/50 p-4">
                <span className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-lg bg-pine-mist text-pine-deep">{c.icon}</span>
                <p className="font-display text-[14px] font-bold text-ink">{c.t}</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-mute">{c.d}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4 sm:px-8">
            <StatusPill status={status} />
            <Button size="lg" onClick={() => setStarted(true)}>Begin verification <IconArrowR className="text-[15px]" /></Button>
          </div>
        </Card>
        <SandboxPanel outcome={outcome} setOutcome={setOutcome} />
      </div>
    );
  }

  /* ---------- wizard ---------- */
  return (
    <div className="mx-auto max-w-[760px] space-y-5">
      <Card className="p-6 sm:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Stepper step={step} />
          <StatusPill status={busy ? "PENDING" : "IN_PROGRESS"} />
        </div>
        {err && <div className="mb-5"><ErrorBanner message={err} /></div>}

        {step === "info" && (
          <div className="stagger grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Full legal name" placeholder="As it appears on your ID" value={info.legalName} error={fields.legalName} onChange={set("legalName")} />
            </div>
            <Field label="Date of birth" type="date" value={info.dob} error={fields.dob} onChange={set("dob")} />
            <Field label="ID number" placeholder="Passport / licence no." value={info.idNumber} error={fields.idNumber} onChange={set("idNumber")} />
            <div className="sm:col-span-2">
              <Field label="Address line 1" placeholder="Street and number" value={info.addressLine1} error={fields.addressLine1} onChange={set("addressLine1")} />
            </div>
            <Field label="City" value={info.city} error={fields.city} onChange={set("city")} />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Postal code" value={info.postalCode} error={fields.postalCode} onChange={set("postalCode")} />
              <Field label="Country" placeholder="US" value={info.country} error={fields.country} onChange={set("country")} />
            </div>
            <div className="flex justify-end gap-2.5 sm:col-span-2">
              <Button variant="ghost" onClick={() => setStarted(false)}>Cancel</Button>
              <Button onClick={() => { setStep("docs"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Continue to documents <IconArrowR className="text-[14px]" /></Button>
            </div>
          </div>
        )}

        {step === "docs" && (
          <div className="space-y-4">
            <Select label="Document type" value={docType} onChange={(e) => setDocType(e.target.value as NonNullable<KycProfile["documentType"]>)}>
              <option value="PASSPORT">Passport</option>
              <option value="DRIVERS_LICENSE">Driver's licence</option>
              <option value="NATIONAL_ID">National ID card</option>
            </Select>
            <UploadCard label="Front side" done={front} onDone={() => setFront(true)} />
            <UploadCard label="Back side (or data page)" done={back} onDone={() => setBack(true)} />
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-paper/50 px-4 py-3.5">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#175e45]" />
              <span className="text-[13px] leading-relaxed text-ink-soft">
                I consent to BMONI sharing these documents with its KYC provider for identity verification,
                processed under the data-retention policy.
              </span>
            </label>
            <div className="flex justify-between gap-2.5">
              <Button variant="ghost" onClick={() => setStep("info")}>Back</Button>
              <Button disabled={!front || !back || !consent} onClick={() => setStep("review")}>
                Continue to review <IconArrowR className="text-[14px]" />
              </Button>
            </div>
            {(!front || !back) && <p className="text-right text-[12px] text-mute">Upload both sides to continue.</p>}
          </div>
        )}

        {step === "review" && (
          <div className="space-y-5">
            <div className="overflow-hidden rounded-xl border border-line">
              {[
                ["Legal name", info.legalName], ["Date of birth", info.dob], ["ID number", info.idNumber.replace(/./g, "•").slice(0, 6) + info.idNumber.slice(-2)],
                ["Address", `${info.addressLine1}, ${info.city} ${info.postalCode}, ${info.country}`],
                ["Document", docType.replace(/_/g, " ") + " · front + back uploaded"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-4 border-b border-line/70 bg-surface px-4 py-3 last:border-0">
                  <span className="text-[12px] font-semibold uppercase tracking-wide text-mute">{k}</span>
                  <span className="text-right text-[13.5px] font-medium text-ink">{v || "—"}</span>
                </div>
              ))}
            </div>
            <InfoBanner>
              Sandbox decision engine: the switch below (or your email address) decides the provider outcome —
              handy for testing the rejected / retry branches end to end.
            </InfoBanner>
            <div className="flex flex-wrap justify-between gap-3">
              <Button variant="ghost" onClick={() => setStep("docs")}>Back</Button>
              <Button size="lg" loading={busy} onClick={submit}>
                Submit for verification <IconArrowR className="text-[15px]" />
              </Button>
            </div>
          </div>
        )}
      </Card>
      <SandboxPanel outcome={outcome} setOutcome={setOutcome} />
    </div>
  );
}

function SandboxPanel({ outcome, setOutcome }: { outcome: Outcome; setOutcome: (o: Outcome) => void }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-display text-[13px] font-bold uppercase tracking-[0.12em] text-ink-soft">
            <IconInfo className="text-[15px] text-gold-ink" /> Provider sandbox controls
          </h3>
          <p className="mt-1 text-[12.5px] text-mute">Force the next KYC decision — mirrors the webhook branches the real adapter will handle.</p>
        </div>
        <Segmented<Outcome>
          value={outcome} onChange={setOutcome}
          options={[
            { value: "APPROVE", label: <span className="text-[#4da173]">Approve</span> },
            { value: "REJECT", label: <span className="text-[#d98074]">Reject</span> },
            { value: "RETRY", label: <span className="text-[#d99a52]">Retry required</span> },
          ]}
        />
      </div>
      <div className="mt-4 grid gap-1.5 border-t border-line pt-4 sm:grid-cols-2">
        {SANDBOX_HINTS.map((h) => (
          <p key={h.trigger} className="text-[12px] leading-relaxed text-mute">
            <span className="font-mono text-[11px] text-ink-soft">{h.trigger}</span> → {h.result}
          </p>
        ))}
      </div>
    </Card>
  );
}

