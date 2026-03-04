# CrewNest — Development Guide

## What This Is

CrewNest is a Docker orchestration dashboard for persistent AI engineers. It's a thin layer over the NodeNestor stack (AgentCore, HiveMindDB, CodeGate). The entire codebase is in `dashboard/` — one Hono server, one React frontend, one SQLite database.

## Quick Commands

```bash
# Build and run
docker compose up -d --build dashboard

# View logs
docker logs crewnest -f

# Rebuild after code changes
docker compose up -d --build dashboard

# Check running engineers
docker ps --filter name=crewnest-
```

## Architecture

**Backend** (`dashboard/src/server/`):
- `index.ts` — Hono app entry, mounts all routes, serves SPA, proxies HiveMindDB
- `db.ts` — SQLite via sql.js. 5 tables: projects, engineers, chat_messages, settings, credentials. All CRUD helpers exported.
- `docker.ts` — dockerode wrapper. `startEngineer()` creates containers with proper env vars, injects MCP server into orchestrator, auto-accepts Claude Code prompts. `stopEngineer()` stops + removes.
- `terminal.ts` — WebSocket upgrade handler. Connects browser xterm.js to tmux session inside engineer containers via Docker exec.
- `crewnest-mcp.cjs` — CommonJS MCP server (JSON-RPC 2.0 over stdio) injected into orchestrator containers. 11 tools for platform control.
- `routes/engineers.ts` — CRUD + start/stop/restart + auto-port allocation + image tiers endpoint
- `routes/projects.ts` — CRUD with repo management
- `routes/chat.ts` — Claude API chat with tool-use loop
- `routes/settings.ts` — Settings and credentials management
- `routes/hivemind.ts` — HiveMindDB proxy (memory search, agents, tasks)

**Frontend** (`dashboard/src/client/`):
- React 18 + React Router + Tailwind CSS
- `pages/CommandCenter.tsx` — Main workspace: terminal/desktop/split view with engineer selector
- `pages/Engineers.tsx` — Card grid + detail panel with tabs (info/terminal/vnc/logs)
- `pages/ImmersiveView.tsx` — Fullscreen single-engineer view, route `/engineer/:id`
- `pages/Projects.tsx` — Project CRUD with repo editor
- `pages/Settings.tsx` — Service config + credential vault
- `pages/Memory.tsx` — HiveMindDB search interface
- `components/Terminal.tsx` — xterm.js with WebSocket, clipboard addon, tmux mouse mode
- `components/VncViewer.tsx` — noVNC iframe with auto-connect
- `components/ResizableSplit.tsx` — Draggable split pane with iframe overlay during drag
- `components/EngineerCard.tsx` — Status card with start/stop/restart buttons
- `lib/api.ts` — Typed fetch helpers for all endpoints

## Key Patterns

**Engineer lifecycle**: Create (SQLite) → Start (Docker container created, env injected, MCP injected for orchestrator) → Running (terminal/VNC accessible) → Stop (container removed, SQLite row kept)

**Auto-port allocation**: `routes/engineers.ts` `allocatePorts()` scans existing engineers and picks next free ports starting from SSH:2222, API:8081, VNC:6080.

**VNC**: Engineers with VNC-capable images (`agentcore:ubuntu`, `agentcore:kali`) automatically get `ENABLE_DESKTOP=true` env var. AgentCore starts Xvfb + x11vnc + websockify/noVNC. No password (local access only).

**Terminal proxy**: `terminal.ts` upgrades WebSocket at `/api/engineers/:id/terminal`, runs `docker exec` to attach to the `agent` tmux session, streams bidirectional data. Supports resize messages.

**MCP injection**: `docker.ts` `injectCrewNestMcp()` reads `crewnest-mcp.cjs`, base64-encodes it, writes into the container at `/opt/crewnest/mcp-server.cjs`, merges config into `~/.claude.json`.

**Selection state**: CommandCenter uses `useRef` for `selectedId` to avoid stale closures in the 5-second polling interval. The `load` callback reads from `selectedIdRef.current`.

## Database Schema

```sql
projects: id, name, repos (JSON), claude_md, env_vars (JSON)
engineers: id, name, project_id, agent_type, image, role, capabilities (JSON),
           container_id, status, ssh_port, api_port, vnc_port, env_overrides (JSON)
chat_messages: id, role, content, tool_calls (JSON)
settings: key, value
credentials: id, name, type, value, scope, project_id
```

## External Dependencies

- **AgentCore images** must be built locally (`agentcore:minimal`, `agentcore:ubuntu`, `agentcore:kali`)
- **HiveMindDB** at configurable URL (default `http://host.docker.internal:8100`)
- **CodeGate** at configurable URL (default `http://host.docker.internal:9212`)
- **Docker socket** mounted at `/var/run/docker.sock`

## Gotchas

- `crewnest-mcp.cjs` is CommonJS (not ESM) because Claude Code's MCP runner expects it
- The dashboard container name is `crewnest` (not `crewnest-dashboard`) — this is also used by MCP server to reach the API (`http://crewnest:3000`)
- sql.js loads WASM at runtime — the Dockerfile copies `sql-wasm.wasm` to the dist folder
- Auto-accept prompts use separate `docker exec` calls with 500ms delay between Down arrow and Enter to avoid race conditions
- `ENABLE_DESKTOP` must be `true` (string) for AgentCore to start the VNC stack
- noVNC web root is `/usr/share/novnc` on Debian/Ubuntu packages, `/opt/noVNC` for manual installs
