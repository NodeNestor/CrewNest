# CrewNest

Where your crew of AI agents nests (persists). A lightweight orchestration dashboard for managing persistent AI engineers powered by the [NodeNestor](https://github.com/NodeNestor) stack.

CrewNest is a thin orchestration layer — not a monolith. It composes three existing tools:

- **[AgentCore](https://github.com/NodeNestor/AgentCore)** — Docker containers with Claude Code, SSH, optional desktop (VNC), auto-memory hooks
- **[HiveMindDB](https://github.com/NodeNestor/HiveMindDB)** — Shared memory, tasks, channels, knowledge graph with built-in embeddings
- **[CodeGate](https://github.com/NodeNestor/CodeGate)** — LLM proxy with 11+ providers, failover, guardrails, PII detection

## What It Does

CrewNest lets you spin up persistent AI engineer containers that:

- Run Claude Code (or other agents) in isolated Docker environments
- Share memory and coordinate tasks through HiveMindDB
- Route LLM calls through CodeGate for provider flexibility and guardrails
- Have optional GUI desktops accessible via browser (noVNC)
- Clone and push to GitHub repos automatically

You manage everything from a single web dashboard at `http://localhost:3000`.

## Architecture

```
 Browser (:3000)
    │
    ▼
┌──────────────────────────────────────────┐
│  CrewNest Dashboard (Hono + React)       │
│  ┌───────────┐  ┌─────────────────────┐  │
│  │ Web UI    │  │ Orchestrator        │  │
│  │ 6 pages   │  │ (Claude MCP tools)  │  │
│  └───────────┘  └─────────────────────┘  │
│         │  Docker API  │  HTTP           │
└─────────┼──────────────┼─────────────────┘
          │              │
    ┌─────▼─────┐   ┌───▼──────────┐   ┌───────────┐
    │ AgentCore │   │  HiveMindDB  │   │  CodeGate  │
    │ containers│   │  :8100       │   │  :9211/12  │
    │ (dynamic) │◄──┤  memory      │   │  LLM proxy │
    └───────────┘   │  tasks       │   └────────────┘
                    │  agents      │
                    └──────────────┘
```

## Prerequisites

1. **Docker** with Docker Compose
2. **AgentCore images** built locally:
   ```bash
   git clone https://github.com/NodeNestor/AgentCore
   cd AgentCore
   docker build -t agentcore:minimal -f dockerfiles/Dockerfile.minimal .
   docker build -t agentcore:ubuntu -f dockerfiles/Dockerfile.ubuntu .   # optional: desktop support
   docker build -t agentcore:kali -f dockerfiles/Dockerfile.kali .       # optional: security tools
   ```
3. **HiveMindDB** running (for shared memory/tasks):
   ```bash
   git clone https://github.com/NodeNestor/HiveMindDB
   cd HiveMindDB && docker compose up -d
   ```
4. **CodeGate** running (for LLM routing):
   ```bash
   git clone https://github.com/NodeNestor/CodeGate
   cd CodeGate && docker compose up -d
   ```

## Quick Start

```bash
# Clone
git clone https://github.com/NodeNestor/CrewNest
cd CrewNest

# Configure
cp .env.example .env
# Edit .env — add your GITHUB_TOKEN and CODEGATE_API_KEY

# Start
docker compose up -d

# Open
open http://localhost:3000
```

The dashboard auto-creates an orchestrator engineer on first visit. Click **Start** to launch it.

## Pages

### Command Center (`/`)
The main workspace. Select an engineer from the dropdown, view its terminal, desktop (if VNC-enabled), or split view. Start/stop engineers directly from the toolbar.

### Engineers (`/engineers`)
Card grid of all engineers. Create new ones with the image picker (Minimal, Ubuntu Desktop, Kali). Ports are auto-allocated. Click a card to see details, terminal, desktop, or logs.

### Projects (`/projects`)
Manage projects with GitHub repo associations. Each project can have repos (push/pull mode), a CLAUDE.md that gets injected into engineers, and environment variables.

### Settings (`/settings`)
Configure service URLs (HiveMindDB, CodeGate), API keys, and manage credentials (GitHub tokens, SSH keys) that get injected into engineers.

### Memory (`/memory`)
Search HiveMindDB memories across all engineers. View agent registrations and tasks.

### Immersive View (`/engineer/:id`)
Fullscreen view of a single engineer — terminal, desktop, or side-by-side split. No sidebar, maximum screen space.

## Engineer Images

| Image | Description | Desktop | Use Case |
|---|---|---|---|
| `agentcore:minimal` | Claude Code only | No | Coding, research, CLI tasks |
| `agentcore:ubuntu` | Full Ubuntu + Chrome + VNC | Yes | Web scraping, GUI testing, browser automation |
| `agentcore:kali` | Kali Linux + security tools | Yes | Security research, pentesting |

When creating an engineer with a desktop image, VNC is auto-enabled and ports are allocated automatically.

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `GITHUB_TOKEN` | GitHub PAT for repo access | — |
| `CODEGATE_API_KEY` | CodeGate API key | — |
| `CODEGATE_URL` | CodeGate endpoint | `http://host.docker.internal:9212` |
| `HIVEMINDDB_URL` | HiveMindDB endpoint | `http://host.docker.internal:8100` |
| `DOCKER_NETWORK` | Docker network for engineers | `crewnest-network` |
| `DEFAULT_MODEL` | Default LLM model | `claude-sonnet-4-20250514` |
| `DB_PATH` | SQLite database path | `/data/crewnest.db` |

## Terminal Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+C` | Copy selection |
| `Ctrl+Shift+V` | Paste from clipboard |
| Right-click | Paste from clipboard |
| Mouse wheel | Scroll (tmux mouse mode auto-enabled) |

## How Engineers Work

When you start an engineer, CrewNest:

1. Creates a Docker container from the selected AgentCore image
2. Attaches it to the `crewnest-network` so it can reach HiveMindDB and CodeGate
3. Injects environment variables (agent ID, HiveMindDB URL, CodeGate URL, GitHub token, project repos)
4. AgentCore's entrypoint modules handle the rest:
   - SSH daemon starts
   - Desktop environment starts (if enabled)
   - HiveMindDB memory hooks are installed
   - CodeGate LLM routing is configured
   - Repos are cloned
   - Claude Code launches in a tmux session
5. The orchestrator engineer additionally gets a CrewNest MCP server injected, giving Claude Code tools to manage the platform

## MCP Tools (Orchestrator)

The orchestrator Claude Code instance gets 11 MCP tools for platform control:

| Tool | Description |
|---|---|
| `crewnest_list_engineers` | List all engineers with status |
| `crewnest_start_engineer` | Start an engineer container |
| `crewnest_stop_engineer` | Stop an engineer container |
| `crewnest_create_engineer` | Create a new engineer |
| `crewnest_list_projects` | List all projects |
| `crewnest_create_project` | Create a new project |
| `crewnest_create_task` | Create a HiveMindDB task |
| `crewnest_list_tasks` | List tasks |
| `crewnest_search_memory` | Search HiveMindDB memories |
| `crewnest_platform_status` | Get platform health status |
| `crewnest_get_engineer_logs` | Get engineer container logs |

## Tech Stack

| Component | Technology |
|---|---|
| Backend | Hono (TypeScript) |
| Frontend | React 18 + Vite + Tailwind CSS |
| Database | SQLite (sql.js, 5 tables) |
| Docker | dockerode |
| Terminal | xterm.js + WebSocket |
| VNC | noVNC (iframe) |
| Icons | Lucide React |

## Development

```bash
cd dashboard
npm install
npm run dev    # Vite dev server (frontend only, needs backend running)
```

For full-stack development, the dashboard Docker container runs both the Hono API server and serves the Vite-built frontend.

## Project Structure

```
CrewNest/
├── dashboard/
│   ├── Dockerfile
│   ├── src/
│   │   ├── server/           # Hono API
│   │   │   ├── index.ts      # App entry, routes, SPA serving
│   │   │   ├── db.ts         # SQLite: projects, engineers, chat, settings, credentials
│   │   │   ├── docker.ts     # Container management, MCP injection
│   │   │   ├── terminal.ts   # WebSocket terminal proxy
│   │   │   ├── orchestrator.ts
│   │   │   ├── crewnest-mcp.cjs  # MCP server for orchestrator
│   │   │   └── routes/
│   │   │       ├── engineers.ts
│   │   │       ├── projects.ts
│   │   │       ├── chat.ts
│   │   │       ├── settings.ts
│   │   │       └── hivemind.ts
│   │   └── client/           # React frontend
│   │       ├── App.tsx
│   │       ├── pages/
│   │       │   ├── CommandCenter.tsx
│   │       │   ├── Engineers.tsx
│   │       │   ├── Projects.tsx
│   │       │   ├── Settings.tsx
│   │       │   ├── Memory.tsx
│   │       │   └── ImmersiveView.tsx
│   │       ├── components/
│   │       │   ├── Terminal.tsx
│   │       │   ├── VncViewer.tsx
│   │       │   ├── ResizableSplit.tsx
│   │       │   ├── EngineerCard.tsx
│   │       │   ├── StatusBar.tsx
│   │       │   └── Sidebar.tsx
│   │       └── lib/
│   │           └── api.ts
│   └── package.json
├── docker-compose.yml
├── .env.example
└── CLAUDE.md
```

## License

MIT
