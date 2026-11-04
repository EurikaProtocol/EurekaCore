import { sha256, toUtf8Bytes } from 'ethers';
import type { AuditLog } from './audit';
import { fail, ok, type Result } from './errors';
import { isAutonomouslyPermitted, isPermissionLevel, requiresHumanApproval, type PermissionLevel } from './permissions';
import type { ProductRegistry } from './registry';

export const AGENT_ROLES = [
  'chief-architect', 'product-manager', 'research', 'ui-ux', 'full-stack-builder', 'smart-contract',
  'data-engineer', 'security', 'qa', 'deployment', 'monitoring',
] as const;
export type AgentRole = (typeof AGENT_ROLES)[number];

export type StageKind = 'work' | 'approval';
export type StageDefinition = {
  id: string;
  title: string;
  kind: StageKind;
  role: AgentRole | null;
  /** Permission tier the stage needs. Tiers above autonomous need an approved gate named in `needsApproval`. */
  level: PermissionLevel;
  needsApproval?: string;
  /** Every criterion must be individually verified, with evidence, before the stage can complete. */
  acceptance: string[];
};

/** The fixed project pipeline. Order is the execution order; each stage is inspectable from the stored record. */
export const PROJECT_PIPELINE: readonly StageDefinition[] = [
  { id: 'requirements', title: 'Requirements analysis', kind: 'work', role: 'product-manager', level: 2, acceptance: ['Output is non-empty', 'Result passed contract validation'] },
  { id: 'research', title: 'Research', kind: 'work', role: 'research', level: 1, acceptance: ['Output is non-empty', 'Result passed contract validation'] },
  { id: 'architecture', title: 'Architecture', kind: 'work', role: 'chief-architect', level: 2, acceptance: ['Output is non-empty', 'Result passed contract validation'] },
  { id: 'plan', title: 'Project plan', kind: 'work', role: 'product-manager', level: 2, acceptance: ['Output is non-empty', 'Result passed contract validation'] },
  { id: 'plan-approval', title: 'Plan approval (human)', kind: 'approval', role: null, level: 2, acceptance: ['A human approved the exact plan digest'] },
  { id: 'generation', title: 'File generation', kind: 'work', role: 'full-stack-builder', level: 3, needsApproval: 'plan-approval', acceptance: ['Files written to a development branch', 'Diff available for review'] },
  { id: 'testing', title: 'Automated testing', kind: 'work', role: 'qa', level: 3, acceptance: ['Tests executed in a sandbox', 'All executed tests passed'] },
  { id: 'security-review', title: 'Security review', kind: 'work', role: 'security', level: 1, acceptance: ['Review completed', 'No unresolved high-severity findings'] },
  { id: 'preview', title: 'Preview', kind: 'work', role: 'deployment', level: 4, acceptance: ['Preview environment reachable'] },
  { id: 'deployment-review', title: 'Deployment review', kind: 'work', role: 'deployment', level: 2, acceptance: ['Deployment checklist produced'] },
  { id: 'deployment-approval', title: 'Production deployment approval (human)', kind: 'approval', role: null, level: 5, acceptance: ['A human approved the exact review digest'] },
  { id: 'deployment', title: 'Approved deployment', kind: 'work', role: 'deployment', level: 5, needsApproval: 'deployment-approval', acceptance: ['Deployment completed', 'Post-deploy health check passed'] },
  { id: 'monitoring', title: 'Monitoring', kind: 'work', role: 'monitoring', level: 1, acceptance: ['Diagnostics inspected'] },
  { id: 'iteration', title: 'Iterative improvement', kind: 'work', role: 'chief-architect', level: 2, acceptance: ['Improvement proposals produced'] },
];

/** First real delivery workflow: ends in a draft pull request. It never merges and never deploys. */
export const PR_DELIVERY_PIPELINE: readonly StageDefinition[] = [
  { id: 'requirements', title: 'Requirements analysis', kind: 'work', role: 'product-manager', level: 2, acceptance: ['Output is non-empty', 'Result passed contract validation'] },
  { id: 'architecture', title: 'Architecture', kind: 'work', role: 'chief-architect', level: 2, acceptance: ['Output is non-empty', 'Result passed contract validation'] },
  { id: 'plan-approval', title: 'Plan approval (human)', kind: 'approval', role: null, level: 2, acceptance: ['A human approved the exact plan digest'] },
  { id: 'branch', title: 'Create development branch', kind: 'work', role: 'full-stack-builder', level: 3, needsApproval: 'plan-approval', acceptance: ['Branch exists on GitHub', 'Branch is not the default branch'] },
  { id: 'generation', title: 'Code generation proposal committed to branch', kind: 'work', role: 'full-stack-builder', level: 3, needsApproval: 'plan-approval', acceptance: ['Proposal passed path and size validation', 'Files committed to the development branch'] },
  { id: 'testing', title: 'Sandboxed tests', kind: 'work', role: 'qa', level: 3, acceptance: ['Tests ran in an isolated sandbox', 'Test command exited 0 with at least one passing test'] },
  { id: 'pull-request', title: 'Open draft pull request', kind: 'work', role: 'deployment', level: 3, acceptance: ['Draft pull request exists on GitHub', 'Pull request is not merged'] },
];

export const PIPELINES: Record<string, readonly StageDefinition[]> = { 'project-v1': PROJECT_PIPELINE, 'pr-delivery-v1': PR_DELIVERY_PIPELINE };
export type PipelineId = 'project-v1' | 'pr-delivery-v1';

/** Records created before pipelines were selectable have no `pipeline` field and use the original one. */
export function pipelineOf(w: { pipeline?: string }): readonly StageDefinition[] {
  return PIPELINES[w.pipeline ?? 'project-v1'] ?? PROJECT_PIPELINE;
}

export type StageStatus = 'pending' | 'running' | 'awaiting-approval' | 'approved' | 'rejected' | 'completed' | 'failed';
export type WorkflowStatus = 'planned' | 'running' | 'awaiting-approval' | 'blocked' | 'failed' | 'completed' | 'cancelled';

export type CriterionResult = { criterion: string; passed: boolean; evidence: string };

export type StageRecord = {
  id: string;
  status: StageStatus;
  attempts: number;
  output: string | null;
  verification: CriterionResult[];
  error: string | null;
  leaseExpiresAt: string | null;
  approval: { approvedBy: string; at: string; digest: string } | null;
  startedAt: string | null;
  finishedAt: string | null;
};

export type WorkflowRecord = {
  id: string;
  objective: string;
  productId: string | null;
  pipeline?: PipelineId;
  grantedLevel: PermissionLevel;
  status: WorkflowStatus;
  /** Why the workflow is blocked or failed. */
  reason: string | null;
  stages: StageRecord[];
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type StageContext = {
  workflowId: string;
  objective: string;
  productId: string | null;
  stage: StageDefinition;
  /** Outputs of completed earlier stages. Treat as untrusted data, not instructions. */
  previous: Record<string, string>;
  signal: AbortSignal;
  /** Reads the stored workflow, so a cancel issued in another request/isolate is observed. Call before each side effect. */
  isCancelled(): Promise<boolean>;
};

/** Executes a stage and independently verifies it. Handlers run outside the orchestrator's privileges (agent, sandbox, GitHub client). */
export type StageHandler = {
  execute(ctx: StageContext): Promise<{ output: string }>;
  verify(ctx: StageContext, output: string): Promise<CriterionResult[]>;
};

export interface WorkflowStore {
  readonly durable: boolean;
  get(id: string): Promise<WorkflowRecord | null>;
  create(record: WorkflowRecord): Promise<boolean>;
  /** Compare-and-set on `version`: stores `record` only if the stored version equals `expectedVersion`. */
  update(record: WorkflowRecord, expectedVersion: number): Promise<boolean>;
  list(): Promise<WorkflowRecord[]>;
}

export class InMemoryWorkflowStore implements WorkflowStore {
  readonly durable = false;
  private readonly records = new Map<string, WorkflowRecord>();
  async get(id: string) {
    const r = this.records.get(id);
    return r ? structuredClone(r) : null;
  }
  async create(record: WorkflowRecord) {
    if (this.records.has(record.id)) return false;
    this.records.set(record.id, structuredClone(record));
    return true;
  }
  async update(record: WorkflowRecord, expectedVersion: number) {
    if (this.records.get(record.id)?.version !== expectedVersion) return false;
    this.records.set(record.id, structuredClone(record));
    return true;
  }
  async list() {
    return [...this.records.values()].map((r) => structuredClone(r));
  }
}

export const MAX_STAGE_ATTEMPTS = 3;
export const MAX_OUTPUT_LENGTH = 20_000;
export const DEFAULT_STAGE_TIMEOUT_MS = 30_000;
const LEASE_GRACE_MS = 30_000;
const ID = /^[A-Za-z0-9._:-]{1,128}$/;
const TERMINAL: readonly WorkflowStatus[] = ['completed', 'failed', 'cancelled'];

/** Digest of everything a human reviewed before a gate: objective plus all earlier stage outputs. */
export function reviewDigest(record: WorkflowRecord, gateId: string): string {
  const upto = pipelineOf(record).findIndex((s) => s.id === gateId);
  const parts = record.stages.slice(0, Math.max(upto, 0)).map((s) => [s.id, s.output ?? null]);
  return sha256(toUtf8Bytes(JSON.stringify([record.id, record.objective, parts])));
}

export class WorkflowEngine {
  private readonly running = new Map<string, AbortController>();

  constructor(
    private readonly store: WorkflowStore,
    private readonly audit: AuditLog,
    private readonly registry?: ProductRegistry,
    private readonly clock: () => string = () => new Date().toISOString()
  ) {}

  async create(input: { id: string; objective: string; productId?: string; grantedLevel?: PermissionLevel; pipeline?: PipelineId }): Promise<Result<WorkflowRecord>> {
    if (!ID.test(input.id)) return fail('INVALID_INPUT', 'Workflow id must be 1-128 characters of letters, digits and . _ : -.');
    const objective = typeof input.objective === 'string' ? input.objective.trim() : '';
    if (!objective || objective.length > 4000) return fail('INVALID_INPUT', 'Objective must be 1-4000 characters.');
    const pipelineId = input.pipeline ?? 'project-v1';
    if (!PIPELINES[pipelineId]) return fail('INVALID_INPUT', `Unknown pipeline "${String(pipelineId)}".`);
    const granted = input.grantedLevel ?? 2;
    if (!isPermissionLevel(granted)) return fail('INVALID_INPUT', 'Invalid permission level.');
    let productId: string | null = null;
    if (input.productId !== undefined) {
      const product = this.registry?.get(input.productId);
      if (!product) return fail('INVALID_INPUT', `Product "${input.productId}" is not registered.`);
      if (granted > product.maxPermissionLevel) {
        return fail('UNAUTHORIZED', `Product "${product.id}" only permits level ${product.maxPermissionLevel}; ${granted} was requested.`);
      }
      productId = product.id;
    }
    const at = this.clock();
    const record: WorkflowRecord = {
      id: input.id, objective, productId, pipeline: pipelineId, grantedLevel: granted, status: 'planned', reason: null, version: 1, createdAt: at, updatedAt: at,
      stages: PIPELINES[pipelineId].map((s) => ({ id: s.id, status: 'pending', attempts: 0, output: null, verification: [], error: null, leaseExpiresAt: null, approval: null, startedAt: null, finishedAt: null })),
    };
    if (!(await this.store.create(record))) return fail('INVALID_INPUT', `Workflow "${input.id}" already exists.`);
    await this.log('workflow.created', record.id, 'user', { productId, grantedLevel: granted });
    return ok(record);
  }

  get(id: string) {
    return this.store.get(id);
  }

  list() {
    return this.store.list();
  }

  private log(action: string, subject: string, actor: string, detail: Record<string, string | number | boolean | null> = {}) {
    return this.audit.append({ at: this.clock(), actor, action, subject, detail });
  }

  /** Applies a mutation under compare-and-set. Returns the stored record or a conflict. */
  private async commit(record: WorkflowRecord, mutate: (r: WorkflowRecord) => void): Promise<Result<WorkflowRecord>> {
    const next = structuredClone(record);
    mutate(next);
    next.version = record.version + 1;
    next.updatedAt = this.clock();
    if (!(await this.store.update(next, record.version))) return fail('INVALID_TRANSITION', 'Workflow changed concurrently; reload and retry.');
    return ok(next);
  }

  /**
   * Advances the workflow until it completes, needs a human, is blocked, or a stage fails.
   * Stops with a reason instead of skipping stages: a stage without a handler blocks the workflow.
   */
  async advance(id: string, handlers: Record<string, StageHandler>, options: { timeoutMs?: number } = {}): Promise<Result<WorkflowRecord>> {
    for (;;) {
      const current = await this.store.get(id);
      if (!current) return fail('INVALID_INPUT', `Unknown workflow "${id}".`);
      if (TERMINAL.includes(current.status)) return ok(current);
      if (current.status === 'running' && current.stages.some((s) => s.status === 'running' && !this.leaseExpired(s))) {
        return fail('INVALID_TRANSITION', 'A stage is already running; wait for it or let its lease expire.');
      }
      const index = current.stages.findIndex((s) => s.status !== 'completed' && s.status !== 'approved');
      if (index === -1) {
        const done = await this.commit(current, (r) => { r.status = 'completed'; r.reason = null; });
        if (done.ok) await this.log('workflow.completed', id, 'orchestrator');
        return done;
      }
      const def = pipelineOf(current)[index];
      const rec = current.stages[index];

      if (rec.status === 'rejected') return ok(current);
      if (rec.status === 'failed') return this.block(current, 'failed', `Stage "${def.id}" failed: ${rec.error ?? 'unknown error'}. Call retry() to try again.`);

      if (def.kind === 'approval') {
        if (rec.status === 'awaiting-approval' && current.status === 'awaiting-approval') return ok(current);
        const waiting = await this.commit(current, (r) => { r.status = 'awaiting-approval'; r.reason = `Waiting for human approval: ${def.title}.`; r.stages[index].status = 'awaiting-approval'; });
        if (waiting.ok) await this.log('stage.awaiting-approval', id, 'orchestrator', { stage: def.id, digest: reviewDigest(waiting.value, def.id) });
        return waiting;
      }

      const denied = this.permissionDenial(current, def);
      if (denied) return this.block(current, 'blocked', denied);
      const handler = handlers[def.id];
      if (!handler) return this.block(current, 'blocked', `No executor is configured for stage "${def.id}"; nothing was run or simulated.`);
      if (rec.attempts >= MAX_STAGE_ATTEMPTS) return this.block(current, 'failed', `Stage "${def.id}" exhausted ${MAX_STAGE_ATTEMPTS} attempts.`);

      const timeoutMs = options.timeoutMs ?? DEFAULT_STAGE_TIMEOUT_MS;
      const started = await this.commit(current, (r) => {
        r.status = 'running'; r.reason = null;
        const s = r.stages[index];
        s.status = 'running'; s.attempts += 1; s.error = null; s.startedAt = this.clock();
        s.leaseExpiresAt = new Date(Date.parse(this.clock()) + timeoutMs + LEASE_GRACE_MS).toISOString();
      });
      if (!started.ok) return started;
      await this.log('stage.started', id, def.role ?? 'orchestrator', { stage: def.id, attempt: started.value.stages[index].attempts });

      const outcome = await this.runStage(started.value, def, handler, timeoutMs);
      const settled = await this.commit(started.value, (r) => {
        const s = r.stages[index];
        s.leaseExpiresAt = null; s.finishedAt = this.clock();
        s.verification = outcome.verification;
        if (outcome.ok) { s.status = 'completed'; s.output = outcome.output; s.error = null; }
        else { s.status = 'failed'; s.error = outcome.error; }
      });
      if (!settled.ok) {
        // Cancelled (or otherwise changed) while running: the late result is discarded.
        const latest = await this.store.get(id);
        if (latest && TERMINAL.includes(latest.status)) return ok(latest);
        return settled;
      }
      await this.log(outcome.ok ? 'stage.completed' : 'stage.failed', id, def.role ?? 'orchestrator', { stage: def.id, error: outcome.ok ? null : outcome.error.slice(0, 300) });
      if (!outcome.ok) return this.block(settled.value, 'failed', `Stage "${def.id}" failed: ${outcome.error}`);
    }
  }

  private leaseExpired(s: StageRecord): boolean {
    return !s.leaseExpiresAt || Date.parse(s.leaseExpiresAt) <= Date.parse(this.clock());
  }

  private permissionDenial(w: WorkflowRecord, def: StageDefinition): string | null {
    if (requiresHumanApproval(def.level)) {
      const gate = def.needsApproval ? w.stages.find((s) => s.id === def.needsApproval) : undefined;
      return gate?.status === 'approved' ? null : `Stage "${def.id}" is level ${def.level} and needs approval from "${def.needsApproval}".`;
    }
    return isAutonomouslyPermitted(w.grantedLevel, def.level) ? null : `Stage "${def.id}" needs level ${def.level}; this workflow holds level ${w.grantedLevel}.`;
  }

  private async block(w: WorkflowRecord, status: 'blocked' | 'failed', reason: string): Promise<Result<WorkflowRecord>> {
    if (w.status === status && w.reason === reason) return ok(w);
    const r = await this.commit(w, (x) => { x.status = status; x.reason = reason; });
    if (r.ok) await this.log(`workflow.${status}`, w.id, 'orchestrator', { reason: reason.slice(0, 300) });
    return r;
  }

  private async runStage(w: WorkflowRecord, def: StageDefinition, handler: StageHandler, timeoutMs: number):
    Promise<{ ok: true; output: string; verification: CriterionResult[] } | { ok: false; error: string; verification: CriterionResult[] }> {
    const controller = new AbortController();
    this.running.set(w.id, controller);
    const previous: Record<string, string> = {};
    for (const s of w.stages) if (s.status === 'completed' && s.output !== null) previous[s.id] = s.output;
    const ctx: StageContext = { workflowId: w.id, objective: w.objective, productId: w.productId, stage: def, previous, signal: controller.signal, isCancelled: async () => (await this.store.get(w.id))?.status === 'cancelled' };
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error(`timed out after ${timeoutMs} ms`)); }, timeoutMs);
      });
      const executed = await Promise.race([handler.execute(ctx), timeout]);
      if (!executed || typeof executed.output !== 'string' || executed.output.length > MAX_OUTPUT_LENGTH) {
        return { ok: false, error: 'Executor returned malformed or oversized output.', verification: [] };
      }
      const verification = await Promise.race([handler.verify(ctx, executed.output), timeout]);
      const problem = checkVerification(def, verification);
      return problem ? { ok: false, error: problem, verification: Array.isArray(verification) ? verification : [] } : { ok: true, output: executed.output, verification };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'unknown error', verification: [] };
    } finally {
      if (timer) clearTimeout(timer);
      this.running.delete(w.id);
    }
  }

  /** Human decision on a gate. `digest` must match what the approver reviewed; a stale digest is refused. */
  async approve(id: string, stageId: string, approver: string, digest: string): Promise<Result<WorkflowRecord>> {
    const w = await this.store.get(id);
    if (!w) return fail('INVALID_INPUT', `Unknown workflow "${id}".`);
    const index = w.stages.findIndex((s) => s.id === stageId);
    const def = pipelineOf(w)[index];
    if (index === -1 || def.kind !== 'approval') return fail('INVALID_INPUT', `"${stageId}" is not an approval gate.`);
    if (w.stages[index].status !== 'awaiting-approval' || w.status !== 'awaiting-approval') return fail('INVALID_TRANSITION', `Gate "${stageId}" is not awaiting approval.`);
    if (typeof approver !== 'string' || !approver.trim() || approver.length > 200 || approver === 'orchestrator') return fail('UNAUTHORIZED', 'A named human approver is required.');
    if (digest !== reviewDigest(w, stageId)) return fail('UNAUTHORIZED', 'Approval digest does not match the current content; review it again.');
    const at = this.clock();
    const r = await this.commit(w, (x) => {
      const s = x.stages[index];
      s.status = 'approved'; s.approval = { approvedBy: approver.trim(), at, digest }; s.finishedAt = at;
      x.status = 'planned'; x.reason = null;
    });
    if (r.ok) await this.log('stage.approved', id, approver.trim(), { stage: stageId, digest });
    return r;
  }

  async reject(id: string, stageId: string, approver: string, reason: string): Promise<Result<WorkflowRecord>> {
    const w = await this.store.get(id);
    if (!w) return fail('INVALID_INPUT', `Unknown workflow "${id}".`);
    const index = w.stages.findIndex((s) => s.id === stageId);
    if (index === -1 || pipelineOf(w)[index].kind !== 'approval' || w.stages[index].status !== 'awaiting-approval') return fail('INVALID_TRANSITION', `Gate "${stageId}" is not awaiting approval.`);
    if (typeof approver !== 'string' || !approver.trim() || approver === 'orchestrator') return fail('UNAUTHORIZED', 'A named human approver is required.');
    const r = await this.commit(w, (x) => { x.stages[index].status = 'rejected'; x.stages[index].error = String(reason).slice(0, 500); x.status = 'cancelled'; x.reason = `Rejected at "${stageId}".`; });
    if (r.ok) await this.log('stage.rejected', id, approver.trim(), { stage: stageId, reason: String(reason).slice(0, 300) });
    return r;
  }

  /** Re-queues the failed stage (within the attempt limit). */
  async retry(id: string): Promise<Result<WorkflowRecord>> {
    const w = await this.store.get(id);
    if (!w) return fail('INVALID_INPUT', `Unknown workflow "${id}".`);
    const index = w.stages.findIndex((s) => s.status === 'failed');
    if (index === -1) return fail('INVALID_TRANSITION', 'No failed stage to retry.');
    if (w.stages[index].attempts >= MAX_STAGE_ATTEMPTS) return fail('INVALID_TRANSITION', `Stage "${w.stages[index].id}" has no attempts left.`);
    const r = await this.commit(w, (x) => { x.stages[index].status = 'pending'; x.status = 'planned'; x.reason = null; });
    if (r.ok) await this.log('stage.retry', id, 'user', { stage: w.stages[index].id });
    return r;
  }

  /** Makes an interrupted run resumable: stages whose lease has expired go back to pending. Live runs are untouched. */
  async recover(id: string): Promise<Result<WorkflowRecord>> {
    const w = await this.store.get(id);
    if (!w) return fail('INVALID_INPUT', `Unknown workflow "${id}".`);
    const stale = w.stages.filter((s) => s.status === 'running' && this.leaseExpired(s));
    if (!stale.length) return ok(w);
    const r = await this.commit(w, (x) => {
      for (const s of x.stages) if (s.status === 'running' && this.leaseExpired(s)) { s.status = 'pending'; s.leaseExpiresAt = null; s.error = 'Interrupted; resumed.'; }
      x.status = 'planned'; x.reason = null;
    });
    if (r.ok) await this.log('workflow.recovered', id, 'orchestrator', { stages: stale.map((s) => s.id).join(',') });
    return r;
  }

  async cancel(id: string): Promise<Result<WorkflowRecord>> {
    const w = await this.store.get(id);
    if (!w) return fail('INVALID_INPUT', `Unknown workflow "${id}".`);
    if (TERMINAL.includes(w.status)) return fail('INVALID_TRANSITION', `Cannot cancel a ${w.status} workflow.`);
    const r = await this.commit(w, (x) => { x.status = 'cancelled'; x.reason = 'Cancelled by user.'; });
    if (r.ok) {
      this.running.get(id)?.abort();
      await this.log('workflow.cancelled', id, 'user');
    }
    return r;
  }
}

/** A stage passes only if every acceptance criterion has exactly one passing result with evidence. */
export function checkVerification(def: StageDefinition, results: unknown): string | null {
  if (!Array.isArray(results)) return 'Verifier returned no results.';
  for (const criterion of def.acceptance) {
    const matches = results.filter((r) => r && (r as CriterionResult).criterion === criterion);
    if (matches.length !== 1) return `Acceptance criterion not verified: "${criterion}".`;
    const m = matches[0] as CriterionResult;
    if (m.passed !== true) return `Acceptance criterion failed: "${criterion}" (${String(m.evidence).slice(0, 200)}).`;
    if (typeof m.evidence !== 'string' || !m.evidence.trim()) return `Acceptance criterion has no evidence: "${criterion}".`;
  }
  return null;
}

export function describeWorkflow(w: WorkflowRecord) {
  return w.stages.map((s, i) => ({ id: s.id, title: pipelineOf(w)[i].title, level: pipelineOf(w)[i].level, status: s.status }));
}
