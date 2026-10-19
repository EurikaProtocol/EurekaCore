import { fail, isIsoTimestamp, ok, type Result } from './errors';

/** Versioned contract between EurekaCore (control) and an AI agent such as TinanAi (execution). */
export const AGENT_CONTRACT_VERSION = '1.0' as const;

export const AGENT_TASK_KINDS = ['analyze', 'plan', 'generate'] as const;
export type AgentTaskKind = (typeof AGENT_TASK_KINDS)[number];

export const MAX_TASK_INPUT_LENGTH = 8000;
export const MAX_RESULT_TEXT_LENGTH = 20000;
export const MAX_PROPOSED_ACTIONS = 20;

export type AgentTaskRequest = {
  contractVersion: typeof AGENT_CONTRACT_VERSION;
  id: string;
  kind: AgentTaskKind;
  input: string;
  createdAt: string;
  /** Tools the agent may use for this task. Anything else in the result is rejected. */
  allowedTools: string[];
};

export const PROPOSED_ACTION_TYPES = ['note', 'blockchain-transaction', 'contract-deploy', 'fund-transfer', 'permission-change'] as const;
export type ProposedActionType = (typeof PROPOSED_ACTION_TYPES)[number];

/** An action the AI *suggests*. It carries no authority. */
export type ActionParameters = Record<string, string | number | boolean | null>;
export type ProposedAction = { id: string; type: ProposedActionType; description: string; parameters: ActionParameters };

const MAX_PARAMETERS = 20;
const MAX_PARAMETER_STRING = 500;

function validateParameters(value: unknown): ActionParameters | null {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > MAX_PARAMETERS) return null;
  const out: ActionParameters = {};
  for (const [k, v] of entries) {
    if (!/^[A-Za-z0-9_.-]{1,64}$/.test(k)) return null;
    if (typeof v === 'string' ? v.length > MAX_PARAMETER_STRING : !(v === null || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v)))) return null;
    out[k] = v as string | number | boolean | null;
  }
  return out;
}

export type AgentResult =
  | {
      contractVersion: typeof AGENT_CONTRACT_VERSION;
      taskId: string;
      status: 'completed';
      output: { text: string; proposedActions: ProposedAction[] };
      toolsUsed: string[];
    }
  | {
      contractVersion: typeof AGENT_CONTRACT_VERSION;
      taskId: string;
      status: 'failed';
      error: { code: string; message: string };
    };

export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

/** Provider boundary. Real implementations (e.g. a TinanAi HTTP client) live outside the core and browser bundle. */
export interface AgentProvider {
  readonly name: string;
  execute(request: AgentTaskRequest): Promise<unknown>;
}

const ID = /^[A-Za-z0-9._:-]{1,128}$/;

export function createAgentTask(input: {
  id: string;
  kind: AgentTaskKind;
  input: string;
  allowedTools?: string[];
  now?: string;
}): Result<AgentTaskRequest> {
  if (!ID.test(input.id)) return fail('INVALID_INPUT', 'Task id must be 1-128 characters of letters, digits and . _ : -.');
  if (!AGENT_TASK_KINDS.includes(input.kind)) return fail('UNSUPPORTED', `Unsupported task kind: ${String(input.kind)}`);
  const text = typeof input.input === 'string' ? input.input.trim() : '';
  if (!text || text.length > MAX_TASK_INPUT_LENGTH) {
    return fail('INVALID_INPUT', `Task input must be 1-${MAX_TASK_INPUT_LENGTH} characters.`);
  }
  const tools = input.allowedTools ?? [];
  if (!Array.isArray(tools) || tools.some((t) => typeof t !== 'string' || !ID.test(t))) {
    return fail('INVALID_INPUT', 'Allowed tools must be valid tool identifiers.');
  }
  if (input.now !== undefined && !isIsoTimestamp(input.now)) return fail('INVALID_INPUT', 'Timestamp must be ISO-8601.');
  return ok({
    contractVersion: AGENT_CONTRACT_VERSION,
    id: input.id,
    kind: input.kind,
    input: text,
    createdAt: input.now ?? new Date().toISOString(),
    allowedTools: [...new Set(tools)],
  });
}

/** Strictly validates untrusted agent output against the task. Unknown fields (e.g. forged approvals) are dropped. */
export function validateAgentResult(request: AgentTaskRequest, raw: unknown): Result<AgentResult> {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r !== 'object') return fail('INVALID_INPUT', 'Agent result must be an object.');
  if (r.contractVersion !== AGENT_CONTRACT_VERSION) return fail('UNSUPPORTED', `Unsupported agent contract version: ${String(r.contractVersion)}`);
  if (r.taskId !== request.id) return fail('INVALID_INPUT', 'Agent result does not match the requested task.');

  if (r.status === 'failed') {
    const e = r.error as { code?: unknown; message?: unknown } | null;
    if (!e || typeof e.code !== 'string' || typeof e.message !== 'string' || !e.code || !e.message) {
      return fail('INVALID_INPUT', 'A failed result must include an error code and message.');
    }
    return ok({
      contractVersion: AGENT_CONTRACT_VERSION,
      taskId: request.id,
      status: 'failed',
      error: { code: e.code.slice(0, 64), message: e.message.slice(0, 1000) },
    });
  }
  if (r.status !== 'completed') return fail('INVALID_INPUT', 'Agent result status must be completed or failed.');

  const out = r.output as { text?: unknown; proposedActions?: unknown } | null;
  if (!out || typeof out.text !== 'string' || out.text.length > MAX_RESULT_TEXT_LENGTH) {
    return fail('INVALID_INPUT', 'Agent output text is missing or too long.');
  }
  const rawActions = out.proposedActions ?? [];
  if (!Array.isArray(rawActions) || rawActions.length > MAX_PROPOSED_ACTIONS) {
    return fail('INVALID_INPUT', 'Agent proposed actions are malformed or too many.');
  }
  const actions: ProposedAction[] = [];
  for (const a of rawActions as Array<Record<string, unknown>>) {
    if (!a || typeof a.id !== 'string' || !ID.test(a.id) || typeof a.description !== 'string' || !a.description.trim()
      || !PROPOSED_ACTION_TYPES.includes(a.type as ProposedActionType)) {
      return fail('INVALID_INPUT', 'Agent returned a malformed proposed action.');
    }
    const parameters = validateParameters(a.parameters);
    if (!parameters) return fail('INVALID_INPUT', 'Agent returned malformed action parameters.');
    actions.push({ id: a.id, type: a.type as ProposedActionType, description: a.description.slice(0, 1000), parameters });
  }
  const tools = r.toolsUsed ?? [];
  if (!Array.isArray(tools) || tools.some((t) => typeof t !== 'string')) {
    return fail('INVALID_INPUT', 'Agent toolsUsed must be a list of strings.');
  }
  const unauthorized = (tools as string[]).filter((t) => !request.allowedTools.includes(t));
  if (unauthorized.length) return fail('INVALID_INPUT', `Agent used unauthorized tools: ${unauthorized.join(', ')}`);
  return ok({
    contractVersion: AGENT_CONTRACT_VERSION,
    taskId: request.id,
    status: 'completed',
    output: { text: out.text, proposedActions: actions },
    toolsUsed: tools as string[],
  });
}

/** Runs a task through a provider. Without a provider this is UNAVAILABLE; it never fabricates a result. */
export const DEFAULT_AGENT_TIMEOUT_MS = 30_000;

export async function dispatchAgentTask(
  request: AgentTaskRequest,
  provider?: AgentProvider,
  options: { timeoutMs?: number } = {}
): Promise<Result<AgentResult>> {
  if (!provider) return fail('UNAVAILABLE', 'No AI agent is configured; the task was not executed.');
  const timeoutMs = options.timeoutMs ?? DEFAULT_AGENT_TIMEOUT_MS;
  let raw: unknown;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    raw = await Promise.race([
      provider.execute(request),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timed out after ${timeoutMs} ms`)), timeoutMs);
      }),
    ]);
  } catch (error) {
    return fail('UNAVAILABLE', `Agent "${provider.name}" failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  } finally {
    if (timer) clearTimeout(timer);
  }
  return validateAgentResult(request, raw);
}
