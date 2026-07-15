# PLAN.md — Mood of the Major

Execution plan + live status. **Update checkboxes as work lands** (same commit as the work when possible). Contracts in `SPECS.md`, design in `DESIGN.md`.

**Deadline:** 2 Aug 2026 · **Status:** design done, implementation not started

## Phase 0 — Scaffold
- [ ] npm workspaces root (`client/`, `server/`), concurrently dev script
- [ ] `client/`: Vite React TS + Tailwind + shadcn/ui init + path aliases
- [ ] `server/`: Express TS (tsx watch), eslint/prettier both workspaces
- [ ] `docker-compose.yml` MongoDB + volume; `.env.example`
- [ ] Zod-validated env loader; healthcheck route `GET /api/health`

**Verify:** `npm run dev` boots both; `/api/health` 200; Vite proxy works.

## Phase 1 — Server Foundation
- [ ] Mongoose connect + models: User, Mood, Faculty, RefreshToken (SPECS §3, indexes included)
- [ ] Central error middleware + error codes (SPECS §5) + `validate(schema)` middleware
- [ ] Seed script: faculties + knownMajors + `SEED_ADMIN_EMAILS` (SPECS §8)

**Verify:** seed runs idempotently; model unit tests green.

## Phase 2 — Auth (SSO + JWT)
- [ ] OIDC: login redirect (state+PKCE cookie), callback (exchange, JWKS verify, upsert)
- [ ] Access JWT issue/verify (`requireAuth`, `TOKEN_EXPIRED` path)
- [ ] Refresh rotation + family reuse detection; sliding 15-day cookie
- [ ] `/auth/me`, `/auth/logout` (Keycloak logout URL), `/auth/onboarding` (+knownMajors append)
- [ ] `requireOnboarded`, `requireAdmin`
- [ ] Tests: SPECS §9 auth + RBAC matrix

**Verify:** real SSO round-trip on localhost:3000 (manual); all auth tests green.

## Phase 3 — Moods + Stats API
- [ ] CRUD with ownership checks, denormalization at create, MoodPublic serializer (+`isMine`)
- [ ] Feed filters (faculty/major/moodType/date) + cursor pagination
- [ ] `GET /stats/overview`; `GET /faculties`
- [ ] Rate limiting on mutations; helmet; CORS dev config
- [ ] Tests: SPECS §9 moods/pagination/stats/anonymity assertions

**Verify:** all server tests green; manual curl of filter combos.

## Phase 4 — Admin API
- [ ] `GET /admin/users` (search + cursor), `PATCH /admin/users/:id/role` (no self-demote)
- [ ] Admin delete-any-mood path covered by tests

**Verify:** RBAC tests green.

## Phase 5 — Frontend Foundation
- [ ] Router + guards (`/login`, `/onboarding`, `/`, `/me`, `/admin`) per SPECS §7
- [ ] authStore + boot refresh; axios interceptor single-flight refresh
- [ ] filterStore ↔ URL params
- [ ] Theme: mood tokens in Tailwind config (DESIGN palette)

**Verify:** login → onboarding → feed redirect chain works against real BE.

## Phase 6 — Frontend Pages
- [ ] Landing/Login (drifting gradient)
- [ ] Onboarding (faculty dropdown, major combobox, year)
- [ ] Feed: mood cards, infinite scroll, filter bar (mobile drawer), post composer (dialog/bottom sheet)
- [ ] Living background + stats bar wired to `/stats/overview`
- [ ] My Moods (edit/delete)
- [ ] Admin (Moderation + Users tabs)

**Verify:** manual walkthrough all pages, mobile viewport (375px) included.

## Phase 7 — Polish & Bonus Closure
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
- [ ] README.md: setup, run, env table, screenshots, live URL, feature list vs requirements
- [ ] Final requirement coverage check (SPECS tables)
- [ ] Tag release / final commit

---

## Log

| date | note |
|---|---|
| 2026-07-15 | Design finalized; SSO client configured (3 redirect URIs); DESIGN/SPECS/PLAN split created |
