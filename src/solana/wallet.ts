import { safeUrl } from "../core/verify";

export const TRUSTED_WALLET_LINKS = {
  metamask: safeUrl("https://metamask.io/download/", ["metamask.io"]),
  walletConnect: safeUrl("https://walletconnect.com/", ["walletconnect.com"]),
  phantom: safeUrl("https://phantom.app/", ["phantom.app"]),
};

export function getWalletApprovalCopy(action: string) {
  return `${action} will only continue after the connected wallet asks for explicit approval.`;
}
