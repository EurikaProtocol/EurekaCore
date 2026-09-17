import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useMemo, useState, type FormEvent } from "react";
import { TINANAI_SOLANA_CONFIG } from "../config/tinanai-solana";
import { EKA_TOKEN } from "../config/token";
import { TRUSTED_WALLET_LINKS } from "../solana/wallet";
import { PageIntro, Panel, KeyValueList, LinkButton } from "../components/ui";
import type { EvmWalletHook } from "../hooks/useEvmWallet";

export function WalletPage({ evm, solana }: { evm: EvmWalletHook; solana: { address: string; connected: boolean; disconnect: () => void; explorerAddressUrl: string | null; explorerMintUrl: string | null; network: string; rpcUrl: string; solBalance: string; tokenBalance: string; status: string; walletName: string } }) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const disabled = !evm.snapshot.connected || !evm.isEkaNetwork;

  const rows = useMemo(
    () => [
      { label: "EVM wallet", value: evm.snapshot.address || "Not connected" },
      { label: "EKA network", value: evm.snapshot.network },
      { label: "EKA balance", value: evm.snapshot.ekaBalance },
      { label: "Solana wallet", value: solana.address || "Not connected" },
      { label: "Solana network", value: solana.network },
      { label: "TinanAI token balance", value: solana.tokenBalance },
    ],
    [evm.snapshot.address, evm.snapshot.ekaBalance, evm.snapshot.network, solana.address, solana.network, solana.tokenBalance]
  );

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    evm.sendEka(recipient.trim(), amount.trim()).catch(() => undefined);
  }

  return (
    <div className="grid gap-4">
      <PageIntro
        eyebrow="Wallets"
        title="EVM and Solana wallet flows with explicit approval only."
        description="MetaMask and WalletConnect handle EKA. Phantom via Solana Wallet Adapter handles TinanAI connectivity. No transaction is initiated without the connected wallet prompting the user."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="EKA wallet controls" subtitle={evm.status}>
          <div className="flex flex-wrap gap-3">
            <button className="rounded-xl bg-tinan-cyan px-4 py-2 text-sm font-semibold text-black" onClick={() => evm.connectMetaMask().catch(() => undefined)} type="button">MetaMask</button>
            <button className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm" onClick={() => evm.connectWalletConnect().catch(() => undefined)} type="button">WalletConnect</button>
            <button className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm" onClick={() => evm.disconnect().catch(() => undefined)} type="button">Disconnect</button>
            <button className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm" onClick={() => evm.addEkaToken().catch(() => undefined)} type="button">Watch EKA</button>
          </div>
          <form className="mt-5 grid gap-3" onSubmit={onSubmit}>
            <input className="rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-white" onChange={(event) => setRecipient(event.target.value)} placeholder="Recipient EVM address" value={recipient} />
            <input className="rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-white" onChange={(event) => setAmount(event.target.value)} placeholder="Amount in EKA" value={amount} />
            <button className="rounded-xl bg-tinan-cyan px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50" disabled={disabled} type="submit">Send EKA</button>
          </form>
          <p className="mt-3 text-xs text-white/52">EKA transfers require Ethereum Mainnet and explicit wallet confirmation.</p>
        </Panel>

        <Panel title="TinanAI Solana wallet" subtitle={solana.status}>
          <div className="flex flex-wrap items-center gap-3">
            <WalletMultiButton className="!rounded-xl !bg-[#AB9FF2] !text-black hover:!opacity-90" />
            <button className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm" onClick={solana.disconnect} type="button">Disconnect Solana</button>
          </div>
          <p className="mt-3 text-xs text-white/52">Phantom approval is always requested by the wallet adapter before any signing action.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <LinkButton href={solana.explorerAddressUrl} label="Open wallet on Solscan" />
            <LinkButton href={solana.explorerMintUrl} label="Open TinanAI mint" />
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Connected state" subtitle="Validated wallet and balance overview.">
          <KeyValueList rows={rows} />
        </Panel>

        <Panel title="Trusted wallet downloads" subtitle="Only official wallet URLs are surfaced.">
          <div className="flex flex-wrap gap-3">
            <LinkButton href={TRUSTED_WALLET_LINKS.metamask} label="MetaMask" />
            <LinkButton href={TRUSTED_WALLET_LINKS.walletConnect} label="WalletConnect" />
            <LinkButton href={TRUSTED_WALLET_LINKS.phantom} label="Phantom" />
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/72">
            <p>RPC endpoint: <span className="break-all text-white">{solana.rpcUrl}</span></p>
            <p className="mt-2">Official mint configured: <span className="text-white">{TINANAI_SOLANA_CONFIG.isMintConfigured ? "Yes" : "No"}</span></p>
            <p className="mt-2">TinanAI token and EKA stay isolated in separate wallet and network flows.</p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
