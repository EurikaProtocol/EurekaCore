export const PERMISSION_GUARDS = [
  'Never request private keys or seed phrases.',
  'Require explicit wallet confirmation before sending or switching networks.',
  'Disable Solana token actions until official mint and metadata values are configured.',
  'Render external links only after trusted-host validation.',
] as const;
