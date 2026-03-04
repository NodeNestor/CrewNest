import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import Dockerode from 'dockerode';
import { getEngineer } from './db.js';

const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });

export function setupTerminalWebSocket(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url!, `http://${request.headers.host}`);

    // Match /api/engineers/:id/terminal
    const match = url.pathname.match(/^\/api\/engineers\/([^/]+)\/terminal$/);
    if (!match) {
      // Not a terminal request — let other upgrade handlers deal with it
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      handleTerminalConnection(ws, match[1]);
    });
  });
}

async function handleTerminalConnection(ws: WebSocket, engineerId: string) {
  try {
    const engineer = getEngineer(engineerId);
    if (!engineer) {
      ws.send('\r\n\x1b[31mError: Engineer not found\x1b[0m\r\n');
      ws.close();
      return;
    }

    const containerName = `crewnest-${engineer.name}`;
    let container: Dockerode.Container;

    try {
      container = docker.getContainer(containerName);
      const info = await container.inspect();
      if (!info.State.Running) {
        ws.send('\r\n\x1b[33mContainer is not running. Start the engineer first.\x1b[0m\r\n');
        ws.close();
        return;
      }
    } catch {
      ws.send('\r\n\x1b[33mContainer not found. Start the engineer first.\x1b[0m\r\n');
      ws.close();
      return;
    }

    // Create exec instance — attach to agent tmux session if available, else bash
    const exec = await container.exec({
      Cmd: ['/bin/sh', '-c', 'command -v tmux >/dev/null && (tmux attach -t agent 2>/dev/null || tmux attach -t main 2>/dev/null || tmux new -s terminal 2>/dev/null) || /bin/bash'],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      User: 'agent',
    });

    const stream = await exec.start({ hijack: true, stdin: true, Tty: true });

    ws.send('\x1b[32mConnected to ' + engineer.name + '\x1b[0m\r\n');

    // Enable tmux mouse mode for scrolling support
    // Small delay to let tmux attach before sending the command
    setTimeout(() => {
      try {
        stream.write('tmux set -g mouse on 2>/dev/null; clear\n');
      } catch { /* ignore */ }
    }, 500);

    // Container → Browser
    stream.on('data', (chunk: Buffer) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(chunk);
      }
    });

    stream.on('end', () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send('\r\n\x1b[33mSession ended.\x1b[0m\r\n');
        ws.close();
      }
    });

    // Browser → Container
    ws.on('message', (data: Buffer | string) => {
      try {
        const msg = typeof data === 'string' ? data : data.toString();

        // Handle resize messages: { type: "resize", cols: N, rows: N }
        if (msg.startsWith('{')) {
          try {
            const parsed = JSON.parse(msg);
            if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
              exec.resize({ h: parsed.rows, w: parsed.cols }).catch(() => {});
              return;
            }
          } catch { /* not JSON, treat as input */ }
        }

        stream.write(data);
      } catch { /* ignore write errors */ }
    });

    ws.on('close', () => {
      stream.end();
    });

    ws.on('error', () => {
      stream.end();
    });

  } catch (err: any) {
    ws.send(`\r\n\x1b[31mError: ${err.message}\x1b[0m\r\n`);
    ws.close();
  }
}
