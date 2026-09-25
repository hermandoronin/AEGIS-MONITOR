import { SYSTEM_NAMES } from '../../shared/types';
import type { AlarmSeverity, SystemStatus } from '../../shared/types';
import { useVesselStore } from '../store/useVesselStore';
import { STATE_DOT } from './ui';

const BADGE: Record<AlarmSeverity, string> = {
  Critical: 'bg-red-500 text-white',
  Warning: 'bg-orange-400 text-slate-950',
  Caution: 'bg-yellow-300 text-slate-950',
};

export default function SystemSidebar() {
  const frame = useVesselStore((s) => s.frame);
  const alarms = useVesselStore((s) => s.alarms);
  const tab = useVesselStore((s) => s.tab);
  const selected = useVesselStore((s) => s.selectedSystem);
  const openSystem = useVesselStore((s) => s.openSystem);

  const statusOf = (name: string): SystemStatus | undefined => frame?.systems.find((s) => s.name === name);

  return (
    <aside className="hidden md:flex w-60 shrink-0 bg-slate-950 border-r border-slate-800 p-3 flex-col gap-1">
      <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">Ship systems</h2>
      {SYSTEM_NAMES.map((name) => {
        const status = statusOf(name);
        const open = alarms.filter((a) => a.source === name && !a.acknowledged);
        const worst = (['Critical', 'Warning', 'Caution'] as const).find((sev) => open.some((a) => a.severity === sev));
        const isActive = tab === 'Machinery' && selected === name;
        return (
          <button
            key={name}
            type="button"
            onClick={() => openSystem(name)}
            className={`flex items-center gap-2.5 px-2 py-2 rounded text-sm text-left transition-colors ${
              isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-900'
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATE_DOT[status?.state ?? 'Offline']}`} />
            <span className="flex-1">
              <span className="block leading-tight">{name}</span>
              <span className="block text-[10px] text-slate-500">
                {status ? `${status.state} · ${status.activeSensors}/${status.totalSensors} points` : 'no data'}
              </span>
            </span>
            {worst && (
              <span className={`text-[10px] font-bold px-1.5 rounded-full ${BADGE[worst]} alarm-flash`}>{open.length}</span>
            )}
          </button>
        );
      })}

      <div className="mt-auto pt-4 px-2 text-[10px] text-slate-500 space-y-1">
        {(['Running', 'Standby', 'Fault', 'Offline'] as const).map((state) => (
          <div key={state} className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${STATE_DOT[state]}`} /> {state}
          </div>
        ))}
      </div>
    </aside>
  );
}
