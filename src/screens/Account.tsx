import { useState } from "react";
import { api, SANDBOX_HINTS } from "../mock/api";
import { ApiError } from "../types";
import { useStore } from "../state/store";
import { Button, Card, ErrorBanner, Field, Segmented, StatusPill, Toggle, CopyChip, Modal } from "../components/ui";
import { IconUser, IconDevice, IconGear, IconHelp, IconCheck, IconShield, IconWallet, IconBolt, IconChevronD, IconTrash, IconGlobe, IconLock, IconReceipt } from "../components/icons";
import { cx, fmtDate, timeAgo } from "../lib/utils";

type Tab = "profile" | "sessions" | "settings" | "help";

export function AccountScreen() {
  const { snap, settings, setSettings, toast } = useStore();
  const [tab, setTab] = useState<Tab>("profile");
  const [name, setName] = useState(snap.user?.name ?? "");
  const [phone, setPhone] = useState(snap.user?.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const u = snap.user!;
  const kyc = snap.kyc;

  async function saveProfile() {
    setBusy(true); setErr(null); setFields({}); setSaved(false);
    try {
      await api.updateProfile(name, phone);
      setSaved(true);
      toast("success", "Profile updated", "Your account details were saved.");
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      const ae = e as ApiError;
      if (ae.fields) setFields(ae.fields);
      setErr(ae.message);
    } finally { setBusy(false); }
  }

  const revoking = snap.devices.find((d) => d.id === revokeId);

  return (
    <div className="space-y-5">
      <Segmented<Tab>
        value={tab} onChange={setTab}
        options={[
          { value: "profile", label: <span className="flex items-center gap-1.5"><IconUser className="text-[14px]" />Profile</span> },
          { value: "sessions", label: <span className="flex items-center gap-1.5"><IconDevice className="text-[14px]" />Sessions</span> },
          { value: "settings", label: <span className="flex items-center gap-1.5"><IconGear className="text-[14px]" />Settings</span> },
          { value: "help", label: <span className="flex items-center gap-1.5"><IconHelp className="text-[14px]" />Help</span> },
        ]}
      />

      {tab === "profile" && (
        <div className="stagger grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Card className="p-6 sm:p-7">
            <h2 className="font-display text-[17px] font-bold text-ink">Personal details</h2>
            <p className="mt-1 text-[13px] text-mute">These feed the KYC prefill and audit logs.</p>
            <div className="mt-6 space-y-4">
              {err && <ErrorBanner message={err} />}
              <Field label="Full name" value={name} error={fields.name} onChange={(e) => setName(e.target.value)} />
              <Field label="Email (login)" value={u.email} disabled className="opacity-60" hint="immutable in sandbox" />
              <Field label="Phone" type="tel" placeholder="+1 415 555 0100" value={phone} error={fields.phone} onChange={(e) => setPhone(e.target.value)} />
              <div className="flex items-center gap-3 pt-1">
                <Button loading={busy} onClick={saveProfile}>{saved ? <><IconCheck className="text-[15px]" /> Saved</> : "Save changes"}</Button>
                {saved && <span className="text-[12.5px] font-medium text-ok animate-fade-in">PATCH /users/me · 200 OK</span>}
              </div>
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="p-6">
              <h3 className="font-display text-[12px] font-bold uppercase tracking-[0.12em] text-ink-soft">Account status</h3>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[13.5px] text-ink-soft"><IconShield className="text-[15px] text-pine" /> Account</span>
                  <StatusPill status={u.status} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13.5px] text-ink-soft">Identity (KYC)</span>
                  <StatusPill status={kyc?.status ?? "NOT_STARTED"} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[13.5px] text-ink-soft"><IconWallet className="text-[15px] text-pine" /> Wallet</span>
                  <span className="font-mono text-[12.5px] font-semibold text-ink">{snap.wallet?.id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13.5px] text-ink-soft">Member since</span>
                  <span className="font-mono text-[12.5px] text-ink-soft">{fmtDate(u.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13.5px] text-ink-soft">User ID</span>
                  <CopyChip text={u.id} label={u.id} />
                </div>
              </div>
            </Card>
            <Card className="relative overflow-hidden bg-pine-ink p-6">
              <div className="sidebar-grain absolute inset-0" />
              <div className="relative z-10">
                <p className="flex items-center gap-2 font-display text-[12px] font-bold uppercase tracking-[0.14em] text-[#8faa9a]"><IconBolt className="text-gold" /> Authorization model</p>
                <p className="mt-2.5 text-[13px] leading-relaxed text-[#c4d3c8]">
                  Every financial call passes the adapter layer: <span className="font-mono text-[11.5px] text-gold">AuthProvider</span> →{" "}
                  <span className="font-mono text-[11.5px] text-gold">WalletProvider</span> → provider. Swap vendors without touching routes.
                </p>
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === "sessions" && (
        <Card className="overflow-hidden">
          <div className="border-b border-line px-6 py-5">
            <h2 className="font-display text-[17px] font-bold text-ink">Devices & sessions</h2>
            <p className="mt-1 text-[13px] text-mute">JWT sessions issued at login. Revoking kills the refresh token for that device.</p>
          </div>
          <div className="divide-y divide-line/70">
            {snap.devices.map((d) => (
              <div key={d.id} className="flex items-center gap-4 px-6 py-4">
                <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", d.current ? "bg-pine-mist text-pine-deep" : "bg-paper text-mute")}>
                  <IconDevice className="text-[17px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-ink">
                    {d.label}
                    {d.current && <span className="rounded bg-ok-soft px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-wide text-ok">this device</span>}
                  </p>
                  <p className="flex items-center gap-1.5 text-[12px] text-mute"><IconGlobe className="text-[12px]" /> {d.location} · active {timeAgo(d.lastActive)}</p>
                </div>
                {!d.current && (
                  <Button size="sm" variant="ghost" className="text-bad hover:bg-bad-soft hover:text-bad" onClick={() => setRevokeId(d.id)}>
                    <IconTrash className="text-[13px]" /> Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "settings" && (
        <div className="stagger grid gap-5 lg:grid-cols-2">
          <Card className="p-6">
            <h2 className="font-display text-[17px] font-bold text-ink">Display</h2>
            <div className="mt-4 space-y-1 divide-y divide-line/60">
              <div className="py-2">
                <Toggle on={settings.compactNumbers} onChange={(v) => setSettings({ compactNumbers: v })}
                  label="Compact numbers" desc="Show $3.2k instead of $3,164.65 in dense lists" />
              </div>
            </div>
            <p className="mt-4 rounded-lg bg-paper/70 px-3.5 py-2.5 font-mono text-[11px] text-mute">
              Preview: {settings.compactNumbers ? "$3.2k" : "$3,164.65"} · stored client-side, never on the ledger
            </p>
          </Card>
          <Card className="p-6">
            <h2 className="font-display text-[17px] font-bold text-ink">Notifications</h2>
            <div className="mt-4 space-y-1 divide-y divide-line/60">
              <div className="py-2"><Toggle on={settings.notifyFunding} onChange={(v) => setSettings({ notifyFunding: v })} label="Funding events" desc="Succeeded, failed, expired intents" /></div>
              <div className="py-2"><Toggle on={settings.notifyTransfers} onChange={(v) => setSettings({ notifyTransfers: v })} label="Transfer events" desc="Settlements, reversals, cancellations" /></div>
              <div className="py-2"><Toggle on={settings.notifyKyc} onChange={(v) => setSettings({ notifyKyc: v })} label="KYC decisions" desc="Verified, rejected, retry required" /></div>
            </div>
          </Card>
        </div>
      )}

      {tab === "help" && (
        <div className="stagger grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Card className="overflow-hidden">
            <div className="border-b border-line px-6 py-5">
              <h2 className="font-display text-[17px] font-bold text-ink">Frequently asked</h2>
            </div>
            <div className="divide-y divide-line/70">
              {FAQS.map((f, i) => (
                <button key={f.q} onClick={() => setOpenFaq(openFaq === i ? null : i)} className="block w-full px-6 py-4 text-left transition-colors hover:bg-pine-mist/20">
                  <span className="flex items-center justify-between gap-4">
                    <span className="text-[14.5px] font-semibold text-ink">{f.q}</span>
                    <IconChevronD className={cx("shrink-0 text-[16px] text-mute transition-transform duration-200", openFaq === i && "rotate-180")} />
                  </span>
                  {openFaq === i && <span className="mt-2 block text-[13px] leading-relaxed text-mute animate-fade-in">{f.a}</span>}
                </button>
              ))}
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="overflow-hidden">
              <div className="border-b border-line px-6 py-4">
                <h3 className="flex items-center gap-2 font-display text-[12px] font-bold uppercase tracking-[0.12em] text-ink-soft">
                  <IconBolt className="text-[14px] text-gold-ink" /> Build roadmap
                </h3>
                <p className="mt-1 text-[12px] text-mute">Phases 0–11 from the build plan — this console is Phase 1.</p>
              </div>
              <div className="divide-y divide-line/60">
                {PHASES.map((p) => (
                  <div key={p.n} className={cx("flex items-center gap-3 px-5 py-2", p.state === "active" && "bg-gold-soft/60")}>
                    <span className={cx(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-bold",
                      p.state === "done" ? "bg-ok-soft text-ok" : p.state === "active" ? "bg-gold text-pine-ink" : "border border-line bg-paper text-mute",
                    )}>
                      {p.state === "done" ? <IconCheck className="text-[12px]" /> : p.n}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cx("block text-[12.5px] font-semibold leading-tight", p.state === "next" ? "text-mute" : "text-ink")}>{p.name}</span>
                      <span className="block truncate text-[10.5px] text-mute">{p.note}</span>
                    </span>
                    {p.state === "active"
                      ? <span className="shrink-0 rounded-full bg-gold px-2 py-0.5 font-display text-[9px] font-bold uppercase tracking-wide text-pine-ink">live now</span>
                      : p.state === "done"
                        ? <span className="shrink-0 font-mono text-[9.5px] font-semibold uppercase text-ok">done</span>
                        : <IconLock className="shrink-0 text-[12px] text-mute/60" />}
                  </div>
                ))}
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="border-b border-line px-6 py-4">
                <h3 className="flex items-center gap-2 font-display text-[12px] font-bold uppercase tracking-[0.12em] text-ink-soft">
                  <IconReceipt className="text-[14px] text-pine" /> API contract
                </h3>
                <p className="mt-1 text-[12px] text-mute">Every call in this shell maps 1:1 onto a versioned route.</p>
              </div>
              <div className="space-y-3.5 px-6 py-4">
                {CONTRACTS.map((g) => (
                  <div key={g.group}>
                    <p className="mb-1 font-mono text-[9.5px] uppercase tracking-[0.18em] text-mute">{g.group}</p>
                    <div className="space-y-0.5">
                      {g.routes.map(([m, path]) => (
                        <p key={m + path} className="flex items-center gap-2 font-mono text-[11px] text-ink-soft">
                          <span className={cx(
                            "w-[54px] shrink-0 rounded px-1 py-0.5 text-center text-[9px] font-bold",
                            m === "GET" ? "bg-pine-mist text-pine-deep" : m === "POST" ? "bg-gold-soft text-gold-ink"
                              : m === "PATCH" ? "bg-info-soft text-info" : "bg-bad-soft text-bad",
                          )}>{m}</span>
                          <span className="truncate">/api/v1{path}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
                <p className="border-t border-line pt-2.5 text-[11px] leading-relaxed text-mute">
                  Money-mutating routes accept an <span className="font-mono text-[10px] text-ink-soft">Idempotency-Key</span>; provider
                  webhooks arrive HMAC-signed. Both are already modelled in the sandbox.
                </p>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-display text-[12px] font-bold uppercase tracking-[0.12em] text-ink-soft">Sandbox triggers</h3>
              <p className="mt-1 text-[12px] text-mute">Deterministic ways to exercise every failure state:</p>
              <div className="mt-3 space-y-2">
                {SANDBOX_HINTS.map((h) => (
                  <div key={h.trigger} className="rounded-lg border border-line bg-paper/50 px-3 py-2">
                    <p className="font-mono text-[11px] font-semibold text-ink-soft">{h.trigger}</p>
                    <p className="text-[11.5px] text-mute">{h.result}</p>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-6">
              <h3 className="font-display text-[12px] font-bold uppercase tracking-[0.12em] text-ink-soft">System status</h3>
              <div className="mt-3 space-y-2.5">
                {[["BMONI API (mock)", true], ["Ledger service", true], ["KYC provider sandbox", true], ["Payment provider sandbox", true], ["Banking rail sandbox", true]].map(([label, ok]) => (
                  <div key={label as string} className="flex items-center justify-between text-[13px]">
                    <span className="text-ink-soft">{label as string}</span>
                    <span className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-ok">
                      <span className="h-1.5 w-1.5 rounded-full bg-ok dot-live" />operational
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-4 border-t border-line pt-3 font-mono text-[10.5px] leading-relaxed text-mute">
                Phase 1 UI shell · apiClient v1 · OpenAPI contract in docs/api-contracts.md
              </p>
            </Card>
          </div>
        </div>
      )}

      <Modal open={!!revokeId} onClose={() => setRevokeId(null)} title="Revoke this session?">
        <p className="text-[14px] leading-relaxed text-ink-soft">
          <span className="font-semibold text-ink">{revoking?.label}</span> in {revoking?.location} will be signed out immediately.
          Anyone using it will need to log in again.
        </p>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="secondary" onClick={() => setRevokeId(null)}>Keep session</Button>
          <Button variant="danger" onClick={async () => {
            if (revokeId) { await api.revokeDevice(revokeId); toast("info", "Session revoked", `${revoking?.label} was signed out.`); }
            setRevokeId(null);
          }}>Revoke session</Button>
        </div>
      </Modal>
    </div>
  );
}

const FAQS = [
  { q: "Why is my balance different from my transfers?", a: "The balance is projected from ledger entries, not transfer records. While an intent is PROCESSING its reservation reduces 'available'; pending funding shows under 'in flight' until the webhook posts the CREDIT entry." },
  { q: "What does REVERSED mean?", a: "The provider settled the transfer, then recalled it — the sandbox does this for amounts ending in .77. A RELEASE entry refunds the full amount and the timeline shows both events." },
  { q: "Why can't I fund or send money?", a: "Both flows pass the KYC-eligibility gate. Verify your identity first (the sandbox approval takes a few seconds), then the gates open." },
  { q: "Is any of this real?", a: "No. Phase 1 runs entirely on a mocked apiClient with a local ledger. Phases 2–3 swap the mock for the FastAPI server and Supabase without changing a single screen." },
  { q: "How do webhooks work here?", a: "Provider timers play the role of webhooks: they mutate the record, append a state event, then post ledger entries — exactly the order the signed-webhook handler will follow in Phase 5+." },
  { q: "What is the Idempotency-Key?", a: "A client-generated key attached to every funding intent and transfer. Replaying a confirm with the same key returns the original record instead of creating a second one — the failed-transfer retry button does exactly this, so a flaky network can never double-spend." },
  { q: "How are limits enforced?", a: "Funding has per-intent minimums and maximums; outflows (send + withdraw) are capped at a daily limit computed from today's non-failed intents. Both checks run in the API layer before any reservation touches the ledger." },
];

const PHASES: Array<{ n: number; name: string; note: string; state: "done" | "active" | "next" }> = [
  { n: 0, name: "Product Foundation", note: "Repo scaffold · API contracts · DB entity list", state: "done" },
  { n: 1, name: "UI Shell", note: "This console — every screen on mock data, full state coverage", state: "active" },
  { n: 2, name: "Application Server", note: "FastAPI /api/v1 · validation · idempotency foundation", state: "next" },
  { n: 3, name: "User", note: "Real auth & JWT sessions behind AuthProviderAdapter", state: "next" },
  { n: 4, name: "Wallet", note: "Ledger-backed balances · transaction history", state: "next" },
  { n: 5, name: "KYC", note: "Provider adapter · signed webhooks · state machine", state: "next" },
  { n: 6, name: "Rail", note: "Account linking & validation · beneficiaries", state: "next" },
  { n: 7, name: "Fund", note: "Intents → provider → webhook → ledger post", state: "next" },
  { n: 8, name: "Move Money", note: "Reservations · fees · limits · full lifecycle", state: "next" },
  { n: 9, name: "Infrastructure", note: "Hosting · secrets · queues · CI/CD (gated on 1–8)", state: "next" },
  { n: 10, name: "Security & Compliance", note: "Hardening pass · audit logs · fraud controls", state: "next" },
  { n: 11, name: "Testing & Launch", note: "Unit / integration / E2E · sandbox certification", state: "next" },
];

const CONTRACTS: Array<{ group: string; routes: Array<[string, string]> }> = [
  { group: "auth", routes: [["POST", "/auth/signup"], ["POST", "/auth/login"], ["POST", "/auth/logout"], ["POST", "/auth/password-reset"]] },
  { group: "users", routes: [["GET", "/users/me"], ["PATCH", "/users/me"], ["GET", "/users/me/devices"], ["DELETE", "/users/me/devices/:id"]] },
  { group: "wallets", routes: [["GET", "/wallets/me"], ["GET", "/wallets/me/balances"], ["GET", "/wallets/me/transactions"], ["GET", "/wallets/me/ledger"]] },
  { group: "kyc", routes: [["GET", "/kyc/me"], ["POST", "/kyc/submit"], ["POST", "/kyc/retry"], ["POST", "/webhooks/kyc"]] },
  { group: "rails", routes: [["GET", "/rails/accounts"], ["POST", "/rails/accounts"], ["POST", "/rails/accounts/:id/deactivate"], ["POST", "/rails/accounts/:id/reactivate"], ["DELETE", "/rails/accounts/:id"]] },
  { group: "beneficiaries", routes: [["GET", "/rails/beneficiaries"], ["POST", "/rails/beneficiaries"], ["POST", "/rails/beneficiaries/:id/deactivate"], ["DELETE", "/rails/beneficiaries/:id"]] },
  { group: "funding", routes: [["GET", "/funding/intents"], ["POST", "/funding/intents"], ["POST", "/funding/intents/:id/confirm"], ["POST", "/funding/intents/:id/cancel"], ["POST", "/webhooks/payments"]] },
  { group: "money movement", routes: [["POST", "/transfers"], ["POST", "/withdrawals"], ["POST", "/internal-transfers"], ["POST", "/transfers/:id/cancel"], ["GET", "/transfers"], ["POST", "/webhooks/rails"]] },
];
