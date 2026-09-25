import { describe, expect, it } from 'vitest';
import { CHANNELS, SYSTEM_INFO, getChannel } from './channels';
import { SYSTEM_NAMES } from './types';

describe('IO list', () => {
  it('has unique tags', () => {
    const tags = CHANNELS.map((c) => c.tag);
    expect(new Set(tags).size).toBe(tags.length);
  });

  it('puts every limit inside the instrument range, warning before critical', () => {
    for (const c of CHANNELS) {
      const rule = c.alarm;
      if (!rule || rule.type === 'state') continue;
      for (const limit of [rule.warning, rule.critical]) {
        if (limit !== undefined) expect(limit > c.min && limit < c.max, c.tag).toBe(true);
      }
      if (rule.warning !== undefined && rule.critical !== undefined) {
        const ordered = rule.type === 'low' ? rule.critical < rule.warning : rule.critical > rule.warning;
        expect(ordered, c.tag).toBe(true);
      }
    }
  });

  it('only uses state alarms on digital points', () => {
    for (const c of CHANNELS) {
      if (c.alarm?.type === 'state') expect(c.kind, c.tag).toBe('digital');
    }
  });

  it('blocks alarms only through existing digital tags', () => {
    for (const c of CHANNELS.filter((ch) => ch.inhibitedBy)) {
      expect(getChannel(c.inhibitedBy!).kind, c.tag).toBe('digital');
    }
  });

  it('describes every system and points its overview at real tags', () => {
    for (const name of SYSTEM_NAMES) {
      expect(CHANNELS.some((c) => c.system === name), name).toBe(true);
      for (const tag of SYSTEM_INFO[name].keyTags) expect(getChannel(tag).system).toBe(name);
      if (SYSTEM_INFO[name].runTag) expect(getChannel(SYSTEM_INFO[name].runTag!).kind).toBe('digital');
    }
  });
});
