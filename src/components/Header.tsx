import { useState } from 'react';
import { STALE_AFTER_MS } from '../config';
import { useAlarmSound } from '../hooks/useAlarmSound';
import { useNow } from '../hooks/useNow';
import type { ConnectionStatus } from '../hooks/useWebSocket';
import { useVesselStore, type Tab } from '../store/useVesselStore';
import { formatBearing, formatNumber, formatTime } from '../utils/formatters';
import { SEVERITY_STYLE } from './ui';

const TABS: Tab[] = ['Overview', 'Machinery', 'Voyage', 'Alarms', 'Simulator'];

const LINK: Record<ConnectionStatus, { label: string; dot: string; text: string }> = {
  connecting: { label: 'CONNECTING', dot: 'bg-yellow-400 animate-pulse', text: 'text-yellow-300' },
  open: { label: 'ONLINE', dot: 'bg-green-500', text: 'text-green-400' },
  closed: { label: 'OFFLINE', dot: 'bg-red-500', text: 'text-red-400' },
  error: { label: 'LINK ERROR', dot: 'bg-red-500 animate-pulse', text: 'text-red-400' },
};

export default function Header() {
  const vessel = useVesselStore((s) => s.vessel);
  const frame = useVesselStore((s) => s.frame);
  const connection = useVesselStore((s) => s.connection);
  const receivedAt = useVesselStore((s) => s.receivedAt);
  const alarms = useVesselStore((s) => s.alarms);
  const tab = useVesselStore((s) => s.tab);
  const setTab = useVesselStore((s) => s.setTab);
  const now = useNow();
  const [sound, setSound] = useState(false);
  useAlarmSound(sound, alarms);

  const stale = connection === 'open' && receivedAt > 0 && now - receivedAt > STALE_AFTER_MS;
  const link = stale ? { label: 'DATA STALE', dot: 'bg-yellow-400', text: 'text-yellow-300' } : LINK[connection];
  const unacked = (severity: 'Critical' | 'Warning' | 'Caution') =>
    alarms.filter((a) => a.severity === severity && !a.acknowledged).length;
  const active = (severity: 'Critical' | 'Warning' | 'Caution') =>
    alarms.filter((a) => a.severity === severity && a.active).length;

  return (
    <header className="bg-slate-950 border-b border-slate-800 px-4 py-2 flex flex-wrap items-center gap-x-6 gap-y-2">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-sky-500/15 border border-sky-500/40 grid place-items-center text-sky-300 font-bold text-sm">
          Æ
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold tracking-wide text-white">{vessel?.name ?? 'AEGIS-MONITOR'}</div>
          <div className="text-[11px] text-slate-500">
            {vessel ? `IMO ${vessel.imo} · ${vessel.type}` : 'Engine room monitoring'}
          </div>
        </div>
        {vessel?.simulated && (
          <span
            title="Data comes from the bundled plant simulator, not from shipboard hardware"
            className="text-[10px] font-semibold tracking-wider px-1.5 py-0.5 rounded border border-violet-400/50 text-violet-300 bg-violet-500/10"
          >
            SIMULATOR
          </span>
        )}
      </div>

      <nav className="flex items-center gap-1">
        {TABS.map((t) => {
          const count = t === 'Alarms' ? alarms.filter((a) => !a.acknowledged).length : 0;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                tab === t ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              {t}
              {count > 0 && <span className="ml-1.5 px-1.5 rounded-full bg-red-500/80 text-white text-[10px]">{count}</span>}
            </button>
          );
        })}
      </nav>

      <div className="flex-1" />

      <div className="flex items-center gap-2" aria-label="Alarm summary">
        {(['Critical', 'Warning', 'Caution'] as const).map((severity) => (
          <button
            key={severity}
            type="button"
            onClick={() => setTab('Alarms')}
            title={`${active(severity)} active, ${unacked(severity)} unacknowledged`}
            className={`text-[11px] font-mono px-2 py-0.5 rounded border ${SEVERITY_STYLE[severity].chip} ${
              unacked(severity) > 0 ? 'alarm-flash' : active(severity) === 0 ? 'opacity-40' : ''
            }`}
          >
            {severity.slice(0, 4).toUpperCase()} {active(severity)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSound((s) => !s)}
          title="Audible alarm"
          className={`text-[11px] px-2 py-0.5 rounded border ${sound ? 'border-sky-500/60 text-sky-300' : 'border-slate-700 text-slate-500'}`}
        >
          {sound ? 'SOUND ON' : 'SOUND OFF'}
        </button>
      </div>

      {frame && (
        <div className="hidden lg:flex items-center gap-4 text-xs font-mono text-slate-300 tabular">
          <span><span className="text-slate-500">SOG </span>{formatNumber(frame.voyage.sogKnots, 1)} kn</span>
          <span><span className="text-slate-500">HDG </span>{formatBearing(frame.voyage.headingDeg)}</span>
        </div>
      )}

      <div className="text-right leading-tight">
        <div className="text-sm font-mono text-slate-200 tabular">{formatTime(now)}</div>
        <div className="text-[10px] text-slate-500">UTC</div>
      </div>

      <div className="flex items-center gap-2 min-w-[110px]">
        <span className={`w-2 h-2 rounded-full ${link.dot}`} />
        <span className={`text-xs font-semibold ${link.text}`}>{link.label}</span>
      </div>
    </header>
  );
}
