# Mood of the Major

Anonymous mood-sharing platform for KMITL students. Post how you feel — tagged only with your faculty, major, and year, never your name. The feed's living background shifts with the campus's dominant mood.

**Live:** https://saig.ikrt.dev

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + TypeScript, Vite, Tailwind CSS 4, Zustand, TanStack Query, axios, design-system components ported from the project's Claude Design system |
| Backend | Express + TypeScript, Mongoose, Zod, jose (OIDC + JWT), helmet, express-rate-limit |
| Database | MongoDB 7 |
| Auth | KMITL SSO (Keycloak OIDC + PKCE + nonce) → first-party JWT (15 min) + rotating refresh cookie (15 days, sliding) |
| Docs | Swagger UI at `/api/docs` (zod-to-openapi — same Zod schemas the routes validate with) |
| Tests | Vitest + Supertest + mongodb-memory-server |

## Registration without a password form

Sign-up/sign-in is delegated to KMITL SSO (`sso.kmitl.ac.th`). The server verifies the `id_token` (signature via issuer JWKS, issuer, audience, expiry, nonce), accepts only `@kmitl.ac.th` emails, and derives `studentId` from the email local part. Faculty/major/year are self-reported once at onboarding — SSO only grants `name`/`email`. This satisfies "user registration" with a stronger guarantee than a password form: only real KMITL accounts can enter.

## Anonymity invariant

Mood documents keep an `author` reference internally (for ownership + My Moods), but the single serializer (`MoodPublic`) never emits `author`, `email`, `studentId`, `displayName`, or `majorNormalized`. Tests assert this on raw response JSON. Owner affordances (edit/delete menu) come from the server-computed `isMine` flag only.

## Local development

```bash
npm install
docker compose up -d                      # MongoDB :27017
cp server/.env.example server/.env        # fill OIDC_CLIENT_SECRET + JWT_SECRET
npm run seed                              # faculties + admin role sync
npm run dev                               # Vite :5173 + Express :3000
```

Express **must** stay on :3000 — the registered SSO redirect URIs depend on it (`http://localhost:3000/api/auth/callback`, `https://saig.ikrt.dev/api/auth/callback`).

### Environment (`server/.env`)

| Var | Notes |
|---|---|
| `MONGODB_URI` | `mongodb://localhost:27017/saig` |
| `APP_URL` | FE origin (`http://localhost:5173` dev, `https://saig.ikrt.dev` prod) |
| `OIDC_ISSUER` | `https://sso.kmitl.ac.th/realms/kmitl` |
| `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` | from developer.kmitl.ac.th console — secret never committed |
| `OIDC_REDIRECT_URI` | must match the registered list exactly |
| `JWT_SECRET` | 32+ random bytes |
| `SEED_ADMIN_EMAILS` | comma-separated admin allowlist |

### Tests

```bash
npm test                    # server suite: auth, RBAC, anonymity, pagination, stats
npm run test -w server -- moods.test.ts
```

## Features vs requirements

| Requirement | Where |
|---|---|
| React + Express + MongoDB | whole repo |
| KMITL identity + JWT | `server/src/services/oidc.ts`, `tokens.ts` — PKCE + nonce, JWKS verify, atomic refresh rotation |
| Anonymous mood CRUD | `server/src/routes/moods.ts` + `lib/serialize.ts` |
| User/Admin RBAC | `middleware/auth.ts`, admin moderation delete |
| Responsive calm UI | design-system components, mobile bottom-sheet composer, 375px-friendly |
| Filters + cursor pagination (bonus) | faculty/major/mood/date filters, `{createdAt,_id}` cursor |
| Validation (bonus) | Zod on every route + client forms |
| State management (bonus) | Zustand (client state) + TanStack Query (server state) |
| Living mood visualization (bonus) | dominant-mood living background + stats bar |
| Swagger (bonus) | `/api/docs` |
| Deployment (bonus) | Dokploy + Cloudflare at saig.ikrt.dev (single container, Express serves the SPA) |

## Production

Multi-stage `Dockerfile` → single container on Dokploy behind Traefik + Cloudflare. MongoDB runs as a Dokploy service on the internal network. Seed once after first deploy:

```bash
node server/dist/scripts/seed.js
```
