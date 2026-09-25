/**
 * NMEA 2000 codec for the single-frame PGNs the monitor reads from the
 * navigation/sensor backbone. Field layouts follow the public canboat
 * reverse-engineered PGN database.
 *
 * Covered: 127245 Rudder (position), 127488 Engine Parameters Rapid Update
 * (speed), 130312 Temperature (actual temperature by source).
 * Not covered: fast-packet (multi-frame) PGNs, address claim, ISO requests.
 */

export interface NmeaFrame {
  pgn: number;
  /** Source address of the sending device. */
  source: number;
  data: Uint8Array;
}

export interface DecodedValue {
  pgn: number;
  /** `rudder<instance>.position`, `engine<instance>.speed`, `temperature.<source>` */
  field: string;
  /** Engineering value, or null when the device reports "not available". */
  value: number | null;
  unit: string;
}

export const PGN_RUDDER = 127245;
export const PGN_ENGINE_RAPID = 127488;
export const PGN_TEMPERATURE = 130312;

/** Temperature source codes used by PGN 130312. */
export const TEMPERATURE_SOURCE = {
  sea: 0,
  outside: 1,
  inside: 2,
  engineRoom: 3,
} as const;

const RAD_TO_DEG = 180 / Math.PI;

function requireLength(data: Uint8Array, length: number, what: string): void {
  if (data.length < length) {
    throw new RangeError(`${what} requires >= ${length} bytes, got ${data.length}`);
  }
}

function readUint16(data: Uint8Array, offset: number): number | null {
  const raw = data[offset] | (data[offset + 1] << 8);
  return raw === 0xffff ? null : raw;
}

function readInt16(data: Uint8Array, offset: number): number | null {
  const raw = data[offset] | (data[offset + 1] << 8);
  if (raw === 0x7fff) return null;
  return raw >= 0x8000 ? raw - 0x10000 : raw;
}

function writeUint16(data: Uint8Array, offset: number, raw: number): void {
  const clamped = Math.min(0xfffe, Math.max(0, Math.round(raw)));
  data[offset] = clamped & 0xff;
  data[offset + 1] = clamped >>> 8;
}

function writeInt16(data: Uint8Array, offset: number, raw: number): void {
  const clamped = Math.min(0x7ffe, Math.max(-0x8000, Math.round(raw))) & 0xffff;
  data[offset] = clamped & 0xff;
  data[offset + 1] = clamped >>> 8;
}

// --- Encoders (sensor side) --------------------------------------------------

export function encodeRudder(positionDeg: number, source: number, instance = 0): NmeaFrame {
  const data = new Uint8Array(8).fill(0xff);
  data[0] = instance;
  writeInt16(data, 4, positionDeg / RAD_TO_DEG / 0.0001);
  return { pgn: PGN_RUDDER, source, data };
}

export function encodeEngineRapid(rpm: number, source: number, instance = 0): NmeaFrame {
  const data = new Uint8Array(8).fill(0xff);
  data[0] = instance;
  writeUint16(data, 1, rpm / 0.25);
  return { pgn: PGN_ENGINE_RAPID, source, data };
}

export function encodeTemperature(celsius: number, tempSource: number, source: number, sid = 0): NmeaFrame {
  const data = new Uint8Array(8).fill(0xff);
  data[0] = sid;
  data[1] = 0; // instance
  data[2] = tempSource;
  writeUint16(data, 3, (celsius + 273.15) / 0.01);
  return { pgn: PGN_TEMPERATURE, source, data };
}

// --- Decoder (gateway side) --------------------------------------------------

function decodeRudder(data: Uint8Array): DecodedValue {
  requireLength(data, 6, 'Rudder');
  const raw = readInt16(data, 4);
  return {
    pgn: PGN_RUDDER,
    field: `rudder${data[0]}.position`,
    value: raw === null ? null : raw * 0.0001 * RAD_TO_DEG,
    unit: '°',
  };
}

function decodeEngineRapid(data: Uint8Array): DecodedValue {
  requireLength(data, 3, 'EngineRapid');
  const raw = readUint16(data, 1);
  return {
    pgn: PGN_ENGINE_RAPID,
    field: `engine${data[0]}.speed`,
    value: raw === null ? null : raw * 0.25,
    unit: 'rpm',
  };
}

function decodeTemperature(data: Uint8Array): DecodedValue {
  requireLength(data, 5, 'Temperature');
  const raw = readUint16(data, 3);
  return {
    pgn: PGN_TEMPERATURE,
    field: `temperature.${data[2]}`,
    value: raw === null ? null : raw * 0.01 - 273.15,
    unit: '°C',
  };
}

export function decodeNmeaFrame(frame: NmeaFrame): DecodedValue | null {
  switch (frame.pgn) {
    case PGN_RUDDER:
      return decodeRudder(frame.data);
    case PGN_ENGINE_RAPID:
      return decodeEngineRapid(frame.data);
    case PGN_TEMPERATURE:
      return decodeTemperature(frame.data);
    default:
      return null;
  }
}

export function isSupported(pgn: number): boolean {
  return pgn === PGN_RUDDER || pgn === PGN_ENGINE_RAPID || pgn === PGN_TEMPERATURE;
}
