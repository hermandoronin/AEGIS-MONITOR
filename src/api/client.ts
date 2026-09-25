import { API_BASE } from '../config';
import type {
  AlarmEvent,
  ChannelDef,
  HistoryPayload,
  ScenarioInfo,
  TelemetryFrame,
  VesselInfo,
} from '../../shared/types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Typed client for the monitoring server's REST API (`server/api.ts`). */
export class AegisApiClient {
  constructor(private readonly baseUrl: string = API_BASE) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new ApiError(response.status, body?.error ?? `Request failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  private vessel(vesselId: string): string {
    return `/vessels/${encodeURIComponent(vesselId)}`;
  }

  fetchVessel(vesselId: string): Promise<VesselInfo> {
    return this.request(this.vessel(vesselId));
  }

  fetchChannels(vesselId: string): Promise<ChannelDef[]> {
    return this.request(`${this.vessel(vesselId)}/channels`);
  }

  fetchStatus(vesselId: string): Promise<TelemetryFrame> {
    return this.request(`${this.vessel(vesselId)}/status`);
  }

  fetchHistory(vesselId: string, seconds: number, tags?: string[]): Promise<HistoryPayload> {
    const params = new URLSearchParams({ seconds: String(seconds) });
    if (tags?.length) params.set('tags', tags.join(','));
    return this.request(`${this.vessel(vesselId)}/history?${params}`);
  }

  fetchAlarmLog(vesselId: string, limit = 200): Promise<AlarmEvent[]> {
    return this.request(`${this.vessel(vesselId)}/alarms?limit=${limit}`);
  }

  acknowledge(vesselId: string, alarmId: string): Promise<{ alarms: AlarmEvent[] }> {
    return this.request(`${this.vessel(vesselId)}/alarms/${encodeURIComponent(alarmId)}/ack`, { method: 'POST' });
  }

  acknowledgeAll(vesselId: string): Promise<{ acknowledged: number; alarms: AlarmEvent[] }> {
    return this.request(`${this.vessel(vesselId)}/alarms/ack-all`, { method: 'POST' });
  }

  fetchScenarios(): Promise<ScenarioInfo[]> {
    return this.request('/sim/scenarios');
  }

  setScenario(id: string, active: boolean): Promise<ScenarioInfo[]> {
    return this.request(`/sim/scenarios/${encodeURIComponent(id)}/${active ? 'start' : 'stop'}`, { method: 'POST' });
  }

  resetSimulation(): Promise<ScenarioInfo[]> {
    return this.request('/sim/reset', { method: 'POST' });
  }
}

export const apiClient = new AegisApiClient();
