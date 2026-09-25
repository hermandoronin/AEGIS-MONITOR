/**
 * The monitoring runtime: one tick = read the plant, decode the buses,
 * evaluate alarms, store history, publish a frame.
 */
import { CHANNELS, SYSTEM_INFO, channelsOf } from '../shared/channels';
import { SYSTEM_NAMES } from '../shared/types';
import type { ScenarioInfo, SystemState, SystemStatus, TelemetryFrame } from '../shared/types';
import { acquire } from './acquisition/fieldbus';
import { AlarmEngine } from './alarms';
import { HistoryBuffer } from './history';
import { PlantSimulator } from './simulator/plant';
import { SCENARIOS, type ScenarioId } from './simulator/scenarios';

export interface RuntimeOptions {
  seed: number;
  now: number;
  /** Seconds of history kept in memory. */
  historySeconds?: number;
}

const DECIMALS = new Map(CHANNELS.map((c) => [c.tag, c.decimals]));

/** Rounds to the displayed resolution, so what alarms is exactly what is shown. */
function quantise(values: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const channel of CHANNELS) {
    const value = values[channel.tag];
    if (value === undefined) continue;
    const factor = 10 ** (DECIMALS.get(channel.tag) ?? 2);
    out[channel.tag] = Math.round(value * factor) / factor;
  }
  return out;
}

export class MonitorRuntime {
  readonly plant: PlantSimulator;
  readonly alarms: AlarmEngine;
  readonly history: HistoryBuffer;
  private latest: TelemetryFrame | null = null;

  constructor(options: RuntimeOptions) {
    this.plant = new PlantSimulator({ seed: options.seed, now: options.now });
    this.alarms = new AlarmEngine(CHANNELS);
    this.history = new HistoryBuffer(
      CHANNELS.map((c) => c.tag),
      options.historySeconds ?? 3600,
    );
  }

  get frame(): TelemetryFrame | null {
    return this.latest;
  }

  tick(now: number): TelemetryFrame {
    const plant = this.plant.step(now);
    const values = quantise(acquire(plant.values));
    this.alarms.evaluate(values, now);
    this.history.push(now, values);
    this.latest = {
      timestamp: now,
      values,
      systems: this.systemStatus(values),
      alarms: this.alarms.current(),
      voyage: plant.voyage,
      scenarios: this.plant.activeScenarios(),
    };
    return this.latest;
  }

  /** Runs the plant forward over the past `seconds` so trends are full on first load. */
  backfill(seconds: number, now: number, stepMs = 1000): void {
    for (let t = now - seconds * 1000; t <= now; t += stepMs) this.tick(t);
  }

  scenarios(): ScenarioInfo[] {
    const active = new Set(this.plant.activeScenarios());
    return SCENARIOS.map((s) => ({ ...s, active: active.has(s.id) }));
  }

  startScenario(id: ScenarioId): void {
    this.plant.startScenario(id);
  }

  stopScenario(id: ScenarioId): void {
    this.plant.stopScenario(id);
  }

  resetSimulation(): void {
    this.plant.reset();
  }

  private systemStatus(values: Record<string, number>): SystemStatus[] {
    const open = this.alarms.current();
    const faulty = this.alarms.faultyTags();
    return SYSTEM_NAMES.map((name) => {
      const channels = channelsOf(name);
      const alarms = open.filter((a) => a.source === name);
      const runTag = SYSTEM_INFO[name].runTag;
      let state: SystemState = 'Running';
      if (alarms.some((a) => a.active && a.severity === 'Critical')) state = 'Fault';
      else if (runTag && values[runTag] !== 1) state = 'Standby';
      return {
        name,
        state,
        activeSensors: channels.filter((c) => Number.isFinite(values[c.tag]) && !faulty.has(c.tag)).length,
        totalSensors: channels.length,
        activeAlarms: alarms.filter((a) => a.active).length,
        unacknowledged: alarms.filter((a) => !a.acknowledged).length,
      };
    });
  }
}
