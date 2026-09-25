import { create } from 'zustand';
import { HISTORY_SECONDS } from '../config';
import type { ConnectionStatus } from '../hooks/useWebSocket';
import type { AlarmEvent, HistoryPayload, SystemName, TelemetryFrame, VesselInfo } from '../../shared/types';

export type Tab = 'Overview' | 'Machinery' | 'Voyage' | 'Alarms' | 'Simulator';

/** One second of readings. */
export interface Sample {
  t: number;
  v: Record<string, number>;
}

interface VesselState {
  vessel: VesselInfo | null;
  connection: ConnectionStatus;
  frame: TelemetryFrame | null;
  /** Browser clock when the last frame arrived, for stale-data detection. */
  receivedAt: number;
  history: Sample[];
  alarms: AlarmEvent[];
  tab: Tab;
  selectedSystem: SystemName;
  selectedTag: string | null;

  setVessel: (vessel: VesselInfo) => void;
  setConnection: (status: ConnectionStatus) => void;
  ingestFrame: (frame: TelemetryFrame) => void;
  loadHistory: (payload: HistoryPayload) => void;
  setAlarms: (alarms: AlarmEvent[]) => void;
  setTab: (tab: Tab) => void;
  openSystem: (system: SystemName, tag?: string) => void;
  selectTag: (tag: string | null) => void;
}

const HISTORY_LIMIT = HISTORY_SECONDS + 60;

export const useVesselStore = create<VesselState>((set) => ({
  vessel: null,
  connection: 'connecting',
  frame: null,
  receivedAt: 0,
  history: [],
  alarms: [],
  tab: 'Overview',
  selectedSystem: 'Main Engine',
  selectedTag: null,

  setVessel: (vessel) => set({ vessel }),

  setConnection: (connection) => set({ connection }),

  ingestFrame: (frame) =>
    set((state) => {
      const last = state.history[state.history.length - 1];
      const history =
        last && last.t >= frame.timestamp
          ? state.history
          : [...state.history, { t: frame.timestamp, v: frame.values }].slice(-HISTORY_LIMIT);
      return { frame, history, alarms: frame.alarms, receivedAt: Date.now() };
    }),

  // Merges server history with what the browser already has, filling any gap left by an outage.
  loadHistory: ({ tags, rows }) =>
    set((state) => {
      const byTime = new Map<number, Sample>();
      for (const row of rows) {
        byTime.set(row[0], { t: row[0], v: Object.fromEntries(tags.map((tag, i) => [tag, row[i + 1]])) });
      }
      for (const sample of state.history) byTime.set(sample.t, sample);
      const history = [...byTime.values()].sort((a, b) => a.t - b.t).slice(-HISTORY_LIMIT);
      return { history };
    }),

  setAlarms: (alarms) => set({ alarms }),

  setTab: (tab) => set({ tab }),

  openSystem: (system, tag) =>
    set({ tab: 'Machinery', selectedSystem: system, selectedTag: tag ?? null }),

  selectTag: (selectedTag) => set({ selectedTag }),
}));
