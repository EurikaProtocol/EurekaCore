import { TINANAI_SOLANA_CONFIG } from "../config/tinanai-solana";
import { PageIntro, Panel, LinkButton } from "../components/ui";
import { getEkaContractExplorerUrl } from "../sdk/evm";
import { buildSolanaExplorerUrl } from "../sdk/solana";

export function ExplorerPage({ walletAddress }: { walletAddress: string }) {
  const contractUrl = getEkaContractExplorerUrl();
  const walletUrl = walletAddress ? buildSolanaExplorerUrl("address", walletAddress) : null;
  const mintUrl = TINANAI_SOLANA_CONFIG.mintAddress ? buildSolanaExplorerUrl("token", TINANAI_SOLANA_CONFIG.mintAddress) : null;

  return (
    <div className="grid gap-4">
      <PageIntro
        eyebrow="Explorer"
        title="Only trusted explorer destinations are exposed."
        description="EKA contract inspection stays on Etherscan. TinanAI Solana inspection stays on Solscan, and only when official values exist."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Panel title="EKA contract" subtitle="EVM token explorer link.">
          <LinkButton href={contractUrl} label="Open on Etherscan" />
        </Panel>
        <Panel title="Connected Solana wallet" subtitle="Shown when a Phantom wallet is connected.">
          <LinkButton href={walletUrl} label="Open on Solscan" />
        </Panel>
        <Panel title="TinanAI mint" subtitle="Shown when the official mint env var is configured.">
          <LinkButton href={mintUrl} label="Open mint" />
        </Panel>
      </div>
    </div>
  );
}
