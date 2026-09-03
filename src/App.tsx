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
import { Spinner } from "./components/ui";

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
    <StoreProvider>
      <Router />
    </StoreProvider>
  );
}
