# SPECS.md — Mood of the Major

Authoritative technical contract. If code and this file disagree, fix one of them — never let them drift. Design rationale lives in `DESIGN.md`; execution status in `PLAN.md`.

## 1. Stack & Layout

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript, Vite, Tailwind CSS v4, dark design system ported from Claude Design project 6e23f469 (`client/src/components` + `styles/tokens.css`, Geist + Geist Mono with Anuphan Thai fallback), Zustand, TanStack Query, Zod, axios, lucide-react. Motion = design-token CSS animations (no Framer Motion); forms = direct Zod validation (no RHF); no shadcn/ui |
| Backend | Express + TypeScript (tsx dev / tsc build), Mongoose, Zod, jose (JWT + JWKS), helmet, express-rate-limit, cookie-parser |
| Database | MongoDB 7 (docker compose dev / Dokploy prod) |
| API docs | Swagger UI at `/api/docs` (zod-to-openapi) |
| Tests | Vitest; Supertest + mongodb-memory-server (server), Testing Library (client) |

```
/
├─ client/                 Vite React app  (dev :5173, /api proxy → :3000)
│  └─ src/{pages, components, stores, lib, hooks}
├─ server/                 Express API     (:3000 — FIXED, SSO redirect URI depends on it)
│  └─ src/{routes, controllers, services, models, middleware, config, scripts}
├─ package.json            npm workspaces + concurrently
├─ docker-compose.yml      MongoDB (dev)
└─ Dockerfile              multi-stage prod build (see §10)
```

## 2. Environment Variables (`server/.env`)

| Var | Example | Notes |
|---|---|---|
| `NODE_ENV` | `development` | |
| `PORT` | `3000` | must stay 3000 |
| `MONGODB_URI` | `mongodb://localhost:27017/saig` | |
| `APP_URL` | `http://localhost:5173` (dev) / `https://saig.ikrt.dev` (prod) | FE origin for redirects + CORS |
| `OIDC_ISSUER` | `https://sso.kmitl.ac.th/realms/kmitl` | discovery: `<issuer>/.well-known/openid-configuration` |
| `OIDC_CLIENT_ID` | `vcspwnm2ib-7y26lbiwmzilwb7w51w78y3v7rg5lrfz.developer.kmitl.ac.th` | |
| `OIDC_CLIENT_SECRET` | — | user pastes from console/sso/28; never committed |
| `OIDC_REDIRECT_URI` | `http://localhost:3000/api/auth/callback` / `https://saig.ikrt.dev/api/auth/callback` | must match registered list exactly |
| `JWT_SECRET` | 32+ random bytes | HS256 for first-party access tokens |
| `ACCESS_TOKEN_TTL` | `15m` | |
| `REFRESH_TOKEN_TTL_DAYS` | `15` | sliding |
| `SEED_ADMIN_EMAILS` | `admin@kmitl.ac.th` | comma-separated KMITL allowlist; auth upsert assigns admin and seed syncs existing users without creating partial users |

Env parsed and validated with Zod at boot (`config/env.ts`); crash fast on missing vars. `.env.example` mirrors this table.

## 3. Data Model (Mongoose)

### User
| field | type | rules |
|---|---|---|
| email | string | unique, lowercase, `/^[^@]+@kmitl\.ac\.th$/` |
| studentId | string | derived: email local part |
| displayName | string | from SSO `name`; internal only |
| faculty | ObjectId → Faculty | required after onboarding |
| major | string | display value: NFKC-normalized, trimmed, collapsed whitespace; 1–100 chars |
| majorNormalized | string | internal filter key: `major.toLocaleLowerCase('en-US')`; never serialized |
| year | number | int 1–8 |
| role | enum `user` \| `admin` | default `user` |
| onboarded | boolean | default false |
| timestamps | | |

### Mood
| field | type | rules |
|---|---|---|
| author | ObjectId → User | indexed; **never serialized** |
| moodType | enum `happy` `hyped` `meh` `tired` `stressed` `sad` | |
| text | string | 1–280 chars after trim |
| faculty | ObjectId → Faculty | denormalized from author at create |
| major | string | denormalized |
| majorNormalized | string | denormalized internal filter key; never serialized |
| year | number | denormalized |
| timestamps | | `createdAt` = cursor + date filter |

Indexes: `{createdAt:-1, _id:-1}`, `{faculty:1, createdAt:-1, _id:-1}`, `{majorNormalized:1, createdAt:-1, _id:-1}`, `{moodType:1, createdAt:-1, _id:-1}`, `{author:1, createdAt:-1, _id:-1}`.

### Faculty
| field | type |
|---|---|
| nameTh / nameEn | string |
| slug | string, unique |
| knownMajors | string[] — seed-managed canonical suggestions; onboarding never mutates this list |

### Comment
| field | type | rules |
|---|---|---|
| post | ObjectId → Mood | indexed with createdAt |
| author | ObjectId → User | **never serialized** |
| text | string | 1–200 after trim, profanity-screened |
| faculty / year | denormalized from author | same anonymity pattern as Mood |
| timestamps | | listed oldest-first |

### Reaction
| field | type | rules |
|---|---|---|
| post | ObjectId → Mood | |
| user | ObjectId → User | unique index `{post, user}` — one reaction per user per post |
| type | enum `encourage` `relate` `congrats` `heart` `hug` `haha` (emoji chips 💪🫂🎉❤️🤗😂) | switching type updates in place |

### RefreshToken
| field | type |
|---|---|
| user | ObjectId → User, indexed |
| tokenHash | sha256 of token, unique |
| expiresAt | Date (TTL index) |
| revokedAt | Date? |

## 4. Auth

### Flow
1. `GET /api/auth/login` → set `state` + PKCE verifier + OIDC `nonce` in short-lived (5 min) httpOnly cookies → 302 to Keycloak authorize (`response_type=code`, `scope=openid profile email`, `nonce`).
2. `GET /api/auth/callback?code&state` → verify state → token exchange (code + client_secret + PKCE) → verify `id_token` signature, issuer, audience, expiry, and nonce via issuer JWKS (`jose`) → extract `email`, `name`.
3. Upsert User by email, assigning `role=admin` when the verified email is in `SEED_ADMIN_EMAILS`. Issue the refresh cookie only, then 302 → `APP_URL` (`/onboarding` if `!onboarded`, else `/`).
4. FE calls `POST /api/auth/refresh` on load to bootstrap `{accessToken, user}`. `GET /api/auth/me` is an authenticated user re-fetch, never the bootstrap path.

The verified claims prove control of a KMITL account, not faculty/year membership. Accept only lowercase-normalized `@kmitl.ac.th` emails. Derive `studentId` from the verified email local part; do not claim a stricter student-only guarantee until the real SSO client eligibility policy or student email format is confirmed during Phase 2 verification.

### Tokens
- **Access:** JWT HS256, TTL 15 min, claims `{sub: userId, role, onboarded, iat, exp}`. Returned only by `/refresh`; FE stores it in memory and sends it as `Authorization: Bearer`.
- **Refresh:** 256-bit random, TTL 15 days **sliding** (each rotation issues a fresh 15-day expiry). Cookie: `httpOnly; SameSite=Lax; Path=/api/auth; Secure` (prod). DB stores a unique sha256 hash.
- **Rotation:** every `POST /api/auth/refresh` atomically consumes the presented unrevoked, unexpired token (conditional update on its hash) before issuing a new token, so concurrent replay has at most one winner. A known revoked token—including a losing concurrent request—returns 401 without `Set-Cookie`, preventing it from clearing the winner's new cookie. Expired or unknown tokens return 401 and clear the cookie. Refresh-family tracking is out of scope.
- `POST /api/auth/logout` → idempotently revoke the presented refresh token when found, clear the cookie, return 204 even when the cookie/token is absent or invalid. Ending the upstream Keycloak SSO session is out of scope for MVP.

### Middleware
| name | behavior |
|---|---|
| `requireAuth` | verify Bearer JWT → attach `req.user`; expired → 401 `TOKEN_EXPIRED`; invalid → 401 `UNAUTHENTICATED` |
| `requireOnboarded` | 403 `NOT_ONBOARDED` if `!onboarded` |
| `requireAdmin` | 403 `FORBIDDEN` if role ≠ admin |
| `validate(schema)` | Zod parse `{body, query, params}` → 400 `VALIDATION_ERROR` with field details |

## 5. API Contract

Base `/api`. All responses JSON. Errors: `{error: {code, message, details?}}`.

| code | HTTP | meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Zod failure; `details: [{path, message}]` |
| `UNAUTHENTICATED` | 401 | missing/bad token |
| `TOKEN_EXPIRED` | 401 | access token expired (FE: refresh + retry) |
| `NOT_ONBOARDED` | 403 | onboarding incomplete |
| `FORBIDDEN` | 403 | RBAC/ownership denial |
| `NOT_FOUND` | 404 | |
| `RATE_LIMITED` | 429 | |
| `INTERNAL` | 500 | |

### Auth
| method path | auth | in | out |
|---|---|---|---|
| GET `/auth/login` | — | — | 302 Keycloak |
| GET `/auth/callback` | — | `?code&state` | 302 APP_URL; on failure 302 `APP_URL/login?error=sso_state|sso_domain|sso_exchange` (browser-facing — never raw JSON) |
| POST `/auth/refresh` | refresh cookie | — | `{accessToken, user}` |
| POST `/auth/logout` | refresh cookie | — | 204 |
| GET `/auth/me` | Bearer | — | `{user}` (id, email, studentId, faculty{...}, major, year, role, onboarded) |
| PATCH `/auth/onboarding` | Bearer | `{facultyId, major, year}` | `{user}` — normalizes major and sets `onboarded=true`; does not mutate faculty suggestions |

### Moods
| method path | auth | in | out |
|---|---|---|---|
| GET `/moods` | Bearer+onboarded | query: `faculty?` (slug), `major?`, `moodType?`, `from?`, `to?` (ISO timestamps), `mine?` (boolean), `cursor?`, `limit?` (1–50, default 20) | `{items: MoodPublic[], nextCursor: string \| null}` |
| POST `/moods` | Bearer+onboarded | `{moodType, text}` | `MoodPublic` (201) |
| PATCH `/moods/:id` | Bearer+onboarded, owner | `{moodType?, text?}` | `MoodPublic` |
| DELETE `/moods/:id` | Bearer+onboarded, owner | — | 204 |

**MoodPublic** (the ONLY mood serializer): `{id, moodType, text, faculty: {slug, nameTh, nameEn}, major, year, createdAt, updatedAt, isMine}`. No author fields — anonymity invariant.

**Cursor:** base64url of `{createdAt, id}`; query uses `$or [{createdAt: {$lt}}, {createdAt: eq, _id: {$lt}}]`, sort `{createdAt:-1, _id:-1}`. Invalid cursor → 400.

`mine=true` adds `author=req.user.id`; the API never accepts an author ID from the client. `major` is normalized to `majorNormalized` before querying. Date ranges are half-open: `from` is inclusive (`$gte`) and `to` is exclusive (`$lt`), both transported as UTC ISO-8601 timestamps. The Thai date-picker converts the selected Asia/Bangkok start day and the day after the selected end day to UTC before requesting; require `from < to`.

### Comments & Reactions (Bearer+onboarded)
| method path | in | out |
|---|---|---|
| GET `/moods/:id/comments` | — | `{items: CommentPublic[]}` oldest-first (cap 200) |
| POST `/moods/:id/comments` | `{text}` (1–200, profanity + hostility screened) | `CommentPublic` (201) |
| DELETE `/comments/:id` | — | 204; owner or admin |
| PUT `/moods/:id/reaction` | `{type}` | `{reactions, myReaction}` — upsert, one per user |
| DELETE `/moods/:id/reaction` | — | `{reactions, myReaction: null}` |

**Profanity screen** (`lib/profanity.ts`, server authoritative, client mirrors): two tiers — vulgar Thai/English words (blocked in posts **and** comments; repeat-collapse, de-leet, Thai lookahead guards e.g. หี/หีบ, สัด/สัดส่วน, ห่า/ห่าง) and a hostile tier (ไปตาย, ตายซะ, kys, "kill yourself", …) blocked in **comments only** — self-venting posts like "อยากตาย" stay allowed.

**CommentPublic**: `{id, text, faculty{slug,nameTh,nameEn}, year, createdAt, isMine}` — anonymity invariant applies.
**MoodPublic** additionally carries `{commentCount, reactions: {encourage,relate,congrats}, myReaction}` (batched aggregation per feed page). Deleting a mood cascades its comments and reactions.

### Stats
| method path | auth | in | out |
|---|---|---|---|
| GET `/stats/overview` | Bearer+onboarded | `faculty?`, `major?`, `moodType?`, `from?`, `to?`; no `mine`, cursor, or limit | `{total, counts: {happy, hyped, meh, tired, stressed, sad}}` |

### Meta
| method path | auth | out |
|---|---|---|
| GET `/health` | — | `{status: 'ok'}` |
| GET `/faculties` | Bearer | `[{id, slug, nameTh, nameEn, knownMajors}]` |

### Admin (Bearer + admin)
| method path | in | out |
|---|---|---|
| DELETE `/admin/moods/:id` | — | 204; moderation delete protected by `requireAdmin` |

Admin accounts come only from `SEED_ADMIN_EMAILS` in MVP. User search and role management endpoints are out of scope.

### Hardening
- helmet defaults; CORS: dev allow `http://localhost:5173` with credentials, prod same-origin (no CORS needed).
- Rate limit: 30 req/5 min per IP on POST/PATCH/DELETE `/moods` and DELETE `/admin/moods`; 10 req/min on `/auth/refresh`.
- `app.set('trust proxy', 1)` (Cloudflare + Traefik).
- Swagger UI `/api/docs` from zod-to-openapi registry (public in dev; behind admin in prod).

## 6. Validation (shared shapes)

Zod schemas defined once in `server/src/routes/schemas.ts` (shared by route validation and the OpenAPI registry); FE duplicates only composer + onboarding shapes (`client/src/lib/schemas.ts`) for direct Zod form validation:

- `moodType`: `z.enum(['happy','hyped','meh','tired','stressed','sad'])`
- `text`: `z.string().trim().min(1).max(280)` + profanity refine (`lib/profanity.ts`, Thai+English lists, repeat-collapse + leetspeak normalization, boundary-safe English match) — server authoritative, client mirrors for instant feedback
- `major`: `z.string().trim().min(1).max(100)`; server applies NFKC normalization, collapses inner whitespace, and derives `majorNormalized`
- `year`: `z.coerce.number().int().min(1).max(8)`
- `facultyId`: `z.string().refine(isValidObjectId)`
- `mine`: `z.enum(['true','false']).transform(value => value === 'true')` — do not use `z.coerce.boolean()` for query strings
- dates: `z.coerce.date()`; both or either may be supplied, but when both exist require `from < to`

## 7. Frontend Contracts

- Routing: `/` feed, `/onboarding`, `/me`, `/admin`, `/login` (landing). Guards: unauthenticated → `/login`; `!onboarded` → `/onboarding`; `/admin` requires role admin.
- `authStore` (Zustand): `{user, accessToken (memory only), status}`; boot = `POST /auth/refresh` (cookie) → hydrate.
- axios instance: attaches Bearer; response interceptor on 401 `TOKEN_EXPIRED` → single-flight refresh → replay queued requests; refresh fail → call idempotent `/auth/logout`, clear client state, then navigate to `/login`.
- `filterStore`: `{faculty, major, moodType, from, to}` synced to URL search params (shareable filter links).
- TanStack Query owns feed/stats server state. Feed uses an infinite query keyed by normalized filters; stats refetch on filter change + after own post.

## 8. Seed (`server/src/scripts/seed.ts`)

- Idempotent upsert by slug.
- Faculties (best-effort public list — verify/adjust in seed file, not here):
  Engineering (วิศวกรรมศาสตร์), Architecture Art & Design (สถาปัตยกรรมฯ), Science (วิทยาศาสตร์), Industrial Education & Technology (ครุศาสตร์อุตสาหกรรมฯ), Agricultural Technology (เทคโนโลยีการเกษตร), Food Industry (อุตสาหกรรมอาหาร), Information Technology (เทคโนโลยีสารสนเทศ), KMITL Business School (บริหารธุรกิจ), Liberal Arts (ศิลปศาสตร์), Medicine (แพทยศาสตร์), Dentistry (ทันตแพทยศาสตร์), Nursing (พยาบาลศาสตร์), International Academy of Aviation Industry (วิทยาลัยอุตสาหกรรมการบินนานาชาติ), Advanced Manufacturing Innovation (วิทยาลัยนวัตกรรมการผลิตขั้นสูง), Music Science & Engineering (วิทยาลัยวิศวกรรมสังคีต), Prince of Chumphon Campus (วิทยาเขตชุมพร)
- `knownMajors` seeded where confidently known (e.g. Engineering: Computer, Electrical, Mechanical, Civil, Chemical, Telecom/ECE, Software (SIIE), Robotics & AI, ...); free-entry majors remain user data and never mutate this seed-managed list.
- Admin allowlist: auth callback assigns `role=admin` to verified emails in `SEED_ADMIN_EMAILS`; the idempotent seed updates matching users that already exist but never creates incomplete User documents.

## 9. Testing Requirements

Server (must pass before any phase is "done" in PLAN.md):
- Auth: JWKS-mocked callback happy path; allowlisted email receives admin role; state mismatch → 400; nonce mismatch → 400; refresh rotation; two concurrent refreshes yield exactly one success and the loser has no `Set-Cookie`; replayed refresh → 401; expired/unknown refresh clears cookie; expired access → `TOKEN_EXPIRED`.
- RBAC matrix: user PATCH/DELETE other's mood → 403; admin `DELETE /admin/moods/:id` → 204; admin route as user → 403.
- Moods: create denormalizes faculty/major/majorNormalized/year; `mine=true` returns only the caller's posts; serializer never contains `author`/`email`/`studentId`/`displayName`/`majorNormalized` (assert on raw JSON); validation edges (empty text, 281 chars, bad moodType).
- Pagination: stable order across pages, no dup/skip at boundary timestamps; invalid cursor → 400.
- Filters/stats: major normalization matches canonical and case variants; half-open UTC ranges match Asia/Bangkok date selections; counts match seeded fixtures under each filter.

Client (light): filterStore URL sync; interceptor single-flight refresh.

Manual E2E before submission: real SSO login, onboarding, post/edit/delete, My Moods, filters, admin moderation, mobile viewport.

## 10. Deployment (Dokploy @ 49.228.32.83, https://saig.ikrt.dev)

- **Dockerfile** multi-stage: `npm ci` → build client → build server → runtime `node:22-slim`, copies `server/dist` + `client/dist`; Express serves static + SPA fallback (`GET *` → index.html, excluding `/api`). Single origin.
- Dokploy project **SAIG**: application (this repo, Dockerfile build) + MongoDB service; `MONGODB_URI` via internal network. All env via Dokploy, secrets never in image.
- Domain `saig.ikrt.dev`: Cloudflare DNS → server; Traefik routes host → container :3000. Cloudflare SSL mode Full (strict) with Traefik LE cert, or Full with CF origin routing — verify handshake at deploy time.
- Prod env: `NODE_ENV=production`, `APP_URL=https://saig.ikrt.dev`, `OIDC_REDIRECT_URI=https://saig.ikrt.dev/api/auth/callback`, cookies `Secure`.
- SSO client (console/sso/28) registered redirect URIs: `http://localhost:3000`, `http://localhost:3000/api/auth/callback`, `https://saig.ikrt.dev/api/auth/callback` ✓ (already configured).

## 11. Commands

```bash
npm run dev              # concurrently: client :5173 + server :3000
docker compose up -d     # dev MongoDB
npm run seed -w server
npm run test -w server   # single file: npm run test -w server -- moods.test.ts
npm run test -w client
npm run build            # both workspaces
# lint: deferred — eslint config creation blocked by config-protection hook
```
