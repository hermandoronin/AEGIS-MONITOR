import { SYSTEM_INFO, channelsOf } from '../../shared/channels';
import { SYSTEM_NAMES, type ChannelDef, type SystemName } from '../../shared/types';
import AlarmPanel from '../components/AlarmPanel';
import { CounterTile, DigitalIndicator } from '../components/DigitalIndicator';
import GaugeWidget from '../components/GaugeWidget';
import TrendChart from '../components/TrendChart';
import { Panel, StateBadge } from '../components/ui';
import { useAlarmActions } from '../hooks/useAlarmActions';
import { useVesselStore } from '../store/useVesselStore';
import { formatValue } from '../utils/formatters';
import { STATE_COLOR, limitState } from '../utils/limits';

function limitsText(channel: ChannelDef): string {
  const rule = channel.alarm;
  if (!rule) return '—';
  if (rule.type === 'state') return `${rule.severity} when active`;
  const sign = rule.type === 'low' ? '≤' : rule.type === 'abs' ? '|x| ≥' : '≥';
  const parts = [];
  if (rule.warning !== undefined) parts.push(`W ${sign} ${rule.warning}`);
  if (rule.critical !== undefined) parts.push(`C ${sign} ${rule.critical}`);
  return parts.join(' · ');
}

/** Exhaust temperature per cylinder against the engine mean: the classic ME balance picture. */
function CylinderBalance({ values }: { values: Record<string, number> }) {
  const temps = [1, 2, 3, 4, 5, 6].map((n) => values[`ME.EXH.CYL${n}`]);
  const mean = temps.reduce((a, b) => a + b, 0) / temps.length;
  return (
    <div className="flex items-end gap-3 h-36 px-2">
      {temps.map((t, i) => {
        const deviation = t - mean;
        const color = Math.abs(deviation) > 40 ? STATE_COLOR.critical : Math.abs(deviation) > 25 ? STATE_COLOR.warning : '#38bdf8';
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[10px] font-mono tabular text-slate-400">
              {deviation >= 0 ? '+' : ''}
              {deviation.toFixed(0)}
            </span>
            <div className="w-full bg-slate-800 rounded-t relative" style={{ height: 80 }}>
              <div className="absolute bottom-0 w-full rounded-t" style={{ height: `${Math.max(4, Math.min(100, ((t - 250) / 250) * 100))}%`, background: color }} />
            </div>
            <span className="text-[11px] font-mono tabular text-slate-200">{t.toFixed(0)}</span>
            <span className="text-[10px] text-slate-500">Cyl {i + 1}</span>
          </div>
        );
      })}
      <div className="text-[11px] text-slate-400 self-center pl-2 border-l border-slate-800">
        Mean
        <div className="font-mono text-slate-100 text-sm tabular">{mean.toFixed(0)} °C</div>
        <div className="text-slate-500 mt-1">deviation per cylinder</div>
      </div>
    </div>
  );
}

export default function SystemView({ stale }: { stale: boolean }) {
  const system = useVesselStore((s) => s.selectedSystem);
  const frame = useVesselStore((s) => s.frame)!;
  const history = useVesselStore((s) => s.history);
  const alarms = useVesselStore((s) => s.alarms);
  const selectedTag = useVesselStore((s) => s.selectedTag);
  const selectTag = useVesselStore((s) => s.selectTag);
  const openSystem = useVesselStore((s) => s.openSystem);
  const { acknowledge, acknowledgeAll } = useAlarmActions();

  const channels = channelsOf(system);
  const status = frame.systems.find((s) => s.name === system);
  const groups = [...new Set(channels.map((c) => c.group))];
  const analog = channels.filter((c) => c.kind === 'analog');
  const trendChannel = channels.find((c) => c.tag === selectedTag && c.kind === 'analog') ?? analog[0];
  const v = frame.values;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-white">{system}</h1>
            {status && <StateBadge state={status.state} />}
          </div>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">{SYSTEM_INFO[system].summary}</p>
        </div>
        {/* The sidebar is hidden on narrow screens; pick the system here instead. */}
        <select
          value={system}
          onChange={(e) => openSystem(e.target.value as SystemName)}
          className="md:hidden bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm"
        >
          {SYSTEM_NAMES.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        {status && (
          <div className="text-xs text-slate-400">
            {status.activeSensors}/{status.totalSensors} points healthy · {status.activeAlarms} active alarms
          </div>
        )}
      </div>

      {groups.map((group) => {
        const inGroup = channels.filter((c) => c.group === group);
        const gauges = inGroup.filter((c) => c.kind === 'analog');
        const others = inGroup.filter((c) => c.kind !== 'analog');
        return (
          <Panel key={group} title={group}>
            {gauges.length > 0 && (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-1">
                {gauges.map((c) => (
                  <GaugeWidget key={c.tag} channel={c} value={v[c.tag]} values={v} stale={stale} selected={trendChannel?.tag === c.tag} onSelect={selectTag} />
                ))}
              </div>
            )}
            {others.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
                {others.map((c) =>
                  c.kind === 'digital' ? (
                    <DigitalIndicator key={c.tag} channel={c} value={v[c.tag]} stale={stale} />
                  ) : (
                    <CounterTile key={c.tag} channel={c} value={v[c.tag]} />
                  ),
                )}
              </div>
            )}
          </Panel>
        );
      })}

      {system === 'Main Engine' && (
        <Panel title="Exhaust gas temperature balance">
          <CylinderBalance values={v} />
        </Panel>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel title="Trend (click a gauge to change)" className="xl:col-span-2">
          {trendChannel && <TrendChart channel={trendChannel} samples={history} height={240} />}
          {trendChannel && <p className="text-xs text-slate-500 mt-2">{trendChannel.description}</p>}
        </Panel>
        <Panel title={`${system} alarms`}>
          <AlarmPanel
            alarms={alarms.filter((a) => a.source === system)}
            onAcknowledge={acknowledge}
            onAcknowledgeAll={acknowledgeAll}
            maxHeight="max-h-72"
          />
        </Panel>
      </div>

      <Panel title={`IO list — ${channels.length} points`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-slate-500 border-b border-slate-800">
              <tr>
                <th className="py-1.5 pr-3 font-medium">Tag</th>
                <th className="py-1.5 pr-3 font-medium">Point</th>
                <th className="py-1.5 pr-3 font-medium text-right">Value</th>
                <th className="py-1.5 pr-3 font-medium">Range</th>
                <th className="py-1.5 pr-3 font-medium">Alarm limits</th>
                <th className="py-1.5 pr-3 font-medium">Source</th>
                <th className="py-1.5 font-medium">Address</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => {
                const state = limitState(c, v[c.tag], v);
                return (
                  <tr key={c.tag} className="border-b border-slate-900 hover:bg-slate-900/60" title={c.description}>
                    <td className="py-1.5 pr-3 font-mono text-slate-400">{c.tag}</td>
                    <td className="py-1.5 pr-3 text-slate-200">{c.label}</td>
                    <td className="py-1.5 pr-3 font-mono tabular text-right" style={{ color: state === 'normal' ? '#e2e8f0' : STATE_COLOR[state] }}>
                      {formatValue(c, v[c.tag])} <span className="text-slate-500">{c.unit}</span>
                    </td>
                    <td className="py-1.5 pr-3 text-slate-400 whitespace-nowrap">
                      {c.kind === 'digital' ? '0 / 1' : `${c.min} … ${c.max}`}
                    </td>
                    <td className="py-1.5 pr-3 text-slate-400 whitespace-nowrap">
                      {limitsText(c)}
                      {c.inhibitedBy && <span className="text-slate-600"> · blocked by {c.inhibitedBy}</span>}
                    </td>
                    <td className="py-1.5 pr-3 text-slate-400 whitespace-nowrap">{c.source}</td>
                    <td className="py-1.5 font-mono text-slate-500 whitespace-nowrap">{c.address}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
