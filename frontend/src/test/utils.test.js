import { describe, it, expect } from 'vitest';
import { cn, formatDate, isOverdue, PRIORITY_COLORS, STATUS_COLORS, STATUS_LABELS } from '@/lib/utils';

describe('cn() — class merger', () => {
  it('merges simple class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('base', true && 'active', false && 'hidden')).toBe('base active');
  });

  it('resolves Tailwind conflicts (last one wins)', () => {
    const result = cn('px-2', 'px-4');
    expect(result).toBe('px-4');
  });

  it('ignores undefined and null values', () => {
    expect(cn('a', undefined, null, 'b')).toBe('a b');
  });
});

describe('formatDate()', () => {
  it('returns null for falsy input', () => {
    expect(formatDate(null)).toBeNull();
    expect(formatDate(undefined)).toBeNull();
    expect(formatDate('')).toBeNull();
  });

  it('returns a readable date string for valid input', () => {
    const result = formatDate('2026-06-15');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    // Should contain the year
    expect(result).toContain('2026');
  });

  it('handles ISO date strings', () => {
    const result = formatDate('2026-01-01T00:00:00.000Z');
    expect(result).toContain('2026');
  });
});

describe('isOverdue()', () => {
  it('returns false for null/undefined', () => {
    expect(isOverdue(null)).toBe(false);
    expect(isOverdue(undefined)).toBe(false);
    expect(isOverdue('')).toBe(false);
  });

  it('returns true for past dates', () => {
    expect(isOverdue('2020-01-01')).toBe(true);
    expect(isOverdue('2023-12-31')).toBe(true);
  });

  it('returns false for future dates', () => {
    expect(isOverdue('2099-01-01')).toBe(false);
    expect(isOverdue('2030-06-15')).toBe(false);
  });
});

describe('PRIORITY_COLORS', () => {
  it('has entries for all priorities', () => {
    expect(PRIORITY_COLORS).toHaveProperty('low');
    expect(PRIORITY_COLORS).toHaveProperty('medium');
    expect(PRIORITY_COLORS).toHaveProperty('high');
    expect(PRIORITY_COLORS).toHaveProperty('critical');
  });

  it('each entry is a non-empty string', () => {
    Object.values(PRIORITY_COLORS).forEach((v) => {
      expect(typeof v).toBe('string');
      expect(v.length).toBeGreaterThan(0);
    });
  });
});

describe('STATUS_COLORS and STATUS_LABELS', () => {
  const statuses = ['todo', 'in_progress', 'review', 'done'];

  it('STATUS_COLORS has all statuses', () => {
    statuses.forEach((s) => expect(STATUS_COLORS).toHaveProperty(s));
  });

  it('STATUS_LABELS has all statuses', () => {
    statuses.forEach((s) => expect(STATUS_LABELS).toHaveProperty(s));
  });

  it('STATUS_LABELS values are human-readable strings', () => {
    expect(STATUS_LABELS.todo).toBe('To Do');
    expect(STATUS_LABELS.in_progress).toBe('In Progress');
    expect(STATUS_LABELS.review).toBe('Review');
    expect(STATUS_LABELS.done).toBe('Done');
  });
});
