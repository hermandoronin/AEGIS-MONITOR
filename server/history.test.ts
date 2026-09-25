import { describe, expect, it } from 'vitest';
import { HistoryBuffer } from './history';

describe('HistoryBuffer', () => {
  it('keeps the newest rows in order once it wraps', () => {
    const buffer = new HistoryBuffer(['A', 'B'], 3);
    for (let i = 1; i <= 5; i += 1) buffer.push(i * 1000, { A: i, B: -i });
    expect(buffer.size).toBe(3);
    expect(buffer.query(60, 5000)).toEqual({
      tags: ['A', 'B'],
      rows: [
        [3000, 3, -3],
        [4000, 4, -4],
        [5000, 5, -5],
      ],
    });
  });

  it('filters by time window and by tag', () => {
    const buffer = new HistoryBuffer(['A', 'B'], 10);
    for (let i = 1; i <= 5; i += 1) buffer.push(i * 1000, { A: i, B: -i });
    expect(buffer.query(2, 5000, ['B', 'unknown'])).toEqual({ tags: ['B'], rows: [[3000, -3], [4000, -4], [5000, -5]] });
  });
});
