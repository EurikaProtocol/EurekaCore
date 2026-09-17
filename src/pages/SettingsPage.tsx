import { TINANAI_SOLANA_CONFIG } from "../config/tinanai-solana";
import { PageIntro, Panel } from "../components/ui";

export function SettingsPage() {
  return (
    <div className="grid gap-4">
      <PageIntro
        eyebrow="Settings"
        title="Deployment-facing environment and network readiness."
        description="Cloudflare Pages should build this Vite app on Node 22 with npm run build and dist output. Solana launch values stay runtime-configured through environment variables."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Cloudflare Pages" subtitle="Required deploy settings.">
          <ul className="space-y-2 text-sm text-white/72">
            <li>Framework preset: Vite</li>
            <li>Build command: npm run build</li>
            <li>Output directory: dist</li>
            <li>Node version: 22</li>
            <li>NPM_FLAGS=--legacy-peer-deps</li>
          </ul>
        </Panel>
        <Panel title="Solana configuration" subtitle="Official values required before production launch.">
          <ul className="space-y-2 text-sm text-white/72">
            <li>Network: {TINANAI_SOLANA_CONFIG.network}</li>
            <li className="break-all">RPC: {TINANAI_SOLANA_CONFIG.rpcUrl}</li>
            <li className="break-all">Mint: {TINANAI_SOLANA_CONFIG.mintAddress ?? "Not configured"}</li>
          </ul>
        </Panel>
      </div>

      {TINANAI_SOLANA_CONFIG.warnings.length > 0 ? (
        <Panel title="Required placeholders" subtitle="Review before production deployment.">
          <ul className="space-y-2 text-sm text-white/72">
            {TINANAI_SOLANA_CONFIG.warnings.map((warning) => (
              <li key={warning}>• {warning}</li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
