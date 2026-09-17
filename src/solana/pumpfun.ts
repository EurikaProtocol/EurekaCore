import { TINANAI_SOLANA_CONFIG } from "../config/tinanai-solana";
import { safeUrl } from "../core/verify";

export function getPumpfunUrl() {
  return safeUrl(TINANAI_SOLANA_CONFIG.pumpfunTokenUrl, ["pump.fun"]);
}
