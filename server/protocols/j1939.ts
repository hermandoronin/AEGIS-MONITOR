/**
 * SAE J1939 codec for the three engine parameters the genset ECUs broadcast.
 *
 * Decoding is what a gateway on a real CAN bus does. Encoding is what an engine
 * ECU does; the simulator uses it so that generator data travels the same
 * byte-level path it would on board (scaling, offsets, resolution and all).
 *
 * Covered: EEC1 (PGN 61444) -> SPN 190 engine speed,
 *          ET1  (PGN 65262) -> SPN 110 coolant temperature,
 *          EFL/P1 (PGN 65263) -> SPN 100 oil pressure.
 * Not covered: diagnostic messages (DM1, FMI codes), transport protocol.
 */

export interface CanFrame {
  /** 29-bit extended identifier. */
  id: number;
  data: Uint8Array;
}

export interface J1939Parameter {
  pgn: number;
  spn: number;
  name: string;
  /** Engineering value, or null when the ECU reports "not available" or "error". */
  value: number | null;
  unit: string;
  sourceAddress: number;
}

export const PGN_EEC1 = 61444;
export const PGN_ET1 = 65262;
export const PGN_EFLP1 = 65263;

/** PGN from a 29-bit identifier. PDU1 (PF < 240) PGNs do not include the destination byte. */
export function extractPgn(canId: number): number {
  const dataPage = (canId >>> 24) & 0x03;
  const pduFormat = (canId >>> 16) & 0xff;
  const pduSpecific = (canId >>> 8) & 0xff;
  return (dataPage << 16) | (pduFormat << 8) | (pduFormat < 240 ? 0 : pduSpecific);
}

export function extractSourceAddress(canId: number): number {
  return canId & 0xff;
}

export function buildCanId(priority: number, pgn: number, sourceAddress: number): number {
  return (((priority & 0x07) << 26) | ((pgn & 0x3ffff) << 8) | (sourceAddress & 0xff)) >>> 0;
}

function requireLength(data: Uint8Array, length: number, what: string): void {
  if (data.length < length) {
    throw new RangeError(`${what} requires >= ${length} bytes, got ${data.length}`);
  }
}

/** 1-byte parameter: 0..250 valid, 0xFE error, 0xFF not available. */
function readByte(data: Uint8Array, offset: number): number | null {
  const raw = data[offset];
  return raw <= 0xfa ? raw : null;
}

/** 2-byte little-endian parameter: 0..0xFAFF valid, 0xFExx error, 0xFFxx not available. */
function readWord(data: Uint8Array, offset: number): number | null {
  const raw = data[offset] | (data[offset + 1] << 8);
  return raw <= 0xfaff ? raw : null;
}

function scale(raw: number | null, resolution: number, offset: number): number | null {
  return raw === null ? null : raw * resolution + offset;
}

function frame(): Uint8Array {
  // Bytes a message does not use are sent as 0xFF ("not available").
  return new Uint8Array(8).fill(0xff);
}

function toRaw(value: number, resolution: number, offset: number, maxRaw: number): number {
  return Math.min(maxRaw, Math.max(0, Math.round((value - offset) / resolution)));
}

// --- Encoders (ECU side) -----------------------------------------------------

export function encodeEngineSpeed(rpm: number, sourceAddress: number): CanFrame {
  const data = frame();
  const raw = toRaw(rpm, 0.125, 0, 0xfaff);
  data[3] = raw & 0xff;
  data[4] = raw >>> 8;
  return { id: buildCanId(3, PGN_EEC1, sourceAddress), data };
}

export function encodeCoolantTemp(celsius: number, sourceAddress: number): CanFrame {
  const data = frame();
  data[0] = toRaw(celsius, 1, -40, 0xfa);
  return { id: buildCanId(6, PGN_ET1, sourceAddress), data };
}

export function encodeOilPressure(kpa: number, sourceAddress: number): CanFrame {
  const data = frame();
  data[3] = toRaw(kpa, 4, 0, 0xfa);
  return { id: buildCanId(6, PGN_EFLP1, sourceAddress), data };
}

// --- Decoder (gateway side) --------------------------------------------------

type Decoder = (data: Uint8Array) => Omit<J1939Parameter, 'pgn' | 'sourceAddress'>;

const DECODERS: Record<number, Decoder> = {
  [PGN_EEC1]: (data) => {
    requireLength(data, 5, 'EEC1');
    return { spn: 190, name: 'Engine Speed', value: scale(readWord(data, 3), 0.125, 0), unit: 'rpm' };
  },
  [PGN_ET1]: (data) => {
    requireLength(data, 1, 'ET1');
    return { spn: 110, name: 'Engine Coolant Temperature', value: scale(readByte(data, 0), 1, -40), unit: '°C' };
  },
  [PGN_EFLP1]: (data) => {
    requireLength(data, 4, 'EFL/P1');
    return { spn: 100, name: 'Engine Oil Pressure', value: scale(readByte(data, 3), 4, 0), unit: 'kPa' };
  },
};

/** Decodes a supported frame; returns null for PGNs this codec does not know. */
export function decodeJ1939Frame(canFrame: CanFrame): J1939Parameter | null {
  const pgn = extractPgn(canFrame.id);
  const decoder = DECODERS[pgn];
  if (!decoder) return null;
  return { pgn, sourceAddress: extractSourceAddress(canFrame.id), ...decoder(canFrame.data) };
}

export function isSupportedPgn(pgn: number): boolean {
  return pgn in DECODERS;
}
