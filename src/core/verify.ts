import { isAddress } from "ethers";
import { PublicKey } from "@solana/web3.js";

const HTTPS_PROTOCOL = "https:";

export function validateEvmAddress(value: string | null | undefined): value is `0x${string}` {
  return typeof value === "string" && isAddress(value);
}

export function validateSolanaAddress(value: string | null | undefined): value is string {
  if (!value || typeof value !== "string") return false;
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

export function safeUrl(value: string | null | undefined, allowedHosts: readonly string[]): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const trusted = allowedHosts.some((allowedHost) => host === allowedHost || host.endsWith(`.${allowedHost}`));
    return url.protocol === HTTPS_PROTOCOL && trusted ? url.toString() : null;
  } catch {
    return null;
  }
}

export function truncateMiddle(value: string, start = 6, end = 4) {
  if (!value) return "—";
  if (value.length <= start + end) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

export function formatStatusLabel(valid: boolean, label: string, fallback = "Not configured") {
  return valid ? label : fallback;
}
