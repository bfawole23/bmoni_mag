import { useEffect, useState } from "react";
import { api, SUPABASE_MODE } from "../mock/api";
import { ApiError } from "../types";
import { useStore } from "../state/store";
import { Button, ErrorBanner, Field } from "../components/ui";
import { LogoMark, IconEye, IconEyeOff, IconShield, IconBolt, IconBank, IconArrowR, IconCheck } from "../components/icons";
import { cx, fmtMoney } from "../lib/utils";

type Mode = "login" | "signup" | "forgot" | "reset";

const TICKER = [
  { t: "Stripe payout — week 14", a: 120410, s: "POSTED" },
  { t: "Payment — INV-2052 · Acme Supplies", a: -48600, s: "COMPLETED" },
  { t: "Card funding", a: 250000, s: "SUCCEEDED" },
  { t: "Reservation — withdrawal", a: -60100, s: "RESERVED" },
  { t: "Internal transfer · jules@bmoni.app", a: 15000, s: "COMPLETED" },
  { t: "Withdrawal to Chase ••4821", a: -60000, s: "COMPLETED" },
  { t: "Reservation released", a: 60100, s: "RELEASED" },
  { t: "Refund — INV-2041 (partial)", a: 12040, s: "POSTED" },
  { t: "Transfer fee", a: -25, s: "POSTED" },
  { t: "Open banking funding", a: 98000, s: "SUCCEEDED" },
];

function BrandPanel() {
  return (
    <div className="sidebar-grain relative hidden flex-1 flex-col overflow-hidden bg-pine-ink text-[#c4d3c8] lg:flex">
      <div className="relative z-10 flex items-center gap-3 px-10 pt-10">
        <LogoMark size={40} />
        <div>
          <div className="font-display text-[22px] font-bold leading-none tracking-tight text-[#f0f5ef]">BMONI</div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.24em] text-[#7e9487]">Embedded money infrastructure</div>
        </div>
      </div>

      <div className="relative z-10 mt-12 px-10">
        <h1 className="max-w-[460px] font-display text-[38px] font-bold leading-[1.08] tracking-tight text-[#f0f5ef]">
          The ledger is the<br />source of truth.
        </h1>
        <p className="mt-4 max-w-[420px] text-[15px] leading-relaxed text-[#9db3a5]">
          Wallets, KYC, rails, funding and money movement — one provider-independent
          core, every state machine surfaced. This is the Phase 1 shell running on the mock
          <span className="font-mono text-[13px] text-[#e8b25c]"> apiClient</span>.
        </p>
        <div className="mt-6 flex flex-wrap gap-2.5">
          {[
            { icon: <IconShield className="text-[13px]" />, label: "KYC state machine" },
            { icon: <IconBank className="text-[13px]" />, label: "Rail adapters" },
            { icon: <IconBolt className="text-[13px]" />, label: "Idempotent intents" },
          ].map((c) => (
            <span key={c.label} className="inline-flex items-center gap-2 rounded-full border border-[#2c4a3b] bg-[#16302633] px-3.5 py-1.5 text-[12px] font-medium text-[#b9cbbd]">
              <span className="text-gold">{c.icon}</span>{c.label}
            </span>
          ))}
        </div>
      </div>

      {/* live ledger ticker */}
      <div className="relative z-10 mt-10 flex-1 overflow-hidden border-t border-[#1d3629] px-10 py-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#5f7a6c]">sandbox ledger · streaming</span>
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-ok"><span className="h-1.5 w-1.5 rounded-full bg-ok dot-live" />operational</span>
        </div>
        <div className="relative h-[240px] overflow-hidden [mask-image:linear-gradient(180deg,transparent,#000_12%,#000_85%,transparent)]">
          <div className="ticker-col space-y-2">
            {[...TICKER, ...TICKER].map((r, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-[#1d3629] bg-[#0d1f18b3] px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-[#dbe6dc]">{r.t}</p>
                  <p className="font-mono text-[10px] text-[#5f7a6c]">LE_{String(90210 + i)} · double-entry</p>
                </div>
                <div className="text-right">
                  <p className={cx("font-mono text-[13.5px] font-semibold tabular", r.a >= 0 ? "text-[#7fd0a5]" : "text-[#e8a79c]")}>
                    {r.a >= 0 ? "+" : "−"}{fmtMoney(Math.abs(r.a)).slice(1)}
                  </p>
                  <p className="font-mono text-[9.5px] uppercase tracking-wide text-[#5f7a6c]">{r.s}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthScreen() {
  const { toast } = useStore();
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [showPw, setShowPw] = useState(false);
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  useEffect(() => { setFormError(null); setFields({}); }, [mode]);

  const err = (k: string) => fields[k];

  async function run(fn: () => Promise<void>) {
    setBusy(true); setFormError(null); setFields({});
    try { await fn(); }
    catch (e) {
      const ae = e as ApiError;
      if (ae.fields) setFields(ae.fields);
      setFormError(ae.message ?? "Something went wrong.");
    } finally { setBusy(false); }
  }

  const eyeBtn = (
    <button type="button" onClick={() => setShowPw((v) => !v)} className="p-1 text-mute transition-colors hover:text-ink" aria-label="Toggle password visibility">
      {showPw ? <IconEyeOff className="text-[17px]" /> : <IconEye className="text-[17px]" />}
    </button>
  );

  return (
    <div className="relative flex min-h-screen">
      <BrandPanel />

      <div className="ledger-rules noise relative flex w-full flex-col items-center justify-center overflow-y-auto px-4 py-10 lg:max-w-[560px] lg:flex-1">
        <div className="relative z-10 w-full max-w-[400px] animate-fade-up">
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <LogoMark size={36} />
            <div>
              <div className="font-display text-[19px] font-bold leading-none text-ink">BMONI</div>
              <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.22em] text-mute">Embedded · sandbox</div>
            </div>
          </div>

          <h2 className="font-display text-[28px] font-bold tracking-tight text-ink">
            {mode === "login" ? "Sign in" : mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset password" : "Choose a new password"}
          </h2>
          <p className="mt-1.5 text-[14px] text-mute">
            {mode === "login" && "Access your embedded money console."}
            {mode === "signup" && "A wallet is provisioned on the sandbox ledger instantly."}
            {mode === "forgot" && "We'll issue a one-time reset code (sandbox: 246810)."}
            {mode === "reset" && resetSentTo && <>Enter the code sent to <span className="font-semibold text-ink">{resetSentTo}</span>.</>}
          </p>

          <div className="mt-7 space-y-4">
            {formError && <ErrorBanner message={formError} />}

            {mode === "signup" && (
              <Field label="Full legal name" placeholder="Ada Okonkwo" value={name} error={err("name")}
                onChange={(e) => setName(e.target.value)} autoComplete="name" />
            )}

            {mode !== "reset" && (
              <Field label="Email" type="email" placeholder="you@company.com" value={email} error={err("email")}
                onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            )}

            {(mode === "login" || mode === "signup") && (
              <Field label="Password" type={showPw ? "text" : "password"} placeholder="••••••••" value={password}
                error={err("password")} onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"} right={eyeBtn} />
            )}

            {mode === "reset" && (
              <>
                <Field label="One-time code" placeholder="6 digits" value={code} error={err("code")}
                  onChange={(e) => setCode(e.target.value)} className="font-mono tracking-[0.3em]" hint="sandbox: 246810" />
                <Field label="New password" type={showPw ? "text" : "password"} placeholder="8+ characters" value={password}
                  error={err("password")} onChange={(e) => setPassword(e.target.value)} right={eyeBtn} />
              </>
            )}

            <Button
              size="lg" className="w-full" loading={busy}
              onClick={() => {
                if (mode === "login") run(() => api.login(email, password));
                else if (mode === "signup") run(() => api.signup(name, email, password));
                else if (mode === "forgot") run(async () => { await api.requestReset(email); setResetSentTo(email); setMode("reset"); toast("info", "Reset code issued", "Sandbox code: 246810"); });
                else run(async () => { await api.confirmReset(resetSentTo ?? email, code, password); toast("success", "Password updated", "Sign in with your new password."); setMode("login"); setPassword(""); setCode(""); });
              }}
            >
              {mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset code" : "Update password"}
              {!busy && <IconArrowR className="text-[15px]" />}
            </Button>

            {mode === "login" && (
              <div className="flex items-center justify-between text-[13px]">
                <button onClick={() => setMode("forgot")} className="font-medium text-pine transition-colors hover:text-pine-deep">Forgot password?</button>
                <span className="text-mute">New here?{" "}
                  <button onClick={() => setMode("signup")} className="font-semibold text-pine transition-colors hover:text-pine-deep">Create account</button>
                </span>
              </div>
            )}
            {mode === "signup" && (
              <p className="text-center text-[13px] text-mute">
                Already have an account?{" "}
                <button onClick={() => setMode("login")} className="font-semibold text-pine hover:text-pine-deep">Sign in</button>
              </p>
            )}
            {mode === "reset" && (
              <button onClick={() => setMode("forgot")} className="block w-full text-center text-[13px] font-medium text-pine hover:text-pine-deep">
                Resend code
              </button>
            )}
          </div>

          {mode === "login" && SUPABASE_MODE && (
            <div className="mt-8 flex items-center justify-between gap-3 rounded-xl border border-pine/25 bg-pine-mist/60 px-4 py-3.5">
              <span>
                <span className="flex items-center gap-2 font-display text-[12px] font-bold uppercase tracking-[0.1em] text-pine-deep">
                  <IconBolt className="text-[13px]" /> Supabase mode
                </span>
                <span className="mt-1 block font-mono text-[12px] text-mute">auth + ledger on your project — create an account to begin</span>
              </span>
              <span className="flex items-center gap-1.5 font-mono text-[10px] text-ok"><span className="h-1.5 w-1.5 rounded-full bg-ok dot-live" />linked</span>
            </div>
          )}

          {mode === "login" && !SUPABASE_MODE && (
            <button
              onClick={() => { setEmail("demo@bmoni.app"); setPassword("bmoni-demo"); setFormError(null); setFields({}); }}
              className="group mt-8 w-full rounded-xl border border-dashed border-line-strong bg-surface/70 px-4 py-3.5 text-left transition-all hover:border-pine hover:bg-pine-mist/50"
            >
              <span className="flex items-center justify-between">
                <span>
                  <span className="flex items-center gap-2 font-display text-[12px] font-bold uppercase tracking-[0.1em] text-pine-deep">
                    <IconCheck className="text-[13px]" /> Demo workspace
                  </span>
                  <span className="mt-1 block font-mono text-[12px] text-mute">demo@bmoni.app · bmoni-demo — click to autofill</span>
                </span>
                <IconArrowR className="text-[16px] text-mute transition-all group-hover:translate-x-0.5 group-hover:text-pine" />
              </span>
            </button>
          )}

          <p className="mt-8 text-center text-[11.5px] leading-relaxed text-mute">
            Phase 1 runs entirely on mock data — no real money, no real provider calls.
            <br />The UI never talks to a provider directly; everything flows through the API layer.
          </p>
        </div>
      </div>
    </div>
  );
}
