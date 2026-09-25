import { useMemo } from 'react';
import { getChannel } from '../../shared/channels';
import type { VoyageState } from '../../shared/types';
import TrendChart from '../components/TrendChart';
import { Panel, Stat } from '../components/ui';
import { useVesselStore } from '../store/useVesselStore';
import {
  formatBearing,
  formatDateTime,
  formatDuration,
  formatLatitude,
  formatLongitude,
  formatNumber,
} from '../utils/formatters';

/** Plane-sailing plot of the passage plan with the ship's position. */
function RouteMap({ voyage }: { voyage: VoyageState }) {
  const { route } = voyage;
  const lats = route.map((w) => w.lat).concat(voyage.lat);
  const lons = route.map((w) => w.lon).concat(voyage.lon);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180);
  // Pad east-west so the plot is not a thin strip on a wide panel.
  const padLat = 0.4;
  const padLon = 2.5;
  const x0 = Math.min(...lons) - padLon;
  const y1 = Math.max(...lats) + padLat;
  const w = (Math.max(...lons) - Math.min(...lons) + 2 * padLon) * kx;
  const h = Math.max(...lats) - Math.min(...lats) + 2 * padLat;
  const scale = 300 / h;
  const project = (lat: number, lon: number) => ({ x: (lon - x0) * kx * scale, y: (y1 - lat) * scale });
  const width = w * scale;
  const next = route.findIndex((p) => p.name === voyage.nextWaypoint);
  const ship = project(voyage.lat, voyage.lon);
  const points = route.map((p) => project(p.lat, p.lon));
  const done = [...points.slice(0, Math.max(next, 1)), ship];
  const ahead = [ship, ...points.slice(Math.max(next, 1))];
  const line = (pts: { x: number; y: number }[]) => pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const hdg = (voyage.headingDeg * Math.PI) / 180;

  return (
    <svg viewBox={`-10 -10 ${width + 20} 320`} className="w-full h-80" role="img" aria-label="Passage plan">
      {Array.from({ length: Math.ceil(h) + 1 }, (_, i) => Math.floor(y1) - i).map((lat) => {
        const y = project(lat, x0).y;
        return (
          <g key={`lat${lat}`}>
            <line x1={0} x2={width} y1={y} y2={y} stroke="#1e293b" strokeDasharray="2 4" />
            <text x={width - 2} y={y - 3} fontSize="9" fill="#475569" textAnchor="end">{lat}°N</text>
          </g>
        );
      })}
      <polyline points={line(done)} fill="none" stroke="#64748b" strokeWidth="2" />
      <polyline points={line(ahead)} fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="6 4" />
      {route.map((p, i) => {
        const { x, y } = points[i];
        const passed = i < next;
        return (
          <g key={p.name}>
            <circle cx={x} cy={y} r={4} fill={passed ? '#334155' : '#0ea5e9'} stroke="#0f172a" />
            <text x={x + 7} y={y + 3} fontSize="10" fill={passed ? '#64748b' : '#cbd5e1'}>{p.name}</text>
          </g>
        );
      })}
      <g transform={`translate(${ship.x} ${ship.y}) rotate(${(hdg * 180) / Math.PI})`}>
        <path d="M 0 -9 L 5 6 L 0 3 L -5 6 Z" fill="#facc15" stroke="#0f172a" />
      </g>
    </svg>
  );
}

export default function VoyageView() {
  const frame = useVesselStore((s) => s.frame)!;
  const history = useVesselStore((s) => s.history);
  const { voyage, values: v } = frame;

  const sfocAverage = useMemo(() => {
    const sfoc = history.map((s) => s.v['ME.SFOC']).filter((x) => Number.isFinite(x) && x > 0);
    return sfoc.length ? sfoc.reduce((a, b) => a + b, 0) / sfoc.length : Number.NaN;
  }, [history]);

  const hoursToGo = voyage.distanceToGoNm / Math.max(voyage.sogKnots, 1);
  const dailyT = (v['FO.TOTAL.FLOW'] * 24) / 1000;
  const robOnArrival = v['FO.ROB'] - (v['FO.TOTAL.FLOW'] / 1000) * hoursToGo;
  const progress = voyage.distanceRunNm / (voyage.distanceRunNm + voyage.distanceToGoNm);
  const sfocDelta = v['ME.SFOC'] - sfocAverage;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">
            {voyage.from} → {voyage.to}
          </h1>
          <p className="text-sm text-slate-400">
            Voyage {voyage.voyageNo} · departed {formatDateTime(voyage.departedAt)} · next waypoint {voyage.nextWaypoint}
          </p>
        </div>
        <div className="w-full sm:w-80">
          <div className="flex justify-between text-[11px] text-slate-500 mb-1">
            <span>{formatNumber(voyage.distanceRunNm, 1)} nm run</span>
            <span>{formatNumber(progress * 100, 0)}%</span>
            <span>{formatNumber(voyage.distanceToGoNm, 1)} nm to go</span>
          </div>
          <div className="h-2 bg-slate-800 rounded">
            <div className="h-2 bg-sky-500 rounded" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
        <Stat label="Position" value={<span className="text-sm">{formatLatitude(voyage.lat)}<br />{formatLongitude(voyage.lon)}</span>} />
        <Stat label="Heading" value={formatBearing(voyage.headingDeg)} />
        <Stat label="SOG / STW" value={`${formatNumber(voyage.sogKnots, 1)} / ${formatNumber(voyage.stwKnots, 1)}`} unit="kn" />
        <Stat label="ETA" value={<span className="text-sm">{formatDateTime(voyage.etaMs)}</span>} />
        <Stat label="Time to go" value={formatDuration(hoursToGo * 3_600_000)} />
        <Stat label="Wind" value={`${formatNumber(voyage.windSpeedKn, 0)} kn / ${formatBearing(voyage.windDirDeg)}`} />
        <Stat label="Sea state" value={`BF ${voyage.beaufort}`} />
        <Stat label="Sea temp" value={formatNumber(v['SW.TEMP'], 1)} unit="°C" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel title="Passage plan" className="xl:col-span-2">
          <RouteMap voyage={voyage} />
        </Panel>
        <Panel title="Fuel and efficiency">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="SFOC now" value={formatNumber(v['ME.SFOC'], 1)} unit="g/kWh" tone="text-sky-300" />
            <Stat
              label="vs 15 min avg"
              value={`${sfocDelta >= 0 ? '+' : ''}${formatNumber(sfocDelta, 1)}`}
              unit="g/kWh"
              tone={sfocDelta <= 0 ? 'text-green-400' : 'text-orange-300'}
            />
            <Stat label="Consumption" value={formatNumber(dailyT, 1)} unit="t/day" />
            <Stat label="Burned this voyage" value={formatNumber(voyage.fuelConsumedT, 1)} unit="t" />
            <Stat label="On board now" value={formatNumber(v['FO.ROB'], 1)} unit="t" />
            <Stat label="On board at arrival" value={formatNumber(robOnArrival, 1)} unit="t" />
          </div>
          <p className="text-[11px] text-slate-500 mt-3">
            Consumption covers the main engine and the generator sets. SFOC is fuel mass flow over
            shaft power; a sustained rise at the same load points to fouling, injector wear or poor
            fuel.
          </p>
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel title="Main engine fuel flow">
          <TrendChart channel={getChannel('ME.FO.FLOW')} samples={history} height={200} />
        </Panel>
        <Panel title="Specific fuel oil consumption">
          <TrendChart channel={getChannel('ME.SFOC')} samples={history} height={200} color="#34d399" />
        </Panel>
      </div>
    </div>
  );
}
