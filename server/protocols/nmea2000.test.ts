import { describe, expect, it } from 'vitest';
import {
  PGN_TEMPERATURE,
  TEMPERATURE_SOURCE,
  decodeNmeaFrame,
  encodeEngineRapid,
  encodeRudder,
  encodeTemperature,
  isSupported,
} from './nmea2000';

describe('NMEA 2000', () => {
  it('decodes PGN 130312 with the canboat field layout (SID, instance, source, 0.01 K)', () => {
    // 13.5 °C = 286.65 K = 28665 = 0x6FF9, sea temperature (source 0).
    const data = new Uint8Array([0x07, 0x00, 0x00, 0xf9, 0x6f, 0xff, 0xff, 0xff]);
    const decoded = decodeNmeaFrame({ pgn: PGN_TEMPERATURE, source: 0x30, data });
    expect(decoded?.field).toBe('temperature.0');
    expect(decoded?.value).toBeCloseTo(13.5, 2);
  });

  it('round-trips temperatures by source', () => {
    const frame = encodeTemperature(36.42, TEMPERATURE_SOURCE.engineRoom, 0x30);
    const decoded = decodeNmeaFrame(frame);
    expect(decoded?.field).toBe('temperature.3');
    expect(decoded?.value).toBeCloseTo(36.42, 2);
  });

  it('round-trips a signed rudder angle (0.0001 rad resolution)', () => {
    expect(decodeNmeaFrame(encodeRudder(-4.3, 0x20))?.value).toBeCloseTo(-4.3, 2);
    expect(decodeNmeaFrame(encodeRudder(12.7, 0x20))).toMatchObject({ field: 'rudder0.position' });
  });

  it('round-trips engine speed (0.25 rpm resolution)', () => {
    const decoded = decodeNmeaFrame(encodeEngineRapid(1650.3, 0x10, 1));
    expect(decoded?.field).toBe('engine1.speed');
    expect(decoded?.value).toBe(1650.25);
  });

  it('reports "not available" as null', () => {
    const data = new Uint8Array(8).fill(0xff);
    expect(decodeNmeaFrame({ pgn: PGN_TEMPERATURE, source: 1, data })?.value).toBeNull();
  });

  it('ignores unsupported PGNs and rejects short frames', () => {
    expect(decodeNmeaFrame({ pgn: 129025, source: 1, data: new Uint8Array(8) })).toBeNull();
    expect(isSupported(127245)).toBe(true);
    expect(() => decodeNmeaFrame({ pgn: PGN_TEMPERATURE, source: 1, data: new Uint8Array(4) })).toThrow(RangeError);
  });
});
