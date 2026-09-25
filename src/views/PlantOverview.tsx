import { CHANNELS, SYSTEM_INFO, getChannel } from '../../shared/channels';
import { SYSTEM_NAMES } from '../../shared/types';
import AlarmPanel from '../components/AlarmPanel';
import ShipModel from '../components/ShipModel';
import TrendChart from '../components/TrendChart';
import { Panel, Stat, StateBadge } from '../components/ui';
import { useAlarmActions } from '../hooks/useAlarmActions';
import { useVesselStore } from '../store/useVesselStore';
import { formatNumber, formatValue } from '../utils/formatters';
import { STATE_COLOR, limitState } from '../utils/limits';

/** Whole-plant picture: key figures, one card per system, the section view and the alarm list. */
export default function PlantOverview({ stale }: { stale: boolean }) {
  const frame = useVesselStore((s) => s.frame)!;
  const history = useVesselStore((s) => s.history);
  const alarms = useVesselStore((s) => s.alarms);
  const openSystem = useVesselStore((s) => s.openSystem);
  const { acknowledge, acknowledgeAll } = useAlarmActions();
  const v = frame.values;

  const activeAlarms = alarms.filter((a) => a.active).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
        <Stat label="ME speed" value={formatNumber(v['ME.SPEED'], 1)} unit="rpm" />
        <Stat label="ME load" value={formatNumber(v['ME.LOAD'], 1)} unit="% MCR" />
        <Stat label="Shaft power" value={formatNumber(v['ME.SHAFT.POWER'])} unit="kW" />
        <Stat label="SFOC" value={formatNumber(v['ME.SFOC'], 1)} unit="g/kWh" />
        <Stat label="Speed (SOG)" value={formatNumber(frame.voyage.sogKnots, 1)} unit="kn" />
        <Stat label="Electrical load" value={formatNumber(v['MSB.LOAD'])} unit="kW" />
        <Stat label="Fuel on board" value={formatNumber(v['FO.ROB'], 1)} unit="t" />
        <Stat
          label="Active alarms"
          value={activeAlarms}
          tone={alarms.some((a) => a.active && a.severity === 'Critical') ? 'text-red-400' : activeAlarms > 0 ? 'text-orange-300' : 'text-green-400'}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {SYSTEM_NAMES.map((name) => {
          const status = frame.systems.find((s) => s.name === name);
          const open = alarms.filter((a) => a.source === name);
          return (
            <button
              key={name}
              type="button"
              onClick={() => openSystem(name)}
              className="text-left bg-slate-900/80 border border-slate-800 hover:border-slate-600 rounded-lg p-3 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-slate-100">{name}</span>
                {status && <StateBadge state={status.state} />}
              </div>
              <p className="text-[11px] text-slate-500 mb-2 line-clamp-2">{SYSTEM_INFO[name].summary}</p>
              <dl className="flex flex-col gap-0.5">
                {SYSTEM_INFO[name].keyTags.map((tag) => {
                  const channel = getChannel(tag);
                  const state = limitState(channel, v[tag], v);
                  return (
                    <div key={tag} className="flex items-baseline justify-between gap-2 text-xs">
                      <dt className="text-slate-400 truncate">{channel.label}</dt>
                      <dd className="font-mono tabular" style={{ color: stale ? '#64748b' : state === 'normal' ? '#e2e8f0' : STATE_COLOR[state] }}>
                        {formatValue(channel, v[tag])}
                        <span className="text-slate-500 text-[10px] ml-0.5">{channel.unit}</span>
                      </dd>
                    </div>
                  );
                })}
              </dl>
              <div className="mt-2 text-[11px] text-slate-500">
                {open.length === 0 ? 'No alarms' : `${open.filter((a) => a.active).length} active · ${open.filter((a) => !a.acknowledged).length} unacknowledged`}
                {' · '}
                {CHANNELS.filter((c) => c.system === name).length} points
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel title="Machinery spaces">
          <ShipModel systems={frame.systems} alarms={alarms} selected={null} onSelect={(s) => openSystem(s)} />
        </Panel>
        <Panel title="Alarms">
          <AlarmPanel alarms={alarms} onAcknowledge={acknowledge} onAcknowledgeAll={acknowledgeAll} maxHeight="max-h-64" />
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel title="Main engine load">
          <TrendChart channel={getChannel('ME.LOAD')} samples={history} height={180} />
        </Panel>
        <Panel title="Electrical load">
          <TrendChart channel={getChannel('MSB.LOAD')} samples={history} height={180} color="#a78bfa" />
        </Panel>
      </div>
    </div>
  );
}
