import { TINANAI_SOLANA_CONFIG } from "../config/tinanai-solana";
import { PageIntro, Panel, LinkButton } from "../components/ui";
import { getPumpfunUrl } from "../sdk/solana";

export function PumpfunPage() {
  const pumpfunUrl = getPumpfunUrl();

  return (
    <div className="grid gap-4">
      <PageIntro
        eyebrow="Pump.fun"
        title="Pump.fun launch routing is validated before it is displayed."
        description="No launch URL appears until the official Pump.fun token page is provided through VITE_PUMPFUN_TOKEN_URL and passes trusted-host validation."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Official launch link" subtitle="Trusted HTTPS only.">
          <LinkButton href={pumpfunUrl} label="Open Pump.fun" />
        </Panel>
        <Panel title="Launch readiness" subtitle="Values required before production.">
          <ul className="space-y-2 text-sm text-white/72">
            <li>Solana network: {TINANAI_SOLANA_CONFIG.network}</li>
            <li>Mint configured: {TINANAI_SOLANA_CONFIG.isMintConfigured ? "Yes" : "No"}</li>
            <li>Metadata configured: {TINANAI_SOLANA_CONFIG.metadataUri ? "Yes" : "No"}</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
