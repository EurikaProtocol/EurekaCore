import { truncateMiddle, validateEvmAddress, validateSolanaAddress } from "./verify";

export type IdentityKind = "evm" | "solana" | "service";

export type IdentityRecord = {
  kind: IdentityKind;
  label: string;
  value: string;
  verified: boolean;
};

export function createIdentityRecord(kind: IdentityKind, label: string, value: string): IdentityRecord {
  const verified = kind === "evm" ? validateEvmAddress(value) : kind === "solana" ? validateSolanaAddress(value) : value.length > 0;
  return { kind, label, value, verified };
}

export function formatIdentityValue(record: IdentityRecord) {
  return record.kind === "service" ? record.value : truncateMiddle(record.value, 8, 6);
}
