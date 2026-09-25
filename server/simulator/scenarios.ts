import type { ScenarioInfo } from '../../shared/types';

/**
 * Fault scenarios that can be injected into the running plant. Each one is a
 * real engine-room failure mode; the plant model reproduces its physics and
 * the alarm engine reacts exactly as it would to a real sensor.
 */
export const SCENARIOS = [
  {
    id: 'me-lo-filter',
    title: 'ME lube oil filter clogging',
    system: 'Main Engine',
    description: 'The duty LO automatic filter blocks up and the pressure drop across it grows.',
    expected: 'ME LO inlet pressure falls: warning after about a minute, low-low alarm shortly after.',
  },
  {
    id: 'me-ht-thermostat',
    title: 'HT cooling water thermostat stuck',
    system: 'Main Engine',
    description: 'The jacket water three-way valve sticks closed to the cooler, so heat is not rejected.',
    expected: 'HT outlet temperature climbs past 90 °C then 95 °C; LO temperature follows.',
  },
  {
    id: 'me-cyl4-injector',
    title: 'Cylinder 4 injector fault',
    system: 'Main Engine',
    description: 'A worn injector nozzle dribbles fuel and cylinder 4 burns late.',
    expected: 'Cylinder 4 exhaust temperature separates from the others and alarms; SFOC creeps up.',
  },
  {
    id: 'dg-trip',
    title: 'Generator shutdown',
    system: 'Generators',
    description: 'A running generator shuts down on a safety trip and its breaker opens.',
    expected: 'Remaining set overloads, bus frequency sags, PMS sheds load and brings the standby set on line.',
  },
  {
    id: 'fo-heater',
    title: 'Fuel heater failure',
    system: 'Fuel System',
    description: 'The steam control valve on the fuel heater fails closed.',
    expected: 'Fuel temperature drops and viscosity rises through the high and high-high limits.',
  },
  {
    id: 'sg-oil-leak',
    title: 'Steering gear hydraulic leak',
    system: 'Steering Gear',
    description: 'A hydraulic pipe fitting on the rudder actuator weeps oil into the bilge.',
    expected: 'Hydraulic tank level falls to the low, then low-low alarm (SOLAS II-1/29).',
  },
  {
    id: 'ballast-leak',
    title: 'Ballast valve passing',
    system: 'Ballast System',
    description: 'A ballast valve on DB 1 starboard does not seat and the tank floods from the sea chest.',
    expected: 'DB 1 stbd level rises and the ship takes a starboard list past 5°.',
  },
  {
    id: 'sw-sensor-fault',
    title: 'Sea water pressure transmitter wire break',
    system: 'Cooling Water',
    description: 'The 4-20 mA loop of the SW pump pressure transmitter opens; the input reads below 4 mA.',
    expected: 'A sensor-fault caution instead of a false low-pressure alarm; the real pressure is fine.',
  },
] as const satisfies readonly Omit<ScenarioInfo, 'active'>[];

export type ScenarioId = (typeof SCENARIOS)[number]['id'];

export function isScenarioId(id: string): id is ScenarioId {
  return SCENARIOS.some((s) => s.id === id);
}
