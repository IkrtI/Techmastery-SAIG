# PLAN.md — Mood of the Major

Execution plan + live status. **Update checkboxes as work lands** (same commit as the work when possible). Contracts in `SPECS.md`, design in `DESIGN.md`.

**Deadline:** 2 Aug 2026 · **Status:** design done, implementation not started

## Requirement Traceability

| requirement | priority | phase | acceptance evidence |
|---|---|---|---|
| React + Express + MongoDB | Core | 0–1 | dev servers and MongoDB boot; healthcheck 200 |
| KMITL identity + JWT | Core | 2 | real SSO callback, access-token middleware, refresh replay rejection |
| Anonymous Mood CRUD | Core | 3 | raw JSON anonymity assertions + owner CRUD tests |
| User/Admin RBAC | Core | 4 | user cannot mutate others; admin-only moderation delete succeeds |
| Responsive calm UI | Core | 5–6 | complete mobile walkthrough at 375 px |
| Faculty/major/mood/date filters + cursor pagination | Bonus | 3, 6 | filter fixtures; no duplicate/omitted boundary records |
| Validation | Bonus | 1–3, 5–6 | server edge tests + client form errors |
| State management | Bonus | 5 | Zustand client state + TanStack Query server state verified |
| Living mood visualization + animation | Bonus | 6–7 | dominant-mood background, stats bar, reduced-motion walkthrough |
| Swagger | Bonus | 7 | every implemented endpoint documented |
| Deployment | Bonus | 8 | production SSO and full E2E at `https://saig.ikrt.dev` |

**Explicitly deferred:** admin user/role management, refresh-token family reuse detection, user-mutated major suggestions, distribution-weighted background blending.

## Phase 0 — Scaffold
- [ ] npm workspaces root (`client/`, `server/`), concurrently dev script
- [ ] `client/`: Vite React TS + Tailwind + shadcn/ui init + path aliases
- [ ] `server/`: Express TS (tsx watch), eslint/prettier both workspaces
- [ ] `docker-compose.yml` MongoDB + volume; `.env.example`
- [ ] Zod-validated env loader; healthcheck route `GET /api/health`

**Verify:** `npm run dev` boots both; `/api/health` 200; Vite proxy works.

## Phase 1 — Server Foundation
- [ ] Mongoose connect + models: User, Mood, Faculty, RefreshToken (SPECS §3, cursor indexes included)
- [ ] Central error middleware + error codes (SPECS §5) + `validate(schema)` middleware
- [ ] Seed script: faculties + knownMajors + existing-user role sync from `SEED_ADMIN_EMAILS`; never create partial users

**Verify:** seed runs idempotently; model unit tests green.

## Phase 2 — Auth (SSO + JWT)
- [ ] Confirm the real KMITL SSO client eligibility policy; describe it accurately and do not infer student-only access from claims that provide only name/email
- [ ] OIDC: login redirect (state+PKCE+nonce cookies), callback (exchange, JWKS + nonce verify, upsert + admin allowlist)
- [ ] Access JWT issue/verify (`requireAuth`, `TOKEN_EXPIRED` path)
- [ ] Atomic refresh rotation + concurrent replay rejection; sliding 15-day cookie
- [ ] `/auth/me`, app-session `/auth/logout`, `/auth/onboarding` (normalized major; seed suggestions remain immutable)
- [ ] `requireOnboarded`, `requireAdmin`
- [ ] Tests: SPECS §9 auth matrix, including admin allowlist, state/nonce mismatch, and exactly-one-winner concurrent refresh

**Verify:** real SSO round-trip on localhost:3000 (manual); all auth tests green.

## Phase 3 — Moods + Stats API
- [ ] CRUD with ownership checks, denormalization at create, MoodPublic serializer (+`isMine`)
- [ ] `mine=true` server-owned filter for My Moods; never accept client-provided author IDs
- [ ] Feed filters (faculty/normalized major/moodType/half-open UTC date range) + cursor pagination
- [ ] `GET /stats/overview`; `GET /faculties`
- [ ] Rate limiting on mutations; helmet; CORS dev config
- [ ] Tests: SPECS §9 moods/pagination/stats/anonymity assertions

**Verify:** all server tests green; manual curl of filter combos.

## Phase 4 — Admin Moderation
- [ ] `DELETE /admin/moods/:id` protected by `requireAdmin`; admin accounts come from `SEED_ADMIN_EMAILS`
- [ ] Admin delete-any-mood path covered by RBAC tests

**Verify:** RBAC tests green.

## Phase 5 — Frontend Foundation
- [ ] Router + guards (`/login`, `/onboarding`, `/`, `/me`, `/admin`) per SPECS §7
- [ ] authStore + boot refresh; axios interceptor single-flight refresh
- [ ] filterStore ↔ URL params
- [ ] TanStack Query client + feed/stats query keys; Zustand remains client-state only
- [ ] Theme: mood tokens in Tailwind config (DESIGN palette)

**Verify:** login → onboarding → feed redirect chain works against real BE.

## Phase 6 — Frontend Pages
- [ ] Landing/Login (drifting gradient)
- [ ] Onboarding (faculty dropdown, major combobox, year)
- [ ] Feed: mood cards, infinite scroll, filter bar (mobile drawer), post composer (dialog/bottom sheet)
- [ ] Dominant-mood living background + stats bar wired to `/stats/overview`
- [ ] My Moods (edit/delete)
- [ ] Admin moderation page (delete any mood; no user/role management)

**Verify:** manual walkthrough all pages, mobile viewport (375px) included.

## Phase 7 — Polish & Bonus Closure (only after core production flow works)
- [ ] Framer Motion pass (DESIGN motion language) + `prefers-reduced-motion`
- [ ] Swagger UI `/api/docs` complete for every endpoint
- [ ] Empty/loading/error states every page; Thai UI copy pass
- [ ] Client light tests (filterStore, interceptor)

**Verify:** `npm run build` clean; Swagger covers 100% endpoints.

## Phase 8 — Deploy (Dokploy)
- [ ] Multi-stage Dockerfile (SPECS §10); local `docker build` + run against compose Mongo
- [ ] Dokploy project SAIG: MongoDB service + app; env/secrets set in Dokploy
- [ ] Cloudflare DNS `saig.ikrt.dev` → server; Traefik host route; TLS verified
- [ ] Prod SSO round-trip via `https://saig.ikrt.dev`
- [ ] Seed prod (faculties + admin)

**Verify:** full manual E2E checklist (SPECS §9) on production URL.

## Phase 9 — Submission
- [ ] README.md: setup, run, env table, screenshots, live URL, feature list vs requirements, and how KMITL SSO + onboarding satisfies registration without a password form
- [ ] Final requirement coverage check (SPECS tables)
- [ ] Tag release / final commit

---

## Log

| date | note |
|---|---|
| 2026-07-15 | Design finalized; SSO client configured (3 redirect URIs); DESIGN/SPECS/PLAN split created |
| 2026-07-15 | Contract tightened for MVP: added OIDC nonce, My Moods filter, normalized/date/index semantics, requirement traceability; deferred nonessential admin/auth complexity |
