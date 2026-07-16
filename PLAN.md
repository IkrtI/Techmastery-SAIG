# PLAN.md — Mood of the Major

Execution plan + live status. **Update checkboxes as work lands** (same commit as the work when possible). Contracts in `SPECS.md`, design in `DESIGN.md`.

**Deadline:** 2 Aug 2026 · **Status:** deployed to https://saig.ikrt.dev — prod SSO pending client secret

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
- [ ] Local `docker build` + run against compose Mongo (skipped — no local Docker daemon; Dokploy remote build succeeded)
- [x] Dokploy project SAIG: MongoDB service (`saig-mongo`) + app (`saig-app`, custom-git Dockerfile build); env set — `OIDC_CLIENT_SECRET` placeholder pending user paste
- [x] Cloudflare: `saig.ikrt.dev` published on the Acer-PVE cloudflared tunnel → 192.168.1.161:3100 (host-published app port; Traefik routing unused on this server — see log); TLS at CF edge, `/api/health` 200 ✓
- [ ] Prod SSO round-trip via `https://saig.ikrt.dev`
- [x] Seed prod: ran `node server/dist/scripts/seed.js` in-container via one-off Dokploy schedule; faculty count verified > 0

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
| 2026-07-16 | Phase 8: deployed. Dokploy project SAIG (app p4mG7f7QIqok454KGYBbP + saig-mongo), image built from GitHub (repo made public). Origin is home server behind Cloudflare Tunnel — 443/80 closed, so Traefik routing 502s; switched to host-published port 3100 + tunnel public-hostname (matches how other services on this box are published). Prod health + SPA 200; seeded via one-off schedule. Remaining: user pastes OIDC_CLIENT_SECRET + SEED_ADMIN_EMAILS in Dokploy env → redeploy → prod SSO E2E |
| 2026-07-16 | Visual re-skin to the dark revision (Claude Design project 6e23f469): dark tokens, rose/sky accents, dot-based mood identity + new mood palette, glow living background, inline delete-confirm, skeleton/empty/error states, mobile bottom nav + filter bottom sheet, toasts; Geist/Geist Mono + Anuphan fallback. lucide-react dropped. Verified against a mock API in vite preview; 7 client tests + build green |
| 2026-07-16 | Light theme (lovable warm-cream, getdesign lovable/DESIGN.md) as a toggle — dark stays default; token pairs per theme incl. mood -ink text variants for cream contrast. Feed composer redesigned as a chat-style bottom dock (mood chips + autosize input + Enter-to-send); FAB + create modal removed, card edit re-uses the dock |
| 2026-07-16 | Profanity filter (TH+EN) on mood text: shared containsProfanity() in server+client, Zod refine on POST/PATCH /moods, live warning in dock/composer; false-positive guards (หีบ, class/assistant). Fixed dock chip clipping (overflow container + scale) and moved toast under header |
| 2026-07-16 | Engagement: anonymous encouragement comments (1–200 chars, profanity-screened, owner/admin delete, oldest-first) + reactions (สู้ๆ นะ/เข้าใจเลย/ยินดีด้วย, one per user per post, toggle) — models, batched feed aggregation, cascade on mood delete, OpenAPI, 7 new server tests (40 total). UI: reaction chips + inline comment thread on cards, chat reply row; mobile bottom nav folded into the header menu (hamburger icon, nav rows + theme/lang/logout) |
| 2026-07-16 | Profanity screen v2: expanded Thai/English blocklists (ไอ้ควาย/อีบ้า/สันดาน/เสือก…, fucking/retard/wanker…, new guards สัด/ห่า) + hostile tier for comments only (ไปตาย, ตายซะ, kys, kill yourself…) — venting posts about oneself still allowed. Server authoritative in commentBodySchema, client mirror in CommentThread. 41 server tests |
| 2026-07-16 | Reactions v2: emoji chips — 3 new types heart/hug/haha (❤️🤗😂), existing chips now emoji-only with count + aria-label/title (💪🫂🎉). Enum single-sourced from Reaction model into Zod schema + OpenAPI + engagement zero-map. 41 server + 10 client tests |
| 2026-07-16 | Moderation tier 3 — self-harm: blocked in posts+comments (server Zod refine, message carries SOS/1323), client SupportDialog (ปลอบ + ลิงก์ sos.kmitl.ac.th + tel:1323) opens on typing, submit disabled; major field now profanity-screened. 44 server + 10 client tests |
