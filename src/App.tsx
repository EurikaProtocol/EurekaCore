import { NavLink, Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { DashboardPage } from "./pages/DashboardPage";
import { WalletPage } from "./pages/WalletPage";
import { TinanAIPage } from "./pages/TinanAIPage";
import { MarketplacePage } from "./pages/MarketplacePage";
import Whitepaper from "./pages/Whitepaper";
import { StakingPage } from "./pages/StakingPage";
import { SwapPage } from "./pages/SwapPage";
import { ExplorerPage } from "./pages/ExplorerPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TinanAITokenPage } from "./pages/TinanAITokenPage";
import { PumpfunPage } from "./pages/PumpfunPage";
import { useEvmWallet } from "./hooks/useEvmWallet";
import { useSolanaSnapshot } from "./hooks/useSolanaSnapshot";
import { truncateMiddle } from "./core/verify";

const NAV_ITEMS = [
  ["/", "Home"],
  ["/dashboard", "Dashboard"],
  ["/wallet", "Wallet"],
  ["/tinan-ai", "TinanAI"],
  ["/marketplace", "Marketplace"],
  ["/whitepaper", "Whitepaper"],
  ["/staking", "Staking"],
  ["/swap", "Swap"],
  ["/explorer", "Explorer"],
  ["/settings", "Settings"],
  ["/tinan-ai-token", "TinanAI Token"],
  ["/pumpfun", "Pump.fun"],
] as const;

export default function App() {
  const evm = useEvmWallet();
  const solana = useSolanaSnapshot();

  return (
    <div className="min-h-screen bg-tinan-black text-white">
      <header className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <img alt="EUREKA logo" className="h-11 w-11 rounded-xl bg-black/40 p-1" src="/logo.svg" />
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-tinan-cyan">TINAN EUREKA</p>
            <h1 className="text-2xl font-semibold text-white">EUREKA Protocol</h1>
          </div>
        </div>
        <nav className="glass cyan-outline flex flex-wrap items-center gap-1 px-2 py-2 text-sm">
          {NAV_ITEMS.map(([path, label]) => (
            <NavLink key={path} to={path} className={({ isActive }) => `rounded-xl px-3 py-2 ${isActive ? "bg-tinan-cyan text-black" : "text-white/75 hover:bg-white/10"}`}>
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto grid w-full max-w-7xl gap-4 px-4 pb-10">
        <section className="glass cyan-outline grid gap-2 p-4 lg:grid-cols-3">
          <StatusPill label="EKA wallet" value={evm.snapshot.connected ? truncateMiddle(evm.snapshot.address) : "Disconnected"} />
          <StatusPill label="EKA network" value={evm.snapshot.network} />
          <StatusPill label="TinanAI wallet" value={solana.connected ? truncateMiddle(solana.address, 8, 6) : "Disconnected"} />
        </section>

        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/dashboard" element={<DashboardPage evm={evm} solana={solana} />} />
          <Route path="/wallet" element={<WalletPage evm={evm} solana={solana} />} />
          <Route path="/tinan-ai" element={<TinanAIPage />} />
          <Route path="/marketplace" element={<MarketplacePage />} />
          <Route path="/whitepaper" element={<Whitepaper />} />
          <Route path="/staking" element={<StakingPage />} />
          <Route path="/swap" element={<SwapPage />} />
          <Route path="/explorer" element={<ExplorerPage walletAddress={solana.address} />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/tinan-ai-token" element={<TinanAITokenPage balance={solana.tokenBalance} />} />
          <Route path="/pumpfun" element={<PumpfunPage />} />
        </Routes>
      </main>
    </div>
  );
}

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.24em] text-tinan-cyan">{label}</p>
      <p className="mt-1 text-sm text-white/78">{value}</p>
    </div>
  );
}
