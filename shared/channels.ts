/**
 * IO list: every point the monitor knows about, with its range, alarm limits,
 * signal source and the reason it is watched.
 *
 * This table is the single source of truth. The simulator produces values for
 * these tags, the acquisition layer decodes the fieldbus ones, the alarm engine
 * evaluates the limits, and the dashboard lays out gauges from it. Adding a
 * sensor means adding a row here.
 */
import type { ChannelDef, SystemName } from './types';

const MAIN_ENGINE: ChannelDef[] = [
  {
    tag: 'ME.SPEED', label: 'ME speed', system: 'Main Engine', group: 'Performance',
    kind: 'analog', unit: 'rpm', min: 0, max: 140, decimals: 1,
    source: 'Modbus TCP', address: 'ECS IR 30001',
    alarm: { type: 'high', warning: 126, critical: 130 },
    description: 'Crankshaft speed from the engine control system. Overspeed (105% / 108% of MCR speed) precedes the overspeed trip.',
  },
  {
    tag: 'ME.LOAD', label: 'ME load', system: 'Main Engine', group: 'Performance',
    kind: 'analog', unit: '% MCR', min: 0, max: 110, decimals: 1,
    source: 'Modbus TCP', address: 'ECS IR 30002',
    alarm: { type: 'high', warning: 100, critical: 105 },
    description: 'Engine load as a share of maximum continuous rating. Running above 100% MCR overloads the engine.',
  },
  {
    tag: 'ME.SHAFT.POWER', label: 'Shaft power', system: 'Main Engine', group: 'Performance',
    kind: 'analog', unit: 'kW', min: 0, max: 9000, decimals: 0,
    source: 'Modbus TCP', address: 'Torsionmeter IR 30010',
    description: 'Power delivered to the propeller shaft, measured by the torsionmeter. Basis for SFOC and EEXI/CII reporting.',
  },
  {
    tag: 'ME.FO.FLOW', label: 'ME fuel flow', system: 'Main Engine', group: 'Performance',
    kind: 'analog', unit: 'kg/h', min: 0, max: 2000, decimals: 0,
    source: 'Modbus TCP', address: 'Coriolis FM IR 30020',
    description: 'Mass fuel flow to the main engine from the Coriolis flowmeter (supply minus return).',
  },
  {
    tag: 'ME.SFOC', label: 'SFOC', system: 'Main Engine', group: 'Performance',
    kind: 'analog', unit: 'g/kWh', min: 140, max: 240, decimals: 1,
    source: 'Calculated', address: 'ME.FO.FLOW / ME.SHAFT.POWER',
    description: 'Specific fuel oil consumption. The single best indicator of engine efficiency; a rising trend means fouling, worn injectors or bad fuel.',
  },
  {
    tag: 'ME.LO.PRESS', label: 'LO inlet pressure', system: 'Main Engine', group: 'Lubrication & cooling',
    kind: 'analog', unit: 'bar', min: 0, max: 6, decimals: 2,
    source: 'Analog 4-20 mA', address: 'PLC AI 1.01',
    alarm: { type: 'low', warning: 3.4, critical: 2.9 },
    description: 'Main lube oil pressure at the engine inlet. Low pressure starves bearings; the engine slows down and then shuts down.',
  },
  {
    tag: 'ME.LO.TEMP', label: 'LO inlet temp', system: 'Main Engine', group: 'Lubrication & cooling',
    kind: 'analog', unit: '°C', min: 20, max: 80, decimals: 1,
    source: 'Analog 4-20 mA', address: 'PLC AI 1.02',
    alarm: { type: 'high', warning: 55, critical: 60 },
    description: 'Lube oil temperature after the LO cooler. High temperature thins the oil film.',
  },
  {
    tag: 'ME.HT.TEMP', label: 'HT CW outlet temp', system: 'Main Engine', group: 'Lubrication & cooling',
    kind: 'analog', unit: '°C', min: 20, max: 110, decimals: 1,
    source: 'Analog 4-20 mA', address: 'PLC AI 1.03',
    alarm: { type: 'high', warning: 90, critical: 95 },
    description: 'Jacket (high-temperature) cooling water leaving the engine. Held near 82 °C by the thermostatic valve.',
  },
  {
    tag: 'ME.THRUST.TEMP', label: 'Thrust bearing temp', system: 'Main Engine', group: 'Lubrication & cooling',
    kind: 'analog', unit: '°C', min: 20, max: 100, decimals: 1,
    source: 'Analog 4-20 mA', address: 'PLC AI 1.04',
    alarm: { type: 'high', warning: 75, critical: 80 },
    description: 'Thrust bearing pad temperature. It carries the whole propeller thrust; a rise means lubrication trouble.',
  },
  {
    tag: 'ME.SCAV.PRESS', label: 'Scavenge air pressure', system: 'Main Engine', group: 'Air & exhaust',
    kind: 'analog', unit: 'bar', min: 0, max: 4, decimals: 2,
    source: 'Analog 4-20 mA', address: 'PLC AI 1.05',
    description: 'Charge air pressure in the scavenge receiver. Falls when the turbocharger or air cooler is fouled.',
  },
  {
    tag: 'ME.SCAV.TEMP', label: 'Scavenge air temp', system: 'Main Engine', group: 'Air & exhaust',
    kind: 'analog', unit: '°C', min: 20, max: 90, decimals: 1,
    source: 'Analog 4-20 mA', address: 'PLC AI 1.06',
    alarm: { type: 'high', warning: 55, critical: 65 },
    description: 'Charge air temperature after the air cooler. A sudden rise is the classic sign of a scavenge space fire.',
  },
  {
    tag: 'ME.TC.SPEED', label: 'Turbocharger speed', system: 'Main Engine', group: 'Air & exhaust',
    kind: 'analog', unit: 'rpm', min: 0, max: 20000, decimals: 0,
    source: 'Modbus TCP', address: 'ECS IR 30030',
    alarm: { type: 'high', warning: 18500, critical: 19500 },
    description: 'Turbocharger rotor speed. Overspeed damages the rotor; a drop at constant load points to fouling.',
  },
  ...Array.from({ length: 6 }, (_, i): ChannelDef => ({
    tag: `ME.EXH.CYL${i + 1}`, label: `Exh temp cyl ${i + 1}`, system: 'Main Engine', group: 'Air & exhaust',
    kind: 'analog', unit: '°C', min: 100, max: 550, decimals: 0,
    source: 'Analog 4-20 mA', address: `PLC AI 2.0${i + 1}`,
    alarm: { type: 'high', warning: 420, critical: 450 },
    description: 'Exhaust gas temperature after the cylinder. Comparing cylinders exposes a leaking injector or burnt exhaust valve.',
  })),
  {
    tag: 'ME.RUN.HOURS', label: 'Running hours', system: 'Main Engine', group: 'Counters',
    kind: 'counter', unit: 'h', min: 0, max: 200000, decimals: 1,
    source: 'Modbus TCP', address: 'ECS IR 30040',
    description: 'Total running hours. Drives the planned maintenance schedule (overhauls, liner calibration).',
  },
];

function generator(n: number): ChannelDef[] {
  const dg = `DG${n}`;
  const sa = `SA 0x0${n - 1}`;
  return [
    {
      tag: `${dg}.RUN`, label: `${dg} running`, system: 'Generators', group: dg,
      kind: 'digital', unit: '', min: 0, max: 1, decimals: 0,
      source: 'Modbus TCP', address: `PMS DI 1000${n}`,
      description: 'Engine running and breaker closed. Blocks the engine alarms while the set is stopped.',
    },
    {
      tag: `${dg}.TRIP`, label: `${dg} shutdown`, system: 'Generators', group: dg,
      kind: 'digital', unit: '', min: 0, max: 1, decimals: 0,
      source: 'Modbus TCP', address: `PMS DI 1001${n}`,
      alarm: { type: 'state', severity: 'Critical', text: `${dg} shutdown, breaker tripped` },
      description: 'Safety system shut the set down and opened its breaker. Load jumps onto the remaining sets.',
    },
    {
      tag: `${dg}.LOAD`, label: `${dg} load`, system: 'Generators', group: dg,
      kind: 'analog', unit: 'kW', min: 0, max: 1100, decimals: 0,
      source: 'Modbus TCP', address: `PMS IR 3010${n}`,
      alarm: { type: 'high', warning: 900, critical: 1000 },
      description: 'Active power from the set (rated 1,000 kWe). Above 90% the PMS starts the standby set.',
    },
    {
      tag: `${dg}.SPEED`, label: `${dg} speed`, system: 'Generators', group: dg,
      kind: 'analog', unit: 'rpm', min: 0, max: 2000, decimals: 0,
      source: 'J1939', address: `PGN 61444 SPN 190 ${sa}`,
      alarm: { type: 'high', warning: 1900, critical: 1960 },
      description: 'Engine speed from the genset ECU (EEC1). 1,800 rpm gives 60 Hz.',
    },
    {
      tag: `${dg}.HT.TEMP`, label: `${dg} coolant temp`, system: 'Generators', group: dg,
      kind: 'analog', unit: '°C', min: 20, max: 110, decimals: 0,
      source: 'J1939', address: `PGN 65262 SPN 110 ${sa}`,
      alarm: { type: 'high', warning: 95, critical: 100 },
      description: 'Engine coolant temperature from the ECU (ET1). Standby sets are kept preheated so they can take load at once.',
    },
    {
      tag: `${dg}.LO.PRESS`, label: `${dg} LO pressure`, system: 'Generators', group: dg,
      kind: 'analog', unit: 'bar', min: 0, max: 8, decimals: 2,
      source: 'J1939', address: `PGN 65263 SPN 100 ${sa}`,
      alarm: { type: 'low', warning: 3.0, critical: 2.5 },
      inhibitedBy: `${dg}.RUN`,
      description: 'Engine oil pressure from the ECU (EFL/P1). Blocked while the set is stopped, when zero pressure is normal.',
    },
  ];
}

const GENERATORS: ChannelDef[] = [
  ...generator(1),
  ...generator(2),
  ...generator(3),
  {
    tag: 'MSB.LOAD', label: 'Total electrical load', system: 'Generators', group: 'Switchboard',
    kind: 'analog', unit: 'kW', min: 0, max: 3000, decimals: 0,
    source: 'Modbus TCP', address: 'PMS IR 30110',
    description: 'Sum of all consumers on the main switchboard: reefers, pumps, fans, compressors, hotel load.',
  },
  {
    tag: 'MSB.FREQ', label: 'Bus frequency', system: 'Generators', group: 'Switchboard',
    kind: 'analog', unit: 'Hz', min: 55, max: 65, decimals: 2,
    source: 'Modbus TCP', address: 'PMS IR 30111',
    alarm: { type: 'low', warning: 58.8, critical: 58.0 },
    description: 'Main bus frequency. It sags when the running sets are overloaded, the step before a blackout.',
  },
  {
    tag: 'MSB.VOLT', label: 'Bus voltage', system: 'Generators', group: 'Switchboard',
    kind: 'analog', unit: 'V', min: 380, max: 500, decimals: 0,
    source: 'Modbus TCP', address: 'PMS IR 30112',
    alarm: { type: 'low', warning: 425, critical: 410 },
    description: 'Main bus voltage (440 V nominal), held by the generator AVRs.',
  },
  {
    tag: 'PMS.STBY.START', label: 'Standby start', system: 'Generators', group: 'Switchboard',
    kind: 'digital', unit: '', min: 0, max: 1, decimals: 0,
    source: 'Modbus TCP', address: 'PMS DI 10020',
    alarm: { type: 'state', severity: 'Caution', text: 'PMS started the standby generator' },
    description: 'The power management system has started, synchronised and connected the standby set.',
  },
  {
    tag: 'PMS.LOAD.SHED', label: 'Load shedding', system: 'Generators', group: 'Switchboard',
    kind: 'digital', unit: '', min: 0, max: 1, decimals: 0,
    source: 'Modbus TCP', address: 'PMS DI 10021',
    alarm: { type: 'state', severity: 'Warning', text: 'PMS tripped non-essential consumers' },
    description: 'Preferential trip: non-essential consumers are disconnected to save the bus from overload.',
  },
];

const FUEL: ChannelDef[] = [
  {
    tag: 'FO.VISC', label: 'FO viscosity', system: 'Fuel System', group: 'Fuel treatment',
    kind: 'analog', unit: 'cSt', min: 0, max: 40, decimals: 1,
    source: 'Analog 4-20 mA', address: 'PLC AI 3.01',
    alarm: { type: 'high', warning: 17, critical: 20 },
    description: 'Heavy fuel viscosity at the engine inlet. Injectors need 10-15 cSt; too viscous fuel atomises badly.',
  },
  {
    tag: 'FO.TEMP', label: 'FO inlet temp', system: 'Fuel System', group: 'Fuel treatment',
    kind: 'analog', unit: '°C', min: 20, max: 160, decimals: 1,
    source: 'Analog 4-20 mA', address: 'PLC AI 3.02',
    description: 'Fuel temperature after the steam heater. The viscosity controller moves it to hold viscosity.',
  },
  {
    tag: 'FO.BOOST.PRESS', label: 'Booster pressure', system: 'Fuel System', group: 'Fuel treatment',
    kind: 'analog', unit: 'bar', min: 0, max: 12, decimals: 2,
    source: 'Analog 4-20 mA', address: 'PLC AI 3.03',
    alarm: { type: 'low', warning: 6.5, critical: 5.5 },
    description: 'Fuel supply pressure to the engine fuel pumps from the booster (circulating) pumps.',
  },
  {
    tag: 'FO.SERV.LEVEL', label: 'Service tank level', system: 'Fuel System', group: 'Tanks',
    kind: 'analog', unit: '%', min: 0, max: 100, decimals: 1,
    source: 'Analog 4-20 mA', address: 'PLC AI 3.04',
    alarm: { type: 'low', warning: 35, critical: 20 },
    description: 'Daily service tank, topped up continuously by the purifiers. A falling level means a purifier has stopped.',
  },
  {
    tag: 'FO.TOTAL.FLOW', label: 'Total fuel flow', system: 'Fuel System', group: 'Tanks',
    kind: 'analog', unit: 'kg/h', min: 0, max: 2500, decimals: 0,
    source: 'Calculated', address: 'ME.FO.FLOW + generator consumption',
    description: 'Whole-ship fuel consumption: main engine plus generator sets.',
  },
  {
    tag: 'FO.ROB', label: 'Fuel remaining on board', system: 'Fuel System', group: 'Tanks',
    kind: 'counter', unit: 't', min: 0, max: 1500, decimals: 1,
    source: 'Calculated', address: 'bunkers - consumption',
    description: 'Remaining on board. Planned against the distance to go so the ship never runs short.',
  },
];

const COOLING: ChannelDef[] = [
  {
    tag: 'SW.PRESS', label: 'SW pump discharge', system: 'Cooling Water', group: 'Sea water',
    kind: 'analog', unit: 'bar', min: 0, max: 4, decimals: 2,
    source: 'Analog 4-20 mA', address: 'PLC AI 4.01',
    alarm: { type: 'low', warning: 1.4, critical: 1.0 },
    description: 'Sea water cooling pump pressure. Loss of sea water means loss of all engine-room cooling.',
  },
  {
    tag: 'SW.TEMP', label: 'Sea water temp', system: 'Cooling Water', group: 'Sea water',
    kind: 'analog', unit: '°C', min: -2, max: 35, decimals: 1,
    source: 'NMEA 2000', address: 'PGN 130312 source 0',
    description: 'Sea temperature. Sets how much heat the central coolers can reject.',
  },
  {
    tag: 'LT.TEMP', label: 'LT CW temp', system: 'Cooling Water', group: 'Fresh water',
    kind: 'analog', unit: '°C', min: 10, max: 60, decimals: 1,
    source: 'Analog 4-20 mA', address: 'PLC AI 4.02',
    alarm: { type: 'high', warning: 40, critical: 45 },
    description: 'Low-temperature fresh water after the central cooler. It cools the LO cooler, air cooler and auxiliaries.',
  },
  {
    tag: 'LT.PRESS', label: 'LT CW pressure', system: 'Cooling Water', group: 'Fresh water',
    kind: 'analog', unit: 'bar', min: 0, max: 5, decimals: 2,
    source: 'Analog 4-20 mA', address: 'PLC AI 4.03',
    alarm: { type: 'low', warning: 1.8, critical: 1.4 },
    description: 'LT circuit pressure. A slow fall means a leak or an empty expansion tank.',
  },
];

const STEERING: ChannelDef[] = [
  {
    tag: 'SG.RUDDER', label: 'Rudder angle', system: 'Steering Gear', group: 'Steering',
    kind: 'analog', unit: '°', min: -35, max: 35, decimals: 1,
    source: 'NMEA 2000', address: 'PGN 127245 position',
    description: 'Rudder position feedback, starboard positive. Shows how hard the autopilot works to hold the course.',
  },
  {
    tag: 'SG.HYD.PRESS', label: 'Hydraulic pressure', system: 'Steering Gear', group: 'Steering',
    kind: 'analog', unit: 'bar', min: 0, max: 160, decimals: 0,
    source: 'Analog 4-20 mA', address: 'PLC AI 5.01',
    alarm: { type: 'high', warning: 130, critical: 145 },
    description: 'Working pressure of the rudder actuator. Grows with rudder angle and ship speed.',
  },
  {
    tag: 'SG.OIL.TEMP', label: 'Hydraulic oil temp', system: 'Steering Gear', group: 'Hydraulics',
    kind: 'analog', unit: '°C', min: 10, max: 90, decimals: 1,
    source: 'Analog 4-20 mA', address: 'PLC AI 5.02',
    alarm: { type: 'high', warning: 60, critical: 70 },
    description: 'Hydraulic oil temperature in the steering gear tank.',
  },
  {
    tag: 'SG.OIL.LEVEL', label: 'Hydraulic tank level', system: 'Steering Gear', group: 'Hydraulics',
    kind: 'analog', unit: '%', min: 0, max: 100, decimals: 1,
    source: 'Analog 4-20 mA', address: 'PLC AI 5.03',
    alarm: { type: 'low', warning: 60, critical: 40 },
    description: 'Hydraulic tank level. SOLAS II-1/29 requires a low-level alarm to catch a leak before steering is lost.',
  },
  {
    tag: 'SG.PUMP1.RUN', label: 'Pump 1 running', system: 'Steering Gear', group: 'Hydraulics',
    kind: 'digital', unit: '', min: 0, max: 1, decimals: 0,
    source: 'Analog 4-20 mA', address: 'PLC DI 5.01',
    description: 'Steering pump 1 in service.',
  },
  {
    tag: 'SG.PUMP2.RUN', label: 'Pump 2 running', system: 'Steering Gear', group: 'Hydraulics',
    kind: 'digital', unit: '', min: 0, max: 1, decimals: 0,
    source: 'Analog 4-20 mA', address: 'PLC DI 5.02',
    description: 'Steering pump 2. Both pumps run together in restricted waters.',
  },
];

const HVAC: ChannelDef[] = [
  {
    tag: 'HVAC.ER.TEMP', label: 'Engine room air', system: 'HVAC', group: 'Temperatures',
    kind: 'analog', unit: '°C', min: 10, max: 60, decimals: 1,
    source: 'NMEA 2000', address: 'PGN 130312 source 3',
    alarm: { type: 'high', warning: 45, critical: 50 },
    description: 'Engine room ambient. Hot air lowers engine output and cooks electronics; a fan failure shows here first.',
  },
  {
    tag: 'HVAC.ACC.TEMP', label: 'Accommodation', system: 'HVAC', group: 'Temperatures',
    kind: 'analog', unit: '°C', min: 10, max: 40, decimals: 1,
    source: 'NMEA 2000', address: 'PGN 130312 source 2',
    alarm: { type: 'high', warning: 27, critical: 30 },
    description: 'Accommodation air temperature.',
  },
  {
    tag: 'HVAC.OUT.TEMP', label: 'Outside air', system: 'HVAC', group: 'Temperatures',
    kind: 'analog', unit: '°C', min: -20, max: 45, decimals: 1,
    source: 'NMEA 2000', address: 'PGN 130312 source 1',
    description: 'Outside air temperature at the ventilation intakes.',
  },
  {
    tag: 'HVAC.CHW.TEMP', label: 'Chilled water supply', system: 'HVAC', group: 'Air conditioning',
    kind: 'analog', unit: '°C', min: 0, max: 20, decimals: 1,
    source: 'Analog 4-20 mA', address: 'PLC AI 6.01',
    alarm: { type: 'high', warning: 11, critical: 14 },
    description: 'Chilled water leaving the A/C plant. Rises when a compressor trips.',
  },
];

const BALLAST: ChannelDef[] = [
  ...([
    ['BW.FP.LEVEL', 'Fore peak', 'PLC AI 7.01'],
    ['BW.DB1P.LEVEL', 'DB 1 port', 'PLC AI 7.02'],
    ['BW.DB1S.LEVEL', 'DB 1 stbd', 'PLC AI 7.03'],
    ['BW.AP.LEVEL', 'Aft peak', 'PLC AI 7.04'],
  ] as const).map(([tag, label, address]): ChannelDef => ({
    tag, label, system: 'Ballast System', group: 'Tanks',
    kind: 'analog', unit: '%', min: 0, max: 100, decimals: 1,
    source: 'Analog 4-20 mA', address,
    description: 'Ballast tank level from the radar/pressure gauge. Used for stability and trim.',
  })),
  {
    tag: 'VSL.LIST', label: 'List', system: 'Ballast System', group: 'Stability',
    kind: 'analog', unit: '°', min: -15, max: 15, decimals: 1,
    source: 'Analog 4-20 mA', address: 'Inclinometer AI 7.10 (filtered)',
    alarm: { type: 'abs', warning: 5, critical: 10 },
    description: 'Static list with the rolling filtered out, starboard positive. Unplanned list means water where it should not be.',
  },
  {
    tag: 'VSL.ROLL', label: 'Roll angle', system: 'Ballast System', group: 'Stability',
    kind: 'analog', unit: '°', min: -30, max: 30, decimals: 1,
    source: 'Analog 4-20 mA', address: 'Inclinometer AI 7.10',
    description: 'Instantaneous roll. Period and amplitude say a lot about sea state and stability.',
  },
  {
    tag: 'VSL.TRIM', label: 'Trim', system: 'Ballast System', group: 'Stability',
    kind: 'analog', unit: 'm', min: -3, max: 3, decimals: 2,
    source: 'Calculated', address: 'aft draft - fore draft',
    description: 'Trim by the stern (positive). Wrong trim costs fuel.',
  },
  {
    tag: 'BW.PUMP.RUN', label: 'Ballast pump running', system: 'Ballast System', group: 'Stability',
    kind: 'digital', unit: '', min: 0, max: 1, decimals: 0,
    source: 'Analog 4-20 mA', address: 'PLC DI 7.01',
    description: 'Ballast pump in service. Normally stopped at sea.',
  },
];

export const CHANNELS: ChannelDef[] = [
  ...MAIN_ENGINE,
  ...GENERATORS,
  ...FUEL,
  ...COOLING,
  ...STEERING,
  ...HVAC,
  ...BALLAST,
];

const BY_TAG = new Map(CHANNELS.map((c) => [c.tag, c]));

export function getChannel(tag: string): ChannelDef {
  const channel = BY_TAG.get(tag);
  if (!channel) throw new Error(`Unknown channel tag: ${tag}`);
  return channel;
}

export function channelsOf(system: SystemName): ChannelDef[] {
  return CHANNELS.filter((c) => c.system === system);
}

export interface SystemInfo {
  summary: string;
  /** Readings shown on the system's overview card. */
  keyTags: string[];
  /** Digital tag that says the system is in service; reading 0 shows it as Standby. */
  runTag?: string;
}

/** What each system is for, and how the overview summarises it. */
export const SYSTEM_INFO: Record<SystemName, SystemInfo> = {
  'Main Engine': {
    summary: 'Slow-speed two-stroke diesel driving the fixed-pitch propeller directly.',
    keyTags: ['ME.SPEED', 'ME.LOAD', 'ME.HT.TEMP', 'ME.LO.PRESS'],
  },
  Generators: {
    summary: 'Three diesel generator sets on one 440 V bus, managed by the power management system (PMS).',
    keyTags: ['MSB.LOAD', 'MSB.FREQ', 'DG1.LOAD', 'DG2.LOAD'],
  },
  'Fuel System': {
    summary: 'Heavy fuel treatment: purifiers, service tank, booster pumps and the viscosity-controlled heater.',
    keyTags: ['FO.VISC', 'FO.TEMP', 'FO.SERV.LEVEL', 'FO.ROB'],
  },
  'Cooling Water': {
    summary: 'Central cooling: sea water cools the LT fresh-water circuit, which cools everything else.',
    keyTags: ['SW.PRESS', 'SW.TEMP', 'LT.TEMP', 'LT.PRESS'],
  },
  'Steering Gear': {
    summary: 'Electro-hydraulic rudder actuator with two pump units.',
    keyTags: ['SG.RUDDER', 'SG.HYD.PRESS', 'SG.OIL.LEVEL', 'SG.OIL.TEMP'],
  },
  HVAC: {
    summary: 'Engine room ventilation and accommodation air conditioning.',
    keyTags: ['HVAC.ER.TEMP', 'HVAC.ACC.TEMP', 'HVAC.CHW.TEMP', 'HVAC.OUT.TEMP'],
  },
  'Ballast System': {
    summary: 'Ballast tanks, pump and the list/trim they control.',
    keyTags: ['VSL.LIST', 'VSL.TRIM', 'BW.DB1P.LEVEL', 'BW.DB1S.LEVEL'],
    runTag: 'BW.PUMP.RUN',
  },
};
