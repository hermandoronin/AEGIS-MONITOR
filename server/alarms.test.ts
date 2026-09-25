import { describe, expect, it } from 'vitest';
import type { ChannelDef } from '../shared/types';
import { AlarmEngine } from './alarms';

const base = {
  system: 'Main Engine', group: 'Test', unit: 'bar', decimals: 2,
  source: 'Analog 4-20 mA', address: 'AI', description: '',
} as const;

const pressure: ChannelDef = {
  ...base, tag: 'P', label: 'LO pressure', kind: 'analog', min: 0, max: 10,
  alarm: { type: 'low', warning: 4, critical: 3 },
};
const running: ChannelDef = { ...base, tag: 'RUN', label: 'Running', kind: 'digital', min: 0, max: 1 };
const blocked: ChannelDef = {
  ...base, tag: 'Q', label: 'Blocked pressure', kind: 'analog', min: 0, max: 10,
  alarm: { type: 'low', warning: 4 }, inhibitedBy: 'RUN',
};
const trip: ChannelDef = {
  ...base, tag: 'TRIP', label: 'Trip', kind: 'digital', min: 0, max: 1,
  alarm: { type: 'state', severity: 'Critical', text: 'Engine tripped' },
};
const list: ChannelDef = {
  ...base, tag: 'LIST', label: 'List', kind: 'analog', min: -15, max: 15,
  alarm: { type: 'abs', warning: 5 },
};

function engine() {
  return new AlarmEngine([pressure, running, blocked, trip, list], { onDelayMs: 2000 });
}

const normal = { P: 5, RUN: 1, Q: 5, TRIP: 0, LIST: 0 };

describe('AlarmEngine', () => {
  it('raises only after the on-delay', () => {
    const alarms = engine();
    alarms.evaluate({ ...normal, P: 3.9 }, 0);
    alarms.evaluate({ ...normal, P: 3.9 }, 1000);
    expect(alarms.current()).toHaveLength(0);
    alarms.evaluate({ ...normal, P: 3.9 }, 2000);
    expect(alarms.current()).toMatchObject([{ message: 'LO pressure low', severity: 'Warning', limit: 4, active: true }]);
  });

  it('ignores a spike shorter than the on-delay', () => {
    const alarms = engine();
    alarms.evaluate({ ...normal, P: 2 }, 0);
    alarms.evaluate(normal, 1000);
    alarms.evaluate({ ...normal, P: 2 }, 2000);
    expect(alarms.current()).toHaveLength(0);
  });

  it('treats L and LL as independent points', () => {
    const alarms = engine();
    for (const t of [0, 1000, 2000]) alarms.evaluate({ ...normal, P: 2.5 }, t);
    expect(alarms.current().map((a) => a.severity).sort()).toEqual(['Critical', 'Warning']);
  });

  it('holds the alarm inside the hysteresis band', () => {
    const alarms = engine();
    for (const t of [0, 1000, 2000]) alarms.evaluate({ ...normal, P: 3.9 }, t);
    alarms.evaluate({ ...normal, P: 4.05 }, 3000); // band is 1% of span = 0.1 bar
    expect(alarms.current()[0].active).toBe(true);
    alarms.evaluate({ ...normal, P: 4.2 }, 4000);
    expect(alarms.current()[0]).toMatchObject({ active: false, clearedAt: 4000 });
  });

  it('keeps a cleared alarm listed until it is acknowledged', () => {
    const alarms = engine();
    for (const t of [0, 1000, 2000]) alarms.evaluate({ ...normal, P: 3.9 }, t);
    alarms.evaluate(normal, 3000);
    const [event] = alarms.current();
    expect(event).toMatchObject({ active: false, acknowledged: false });
    expect(alarms.acknowledge(event.id, 4000)).toBe(true);
    expect(alarms.current()).toHaveLength(0);
    expect(alarms.history()[0]).toMatchObject({ acknowledged: true, acknowledgedAt: 4000, clearedAt: 3000 });
  });

  it('keeps an acknowledged alarm listed while it is still active', () => {
    const alarms = engine();
    for (const t of [0, 1000, 2000]) alarms.evaluate({ ...normal, P: 3.9 }, t);
    expect(alarms.acknowledgeAll(2500)).toBe(1);
    expect(alarms.current()[0]).toMatchObject({ active: true, acknowledged: true });
    alarms.evaluate(normal, 3000);
    expect(alarms.current()).toHaveLength(0);
  });

  it('re-activates the same event if it returns before acknowledgement', () => {
    const alarms = engine();
    for (const t of [0, 1000, 2000]) alarms.evaluate({ ...normal, P: 3.9 }, t);
    const id = alarms.current()[0].id;
    alarms.evaluate(normal, 3000);
    for (const t of [4000, 5000, 6000]) alarms.evaluate({ ...normal, P: 3.9 }, t);
    expect(alarms.current()).toMatchObject([{ id, active: true }]);
    expect(alarms.history()).toHaveLength(1);
  });

  it('blocks alarms of stopped machinery', () => {
    const alarms = engine();
    for (const t of [0, 1000, 2000, 3000]) alarms.evaluate({ ...normal, RUN: 0, Q: 0 }, t);
    expect(alarms.current()).toHaveLength(0);
    for (const t of [4000, 5000, 6000]) alarms.evaluate({ ...normal, RUN: 1, Q: 0 }, t);
    expect(alarms.current()).toMatchObject([{ tag: 'Q' }]);
  });

  it('raises digital state alarms', () => {
    const alarms = engine();
    for (const t of [0, 1000, 2000]) alarms.evaluate({ ...normal, TRIP: 1 }, t);
    expect(alarms.current()).toMatchObject([{ message: 'Engine tripped', severity: 'Critical', limit: null }]);
  });

  it('evaluates abs rules on both sides', () => {
    const alarms = engine();
    for (const t of [0, 1000, 2000]) alarms.evaluate({ ...normal, LIST: -6 }, t);
    expect(alarms.current()).toMatchObject([{ message: 'List high' }]);
  });

  it('reports a sensor fault instead of a false process alarm', () => {
    const alarms = engine();
    // A 4-20 mA wire break reads about -25% of span.
    for (const t of [0, 1000, 2000]) alarms.evaluate({ ...normal, P: -2.5 }, t);
    expect(alarms.current()).toMatchObject([{ message: 'LO pressure sensor fault', severity: 'Caution' }]);
    expect(alarms.faultyTags()).toEqual(new Set(['P']));
  });

  it('refuses to acknowledge unknown or already acknowledged events', () => {
    const alarms = engine();
    for (const t of [0, 1000, 2000]) alarms.evaluate({ ...normal, P: 3.9 }, t);
    const id = alarms.current()[0].id;
    expect(alarms.acknowledge('nope', 3000)).toBe(false);
    expect(alarms.acknowledge(id, 3000)).toBe(true);
    expect(alarms.acknowledge(id, 3000)).toBe(false);
  });
});
