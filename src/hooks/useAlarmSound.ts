import { useEffect, useRef } from 'react';
import type { AlarmEvent } from '../../shared/types';

/**
 * Audible alarm: repeats while any active alarm is unacknowledged. Critical
 * alarms use a two-tone pattern. Browsers only allow audio after a user
 * gesture, so this stays silent until the operator switches it on.
 */
export function useAlarmSound(enabled: boolean, alarms: AlarmEvent[]): void {
  const context = useRef<AudioContext | null>(null);
  const pending = alarms.filter((a) => a.active && !a.acknowledged);
  const level = pending.some((a) => a.severity === 'Critical') ? 2 : pending.length > 0 ? 1 : 0;

  useEffect(() => {
    if (!enabled || level === 0) return;
    context.current ??= new AudioContext();
    const ctx = context.current;

    const beep = (frequency: number, at: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.08, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.3);
    };
    const sound = () => {
      beep(880, 0);
      if (level === 2) beep(660, 0.3);
    };
    sound();
    const timer = setInterval(sound, 2000);
    return () => clearInterval(timer);
  }, [enabled, level]);
}
