import { EKA_TOKEN } from "../config/token";
import { TRUSTED_EVM_EXPLORER_HOSTS } from "../config/networks";
import { safeUrl } from "../core/verify";

export function getEkaContractExplorerUrl() {
  return safeUrl(`${EKA_TOKEN.explorerBaseUrl}/token/${EKA_TOKEN.contractAddress}`, [...TRUSTED_EVM_EXPLORER_HOSTS]);
}

export function getEkaAddressExplorerUrl(address: string) {
  return safeUrl(`${EKA_TOKEN.explorerBaseUrl}/address/${address}`, [...TRUSTED_EVM_EXPLORER_HOSTS]);
}

export function getEkaTransactionExplorerUrl(hash: string) {
  return safeUrl(`${EKA_TOKEN.explorerBaseUrl}/tx/${hash}`, [...TRUSTED_EVM_EXPLORER_HOSTS]);
}
