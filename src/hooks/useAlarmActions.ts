import { useCallback } from 'react';
import { apiClient } from '../api/client';
import { VESSEL_ID } from '../config';
import { useVesselStore } from '../store/useVesselStore';

/** Acknowledgements go to the server, so every connected screen sees them. */
export function useAlarmActions() {
  const setAlarms = useVesselStore((s) => s.setAlarms);

  const acknowledge = useCallback(
    (alarmId: string) => {
      apiClient.acknowledge(VESSEL_ID, alarmId).then((r) => setAlarms(r.alarms)).catch(console.error);
    },
    [setAlarms],
  );

  const acknowledgeAll = useCallback(() => {
    apiClient.acknowledgeAll(VESSEL_ID).then((r) => setAlarms(r.alarms)).catch(console.error);
  }, [setAlarms]);

  return { acknowledge, acknowledgeAll };
}
