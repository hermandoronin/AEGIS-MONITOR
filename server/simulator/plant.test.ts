import { describe, expect, it } from 'vitest';
import { CHANNELS } from '../../shared/channels';
import { MonitorRuntime } from '../runtime';
import { SCENARIOS, type ScenarioId } from './scenarios';

const T0 = Date.UTC(2026, 8, 1);

function run(seed: number, seconds: number, fault?: ScenarioId) {
  const runtime = new MonitorRuntime({ seed, now: T0 });
  if (fault) runtime.startScenario(fault);
  for (let i = 1; i <= seconds; i += 1) runtime.tick(T0 + i * 1000);
  return runtime;
}

describe('plant simulator', () => {
  it('produces a value for every channel in the IO list', () => {
    const frame = run(1, 1).frame!;
    for (const channel of CHANNELS) {
      expect(Number.isFinite(frame.values[channel.tag]), channel.tag).toBe(true);
    }
  });

  it.each([1, 2, 3])('runs an hour of normal sea passage without a single alarm (seed %i)', (seed) => {
    const runtime = run(seed, 3600);
    expect(runtime.alarms.history()).toEqual([]);
    expect(runtime.frame!.systems.every((s) => s.state !== 'Fault')).toBe(true);
  });

  it('is repeatable for a given seed', () => {
    expect(run(42, 120).frame!.values).toEqual(run(42, 120).frame!.values);
  });

  it('keeps the ship on passage: speed, SFOC and fuel are coherent', () => {
    const { values, voyage } = run(5, 600).frame!;
    expect(values['ME.SPEED']).toBeGreaterThan(105);
    expect(values['ME.SPEED']).toBeLessThan(115);
    expect(values['ME.SFOC']).toBeGreaterThan(160);
    expect(values['ME.SFOC']).toBeLessThan(175);
    expect(voyage.sogKnots).toBeGreaterThan(12.5);
    expect(voyage.sogKnots).toBeLessThan(15.5);
    expect(voyage.distanceToGoNm).toBeGreaterThan(0);
    expect(values['MSB.LOAD']).toBeCloseTo(values['DG1.LOAD'] + values['DG2.LOAD'] + values['DG3.LOAD'], -1);
  });

  const expectations: Record<ScenarioId, string[]> = {
    'me-lo-filter': ['ME.LO.PRESS:warning', 'ME.LO.PRESS:critical'],
    'me-ht-thermostat': ['ME.HT.TEMP:warning', 'ME.HT.TEMP:critical'],
    'me-cyl4-injector': ['ME.EXH.CYL4:warning', 'ME.EXH.CYL4:critical'],
    'dg-trip': ['DG1.TRIP:state', 'PMS.STBY.START:state', 'PMS.LOAD.SHED:state', 'MSB.FREQ:warning'],
    'fo-heater': ['FO.VISC:warning', 'FO.VISC:critical'],
    'sg-oil-leak': ['SG.OIL.LEVEL:warning', 'SG.OIL.LEVEL:critical'],
    'ballast-leak': ['VSL.LIST:warning'],
    'sw-sensor-fault': ['SW.PRESS:fault'],
  };

  it.each(SCENARIOS.map((s) => s.id))('scenario %s raises the expected alarms within five minutes', (id) => {
    const points = new Set(run(7, 300, id).alarms.history().map((a) => a.pointId));
    for (const point of expectations[id]) expect(points, point).toContain(point);
  });

  it('does not raise a false low-pressure alarm on a sensor wire break', () => {
    const points = run(7, 300, 'sw-sensor-fault').alarms.history().map((a) => a.pointId);
    expect(points).toEqual(['SW.PRESS:fault']);
  });

  it('brings the standby generator on line after a trip', () => {
    const { values } = run(7, 60, 'dg-trip').frame!;
    expect(values['DG1.TRIP']).toBe(1);
    expect(values['DG3.RUN']).toBe(1);
    expect(values['MSB.FREQ']).toBeGreaterThan(59.5);
  });

  it('recovers after a reset', () => {
    const runtime = run(7, 200, 'me-lo-filter');
    runtime.resetSimulation();
    for (let i = 201; i <= 230; i += 1) runtime.tick(T0 + i * 1000);
    expect(runtime.frame!.scenarios).toEqual([]);
    expect(runtime.frame!.alarms.every((a) => !a.active)).toBe(true);
  });
});
