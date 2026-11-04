import { sha256, toUtf8Bytes } from 'ethers';
import { fail, ok, type Result } from './errors';

/**
 * Versioned contract between EurekaCore (control plane) and the TINAN AI Builder (project-generation service).
 *
 * This is deliberately NOT an `AgentProvider`. Agent tasks return a plan/summary and tool results; they never return
 * source files. Source generation is a separate capability with its own interface so that a plan summary can never be
 * mistaken for a file proposal.
 */
export const BUILDER_CONTRACT_VERSION = '1.0' as const;

export const MAX_BUILDER_REQUIREMENTS = 4000;
export const MAX_BUILDER_FILES = 24;
export const MAX_BUILDER_FILE_BYTES = 128 * 1024;
export const MAX_BUILDER_TOTAL_BYTES = 256 * 1024;

export type BuilderPlan = { summary: string; technology: string[]; features: string[]; steps: string[] };
export const BUILDER_TASK_STATUSES = ['planning', 'awaiting_approval', 'generating', 'committing', 'completed', 'failed', 'cancelled'] as const;
export type BuilderTaskStatus = (typeof BUILDER_TASK_STATUSES)[number];

/** Validated, ownership-checked view of a Builder task. Contains no file contents. */
export type BuilderTaskView = {
  taskId: string;
  status: BuilderTaskStatus;
  requirements: string;
  projectId: string | null;
  plan: BuilderPlan | null;
  errors: string[];
};

export class BuilderError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'BuilderError';
  }
}

/**
 * Project-generation boundary. Implementations live server-side only. Every method must authenticate to the Builder with
 * server-side credentials, verify that returned records belong to the EurekaCore service identity, and throw
 * `BuilderError` (never return fabricated data) on any problem.
 */
export interface ProjectBuilderProvider {
  readonly name: string;
  readonly contractVersion: typeof BUILDER_CONTRACT_VERSION;
  /** 1. Submit project requirements. Never overwrites an existing project. */
  submitRequirements(requirements: string, signal?: AbortSignal): Promise<BuilderTaskView>;
  /** 2. Retrieve the task, including the generated plan once `awaiting_approval`. */
  getTask(taskId: string, signal?: AbortSignal): Promise<BuilderTaskView>;
  /** 5-6. Forwards a decision EurekaCore already recorded from a verified human. The Builder starts generating only now. */
  forwardApproval(taskId: string, signal?: AbortSignal): Promise<BuilderTaskView>;
  /** 7. Bounded, authenticated listing of project file paths (no contents). */
  listFiles(projectId: string, signal?: AbortSignal): Promise<string[]>;
  /** 7. Bounded, authenticated read of one file. */
  readFile(projectId: string, path: string, signal?: AbortSignal): Promise<string>;
  cancel(taskId: string, signal?: AbortSignal): Promise<void>;
}

const strings = (v: unknown, max: number, maxLen: number): string[] | null =>
  Array.isArray(v) && v.length <= max && v.every((s) => typeof s === 'string' && s.length <= maxLen) ? (v as string[]) : null;

/** Strictly validates an untrusted plan. Unknown fields are dropped. */
export function parseBuilderPlan(raw: unknown): Result<BuilderPlan> {
  const p = raw as Record<string, unknown> | null;
  if (!p || typeof p !== 'object' || typeof p.summary !== 'string' || !p.summary.trim() || p.summary.length > 4000) return fail('INVALID_INPUT', 'Builder plan has no valid summary.');
  const technology = strings(p.technology, 30, 200);
  const features = strings(p.features, 50, 500);
  const steps = strings(p.steps, 50, 1000);
  if (!technology || !features || !steps) return fail('INVALID_INPUT', 'Builder plan lists are malformed.');
  return ok({ summary: p.summary, technology: [...technology], features: [...features], steps: [...steps] });
}

/** Exact digest of the plan a human reviews. Any change to any field changes the digest. */
export function planDigest(plan: BuilderPlan): string {
  return sha256(toUtf8Bytes(JSON.stringify(['eureka.builder-plan.v1', plan.summary, plan.technology, plan.features, plan.steps])));
}

export const contentDigest = (content: string): string => sha256(toUtf8Bytes(content));
export const byteLength = (content: string): number => new TextEncoder().encode(content).length;

export type ManifestEntry = { path: string; bytes: number; sha256: string };

/** Digest binding an approval to the exact set of files (paths, sizes and content hashes). */
export function manifestDigest(planDigestHex: string, files: readonly ManifestEntry[]): string {
  const sorted = [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return sha256(toUtf8Bytes(JSON.stringify(['eureka.builder-manifest.v1', planDigestHex, sorted.map((f) => [f.path, f.bytes, f.sha256])])));
}
