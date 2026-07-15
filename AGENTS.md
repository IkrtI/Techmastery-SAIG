# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project

**Mood of the Major** — anonymous mood-sharing platform for KMITL students. React + Express + MongoDB, TypeScript throughout. Deadline: 2 August 2026.

## Source-of-Truth Documents — read all three at session start

| File | Holds | Update when |
|---|---|---|
| `DESIGN.md` | product concept, UX, mood palette, motion, architecture decisions + rationale | a design decision changes |
| `SPECS.md` | authoritative technical contract: schemas, API, auth, validation, env, seed, deploy | any contract changes — code and SPECS.md must never drift |
| `PLAN.md` | phased execution plan with checkboxes + log | continuously — tick boxes and append log entries in the same commit as the work |

Do not re-derive decisions these files already make. When the user changes direction, update the relevant file(s) first, then implement.

## Commands

npm workspaces monorepo (`client/` + `server/`) — full list in SPECS.md §11:

```bash
npm run dev            # concurrently: Vite :5173 + Express :3000
docker compose up -d   # local MongoDB
npm run test -w server # single file: npm run test -w server -- moods.test.ts
npm run build          # both workspaces
npm run seed -w server # faculties + admin
```

## Hard Constraints

- **Express must listen on :3000** — KMITL SSO redirect URIs are registered for `http://localhost:3000/api/auth/callback` and `https://saig.ikrt.dev/api/auth/callback`. Changing the port breaks login.
- **Anonymity invariant:** no author-identifying field (`author`, `email`, `studentId`, `displayName`) may ever be serialized into feed/stats responses. Owner affordances only via the server-computed `isMine` flag. Tests assert this on raw JSON.
- **SSO client secret lives in `server/.env` only** (`OIDC_CLIENT_SECRET`). Never commit it; keep `.env.example` current. Managed by the user at developer.kmitl.ac.th/console/sso/28.
- SSO issuer `https://sso.kmitl.ac.th/realms/kmitl` grants only `name`/`email` claims; faculty/major/year are self-reported at onboarding, `studentId` derived from the email local part.
- Mood documents denormalize `faculty/major/year` at post time — intentional, don't "fix" it.
- Pagination is cursor-based (`createdAt` + `_id`), never skip/limit.

## Deployment Context

Production: single container (Express serves built client, same origin) on the user's Dokploy server behind Cloudflare at `https://saig.ikrt.dev`. Dokploy MCP tools are available in-session for deploy operations. Details: SPECS.md §10.
