import { Component, useEffect, type ErrorInfo, type ReactNode } from "react";
import { StoreProvider, useStore } from "./state/store";
import { Layout } from "./components/Layout";
import { AuthScreen } from "./screens/Auth";
import { Dashboard } from "./screens/Dashboard";
import { WalletScreen } from "./screens/Wallet";
import { FundScreen } from "./screens/Fund";
import { MoveScreen } from "./screens/Move";
import { KycScreen } from "./screens/Kyc";
import { RailsScreen } from "./screens/Rails";
import { AccountScreen } from "./screens/Account";
import { LogoMark } from "./components/icons";
import { Button, Spinner } from "./components/ui";

function BootSplash() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-pine-ink">
      <div className="sidebar-grain absolute inset-0" />
      <div className="relative z-10 flex flex-col items-center animate-fade-up">
        <div className="animate-breathe"><LogoMark size={56} /></div>
        <p className="mt-5 font-display text-[20px] font-bold tracking-tight text-[#f0f5ef]">BMONI Embedded</p>
        <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.24em] text-[#7e9487]">warming the sandbox ledger</p>
        <Spinner className="mt-6 text-[22px] text-gold" />
      </div>
    </div>
  );
}

/* Never let a runtime error render a blank page — show a recovery console instead. */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("[bmoni] render crashed", error, info); }

  resetSandbox = () => {
    try {
      Object.keys(localStorage).filter((k) => k.startsWith("bmoni.")).forEach((k) => localStorage.removeItem(k));
    } catch { /* storage unavailable */ }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-pine-ink px-4">
        <div className="sidebar-grain absolute inset-0" />
        <div className="relative z-10 w-full max-w-[460px] animate-pop rounded-xl border border-[#24443566] bg-[#0d1f18] p-8 shadow-pop">
          <div className="flex items-center gap-3">
            <LogoMark size={38} />
            <div>
              <p className="font-display text-[17px] font-bold tracking-tight text-[#f0f5ef]">Console hit a snag</p>
              <p className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-[#7e9487]">error boundary · sandbox</p>
            </div>
          </div>
          <p className="mt-5 rounded-lg border border-bad/30 bg-bad-soft/10 px-4 py-3 font-mono text-[12px] leading-relaxed text-[#e8a79c]">
            {this.state.error.message || "Unexpected render error"}
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-[#9db3a5]">
            Usually this is stale sandbox data from an earlier build. Resetting clears the local
            ledger and session — nothing else on your machine is touched.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Button variant="gold" onClick={this.resetSandbox}>Reset sandbox data</Button>
            <Button variant="secondary" className="!border-[#2c4a3b] !bg-transparent !text-[#c4d3c8] hover:!border-gold hover:!text-gold" onClick={() => window.location.reload()}>
              Just reload
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

/* tells the boot watchdog in index.html that React painted real content */
function PaintMarker() {
  useEffect(() => {
    (window as unknown as { __bmoniPainted?: boolean }).__bmoniPainted = true;
  }, []);
  return null;
}

function Router() {
  const { ready, snap, route } = useStore();
  if (!ready) return <BootSplash />;
  if (!snap.user) return <AuthScreen />;
  return (
    <Layout>
      {route === "dashboard" && <Dashboard />}
      {route === "wallet" && <WalletScreen />}
      {route === "fund" && <FundScreen />}
      {route === "move" && <MoveScreen />}
      {route === "kyc" && <KycScreen />}
      {route === "rails" && <RailsScreen />}
      {route === "account" && <AccountScreen />}
    </Layout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <PaintMarker />
      <StoreProvider>
        <Router />
      </StoreProvider>
    </ErrorBoundary>
  );
}
