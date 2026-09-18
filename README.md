# MergeSpace

**MergeSpace** is a shared coding workspace for teams that want to write, review, and experiment with code together in real time. Create a private workspace, invite collaborators, and work in the same files without overwriting one another's changes. The app combines a polished browser editor with a persistent backend, so a session can continue across refreshes and reconnects.

## What it does

MergeSpace gives each team a secure place to organize small web projects and collaborate live. Workspace owners can create and manage spaces, invite people by email, assign roles, and control access. Members can edit shared files together, see who is currently active, switch between files, and preview their HTML/CSS/JavaScript as they work.

## Features

- **Live, conflict-free editing** — Yjs CRDT synchronization keeps concurrent changes in sync across every connected editor.
- **Persistent collaboration sessions** — Yjs room data is retained by the Socket.IO server, helping users resume work after reconnecting or restarting the container.
- **Team workspaces** — Create, rename, and remove dedicated spaces for different projects or groups.
- **Secure access and invitations** — Sign in with email/password, email code, Google, or GitHub (when enabled); invite collaborators by email and let them accept or decline.
- **Role-based permissions** — Workspace owners manage settings, people, roles, and files; editors can collaborate within the workspace.
- **Multi-file project editor** — Create, select, save, and delete HTML, CSS, and JavaScript files from one workspace.
- **Developer-friendly editor** — Monaco Editor provides syntax-aware editing, snippets, suggestions, keyboard saving, and a dark coding experience.
- **Live presence** — See active collaborators and connection status while you work.
- **Instant preview** — Open a browser preview to check HTML, CSS, and JavaScript output without leaving the workspace.
- **Reliable file updates** — Files are saved to InsForge and file-tab changes are broadcast to workspace members.

## Tech stack

| Area | Technology |
| --- | --- |
| Frontend | React 19, Vite, CSS |
| Code editor | Monaco Editor, `@monaco-editor/react` |
| Real-time editing | Yjs, y-monaco, y-socket.io |
| Real-time transport & presence | Socket.IO |
| Server | Node.js, Express 5 |
| Backend platform | InsForge — Auth, PostgreSQL database, realtime events, and row-level access control |
| Deployment | Docker, Docker Compose |

## Run MergeSpace locally

### Prerequisites

- Node.js 20 or newer
- An InsForge project
- Docker and Docker Compose (optional, for containerized use)

### 1. Configure InsForge

Link the repository to an InsForge project and apply the included database migrations:

```bash
npx @insforge/cli login
npx @insforge/cli link --project-id <your-project-id>
npx @insforge/cli db migrations up --all
```

Enable the authentication methods you plan to use in InsForge. For local development, include `http://localhost:5173` in the allowed redirect URLs. Google and GitHub sign-in also require their corresponding providers to be configured in InsForge.

### 2. Add environment variables

Create `Frontend/vite-project/.env.local` and add your InsForge project URL and anonymous key:

```env
VITE_INSFORGE_BASE_URL=https://your-project.insforge.app
VITE_INSFORGE_ANON_KEY=your-anon-key
```

Keep this file private—never commit keys to the repository.

### 3. Start the app

Install the dependencies for the root scripts, frontend, and realtime server, then launch both services:

```bash
npm install
npm --prefix Frontend/vite-project install
npm --prefix backend install
npm run dev
```

Open `http://localhost:5173`. The Vite client connects to the Socket.IO server at `http://localhost:3000` during local development.

## Use with Docker

Place the same InsForge values in a root `.env` file:

```env
VITE_INSFORGE_BASE_URL=https://your-project.insforge.app
VITE_INSFORGE_ANON_KEY=your-anon-key
MERGESPACE_PORT=3002
```

Then build and start the single-container application:

```bash
docker compose up --build
```

Visit `http://localhost:3002`. Docker stores Yjs collaboration data in a named volume so live-document state survives container recreation.

## How to use it

1. Open MergeSpace and create an account or sign in.
2. Create a workspace from the dashboard.
3. Open the workspace editor and add the files your project needs.
4. Invite collaborators from **Workspace settings** and choose their role.
5. Work in the same files at the same time—edits sync live and the active-user indicator shows who is online.
6. Toggle the preview when working with HTML, CSS, and JavaScript, then save with the button or `Ctrl/Cmd + S`.

## Project structure

```text
Frontend/vite-project/  React + Vite application and editor UI
backend/                Express, Socket.IO, and Yjs collaboration server
migrations/             InsForge PostgreSQL schema, policies, and RPC functions
Dockerfile              Production single-image build
docker-compose.yml      Local container orchestration
```

---

MergeSpace turns a browser tab into a shared, permission-aware coding room—built for the moments when working together matters more than passing files around.
