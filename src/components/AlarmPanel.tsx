import { useState } from 'react';
import type { AlarmEvent, AlarmSeverity } from '../../shared/types';
import { formatTime } from '../utils/formatters';
import { Button, SEVERITY_STYLE } from './ui';

interface AlarmPanelProps {
  alarms: AlarmEvent[];
  onAcknowledge: (alarmId: string) => void;
  onAcknowledgeAll?: () => void;
  maxHeight?: string;
}

const SEVERITY_ORDER: Record<AlarmSeverity, number> = { Critical: 0, Warning: 1, Caution: 2 };

function stateLabel(alarm: AlarmEvent): string {
  if (alarm.active) return alarm.acknowledged ? 'ACK' : 'NEW';
  return 'RTN'; // returned to normal, still waiting for acknowledgement
}

/**
 * Active alarm list. Unacknowledged alarms flash; returned-to-normal ones stay
 * until acknowledged. Sorted by priority, then newest first.
 */
export default function AlarmPanel({ alarms, onAcknowledge, onAcknowledgeAll, maxHeight = 'max-h-80' }: AlarmPanelProps) {
  const [filter, setFilter] = useState<AlarmSeverity | 'All'>('All');
  const sorted = [...alarms]
    .filter((a) => filter === 'All' || a.severity === filter)
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.raisedAt - a.raisedAt);
  const unacked = alarms.filter((a) => !a.acknowledged).length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1">
        {(['All', 'Critical', 'Warning', 'Caution'] as const).map((level) => {
          const count = level === 'All' ? alarms.length : alarms.filter((a) => a.severity === level).length;
          return (
            <button
              key={level}
              type="button"
              onClick={() => setFilter(level)}
              className={`text-xs px-2 py-0.5 rounded ${filter === level ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {level} <span className="text-slate-500">{count}</span>
            </button>
          );
        })}
        <span className="flex-1" />
        {onAcknowledgeAll && (
          <Button onClick={onAcknowledgeAll} disabled={unacked === 0}>
            ACK all ({unacked})
          </Button>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-800 rounded">
          No alarms. All monitored points are within limits.
        </div>
      ) : (
        <ul className={`flex flex-col gap-1 overflow-y-auto ${maxHeight}`}>
          {sorted.map((alarm) => {
            const style = SEVERITY_STYLE[alarm.severity];
            const flashing = !alarm.acknowledged && alarm.active;
            return (
              <li
                key={alarm.id}
                className={`flex items-stretch gap-2 rounded bg-slate-950/70 border border-slate-800 text-xs ${alarm.active ? '' : 'opacity-60'}`}
              >
                <span className={`w-1 rounded-l ${style.bar} ${flashing ? 'alarm-flash' : ''}`} />
                <div className="flex-1 py-1.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-400 tabular">{formatTime(alarm.raisedAt)}</span>
                    <span className={`font-semibold ${style.text} ${flashing ? 'alarm-flash' : ''}`}>{alarm.message}</span>
                  </div>
                  <div className="text-slate-500 truncate">
                    {alarm.source} · {alarm.tag}
                    {alarm.limit !== null && (
                      <> · {alarm.value} {alarm.unit} (limit {alarm.limit})</>
                    )}
                  </div>
                </div>
                <span className="self-center font-mono text-[10px] text-slate-400 w-8 text-center">{stateLabel(alarm)}</span>
                <div className="self-center pr-1.5 w-12">
                  {!alarm.acknowledged && (
                    <button
                      type="button"
                      onClick={() => onAcknowledge(alarm.id)}
                      className="text-[11px] px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-100"
                    >
                      ACK
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
