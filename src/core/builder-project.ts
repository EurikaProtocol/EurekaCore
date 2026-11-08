/**
 * EurekaCore-side view of a TINAN AI Builder project. Browser-safe: types and constants only (no secrets, no server imports).
 * EurekaCore owns identity, ownership, approval and audit; TINAN AI owns planning and generation (Builder Contract v1.1).
 */
export const BUILDER_UI_STATUSES = ['queued', 'planning', 'awaiting_approval', 'generating', 'validating', 'completed', 'failed', 'cancelled'] as const;
export type BuilderUiStatus = (typeof BUILDER_UI_STATUSES)[number];
export const BUILDER_TERMINAL: readonly BuilderUiStatus[] = ['completed', 'failed', 'cancelled'];
export const MAX_BUILDER_ATTEMPTS = 3;
export const MAX_PROJECT_NAME = 80;

export type BuilderPlanView = { summary: string; technology: string[]; features: string[]; steps: string[] };
export type ManifestFileView = { path: string; bytes: number; sha256: string };
export type FileCheckView = { path: string; ok: boolean; expectedSha256: string; actualSha256: string | null; reason: string | null };

export type ValidationReportView = {
  checkedAt: string;
  passed: boolean;
  planDigestMatchesApproval: boolean;
  manifestDigestMatches: boolean;
  fileSetMatches: boolean;
  files: FileCheckView[];
  problems: string[];
};

export type BuilderAttemptView = { n: number; tinanTaskId: string | null; startedAt: string; status: BuilderUiStatus; errors: string[] };

export type BuilderProjectView = {
  id: string;
  name: string;
  status: BuilderUiStatus;
  requirements: string;
  attempt: number;
  maxAttempts: number;
  plan: BuilderPlanView | null;
  planDigest: string | null;
  approval: { approvedBy: string; at: string; digest: string; forwarded: boolean } | null;
  manifest: { planDigest: string; manifestDigest: string; totalBytes: number; files: ManifestFileView[] } | null;
  validation: ValidationReportView | null;
  /** The Builder's own sandbox/test execution is not performed or reported by EurekaCore; this is never claimed as passed. */
  buildValidation: 'not-run';
  errors: string[];
  attempts: BuilderAttemptView[];
  createdAt: string;
  updatedAt: string;
};

export type IntegrationState = 'connected' | 'authentication_failed' | 'unavailable' | 'not_configured';
export type IntegrationStatusView = {
  state: IntegrationState;
  detail: string;
  contractVersion: '1.1';
  authMode: 'single-owner' | 'delegated';
  transport: 'service-binding' | 'https';
  checkedAt: string;
};

export type HistoryEntryView = { projectId: string; at: string; action: string; actor: string; detail: Record<string, string | number | boolean | null> };

export const STATUS_LABEL: Record<BuilderUiStatus, string> = {
  queued: 'Task queued', planning: 'Planning', awaiting_approval: 'Awaiting approval', generating: 'Generating',
  validating: 'Validating', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled',
};
