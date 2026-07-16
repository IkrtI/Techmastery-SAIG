# DESIGN.md — Mood of the Major

Product and architecture design. Technical contracts live in `SPECS.md`; execution status in `PLAN.md`.

> **Visual revision (2026-07-16):** the visual language below (calm light "stone" theme, Anuphan-only, emoji moods) is superseded by the dark revision in Claude Design project `6e23f469` ("Mood of the Major.dc.html"), implemented in `client/src/styles/tokens.css` + `ui.css`. Dark-only `#0b0f14` base, `#11161d` surfaces, rose `#f43f5e` CTA, sky `#38bdf8` focus/links, Geist + Geist Mono (Anuphan Thai fallback), moods rendered as colored dots (happy amber / hyped rose / meh slate / tired violet / stressed orange / sad sky), radial glow living background, inline delete confirmation, skeleton loading, mobile bottom nav + filter bottom sheet. Product concept, anonymity rules, and architecture below remain authoritative.

## Concept

Anonymous mood-sharing for KMITL students. Users post how they feel; the feed shows the collective vibe of campus filtered by faculty/major — no identities, only academic context ("Engineering • Y2"). The page itself *feels* the mood: a living background shifts color toward the dominant emotion of whatever you're looking at.

**Design keywords:** calm, minimal, soft, alive. No clutter, no noise, generous whitespace.

## Key Decisions (with rationale)

| Decision | Why |
|---|---|
| KMITL SSO (OIDC) instead of password auth | Verifies control of a KMITL account and removes password liability; `studentId` is derived only from the verified email claim, while faculty/major/year remain self-reported |
| First-party JWT after SSO (not Keycloak tokens in FE) | Full control over session lifetime, refresh rotation bonus, FE never touches Keycloak |
| Fixed 6 mood types (not free-form) | Filterable, statable, colorable — powers the entire visualization layer |
| Anonymity enforced at serialization | Impossible to leak identity by accident; not a UI convention but a server invariant |
| Denormalized faculty/major/year on Mood | Feed/stats filter without joins; a mood is a snapshot at post time |
| Faculty fixed list + seeded major combobox | No authoritative major source exists; free entry is normalized for filtering but never mutates the shared suggestion list |
| Cursor pagination | Stable + fast at hundreds of posts; infinite scroll UX |
| Monorepo (client/ + server/), single container in prod | Clean dev separation, trivial deploy, same-origin cookies |

## Mood System

| mood | emoji | accent | card tint | gradient (living bg) |
|---|---|---|---|---|
| happy | 😊 | `#F5C445` | `#FDF3D8` | warm yellow → soft cream |
| hyped | 🔥 | `#F0885A` | `#FDE4D8` | coral → peach |
| meh | 😑 | `#A8A29E` | `#EEECEA` | gray-beige → warm gray |
| tired | 😴 | `#A78BFA` | `#EFE9FD` | muted lavender → pale lilac |
| stressed | 😰 | `#7C9CBF` | `#E2EAF3` | dusty blue → cool gray |
| sad | 😢 | `#8FA3B8` | `#E7EDF2` | slate blue → mist |

Exact values are Tailwind theme tokens (`mood.happy.accent` etc.) — tune during build, keep the table in sync.

**Living background:** feed page background = one slow radial/linear gradient selected from the dominant mood of the *current filter result* (from `GET /api/stats/overview`). Ties use the fixed mood order in `SPECS.md`; transition ~2.5 s ease. Empty result → neutral base. Distribution-weighted blending is deferred until the core flow is deployed.

**Stats bar:** horizontal 6-segment proportion bar above the feed, same data. Segment click toggles that mood filter. Animated width changes (Framer Motion layout).

## Pages & Flows

1. **Landing/Login** — logo, tagline, "Login with KMITL" button on a slow-drifting soft gradient. Nothing else.
2. **Onboarding** (one-time, forced while `onboarded=false`) — faculty dropdown → major combobox (suggestions = faculty's `knownMajors`, free entry allowed) → year select. Single card, one screen.
3. **Feed** (home) — stats bar → mood cards (infinite scroll) → floating post button. Filter bar: faculty, major, mood, date range; collapses into a drawer on mobile. Living background behind everything.
4. **My Moods** — own posts with edit/delete. Same card style + owner actions.
5. **Admin** — moderation queue showing all posts with delete-any controls. Admin accounts are bootstrapped from environment configuration; user/role management is out of scope.

**Post composer:** dialog (desktop) / bottom sheet (mobile). Emoji row of 6 → selected mood tints the composer → text (280 char counter) → post. Spring bounce on emoji select.

**Mood card:** large emoji, text, badge `faculty.slug • ปี N`, relative time ("5 นาทีที่แล้ว"), card tint by mood. Owner sees ⋯ menu (edit/delete). No names, ever.

## Motion Language (Framer Motion)

- Card enter: fade + 12 px slide-up, stagger 40 ms.
- Mood picker: spring scale on select (stiffness ~400).
- Page transitions: crossfade 200 ms.
- Living background: CSS transition on gradient stops, 2.5 s.
- Respect `prefers-reduced-motion`: disable background drift + staggers.

## Architecture Shape

```
client/  React 19 + TS + Vite + Tailwind + shadcn/ui + Zustand + TanStack Query + RHF/Zod + axios
server/  Express + TS: routes → controllers → services → models (Mongoose)
         middleware: requireAuth, requireOnboarded, requireAdmin, validate(zod)
         config: env parsing (zod), oidc client, db connect
MongoDB  docker compose (dev) / Dokploy service (prod)
```

- Controllers thin, business logic in services, Mongoose only in models/services.
- FE client state: `authStore` (user, access token in memory, refresh orchestration), `filterStore` (feed filters ↔ URL params). TanStack Query owns feed/stats server state and cursor pagination.
- axios interceptor: 401 `TOKEN_EXPIRED` → single-flight refresh → retry queue.

## Out of Scope (decided)

Dark mode, faculty heatmap, KDMC extra claims (faculty from SSO), realtime updates (websocket), i18n framework (UI copy Thai-first, hardcoded), admin user/role management, refresh-token family reuse detection, user-mutated major suggestions, distribution-weighted background blending.
