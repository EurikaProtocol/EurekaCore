import { isAddress } from 'ethers';
import { PublicKey } from '@solana/web3.js';

export const TRUSTED_EXTERNAL_HOSTS = [
  'tinaneureka.com',
  'www.tinaneureka.com',
  'github.com',
  'etherscan.io',
  'www.etherscan.io',
  'bscscan.com',
  'www.bscscan.com',
  'arbiscan.io',
  'www.arbiscan.io',
  'polygonscan.com',
  'www.polygonscan.com',
  'solscan.io',
  'www.solscan.io',
  'pump.fun',
  'www.pump.fun',
  'metamask.io',
  'www.metamask.io',
  'walletconnect.com',
  'www.walletconnect.com',
  'phantom.app',
  'www.phantom.app',
] as const;

const TRUSTED_METADATA_HOSTS = [
  'tinaneureka.com',
  'www.tinaneureka.com',
  'arweave.net',
  'www.arweave.net',
  'ipfs.io',
  'gateway.pinata.cloud',
  'cloudflare-ipfs.com',
] as const;

function isTrustedHost(hostname: string, trustedHosts: readonly string[]) {
  return trustedHosts.some((trustedHost) => hostname === trustedHost || hostname.endsWith(`.${trustedHost}`));
}

export function isValidEvmAddress(value: string | null | undefined): value is `0x${string}` {
  return Boolean(value && isAddress(value));
}

export function isValidSolanaAddress(value: string | null | undefined): boolean {
  if (!value) return false;

  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

export function toTrustedUrl(
  value: string | null | undefined,
  trustedHosts: readonly string[] = TRUSTED_EXTERNAL_HOSTS
): string | null {
  if (!value) return null;

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') return null;
    return isTrustedHost(parsed.hostname, trustedHosts) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function toTrustedMetadataUrl(value: string | null | undefined): string | null {
  return toTrustedUrl(value, TRUSTED_METADATA_HOSTS);
}

export function shortenAddress(value: string | null | undefined, fallback = 'Not configured') {
  if (!value) return fallback;
  return value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}

export function formatConnectionLabel(value: string | null | undefined, valid: boolean) {
  if (!value) return 'Not configured';
  return valid ? shortenAddress(value) : 'Invalid value';
}
