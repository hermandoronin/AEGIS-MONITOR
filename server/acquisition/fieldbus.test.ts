import { describe, expect, it } from 'vitest';
import { CHANNELS } from '../../shared/channels';
import { acquire, decodeFrames, encodeFrames } from './fieldbus';

const physical: Record<string, number> = Object.fromEntries(CHANNELS.map((c) => [c.tag, (c.min + c.max) / 2]));
Object.assign(physical, {
  'DG1.SPEED': 1801.3,
  'DG1.HT.TEMP': 83.6,
  'DG1.LO.PRESS': 4.47,
  'SG.RUDDER': -3.21,
  'HVAC.ER.TEMP': 36.44,
});

describe('fieldbus acquisition', () => {
  it('decodes every J1939 and NMEA 2000 channel of the IO list from bus frames', () => {
    const decoded = decodeFrames(encodeFrames(physical));
    const busTags = CHANNELS.filter((c) => c.source === 'J1939' || c.source === 'NMEA 2000').map((c) => c.tag);
    expect(Object.keys(decoded).sort()).toEqual(busTags.sort());
  });

  it('applies genuine bus resolution', () => {
    const values = acquire(physical);
    expect(values['DG1.SPEED']).toBe(1801.25); // 0.125 rpm/bit
    expect(values['DG1.HT.TEMP']).toBe(84); // 1 °C/bit
    expect(values['DG1.LO.PRESS']).toBe(4.48); // 4 kPa/bit
    expect(values['SG.RUDDER']).toBeCloseTo(-3.21, 2);
    expect(values['HVAC.ER.TEMP']).toBeCloseTo(36.44, 2);
  });

  it('passes Modbus and analog points through unchanged', () => {
    const values = acquire(physical);
    expect(values['ME.SPEED']).toBe(physical['ME.SPEED']);
    expect(values['FO.VISC']).toBe(physical['FO.VISC']);
  });
});
