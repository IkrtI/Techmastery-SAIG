// Minimal fake Keycloak: discovery + JWKS + token endpoint, RS256-signed
// id_tokens. Lets auth tests exercise the real jose verification path.
import { createServer, type Server } from 'node:http';
import { SignJWT, exportJWK, generateKeyPair, type JWK } from 'jose';

export interface FakeSso {
  issuer: string;
  /** Claims embedded in the next id_token returned by /token. */
  setNextIdToken(claims: { email?: string; name?: string; nonce?: string; aud?: string; iss?: string }): void;
  close(): Promise<void>;
}

export async function startFakeSso(clientId: string): Promise<FakeSso> {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' };

  let next: { email?: string; name?: string; nonce?: string; aud?: string; iss?: string } = {};
  let issuer = '';

  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', issuer);
    if (url.pathname === '/.well-known/openid-configuration') {
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          issuer,
          authorization_endpoint: `${issuer}/authorize`,
          token_endpoint: `${issuer}/token`,
          jwks_uri: `${issuer}/jwks`,
        }),
      );
      return;
    }
    if (url.pathname === '/jwks') {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ keys: [jwk] }));
      return;
    }
    if (url.pathname === '/token') {
      const idToken = await new SignJWT({
        email: next.email ?? 'student@kmitl.ac.th',
        name: next.name ?? 'Test Student',
        ...(next.nonce !== undefined ? { nonce: next.nonce } : {}),
      })
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setIssuer(next.iss ?? issuer)
        .setAudience(next.aud ?? clientId)
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(privateKey);
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ access_token: 'x', id_token: idToken, token_type: 'Bearer' }));
      return;
    }
    res.statusCode = 404;
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  issuer = `http://127.0.0.1:${address.port}`;

  return {
    issuer,
    setNextIdToken(claims) {
      next = claims;
    },
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
