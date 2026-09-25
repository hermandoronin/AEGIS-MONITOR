import type { HistoryPayload } from '../shared/types';

/**
 * In-memory ring buffer of past readings, one row per tick.
 * One hour at 1 Hz for ~70 tags is about 2 MB. Persistent storage
 * (TimescaleDB) is on the roadmap.
 */
export class HistoryBuffer {
  private readonly rows: number[][] = [];
  private start = 0;

  constructor(
    private readonly tags: string[],
    private readonly capacity: number,
  ) {}

  get size(): number {
    return this.rows.length;
  }

  push(timestamp: number, values: Record<string, number>): void {
    const row = [timestamp, ...this.tags.map((tag) => values[tag] ?? Number.NaN)];
    if (this.rows.length < this.capacity) {
      this.rows.push(row);
    } else {
      this.rows[this.start] = row;
      this.start = (this.start + 1) % this.capacity;
    }
  }

  /** Rows newer than `now - seconds`, oldest first, optionally for a subset of tags. */
  query(seconds: number, now: number, tags?: string[]): HistoryPayload {
    const selected = tags?.length ? tags.filter((t) => this.tags.includes(t)) : this.tags;
    const columns = selected.map((t) => this.tags.indexOf(t) + 1);
    const since = now - seconds * 1000;
    const rows: number[][] = [];
    for (let i = 0; i < this.rows.length; i += 1) {
      const row = this.rows[(this.start + i) % this.rows.length];
      if (row[0] >= since) rows.push([row[0], ...columns.map((c) => row[c])]);
    }
    return { tags: selected, rows };
  }
}
