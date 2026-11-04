import { spawn } from 'node:child_process';
import { chmod, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { MAX_SANDBOX_OUTPUT, SANDBOX_COMMANDS, validateSandboxRequest, type SandboxRequest, type SandboxResult, type SandboxRunner } from '../server/sandbox';

/** NODE ONLY (not the Worker). Runs untrusted files in a throwaway container: no network, read-only root and mount, no capabilities. */
export class DockerSandboxRunner implements SandboxRunner {
  readonly name = 'docker';
  constructor(private readonly image = 'node:22-alpine') {}

  async run(request: SandboxRequest, signal?: AbortSignal): Promise<SandboxResult> {
    validateSandboxRequest(request);
    const dir = await mkdtemp(join(tmpdir(), 'eureka-sbx-'));
    await chmod(dir, 0o755); // the container runs as an unprivileged uid that must be able to read the mount
    const name = `eureka-sbx-${crypto.randomUUID()}`;
    const started = Date.now();
    try {
      for (const f of request.files) {
        const target = join(dir, f.path);
        await mkdir(dirname(target), { recursive: true, mode: 0o755 });
        await writeFile(target, f.content, { mode: 0o444 });
      }
      const args = [
        'run', '--rm', '--name', name, '--network', 'none', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
        '--pids-limit', '128', '--memory', '256m', '--cpus', '1', '--user', '65534:65534', '--tmpfs', '/tmp:rw,size=16m',
        '-v', `${dir}:/work:ro`, '-w', '/work', this.image, ...SANDBOX_COMMANDS[request.command],
      ];
      return await new Promise<SandboxResult>((resolve, reject) => {
        const child = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        let timedOut = false;
        let killed: Promise<void> = Promise.resolve();
        const kill = () => {
          killed = new Promise<void>((done) => { spawn('docker', ['kill', name], { stdio: 'ignore' }).on('error', () => done()).on('close', () => done()); });
          child.kill('SIGKILL');
        };
        const timer = setTimeout(() => { timedOut = true; kill(); }, request.timeoutMs);
        signal?.addEventListener('abort', kill, { once: true });
        child.stdout.on('data', (d) => { if (stdout.length < MAX_SANDBOX_OUTPUT) stdout += d; });
        child.stderr.on('data', (d) => { if (stderr.length < MAX_SANDBOX_OUTPUT) stderr += d; });
        child.on('error', (e) => { clearTimeout(timer); reject(e); });
        child.on('close', async (code) => {
          clearTimeout(timer);
          await killed; // the container must be gone before we report the result
          resolve({
            exitCode: timedOut ? null : code, timedOut, stdout: stdout.slice(0, MAX_SANDBOX_OUTPUT), stderr: stderr.slice(0, MAX_SANDBOX_OUTPUT),
            durationMs: Date.now() - started, isolation: { runner: 'docker', network: 'none', readOnlyRoot: true },
          });
        });
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}
