import { safeUrl } from "../core/verify";

export function getMetadataUri(value: string | null) {
  return safeUrl(value, ["arweave.net", "ipfs.io", "gateway.pinata.cloud", "nftstorage.link"]);
}
