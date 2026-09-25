/**
 * Alarm engine: evaluates every IO-list limit on the server, once per tick.
 *
 * Doing this centrally (not in each browser) means every screen on board
 * shows the same alarm list, and an acknowledgement on the bridge is seen in
 * the engine control room. Behaviour follows common AMS practice:
 *
 * - each limit is its own alarm point (H and HH, L and LL are independent);
 * - a condition must persist for an on-delay before it is raised (no chatter);
 * - hysteresis on the way back so a value sitting on a limit does not flap;
 * - alarms of stopped machinery are blocked (`inhibitedBy`);
 * - a reading far outside the instrument range raises a sensor-fault caution
 *   and suppresses the process alarms of that point instead of faking them;
 * - an event stays listed until it is both cleared and acknowledged.
 */
import type { AlarmEvent, AlarmSeverity, ChannelDef } from '../shared/types';

type Level = 'warning' | 'critical' | 'state' | 'fault';

interface AlarmPoint {
  id: string;
  channel: ChannelDef;
  level: Level;
  severity: AlarmSeverity;
  limit: number | null;
  message: string;
  pendingSince: number | null;
  event: AlarmEvent | null;
  count: number;
}

export interface AlarmEngineOptions {
  /** How long a condition must hold before the alarm is raised. */
  onDelayMs?: number;
  /** Return-to-normal hysteresis as a fraction of the instrument span. */
  hysteresis?: number;
  /** Readings further than this fraction of span outside the range are a sensor fault. */
  faultMargin?: number;
  /** Events kept in the log. */
  logSize?: number;
}

const WORDS: Record<'high' | 'low' | 'abs', [string, string]> = {
  high: ['high', 'high-high'],
  low: ['low', 'low-low'],
  abs: ['high', 'high-high'],
};

function buildPoints(channels: ChannelDef[]): AlarmPoint[] {
  const points: AlarmPoint[] = [];
  const add = (channel: ChannelDef, level: Level, severity: AlarmSeverity, limit: number | null, message: string) => {
    points.push({
      id: `${channel.tag}:${level}`,
      channel, level, severity, limit, message,
      pendingSince: null, event: null, count: 0,
    });
  };

  for (const channel of channels) {
    if (channel.kind === 'analog') {
      add(channel, 'fault', 'Caution', null, `${channel.label} sensor fault`);
    }
    const rule = channel.alarm;
    if (!rule) continue;
    if (rule.type === 'state') {
      add(channel, 'state', rule.severity, null, rule.text);
      continue;
    }
    const [warnWord, critWord] = WORDS[rule.type];
    if (rule.warning !== undefined) add(channel, 'warning', 'Warning', rule.warning, `${channel.label} ${warnWord}`);
    if (rule.critical !== undefined) add(channel, 'critical', 'Critical', rule.critical, `${channel.label} ${critWord}`);
  }
  return points;
}

export class AlarmEngine {
  private readonly points: AlarmPoint[];
  private readonly log: AlarmEvent[] = [];
  private readonly onDelayMs: number;
  private readonly hysteresis: number;
  private readonly faultMargin: number;
  private readonly logSize: number;

  constructor(channels: ChannelDef[], options: AlarmEngineOptions = {}) {
    this.points = buildPoints(channels);
    this.onDelayMs = options.onDelayMs ?? 2000;
    this.hysteresis = options.hysteresis ?? 0.01;
    this.faultMargin = options.faultMargin ?? 0.1;
    this.logSize = options.logSize ?? 1000;
  }

  /** Runs every point against one set of readings. */
  evaluate(values: Record<string, number>, now: number): void {
    const faulty = new Set<string>();
    for (const point of this.points) {
      if (point.level === 'fault' && this.isFault(point.channel, values[point.channel.tag])) {
        faulty.add(point.channel.tag);
      }
    }

    for (const point of this.points) {
      const value = values[point.channel.tag];
      const condition = this.condition(point, value, values, faulty);
      const event = point.event;

      if (!condition) {
        point.pendingSince = null;
        if (event?.active) {
          event.active = false;
          event.clearedAt = now;
          if (event.acknowledged) point.event = null;
        }
        continue;
      }

      if (event?.active) continue;
      point.pendingSince ??= now;
      if (now - point.pendingSince < this.onDelayMs) continue;
      point.pendingSince = null;

      if (event) {
        // Came back before anyone acknowledged it: same event, active again.
        event.active = true;
        event.clearedAt = null;
        event.value = value;
        continue;
      }
      this.raise(point, value, now);
    }
  }

  acknowledge(eventId: string, now: number): boolean {
    const point = this.points.find((p) => p.event?.id === eventId);
    if (!point?.event || point.event.acknowledged) return false;
    this.ack(point, now);
    return true;
  }

  acknowledgeAll(now: number): number {
    let count = 0;
    for (const point of this.points) {
      if (point.event && !point.event.acknowledged) {
        this.ack(point, now);
        count += 1;
      }
    }
    return count;
  }

  /** Open events (active, or cleared but not yet acknowledged), newest first. */
  current(): AlarmEvent[] {
    return this.points
      .flatMap((p) => (p.event ? [{ ...p.event }] : []))
      .sort((a, b) => b.raisedAt - a.raisedAt);
  }

  /** Event log including closed events, newest first. */
  history(limit = 200): AlarmEvent[] {
    return this.log.slice(0, limit).map((e) => ({ ...e }));
  }

  /** Tags currently in sensor fault. */
  faultyTags(): Set<string> {
    return new Set(this.points.filter((p) => p.level === 'fault' && p.event?.active).map((p) => p.channel.tag));
  }

  private raise(point: AlarmPoint, value: number, now: number): void {
    point.count += 1;
    const event: AlarmEvent = {
      id: `${point.id}:${now}:${point.count}`,
      pointId: point.id,
      tag: point.channel.tag,
      severity: point.severity,
      message: point.message,
      source: point.channel.system,
      raisedAt: now,
      value,
      limit: point.limit,
      unit: point.channel.unit,
      active: true,
      acknowledged: false,
      acknowledgedAt: null,
      clearedAt: null,
    };
    point.event = event;
    this.log.unshift(event);
    if (this.log.length > this.logSize) this.log.length = this.logSize;
  }

  private ack(point: AlarmPoint, now: number): void {
    const event = point.event!;
    event.acknowledged = true;
    event.acknowledgedAt = now;
    if (!event.active) point.event = null;
  }

  private isFault(channel: ChannelDef, value: number | undefined): boolean {
    if (value === undefined || !Number.isFinite(value)) return true;
    const margin = (channel.max - channel.min) * this.faultMargin;
    return value < channel.min - margin || value > channel.max + margin;
  }

  private condition(
    point: AlarmPoint,
    value: number | undefined,
    values: Record<string, number>,
    faulty: Set<string>,
  ): boolean {
    const { channel } = point;
    if (point.level === 'fault') return faulty.has(channel.tag);
    if (value === undefined || !Number.isFinite(value) || faulty.has(channel.tag)) return false;
    if (channel.inhibitedBy && values[channel.inhibitedBy] !== 1) return false;

    const rule = channel.alarm!;
    if (rule.type === 'state') return value >= 0.5;

    const limit = point.limit!;
    const band = (channel.max - channel.min) * this.hysteresis;
    const active = point.event?.active ?? false;
    if (rule.type === 'low') return active ? value < limit + band : value <= limit;
    const magnitude = rule.type === 'abs' ? Math.abs(value) : value;
    return active ? magnitude > limit - band : magnitude >= limit;
  }
}
