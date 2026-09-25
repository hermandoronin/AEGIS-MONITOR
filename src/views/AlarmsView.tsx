import { useEffect, useState } from 'react';
import type { AlarmEvent } from '../../shared/types';
import { apiClient } from '../api/client';
import AlarmPanel from '../components/AlarmPanel';
import { Panel, SEVERITY_STYLE } from '../components/ui';
import { VESSEL_ID } from '../config';
import { useAlarmActions } from '../hooks/useAlarmActions';
import { useVesselStore } from '../store/useVesselStore';
import { formatDateTime, formatTime } from '../utils/formatters';

function duration(from: number, to: number | null): string {
  if (to === null) return '—';
  const s = Math.round((to - from) / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

export default function AlarmsView() {
  const alarms = useVesselStore((s) => s.alarms);
  const { acknowledge, acknowledgeAll } = useAlarmActions();
  const [log, setLog] = useState<AlarmEvent[]>([]);

  useEffect(() => {
    const load = () => apiClient.fetchAlarmLog(VESSEL_ID, 300).then(setLog).catch(console.error);
    load();
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Alarm list">
        <AlarmPanel alarms={alarms} onAcknowledge={acknowledge} onAcknowledgeAll={acknowledgeAll} maxHeight="max-h-96" />
        <p className="text-[11px] text-slate-500 mt-3">
          NEW — active, not acknowledged (flashing) · ACK — active, acknowledged · RTN — returned to
          normal, still needs acknowledging. Limits are evaluated on the server with a 2 s on-delay and
          hysteresis, so every screen shows the same list.
        </p>
      </Panel>

      <Panel title={`Event log — last ${log.length} events`}>
        {log.length === 0 ? (
          <div className="text-xs text-slate-500 py-6 text-center">
            No alarm has been raised since the server started. Inject a fault on the Simulator tab to see one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-slate-500 border-b border-slate-800">
                <tr>
                  <th className="py-1.5 pr-3 font-medium">Raised</th>
                  <th className="py-1.5 pr-3 font-medium">Priority</th>
                  <th className="py-1.5 pr-3 font-medium">Alarm</th>
                  <th className="py-1.5 pr-3 font-medium">System</th>
                  <th className="py-1.5 pr-3 font-medium text-right">Value</th>
                  <th className="py-1.5 pr-3 font-medium">Acknowledged</th>
                  <th className="py-1.5 pr-3 font-medium">Cleared</th>
                  <th className="py-1.5 font-medium">Duration</th>
                </tr>
              </thead>
              <tbody>
                {log.map((a) => (
                  <tr key={a.id} className="border-b border-slate-900">
                    <td className="py-1.5 pr-3 font-mono text-slate-400 whitespace-nowrap">{formatDateTime(a.raisedAt).replace(' UTC', '')}:{formatTime(a.raisedAt).slice(6)}</td>
                    <td className={`py-1.5 pr-3 font-semibold ${SEVERITY_STYLE[a.severity].text}`}>{a.severity}</td>
                    <td className="py-1.5 pr-3 text-slate-200">
                      {a.message} <span className="text-slate-500 font-mono">{a.tag}</span>
                    </td>
                    <td className="py-1.5 pr-3 text-slate-400">{a.source}</td>
                    <td className="py-1.5 pr-3 font-mono text-right text-slate-300 whitespace-nowrap">
                      {a.limit === null ? '—' : `${a.value} ${a.unit}`}
                    </td>
                    <td className="py-1.5 pr-3 font-mono text-slate-400">{a.acknowledgedAt ? formatTime(a.acknowledgedAt) : '—'}</td>
                    <td className="py-1.5 pr-3 font-mono text-slate-400">{a.active ? <span className="text-orange-300">active</span> : a.clearedAt ? formatTime(a.clearedAt) : '—'}</td>
                    <td className="py-1.5 font-mono text-slate-400">{duration(a.raisedAt, a.active ? null : a.clearedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
