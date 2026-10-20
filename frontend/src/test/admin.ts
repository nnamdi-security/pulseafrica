/* Admin fixtures for the Vitest suites: an admin, the Overview's figures, every poll */
import type { Overview } from '@/features/admin/data';
import type { Schemas } from '@/lib/api/client';

import { api, http, HttpResponse, poll, REFERENCE, server, USER } from './server';

export const ADMIN = { ...USER, role: 'admin' as const };

export const OVERVIEW: Overview = {
  totalUsers: 1520, activeUsers: 1500, suspendedUsers: 20, admins: 2,
  totalPolls: 3, draftPolls: 1, activePolls: 1, closedPolls: 1,
  totalResponses: 400, responsesLast7Days: 96,
  dailyResponses: Array.from({ length: 14 }, (_, i) => ({ date: `2026-10-${String(7 + i).padStart(2, '0')}`, count: i === 4 ? 30 : 2 })),
  polls: [
    { id: 4, title: 'Roads & <b>transport</b>', category: 'economy', status: 'active', closesAt: null, responseCount: 300, responsesLast7Days: 90 },
    { id: 2, title: 'Schools', category: 'education', status: 'closed', closesAt: null, responseCount: 100, responsesLast7Days: 6 },
    { id: 9, title: 'Water supply', category: 'economy', status: 'draft', closesAt: null, responseCount: 0, responsesLast7Days: 0 },
  ],
};

export function serveAdmin({ me = 200, user = ADMIN, overview = 200, polls = 200 }: { me?: number; user?: typeof USER; overview?: number; polls?: number } = {}) {
  const fail = (status: number) => HttpResponse.json({ detail: status === 401 ? 'Not authenticated' : status === 403 ? 'Admin access required' : 'Boom' }, { status });
  server.use(
    http.get(api('/auth/me'), () => (me === 200 ? HttpResponse.json(user) : fail(me))),
    http.get(api('/admin/overview'), () => (overview === 200 ? HttpResponse.json(OVERVIEW) : fail(overview))),
    http.get(api('/polls'), () => (polls === 200 ? HttpResponse.json(ADMIN_POLLS) : fail(polls))),
    http.get(api('/reference'), () => HttpResponse.json(REFERENCE)),
  );
}


export const ADMIN_POLLS: Schemas['PollSummary'][] = [
  poll({ id: 4, title: 'Roads & <b>transport</b>', category: 'economy', status: 'active', responseCount: 300, closesAt: '2026-11-05T23:59:59Z' }),
  poll({ id: 2, title: 'Schools', category: 'education', status: 'closed', responseCount: 100 }),
  poll({ id: 9, title: 'Water supply', category: 'economy', status: 'draft', responseCount: 0 }),
];
