/**
 * Data model shared by the monitoring server and the dashboard.
 *
 * Everything that crosses the wire (WebSocket frames, REST responses) is typed
 * here once, so the server and the browser cannot drift apart.
 */

/** Machinery groups shown in the sidebar, in engine-room order. */
export const SYSTEM_NAMES = [
  'Main Engine',
  'Generators',
  'Fuel System',
  'Cooling Water',
  'Steering Gear',
  'HVAC',
  'Ballast System',
] as const;

export type SystemName = (typeof SYSTEM_NAMES)[number];

export type SystemState = 'Running' | 'Standby' | 'Fault' | 'Offline';

/**
 * Alert priorities, highest first. Critical maps to an IEC 62923 "alarm",
 * Warning to a "warning", Caution to a "caution" (e.g. a sensor fault).
 */
export type AlarmSeverity = 'Critical' | 'Warning' | 'Caution';

/** Where a signal physically comes from on a real installation. */
export type SignalSource =
  | 'J1939'
  | 'NMEA 2000'
  | 'Modbus TCP'
  | 'Analog 4-20 mA'
  | 'Calculated';

/**
 * analog  -- continuous measurement, drawn as a gauge
 * digital -- 0/1 status (pump running, breaker tripped)
 * counter -- monotonic or slowly moving total (running hours, fuel on board)
 */
export type ChannelKind = 'analog' | 'digital' | 'counter';

export type AlarmRule =
  /** Alarm when the value rises to a limit (temperatures, overspeed). */
  | { type: 'high'; warning?: number; critical?: number }
  /** Alarm when the value falls to a limit (pressures, levels). */
  | { type: 'low'; warning?: number; critical?: number }
  /** Alarm on the magnitude, either sign (list angle). */
  | { type: 'abs'; warning?: number; critical?: number }
  /** Digital alarm, raised while the channel reads 1. */
  | { type: 'state'; severity: AlarmSeverity; text: string };

/** One row of the IO list: a monitored point on the vessel. */
export interface ChannelDef {
  /** Unique point name, e.g. `ME.LO.PRESS`. */
  tag: string;
  label: string;
  system: SystemName;
  /** Sub-heading inside the system page (e.g. `DG1`, `Exhaust`). */
  group: string;
  kind: ChannelKind;
  unit: string;
  /** Instrument range. Readings well outside it are treated as a sensor fault. */
  min: number;
  max: number;
  decimals: number;
  source: SignalSource;
  /** Bus address on a real installation: PGN/SPN, Modbus register, PLC input. */
  address: string;
  alarm?: AlarmRule;
  /** Digital tag that must read 1 for this point's alarms to be active (alarm blocking). */
  inhibitedBy?: string;
  /** What the point tells the engineer and why it is monitored. */
  description: string;
}

/** One occurrence of an alarm, from raise to acknowledged-and-cleared. */
export interface AlarmEvent {
  /** Unique per occurrence. */
  id: string;
  /** Alarm point, `${tag}:${level}`. A point raises at most one open event at a time. */
  pointId: string;
  tag: string;
  severity: AlarmSeverity;
  message: string;
  source: SystemName;
  raisedAt: number;
  /** Reading when the alarm was raised. */
  value: number;
  /** Limit that was crossed, null for digital and sensor-fault alarms. */
  limit: number | null;
  unit: string;
  active: boolean;
  acknowledged: boolean;
  acknowledgedAt: number | null;
  clearedAt: number | null;
}

export interface SystemStatus {
  name: SystemName;
  state: SystemState;
  /** Channels delivering a plausible value. */
  activeSensors: number;
  totalSensors: number;
  /** Alarms currently active (acknowledged or not). */
  activeAlarms: number;
  /** Alarms waiting for an acknowledgement (active or already cleared). */
  unacknowledged: number;
}

export interface Waypoint {
  name: string;
  lat: number;
  lon: number;
}

export interface VoyageState {
  voyageNo: string;
  from: string;
  to: string;
  /** Passage plan, departure first. */
  route: Waypoint[];
  nextWaypoint: string;
  departedAt: number;
  lat: number;
  lon: number;
  headingDeg: number;
  sogKnots: number;
  stwKnots: number;
  distanceRunNm: number;
  distanceToGoNm: number;
  etaMs: number;
  /** Fuel burned since departure, main engine plus generators. */
  fuelConsumedT: number;
  windSpeedKn: number;
  windDirDeg: number;
  beaufort: number;
}

/** Pushed over the WebSocket once per second. */
export interface TelemetryFrame {
  timestamp: number;
  /** Tag -> engineering value, in the units of the IO list. */
  values: Record<string, number>;
  systems: SystemStatus[];
  /** Alarms that are active or still need an acknowledgement, newest first. */
  alarms: AlarmEvent[];
  voyage: VoyageState;
  /** Fault scenarios currently injected into the simulator. */
  scenarios: string[];
}

/** Compact history: one row per second, `[timestamp, ...values in tag order]`. */
export interface HistoryPayload {
  tags: string[];
  rows: number[][];
}

export interface VesselInfo {
  vesselId: string;
  name: string;
  imo: string;
  callSign: string;
  flag: string;
  type: string;
  built: number;
  deadweightT: number;
  lengthM: number;
  beamM: number;
  mainEngine: string;
  mcrKw: number;
  mcrRpm: number;
  generators: string;
  /** True while the data comes from the bundled plant simulator. */
  simulated: boolean;
}

export interface ScenarioInfo {
  id: string;
  title: string;
  system: SystemName;
  /** What physically goes wrong. */
  description: string;
  /** What the operator should see on the dashboard. */
  expected: string;
  active: boolean;
}
