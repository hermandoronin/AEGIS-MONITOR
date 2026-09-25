/**
 * Formatting for engineering values, positions and times.
 * Times are shown in UTC, as ship's logs and alarm printouts are.
 */
import type { ChannelDef } from '../../shared/types';

export function formatValue(channel: ChannelDef, value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '---';
  return value.toLocaleString('en-GB', {
    minimumFractionDigits: channel.decimals,
    maximumFractionDigits: channel.decimals,
  });
}

export function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '---';
  return value.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** HH:MM:SS UTC */
export function formatTime(ms: number): string {
  if (!Number.isFinite(ms)) return '--:--:--';
  return new Date(ms).toISOString().slice(11, 19);
}

/** 25 Sep 14:03 UTC */
export function formatDateTime(ms: number): string {
  if (!Number.isFinite(ms)) return '---';
  const date = new Date(ms);
  const day = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
  return `${day} ${date.toISOString().slice(11, 16)} UTC`;
}

/** 1d 4h 12m */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(' ');
}

export function formatRunningHours(hours: number): string {
  const whole = Math.floor(hours);
  const minutes = Math.floor((hours - whole) * 60);
  return `${whole.toLocaleString('en-GB')} h ${String(minutes).padStart(2, '0')} m`;
}

/** 54°32.7'N */
export function formatLatitude(lat: number): string {
  return formatDm(Math.abs(lat), 2) + (lat >= 0 ? 'N' : 'S');
}

/** 006°32.4'E */
export function formatLongitude(lon: number): string {
  return formatDm(Math.abs(lon), 3) + (lon >= 0 ? 'E' : 'W');
}

function formatDm(value: number, degreeDigits: number): string {
  let degrees = Math.floor(value);
  let minutes = Math.round((value - degrees) * 600) / 10;
  if (minutes >= 60) {
    degrees += 1;
    minutes = 0;
  }
  return `${String(degrees).padStart(degreeDigits, '0')}°${minutes.toFixed(1).padStart(4, '0')}'`;
}

export function formatBearing(deg: number): string {
  return `${String(Math.round(deg) % 360).padStart(3, '0')}°`;
}
