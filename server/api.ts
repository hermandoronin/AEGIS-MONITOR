/**
 * REST API. The WebSocket carries the live frame; REST serves everything
 * that is requested on demand: vessel particulars, the IO list, history,
 * the alarm log, acknowledgements and simulator control.
 */
import express, { type Request, type Response, type NextFunction } from 'express';
import { CHANNELS } from '../shared/channels';
import { VESSEL } from '../shared/vessel';
import type { MonitorRuntime } from './runtime';
import { isScenarioId } from './simulator/scenarios';

const MAX_HISTORY_S = 3600;

function requireVessel(req: Request, res: Response, next: NextFunction): void {
  if (req.params.vesselId !== VESSEL.vesselId) {
    res.status(404).json({ error: `Unknown vessel '${req.params.vesselId}'` });
    return;
  }
  next();
}

export function createApi(runtime: MonitorRuntime, startedAt: number): express.Router {
  const api = express.Router();
  api.use(express.json());

  api.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      uptimeS: Math.round((Date.now() - startedAt) / 1000),
      lastFrame: runtime.frame?.timestamp ?? null,
      simulated: VESSEL.simulated,
    });
  });

  api.get('/vessels', (_req, res) => {
    res.json([{ vesselId: VESSEL.vesselId, name: VESSEL.name, imo: VESSEL.imo }]);
  });

  const vessel = express.Router({ mergeParams: true });
  api.use('/vessels/:vesselId', requireVessel, vessel);

  vessel.get('/', (_req, res) => {
    res.json(VESSEL);
  });

  vessel.get('/channels', (_req, res) => {
    res.json(CHANNELS);
  });

  vessel.get('/status', (_req, res) => {
    if (!runtime.frame) {
      res.status(503).json({ error: 'No data yet' });
      return;
    }
    res.json(runtime.frame);
  });

  // GET /history?seconds=900&tags=ME.SPEED,ME.LOAD
  vessel.get('/history', (req, res) => {
    const seconds = Math.min(Math.max(Number(req.query.seconds) || 900, 1), MAX_HISTORY_S);
    const tags = typeof req.query.tags === 'string' && req.query.tags ? req.query.tags.split(',') : undefined;
    res.json(runtime.history.query(seconds, runtime.frame?.timestamp ?? Date.now(), tags));
  });

  vessel.get('/alarms', (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 1000);
    res.json(runtime.alarms.history(limit));
  });

  vessel.post('/alarms/ack-all', (_req, res) => {
    const acknowledged = runtime.alarms.acknowledgeAll(Date.now());
    res.json({ acknowledged, alarms: runtime.alarms.current() });
  });

  vessel.post('/alarms/:alarmId/ack', (req, res) => {
    if (!runtime.alarms.acknowledge(req.params.alarmId, Date.now())) {
      res.status(404).json({ error: 'No unacknowledged alarm with that id' });
      return;
    }
    res.json({ acknowledged: 1, alarms: runtime.alarms.current() });
  });

  // Simulator control -- only meaningful while the data is simulated.
  api.get('/sim/scenarios', (_req, res) => {
    res.json(runtime.scenarios());
  });

  api.post('/sim/scenarios/:id/:action', (req, res) => {
    const { id, action } = req.params;
    if (!isScenarioId(id) || (action !== 'start' && action !== 'stop')) {
      res.status(404).json({ error: `Unknown scenario or action: ${id}/${action}` });
      return;
    }
    if (action === 'start') runtime.startScenario(id);
    else runtime.stopScenario(id);
    res.json(runtime.scenarios());
  });

  api.post('/sim/reset', (_req, res) => {
    runtime.resetSimulation();
    res.json(runtime.scenarios());
  });

  return api;
}
