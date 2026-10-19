import { fail, isIsoTimestamp, ok, type Result } from './errors';
import type { ProposedAction, ProposedActionType } from './agent';

/** Action types that change state, move value or alter authority. */
export const CONSEQUENTIAL_ACTIONS: readonly ProposedActionType[] = [
  'blockchain-transaction',
  'contract-deploy',
  'fund-transfer',
  'permission-change',
];

export function isConsequential(type: ProposedActionType): boolean {
  return CONSEQUENTIAL_ACTIONS.includes(type);
}

/**
 * Evidence that a human explicitly approved one specific action (e.g. after a wallet confirmation).
 * Only the application's own approval flow should construct this; agent output can never carry one.
 */
export type HumanApproval = {
  actionId: string;
  approvedBy: string;
  approvedAt: string;
  expiresAt: string;
  method: 'wallet-confirmation';
};

export function createHumanApproval(input: {
  actionId: string;
  approvedBy: string;
  now?: string;
  ttlMs?: number;
}): Result<HumanApproval> {
  if (!input.actionId?.trim()) return fail('INVALID_INPUT', 'An action id is required.');
  if (!input.approvedBy?.trim()) return fail('INVALID_INPUT', 'The approving user is required.');
  const nowIso = input.now ?? new Date().toISOString();
  if (!isIsoTimestamp(nowIso)) return fail('INVALID_INPUT', 'Timestamp must be ISO-8601.');
  const ttl = input.ttlMs ?? 5 * 60_000;
  if (!Number.isFinite(ttl) || ttl <= 0 || ttl > 60 * 60_000) return fail('INVALID_INPUT', 'Approval lifetime must be between 1 ms and 1 hour.');
  return ok({
    actionId: input.actionId,
    approvedBy: input.approvedBy.trim(),
    approvedAt: nowIso,
    expiresAt: new Date(Date.parse(nowIso) + ttl).toISOString(),
    method: 'wallet-confirmation',
  });
}

export type Authorization = { actionId: string; authorizedBy: 'none-required' | string };

/**
 * Decides whether a proposed action may proceed. AI output alone never authorizes a consequential action;
 * that requires a matching, unexpired human approval. Authorization permits the *attempt* only — wallet
 * signing and network confirmation remain separate steps.
 */
export function authorizeAction(action: ProposedAction, approval?: HumanApproval, now: string = new Date().toISOString()): Result<Authorization> {
  if (!isConsequential(action.type)) return ok({ actionId: action.id, authorizedBy: 'none-required' });
  if (!approval) return fail('UNAUTHORIZED', `"${action.type}" requires explicit human approval.`);
  if (approval.actionId !== action.id) return fail('UNAUTHORIZED', 'Approval was issued for a different action.');
  if (approval.method !== 'wallet-confirmation' || !approval.approvedBy?.trim()) return fail('UNAUTHORIZED', 'Approval is not a valid human approval.');
  if (!isIsoTimestamp(approval.expiresAt) || Date.parse(approval.expiresAt) <= Date.parse(now)) {
    return fail('UNAUTHORIZED', 'Approval has expired.');
  }
  return ok({ actionId: action.id, authorizedBy: approval.approvedBy });
}
