import { describe, expect, it } from 'vitest';
import { fromLocalInput, haversineKm, qty, statusLabel, timeLeft } from '../utils/format.js';

describe('format helpers', () => {
  it('labels statuses', () => expect(statusLabel('ready_for_pickup')).toBe('Ready for pickup'));
  it('formats quantities', () => expect(qty(12.5, 'kg')).toBe('12.5 kg'));
  it('reports time left and expiry', () => {
    const now = Date.now();
    expect(timeLeft(new Date(now + 90 * 60000), now)).toBe('1h 30m left');
    expect(timeLeft(new Date(now - 1), now)).toBe('Expired');
  });
  it('computes distances', () => expect(haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(111.2, 0));
  it('handles empty local date input', () => expect(fromLocalInput('')).toBeUndefined());
});
