# SPECS.md — Mood of the Major

Authoritative technical contract. If code and this file disagree, fix one of them — never let them drift. Design rationale lives in `DESIGN.md`; execution status in `PLAN.md`.

## 1. Stack & Layout

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript, Vite, Tailwind CSS, shadcn/ui, Framer Motion, Zustand, React Hook Form + Zod, axios |
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
└─ Dockerfile              multi-stage prod build (see §9)
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

Env parsed and validated with Zod at boot (`config/env.ts`); crash fast on missing vars. `.env.example` mirrors this table.

## 3. Data Model (Mongoose)

### User
| field | type | rules |
|---|---|---|
| email | string | unique, lowercase, `/^[^@]+@kmitl\.ac\.th$/` |
| studentId | string | derived: email local part |
| displayName | string | from SSO `name`; internal only |
| faculty | ObjectId → Faculty | required after onboarding |
| major | string | trimmed, collapsed whitespace; 1–100 chars |
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
| year | number | denormalized |
| timestamps | | `createdAt` = cursor + date filter |

Indexes: `{faculty:1, createdAt:-1}`, `{moodType:1, createdAt:-1}`, `{author:1, createdAt:-1}`.

### Faculty
| field | type |
|---|---|
| nameTh / nameEn | string |
| slug | string, unique |
| knownMajors | string[] — seed + appended on onboarding (case-insensitive dedupe) |

### RefreshToken
| field | type |
|---|---|
| user | ObjectId → User, indexed |
| tokenHash | sha256 of token |
| family | uuid — rotation chain id |
| expiresAt | Date (TTL index) |
| revokedAt | Date? |

## 4. Auth

### Flow
1. `GET /api/auth/login` → set `state` + PKCE verifier in short-lived (5 min) httpOnly cookie → 302 to Keycloak authorize (`response_type=code`, `scope=openid profile email`).
2. `GET /api/auth/callback?code&state` → verify state → token exchange (code + client_secret + PKCE) → verify `id_token` via issuer JWKS (`jose`) → extract `email`, `name`.
3. Upsert User by email. Issue tokens (below). 302 → `APP_URL` (`/onboarding` if `!onboarded`, else `/`).
4. FE calls `GET /api/auth/me` on load.

### Tokens
- **Access:** JWT HS256, TTL 15 min, claims `{sub: userId, role, onboarded, iat, exp}`. Sent in JSON body of `/refresh` + `/me` bootstrap; FE stores in memory only; sent as `Authorization: Bearer`.
- **Refresh:** 256-bit random, TTL 15 days **sliding** (each rotation issues fresh 15-day expiry). Cookie: `httpOnly; SameSite=Lax; Path=/api/auth; Secure` (prod). DB stores sha256 hash + family.
- **Rotation:** every `POST /api/auth/refresh` invalidates the presented token and issues a new one in the same family. **Reuse detection:** presenting a revoked/unknown token of a known family → revoke entire family (all sessions of that chain), 401.
- `POST /api/auth/logout` → revoke family, clear cookie, return Keycloak logout URL (`id_token_hint`, `post_logout_redirect_uri=APP_URL`) for FE to redirect to.

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
| GET `/auth/callback` | — | `?code&state` | 302 APP_URL |
| POST `/auth/refresh` | refresh cookie | — | `{accessToken, user}` |
| POST `/auth/logout` | refresh cookie | — | `{logoutUrl}` |
| GET `/auth/me` | Bearer | — | `{user}` (id, email, studentId, faculty{...}, major, year, role, onboarded) |
| PATCH `/auth/onboarding` | Bearer | `{facultyId, major, year}` | `{user}` — sets `onboarded=true`, appends major to faculty.knownMajors |

### Moods
| method path | auth | in | out |
|---|---|---|---|
| GET `/moods` | Bearer+onboarded | query: `faculty?` (slug), `major?`, `moodType?`, `from?` `to?` (ISO date), `cursor?`, `limit?` (1–50, default 20) | `{items: MoodPublic[], nextCursor: string \| null}` |
| POST `/moods` | Bearer+onboarded | `{moodType, text}` | `MoodPublic` (201) |
| PATCH `/moods/:id` | Bearer+onboarded, owner | `{moodType?, text?}` | `MoodPublic` |
| DELETE `/moods/:id` | Bearer+onboarded, owner **or admin** | — | 204 |

**MoodPublic** (the ONLY mood serializer): `{id, moodType, text, faculty: {slug, nameTh, nameEn}, major, year, createdAt, updatedAt, isMine}`. No author fields — anonymity invariant.

**Cursor:** base64url of `{createdAt, id}`; query uses `$or [{createdAt: {$lt}}, {createdAt: eq, _id: {$lt}}]`, sort `{createdAt:-1, _id:-1}`. Invalid cursor → 400.

### Stats
| method path | auth | in | out |
|---|---|---|---|
| GET `/stats/overview` | Bearer+onboarded | same filter params as GET /moods (no cursor/limit) | `{total, counts: {happy, hyped, meh, tired, stressed, sad}}` |

### Meta
| method path | auth | out |
|---|---|---|
| GET `/faculties` | Bearer | `[{id, slug, nameTh, nameEn, knownMajors}]` |

### Admin (Bearer + admin)
| method path | in | out |
|---|---|---|
| GET `/admin/users` | `?search&cursor&limit` (search: email/studentId/major prefix) | `{items: [{id, email, studentId, displayName, faculty, major, year, role, createdAt}], nextCursor}` |
| PATCH `/admin/users/:id/role` | `{role: 'user'\|'admin'}` | updated user; cannot demote self |

Moderation delete = `DELETE /moods/:id` as admin.

### Hardening
- helmet defaults; CORS: dev allow `http://localhost:5173` with credentials, prod same-origin (no CORS needed).
- Rate limit: 30 req/5 min per IP on POST/PATCH/DELETE `/moods`; 10 req/min on `/auth/refresh`.
- `app.set('trust proxy', 1)` (Cloudflare + Traefik).
- Swagger UI `/api/docs` from zod-to-openapi registry (public in dev; behind admin in prod).

## 6. Validation (shared shapes)

Zod schemas defined once per route in `server/src/routes/*.schemas.ts`; FE duplicates only composer + onboarding shapes (`client/src/lib/schemas.ts`) for RHF:

- `moodType`: `z.enum(['happy','hyped','meh','tired','stressed','sad'])`
- `text`: `z.string().trim().min(1).max(280)`
- `major`: `z.string().trim().min(1).max(100)` (server also collapses inner whitespace)
- `year`: `z.coerce.number().int().min(1).max(8)`
- `facultyId`: `z.string().refine(isValidObjectId)`
- dates: `z.coerce.date()`; `from <= to` refinement

## 7. Frontend Contracts

- Routing: `/` feed, `/onboarding`, `/me`, `/admin`, `/login` (landing). Guards: unauthenticated → `/login`; `!onboarded` → `/onboarding`; `/admin` requires role admin.
- `authStore` (Zustand): `{user, accessToken (memory only), status}`; boot = `POST /auth/refresh` (cookie) → hydrate.
- axios instance: attaches Bearer; response interceptor on 401 `TOKEN_EXPIRED` → single-flight refresh → replay queued requests; refresh fail → logout to `/login`.
- `filterStore`: `{faculty, major, moodType, from, to}` synced to URL search params (shareable filter links).
- Feed data: infinite query keyed by filters; stats refetch on filter change + after own post.

## 8. Seed (`server/src/scripts/seed.ts`)

- Idempotent upsert by slug.
- Faculties (best-effort public list — verify/adjust in seed file, not here):
  Engineering (วิศวกรรมศาสตร์), Architecture Art & Design (สถาปัตยกรรมฯ), Science (วิทยาศาสตร์), Industrial Education & Technology (ครุศาสตร์อุตสาหกรรมฯ), Agricultural Technology (เทคโนโลยีการเกษตร), Food Industry (อุตสาหกรรมอาหาร), Information Technology (เทคโนโลยีสารสนเทศ), KMITL Business School (บริหารธุรกิจ), Liberal Arts (ศิลปศาสตร์), Medicine (แพทยศาสตร์), Dentistry (ทันตแพทยศาสตร์), Nursing (พยาบาลศาสตร์), International Academy of Aviation Industry (วิทยาลัยอุตสาหกรรมการบินนานาชาติ), Advanced Manufacturing Innovation (วิทยาลัยนวัตกรรมการผลิตขั้นสูง), Music Science & Engineering (วิทยาลัยวิศวกรรมสังคีต), Prince of Chumphon Campus (วิทยาเขตชุมพร)
- `knownMajors` seeded where confidently known (e.g. Engineering: Computer, Electrical, Mechanical, Civil, Chemical, Telecom/ECE, Software (SIIE), Robotics & AI, ...); combobox fills gaps organically.
- Admin bootstrap: `SEED_ADMIN_EMAILS` env (comma-separated) → upsert role=admin.

## 9. Testing Requirements

Server (must pass before any phase is "done" in PLAN.md):
- Auth: JWKS-mocked callback happy path; state mismatch → 400; refresh rotation; **reuse → family revoked**; expired access → `TOKEN_EXPIRED`.
- RBAC matrix: user PATCH/DELETE other's mood → 403; admin DELETE any → 204; admin routes as user → 403; self-demote → 400/403.
- Moods: create denormalizes faculty/major/year; serializer never contains `author`/`email` (assert on raw JSON); validation edges (empty text, 281 chars, bad moodType).
- Pagination: stable order across pages, no dup/skip at boundary timestamps; invalid cursor → 400.
- Stats: counts match seeded fixtures under each filter.

Client (light): filterStore URL sync; interceptor single-flight refresh.

Manual E2E before submission: real SSO login, onboarding, post/edit/delete, filters, admin moderation, mobile viewport.

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
npm run lint             # eslint both
```
