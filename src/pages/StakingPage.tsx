import { EKA_TOKEN } from "../config/token";
import { PageIntro, Panel } from "../components/ui";

export function StakingPage() {
  return (
    <div className="grid gap-4">
      <PageIntro
        eyebrow="Staking"
        title="Prepare staking controls without misrepresenting live yield or validator state."
        description="Staking UI is segmented so future EKA EVM staking and TinanAI Solana launch mechanics can be integrated independently."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="EKA staking lane" subtitle="Reserved for Ethereum Mainnet integrations.">
          <p className="text-sm text-white/72">Current token target: {EKA_TOKEN.symbol} on {EKA_TOKEN.networkLabel}. No staking contract is wired yet, so no rewards or APR data are displayed.</p>
        </Panel>
        <Panel title="TinanAI launch lane" subtitle="Reserved for Solana-native distribution mechanics.">
          <p className="text-sm text-white/72">Launch, vesting, or liquidity actions should only be enabled after official Solana mint, metadata, and Pump.fun values are approved.</p>
        </Panel>
      </div>
    </div>
  );
}
