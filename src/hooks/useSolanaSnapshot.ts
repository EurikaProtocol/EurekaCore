import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useMemo, useState } from "react";
import { TINANAI_SOLANA_CONFIG } from "../config/tinanai-solana";
import { getWalletApprovalCopy } from "../solana/wallet";
import { getSolanaTokenBalance } from "../solana/token";
import { buildSolanaExplorerUrl } from "../solana/transactions";

export function useSolanaSnapshot() {
  const { connection } = useConnection();
  const { connected, publicKey, wallet, disconnect } = useWallet();
  const [solBalance, setSolBalance] = useState("0");
  const [tokenBalance, setTokenBalance] = useState<string>(TINANAI_SOLANA_CONFIG.isMintConfigured ? "0" : "Mint not configured");
  const [status, setStatus] = useState(getWalletApprovalCopy("Solana wallet connections"));

  useEffect(() => {
    if (!connected || !publicKey) {
      setSolBalance("0");
      setTokenBalance(TINANAI_SOLANA_CONFIG.isMintConfigured ? "0" : "Mint not configured");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const [balanceLamports, maybeTokenBalance] = await Promise.all([
          connection.getBalance(publicKey),
          getSolanaTokenBalance(connection, publicKey.toBase58(), TINANAI_SOLANA_CONFIG.mintAddress),
        ]);
        if (cancelled) return;
        setSolBalance((balanceLamports / LAMPORTS_PER_SOL).toLocaleString(undefined, { maximumFractionDigits: 4 }));
        setTokenBalance(
          maybeTokenBalance === null ? "Mint not configured" : maybeTokenBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })
        );
        setStatus("Solana wallet ready.");
      } catch (error) {
        if (cancelled) return;
        setStatus(`Solana refresh failed: ${(error as Error).message}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [connected, connection, publicKey]);

  const explorerAddressUrl = useMemo(() => (publicKey ? buildSolanaExplorerUrl("address", publicKey.toBase58()) : null), [publicKey]);
  const explorerMintUrl = useMemo(
    () => (TINANAI_SOLANA_CONFIG.mintAddress ? buildSolanaExplorerUrl("token", TINANAI_SOLANA_CONFIG.mintAddress) : null),
    []
  );

  return {
    address: publicKey?.toBase58() ?? "",
    walletName: wallet?.adapter.name ?? "Phantom",
    connected,
    solBalance,
    tokenBalance,
    status,
    disconnect: () => disconnect().catch(() => undefined),
    explorerAddressUrl,
    explorerMintUrl,
    network: TINANAI_SOLANA_CONFIG.network,
    rpcUrl: TINANAI_SOLANA_CONFIG.rpcUrl,
  };
}
