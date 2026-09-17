import { Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { useEvmWallet } from './hooks/useEvmWallet';
import { DashboardPage } from './pages/Dashboard';
import { ExplorerPage } from './pages/Explorer';
import { HomePage } from './pages/Home';
import { MarketplacePage } from './pages/Marketplace';
import { NotFoundPage } from './pages/NotFound';
import { PumpfunPage } from './pages/Pumpfun';
import { SettingsPage } from './pages/Settings';
import { StakingPage } from './pages/Staking';
import { SwapPage } from './pages/Swap';
import { TinanAiPage } from './pages/TinanAi';
import { TinanAiTokenPage } from './pages/TinanAiToken';
import { WalletPage } from './pages/Wallet';
import { WhitepaperPage } from './pages/Whitepaper';

export default function App() {
  const evm = useEvmWallet();

  return (
    <AppShell address={evm.state.address} network={evm.state.network} status={evm.status}>
      <Routes>
        <Route element={<HomePage />} path='/' />
        <Route element={<DashboardPage evm={evm} />} path='/dashboard' />
        <Route element={<WalletPage evm={evm} />} path='/wallet' />
        <Route element={<TinanAiPage />} path='/tinan-ai' />
        <Route element={<MarketplacePage />} path='/marketplace' />
        <Route element={<WhitepaperPage />} path='/whitepaper' />
        <Route element={<StakingPage />} path='/staking' />
        <Route element={<SwapPage />} path='/swap' />
        <Route element={<ExplorerPage evm={evm} />} path='/explorer' />
        <Route element={<SettingsPage />} path='/settings' />
        <Route element={<TinanAiTokenPage />} path='/tinan-ai-token' />
        <Route element={<PumpfunPage />} path='/pumpfun' />
        <Route element={<NotFoundPage />} path='*' />
      </Routes>
    </AppShell>
  );
}
