import { VESSEL } from '../shared/vessel';

const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';

/**
 * Same-origin by default: Vite (dev) and nginx (Docker) both proxy /ws and
 * /api to the monitoring server, so the dashboard works behind any host name.
 */
export const WS_URL = import.meta.env.VITE_WS_URL ?? `${wsProtocol}://${window.location.host}/ws`;
export const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1';
export const VESSEL_ID = VESSEL.vesselId;

/** Seconds of history kept in the browser and requested on (re)connect. */
export const HISTORY_SECONDS = 900;
/** Readings older than this are shown as stale. */
export const STALE_AFTER_MS = 5000;
