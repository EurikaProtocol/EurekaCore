import { verifyMessage } from 'ethers';
import { fail, isIsoTimestamp, ok, type Result } from './errors';
import type { ProposedAction, ProposedActionType } from './agent';
import { isValidEvmAddress } from './verify';

/** Action types that change state, move value or alter authority. */
export const CONSEQUENTIAL_ACTIONS: readonly ProposedActionType[] = [
  'blockchain-transaction',
  'contract-deploy',
  'fund-transfer',
  'permission-change',
];

export const MAX_APPROVAL_TTL_MS = 60 * 60_000;
export const DEFAULT_APPROVAL_TTL_MS = 5 * 60_000;

export function isConsequential(type: ProposedActionType): boolean {
  return CONSEQUENTIAL_ACTIONS.includes(type);
}

/** Deterministic text of the exact action (id, type, description, sorted parameters). */
export function canonicalizeAction(action: ProposedAction): string {
  const params = Object.keys(action.parameters ?? {}).sort().map((k) => [k, action.parameters[k]]);
  return JSON.stringify([action.id, action.type, action.description, params]);
}

/** The statement a wallet signs. Binds approver, exact action + parameters, nonce and validity window. */
export function buildApprovalMessage(action: ProposedAction, p: { approvedBy: string; nonce: string; approvedAt: string; expiresAt: string }): string {
  return [
    'EUREKA ACTION APPROVAL',
    `Approver: ${p.approvedBy}`,
    `Nonce: ${p.nonce}`,
    `Approved at: ${p.approvedAt}`,
    `Expires at: ${p.expiresAt}`,
    `Action: ${canonicalizeAction(action)}`,
  ].join('\n');
}

/**
 * A human approval of one specific action, proven by an EVM wallet signature (EIP-191 personal_sign)
 * over `buildApprovalMessage`. It is created from a wallet signature only; agent output cannot carry one.
 * Only EVM wallets are supported; Solana approvals are not implemented.
 */
export type HumanApproval = {
  approvedBy: string;
  nonce: string;
  approvedAt: string;
  expiresAt: string;
  signature: string;
};

/** Prepares the unsigned approval statement for the wallet UI. Does not sign or submit anything. */
export function prepareApprovalRequest(input: {
  action: ProposedAction;
  approvedBy: string;
  nonce: string;
  now?: string;
  ttlMs?: number;
}): Result<{ message: string; nonce: string; approvedAt: string; expiresAt: string }> {
  if (!isValidEvmAddress(input.approvedBy)) return fail('INVALID_INPUT', 'The approving wallet must be a valid EVM address.');
  if (!/^[A-Za-z0-9-]{16,128}$/.test(input.nonce)) return fail('INVALID_INPUT', 'Nonce must be 16-128 random letters, digits or hyphens.');
  const approvedAt = input.now ?? new Date().toISOString();
  if (!isIsoTimestamp(approvedAt)) return fail('INVALID_INPUT', 'Timestamp must be ISO-8601.');
  const ttl = input.ttlMs ?? DEFAULT_APPROVAL_TTL_MS;
  if (!Number.isFinite(ttl) || ttl <= 0 || ttl > MAX_APPROVAL_TTL_MS) return fail('INVALID_INPUT', 'Approval lifetime must be between 1 ms and 1 hour.');
  const expiresAt = new Date(Date.parse(approvedAt) + ttl).toISOString();
  return ok({ message: buildApprovalMessage(input.action, { approvedBy: input.approvedBy, nonce: input.nonce, approvedAt, expiresAt }), nonce: input.nonce, approvedAt, expiresAt });
}

/** Single-use guard. `consume` returns false if the nonce was already used. */
export interface ReplayGuard {
  /** Whether replay protection survives a process restart. Never report `true` for in-memory guards. */
  readonly durable: boolean;
  /** Atomically records the nonce. Resolves false if it was already consumed. Must reject on storage failure. */
  consume(nonce: string, expiresAt: string): Promise<boolean>;
}

/** Deterministic guard for unit tests. NOT durable: usage is forgotten on restart, so it gives no production replay protection. */
export class InMemoryReplayGuard implements ReplayGuard {
  readonly durable = false;
  private readonly used = new Set<string>();
  async consume(nonce: string): Promise<boolean> {
    if (this.used.has(nonce)) return false;
    this.used.add(nonce);
    return true;
  }
}

export type Authorization = { actionId: string; authorizedBy: 'none-required' | string };

/**
 * Decides whether a proposed action may proceed. AI output alone never authorizes a consequential action:
 * it needs a wallet signature over this exact action and parameters, unexpired, and not previously used.
 * Authorization permits the *attempt* only; this function never signs, submits, deploys or transfers.
 * The nonce is consumed only after every other check passes.
 */
export async function authorizeAction(
  action: ProposedAction,
  approval: HumanApproval | undefined,
  options: { now?: string; replayGuard?: ReplayGuard } = {}
): Promise<Result<Authorization>> {
  if (!isConsequential(action.type)) return ok({ actionId: action.id, authorizedBy: 'none-required' });
  if (!approval) return fail('UNAUTHORIZED', `"${action.type}" requires explicit wallet approval.`);
  if (!options.replayGuard) return fail('UNAUTHORIZED', 'A replay guard is required to authorize a consequential action.');
  const now = options.now ?? new Date().toISOString();
  if (!isIsoTimestamp(approval.approvedAt) || !isIsoTimestamp(approval.expiresAt)) return fail('UNAUTHORIZED', 'Approval timestamps are invalid.');
  const nowMs = Date.parse(now);
  if (Date.parse(approval.expiresAt) <= nowMs) return fail('UNAUTHORIZED', 'Approval has expired.');
  if (Date.parse(approval.approvedAt) > nowMs) return fail('UNAUTHORIZED', 'Approval is dated in the future.');
  if (Date.parse(approval.expiresAt) - Date.parse(approval.approvedAt) > MAX_APPROVAL_TTL_MS) return fail('UNAUTHORIZED', 'Approval lifetime is too long.');
  if (!isValidEvmAddress(approval.approvedBy) || typeof approval.signature !== 'string') return fail('UNAUTHORIZED', 'Approval is not a valid wallet approval.');

  let recovered: string;
  try {
    recovered = verifyMessage(buildApprovalMessage(action, approval), approval.signature);
  } catch {
    return fail('UNAUTHORIZED', 'Approval signature is invalid.');
  }
  if (recovered.toLowerCase() !== approval.approvedBy.toLowerCase()) {
    return fail('UNAUTHORIZED', 'Approval was not signed for this exact action by the stated wallet.');
  }
  let first: boolean;
  try {
    first = await options.replayGuard.consume(approval.nonce, approval.expiresAt);
  } catch {
    return fail('UNAVAILABLE', 'Replay protection storage failed; the action was not authorized.');
  }
  if (!first) return fail('UNAUTHORIZED', 'Approval has already been used.');
  return ok({ actionId: action.id, authorizedBy: approval.approvedBy });
}

export type ActionReview = {
  type: ProposedAction['type'];
  consequential: boolean;
  description: string;
  chainId: string | null;
  target: string | null;
  parameters: Array<[string, string]>;
};

/** Plain-data summary of exactly what the approver is about to sign. Parameters are listed in the signed (sorted) order. */
export function describeActionForReview(action: ProposedAction): ActionReview {
  const get = (...keys: string[]) => {
    for (const k of keys) if (action.parameters[k] !== undefined && action.parameters[k] !== null) return String(action.parameters[k]);
    return null;
  };
  return {
    type: action.type,
    consequential: isConsequential(action.type),
    description: action.description,
    chainId: get('chainId', 'chain'),
    target: get('to', 'target', 'contract', 'address'),
    parameters: Object.keys(action.parameters).sort().map((k) => [k, String(action.parameters[k])]),
  };
}
