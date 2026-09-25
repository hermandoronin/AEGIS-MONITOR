import type { ChannelDef } from '../../shared/types';
import { formatRunningHours, formatValue } from '../utils/formatters';

/** Status lamp for a 0/1 point. Alarm points light up red/orange, run points green. */
export function DigitalIndicator({ channel, value, stale }: { channel: ChannelDef; value: number | undefined; stale?: boolean }) {
  const on = value === 1;
  const isAlarm = channel.alarm?.type === 'state';
  let style = 'bg-slate-800 text-slate-400 border-slate-700';
  let text = isAlarm ? 'NORMAL' : 'STOPPED';
  if (on && isAlarm) {
    style = channel.alarm?.type === 'state' && channel.alarm.severity === 'Critical'
      ? 'bg-red-500/20 text-red-300 border-red-500/50'
      : 'bg-orange-400/15 text-orange-200 border-orange-400/40';
    text = 'ACTIVE';
  } else if (on) {
    style = 'bg-green-500/15 text-green-300 border-green-500/40';
    text = 'RUNNING';
  }
  if (stale) style = 'bg-slate-800 text-slate-500 border-slate-700';
  return (
    <div title={`${channel.tag} — ${channel.description}`} className={`flex items-center justify-between gap-3 rounded border px-2.5 py-1.5 text-xs ${style}`}>
      <span className="text-slate-300">{channel.label}</span>
      <span className="font-mono font-semibold">{value === undefined ? '---' : text}</span>
    </div>
  );
}

/** Totaliser such as running hours or fuel remaining on board. */
export function CounterTile({ channel, value }: { channel: ChannelDef; value: number | undefined }) {
  const text = channel.unit === 'h' && value !== undefined ? formatRunningHours(value) : `${formatValue(channel, value)} ${channel.unit}`;
  return (
    <div title={`${channel.tag} — ${channel.description}`} className="flex items-center justify-between gap-3 rounded border border-slate-700 bg-slate-950/50 px-2.5 py-1.5 text-xs">
      <span className="text-slate-300">{channel.label}</span>
      <span className="font-mono font-semibold text-slate-100 tabular">{text}</span>
    </div>
  );
}
