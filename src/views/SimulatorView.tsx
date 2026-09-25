import { useCallback, useEffect, useState } from 'react';
import type { ScenarioInfo } from '../../shared/types';
import { apiClient } from '../api/client';
import { Button, Panel } from '../components/ui';
import { useVesselStore } from '../store/useVesselStore';

/**
 * Fault injection. Each scenario changes the physics inside the plant model;
 * nothing here touches the alarm list directly, so what you see is exactly
 * what the monitoring chain would make of a real failure.
 */
export default function SimulatorView() {
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const active = useVesselStore((s) => s.frame?.scenarios);
  const openSystem = useVesselStore((s) => s.openSystem);

  const run = useCallback((request: Promise<ScenarioInfo[]>) => {
    request.then((list) => {
      setScenarios(list);
      setError(null);
    }).catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    run(apiClient.fetchScenarios());
  }, [run, active?.length]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h1 className="text-xl font-semibold text-white">Plant simulator</h1>
          <p className="text-sm text-slate-400 mt-1">
            Until the monitor is connected to shipboard hardware, the data comes from a physical model
            of the engine room. Inject a failure below and watch it develop on the Machinery and Alarms
            tabs — the same way it would on watch. Stopping a scenario lets the plant recover at its own
            pace; reset puts everything straight back to normal.
          </p>
        </div>
        <Button variant="danger" onClick={() => run(apiClient.resetSimulation())}>
          Reset all faults
        </Button>
      </div>
      {error && <div className="text-xs text-red-400">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {scenarios.map((s) => (
          <Panel
            key={s.id}
            title={
              <span className="flex items-center gap-2 normal-case tracking-normal text-sm text-slate-100">
                {s.active && <span className="w-2 h-2 rounded-full bg-red-500 alarm-flash" />}
                {s.title}
              </span>
            }
            actions={
              <div className="flex gap-2">
                <Button onClick={() => openSystem(s.system)}>Open {s.system}</Button>
                {s.active ? (
                  <Button onClick={() => run(apiClient.setScenario(s.id, false))}>Stop</Button>
                ) : (
                  <Button variant="primary" onClick={() => run(apiClient.setScenario(s.id, true))}>
                    Inject
                  </Button>
                )}
              </div>
            }
            className={s.active ? 'border-red-500/40' : ''}
          >
            <p className="text-xs text-slate-300">{s.description}</p>
            <p className="text-xs text-slate-500 mt-2">
              <span className="text-slate-400">Expect: </span>
              {s.expected}
            </p>
          </Panel>
        ))}
      </div>
    </div>
  );
}
