# MergeSpace

MergeSpace is a collaborative coding workspace for teams to build, review and experiment with code together in real-time. Create a workspace, invite collaborators and work on shared files simultaneously without overwriting each other's work.

## Live Demo

Give MergeSpace a try at this [live demo](https://mergespace.insforge.site). Create a workspace, invite collaborators and start coding in real-time!

## 🧠 Core Architecture & Real-Time Engine

- Conflict-Free Real-Time Editing: Built-in Yjs CRDT (Conflict-free Replicated Data Type) primitives used with Monaco Editor for sub-millisecond text synchronization and to prevent document state divergence among multiple users
- Persistent Session State: Built internal server-side Yjs room state pipeline backed by Socket.IO and stores active workspace session states, cursor positions and document histories to persist across network reconnections
- Granular Security & Row-Level Authorization: Custom built InsForge PostgreSQL Row-Level Security (RLS) policies and Remote Procedure Calls (RPC) to enforce strict workspace boundary isolation, tokenized email invitations and owner/editor permissions
- Live Collaborative Telemetry: Built-in Socket.IO presence channels and y-monaco awareness wrappers for rendering active user badges, selection highlights and real-time cursor indicators to active project files
- Automated Web Preview Pipeline: Built a sandboxed web preview runner inside React client capable of dynamically bundling and executing HTML, CSS and JavaScript files in memory

## 🛠️ Tech Stack & Keywords

- Frontend: React 19, Vite, Monaco Editor (`@monaco-editor/react`), CSS, Context API
- Real-Time Layer: Yjs, `y-monaco`, `y-socket.io`, Socket.IO Client
- Backend: Node.js, Express 5, Socket.IO Server
- Platform & Security: InsForge (PostgreSQL, Auth, Realtime Engine, Row-Level Security)
- Deployment & Infrastructure: Docker, Docker Compose, Linux/Node Containers

## 📋 Features

- Team Workspaces: Create, isolate, rename, and manage dedicated project environments
- Secure Authentication: Multi-provider authentication supporting Email/Password, Magic Link Code, Google, and GitHub OAuth
- Role-Based Access Control (RBAC): Workspace owners manage administrative configurations, member access and permissions while editors can contribute live within allowed boundaries
- Multi-File Workspace Management: Fullfilesystem operations (create, update, delete, rename) of web standard formats (`.html`, `.css`, `.js`)
- Developer-Grade Editor: Syntax highlighting, inline autocomplete, keyboard shortcuts (`Ctrl/Cmd + S`) and dark theme powered by VS Code's Monaco Editor
- Instant Preview: Live single-click web rendering of active multi-file code execution outside of workspace

## 🚀 Usage

1. Open the [MergeSpace live demo](https://mergespace.insforge.site).
2. Sign in or create an account.
3. Create a workspace from the dashboard.
4. Add project files (`.html`, `.css`, `.js`) and invite team members from Workspace Settings.
5. Edit code collaboratively in real-time and toggle the live preview to verify changes.

## 🏗️ Project Architecture

```text
+------------------------------+
|    Browser Client    |
| (React 19 + Monaco Editor) |
+--------------+---------------+
|
+------------------------+------------------------+
|                         |
v (WebSocket / Socket.IO)             v (HTTP / REST / RLS)
+------------------------------+         +------------------------------+
|  Node.js & Express Server  |         |    InsForge Backend    |
| (Yjs Sync & Room Provider) |         | (PostgreSQL, Auth & Storage) |
+--------------+---------------+         +------------------------------+
|
v
+------------------------------+
|  Persistent Yjs Memory   |
| (Session & Document State) |
+------------------------------+

📁 Repository Structure
Plaintext
├── Frontend/vite-project/  # React 19 SPA, Monaco Editor UI, InsForge SDK integration
├── backend/                # Express 5 server, Socket.IO transport, Yjs CRDT room provider
├── migrations/             # PostgreSQL database schema, RLS policies, and RPC functions
├── Dockerfile              # Multi-stage production container build
└── docker-compose.yml      # Container orchestration and volume bindings