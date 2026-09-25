import type { ReactNode } from 'react';
import type { AlarmSeverity, SystemState } from '../../shared/types';

export function Panel({
  title,
  actions,
  children,
  className = '',
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`bg-slate-900/80 border border-slate-800 rounded-lg p-4 ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h2>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, unit, tone = 'text-slate-100' }: {
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: string;
}) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-md px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-lg font-mono font-semibold tabular ${tone}`}>
        {value}
        {unit && <span className="text-xs font-normal text-slate-500 ml-1">{unit}</span>}
      </div>
    </div>
  );
}

export const SEVERITY_STYLE: Record<AlarmSeverity, { bar: string; text: string; chip: string }> = {
  Critical: { bar: 'bg-red-500', text: 'text-red-400', chip: 'bg-red-500/15 text-red-300 border-red-500/40' },
  Warning: { bar: 'bg-orange-400', text: 'text-orange-300', chip: 'bg-orange-400/15 text-orange-200 border-orange-400/40' },
  Caution: { bar: 'bg-yellow-300', text: 'text-yellow-200', chip: 'bg-yellow-300/10 text-yellow-100 border-yellow-300/40' },
};

export const STATE_DOT: Record<SystemState, string> = {
  Running: 'bg-green-500',
  Standby: 'bg-sky-400',
  Fault: 'bg-red-500',
  Offline: 'bg-slate-600',
};

export function StateBadge({ state }: { state: SystemState }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-300">
      <span className={`w-2 h-2 rounded-full ${STATE_DOT[state]}`} />
      {state}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = 'default',
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'danger';
  disabled?: boolean;
}) {
  const style = {
    default: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700',
    primary: 'bg-sky-600 hover:bg-sky-500 text-white border-sky-500',
    danger: 'bg-red-600/80 hover:bg-red-600 text-white border-red-500',
  }[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-xs font-medium px-3 py-1.5 rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${style}`}
    >
      {children}
    </button>
  );
}
