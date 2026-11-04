/**
 * Server-side human identity. Identity is only ever derived from a Cloudflare Access JWT whose RS256 signature,
 * issuer, audience and validity window are verified here against the team's JWKS. Nothing the client sends in a body,
 * query string or ordinary header is treated as identity. Roles come from server-side allowlists.
 */
export type Role = 'viewer' | 'operator' | 'approver';
export type Identity = { email: string; roles: Role[] };

export type AuthEnv = {
  ACCESS_TEAM_DOMAIN?: string; // e.g. "myteam.cloudflareaccess.com"
  ACCESS_AUD?: string;
  EUREKA_VIEWERS?: string;
  EUREKA_OPERATORS?: string;
  EUREKA_APPROVERS?: string;
};

export type AuthResult = { ok: true; identity: Identity } | { ok: false; status: 401 | 403 | 503; message: string };

type Jwk = JsonWebKey & { kid?: string };
type JwksCache = { keys: Jwk[]; fetchedAt: number };
const JWKS_TTL_MS = 10 * 60_000;
const jwksCaches = new Map<string, JwksCache>();

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;
}

function parseJson(bytes: Uint8Array): Record<string, unknown> | null {
  try {
    const v = JSON.parse(new TextDecoder().decode(bytes));
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

function list(value: string | undefined): string[] {
  return (value ?? '').split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);
}

async function loadJwks(team: string, fetchImpl: typeof fetch, now: number, force = false): Promise<Jwk[]> {
  const cached = jwksCaches.get(team);
  if (!force && cached && now - cached.fetchedAt < JWKS_TTL_MS) return cached.keys;
  const res = await fetchImpl(`https://${team}/cdn-cgi/access/certs`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`JWKS fetch failed with ${res.status}`);
  const body = (await res.json()) as { keys?: Jwk[] };
  if (!Array.isArray(body.keys)) throw new Error('JWKS malformed');
  jwksCaches.set(team, { keys: body.keys, fetchedAt: now });
  return body.keys;
}

export function resetAuthCaches() {
  jwksCaches.clear();
}

export async function authenticate(
  request: Request,
  env: AuthEnv,
  options: { fetch?: typeof fetch; now?: () => number } = {}
): Promise<AuthResult> {
  const team = env.ACCESS_TEAM_DOMAIN?.trim().toLowerCase();
  const aud = env.ACCESS_AUD?.trim();
  if (!team || !aud || !/^[a-z0-9.-]+\.cloudflareaccess\.com$/.test(team)) {
    return { ok: false, status: 503, message: 'Authentication is not configured; the API is closed.' };
  }
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  const parts = token?.split('.');
  if (!parts || parts.length !== 3) return { ok: false, status: 401, message: 'Authentication required.' };
  let header: Record<string, unknown> | null;
  let claims: Record<string, unknown> | null;
  try {
    header = parseJson(b64urlToBytes(parts[0]));
    claims = parseJson(b64urlToBytes(parts[1]));
  } catch {
    return { ok: false, status: 401, message: 'Malformed access token.' };
  }
  if (!header || !claims || header.alg !== 'RS256' || typeof header.kid !== 'string') return { ok: false, status: 401, message: 'Invalid token.' };

  const fetchImpl = options.fetch ?? fetch;
  const nowMs = (options.now ?? Date.now)();
  let keys: Jwk[];
  try {
    keys = await loadJwks(team, fetchImpl, nowMs);
    if (!keys.some((k) => k.kid === header.kid)) keys = await loadJwks(team, fetchImpl, nowMs, true); // key rotation
  } catch {
    return { ok: false, status: 503, message: 'Identity provider keys are unavailable.' };
  }
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk || jwk.kty !== 'RSA') return { ok: false, status: 401, message: 'Invalid token.' };
  try {
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    if (!valid) return { ok: false, status: 401, message: 'Invalid token.' };
  } catch {
    return { ok: false, status: 401, message: 'Invalid token.' };
  }

  const nowSec = Math.floor(nowMs / 1000);
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== `https://${team}` || !audiences.includes(aud)) return { ok: false, status: 401, message: 'Invalid token.' };
  if (typeof claims.exp !== 'number' || claims.exp <= nowSec || (typeof claims.nbf === 'number' && claims.nbf > nowSec + 30)) {
    return { ok: false, status: 401, message: 'Token expired.' };
  }
  const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : '';
  if (!email) return { ok: false, status: 403, message: 'Token carries no human identity.' };

  const roles: Role[] = [];
  if (list(env.EUREKA_APPROVERS).includes(email)) roles.push('approver', 'viewer');
  if (list(env.EUREKA_OPERATORS).includes(email)) roles.push('operator', 'viewer');
  if (list(env.EUREKA_VIEWERS).includes(email)) roles.push('viewer');
  if (!roles.length) return { ok: false, status: 403, message: 'This identity is not authorized for EurekaCore.' };
  return { ok: true, identity: { email, roles: [...new Set(roles)] } };
}
