import type { VesselInfo } from './types';

/**
 * The demo vessel. Fictional: the name, IMO number and call sign do not belong
 * to a real ship. The machinery figures are typical for a ~28,000 dwt
 * multipurpose cargo ship and drive the plant simulator.
 */
export const VESSEL: VesselInfo = {
  vesselId: 'aegis-001',
  name: 'M/V AEGIS PIONEER',
  imo: '9999990',
  callSign: 'AEGIS1',
  flag: 'Malta',
  type: 'Multipurpose general cargo',
  built: 2014,
  deadweightT: 28_300,
  lengthM: 179.9,
  beamM: 28.4,
  mainEngine: '6-cylinder two-stroke crosshead diesel, MCR 8,000 kW at 120 rpm',
  mcrKw: 8_000,
  mcrRpm: 120,
  generators: '3 x 1,000 kWe high-speed diesel generator sets, 440 V / 60 Hz',
  simulated: true,
};
