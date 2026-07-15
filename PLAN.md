# PLAN.md — Mood of the Major

Execution plan + live status. **Update checkboxes as work lands** (same commit as the work when possible). Contracts in `SPECS.md`, design in `DESIGN.md`.

**Deadline:** 2 Aug 2026 · **Status:** core + bonus implemented; deploy in progress

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
- [x] npm workspaces root (`client/`, `server/`), concurrently dev script
- [x] `client/`: Vite React TS + Tailwind (v4 via `@tailwindcss/vite`) + path aliases — UI comes from the design-system port, not shadcn/ui (see log 2026-07-16)
- [x] `server/`: Express TS (tsx watch) — eslint config deferred (blocked by repo config-protection hook)
- [x] `docker-compose.yml` MongoDB + volume; `.env.example`
- [x] Zod-validated env loader; healthcheck route `GET /api/health`

**Verify:** `npm run dev` boots both; `/api/health` 200; Vite proxy works.

## Phase 1 — Server Foundation
- [x] Mongoose connect + models: User, Mood, Faculty, RefreshToken (SPECS §3, cursor indexes included)
- [x] Central error middleware + error codes (SPECS §5) + `validate(schema)` middleware
- [x] Seed script: faculties + knownMajors + existing-user role sync from `SEED_ADMIN_EMAILS`; never create partial users

**Verify:** seed runs idempotently; model unit tests green.

## Phase 2 — Auth (SSO + JWT)
- [ ] Confirm the real KMITL SSO client eligibility policy; describe it accurately and do not infer student-only access from claims that provide only name/email
- [x] OIDC: login redirect (state+PKCE+nonce cookies), callback (exchange, JWKS + nonce verify, upsert + admin allowlist)
- [x] Access JWT issue/verify (`requireAuth`, `TOKEN_EXPIRED` path)
- [x] Atomic refresh rotation + concurrent replay rejection; sliding 15-day cookie
- [x] `/auth/me`, app-session `/auth/logout`, `/auth/onboarding` (normalized major; seed suggestions remain immutable)
- [x] `requireOnboarded`, `requireAdmin`
- [x] Tests: SPECS §9 auth matrix, including admin allowlist, state/nonce mismatch, and exactly-one-winner concurrent refresh

**Verify:** all auth tests green ✓ (13). Real SSO round-trip on localhost:3000 pending the real client secret in `server/.env`.

## Phase 3 — Moods + Stats API
- [x] CRUD with ownership checks, denormalization at create, MoodPublic serializer (+`isMine`)
- [x] `mine=true` server-owned filter for My Moods; never accept client-provided author IDs
- [x] Feed filters (faculty/normalized major/moodType/half-open UTC date range) + cursor pagination
- [x] `GET /stats/overview`; `GET /faculties`
- [x] Rate limiting on mutations; helmet; CORS dev config
- [x] Tests: SPECS §9 moods/pagination/stats/anonymity assertions

**Verify:** all server tests green ✓ (30 total).

## Phase 4 — Admin Moderation
- [x] `DELETE /admin/moods/:id` protected by `requireAdmin`; admin accounts come from `SEED_ADMIN_EMAILS`
- [x] Admin delete-any-mood path covered by RBAC tests

**Verify:** RBAC tests green ✓.

## Phase 5 — Frontend Foundation
- [x] Router + guards (`/login`, `/onboarding`, `/`, `/me`, `/admin`) per SPECS §7
- [x] authStore + boot refresh; axios interceptor single-flight refresh
- [x] filterStore ↔ URL params
- [x] TanStack Query client + feed/stats query keys; Zustand remains client-state only
- [x] Theme: design tokens as CSS custom properties (`styles/tokens.css`, from the Claude Design project); Tailwind v4 reads them directly

**Verify:** guards + redirect chain implemented; real-BE walkthrough pending SSO secret.

## Phase 6 — Frontend Pages
- [x] Landing/Login (drifting gradient)
- [x] Onboarding (faculty dropdown, major combobox, year)
- [x] Feed: mood cards, infinite scroll, filter bar, post composer (dialog / mobile bottom sheet)
- [x] Dominant-mood living background + stats bar wired to `/stats/overview`
- [x] My Moods (edit/delete)
- [x] Admin moderation page (delete any mood; no user/role management)

**Verify:** manual walkthrough all pages, mobile viewport (375px) — pending real SSO round-trip.

## Phase 7 — Polish & Bonus Closure
- [x] Motion via design-system CSS tokens (card enter, dialog pop, bg crossfade) + `prefers-reduced-motion` everywhere — CSS replaces Framer Motion (see log)
- [x] Swagger UI `/api/docs` from zod-to-openapi (same schemas as validation); public dev, admin-only prod
- [x] Empty/loading/error states every page; Thai-first bilingual copy (th/en toggle)
- [x] Client light tests (filterStore URL sync + Bangkok date range, interceptor single-flight)

**Verify:** `npm run build` clean ✓; Swagger covers every implemented endpoint ✓.

## Phase 8 — Deploy (Dokploy)
- [x] Multi-stage Dockerfile (SPECS §10)
- [ ] Local `docker build` + run against compose Mongo
- [ ] Dokploy project SAIG: MongoDB service + app; env/secrets set in Dokploy
- [ ] Cloudflare DNS `saig.ikrt.dev` → server; Traefik host route; TLS verified
- [ ] Prod SSO round-trip via `https://saig.ikrt.dev`
- [ ] Seed prod (faculties + admin)

**Verify:** full manual E2E checklist (SPECS §9) on production URL.

## Phase 9 — Submission
- [x] README.md: setup, run, env table, live URL, feature list vs requirements, and how KMITL SSO + onboarding satisfies registration without a password form (screenshots pending)
- [ ] Final requirement coverage check (SPECS tables)
- [ ] Tag release / final commit

---

## Log

| date | note |
|---|---|
| 2026-07-15 | Design finalized; SSO client configured (3 redirect URIs); DESIGN/SPECS/PLAN split created |
| 2026-07-15 | Contract tightened for MVP: added OIDC nonce, My Moods filter, normalized/date/index semantics, requirement traceability; deferred nonessential admin/auth complexity |
| 2026-07-16 | Design system finalized in Claude Design project; MoodFeed template + component library (tokens, Button, MoodCard, StatsBar, LivingBackground, MoodPicker, Dialog, …) ported to `client/src` as typed TSX + plain CSS |
| 2026-07-16 | Phases 0–4 implemented; server suite green (30 tests: auth matrix incl. concurrent-refresh single winner, anonymity raw-JSON assertions, boundary-timestamp pagination, Bangkok half-open date ranges) |
| 2026-07-16 | Phases 5–7 implemented: router+guards, single-flight refresh interceptor, filterStore↔URL, all pages, Swagger via zod-to-openapi. Stack deltas vs original SPECS: shadcn/ui → design-system port; Framer Motion → design-token CSS animations; RHF → direct Zod validation (SPECS updated). eslint deferred (config-protection hook) |
