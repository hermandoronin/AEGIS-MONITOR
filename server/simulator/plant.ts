/**
 * Engine-room plant model.
 *
 * Stands in for the ship while there is no real acquisition hardware. It is a
 * set of coupled first-order models rather than random numbers: the propeller
 * law ties power to speed, fuel follows an SFOC curve, temperatures lag their
 * heat balance, the power management system starts and stops generators, and
 * an autopilot steers along a passage plan. Faults (see scenarios.ts) act on
 * the physics, so alarms appear the way they would on board.
 */
import { VESSEL } from '../../shared/vessel';
import type { VoyageState } from '../../shared/types';
import { Rng, approach, clamp, lag, sine, wander } from './random';
import {
  NORTH_SEA_ROUTE,
  angleDiff,
  bearingDeg,
  distanceNm,
  distanceToGo,
  positionAlong,
  travel,
  type Waypoint,
} from './route';
import type { ScenarioId } from './scenarios';

// --- Plant particulars -------------------------------------------------------

const MCR_KW = VESSEL.mcrKw;
const MCR_RPM = VESSEL.mcrRpm;
/** Sea passage setting, fraction of MCR. */
const SEA_LOAD = 0.78;
const PROPELLER_PITCH_M = 5.7;
const PROPELLER_SLIP = 0.3;
/** Fixed differences between cylinders, as on any real engine. */
const CYLINDER_OFFSETS_C = [6, -4, 2, -7, 5, -2];

const DG_RATED_KW = 1000;
const DG_SFOC = 205;
const HOTEL_LOAD_KW = 1060;
/** Fuel temperature in the heated service tank, before the final heater. */
const FO_SERVICE_TANK_C = 95;
/** Consumers the PMS may trip to protect the bus. */
const NON_ESSENTIAL_KW = 170;
/** Crank, run up and synchronise. */
const DG_START_S = 18;

const FO_TEMP_SET_C = 128;
const FO_VISC_SET_CST = 13;

const DB1_PORT_LEVEL = 55;

/** Voyage in progress when the simulator starts. */
const START_DISTANCE_NM = 160;
const START_ROB_T = 612;

type GenState = 'running' | 'standby' | 'starting' | 'tripped';

interface Generator {
  state: GenState;
  startTimer: number;
  speed: number;
  htTemp: number;
  loPress: number;
}

interface PlantState {
  // Main engine
  load: number;
  meHt: number;
  meLoTemp: number;
  scavTemp: number;
  thrustTemp: number;
  exhaust: number[];
  runHours: number;
  loFilterDrop: number;
  htValveError: number;
  injectorFault: number;
  // Power plant
  gens: Generator[];
  elecWander: number;
  lastShare: number;
  freqDip: number;
  overloadTimer: number;
  highLoadTimer: number;
  loadShed: boolean;
  shedRecoveryTimer: number;
  standbyStartTimer: number;
  // Fuel
  foTemp: number;
  rob: number;
  // Cooling
  ltTemp: number;
  // Steering and navigation
  heading: number;
  yawRate: number;
  rudder: number;
  autopilotI: number;
  sgOilTemp: number;
  sgOilLevel: number;
  lat: number;
  lon: number;
  sogAvg: number;
  windSpeed: number;
  windDir: number;
  // Voyage
  route: Waypoint[];
  nextIndex: number;
  voyageNo: number;
  departedAt: number;
  distanceRun: number;
  fuelConsumed: number;
  // HVAC
  erTemp: number;
  accTemp: number;
  // Ballast
  db1s: number;
  list: number;
}

export interface PlantOutput {
  /** Physical values by IO-list tag, before the fieldbus layer. */
  values: Record<string, number>;
  voyage: VoyageState;
}

function initialState(now: number): PlantState {
  const at = positionAlong(NORTH_SEA_ROUTE, START_DISTANCE_NM);
  const fuelSoFar = 14.1;
  return {
    load: SEA_LOAD,
    meHt: 83.2,
    meLoTemp: 45.6,
    scavTemp: 42.7,
    thrustTemp: 61,
    exhaust: CYLINDER_OFFSETS_C.map((o) => 230 + 160 * SEA_LOAD + o),
    runHours: 48_213.4,
    loFilterDrop: 0,
    htValveError: 0,
    injectorFault: 0,
    gens: [
      { state: 'running', startTimer: 0, speed: 1800, htTemp: 83, loPress: 4.45 },
      { state: 'running', startTimer: 0, speed: 1800, htTemp: 83, loPress: 4.45 },
      { state: 'standby', startTimer: 0, speed: 0, htTemp: 58, loPress: 0 },
    ],
    elecWander: 0,
    lastShare: 530,
    freqDip: 0,
    overloadTimer: 0,
    highLoadTimer: 0,
    loadShed: false,
    shedRecoveryTimer: 0,
    standbyStartTimer: 0,
    foTemp: FO_TEMP_SET_C,
    rob: START_ROB_T,
    ltTemp: 34,
    heading: at.headingDeg,
    yawRate: 0,
    rudder: -2.5,
    autopilotI: -2.5,
    sgOilTemp: 39,
    sgOilLevel: 84,
    lat: at.lat,
    lon: at.lon,
    sogAvg: 14.1,
    windSpeed: 17,
    windDir: 235,
    route: NORTH_SEA_ROUTE,
    nextIndex: at.nextIndex,
    voyageNo: 41,
    departedAt: now - (START_DISTANCE_NM / 14.1) * 3_600_000,
    distanceRun: START_DISTANCE_NM,
    fuelConsumed: fuelSoFar,
    erTemp: 36.4,
    accTemp: 22,
    db1s: DB1_PORT_LEVEL,
    list: 0.2,
  };
}

function beaufort(knots: number): number {
  const limits = [1, 4, 7, 11, 17, 22, 28, 34, 41, 48, 56, 64];
  const index = limits.findIndex((l) => knots < l);
  return index === -1 ? 12 : index;
}

export class PlantSimulator {
  private rng: Rng;
  private s: PlantState;
  private t: number;
  private faults = new Set<ScenarioId>();
  /** Random phases so that periodic signals differ between runs. */
  private ph: number[];

  constructor(options: { seed: number; now: number }) {
    this.rng = new Rng(options.seed);
    this.t = options.now;
    this.s = initialState(options.now);
    this.ph = Array.from({ length: 12 }, () => this.rng.phase());
  }

  get time(): number {
    return this.t;
  }

  activeScenarios(): ScenarioId[] {
    return [...this.faults];
  }

  startScenario(id: ScenarioId): void {
    if (this.faults.has(id)) return;
    this.faults.add(id);
    if (id === 'dg-trip') {
      const victim = this.s.gens.find((g) => g.state === 'running');
      if (victim) {
        victim.state = 'tripped';
        this.requestStandbyStart();
      }
    }
  }

  stopScenario(id: ScenarioId): void {
    if (!this.faults.delete(id)) return;
    if (id === 'dg-trip') {
      // Engineer resets the safety system; the set becomes the new standby.
      for (const g of this.s.gens) if (g.state === 'tripped') g.state = 'standby';
    }
  }

  /**
   * Clears every fault and puts the machinery straight back to normal
   * (stopping a single scenario lets the plant recover at its own pace).
   * The voyage carries on from where the ship is.
   */
  reset(): void {
    this.faults.clear();
    const fresh = initialState(this.t);
    const machinery: (keyof PlantState)[] = [
      'load', 'meHt', 'meLoTemp', 'scavTemp', 'thrustTemp', 'exhaust',
      'loFilterDrop', 'htValveError', 'injectorFault',
      'gens', 'lastShare', 'freqDip', 'overloadTimer', 'highLoadTimer', 'loadShed', 'shedRecoveryTimer', 'standbyStartTimer',
      'foTemp', 'ltTemp', 'sgOilTemp', 'sgOilLevel', 'erTemp', 'accTemp', 'db1s', 'list',
    ];
    for (const key of machinery) {
      Object.assign(this.s, { [key]: fresh[key] });
    }
  }

  /** Advances the model to `now` and returns the readings at that moment. */
  step(now: number): PlantOutput {
    // Integrate in steps of at most one second; cap catch-up after a stall.
    let remaining = clamp((now - this.t) / 1000, 0, 10);
    let out: PlantOutput | null = null;
    do {
      const dt = Math.min(1, remaining);
      remaining -= dt;
      this.t += dt * 1000;
      out = this.integrate(dt);
    } while (remaining > 1e-9);
    this.t = now;
    return out;
  }

  private active(id: ScenarioId): boolean {
    return this.faults.has(id);
  }

  private requestStandbyStart(): void {
    const standby = this.s.gens.find((g) => g.state === 'standby');
    if (!standby) return;
    standby.state = 'starting';
    standby.startTimer = 0;
    this.s.standbyStartTimer = 60 + DG_START_S;
  }

  private integrate(dt: number): PlantOutput {
    const s = this.s;
    const rng = this.rng;
    const ts = this.t / 1000;
    const ph = this.ph;
    const v: Record<string, number> = {};

    // --- Weather --------------------------------------------------------------
    s.windSpeed = clamp(wander(rng, s.windSpeed, 17, 2.5, 900, dt), 3, 45);
    s.windDir = (wander(rng, s.windDir, 235, 10, 1800, dt) + 360) % 360;
    const bf = beaufort(s.windSpeed);
    const sea = bf / 5; // wave excitation relative to Beaufort 5

    // --- Main engine ------------------------------------------------------------
    // The bridge trims the telegraph slowly to hold the ETA.
    const loadSet = SEA_LOAD + 0.015 * sine(ts, 1800, ph[0]);
    s.load = lag(s.load, loadSet, 45, dt);
    // Waves vary propeller torque; the governor holds speed and the fuel index moves.
    const torque = sea * (0.018 * sine(ts, 9.2, ph[1]) + 0.008 * sine(ts, 13.7, ph[2])) + rng.normal(0.002);
    const load = s.load + torque;
    const rpm = MCR_RPM * Math.cbrt(s.load) - 12 * torque + rng.normal(0.08);
    const power = MCR_KW * load + rng.normal(6);

    s.injectorFault = this.active('me-cyl4-injector')
      ? Math.min(120, s.injectorFault + 0.9 * dt)
      : lag(s.injectorFault, 0, 40, dt);
    const sfoc = 166 + 60 * (s.load - SEA_LOAD) ** 2 + 0.05 * s.injectorFault;
    const meFuel = (sfoc * power) / 1000 + rng.normal(2.5);

    s.loFilterDrop = this.active('me-lo-filter')
      ? Math.min(1.9, s.loFilterDrop + 0.012 * dt)
      : lag(s.loFilterDrop, 0, 15, dt);
    s.htValveError = this.active('me-ht-thermostat')
      ? Math.min(20, s.htValveError + 0.1 * dt)
      : lag(s.htValveError, 0, 30, dt);

    s.meHt = lag(s.meHt, 82 + 1.5 * s.load + s.htValveError, 40, dt);
    s.meLoTemp = lag(s.meLoTemp, 44 + 2 * s.load + 0.25 * s.htValveError + 0.4 * (s.ltTemp - 34), 120, dt);
    s.scavTemp = lag(s.scavTemp, 38 + 6 * s.load + 0.8 * (s.ltTemp - 34), 60, dt);
    s.thrustTemp = lag(s.thrustTemp, 50 + 14 * s.load, 300, dt);
    s.exhaust = s.exhaust.map((temp, i) =>
      lag(temp, 230 + 160 * s.load + CYLINDER_OFFSETS_C[i] + (i === 3 ? s.injectorFault : 0) + 0.5 * (s.scavTemp - 42.7), 15, dt),
    );
    s.runHours += dt / 3600;

    v['ME.SPEED'] = rpm;
    v['ME.LOAD'] = load * 100;
    v['ME.SHAFT.POWER'] = power;
    v['ME.FO.FLOW'] = meFuel;
    v['ME.SFOC'] = power > 100 ? (meFuel * 1000) / power : 0;
    v['ME.LO.PRESS'] = 4.12 + 0.12 * s.load - s.loFilterDrop + rng.normal(0.012);
    v['ME.LO.TEMP'] = s.meLoTemp + rng.normal(0.08);
    v['ME.HT.TEMP'] = s.meHt + rng.normal(0.08);
    v['ME.THRUST.TEMP'] = s.thrustTemp + rng.normal(0.08);
    v['ME.SCAV.PRESS'] = 0.25 + 2.6 * load ** 1.6 + rng.normal(0.008);
    v['ME.SCAV.TEMP'] = s.scavTemp + rng.normal(0.1);
    v['ME.TC.SPEED'] = 16_800 * load ** 0.55 + rng.normal(20);
    s.exhaust.forEach((temp, i) => {
      v[`ME.EXH.CYL${i + 1}`] = temp + rng.normal(1.2);
    });
    v['ME.RUN.HOURS'] = s.runHours;

    // --- Electrical plant and PMS ---------------------------------------------------
    s.elecWander = wander(rng, s.elecWander, 0, 25, 300, dt);
    const compressor = Math.floor(ts / 97) % 3 === 0 ? 55 : 0; // start air compressor cycling
    const demand = HOTEL_LOAD_KW + s.elecWander + compressor + 40 * (s.load - SEA_LOAD) + rng.normal(4);
    const busLoad = Math.max(0, demand - (s.loadShed ? NON_ESSENTIAL_KW : 0));

    for (const g of s.gens) {
      if (g.state === 'starting') {
        g.startTimer += dt;
        if (g.startTimer >= DG_START_S) g.state = 'running';
      }
    }
    const online = s.gens.filter((g) => g.state === 'running');
    const share = online.length > 0 ? busLoad / online.length : 0;
    const fraction = share / DG_RATED_KW;
    const overload = Math.max(0, fraction - 1);
    // A sudden load step (a set dropping out) dips the frequency until the governors catch up.
    const loadStep = (share - s.lastShare) / DG_RATED_KW;
    if (loadStep > 0.05) s.freqDip += 6 * loadStep;
    s.lastShare = share;
    s.freqDip = lag(s.freqDip, 0, 3, dt);
    const freq = online.length > 0 ? 60 - 25 * overload - s.freqDip + rng.normal(0.015) : 0;
    const volt = online.length > 0 ? 440 - 120 * overload - 8 * s.freqDip + rng.normal(0.6) : 0;

    // Preferential trip after 4 s of overload; reconnect once there is margin again.
    s.overloadTimer = overload > 0 ? s.overloadTimer + dt : 0;
    if (s.overloadTimer >= 4) s.loadShed = true;
    if (s.loadShed) {
      const withConsumers = (busLoad + NON_ESSENTIAL_KW) / (online.length * DG_RATED_KW);
      s.shedRecoveryTimer = withConsumers < 0.8 ? s.shedRecoveryTimer + dt : 0;
      if (s.shedRecoveryTimer >= 30) {
        s.loadShed = false;
        s.shedRecoveryTimer = 0;
      }
    }
    // Start the standby set on sustained high load.
    s.highLoadTimer = fraction > 0.9 ? s.highLoadTimer + dt : 0;
    if (s.highLoadTimer >= 10 && !s.gens.some((g) => g.state === 'starting')) this.requestStandbyStart();
    s.standbyStartTimer = Math.max(0, s.standbyStartTimer - dt);

    let dgFuel = 0;
    s.gens.forEach((g, i) => {
      const n = i + 1;
      let dgLoad = 0;
      if (g.state === 'running') {
        dgLoad = share + rng.normal(2);
        g.speed = (1800 * freq) / 60 + rng.normal(0.8);
        g.htTemp = lag(g.htTemp, 78 + 10 * fraction, 90, dt);
        g.loPress = 4.3 + 0.3 * fraction + rng.normal(0.03);
      } else if (g.state === 'starting') {
        const runUp = Math.min(1, g.startTimer / 8);
        g.speed = 1800 * runUp;
        g.htTemp = lag(g.htTemp, 70, 120, dt);
        g.loPress = 4.3 * runUp;
      } else {
        g.speed = lag(g.speed, 0, 4, dt);
        if (g.speed < 5) g.speed = 0;
        g.htTemp = lag(g.htTemp, 58, 900, dt); // standby sets are kept preheated
        g.loPress = lag(g.loPress, 0, 2, dt);
        if (g.loPress < 0.02) g.loPress = 0;
      }
      dgFuel += (DG_SFOC * Math.max(0, dgLoad)) / 1000;
      v[`DG${n}.RUN`] = g.state === 'running' ? 1 : 0;
      v[`DG${n}.TRIP`] = g.state === 'tripped' ? 1 : 0;
      v[`DG${n}.LOAD`] = Math.max(0, dgLoad);
      v[`DG${n}.SPEED`] = g.speed;
      v[`DG${n}.HT.TEMP`] = g.htTemp + rng.normal(0.1);
      v[`DG${n}.LO.PRESS`] = g.loPress;
    });
    v['MSB.LOAD'] = busLoad;
    v['MSB.FREQ'] = freq;
    v['MSB.VOLT'] = volt;
    v['PMS.STBY.START'] = s.standbyStartTimer > 0 ? 1 : 0;
    v['PMS.LOAD.SHED'] = s.loadShed ? 1 : 0;

    // --- Fuel -------------------------------------------------------------------
    const heaterFailed = this.active('fo-heater');
    s.foTemp = lag(s.foTemp, heaterFailed ? FO_SERVICE_TANK_C : FO_TEMP_SET_C, heaterFailed ? 200 : 60, dt);
    const totalFuel = meFuel + dgFuel;
    const burnedT = (totalFuel * dt) / 3600 / 1000;
    s.fuelConsumed += burnedT;
    s.rob -= burnedT;
    v['FO.VISC'] = FO_VISC_SET_CST * Math.exp(-0.028 * (s.foTemp - FO_TEMP_SET_C)) + rng.normal(0.06);
    v['FO.TEMP'] = s.foTemp + rng.normal(0.15);
    v['FO.BOOST.PRESS'] = 8 + rng.normal(0.03);
    v['FO.SERV.LEVEL'] = 93 + 1.5 * sine(ts, 1500, ph[3]) + rng.normal(0.05);
    v['FO.TOTAL.FLOW'] = totalFuel;
    v['FO.ROB'] = s.rob;

    // --- Navigation and steering -------------------------------------------------
    const slip = PROPELLER_SLIP + 0.012 * (bf - 4);
    const stw = ((rpm * PROPELLER_PITCH_M * 60) / 1852) * (1 - slip);
    const current = 0.4 * sine(ts, 44_712, ph[4]); // semidiurnal tidal stream
    const sog = stw + current;
    s.sogAvg = lag(s.sogAvg, sog, 600, dt);

    const route = s.route;
    const desired = bearingDeg(s, route[s.nextIndex]);
    const error = angleDiff(s.heading, desired);
    // PID autopilot; the integral only works near the course so turns do not wind it up.
    if (Math.abs(error) < 5) s.autopilotI = clamp(s.autopilotI + 0.02 * error * dt, -5, 5);
    const rudderOrder = clamp(1.5 * error - 8 * s.yawRate + s.autopilotI, -10, 10);
    const previousRudder = s.rudder;
    s.rudder = approach(s.rudder, rudderOrder, 2.3, dt); // SOLAS: 35° to 30° in 28 s
    // Nomoto first-order yaw: T r' + r = K rudder + disturbance (wind + waves).
    const disturbance = 0.15 + sea * (2.5 * sine(ts, 10.5, ph[5]) + 1.0 * sine(ts, 6.3, ph[6]));
    s.yawRate += (dt * (0.06 * s.rudder - s.yawRate + disturbance)) / 20;
    s.heading = (s.heading + s.yawRate * dt + 360) % 360;

    const run = (sog * dt) / 3600;
    Object.assign(s, travel(s, s.heading, run));
    s.distanceRun += run;
    if (distanceNm(s, route[s.nextIndex]) < 1) {
      if (s.nextIndex < route.length - 1) {
        s.nextIndex += 1;
      } else {
        // Arrived: the next passage starts back the other way.
        s.route = [...route].reverse();
        s.nextIndex = 1;
        s.voyageNo += 1;
        s.departedAt = this.t;
        s.distanceRun = 0;
        s.fuelConsumed = 0;
        if (s.rob < 350) s.rob += 500; // bunkered in port
      }
    }

    const rudderRate = dt > 0 ? Math.abs(s.rudder - previousRudder) / dt : 0;
    const hydPress = 22 + 3 * Math.abs(s.rudder) * (stw / 14) ** 2 + 6 * rudderRate + rng.normal(0.4);
    s.sgOilTemp = lag(s.sgOilTemp, 36 + 0.08 * hydPress, 600, dt);
    s.sgOilLevel = this.active('sg-oil-leak')
      ? Math.max(10, s.sgOilLevel - 0.25 * dt)
      : approach(s.sgOilLevel, 84, 0.5, dt); // topped up after the leak is found
    v['SG.RUDDER'] = s.rudder + rng.normal(0.05);
    v['SG.HYD.PRESS'] = hydPress;
    v['SG.OIL.TEMP'] = s.sgOilTemp + rng.normal(0.05);
    v['SG.OIL.LEVEL'] = s.sgOilLevel + rng.normal(0.05);
    v['SG.PUMP1.RUN'] = 1;
    v['SG.PUMP2.RUN'] = 0;

    // --- Cooling water ---------------------------------------------------------------
    const toGo = distanceToGo(s.route, s, s.nextIndex);
    const total = s.distanceRun + toGo;
    const progress = total > 0 ? s.distanceRun / total : 0;
    const northbound = s.route[0].lat < s.route[s.route.length - 1].lat;
    const seaTemp = 13.5 - 2.5 * (northbound ? progress : 1 - progress) + 0.2 * sine(ts, 3600, ph[7]);
    s.ltTemp = lag(s.ltTemp, 34 + 0.25 * (seaTemp - 13) + 0.5 * (s.load - SEA_LOAD), 120, dt);
    v['SW.PRESS'] = this.active('sw-sensor-fault') ? -1 + rng.normal(0.004) : 2.2 + rng.normal(0.015);
    v['SW.TEMP'] = seaTemp;
    v['LT.TEMP'] = s.ltTemp + rng.normal(0.06);
    v['LT.PRESS'] = 2.6 + rng.normal(0.012);

    // --- HVAC --------------------------------------------------------------------------
    const outside = seaTemp + 1.2 + 1.5 * sine(ts, 86_400, ph[8]);
    s.erTemp = lag(s.erTemp, outside + 20 + 2 * s.load, 600, dt);
    s.accTemp = lag(s.accTemp, 22 + 0.2 * sine(ts, 1200, ph[9]), 900, dt);
    v['HVAC.ER.TEMP'] = s.erTemp + rng.normal(0.05);
    v['HVAC.ACC.TEMP'] = s.accTemp + rng.normal(0.03);
    v['HVAC.OUT.TEMP'] = outside + rng.normal(0.03);
    v['HVAC.CHW.TEMP'] = 7 + 0.35 * sine(ts, 480, ph[10]) + rng.normal(0.03);

    // --- Ballast and stability ---------------------------------------------------------
    const flooding = this.active('ballast-leak');
    const pumping = !flooding && s.db1s > DB1_PORT_LEVEL + 0.5;
    if (flooding) s.db1s = Math.min(100, s.db1s + 0.3 * dt);
    else s.db1s = approach(s.db1s, DB1_PORT_LEVEL, 0.4, dt);
    s.list = lag(s.list, 0.2 + 0.12 * (s.db1s - DB1_PORT_LEVEL), 20, dt);
    v['BW.FP.LEVEL'] = 0;
    v['BW.DB1P.LEVEL'] = DB1_PORT_LEVEL + rng.normal(0.05);
    v['BW.DB1S.LEVEL'] = s.db1s + rng.normal(0.05);
    v['BW.AP.LEVEL'] = 62 + rng.normal(0.05);
    v['VSL.LIST'] = s.list + rng.normal(0.03);
    v['VSL.ROLL'] = s.list + sea * (2.2 * sine(ts, 11.5, ph[11]) + 0.6 * sine(ts, 7.3, ph[1])) + rng.normal(0.08);
    v['VSL.TRIM'] = 0.8 + rng.normal(0.005);
    v['BW.PUMP.RUN'] = pumping ? 1 : 0;

    const voyage: VoyageState = {
      voyageNo: `V.${String(s.voyageNo).padStart(3, '0')}${northbound ? 'N' : 'S'}`,
      from: s.route[0].name,
      to: s.route[s.route.length - 1].name,
      nextWaypoint: s.route[s.nextIndex].name,
      departedAt: s.departedAt,
      lat: s.lat,
      lon: s.lon,
      headingDeg: s.heading,
      sogKnots: sog,
      stwKnots: stw,
      distanceRunNm: s.distanceRun,
      distanceToGoNm: toGo,
      etaMs: this.t + (toGo / Math.max(s.sogAvg, 1)) * 3_600_000,
      fuelConsumedT: s.fuelConsumed,
      windSpeedKn: s.windSpeed,
      windDirDeg: s.windDir,
      beaufort: bf,
    };

    return { values: v, voyage };
  }
}
