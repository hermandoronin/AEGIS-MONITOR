import { useCallback, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ChannelDef } from '../../shared/types';
import type { Sample } from '../store/useVesselStore';
import { formatTime, formatValue } from '../utils/formatters';
import { STATE_COLOR } from '../utils/limits';

interface TrendChartProps {
  channel: ChannelDef;
  samples: Sample[];
  height?: number;
  color?: string;
}

interface ChartMouseEvent {
  activeLabel?: number | string;
}

/** Rolling trend of one tag with its alarm limits. Drag across the plot to zoom. */
export default function TrendChart({ channel, samples, height = 200, color = '#38bdf8' }: TrendChartProps) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragTo, setDragTo] = useState<number | null>(null);
  const [zoom, setZoom] = useState<[number, number] | null>(null);

  const data = useMemo(
    () => samples.map((s) => ({ t: s.t, value: s.v[channel.tag] ?? null })),
    [samples, channel.tag],
  );
  const visible = zoom ? data.filter((d) => d.t >= zoom[0] && d.t <= zoom[1]) : data;

  const onDown = useCallback((e: ChartMouseEvent) => {
    if (typeof e?.activeLabel === 'number') setDragFrom(e.activeLabel);
  }, []);
  const onMove = useCallback((e: ChartMouseEvent) => {
    if (dragFrom !== null && typeof e?.activeLabel === 'number') setDragTo(e.activeLabel);
  }, [dragFrom]);
  const onUp = useCallback(() => {
    if (dragFrom !== null && dragTo !== null && dragFrom !== dragTo) {
      setZoom(dragFrom < dragTo ? [dragFrom, dragTo] : [dragTo, dragFrom]);
    }
    setDragFrom(null);
    setDragTo(null);
  }, [dragFrom, dragTo]);

  const rule = channel.alarm;
  const limits: { y: number; color: string }[] = [];
  if (rule && rule.type !== 'state') {
    const sides = rule.type === 'abs' ? [1, -1] : [1];
    for (const sign of sides) {
      if (rule.warning !== undefined) limits.push({ y: sign * rule.warning, color: STATE_COLOR.warning });
      if (rule.critical !== undefined) limits.push({ y: sign * rule.critical, color: STATE_COLOR.critical });
    }
  }

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-1 text-xs">
        <span className="text-slate-300">
          {channel.label} <span className="text-slate-500">({channel.unit}) · {channel.tag}</span>
        </span>
        {zoom ? (
          <button type="button" onClick={() => setZoom(null)} className="text-sky-400 hover:underline">
            Reset zoom
          </button>
        ) : (
          <span className="text-slate-600">drag to zoom</span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={visible} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(t: number) => formatTime(t).slice(0, 5)}
            tick={{ fontSize: 10, fill: '#64748b' }}
            minTickGap={40}
          />
          <YAxis
            domain={['auto', 'auto']}
            tick={{ fontSize: 10, fill: '#64748b' }}
            width={52}
            tickFormatter={(v: number) => formatValue({ ...channel, decimals: Math.min(channel.decimals, 2) }, v)}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', fontSize: 11 }}
            labelFormatter={(t) => `${formatTime(Number(t))} UTC`}
            formatter={(v) => [`${formatValue(channel, Number(v))} ${channel.unit}`, channel.label]}
          />
          {limits.map((l) => (
            <ReferenceLine key={l.y} y={l.y} stroke={l.color} strokeDasharray="4 4" ifOverflow="discard" />
          ))}
          <Line type="monotone" dataKey="value" stroke={color} dot={false} strokeWidth={1.6} isAnimationActive={false} connectNulls />
          {dragFrom !== null && dragTo !== null && (
            <ReferenceArea x1={dragFrom} x2={dragTo} fill="#38bdf8" fillOpacity={0.12} strokeOpacity={0.3} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
