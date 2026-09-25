import type { ChannelDef } from '../../shared/types';
import { formatValue } from '../utils/formatters';
import { STATE_COLOR, isBlocked, limitState } from '../utils/limits';

interface GaugeWidgetProps {
  channel: ChannelDef;
  value: number | undefined;
  /** All current readings, used to tell whether the point's alarms are blocked. */
  values?: Record<string, number>;
  stale?: boolean;
  selected?: boolean;
  onSelect?: (tag: string) => void;
}

const CX = 60;
const CY = 58;
const R = 44;
const ZONE_R = 51;

/** Point on the dial; 180° is the left end, 0° the right end. */
function point(angle: number, r: number): string {
  const rad = (angle * Math.PI) / 180;
  return `${(CX + r * Math.cos(rad)).toFixed(2)} ${(CY - r * Math.sin(rad)).toFixed(2)}`;
}

function arc(from: number, to: number, r: number): string {
  const [a, b] = from > to ? [from, to] : [to, from];
  return `M ${point(a, r)} A ${r} ${r} 0 0 1 ${point(b, r)}`;
}

/**
 * Half-dial gauge with the alarm zones drawn around the rim, so the engineer
 * sees at a glance both the reading and how close it is to a limit.
 */
export default function GaugeWidget({ channel, value, values, stale, selected, onSelect }: GaugeWidgetProps) {
  const { min, max } = channel;
  const toAngle = (v: number) => 180 - ((Math.min(Math.max(v, min), max) - min) / (max - min)) * 180;
  const state = limitState(channel, value, values);
  const blocked = isBlocked(channel, values);
  const color = stale || blocked ? '#64748b' : STATE_COLOR[state];
  const hasValue = value !== undefined && Number.isFinite(value);
  // Bipolar ranges (rudder, list) fill from zero.
  const origin = min < 0 && max > 0 ? 0 : min;

  const zones: { from: number; to: number; color: string }[] = [];
  const rule = channel.alarm;
  if (rule && rule.type !== 'state') {
    const { warning: w, critical: c } = rule;
    if (rule.type === 'low') {
      if (c !== undefined) zones.push({ from: min, to: c, color: STATE_COLOR.critical });
      if (w !== undefined) zones.push({ from: c ?? min, to: w, color: STATE_COLOR.warning });
    } else {
      const sides = rule.type === 'abs' ? [1, -1] : [1];
      for (const sign of sides) {
        const edge = sign > 0 ? max : min;
        if (w !== undefined) zones.push({ from: sign * w, to: c !== undefined ? sign * c : edge, color: STATE_COLOR.warning });
        if (c !== undefined) zones.push({ from: sign * c, to: edge, color: STATE_COLOR.critical });
      }
    }
  }

  return (
    <button
      type="button"
      onClick={() => onSelect?.(channel.tag)}
      title={`${channel.tag} — ${channel.description}`}
      className={`flex flex-col items-center rounded-md px-1 pt-1 pb-2 border transition-colors ${
        selected ? 'border-sky-500/70 bg-sky-500/5' : 'border-transparent hover:border-slate-700 hover:bg-slate-800/40'
      }`}
    >
      <svg width="120" height="72" viewBox="0 0 120 72" aria-hidden="true">
        <path d={arc(180, 0, R)} fill="none" stroke="#1e293b" strokeWidth="7" strokeLinecap="round" />
        {zones.map((z) => (
          <path key={`${z.from}-${z.to}`} d={arc(toAngle(z.from), toAngle(z.to), ZONE_R)} fill="none" stroke={z.color} strokeWidth="2.5" opacity="0.8" />
        ))}
        {hasValue && Math.abs(toAngle(value) - toAngle(origin)) > 0.5 && (
          <path d={arc(toAngle(origin), toAngle(value), R)} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" />
        )}
        <text x={CX} y={CY - 6} textAnchor="middle" fill={stale || blocked ? '#64748b' : '#f1f5f9'} fontSize="17" fontWeight="600" fontFamily="ui-monospace, monospace">
          {formatValue(channel, value)}
        </text>
        <text x={CX} y={CY + 9} textAnchor="middle" fill="#94a3b8" fontSize="10">
          {channel.unit}
        </text>
      </svg>
      <span className="text-[11px] leading-tight text-slate-400 text-center max-w-[120px]">{channel.label}</span>
      {blocked && (
        <span className="text-[9px] tracking-wider text-slate-500 mt-0.5" title={`Alarms blocked while ${channel.inhibitedBy} = 0`}>
          ALARMS BLOCKED
        </span>
      )}
    </button>
  );
}
