import { createAssetProfile, describeAssetSeparation } from "../core/asset";
import { LICENSE_SUMMARY } from "../core/license";
import { PROOF_CARDS } from "../core/proof";
import { TINANAI_SOLANA_CONFIG } from "../config/tinanai-solana";
import { EKA_TOKEN } from "../config/token";
import { PageIntro, Panel } from "../components/ui";

const ekaAsset = createAssetProfile({
  name: EKA_TOKEN.name,
  symbol: EKA_TOKEN.symbol,
  family: "EVM",
  network: EKA_TOKEN.networkLabel,
  addressLabel: "Contract",
  address: EKA_TOKEN.contractAddress,
  description: "Native EVM token for the EurekaCore protocol surface.",
});

const tinanaiAsset = createAssetProfile({
  name: "TinanAI",
  symbol: "TINANAI",
  family: "Solana",
  network: TINANAI_SOLANA_CONFIG.network,
  addressLabel: "Mint",
  address: TINANAI_SOLANA_CONFIG.mintAddress,
  description: "Solana-native AI token launch configuration driven by environment variables.",
});

export function HomePage() {
  return (
    <div className="grid gap-4">
      <PageIntro
        eyebrow="TinanEureka"
        title="One protocol surface for EKA, TinanAI, proofs, wallets, and launch readiness."
        description="EKA remains an EVM asset on Ethereum, while TinanAI remains a separate Solana token path. Every route, link, and wallet flow keeps those assets isolated and accurately labeled."
      >
        <div className="rounded-2xl border border-tinan-cyan/20 bg-tinan-cyan/10 px-4 py-3 text-sm text-[#BDFBFF]">
          {describeAssetSeparation(ekaAsset, tinanaiAsset)}
        </div>
      </PageIntro>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Protocol assets" subtitle="Verified production-facing configuration for each token family.">
          <div className="grid gap-3 md:grid-cols-2">
            {[ekaAsset, tinanaiAsset].map((asset) => (
              <article key={asset.symbol} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-tinan-cyan">{asset.family}</p>
                <h3 className="mt-2 text-lg font-semibold text-white">{asset.name}</h3>
                <p className="mt-2 text-sm text-white/72">{asset.description}</p>
                <p className="mt-3 text-sm text-white/55">{asset.addressLabel}</p>
                <p className="mt-1 break-all text-sm text-white">{asset.address ?? "Official value required before production."}</p>
              </article>
            ))}
          </div>
        </Panel>

        <Panel title="License + brand guardrails" subtitle="Keep the TinanEureka identity intact while shipping a production-ready surface.">
          <ul className="grid gap-3 text-sm text-white/72">
            <li><span className="text-white">License:</span> {LICENSE_SUMMARY.name}</li>
            <li><span className="text-white">Holder:</span> {LICENSE_SUMMARY.holder}</li>
            <li>{LICENSE_SUMMARY.note}</li>
          </ul>
        </Panel>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        {PROOF_CARDS.map((proof) => (
          <Panel key={proof.title} title={proof.title} subtitle={proof.summary}>
            <p className="text-sm text-white/64">Ready to connect with tokenized data, AI agents, and permissioned marketplace modules.</p>
          </Panel>
        ))}
      </section>
    </div>
  );
}
