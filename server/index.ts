/**
 * AEGIS-MONITOR server.
 *
 *   plant simulator -> fieldbus decode -> alarm engine -> history
 *                                              |
 *                         WebSocket /ws (1 Hz frames) + REST /api/v1
 *
 * The data source is the bundled plant simulator (see simulator/plant.ts);
 * swapping it for a real acquisition layer does not change anything
 * downstream of `acquire()`.
 */
import http from 'node:http';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createApi } from './api';
import { MonitorRuntime } from './runtime';

const PORT = Number(process.env.PORT) || 3001;
const TICK_MS = Number(process.env.TICK_MS) || 1000;
const BACKFILL_S = Number(process.env.BACKFILL_S ?? 900);
const SEED = Number(process.env.SIM_SEED) || Date.now() % 2 ** 31;

const startedAt = Date.now();
const runtime = new MonitorRuntime({ seed: SEED, now: startedAt - BACKFILL_S * 1000 });
runtime.backfill(BACKFILL_S, startedAt);

const app = express();
app.disable('x-powered-by');
app.use('/api/v1', createApi(runtime, startedAt));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const alive = new WeakSet<WebSocket>();

wss.on('connection', (ws) => {
  alive.add(ws);
  ws.on('pong', () => alive.add(ws));
  ws.on('error', (err) => console.error('[ws] client error:', err.message));
  if (runtime.frame) ws.send(JSON.stringify(runtime.frame));
});

const tick = setInterval(() => {
  const message = JSON.stringify(runtime.tick(Date.now()));
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(message);
  }
}, TICK_MS);

// Drop clients that stopped answering pings (laptop lid closed, cable pulled).
const heartbeat = setInterval(() => {
  for (const client of wss.clients) {
    if (!alive.has(client)) {
      client.terminate();
      continue;
    }
    alive.delete(client);
    client.ping();
  }
}, 30_000);

server.listen(PORT, () => {
  console.log(`[aegis] monitoring server on http://localhost:${PORT}  (REST /api/v1, WebSocket /ws)`);
  console.log(`[aegis] data source: plant simulator, seed ${SEED}, ${BACKFILL_S}s of history pre-generated`);
});

function shutdown(): void {
  clearInterval(tick);
  clearInterval(heartbeat);
  for (const client of wss.clients) client.close(1001, 'server shutting down');
  wss.close();
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
