/**
 * Acquisition layer: turns what the plant "puts on the wire" into tag values.
 *
 * On board, the genset ECUs talk SAE J1939 and the navigation sensors talk
 * NMEA 2000. Here the simulated devices encode their readings into CAN frames
 * and the gateway decodes them with the same codecs a real installation would
 * use, so generator and temperature data pick up genuine bus resolution
 * (1 °C for J1939 coolant temperature, 4 kPa for oil pressure, ...).
 *
 * Modbus and 4-20 mA points are passed straight through: the simulator plays
 * the PLC registers. A Modbus TCP client is on the roadmap.
 */
import {
  decodeJ1939Frame,
  encodeCoolantTemp,
  encodeEngineSpeed,
  encodeOilPressure,
  type CanFrame,
} from '../protocols/j1939';
import {
  TEMPERATURE_SOURCE,
  decodeNmeaFrame,
  encodeRudder,
  encodeTemperature,
  type NmeaFrame,
} from '../protocols/nmea2000';

const GENERATOR_COUNT = 3;
/** NMEA 2000 device addresses of the simulated sensors. */
const N2K_RUDDER_SENSOR = 0x20;
const N2K_TEMP_SENSOR = 0x30;

const TEMPERATURE_TAGS: Record<number, string> = {
  [TEMPERATURE_SOURCE.sea]: 'SW.TEMP',
  [TEMPERATURE_SOURCE.outside]: 'HVAC.OUT.TEMP',
  [TEMPERATURE_SOURCE.inside]: 'HVAC.ACC.TEMP',
  [TEMPERATURE_SOURCE.engineRoom]: 'HVAC.ER.TEMP',
};

/** Device side: the frames the ECUs and sensors broadcast for one set of readings. */
export function encodeFrames(values: Record<string, number>): { can: CanFrame[]; n2k: NmeaFrame[] } {
  const can: CanFrame[] = [];
  for (let n = 1; n <= GENERATOR_COUNT; n += 1) {
    const sourceAddress = n - 1;
    can.push(
      encodeEngineSpeed(values[`DG${n}.SPEED`], sourceAddress),
      encodeCoolantTemp(values[`DG${n}.HT.TEMP`], sourceAddress),
      encodeOilPressure(values[`DG${n}.LO.PRESS`] * 100, sourceAddress), // bar -> kPa
    );
  }
  const n2k: NmeaFrame[] = [encodeRudder(values['SG.RUDDER'], N2K_RUDDER_SENSOR)];
  for (const [source, tag] of Object.entries(TEMPERATURE_TAGS)) {
    n2k.push(encodeTemperature(values[tag], Number(source), N2K_TEMP_SENSOR));
  }
  return { can, n2k };
}

/** Gateway side: decodes frames into tag values in IO-list units. */
export function decodeFrames(frames: { can: CanFrame[]; n2k: NmeaFrame[] }): Record<string, number> {
  const out: Record<string, number> = {};
  for (const frame of frames.can) {
    const param = decodeJ1939Frame(frame);
    if (!param || param.value === null) continue;
    const dg = `DG${param.sourceAddress + 1}`;
    if (param.spn === 190) out[`${dg}.SPEED`] = param.value;
    if (param.spn === 110) out[`${dg}.HT.TEMP`] = param.value;
    if (param.spn === 100) out[`${dg}.LO.PRESS`] = param.value / 100; // kPa -> bar
  }
  for (const frame of frames.n2k) {
    const decoded = decodeNmeaFrame(frame);
    if (!decoded || decoded.value === null) continue;
    if (decoded.field === 'rudder0.position') out['SG.RUDDER'] = decoded.value;
    const [kind, source] = decoded.field.split('.');
    if (kind === 'temperature' && TEMPERATURE_TAGS[Number(source)]) {
      out[TEMPERATURE_TAGS[Number(source)]] = decoded.value;
    }
  }
  return out;
}

/** Full path for one tick: plant readings -> bus frames -> decoded tag values. */
export function acquire(physical: Record<string, number>): Record<string, number> {
  return { ...physical, ...decodeFrames(encodeFrames(physical)) };
}
