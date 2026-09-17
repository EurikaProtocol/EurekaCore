import { EKA_TOKEN } from "../config/token";
import { PageIntro, Panel } from "../components/ui";

export function SwapPage() {
  return (
    <div className="grid gap-4">
      <PageIntro
        eyebrow="Swap"
        title="Swap routing is isolated by network family to prevent token confusion."
        description="EKA stays on the EVM side, while TinanAI stays on the Solana side. No cross-family swap flow is implied until an official bridge or launch design exists."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="EKA / EVM swaps" subtitle="Aggregator integration pending.">
          <p className="text-sm text-white/72">When enabled, swaps must target the official {EKA_TOKEN.symbol} contract on {EKA_TOKEN.networkLabel} and require explicit wallet approval.</p>
        </Panel>
        <Panel title="TinanAI / Solana swaps" subtitle="Pump.fun and Solana DEX routing pending.">
          <p className="text-sm text-white/72">This surface does not fabricate liquidity or pricing. It stays inactive until official Solana launch and routing values are configured.</p>
        </Panel>
      </div>
    </div>
  );
}
