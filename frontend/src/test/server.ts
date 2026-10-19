/* Mock API for unit and component tests (MSW). Handlers match /api/* on any origin;
   each test adds the responses it needs with server.use(). */
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import type { Schemas } from '@/lib/api/client';

export const server = setupServer();
export { http, HttpResponse };

export const api = (path: string) => `*/api${path}`;

export const STATS: Schemas['PlatformStats'] = {
  activePolls: 4,
  closedPolls: 2,
  totalResponses: 12345,
  registeredUsers: 678,
  statesCovered: 40,
  responsesLast7Days: 90,
  trendingPollId: 2,
  syntheticPolls: 0,
};

export const CATEGORIES: Schemas['Category'][] = [
  { key: 'presidency', name: 'Presidency' },
  { key: 'economy', name: 'Economy' },
];

export const REFERENCE: Schemas['Reference'] = {
  states: ['ENUGU STATE'],
  ageRanges: ['25–34'],
  genders: ['Woman'],
  educationLevels: [],
  occupations: [],
  categories: CATEGORIES,
};

export function poll(overrides: Partial<Schemas['PollSummary']>): Schemas['PollSummary'] {
  return {
    id: 1,
    title: 'A poll',
    description: '',
    category: 'presidency',
    status: 'active',
    closesAt: null,
    createdAt: '2026-10-01T00:00:00Z',
    isSynthetic: false,
    responseCount: 0,
    questionCount: 1,
    preview: [],
    ...overrides,
  } as Schemas['PollSummary'];
}

export const USER: Schemas['UserOut'] = {
  id: 7,
  fullName: 'Ngozi Adaeze Eze',
  email: 'ngozi@example.com',
  state: 'ENUGU STATE',
  ageRange: '25–34',
  role: 'citizen',
  createdAt: '2026-10-01T00:00:00Z',
};
