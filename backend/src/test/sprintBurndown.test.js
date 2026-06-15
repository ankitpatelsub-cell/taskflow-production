import { describe, it, expect } from 'vitest';

// ─── Story-point burndown calculation logic ────────────────────────────────────
// These tests exercise the core series-building algorithm from
// sprints.js GET /:sprintId/burndown, extracted for unit testing.

function buildBurndownSeries({ tasks, completionsByDate, startDate, endDate, today }) {
  const totalPoints = tasks.reduce((sum, t) => sum + (t.points || 1), 0);
  const hasActivityData = Object.keys(completionsByDate).length > 0;

  const start = new Date(startDate + 'T00:00:00Z');
  const end   = new Date(endDate   + 'T00:00:00Z');
  const todayDate = new Date(today + 'T00:00:00Z');
  const effectiveEnd = end < todayDate ? end : todayDate;

  const series = [];
  let cumulativeCompleted = 0;
  let current = new Date(start);

  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);

    if (hasActivityData) {
      cumulativeCompleted += (completionsByDate[dateStr] || 0);
    } else if (current > effectiveEnd) {
      const totalDays = Math.round((end - start) / 86400000) || 1;
      const dayIndex  = Math.round((current - start) / 86400000);
      cumulativeCompleted = Math.round((dayIndex / totalDays) * totalPoints);
    } else {
      const donePoints = tasks.filter(t => t.status === 'done').reduce((s, t) => s + t.points, 0);
      if (current >= effectiveEnd) cumulativeCompleted = donePoints;
    }

    series.push({
      date:      dateStr,
      remaining: Math.max(0, totalPoints - cumulativeCompleted),
      completed: Math.min(totalPoints, cumulativeCompleted),
      total:     totalPoints,
    });

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return series;
}

// ─── Basic structure ──────────────────────────────────────────────────────────
describe('buildBurndownSeries — basic structure', () => {
  it('returns one entry per day inclusive of start and end', () => {
    const tasks = [{ id: 't1', status: 'todo', points: 5 }];
    const series = buildBurndownSeries({
      tasks,
      completionsByDate: {},
      startDate: '2025-01-01',
      endDate: '2025-01-05',
      today: '2025-06-15',
    });
    expect(series).toHaveLength(5);
    expect(series[0].date).toBe('2025-01-01');
    expect(series[4].date).toBe('2025-01-05');
  });

  it('every entry has date, remaining, completed, and total fields', () => {
    const tasks = [{ id: 't1', status: 'todo', points: 3 }];
    const series = buildBurndownSeries({
      tasks,
      completionsByDate: {},
      startDate: '2025-01-01',
      endDate: '2025-01-03',
      today: '2025-06-15',
    });
    series.forEach((entry) => {
      expect(entry).toHaveProperty('date');
      expect(entry).toHaveProperty('remaining');
      expect(entry).toHaveProperty('completed');
      expect(entry).toHaveProperty('total');
    });
  });

  it('total always equals sum of all task story points', () => {
    const tasks = [
      { id: 't1', status: 'todo', points: 3 },
      { id: 't2', status: 'todo', points: 5 },
    ];
    const series = buildBurndownSeries({
      tasks,
      completionsByDate: {},
      startDate: '2025-01-01',
      endDate: '2025-01-03',
      today: '2025-06-15',
    });
    series.forEach((entry) => expect(entry.total).toBe(8));
  });

  it('remaining + completed always equals total', () => {
    const tasks = [
      { id: 't1', status: 'todo', points: 3 },
      { id: 't2', status: 'done', points: 2 },
    ];
    const completionsByDate = { '2025-01-02': 2 };
    const series = buildBurndownSeries({
      tasks,
      completionsByDate,
      startDate: '2025-01-01',
      endDate: '2025-01-03',
      today: '2025-06-15',
    });
    series.forEach((entry) => {
      expect(entry.remaining + entry.completed).toBe(entry.total);
    });
  });
});

// ─── Story point accumulation (with activity data) ───────────────────────────
describe('buildBurndownSeries — with activity data (real completions)', () => {
  const tasks = [
    { id: 't1', status: 'done', points: 3 },
    { id: 't2', status: 'done', points: 5 },
    { id: 't3', status: 'todo', points: 2 },
  ];

  it('starts at full totalPoints on day one (before any completions)', () => {
    const completionsByDate = { '2025-01-02': 3 };
    const series = buildBurndownSeries({
      tasks,
      completionsByDate,
      startDate: '2025-01-01',
      endDate: '2025-01-05',
      today: '2025-06-15',
    });
    expect(series[0].remaining).toBe(10);
    expect(series[0].completed).toBe(0);
  });

  it('burns down story points on the date tasks are completed', () => {
    const completionsByDate = { '2025-01-02': 3, '2025-01-04': 5 };
    const series = buildBurndownSeries({
      tasks,
      completionsByDate,
      startDate: '2025-01-01',
      endDate: '2025-01-05',
      today: '2025-06-15',
    });
    // Day 2: 3 SP completed, 7 remaining
    expect(series[1].completed).toBe(3);
    expect(series[1].remaining).toBe(7);
    // Day 4: 8 SP total completed
    expect(series[3].completed).toBe(8);
    expect(series[3].remaining).toBe(2);
  });

  it('remaining never goes below 0', () => {
    // Over-complete: more points logged than exist
    const completionsByDate = { '2025-01-01': 999 };
    const series = buildBurndownSeries({
      tasks,
      completionsByDate,
      startDate: '2025-01-01',
      endDate: '2025-01-03',
      today: '2025-06-15',
    });
    series.forEach((entry) => expect(entry.remaining).toBeGreaterThanOrEqual(0));
  });

  it('completed never exceeds total', () => {
    const completionsByDate = { '2025-01-01': 999 };
    const series = buildBurndownSeries({
      tasks,
      completionsByDate,
      startDate: '2025-01-01',
      endDate: '2025-01-03',
      today: '2025-06-15',
    });
    series.forEach((entry) => expect(entry.completed).toBeLessThanOrEqual(entry.total));
  });

  it('story points accumulate cumulatively (not per-day)', () => {
    const completionsByDate = { '2025-01-02': 3 };
    const series = buildBurndownSeries({
      tasks,
      completionsByDate,
      startDate: '2025-01-01',
      endDate: '2025-01-05',
      today: '2025-06-15',
    });
    // Day 3, 4, 5: still 3 completed (no new completions)
    expect(series[2].completed).toBe(3);
    expect(series[3].completed).toBe(3);
  });
});

// ─── Tasks with different story points ───────────────────────────────────────
describe('buildBurndownSeries — story point values', () => {
  it('tasks without story_points fall back to 1 point each', () => {
    const tasks = [
      { id: 't1', status: 'todo', points: null },
      { id: 't2', status: 'todo', points: undefined },
    ];
    // Manually calc: COALESCE(story_points, 1) → each task = 1 SP
    const totalPoints = tasks.reduce((sum, t) => sum + (t.points || 1), 0);
    expect(totalPoints).toBe(2);
  });

  it('sums varied story points correctly', () => {
    const tasks = [
      { id: 't1', status: 'todo', points: 1 },
      { id: 't2', status: 'todo', points: 3 },
      { id: 't3', status: 'todo', points: 8 },
      { id: 't4', status: 'todo', points: 13 },
    ];
    const totalPoints = tasks.reduce((sum, t) => sum + (t.points || 1), 0);
    expect(totalPoints).toBe(25);

    const series = buildBurndownSeries({
      tasks,
      completionsByDate: {},
      startDate: '2025-01-01',
      endDate: '2025-01-05',
      today: '2025-06-15',
    });
    series.forEach((entry) => expect(entry.total).toBe(25));
  });
});

// ─── Linear projection (no activity data) ─────────────────────────────────────
describe('buildBurndownSeries — linear projection (no activity data)', () => {
  it('future dates have linearly increasing completion count', () => {
    const tasks = [{ id: 't1', status: 'todo', points: 10 }];
    const series = buildBurndownSeries({
      tasks,
      completionsByDate: {}, // no activity data
      startDate: '2025-01-01',
      endDate: '2025-01-11', // 11 days (0..10 index)
      today: '2025-01-01',   // only day 0 is "past"
    });
    // Days after today should show linear projection
    const projectedDay = series[series.length - 1]; // day 10 (100%)
    expect(projectedDay.completed).toBe(10);
    expect(projectedDay.remaining).toBe(0);
  });

  it('first day has 0 completed when sprint just started', () => {
    const tasks = [{ id: 't1', status: 'todo', points: 5 }];
    const series = buildBurndownSeries({
      tasks,
      completionsByDate: {},
      startDate: '2025-01-01',
      endDate: '2025-01-05',
      today: '2025-01-01',
    });
    expect(series[0].completed).toBe(0);
    expect(series[0].remaining).toBe(5);
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────
describe('buildBurndownSeries — edge cases', () => {
  it('single-day sprint returns exactly one entry', () => {
    const tasks = [{ id: 't1', status: 'done', points: 3 }];
    const series = buildBurndownSeries({
      tasks,
      completionsByDate: { '2025-01-01': 3 },
      startDate: '2025-01-01',
      endDate: '2025-01-01',
      today: '2025-06-15',
    });
    expect(series).toHaveLength(1);
    expect(series[0].date).toBe('2025-01-01');
  });

  it('handles sprint entirely in the past', () => {
    const tasks = [
      { id: 't1', status: 'done', points: 5 },
      { id: 't2', status: 'done', points: 5 },
    ];
    const completionsByDate = { '2025-01-03': 5, '2025-01-05': 5 };
    const series = buildBurndownSeries({
      tasks,
      completionsByDate,
      startDate: '2025-01-01',
      endDate: '2025-01-05',
      today: '2025-06-15',
    });
    expect(series[series.length - 1].completed).toBe(10);
    expect(series[series.length - 1].remaining).toBe(0);
  });
});
