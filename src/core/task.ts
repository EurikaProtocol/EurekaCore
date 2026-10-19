import { dispatchAgentTask, type AgentProvider, type AgentResult, type AgentTaskRequest, type TaskStatus } from './agent';
import { fail, ok, type Result } from './errors';

export type TaskRecord = {
  request: AgentTaskRequest;
  status: TaskStatus;
  result: AgentResult | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  history: Array<{ status: TaskStatus; at: string }>;
};

export const TASK_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  queued: ['running', 'cancelled'],
  running: ['completed', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
};

export function isTerminal(status: TaskStatus): boolean {
  return TASK_TRANSITIONS[status].length === 0;
}

/** Persistence boundary. Implementations must be single-writer-safe or enforce `expected` atomically. */
export interface TaskStore {
  get(id: string): Promise<TaskRecord | null>;
  /** Inserts a new record. Returns false if the id exists. */
  create(record: TaskRecord): Promise<boolean>;
  /** Compare-and-set: replaces the record only if its current status equals `expected`. */
  update(record: TaskRecord, expected: TaskStatus): Promise<boolean>;
  list(): Promise<TaskRecord[]>;
}

/** Deterministic in-memory store for tests and local use. Not durable. */
export class InMemoryTaskStore implements TaskStore {
  private readonly records = new Map<string, TaskRecord>();
  async get(id: string) {
    const r = this.records.get(id);
    return r ? structuredClone(r) : null;
  }
  async create(record: TaskRecord) {
    if (this.records.has(record.request.id)) return false;
    this.records.set(record.request.id, structuredClone(record));
    return true;
  }
  async update(record: TaskRecord, expected: TaskStatus) {
    const current = this.records.get(record.request.id);
    if (!current || current.status !== expected) return false;
    this.records.set(record.request.id, structuredClone(record));
    return true;
  }
  async list() {
    return [...this.records.values()].map((r) => structuredClone(r));
  }
}

export class TaskManager {
  constructor(
    private readonly store: TaskStore,
    private readonly clock: () => string = () => new Date().toISOString()
  ) {}

  async submit(request: AgentTaskRequest): Promise<Result<TaskRecord>> {
    const at = this.clock();
    const record: TaskRecord = { request, status: 'queued', result: null, error: null, createdAt: at, updatedAt: at, history: [{ status: 'queued', at }] };
    return (await this.store.create(record)) ? ok(record) : fail('INVALID_INPUT', `Task "${request.id}" already exists.`);
  }

  get(id: string) {
    return this.store.get(id);
  }

  private async move(id: string, next: TaskStatus, patch: Partial<Pick<TaskRecord, 'result' | 'error'>> = {}): Promise<Result<TaskRecord>> {
    const current = await this.store.get(id);
    if (!current) return fail('INVALID_INPUT', `Unknown task "${id}".`);
    if (!TASK_TRANSITIONS[current.status].includes(next)) {
      return fail('INVALID_TRANSITION', `Cannot move a ${current.status} task to ${next}.`);
    }
    const at = this.clock();
    const updated: TaskRecord = { ...current, ...patch, status: next, updatedAt: at, history: [...current.history, { status: next, at }] };
    // Compare-and-set so a concurrent cancel/complete cannot be silently overwritten.
    if (!(await this.store.update(updated, current.status))) return fail('INVALID_TRANSITION', 'Task changed concurrently; retry.');
    return ok(updated);
  }

  cancel(id: string) {
    return this.move(id, 'cancelled');
  }

  /**
   * Runs a queued task. A result arriving after cancellation is discarded. Provider failure and invalid
   * output mark the task failed with the reason; nothing is substituted.
   */
  async run(id: string, provider: AgentProvider | undefined, options: { timeoutMs?: number } = {}): Promise<Result<TaskRecord>> {
    const started = await this.move(id, 'running');
    if (!started.ok) return started;
    const outcome = await dispatchAgentTask(started.value.request, provider, options);
    if (!outcome.ok) return this.finish(id, 'failed', { error: outcome.error.message });
    if (outcome.value.status === 'failed') {
      return this.finish(id, 'failed', { result: outcome.value, error: `${outcome.value.error.code}: ${outcome.value.error.message}` });
    }
    return this.finish(id, 'completed', { result: outcome.value });
  }

  private async finish(id: string, next: 'completed' | 'failed', patch: Partial<Pick<TaskRecord, 'result' | 'error'>>) {
    const moved = await this.move(id, next, patch);
    if (!moved.ok) {
      const latest = await this.store.get(id);
      if (latest?.status === 'cancelled') return ok(latest); // cancelled while running: result discarded
    }
    return moved;
  }
}
