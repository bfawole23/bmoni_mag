import { useMemo, useState, type ReactNode } from "react";
import { useStore, type Route } from "../state/store";
import { api, SUPABASE_MODE } from "../mock/api";
import { cx, initials, timeAgo } from "../lib/utils";
import { Button, Modal, StatusPill, ToastHost } from "./ui";
import {
  LogoMark, IconGrid, IconWallet, IconFund, IconSend, IconId, IconBank,
  IconBell, IconUser, IconOut, IconMenu, IconX, IconShield, IconCheck,
} from "./icons";
import { fmtMoney } from "../lib/utils";

const NAV: Array<{ route: Route; label: string; icon: ReactNode }> = [
  { route: "dashboard", label: "Dashboard", icon: <IconGrid className="text-[17px]" /> },
  { route: "wallet", label: "Wallet & Ledger", icon: <IconWallet className="text-[17px]" /> },
  { route: "fund", label: "Fund Wallet", icon: <IconFund className="text-[17px]" /> },
  { route: "move", label: "Move Money", icon: <IconSend className="text-[17px]" /> },
  { route: "kyc", label: "Identity (KYC)", icon: <IconId className="text-[17px]" /> },
  { route: "rails", label: "Rails & Payees", icon: <IconBank className="text-[17px]" /> },
  { route: "account", label: "Account", icon: <IconUser className="text-[17px]" /> },
];

const TITLES: Record<Route, [string, string]> = {
  dashboard: ["Operations", "Your money pipeline at a glance"],
  wallet: ["Wallet & Ledger", "Every cent, entry by entry"],
  fund: ["Fund Wallet", "Move money in over a payment rail"],
  move: ["Move Money", "Send, withdraw, or transfer internally"],
  kyc: ["Identity Verification", "Provider-sandboxed KYC state machine"],
  rails: ["Rails & Payees", "Linked accounts and beneficiaries"],
  account: ["Account", "Profile, sessions, preferences, help"],
};

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { snap, route, nav } = useStore();
  const kyc = snap.kyc;
  const unread = snap.notifications.filter((n) => !n.read).length;
  return (
    <div className="sidebar-grain flex h-full flex-col bg-pine-ink text-[#c4d3c8]">
      <div className="flex items-center gap-3 px-5 pb-6 pt-6">
        <LogoMark size={34} />
        <div>
          <div className="font-display text-[17px] font-bold leading-none tracking-tight text-[#f0f5ef]">BMONI</div>
          <div className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.22em] text-[#7e9487]">Embedded · sandbox</div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map((n) => {
          const active = route === n.route;
          return (
            <button
              key={n.route}
              onClick={() => { nav(n.route); onNavigate?.(); }}
              className={cx(
                "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[14px] font-medium transition-all duration-150",
                active ? "bg-[#1d3a2e] text-[#f0f5ef]" : "hover:bg-[#182f25] hover:text-[#e5ede5]",
              )}
            >
              {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-gold" />}
              <span className={cx("transition-colors", active ? "text-gold" : "text-[#7e9487] group-hover:text-[#b9cbbd]")}>{n.icon}</span>
              <span className="flex-1">{n.label}</span>
              {n.route === "kyc" && kyc && kyc.status === "PENDING" && <span className="h-2 w-2 rounded-full bg-warn dot-live" />}
              {n.route === "kyc" && kyc && (kyc.status === "NOT_STARTED" || kyc.status === "RETRY_REQUIRED") && <span className="h-2 w-2 rounded-full bg-gold" />}
              {n.route === "account" && unread > 0 && (
                <span className="rounded-full bg-gold px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none text-pine-ink">{unread}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="mx-3 mb-3 rounded-lg border border-[#24443566] bg-[#0d1f18] p-3.5">
        <div className="flex items-center justify-between">
          <span className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7e9487]">Available</span>
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-[#5f7a6c]">
            <span className="h-1.5 w-1.5 rounded-full bg-ok dot-live" /> ledger live
          </span>
        </div>
        <div className="mt-1 font-mono text-[22px] font-semibold tabular text-[#f0f5ef]">
          {snap.wallet ? fmtMoney(snap.wallet.availableCents) : "—"}
        </div>
        {snap.wallet && snap.wallet.pendingCents > 0 && (
          <div className="mt-0.5 font-mono text-[11.5px] tabular text-warn">+{fmtMoney(snap.wallet.pendingCents)} in flight</div>
        )}
      </div>

      <div className="border-t border-[#1d3629] px-5 py-4">
        <div className="flex items-center gap-2 text-[11px] text-[#5f7a6c]">
          <IconShield className="text-[13px]" />
          <span>{SUPABASE_MODE ? "Phase 1 · Supabase backend" : "Phase 1 · mock data only"}</span>
        </div>
      </div>
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { snap, route, toasts, dismissToast, mobileNavOpen, setMobileNavOpen, nav } = useStore();
  const [bellOpen, setBellOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const { signOut } = useStore();
  const unread = snap.notifications.filter((n) => !n.read).length;
  const [title, subtitle] = TITLES[route];

  const inFlight = useMemo(() => {
    const f = snap.funding.filter((x) => ["CREATED", "REQUIRES_ACTION", "PROCESSING"].includes(x.status)).length;
    const t = snap.transfers.filter((x) => ["CREATED", "PENDING", "PROCESSING"].includes(x.status)).length;
    const k = snap.kyc && snap.kyc.status === "PENDING" ? 1 : 0;
    return f + t + k;
  }, [snap]);

  return (
    <div className="relative flex h-full min-h-screen overflow-hidden">
      {/* ambient background */}
      <div className="ledger-rules noise pointer-events-none absolute inset-0" aria-hidden />
      <div className="pointer-events-none absolute -top-40 left-1/3 h-[420px] w-[620px] rounded-full bg-pine/8 blur-[110px]" aria-hidden />
      <div className="pointer-events-none absolute -bottom-48 right-[-120px] h-[380px] w-[480px] rounded-full bg-gold/10 blur-[110px]" aria-hidden />

      {/* desktop sidebar */}
      <aside className="relative z-20 hidden w-[248px] shrink-0 lg:block">
        <div className="fixed inset-y-0 w-[248px]"><SidebarContent /></div>
      </aside>

      {/* mobile sidebar */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-pine-ink/60 animate-fade-in" onClick={() => setMobileNavOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[268px] shadow-pop animate-fade-in">
            <SidebarContent onNavigate={() => setMobileNavOpen(false)} />
            <button onClick={() => setMobileNavOpen(false)} className="absolute right-3 top-4 rounded-md p-1.5 text-[#c4d3c8] hover:bg-[#1d3a2e]" aria-label="Close menu">
              <IconX className="text-[18px]" />
            </button>
          </div>
        </div>
      )}

      {/* main column */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3.5 sm:px-8">
            <button onClick={() => setMobileNavOpen(true)} className="rounded-lg border border-line bg-surface p-2 text-ink-soft lg:hidden" aria-label="Open menu">
              <IconMenu className="text-[18px]" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-[19px] font-bold leading-tight tracking-tight text-ink sm:text-[21px]">{title}</h1>
              <p className="hidden truncate text-[12.5px] text-mute sm:block">{subtitle}</p>
            </div>

            {inFlight > 0 && (
              <span className="hidden items-center gap-2 rounded-full border border-info/25 bg-info-soft px-3 py-1.5 font-mono text-[11px] font-medium text-info md:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-info dot-proc" />
                {inFlight} in flight
              </span>
            )}
            {snap.kyc && <StatusPill status={snap.kyc.status === "NOT_STARTED" ? "NOT_STARTED" : snap.kyc.status} className="hidden sm:inline-flex" />}

            {/* bell */}
            <div className="relative">
              <button
                onClick={() => { setBellOpen((v) => !v); setMenuOpen(false); }}
                className={cx("relative rounded-lg border p-2 transition-colors", bellOpen ? "border-pine bg-pine-mist text-pine-deep" : "border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink")}
                aria-label="Notifications"
              >
                <IconBell className="text-[17px]" />
                {unread > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 font-mono text-[9.5px] font-bold text-pine-ink">{unread}</span>}
              </button>
              {bellOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setBellOpen(false)} />
                  <div className="absolute right-0 z-50 mt-2 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-surface shadow-pop animate-pop">
                    <div className="flex items-center justify-between border-b border-line px-4 py-3">
                      <span className="font-display text-[13.5px] font-bold text-ink">Notifications</span>
                      <button onClick={() => api.markAllRead()} className="text-[12px] font-semibold text-pine hover:text-pine-deep">Mark all read</button>
                    </div>
                    <div className="max-h-[340px] overflow-y-auto">
                      {snap.notifications.length === 0 && <p className="px-4 py-8 text-center text-[13px] text-mute">Nothing yet — events will land here.</p>}
                      {snap.notifications.slice(0, 12).map((n) => (
                        <div key={n.id} className={cx("flex gap-3 border-b border-line/60 px-4 py-3 last:border-0", !n.read && "bg-pine-mist/40")}>
                          <span className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.kind === "success" ? "bg-ok" : n.kind === "error" ? "bg-bad" : n.kind === "warning" ? "bg-warn" : "bg-info")} />
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold leading-snug text-ink">{n.title}</p>
                            <p className="mt-0.5 text-[12px] leading-snug text-mute">{n.body}</p>
                            <p className="mt-1 font-mono text-[10.5px] text-mute/70">{timeAgo(n.ts)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* user menu */}
            <div className="relative">
              <button
                onClick={() => { setMenuOpen((v) => !v); setBellOpen(false); }}
                className={cx("flex items-center gap-2.5 rounded-lg border py-1.5 pl-1.5 pr-3 transition-colors", menuOpen ? "border-pine bg-pine-mist" : "border-line bg-surface hover:border-line-strong")}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-pine-ink font-display text-[12.5px] font-bold text-gold">
                  {snap.user ? initials(snap.user.name) : "?"}
                </span>
                <span className="hidden text-left md:block">
                  <span className="block max-w-[140px] truncate text-[13px] font-semibold leading-tight text-ink">{snap.user?.name}</span>
                  <span className="block font-mono text-[10px] text-mute">{snap.wallet?.id}</span>
                </span>
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-surface shadow-pop animate-pop">
                    <div className="border-b border-line px-4 py-3">
                      <p className="truncate text-[13.5px] font-semibold text-ink">{snap.user?.name}</p>
                      <p className="truncate text-[12px] text-mute">{snap.user?.email}</p>
                    </div>
                    <button onClick={() => { setMenuOpen(false); nav("account"); }} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13.5px] font-medium text-ink-soft transition-colors hover:bg-paper hover:text-ink">
                      <IconUser className="text-[15px]" /> Profile & settings
                    </button>
                    <button onClick={() => { setMenuOpen(false); setLogoutOpen(true); }} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13.5px] font-medium text-bad transition-colors hover:bg-bad-soft">
                      <IconOut className="text-[15px]" /> Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="relative flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <div key={route} className="animate-fade-up mx-auto w-full max-w-[1180px]">{children}</div>
        </main>

        <footer className="border-t border-line/70 px-4 py-4 sm:px-8">
          <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-2 text-[11.5px] text-mute">
            <span className="font-mono">BMONI Embedded · Phase 1 UI shell — {SUPABASE_MODE ? <>backend live on <code className="rounded bg-pine-mist px-1 py-0.5 text-pine-deep">Supabase</code></> : <>all data mocked in <code className="rounded bg-pine-mist px-1 py-0.5 text-pine-deep">apiClient</code></>}</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-ok dot-live" /> sandbox operational</span>
          </div>
        </footer>
      </div>

      <ToastHost toasts={toasts} onDismiss={dismissToast} />

      <Modal open={logoutOpen} onClose={() => setLogoutOpen(false)} title="Sign out of BMONI?">
        <p className="text-[14px] leading-relaxed text-ink-soft">
          Your session token will be revoked on this device. Pending provider operations keep running on the sandbox and will settle.
        </p>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="secondary" onClick={() => setLogoutOpen(false)}>Stay signed in</Button>
          <Button variant="danger" onClick={async () => { setLogoutOpen(false); await signOut(); }}>
            <IconCheck className="text-[14px]" /> Sign out
          </Button>
        </div>
      </Modal>
    </div>
  );
}


