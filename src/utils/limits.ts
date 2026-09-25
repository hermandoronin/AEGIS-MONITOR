import type { ChannelDef } from '../../shared/types';

export type LimitState = 'normal' | 'warning' | 'critical' | 'fault';

/** True while the point's alarms are blocked because its machine is stopped. */
export function isBlocked(channel: ChannelDef, values?: Record<string, number>): boolean {
  return Boolean(channel.inhibitedBy && values && values[channel.inhibitedBy] !== 1);
}

/**
 * Instantaneous limit state of a reading, for colouring gauges. The alarm
 * list itself comes from the server, which adds on-delay and hysteresis.
 * Pass all current values so blocked points are not shown as in alarm.
 */
export function limitState(channel: ChannelDef, value: number | undefined, values?: Record<string, number>): LimitState {
  if (value === undefined || !Number.isFinite(value)) return 'fault';
  const margin = (channel.max - channel.min) * 0.1;
  if (channel.kind === 'analog' && (value < channel.min - margin || value > channel.max + margin)) return 'fault';
  const rule = channel.alarm;
  if (!rule || isBlocked(channel, values)) return 'normal';
  if (rule.type === 'state') {
    if (value < 0.5) return 'normal';
    return rule.severity === 'Critical' ? 'critical' : 'warning';
  }
  const v = rule.type === 'abs' ? Math.abs(value) : value;
  const crossed = (limit: number | undefined) =>
    limit !== undefined && (rule.type === 'low' ? v <= limit : v >= limit);
  if (crossed(rule.critical)) return 'critical';
  if (crossed(rule.warning)) return 'warning';
  return 'normal';
}

export const STATE_COLOR: Record<LimitState, string> = {
  normal: '#22c55e',
  warning: '#fb923c',
  critical: '#ef4444',
  fault: '#facc15',
};
