import {
  MAX_BUILDER_FILE_BYTES, MAX_BUILDER_FILES, MAX_BUILDER_TOTAL_BYTES, byteLength, contentDigest, manifestDigest, planDigest,
  type BuilderTaskView, type ManifestEntry, type ProjectBuilderProvider,
} from '../core/builder';
import type { ProductRegistry } from '../core/registry';
import type { StageContext, StageHandler } from '../core/workflow';
import { criterion, generatedPrefix, json, makeBranchHandler, makePullRequestHandler, makeTestingHandler, repoOf } from './executors';
import type { GitHubClient } from './github';
import { isSafeFilePath } from './github';
import type { SandboxRunner } from './sandbox';

export type BuilderExecutorDeps = {
  registry: ProductRegistry;
  /** Absent unless a verified generation provider is configured: then NO generation-related handler is registered. */
  builder?: ProjectBuilderProvider;
  github?: GitHubClient;
  sandbox?: SandboxRunner;
  pollIntervalMs?: number;
  /** Test hook. */
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
};

const defaultSleep = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal.addEventListener('abort', () => { clearTimeout(t); reject(new Error('Cancelled.')); }, { once: true });
});

/** Validates the path list the Builder reports BEFORE any content is requested. Throws on the first violation. */
export function validateBuilderPaths(paths: readonly string[]): string[] {
  if (!Array.isArray(paths) || !paths.length || paths.length > MAX_BUILDER_FILES) throw new Error(`Builder file set must contain 1-${MAX_BUILDER_FILES} files.`);
  const seen = new Set<string>();
  for (const p of paths) {
    if (typeof p !== 'string' || !isSafeFilePath(p)) throw new Error(`File path not allowed: ${String(p).slice(0, 100)}`);
    const key = p.toLowerCase();
    if (seen.has(key)) throw new Error(`Duplicate file path: ${p.slice(0, 100)}`);
    seen.add(key);
  }
  return [...paths];
}

/** Validates actual contents and returns the manifest entries (path, bytes, sha256). */
export function buildManifest(files: readonly { path: string; content: string }[]): ManifestEntry[] {
  validateBuilderPaths(files.map((f) => f?.path));
  let total = 0;
  return files.map((f) => {
    if (typeof f.content !== 'string' || f.content.includes('\0')) throw new Error(`Malformed content for ${f.path}.`);
    const bytes = byteLength(f.content);
    if (bytes > MAX_BUILDER_FILE_BYTES) throw new Error(`File too large: ${f.path} (${bytes} bytes; limit ${MAX_BUILDER_FILE_BYTES}).`);
    total += bytes;
    if (total > MAX_BUILDER_TOTAL_BYTES) throw new Error(`Generated files exceed ${MAX_BUILDER_TOTAL_BYTES} bytes in total.`);
    return { path: f.path, bytes, sha256: contentDigest(f.content) };
  });
}

/** Re-validates a stored manifest (never trusts stored JSON blindly). */
export function parseManifest(o: Record<string, unknown>): { files: ManifestEntry[]; planDigest: string; manifestDigest: string; taskId: string; projectId: string } {
  const files = o.files as ManifestEntry[] | undefined;
  if (!Array.isArray(files)) throw new Error('Stored manifest has no file list.');
  validateBuilderPaths(files.map((f) => f?.path));
  let total = 0;
  for (const f of files) {
    if (!Number.isInteger(f.bytes) || f.bytes < 0 || f.bytes > MAX_BUILDER_FILE_BYTES || typeof f.sha256 !== 'string' || !/^0x[0-9a-f]{64}$/.test(f.sha256)) throw new Error(`Malformed manifest entry: ${String(f.path).slice(0, 100)}`);
    total += f.bytes;
  }
  if (total > MAX_BUILDER_TOTAL_BYTES) throw new Error('Stored manifest exceeds the size limit.');
  const { planDigest: pd, manifestDigest: md, taskId, projectId } = o as Record<string, unknown>;
  if (typeof pd !== 'string' || typeof md !== 'string' || typeof taskId !== 'string' || typeof projectId !== 'string') throw new Error('Stored manifest is incomplete.');
  if (manifestDigest(pd, files) !== md) throw new Error('Stored manifest digest does not match its files.');
  return { files, planDigest: pd, manifestDigest: md, taskId, projectId };
}

/**
 * Executors for `builder-delivery-v1`. The Builder is the only source of files; GitHub is only written after the second
 * human gate; every write is read back and compared. Without a builder none of the generation-related handlers exist.
 */
export function createBuilderDeliveryHandlers(deps: BuilderExecutorDeps): Record<string, StageHandler> {
  const handlers: Record<string, StageHandler> = {};
  const { builder, github, sandbox, registry } = deps;
  const sleep = deps.sleep ?? defaultSleep;
  const interval = deps.pollIntervalMs ?? 1500;

  /** Polls until `done`, cancelling the Builder task (best effort) if the workflow is cancelled or times out. */
  async function waitFor(ctx: StageContext, b: ProjectBuilderProvider, taskId: string, done: (v: BuilderTaskView) => boolean): Promise<BuilderTaskView> {
    for (;;) {
      if (ctx.signal.aborted || (await ctx.isCancelled())) {
        await b.cancel(taskId).catch(() => undefined);
        throw new Error('Cancelled.');
      }
      const v = await b.getTask(taskId, ctx.signal);
      if (v.status === 'failed' || v.status === 'cancelled') throw new Error(`TINAN AI Builder task ${v.status}: ${v.errors.join('; ').slice(0, 300) || 'no reason given'}`);
      if (done(v)) return v;
      await sleep(interval, ctx.signal);
    }
  }

  if (builder) {
    handlers['builder-submit'] = {
      async execute(ctx) {
        if (await ctx.isCancelled()) throw new Error('Cancelled.');
        const v = await builder.submitRequirements(ctx.objective, ctx.signal);
        return { output: JSON.stringify({ taskId: v.taskId, status: v.status, contractVersion: builder.contractVersion }) };
      },
      async verify(ctx, output) {
        const o = json(output, 'builder-submit');
        const v = await builder.getTask(String(o.taskId), ctx.signal); // throws OWNERSHIP_MISMATCH for foreign tasks
        return [
          criterion('Builder task created for the submitted requirements', v.requirements === ctx.objective && v.projectId === null, `task ${v.taskId} status=${v.status} requirementsMatch=${v.requirements === ctx.objective}`),
          criterion('Builder task is owned by the EurekaCore service identity', true, `ownership verified by ${builder.name} for task ${v.taskId}`),
        ];
      },
    };

    handlers['builder-plan'] = {
      async execute(ctx) {
        const taskId = String(json(ctx.previous['builder-submit'], 'builder-submit').taskId);
        const v = await waitFor(ctx, builder, taskId, (t) => {
          // The Builder must still be waiting for us: a task that advanced on its own bypassed EurekaCore's approval.
          if (t.status !== 'planning' && t.status !== 'awaiting_approval') throw new Error(`Builder task is "${t.status}" before EurekaCore approval; refusing to use it.`);
          return t.status === 'awaiting_approval' && t.plan !== null;
        });
        return { output: JSON.stringify({ taskId, plan: v.plan, planDigest: planDigest(v.plan!) }) };
      },
      async verify(ctx, output) {
        const o = json(output, 'builder-plan');
        const v = await builder.getTask(String(o.taskId), ctx.signal);
        const live = v.plan ? planDigest(v.plan) : null;
        return [
          criterion('Builder returned a valid project plan', v.status === 'awaiting_approval' && v.plan !== null, `status=${v.status} plan=${v.plan ? 'present' : 'absent'}`),
          criterion('Plan digest recomputed from the retrieved plan', live !== null && live === o.planDigest, `stored=${String(o.planDigest)} recomputed=${String(live)}`),
        ];
      },
    };

    handlers['builder-generation'] = {
      async execute(ctx) {
        const approved = json(ctx.previous['builder-plan'], 'builder-plan');
        const taskId = String(approved.taskId);
        let v = await builder.getTask(taskId, ctx.signal);
        // Any change to the plan after the human approved it voids the approval.
        const assertPlan = (t: BuilderTaskView) => {
          if (!t.plan || planDigest(t.plan) !== approved.planDigest) throw new Error('The Builder plan no longer matches the plan a human approved; nothing was generated or committed.');
        };
        assertPlan(v);
        if (v.status === 'awaiting_approval') {
          // Forward EurekaCore's recorded approval. TINAN AI's own boolean is only a trigger, never the authority.
          if (await ctx.isCancelled()) throw new Error('Cancelled.');
          v = await builder.forwardApproval(taskId, ctx.signal);
          assertPlan(v);
        }
        v = await waitFor(ctx, builder, taskId, (t) => t.status === 'completed');
        assertPlan(v);
        if (!v.projectId) throw new Error('Builder completed without a project id.');
        const paths = validateBuilderPaths(await builder.listFiles(v.projectId, ctx.signal));
        const files: { path: string; content: string }[] = [];
        for (const path of paths) {
          if (ctx.signal.aborted || (await ctx.isCancelled())) throw new Error('Cancelled.');
          files.push({ path, content: await builder.readFile(v.projectId, path, ctx.signal) });
        }
        const entries = buildManifest(files);
        const pd = String(approved.planDigest);
        return { output: JSON.stringify({ taskId, projectId: v.projectId, planDigest: pd, files: entries, totalBytes: entries.reduce((n, f) => n + f.bytes, 0), manifestDigest: manifestDigest(pd, entries) }) };
      },
      async verify(ctx, output) {
        const m = parseManifest(json(output, 'builder-generation'));
        const approved = json(ctx.previous['builder-plan'], 'builder-plan');
        const v = await builder.getTask(m.taskId, ctx.signal);
        const live = await builder.listFiles(m.projectId, ctx.signal);
        const samePaths = live.length === m.files.length && live.every((p) => m.files.some((f) => f.path === p));
        const planOk = !!v.plan && planDigest(v.plan) === approved.planDigest && m.planDigest === approved.planDigest;
        return [
          criterion('Plan unchanged since approval', planOk && v.projectId === m.projectId, `approved=${String(approved.planDigest)} live=${v.plan ? planDigest(v.plan) : 'none'}`),
          criterion('Generated file set passed path, size, duplicate and ownership validation', samePaths && v.status === 'completed', `${m.files.length} files, ${m.files.reduce((n, f) => n + f.bytes, 0)} bytes, ownership verified, manifest ${m.manifestDigest}`),
        ];
      },
    };
  }

  if (github) {
    handlers.branch = makeBranchHandler(registry, github);
    handlers['pull-request'] = makePullRequestHandler(registry, github, 'commit');
  }

  if (builder && github) {
    handlers.commit = {
      async execute(ctx) {
        const m = parseManifest(json(ctx.previous['builder-generation'], 'builder-generation'));
        const repo = repoOf(registry, ctx);
        const branch = String(json(ctx.previous.branch, 'branch').branch);
        const prefix = generatedPrefix(ctx.workflowId);
        const v = await builder.getTask(m.taskId, ctx.signal);
        if (v.status !== 'completed' || v.projectId !== m.projectId) throw new Error('Builder project changed since the manifest was approved.');
        const commits = [];
        for (const f of m.files) {
          if (ctx.signal.aborted || (await ctx.isCancelled())) throw new Error('Cancelled.');
          const content = await builder.readFile(m.projectId, f.path, ctx.signal);
          if (byteLength(content) !== f.bytes || contentDigest(content) !== f.sha256) throw new Error(`Builder content for ${f.path} differs from the approved manifest; nothing further was committed.`);
          commits.push(await github.putFile(repo, branch, `${prefix}${f.path}`, content, `EurekaCore: add ${f.path} (workflow ${ctx.workflowId})`));
        }
        return { output: JSON.stringify({ repo: `${repo.owner}/${repo.name}`, branch, projectId: m.projectId, manifestDigest: m.manifestDigest, files: m.files.map((f) => ({ ...f, path: `${prefix}${f.path}` })), commits }) };
      },
      async verify(ctx, output) {
        const o = json(output, 'commit');
        const m = parseManifest(json(ctx.previous['builder-generation'], 'builder-generation'));
        const repo = repoOf(registry, ctx);
        const prefix = generatedPrefix(ctx.workflowId);
        const committed = (o.files as ManifestEntry[]) ?? [];
        const mismatched: string[] = [];
        for (const f of m.files) {
          const text = await github.getFileText(repo, String(o.branch), `${prefix}${f.path}`);
          if (text === null || contentDigest(text) !== f.sha256 || byteLength(text) !== f.bytes) mismatched.push(f.path);
        }
        const sameSet = committed.length === m.files.length && committed.every((c) => m.files.some((f) => `${prefix}${f.path}` === c.path && f.sha256 === c.sha256));
        return [
          criterion('Builder content matches the approved manifest', o.manifestDigest === m.manifestDigest && sameSet, `manifest ${String(o.manifestDigest)} vs approved ${m.manifestDigest}`),
          criterion('Files committed to the development branch and read back identical', mismatched.length === 0, mismatched.length ? `read-back mismatch: ${mismatched.join(', ')}` : `${m.files.length} files read back from GitHub and matched by SHA-256`),
        ];
      },
    };

    if (sandbox) {
      handlers.testing = makeTestingHandler(sandbox, async (ctx) => {
        const o = json(ctx.previous.commit, 'commit');
        const repo = repoOf(registry, ctx);
        const prefix = generatedPrefix(ctx.workflowId);
        const out: { path: string; content: string }[] = [];
        for (const f of o.files as ManifestEntry[]) {
          const text = await github.getFileText(repo, String(o.branch), f.path);
          if (text === null || contentDigest(text) !== f.sha256) throw new Error(`Committed file ${f.path} is missing or changed; refusing to run it.`);
          out.push({ path: f.path.slice(prefix.length), content: text });
        }
        return out;
      });
    }
  }
  return handlers;
}
