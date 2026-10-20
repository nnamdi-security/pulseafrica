import { poll } from '@/test/server';

import { filterHistory, firstName, memberSince, stateShort, waitingPolls, type Answered } from './data';

function answered(pollId: number, pollStatus = 'active'): Answered {
  return { pollId, pollStatus, pollTitle: `Poll ${pollId}`, category: 'economy', closesAt: null, respondedAt: '2026-10-10T09:00:00Z' };
}

describe('dashboard figures', () => {
  it('lists live polls not yet answered, most responses first', () => {
    const polls = [
      poll({ id: 1, responseCount: 5 }),
      poll({ id: 2, responseCount: 50 }),
      poll({ id: 3, responseCount: 500, status: 'closed' }),
      poll({ id: 4, responseCount: 20 }),
    ];
    expect(waitingPolls([answered(1)], polls).map((p) => p.id)).toEqual([2, 4]);
    expect(waitingPolls([answered(2), answered(4), answered(1)], polls)).toEqual([]);
  });

  it('filters the history by poll status', () => {
    const rows = [answered(1), answered(2, 'closed'), answered(3)];
    expect(filterHistory(rows, 'all')).toHaveLength(3);
    expect(filterHistory(rows, 'active').map((r) => r.pollId)).toEqual([1, 3]);
    expect(filterHistory(rows, 'closed').map((r) => r.pollId)).toEqual([2]);
  });

  it('formats the header figures as dashboard.html does', () => {
    expect(memberSince('2026-10-01T12:00:00Z')).toBe('Oct 2026');
    expect(stateShort('ENUGU STATE')).toBe('ENUGU');
    expect(stateShort('FEDERAL CAPITAL TERRITORY')).toBe('FEDERAL CAPITAL TERRITORY');
    expect(firstName('  Ngozi Adaeze Eze ')).toBe('Ngozi');
  });
});
