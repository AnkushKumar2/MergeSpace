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

