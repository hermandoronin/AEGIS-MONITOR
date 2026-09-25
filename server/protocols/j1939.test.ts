import { describe, expect, it } from 'vitest';
import {
  PGN_EEC1,
  buildCanId,
  decodeJ1939Frame,
  encodeCoolantTemp,
  encodeEngineSpeed,
  encodeOilPressure,
  extractPgn,
  extractSourceAddress,
  isSupportedPgn,
} from './j1939';

describe('J1939 identifiers', () => {
  it('extracts PGN and source address from a standard EEC1 id', () => {
    expect(extractPgn(0x0cf00400)).toBe(61444);
    expect(extractSourceAddress(0x0cf00400)).toBe(0x00);
    expect(extractPgn(0x18feee01)).toBe(65262);
    expect(extractSourceAddress(0x18feee01)).toBe(0x01);
  });

  it('drops the destination address from PDU1 PGNs', () => {
    // TSC1 (PGN 0) sent to destination 0x00 from source 0x03.
    expect(extractPgn(0x0c000003)).toBe(0);
    // Request (PGN 59904 = 0xEA00) to destination 0xFF.
    expect(extractPgn(0x18eaff03)).toBe(59904);
  });

  it('builds ids that round-trip', () => {
    const id = buildCanId(3, PGN_EEC1, 0x02);
    expect(id).toBe(0x0cf00402);
    expect(extractPgn(id)).toBe(PGN_EEC1);
  });
});

describe('J1939 parameters', () => {
  it('decodes a hand-built EEC1 frame (SPN 190, 0.125 rpm/bit)', () => {
    const raw = 1800 / 0.125; // 14400 = 0x3840
    const data = new Uint8Array([0xff, 0xff, 0xff, 0x40, 0x38, 0xff, 0xff, 0xff]);
    const param = decodeJ1939Frame({ id: 0x0cf00401, data });
    expect(raw).toBe(0x3840);
    expect(param).toMatchObject({ spn: 190, value: 1800, unit: 'rpm', sourceAddress: 1 });
  });

  it('round-trips speed, coolant temperature and oil pressure at bus resolution', () => {
    expect(decodeJ1939Frame(encodeEngineSpeed(1799.9, 0))?.value).toBe(1799.875);
    expect(decodeJ1939Frame(encodeCoolantTemp(83.6, 0))?.value).toBe(84);
    expect(decodeJ1939Frame(encodeCoolantTemp(-12, 0))?.value).toBe(-12);
    expect(decodeJ1939Frame(encodeOilPressure(445, 2))).toMatchObject({ spn: 100, value: 444, sourceAddress: 2 });
  });

  it('reports "not available" and "error" as null', () => {
    const notAvailable = new Uint8Array(8).fill(0xff);
    expect(decodeJ1939Frame({ id: 0x0cf00400, data: notAvailable })?.value).toBeNull();
    const error = new Uint8Array([0xfe, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
    expect(decodeJ1939Frame({ id: 0x18feee00, data: error })?.value).toBeNull();
  });

  it('returns null for PGNs it does not decode', () => {
    expect(decodeJ1939Frame({ id: 0x18fef100, data: new Uint8Array(8) })).toBeNull();
    expect(isSupportedPgn(61444)).toBe(true);
    expect(isSupportedPgn(65265)).toBe(false);
  });

  it('rejects short frames instead of reading past the buffer', () => {
    expect(() => decodeJ1939Frame({ id: 0x0cf00400, data: new Uint8Array(3) })).toThrow(RangeError);
    expect(() => decodeJ1939Frame({ id: 0x18feef00, data: new Uint8Array(2) })).toThrow(RangeError);
  });
});
