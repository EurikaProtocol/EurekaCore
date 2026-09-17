import { toTrustedMetadataUrl } from '../core/verify';

export function resolveMetadataUri(value: string | undefined) {
  const trimmed = value?.trim();
  return toTrustedMetadataUrl(trimmed);
}
