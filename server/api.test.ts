import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CHANNELS } from '../shared/channels';
import type { AlarmEvent, HistoryPayload, ScenarioInfo, TelemetryFrame } from '../shared/types';
import { createApi } from './api';
import { MonitorRuntime } from './runtime';

const T0 = Date.now() - 120_000;
const runtime = new MonitorRuntime({ seed: 3, now: T0 });
runtime.backfill(120, Date.now());

let server: http.Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use('/api/v1', createApi(runtime, T0));
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
});

afterAll(() => {
  server.close();
});

async function get<T>(path: string): Promise<{ status: number; body: T }> {
  const res = await fetch(base + path);
  return { status: res.status, body: (await res.json()) as T };
}

async function post<T>(path: string): Promise<{ status: number; body: T }> {
  const res = await fetch(base + path, { method: 'POST' });
  return { status: res.status, body: (await res.json()) as T };
}

describe('REST API', () => {
  it('serves health, the vessel and its IO list', async () => {
    expect((await get<{ status: string }>('/health')).body.status).toBe('ok');
    expect((await get<{ imo: string }>('/vessels/aegis-001')).body.imo).toBe('9999990');
    expect((await get<unknown[]>('/vessels/aegis-001/channels')).body).toHaveLength(CHANNELS.length);
  });

  it('returns 404 for an unknown vessel', async () => {
    expect((await get('/vessels/nope/status')).status).toBe(404);
  });

  it('serves the latest frame and compact history', async () => {
    const status = await get<TelemetryFrame>('/vessels/aegis-001/status');
    expect(Object.keys(status.body.values)).toHaveLength(CHANNELS.length);
    const history = await get<HistoryPayload>('/vessels/aegis-001/history?seconds=60&tags=ME.SPEED,ME.LOAD');
    expect(history.body.tags).toEqual(['ME.SPEED', 'ME.LOAD']);
    expect(history.body.rows.length).toBeGreaterThanOrEqual(59);
    expect(history.body.rows[0]).toHaveLength(3);
  });

  it('drives a scenario end to end: inject, alarm, acknowledge, reset', async () => {
    const started = await post<ScenarioInfo[]>('/sim/scenarios/sw-sensor-fault/start');
    expect(started.body.find((s) => s.id === 'sw-sensor-fault')?.active).toBe(true);
    const now = runtime.frame!.timestamp;
    for (let i = 1; i <= 3; i += 1) runtime.tick(now + i * 1000);

    const log = await get<AlarmEvent[]>('/vessels/aegis-001/alarms');
    const alarm = log.body.find((a) => a.pointId === 'SW.PRESS:fault');
    expect(alarm).toBeDefined();

    const acked = await post<{ alarms: AlarmEvent[] }>(`/vessels/aegis-001/alarms/${encodeURIComponent(alarm!.id)}/ack`);
    expect(acked.body.alarms.find((a) => a.id === alarm!.id)?.acknowledged).toBe(true);
    expect((await post(`/vessels/aegis-001/alarms/${encodeURIComponent(alarm!.id)}/ack`)).status).toBe(404);

    const reset = await post<ScenarioInfo[]>('/sim/reset');
    expect(reset.body.every((s) => !s.active)).toBe(true);
  });

  it('rejects unknown scenarios', async () => {
    expect((await post('/sim/scenarios/meteor-strike/start')).status).toBe(404);
    expect((await post('/sim/scenarios/fo-heater/explode')).status).toBe(404);
  });
});
