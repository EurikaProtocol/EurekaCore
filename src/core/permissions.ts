export type PermissionCard = {
  title: string;
  description: string;
  requirement: string;
};

export const WALLET_PERMISSION_CARDS: PermissionCard[] = [
  {
    title: "Explicit wallet approval",
    description: "All token actions stay user-initiated and wait for the connected wallet to approve or reject the request.",
    requirement: "Never auto-sign or auto-submit transactions.",
  },
  {
    title: "Environment-scoped Solana settings",
    description: "TinanAI Solana values load from runtime environment variables so launch details can change without code edits.",
    requirement: "Use official deployment env vars only.",
  },
  {
    title: "Validated external links",
    description: "Explorer, wallet, and Pump.fun links are rendered only when they point to trusted HTTPS destinations.",
    requirement: "Block unknown or malformed URLs.",
  },
];
