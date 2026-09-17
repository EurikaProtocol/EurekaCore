import { getMarketplaceListings } from "../core/marketplace";
import { TINANAI_SOLANA_CONFIG } from "../config/tinanai-solana";
import { EKA_TOKEN } from "../config/token";
import { PageIntro, Panel, StatCard } from "../components/ui";
import type { EvmWalletHook } from "../hooks/useEvmWallet";

export function DashboardPage({ evm, solana }: { evm: EvmWalletHook; solana: { connected: boolean; solBalance: string; tokenBalance: string; network: string } }) {
  const listings = getMarketplaceListings(import.meta.env.DEV);

  return (
    <div className="grid gap-4">
      <PageIntro
        eyebrow="Dashboard"
        title="Protocol visibility across EVM and Solana surfaces."
        description="EKA metrics stay tied to Ethereum Mainnet. TinanAI Solana metrics only appear when an official mint is configured through environment variables."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="EKA balance" value={`${evm.snapshot.ekaBalance} ${EKA_TOKEN.symbol}`} detail={evm.snapshot.connected ? evm.snapshot.network : "Connect an EVM wallet."} />
        <StatCard label="Native balance" value={`${evm.snapshot.nativeBalance} ${evm.snapshot.nativeSymbol}`} detail="Connected EVM wallet" />
        <StatCard label="SOL balance" value={solana.connected ? solana.solBalance : "0"} detail={solana.connected ? solana.network : "Connect Phantom."} />
        <StatCard label="TinanAI token" value={solana.tokenBalance} detail={TINANAI_SOLANA_CONFIG.isMintConfigured ? "Official mint configured" : "Mint placeholder required"} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Supply posture" subtitle="EKA values update from the connected Ethereum wallet context.">
          <div className="grid gap-3 md:grid-cols-2">
            <StatCard label="Total supply" value={evm.snapshot.totalSupply} />
            <StatCard label="Burned tokens" value={evm.snapshot.burnedTokens} />
          </div>
        </Panel>

        <Panel title="Marketplace feed policy" subtitle="No fake market data is shown in production.">
          {listings.length === 0 ? (
            <p className="text-sm text-white/72">Production mode stays empty until a verified live marketplace data source is connected.</p>
          ) : (
            <ul className="grid gap-3 text-sm text-white/72">
              {listings.map((listing) => (
                <li key={listing.title} className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                  <p className="font-medium text-white">{listing.title}</p>
                  <p className="mt-1">{listing.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>
    </div>
  );
}
