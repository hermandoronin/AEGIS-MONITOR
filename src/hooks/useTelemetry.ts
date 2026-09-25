import { useCallback, useEffect } from 'react';
import { apiClient } from '../api/client';
import { HISTORY_SECONDS, VESSEL_ID, WS_URL } from '../config';
import { useVesselStore } from '../store/useVesselStore';
import type { TelemetryFrame } from '../../shared/types';
import { useWebSocket } from './useWebSocket';

/**
 * Wires the dashboard to the server: live frames over the WebSocket, plus
 * vessel particulars and recent history over REST on every (re)connect so
 * the trends have no gap after an outage.
 */
export function useTelemetry(): void {
  const ingestFrame = useVesselStore((s) => s.ingestFrame);
  const loadHistory = useVesselStore((s) => s.loadHistory);
  const setVessel = useVesselStore((s) => s.setVessel);
  const setConnection = useVesselStore((s) => s.setConnection);

  const onMessage = useCallback((frame: TelemetryFrame) => ingestFrame(frame), [ingestFrame]);
  const status = useWebSocket<TelemetryFrame>({ url: WS_URL, onMessage });

  useEffect(() => {
    setConnection(status);
    if (status !== 'open') return;
    apiClient.fetchVessel(VESSEL_ID).then(setVessel).catch(console.error);
    apiClient.fetchHistory(VESSEL_ID, HISTORY_SECONDS).then(loadHistory).catch(console.error);
  }, [status, setConnection, setVessel, loadHistory]);
}
