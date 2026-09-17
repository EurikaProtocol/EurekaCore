import { toTrustedUrl } from '../core/verify';

export function resolvePumpfunUrl(value: string | undefined) {
  return toTrustedUrl(value?.trim() || null, ['pump.fun', 'www.pump.fun']);
}
