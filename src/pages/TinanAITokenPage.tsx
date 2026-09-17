import { TINANAI_SOLANA_CONFIG } from "../config/tinanai-solana";
import { PageIntro, Panel, KeyValueList, LinkButton } from "../components/ui";
import { getMetadataUri, getPumpfunUrl } from "../sdk/solana";

export function TinanAITokenPage({ balance }: { balance: string }) {
  const metadataUrl = getMetadataUri(TINANAI_SOLANA_CONFIG.metadataUri);
  const pumpfunUrl = getPumpfunUrl();

  return (
    <div className="grid gap-4">
      <PageIntro
        eyebrow="TinanAI token"
        title="Solana token configuration is env-driven and never hardcoded with fake mint values."
        description="This page exposes only validated configuration for the TinanAI Solana asset path and keeps it distinct from the EKA contract."
      />
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Token configuration" subtitle="Official values only.">
          <KeyValueList
            rows={[
              { label: "Network", value: TINANAI_SOLANA_CONFIG.network },
              { label: "Mint", value: TINANAI_SOLANA_CONFIG.mintAddress ?? "Official mint required" },
              { label: "Observed balance", value: balance },
            ]}
          />
        </Panel>
        <Panel title="Verified links" subtitle="Shown only for trusted HTTPS destinations.">
          <div className="flex flex-wrap gap-3">
            <LinkButton href={metadataUrl} label="Metadata URI" />
            <LinkButton href={pumpfunUrl} label="Pump.fun page" />
          </div>
        </Panel>
      </div>
    </div>
  );
}
