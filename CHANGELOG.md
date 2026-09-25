# Changelog

## 0.2.0 — 2026-09-25

The prototype becomes a working monitoring system. Full rationale (in Russian) in
[README.ru.md](README.ru.md#что-сделано-в-версии-02-и-почему).

### Added
- `shared/` IO list: 70 points across all seven systems, with ranges, alarm limits, bus
  addresses and a description of why each point is monitored; `docs/io-list.md` generated from it.
- Physical plant simulator: main engine (propeller law, SFOC curve, thermal lags, wave torque),
  three generator sets with PMS (standby start, load shedding, frequency dip), fuel treatment,
  cooling, steering gear with autopilot, HVAC, ballast and stability, voyage along a passage plan.
- Eight injectable fault scenarios and a Simulator tab to drive them.
- Server-side alarm engine: H/HH and L/LL points, on-delay, hysteresis, alarm blocking,
  sensor-fault detection, NEW/ACK/RTN lifecycle, event log; acknowledgement over REST.
- One hour of history on the server, pre-filled at start and refilled in the browser on reconnect.
- REST endpoints for vessel, IO list, history, alarm log, acknowledgement and simulator control.
- Dashboard: Machinery view (gauges with alarm zones, lamps, trends with limits, exhaust balance,
  IO table), Voyage view (passage plan, ETA, fuel at arrival), Alarms view (list and event log),
  3D machinery section coloured by system state, audible alarm, stale-data banner.
- 58 unit tests (vitest) and a CI step running them.

### Fixed
- NMEA 2000 PGN 130312 decoder read the source and temperature one byte too early.
- J1939 PGN extraction included the destination address for PDU1 messages.
- Every WebSocket connection got its own random data; now one plant feeds all clients.
- WebSocket client stopped reconnecting after 10 attempts and leaked a duplicate connection
  under React StrictMode.
- Production Docker stack: the browser could not reach the WebSocket; nginx now proxies `/api`
  and `/ws`.

### Removed
- Unused TimescaleDB container and the `pg` / `dotenv` dependencies (persistence stays on the
  roadmap).
- Browser-side alarm evaluation and the unused `useAlarms` hook.

## 0.1.0 — 2026-04-01

Initial prototype: React dashboard for one main-engine data stream from a random-number mock
server, browser-side alarms, standalone J1939 and NMEA 2000 decoders.
