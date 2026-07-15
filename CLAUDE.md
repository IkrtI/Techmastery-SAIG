# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Mood of the Major** — anonymous mood-sharing platform for KMITL students. React + Express + MongoDB, TypeScript throughout. Deadline: 2 August 2026.

**Read the design spec first:** `docs/superpowers/specs/2026-07-15-mood-of-the-major-design.md` — it is the single source of truth for data model, API surface, auth flow, UI, and requirement coverage. Do not re-derive decisions it already makes.

## Commands

npm workspaces monorepo (`client/` + `server/`):

```bash
npm run dev            # concurrently: Vite :5173 + Express :3000 (tsx watch)
docker compose up -d   # local MongoDB
npm run test -w server # BE tests (Vitest + Supertest + mongodb-memory-server)
npm run test -w client # FE tests
npm run build          # client (vite build) + server (tsc)
npm run seed -w server # seed faculties + initial admin
```

Run a single test: `npm run test -w server -- moods.test.ts` (Vitest filter).

## Hard Constraints

- **Express must listen on :3000** — the KMITL SSO redirect URIs are registered for `http://localhost:3000/api/auth/callback` and `https://saig.ikrt.dev/api/auth/callback`. Changing the port breaks login.
- **Anonymity invariant:** no author-identifying field (`author`, `email`, `studentId`, `displayName`) may ever be serialized into feed/stats responses. Owner affordances go through the server-computed `isMine` flag only.
- **SSO client secret lives in `server/.env` only** (`OIDC_CLIENT_SECRET`). Never commit it; keep `.env.example` current. The secret is managed by the user via developer.kmitl.ac.th/console/sso/28.
- SSO issuer: `https://sso.kmitl.ac.th/realms/kmitl` (Keycloak, OIDC discovery available). Only `name`/`email` claims are granted; faculty/major/year are self-reported at onboarding, `studentId` is derived from the email local part.

## Architecture Notes

- Server layering: `routes → controllers → services → models`, cross-cutting in `middleware/` (`requireAuth`, `requireOnboarded`, `requireAdmin`, `validate(zodSchema)`). Business logic belongs in services; controllers stay thin.
- Auth: first-party JWTs issued after SSO — 15-min access token (FE memory only) + 15-day sliding refresh token (httpOnly cookie scoped to `/api/auth`, hashed in DB, rotated with reuse detection).
- Mood documents denormalize `faculty/major/year` at post time — filters and stats never join to User. This is intentional; don't "fix" it.
- Pagination is cursor-based (`createdAt` + `_id`), not skip/limit.
- Production is a single container: Express serves the built client from `client/dist` (SPA fallback) — same origin, no CORS. Deployed on the user's Dokploy server behind Cloudflare at `https://saig.ikrt.dev` (Dokploy MCP tools are available in-session).
