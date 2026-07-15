# Mood of the Major — Design Spec

**Date:** 2026-07-15
**Deadline:** 2 August 2026
**Status:** Approved (pending implementation plan)

A community platform for KMITL students to share their current emotional state anonymously within their faculty/major, visualizing the collective vibe of campus.

## Scope Strategy

Core-first (option A): auth + mood CRUD + anonymity + RBAC done solidly, then bonuses in order of value. Explicitly cut: deployment (SSO redirect URI is bound to localhost; needs KDMC approval for a public URI), dark mode, faculty heatmap.

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript, Vite, Tailwind CSS, shadcn/ui, Framer Motion, Zustand, React Hook Form + Zod, axios |
| Backend | Express + TypeScript, Mongoose, Zod (validation), jose (JWT/JWKS), helmet, express-rate-limit |
| Database | MongoDB (local via docker-compose) |
| Docs | Swagger UI at `/api/docs` via zod-to-openapi |
| Tests | Vitest; Supertest + mongodb-memory-server (BE), Testing Library (FE, light) |

## Repository Layout

```
/
├─ client/                 Vite + React + TS
│  └─ src/{pages, components, stores, lib, hooks}
├─ server/                 Express + TS
│  ├─ src/{routes, controllers, services, models, middleware, config}
│  └─ src/scripts/seed.ts  (faculties + admin seed)
├─ package.json            npm workspaces + concurrently (dev runs both)
└─ docker-compose.yml      MongoDB
```

Ports: Express **:3000** (fixed — SSO redirect URI), Vite dev **:5173** with `/api` proxy → :3000. CORS locked to `http://localhost:5173`.

## Authentication — KMITL SSO (OIDC) + first-party JWT

SSO client: **Techmastery SAIG** (developer.kmitl.ac.th/console/sso/28)

- Issuer: `https://sso.kmitl.ac.th/realms/kmitl` (Keycloak; discovery endpoint available)
- Client ID: `vcspwnm2ib-7y26lbiwmzilwb7w51w78y3v7rg5lrfz.developer.kmitl.ac.th`
- Client secret: `.env` only, never committed; `.env.example` provided
- Registered redirect URIs: `http://localhost:3000`, `http://localhost:3000/api/auth/callback`

Flow:

1. FE "Login with KMITL" → `GET /api/auth/login`
2. BE generates `state` + PKCE, stores in short-lived cookie, redirects to Keycloak authorize endpoint (`scope=openid profile email`)
3. Callback: verify state → exchange code+secret at token endpoint → verify id_token signature via issuer JWKS → extract `email`, `name`
4. Upsert User: `email` unique; `studentId` derived from email local part (`68010025@kmitl.ac.th` → `68010025`)
5. Issue first-party tokens:
   - **Access JWT, 15 min** — response body; FE keeps in memory only
   - **Refresh token, 15 days sliding** — httpOnly SameSite=Lax cookie scoped to `/api/auth`; hash stored in DB; rotated on every refresh; reuse detection revokes the whole token family
6. If `user.onboarded === false` → FE forces onboarding page (faculty/major/year) before feed

Endpoints: `GET /api/auth/login`, `GET /api/auth/callback`, `POST /api/auth/refresh`, `POST /api/auth/logout` (revokes refresh + Keycloak logout with `id_token_hint`), `GET /api/auth/me`, `PATCH /api/auth/onboarding`.

SSO limitation: only `name`/`email` claims available (faculty/student-ID claims require KDMC request). Faculty/major/year are self-reported at onboarding; studentId derived from email.

## Data Model

```
User
  email        string, unique          (from SSO)
  studentId    string                  (email local part)
  displayName  string                  (from SSO; internal only, never in feed)
  faculty      ObjectId → Faculty      (onboarding)
  major        string                  (combobox, normalized trim/case)
  year         number 1–8
  role         'user' | 'admin'
  onboarded    boolean
  timestamps

Mood
  author       ObjectId → User         (indexed; ownership checks only, never populated in feed)
  moodType     'happy'|'hyped'|'meh'|'tired'|'stressed'|'sad'
  text         string 1–280
  faculty      ObjectId → Faculty      (denormalized from author at post time)
  major        string                  (denormalized)
  year         number                  (denormalized)
  timestamps                           (createdAt = filter + pagination cursor)

Faculty
  nameTh, nameEn, slug
  knownMajors  string[]                (seed + accumulated from user input)

RefreshToken
  user, tokenHash, family, expiresAt, revokedAt?
```

Indexes: `Mood {faculty, createdAt}`, `{moodType, createdAt}`, `{author}`.

Design decisions:
- **Anonymity by design:** feed responses contain only `moodType, text, faculty, major, year, createdAt, isMine` (computed server-side so owners see edit/delete). No author fields ever serialized.
- **Denormalized faculty/major/year on Mood:** filters/stats without joins. A mood is a snapshot at post time; changing faculty later doesn't rewrite history.
- **Major data problem:** no authoritative source for majors. Solution: fixed faculty dropdown (seeded from KMITL public data, ~15 faculties/colleges) + major **combobox** — free text, but suggestions from `knownMajors` of the selected faculty; each new entry is normalized and appended, so data converges. Best-effort seed of majors compiled from public KMITL curriculum pages.

## API

```
Auth    GET  /api/auth/login | /callback     POST /refresh | /logout
        GET  /api/auth/me                    PATCH /api/auth/onboarding

Moods   GET    /api/moods        ?faculty=&major=&moodType=&from=&to=&cursor=&limit=20
        POST   /api/moods        {moodType, text}
        PATCH  /api/moods/:id    owner only
        DELETE /api/moods/:id    owner or admin

Stats   GET /api/stats/overview  mood distribution for same filter params
                                 (drives living background + stats bar)

Meta    GET /api/faculties       list + knownMajors (feeds combobox)

Admin   GET   /api/admin/users            ?search=&cursor=
        PATCH /api/admin/users/:id/role   {role}
```

- **Cursor pagination** (`createdAt` + `_id` compound cursor), not skip/limit.
- **Validation both sides:** Zod middleware on BE (single source per route), React Hook Form + Zod on FE.
- Uniform error shape: `{error: {code, message, details?}}`. Central error middleware: Zod → 400 with field details; expired access token → 401 `TOKEN_EXPIRED` (FE interceptor auto-refreshes and retries).
- Middleware chain: `requireAuth`, `requireOnboarded`, `requireAdmin` (RBAC), `validate(schema)`.
- Hardening: helmet, rate limit on mutating routes, CORS allowlist.
- Swagger UI at `/api/docs`.

## RBAC

- **user:** post; edit/delete own moods; view stats.
- **admin:** everything + delete any mood (moderation) + user management (list/search users, toggle user↔admin role).
- Admin bootstrap: seed script sets initial admin(s) in DB. Further admins promoted via the user management page.

## UI/UX

Five pages:

1. **Landing/Login** — logo + tagline + "Login with KMITL" on a slow-moving soft gradient.
2. **Onboarding** — one-time: faculty dropdown → major combobox → year.
3. **Feed** (home) — mood cards, filter bar (faculty/major/mood/date range), floating post button, **living background** (page gradient shifts toward the dominant mood of the current filter, 2–3 s transition), **stats bar** (6-color proportion bar; clicking a segment filters that mood). Infinite scroll.
4. **My Moods** — own posts, edit/delete.
5. **Admin** — tabs: Moderation (all posts + delete) / Users (search + role toggle).

Mood palette (calm, pastel):

| mood | color | emoji |
|---|---|---|
| happy | warm yellow | 😊 |
| hyped | coral/orange | 🔥 |
| meh | gray-beige | 😑 |
| tired | muted lavender | 😴 |
| stressed | dusty purple-blue | 😰 |
| sad | soft slate blue | 😢 |

- Post composer: bottom sheet (mobile) / dialog (desktop) — 6-emoji picker, 280-char counter.
- Mood card: large emoji + text + badge "Engineering • Y2" + relative time. No identity.
- Framer Motion: card enter fade+slide, mood picker spring, page transitions.
- Responsive mobile-first; filter bar collapses to a drawer on mobile.
- State: Zustand (auth store, feed filter store).

## Testing

- **BE (priority):** Vitest + Supertest + mongodb-memory-server — auth middleware, RBAC matrix (user deleting others' post → 403, admin → 200), ownership, Zod validation, cursor pagination, refresh rotation + reuse detection. SSO mocked at the boundary (token exchange, JWKS).
- **FE (light):** filter store, auth interceptor logic.
- Manual E2E checklist before submission (real SSO login, post, filter, admin moderation).

## Requirement Coverage

| Req | Status |
|---|---|
| Auth (student credentials) | ✓ KMITL SSO + onboarding |
| JWT | ✓ first-party access JWT |
| Refresh rotation (bonus) | ✓ 15-day sliding, reuse detection |
| Mood CRUD | ✓ |
| Anonymous + academic context | ✓ by serialization design |
| Search/Filter/Pagination (bonus) | ✓ query params + cursor |
| RBAC | ✓ middleware + admin panel + user mgmt |
| Validation both sides (bonus) | ✓ Zod + RHF |
| Modern minimal UX | ✓ calm palette, shadcn |
| Responsive | ✓ mobile-first |
| Swagger (bonus) | ✓ /api/docs |
| State mgmt (bonus) | ✓ Zustand |
| Animation (bonus) | ✓ Framer Motion |
| Architecture (bonus) | ✓ routes/controllers/services/models |
| Creativity (bonus) | ✓ living background + stats bar |
| Deployment (bonus) | ✗ cut (redirect URI localhost-only) |
