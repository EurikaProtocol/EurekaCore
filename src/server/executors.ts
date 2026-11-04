import type { AgentProvider } from '../core/agent';
import { createAgentStageHandler } from '../core/agent-stage';
import type { ProductRegistry } from '../core/registry';
import type { CriterionResult, StageContext, StageHandler } from '../core/workflow';
import { GitHubClient, isSafeBranchName, parseRepo, type RepoRef } from './github';
import type { SandboxRunner } from './sandbox';

export type ExecutorDeps = {
  registry: ProductRegistry;
  /** Absent in an unconfigured deployment: the stages that need it then block rather than being faked. */
  provider?: AgentProvider;
  /** Provider prompt budget (TinanAi accepts at most 2000 characters). */
  maxPromptChars?: number;
};

export const branchFor = (workflowId: string) => `eureka/${workflowId.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[.-]+/, '').slice(0, 60) || 'workflow'}`;
export const generatedPrefix = (workflowId: string) => `generated/${branchFor(workflowId).slice('eureka/'.length)}/`;

export function repoOf(registry: ProductRegistry, ctx: StageContext): RepoRef {
  const product = ctx.productId ? registry.get(ctx.productId) : null;
  if (!product?.repositoryUrl) throw new Error('The workflow must be linked to a registered product with a repository URL.');
  return parseRepo(product.repositoryUrl);
}

export function json(text: string | undefined, what: string): Record<string, unknown> {
  try {
    const v = JSON.parse(text ?? '');
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch { /* fall through */ }
  throw new Error(`Stored ${what} output is not valid JSON.`);
}

export const criterion = (c: string, passed: boolean, evidence: string): CriterionResult => ({ criterion: c, passed, evidence });

/**
 * Executors for the legacy `pr-delivery-v1` pipeline. It only ever had agent planning; TINAN AI agent tasks return a plan
 * and a summary, never source files, so this pipeline has NO generation executor. Stages after `plan-approval` block
 * (see `PR_DELIVERY_UNAVAILABLE`); use `builder-delivery-v1` for code generation.
 */
export function createPrDeliveryHandlers(deps: ExecutorDeps): Record<string, StageHandler> {
  const handlers: Record<string, StageHandler> = {};
  if (deps.provider) {
    handlers.requirements = createAgentStageHandler(deps.provider, 'analyze', deps.maxPromptChars);
    handlers.architecture = createAgentStageHandler(deps.provider, 'plan', deps.maxPromptChars);
  }
  return handlers;
}

const PR_DELIVERY_REASON = 'Pipeline "pr-delivery-v1" has no source-generation executor: TINAN AI agent tasks return a plan and summary, not files. Use pipeline "builder-delivery-v1" (TINAN AI Builder).';
export const PR_DELIVERY_UNAVAILABLE: Record<string, string> = Object.fromEntries(['branch', 'generation', 'testing', 'pull-request'].map((id) => [id, PR_DELIVERY_REASON]));

/** Creates the protected development branch (`eureka/*`, never the default branch). */
export function makeBranchHandler(registry: ProductRegistry, github: GitHubClient): StageHandler {
  return {
    async execute(ctx) {
      const repo = repoOf(registry, ctx);
      if (await ctx.isCancelled()) throw new Error('Cancelled.');
      const r = await github.createBranch(repo, branchFor(ctx.workflowId));
      return { output: JSON.stringify({ repo: `${repo.owner}/${repo.name}`, ...r }) };
    },
    async verify(ctx, output) {
      const o = json(output, 'branch');
      const repo = repoOf(registry, ctx);
      const sha = await github.getBranchSha(repo, String(o.branch));
      const info = await github.getRepo(repo);
      return [
        criterion('Branch exists on GitHub', !!sha, sha ? `ref ${o.branch} at ${sha}` : 'branch not found'),
        criterion('Branch is not the default branch', isSafeBranchName(String(o.branch)) && o.branch !== info.defaultBranch, `default is ${info.defaultBranch}`),
      ];
    },
  };
}

/** Opens a DRAFT pull request, and only after sandboxed tests passed. There is no merge path. */
export function makePullRequestHandler(registry: ProductRegistry, github: GitHubClient, filesStage: string): StageHandler {
  return {
    async execute(ctx) {
      const repo = repoOf(registry, ctx);
      const gen = json(ctx.previous[filesStage], filesStage);
      const test = json(ctx.previous.testing, 'testing');
      if (await ctx.isCancelled()) throw new Error('Cancelled.');
      if (test.exitCode !== 0) throw new Error('Refusing to open a pull request: tests did not pass.');
      const body = [
        `Opened by EurekaCore for workflow \`${ctx.workflowId}\`. **Draft - requires human review. Not merged, not deployed.**`,
        `\n**Objective:** ${ctx.objective}`,
        `\n**Files:** ${(gen.files as { path: string }[]).map((f) => `\`${f.path}\``).join(', ')}`,
        `\n**Sandbox:** exit ${String(test.exitCode)} via ${String((test.isolation as { runner?: string })?.runner)} (network disabled)`,
      ].join('\n');
      const pr = await github.createDraftPullRequest(repo, String(gen.branch), `EurekaCore: ${ctx.objective.slice(0, 80)}`, body);
      return { output: JSON.stringify({ repo: `${repo.owner}/${repo.name}`, head: gen.branch, ...pr }) };
    },
    async verify(ctx, output) {
      const o = json(output, 'pull-request');
      const pr = await github.getPullRequest(repoOf(registry, ctx), Number(o.number));
      return [
        criterion('Draft pull request exists on GitHub', pr.draft && pr.state === 'open' && pr.headRef === o.head, `#${pr.number} ${pr.state} draft=${pr.draft} ${pr.url}`),
        criterion('Pull request is not merged', !pr.merged, `merged=${pr.merged}`),
      ];
    },
  };
}

/** Runs tests ONLY through a separately verified isolated sandbox runner; the Worker never executes generated code. */
export function makeTestingHandler(sandbox: SandboxRunner, loadFiles: (ctx: StageContext) => Promise<{ path: string; content: string }[]>): StageHandler {
  return {
    async execute(ctx) {
      const files = await loadFiles(ctx);
      const r = await sandbox.run({ files, command: 'node-test', timeoutMs: 60_000 }, ctx.signal);
      return { output: JSON.stringify({ ...r, stdout: r.stdout.slice(0, 4000), stderr: r.stderr.slice(0, 4000), fileCount: files.length }) };
    },
    async verify(_ctx, output) {
      const o = json(output, 'testing');
      const stdout = String(o.stdout ?? '');
      const passing = /(?:^|\n)(?:ℹ |# )pass ([1-9]\d*)/.test(stdout);
      const iso = o.isolation as { runner?: string; network?: string } | undefined;
      return [
        criterion('Tests ran in an isolated sandbox', !!iso?.runner && iso.network === 'none' && o.timedOut === false, `runner=${iso?.runner} network=${iso?.network} timedOut=${String(o.timedOut)}`),
        criterion('Test command exited 0 with at least one passing test', o.exitCode === 0 && passing, `exitCode=${String(o.exitCode)} passingTestsReported=${passing}`),
      ];
    },
  };
}
