import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { env } from '../config/env.js';
import { ApiError } from '../middleware/error.js';

interface Discovery {
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  issuer: string;
  userinfo_endpoint?: string;
}

let discoveryCache: Discovery | null = null;
let jwksCache: JWTVerifyGetKey | null = null;

async function discover(): Promise<Discovery> {
  if (discoveryCache) return discoveryCache;
  const res = await fetch(`${env().OIDC_ISSUER}/.well-known/openid-configuration`);
  if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`);
  discoveryCache = (await res.json()) as Discovery;
  return discoveryCache;
}

function jwks(uri: string): JWTVerifyGetKey {
  if (!jwksCache) jwksCache = createRemoteJWKSet(new URL(uri));
  return jwksCache;
}

/** Test-only: clear discovery/JWKS caches (issuer changes between test runs). */
export function resetOidcCache(): void {
  discoveryCache = null;
  jwksCache = null;
}

export interface LoginMaterial {
  url: string;
  state: string;
  verifier: string;
  nonce: string;
}

export async function buildLoginRedirect(): Promise<LoginMaterial> {
  const d = await discover();
  const state = randomBytes(16).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  const nonce = randomBytes(16).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const url = new URL(d.authorization_endpoint);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', env().OIDC_CLIENT_ID);
  url.searchParams.set('redirect_uri', env().OIDC_REDIRECT_URI);
  url.searchParams.set('scope', 'openid profile email');
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return { url: url.toString(), state, verifier, nonce };
}

export interface VerifiedIdentity {
  email: string;
  name: string;
}

/** Exchange the code, then verify id_token signature/issuer/audience/expiry/nonce via issuer JWKS. */
export async function exchangeAndVerify(code: string, verifier: string, expectedNonce: string): Promise<VerifiedIdentity> {
  const d = await discover();
  const res = await fetch(d.token_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: env().OIDC_REDIRECT_URI,
      client_id: env().OIDC_CLIENT_ID,
      client_secret: env().OIDC_CLIENT_SECRET,
      code_verifier: verifier,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`OIDC token exchange failed: HTTP ${res.status} ${body.slice(0, 500)}`);
    throw new ApiError('UNAUTHENTICATED', 'Token exchange failed');
  }
  const tokens = (await res.json()) as { id_token?: string; access_token?: string };
  if (!tokens.id_token) {
    throw new ApiError('UNAUTHENTICATED', 'Missing id_token');
  }
  const { payload } = await jwtVerify(tokens.id_token, jwks(d.jwks_uri), {
    issuer: env().OIDC_ISSUER,
    audience: env().OIDC_CLIENT_ID,
  });
  if (payload.nonce !== expectedNonce) {
    throw new ApiError('VALIDATION_ERROR', 'OIDC nonce mismatch');
  }
  if (env().SSO_DEBUG) {
    // Temporary diagnostics (enable with SSO_DEBUG=1): which claims the IdP
    // returns. Keys only — values are PII and must never reach logs.
    console.log('SAIG_SSO_DEBUG token_response_keys=' + JSON.stringify(Object.keys(tokens)));
    console.log('SAIG_SSO_DEBUG id_token_claim_keys=' + JSON.stringify(Object.keys(payload)));
    if (d.userinfo_endpoint && tokens.access_token) {
      try {
        const ui = await fetch(d.userinfo_endpoint, { headers: { authorization: `Bearer ${tokens.access_token}` } });
        const uiBody = (await ui.json().catch(() => ({}))) as Record<string, unknown>;
        console.log('SAIG_SSO_DEBUG userinfo_status=' + ui.status + ' userinfo_keys=' + JSON.stringify(Object.keys(uiBody)));
      } catch (e) {
        console.log('SAIG_SSO_DEBUG userinfo_error=' + (e instanceof Error ? e.message : String(e)));
      }
    }
  }
  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
  if (!/^[^@]+@kmitl\.ac\.th$/.test(email)) {
    throw new ApiError('FORBIDDEN', 'Only KMITL accounts are allowed');
  }
  const name = typeof payload.name === 'string' && payload.name ? payload.name : email.split('@')[0];
  return { email, name };
}
