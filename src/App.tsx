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
import { TINANProjectsPage, TINANProjectPage } from './pages/TinanProjects';
import { TINANAIStudioPage, TINANCreateProjectPage } from './pages/TinanStudio';
import { TINANTokenizationPage } from './pages/TinanTokenization';
import {
  TINANContractsPage,
  TINANDashboardPage,
  TINANDeployPage,
  TINANInfoPage,
  TINANTokenDetailPage,
  TINANTokensPage,
  TINANVerifyPage,
} from './pages/TinanProductPages';

export default function App() {
  const evm = useEvmWallet();

  return (
    <AppShell evm={evm}>
      <Routes>
        <Route element={<HomePage evm={evm} />} path='/' />
        <Route element={<DashboardPage evm={evm} />} path='/eureka-dashboard' />
        <Route element={<TINANDashboardPage address={evm.state.address} ekaBalance={evm.state.ekaBalance} nativeBalance={evm.state.nativeBalance} network={evm.state.network} recentTransactions={evm.recentTransactions} />} path='/dashboard' />
        <Route element={<WalletPage evm={evm} />} path='/wallet' />
        <Route element={<TINANAIStudioPage />} path='/ai' />
        <Route element={<TINANTokenizationPage />} path='/tokenize' />
        <Route element={<TINANCreateProjectPage />} path='/create' />
        <Route element={<TINANProjectsPage />} path='/projects' />
        <Route element={<TINANProjectPage />} path='/project/:id' />
        <Route element={<TINANTokensPage walletAddress={evm.state.address} />} path='/tokens' />
        <Route element={<TINANTokenDetailPage walletAddress={evm.state.address} />} path='/tokens/:address' />
        <Route element={<TINANContractsPage />} path='/contracts' />
        <Route element={<TINANDeployPage />} path='/deploy' />
        <Route element={<TINANVerifyPage />} path='/verify' />
        <Route element={<TINANInfoPage kind='community' />} path='/community' />
        <Route element={<TINANInfoPage kind='docs' />} path='/docs' />
        <Route element={<TINANInfoPage kind='about' />} path='/about' />
        <Route element={<TINANInfoPage kind='privacy' />} path='/privacy' />
        <Route element={<TINANInfoPage kind='terms' />} path='/terms' />
        <Route element={<TINANInfoPage address={evm.state.address} kind='settings' network={evm.state.network} />} path='/settings' />
        <Route element={<TinanAiPage />} path='/tinan-ai' />
        <Route element={<MarketplacePage />} path='/marketplace' />
        <Route element={<WhitepaperPage />} path='/whitepaper' />
        <Route element={<StakingPage />} path='/staking' />
        <Route element={<SwapPage />} path='/swap' />
        <Route element={<ExplorerPage evm={evm} />} path='/explorer' />
        <Route element={<SettingsPage />} path='/legacy-settings' />
        <Route element={<TinanAiTokenPage />} path='/tinan-ai-token' />
        <Route element={<PumpfunPage />} path='/pumpfun' />
        <Route element={<NotFoundPage />} path='*' />
      </Routes>
    </AppShell>
  );
}
