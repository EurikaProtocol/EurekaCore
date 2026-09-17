import { DEVICE_SIGNALS } from "../core/device";
import { createIdentityRecord, formatIdentityValue } from "../core/identity";
import { WALLET_PERMISSION_CARDS } from "../core/permissions";
import { TINANAI_SOLANA_CONFIG } from "../config/tinanai-solana";
import { PageIntro, Panel } from "../components/ui";

export function TinanAIPage() {
  const identityRows = [
    createIdentityRecord("service", "Core AI", "TinanAI"),
    createIdentityRecord("solana", "Mint", TINANAI_SOLANA_CONFIG.mintAddress ?? "Official mint required"),
  ];

  return (
    <div className="grid gap-4">
      <PageIntro
        eyebrow="TinanAI"
        title="AI-native workflows stay permissioned, verifiable, and isolated from the EKA EVM token path."
        description="This route is the protocol surface for TinanAI orchestration, metadata, launch messaging, and Solana token readiness."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Identity" subtitle="Current TinanAI service descriptors.">
          <ul className="grid gap-3 text-sm text-white/72">
            {identityRows.map((row) => (
              <li key={row.label} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-white/52">{row.label}</p>
                <p className="mt-1 text-white">{formatIdentityValue(row)}</p>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Permission guardrails" subtitle="Keep AI and token workflows accurate and reviewable.">
          <ul className="grid gap-3 text-sm text-white/72">
            {WALLET_PERMISSION_CARDS.map((card) => (
              <li key={card.title} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="font-medium text-white">{card.title}</p>
                <p className="mt-1">{card.description}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-tinan-cyan">{card.requirement}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        {DEVICE_SIGNALS.map((signal) => (
          <Panel key={signal.title} title={signal.title} subtitle={signal.detail}>
            <p className="text-sm text-white/62">Ready for future device-bound proofs and premium data licensing flows.</p>
          </Panel>
        ))}
      </section>
    </div>
  );
}
