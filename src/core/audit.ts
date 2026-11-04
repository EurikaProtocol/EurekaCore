import { sha256, toUtf8Bytes } from 'ethers';

export type AuditEntry = {
  seq: number;
  at: string;
  actor: string;
  action: string;
  subject: string;
  detail: Record<string, string | number | boolean | null>;
  prevHash: string;
  hash: string;
};

export type AuditInput = Omit<AuditEntry, 'seq' | 'prevHash' | 'hash'>;

export const GENESIS_HASH = '0x' + '0'.repeat(64);

export function hashAuditEntry(e: Omit<AuditEntry, 'hash'>): string {
  const detail = Object.keys(e.detail).sort().map((k) => [k, e.detail[k]]);
  return sha256(toUtf8Bytes(JSON.stringify([e.seq, e.at, e.actor, e.action, e.subject, detail, e.prevHash])));
}

/** Append-only log. Each entry commits to its predecessor, so edits or deletions are detectable by `verifyAuditChain`. */
export interface AuditLog {
  readonly durable: boolean;
  append(input: AuditInput): Promise<AuditEntry>;
  list(subject?: string): Promise<AuditEntry[]>;
}

export function buildAuditEntry(input: AuditInput, last: AuditEntry | null): AuditEntry {
  const partial = { ...input, detail: { ...input.detail }, seq: (last?.seq ?? 0) + 1, prevHash: last?.hash ?? GENESIS_HASH };
  return { ...partial, hash: hashAuditEntry(partial) };
}

export class InMemoryAuditLog implements AuditLog {
  readonly durable = false;
  private readonly entries: AuditEntry[] = [];
  async append(input: AuditInput) {
    const entry = buildAuditEntry(input, this.entries.at(-1) ?? null);
    this.entries.push(entry);
    return structuredClone(entry);
  }
  async list(subject?: string) {
    return this.entries.filter((e) => !subject || e.subject === subject).map((e) => structuredClone(e));
  }
}

/** Checks sequence continuity, hash links and recomputed hashes over a full (unfiltered) log. */
export function verifyAuditChain(entries: AuditEntry[]): { valid: boolean; brokenAt: number | null } {
  let prev = GENESIS_HASH;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.seq !== i + 1 || e.prevHash !== prev || e.hash !== hashAuditEntry({ ...e, hash: undefined } as Omit<AuditEntry, 'hash'>)) {
      return { valid: false, brokenAt: e.seq };
    }
    prev = e.hash;
  }
  return { valid: true, brokenAt: null };
}
