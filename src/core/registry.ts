import { fail, isIsoTimestamp, ok, type Result } from './errors';
import { isPermissionLevel, type PermissionLevel } from './permissions';

export const INTEGRATION_STATUSES = ['not-integrated', 'documented', 'contract-tested', 'verified-live'] as const;
export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];
export const ENVIRONMENTS = ['development', 'staging', 'production', 'unknown'] as const;
export type Environment = (typeof ENVIRONMENTS)[number];
export const AUTH_METHODS = ['none', 'basic', 'bearer', 'wallet-signature', 'unknown'] as const;
export type AuthMethod = (typeof AUTH_METHODS)[number];

export type ProductHealth = { status: 'unverified' | 'healthy' | 'unhealthy'; checkedAt: string | null };

/** A registered independent product. Registration does not imply the URL is an authenticated or working API. */
export type Product = {
  id: string;
  name: string;
  description: string;
  repositoryUrl: string | null;
  deploymentProvider: string | null;
  apiBaseUrl: string | null;
  environment: Environment;
  integrationStatus: IntegrationStatus;
  authMethod: AuthMethod;
  /** Highest permission level EurekaCore may exercise against this product. Never above 6; 5-6 still need human approval. */
  maxPermissionLevel: PermissionLevel;
  version: string | null;
  health: ProductHealth;
  docs: string[];
};

const ID = /^[a-z0-9][a-z0-9-]{1,62}$/;

function httpsUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 500) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password;
  } catch {
    return false;
  }
}

export function validateProduct(raw: unknown): Result<Product> {
  const p = raw as Partial<Product> | null;
  if (!p || typeof p !== 'object') return fail('INVALID_INPUT', 'Product must be an object.');
  if (typeof p.id !== 'string' || !ID.test(p.id)) return fail('INVALID_INPUT', 'Product id must be lowercase letters, digits and hyphens (2-63 chars).');
  if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 100) return fail('INVALID_INPUT', 'Product name must be 1-100 characters.');
  if (typeof p.description !== 'string' || p.description.length > 1000) return fail('INVALID_INPUT', 'Product description must be at most 1000 characters.');
  for (const key of ['repositoryUrl', 'apiBaseUrl'] as const) {
    if (p[key] !== null && !httpsUrl(p[key])) return fail('INVALID_INPUT', `${key} must be an https URL without credentials, or null.`);
  }
  if (p.deploymentProvider !== null && (typeof p.deploymentProvider !== 'string' || p.deploymentProvider.length > 100)) {
    return fail('INVALID_INPUT', 'deploymentProvider must be a string or null.');
  }
  if (!ENVIRONMENTS.includes(p.environment as Environment)) return fail('INVALID_INPUT', 'Unknown environment.');
  if (!INTEGRATION_STATUSES.includes(p.integrationStatus as IntegrationStatus)) return fail('INVALID_INPUT', 'Unknown integration status.');
  if (!AUTH_METHODS.includes(p.authMethod as AuthMethod)) return fail('INVALID_INPUT', 'Unknown authentication method.');
  if (!isPermissionLevel(p.maxPermissionLevel)) return fail('INVALID_INPUT', 'maxPermissionLevel must be an integer from 1 to 6.');
  if (p.version !== null && (typeof p.version !== 'string' || p.version.length > 50)) return fail('INVALID_INPUT', 'version must be a string or null.');
  if (!Array.isArray(p.docs) || p.docs.length > 50 || p.docs.some((d) => typeof d !== 'string' || !d || d.length > 300)) {
    return fail('INVALID_INPUT', 'docs must be a list of references.');
  }
  const h = p.health as ProductHealth | undefined;
  if (!h || !['unverified', 'healthy', 'unhealthy'].includes(h.status)) return fail('INVALID_INPUT', 'Invalid health status.');
  if (h.status === 'unverified' ? h.checkedAt !== null : !isIsoTimestamp(h.checkedAt)) {
    return fail('INVALID_INPUT', 'Health must carry a check timestamp unless it is unverified.');
  }
  // Health and live status are claims about the real world; refuse them where the API was never reached.
  if (p.apiBaseUrl === null && (h.status !== 'unverified' || p.integrationStatus === 'verified-live')) {
    return fail('INVALID_INPUT', 'A product without an API base URL cannot be healthy or verified-live.');
  }
  if (p.integrationStatus !== 'verified-live' && h.status === 'healthy') {
    return fail('INVALID_INPUT', 'Only a verified-live integration may report healthy.');
  }
  return ok({
    id: p.id, name: p.name.trim(), description: p.description, repositoryUrl: p.repositoryUrl ?? null, deploymentProvider: p.deploymentProvider ?? null,
    apiBaseUrl: p.apiBaseUrl ?? null, environment: p.environment as Environment, integrationStatus: p.integrationStatus as IntegrationStatus,
    authMethod: p.authMethod as AuthMethod, maxPermissionLevel: p.maxPermissionLevel, version: p.version ?? null,
    health: { status: h.status, checkedAt: h.checkedAt }, docs: [...p.docs],
  });
}

export class ProductRegistry {
  private readonly products = new Map<string, Product>();

  register(raw: unknown): Result<Product> {
    const v = validateProduct(raw);
    if (!v.ok) return v;
    if (this.products.has(v.value.id)) return fail('INVALID_INPUT', `Product "${v.value.id}" is already registered.`);
    this.products.set(v.value.id, v.value);
    return v;
  }

  get(id: string): Product | null {
    const p = this.products.get(id);
    return p ? structuredClone(p) : null;
  }

  list(): Product[] {
    return [...this.products.values()].map((p) => structuredClone(p));
  }

  /** Records the outcome of a real health probe. Rejected unless the integration is verified-live. */
  recordHealth(id: string, status: 'healthy' | 'unhealthy', checkedAt: string): Result<Product> {
    const p = this.products.get(id);
    if (!p) return fail('INVALID_INPUT', `Unknown product "${id}".`);
    const next = validateProduct({ ...p, health: { status, checkedAt } });
    if (!next.ok) return next;
    this.products.set(id, next.value);
    return ok(structuredClone(next.value));
  }
}

/**
 * Initial ecosystem entries. Only facts present in this repository are recorded; everything else is null/unverified.
 * TinanAi's repository and contract are documented here (docs/TINANAI_INTEGRATION_CONTRACT.md); no live API was verified.
 */
export const DEFAULT_PRODUCTS: Product[] = [
  {
    id: 'tinan-ai', name: 'TINAN AI', description: 'Independent AI builder platform: project planning, code generation and editing, preview and export. Level 3 covers GitHub dev branches and draft PRs on its repository; the TinanAi API itself is used for proposals only.',
    repositoryUrl: 'https://github.com/EurikaProtocol/TinanAi', deploymentProvider: null, apiBaseUrl: null, environment: 'unknown',
    integrationStatus: 'contract-tested', authMethod: 'basic', maxPermissionLevel: 3, version: null,
    health: { status: 'unverified', checkedAt: null }, docs: ['docs/TINANAI_INTEGRATION_CONTRACT.md'],
  },
  {
    id: 'token-launchpad', name: 'Eureka Data Token Launchpad', description: 'Independent token creation and launch platform. Not yet integrated; contract and wallet actions require per-action human confirmation.',
    repositoryUrl: null, deploymentProvider: null, apiBaseUrl: null, environment: 'unknown', integrationStatus: 'not-integrated', authMethod: 'unknown',
    maxPermissionLevel: 2, version: null, health: { status: 'unverified', checkedAt: null }, docs: ['docs/ECOSYSTEM_INTEGRATIONS.md'],
  },
  {
    id: 'data-layer', name: 'Eureka Data Layer', description: 'Data source registration, provenance, integrity verification and licensing records. Local domain logic exists in src/core/data-assets.ts; no remote service is registered.',
    repositoryUrl: null, deploymentProvider: null, apiBaseUrl: null, environment: 'unknown', integrationStatus: 'not-integrated', authMethod: 'unknown',
    maxPermissionLevel: 2, version: null, health: { status: 'unverified', checkedAt: null }, docs: ['docs/CORE_ARCHITECTURE.md'],
  },
  {
    id: 'marketplace', name: 'Eureka Marketplace', description: 'Digital asset and data services marketplace. Not yet integrated.',
    repositoryUrl: null, deploymentProvider: null, apiBaseUrl: null, environment: 'unknown', integrationStatus: 'not-integrated', authMethod: 'unknown',
    maxPermissionLevel: 2, version: null, health: { status: 'unverified', checkedAt: null }, docs: ['docs/ECOSYSTEM_INTEGRATIONS.md'],
  },
];

export function createDefaultRegistry(): ProductRegistry {
  const registry = new ProductRegistry();
  for (const p of DEFAULT_PRODUCTS) {
    const r = registry.register(p);
    if (!r.ok) throw r.error;
  }
  return registry;
}
