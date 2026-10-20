# MergeSpace — rules for coding agents
Stack: React 19 + Vite in Frontend/vite-project (src/app/App.jsx, src/app/App.css, src/lib/insforge.js); Node/Express/Socket.IO in backend/; InsForge (Postgres + RLS + realtime).
- App.jsx is ~1,330 lines. NEVER read it whole. Use grep -n and read only ~60-line ranges around the anchor named in the task.
- App.jsx contains a commented-out legacy WorkspaceEditor (roughly lines 344-1050). Ignore it. Edit only the LIVE `function WorkspaceEditor` that comes AFTER the closing `*/`.
- New UI goes in new files under Frontend/vite-project/src/components, src/hooks, src/lib. Only make small, targeted edits to App.jsx.
- Do not edit backend/public (build output), migrations already in the repo, or anything outside the task.
- Do not run npm install, build, lint or tests, do not deploy, do not run migrations, do not commit. The user does those.
- Roles: owner and editor are both allowed to chat. File create/delete/rename stays owner-only; never change that.
- Render user text as plain text only. Never use dangerouslySetInnerHTML.
- Keep the existing look: dark editor, coral accent var(--coral), fonts DM Sans / IBM Plex Mono.
- Finish by replying in at most 8 lines: files changed + anything you could not do. No long explanations.

<!-- INSFORGE:START -->
## InsForge backend

This project uses [InsForge](https://insforge.dev): an all-in-one, open-source Postgres-based backend (BaaS) that gives this app a database, authentication, file storage, edge functions, realtime, an AI model gateway, and payments through one platform.

- **Project:** **mergespace-dev** (API base `https://ic6fhk9t.us-east.insforge.app`)
- **Skills:** these InsForge skills are installed for supported coding agents. Reach for them before implementing any InsForge feature instead of guessing the API:
  - `insforge`: app code with the `@insforge/sdk` client (database CRUD, auth, storage, edge functions, realtime, AI, email, and Stripe payments).
  - `insforge-cli`: backend and infrastructure via the `insforge` CLI (projects, SQL, migrations, RLS policies, storage buckets, functions, secrets, payment setup, schedules, deploys).
  - `insforge-debug`: diagnosing failures (SDK/HTTP errors, RLS denials, auth and OAuth issues) and running security or performance audits.
  - `insforge-integrations`: wiring external auth providers (Clerk, Auth0, WorkOS, Better Auth, etc.) for JWT-based RLS, or the OKX x402 payment facilitator.
  - `find-skills`: discovering additional skills on demand.
- **Credentials:** app code reads keys from `.env.local`; the CLI reads `.insforge/project.json`. Never hardcode or commit keys.

Key patterns:

- Database inserts take an array: `insert([{ ... }])`.
- Reference users with `auth.users(id)`; use `auth.uid()` in RLS policies.
- For storage uploads, persist both the returned `url` and `key`.
<!-- INSFORGE:END -->
