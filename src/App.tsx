import { STALE_AFTER_MS } from './config';
import Header from './components/Header';
import SystemSidebar from './components/SystemSidebar';
import { useNow } from './hooks/useNow';
import { useTelemetry } from './hooks/useTelemetry';
import { useVesselStore } from './store/useVesselStore';
import AlarmsView from './views/AlarmsView';
import PlantOverview from './views/PlantOverview';
import SimulatorView from './views/SimulatorView';
import SystemView from './views/SystemView';
import VoyageView from './views/VoyageView';

function Waiting() {
  const connection = useVesselStore((s) => s.connection);
  return (
    <div className="max-w-xl mx-auto mt-16 bg-slate-900 border border-dashed border-slate-700 rounded-lg p-8 text-center">
      <p className="text-slate-200 font-medium">
        {connection === 'connecting' ? 'Connecting to the monitoring server…' : 'No telemetry received'}
      </p>
      <p className="text-slate-500 text-sm mt-2">
        The dashboard only shows data it receives. Start the server with{' '}
        <code className="text-sky-400">npm run server</code> (or <code className="text-sky-400">npm start</code>{' '}
        for server and dashboard together). It reconnects automatically.
      </p>
    </div>
  );
}

export default function App() {
  useTelemetry();
  const frame = useVesselStore((s) => s.frame);
  const tab = useVesselStore((s) => s.tab);
  const connection = useVesselStore((s) => s.connection);
  const receivedAt = useVesselStore((s) => s.receivedAt);
  const now = useNow();
  const stale = connection !== 'open' || now - receivedAt > STALE_AFTER_MS;

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <SystemSidebar />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {frame && stale && (
            <div className="mb-4 rounded border border-yellow-400/40 bg-yellow-400/10 px-3 py-2 text-xs text-yellow-200">
              Connection to the monitoring server lost. Values below are the last received and are not live.
            </div>
          )}
          {!frame ? (
            <Waiting />
          ) : (
            <>
              {tab === 'Overview' && <PlantOverview stale={stale} />}
              {tab === 'Machinery' && <SystemView stale={stale} />}
              {tab === 'Voyage' && <VoyageView />}
              {tab === 'Alarms' && <AlarmsView />}
              {tab === 'Simulator' && <SimulatorView />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
