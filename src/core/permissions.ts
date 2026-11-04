export const PERMISSION_GUARDS = [
  'Never request private keys or seed phrases.',
  'Require explicit wallet confirmation before sending or switching networks.',
  'Disable Solana token actions until official mint and metadata values are configured.',
  'Render external links only after trusted-host validation.',
] as const;

/** Autonomy tiers. Levels 5 and 6 are never covered by a grant alone. */
export const PERMISSION_LEVELS = {
  1: { name: 'READ', summary: 'Inspect documentation, code, logs and project metadata.' },
  2: { name: 'PROPOSE', summary: 'Generate plans, specifications and code proposals.' },
  3: { name: 'DEVELOPMENT', summary: 'Create branches, modify authorized files, run safe sandboxed tests.' },
  4: { name: 'STAGING', summary: 'Prepare preview deployments and validate staging environments.' },
  5: { name: 'PRODUCTION', summary: 'Requires explicit human approval.' },
  6: { name: 'FINANCIAL_BLOCKCHAIN', summary: 'Requires explicit confirmation of each consequential transaction, deployment, payment or irreversible action.' },
} as const;

export type PermissionLevel = 1 | 2 | 3 | 4 | 5 | 6;

/** Highest level an automated run may exercise without a per-action human approval. */
export const MAX_AUTONOMOUS_LEVEL: PermissionLevel = 4;

export function isPermissionLevel(value: unknown): value is PermissionLevel {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 6;
}

export function requiresHumanApproval(level: PermissionLevel): boolean {
  return level > MAX_AUTONOMOUS_LEVEL;
}

/** Whether `granted` covers `required` without a human approval. Levels 5-6 are never covered by a grant. */
export function isAutonomouslyPermitted(granted: PermissionLevel, required: PermissionLevel): boolean {
  return !requiresHumanApproval(required) && granted >= required;
}
