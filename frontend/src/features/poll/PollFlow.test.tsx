import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Schemas } from '@/lib/api/client';
import { renderWithQuery } from '@/test/render';
import { api, http, HttpResponse, poll, REFERENCE, server, USER } from '@/test/server';

import { crumbOf, PollMain } from './PollFlow';

vi.mock('next/navigation', () => ({ usePathname: () => '/polls/3' }));

const QUESTIONS: Schemas['QuestionOut'][] = [
  {
    id: 11,
    text: 'How is your household managing?',
    options: [
      { id: 101, text: 'Managing', description: '' },
      { id: 102, text: 'Struggling', description: 'Essentials are hard to afford' },
    ],
  },
  {
    id: 12,
    text: 'Has it changed this year?',
    options: [
      { id: 201, text: 'Better', description: '' },
      { id: 202, text: 'Worse', description: '' },
    ],
  },
];

function pollOut(overrides: Partial<Schemas['PollOut']> = {}): Schemas['PollOut'] {
  return {
    ...poll({ id: 3, title: 'Cost of living — household impact survey', questionCount: 2, responseCount: 40 }),
    questions: QUESTIONS,
    hasResponded: false,
    ...overrides,
  } as Schemas['PollOut'];
}

function serve(p: Schemas['PollOut'], me: Schemas['UserOut'] | null = USER) {
  server.use(
    http.get(api('/polls/3'), () => HttpResponse.json(p)),
    http.get(api('/reference'), () => HttpResponse.json(REFERENCE)),
    http.get(api('/auth/me'), () => (me ? HttpResponse.json(me) : HttpResponse.json({ detail: 'Not signed in' }, { status: 401 }))),
  );
}

async function answerBoth() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('radio', { name: /Struggling/ }));
  await user.click(screen.getByRole('button', { name: /Next/ }));
  await user.click(await screen.findByRole('radio', { name: 'Worse' }));
  await user.click(screen.getByRole('button', { name: /Next/ }));
  return user;
}

it('takes the breadcrumb from the first part of the title', () => {
  expect(crumbOf('Cost of living — household impact survey')).toBe('Cost of living');
  expect(crumbOf('Plain title')).toBe('Plain title');
});

it.each([
  ['signed out', { hasResponded: null }, 'Sign in to take this poll'],
  ['already responded', { hasResponded: true }, 'You’ve already responded'],
  ['closed', { status: 'closed', closesAt: '2026-04-03T12:00:00Z' }, 'This poll has closed'],
] as const)('shows the %s gate', async (_, overrides, heading) => {
  serve(pollOut(overrides as Partial<Schemas['PollOut']>));
  renderWithQuery(<PollMain id={3} />);
  expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
});

it('links the sign-in gate to /login with the poll as next', async () => {
  serve(pollOut({ hasResponded: null }), null);
  renderWithQuery(<PollMain id={3} />);
  expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login?next=/polls/3');
  expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/login?next=/polls/3#register');
});

it('says not found for an id that isn’t a number, without asking the API', async () => {
  server.use(
    http.get(api('/reference'), () => HttpResponse.json(REFERENCE)),
    http.get(api('/auth/me'), () => HttpResponse.json(USER)),
  );
  renderWithQuery(<PollMain id={null} />);
  expect(await screen.findByRole('heading', { name: 'We couldn’t find that poll' })).toBeInTheDocument();
});

it('says not found for a 404 (a draft, to anyone but an admin)', async () => {
  serve(pollOut());
  server.use(http.get(api('/polls/3'), () => HttpResponse.json({ detail: 'Poll not found' }, { status: 404 })));
  renderWithQuery(<PollMain id={3} />);
  expect(await screen.findByRole('heading', { name: 'We couldn’t find that poll' })).toBeInTheDocument();
});

it('answers with real radios, keeps answers on Back, and needs an answer for Next', async () => {
  serve(pollOut());
  renderWithQuery(<PollMain id={3} />);
  const user = userEvent.setup();
  const next = await screen.findByRole('button', { name: /Next/ });
  expect(next).toBeDisabled();
  expect(screen.getByRole('radiogroup', { name: 'How is your household managing?' })).toBeInTheDocument();
  // The browser's own radio model: arrow keys move the choice (FE-04)
  await user.click(screen.getByRole('radio', { name: 'Managing' }));
  await user.keyboard('{ArrowDown}');
  expect(screen.getByRole('radio', { name: /Struggling/ })).toBeChecked();
  await user.click(next);
  expect(screen.getByRole('heading', { name: 'Has it changed this year?' })).toHaveFocus();
  await user.click(screen.getByRole('button', { name: /Back/ }));
  expect(screen.getByRole('radio', { name: /Struggling/ })).toBeChecked();
});

it('pre-fills the account’s age and state, asks for gender, and submits every answer', async () => {
  serve(pollOut());
  let body: unknown;
  server.use(
    http.post(api('/responses'), async ({ request }) => {
      body = await request.json();
      return HttpResponse.json({ id: 1, pollId: 3, createdAt: '2026-10-20T00:00:00Z' }, { status: 201 });
    }),
    http.get(api('/results/3'), () => HttpResponse.json({ statesCovered: 12 })),
  );
  renderWithQuery(<PollMain id={3} />);
  const user = await answerBoth();
  expect(await screen.findByLabelText('Age range')).toHaveValue('25–34');
  expect(screen.getByLabelText('State of residence')).toHaveValue('ENUGU STATE');

  await user.click(screen.getByRole('button', { name: 'Submit my response' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Please select your gender to submit.');
  expect(screen.getByLabelText('Gender')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByLabelText('Gender')).toHaveFocus();

  await user.selectOptions(screen.getByLabelText('Gender'), 'Woman');
  await user.click(screen.getByRole('button', { name: 'Submit my response' }));
  expect(await screen.findByRole('heading', { name: 'Response recorded. Thank you.' })).toBeInTheDocument();
  expect(body).toEqual({
    pollId: 3,
    ageRange: '25–34',
    gender: 'Woman',
    state: 'ENUGU STATE',
    education: null,
    occupation: null,
    answers: [
      { questionId: 11, optionId: 102 },
      { questionId: 12, optionId: 202 },
    ],
  });
  expect(await screen.findByText(/from 12 states so far/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /View live results/ })).toHaveAttribute('href', '/results/3');
});

it.each([
  [409, 'This poll has closed to new responses.', 'This poll has closed'],
  [409, 'You have already responded to this poll.', 'You’ve already responded'],
  [401, 'Not signed in', 'Sign in to take this poll'],
])('maps a %i (“%s”) to its screen', async (status, detail, heading) => {
  serve(pollOut());
  server.use(http.post(api('/responses'), () => HttpResponse.json({ detail }, { status })));
  renderWithQuery(<PollMain id={3} />);
  const user = await answerBoth();
  await user.selectOptions(await screen.findByLabelText('Gender'), 'Woman');
  await user.click(screen.getByRole('button', { name: 'Submit my response' }));
  expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
});

it('marks the fields a 422 names and shows its message', async () => {
  serve(pollOut());
  server.use(
    http.post(api('/responses'), () =>
      HttpResponse.json({ detail: [{ loc: ['body', 'state'], msg: 'Value error, Unknown state' }] }, { status: 422 }),
    ),
  );
  renderWithQuery(<PollMain id={3} />);
  const user = await answerBoth();
  await user.selectOptions(await screen.findByLabelText('Gender'), 'Woman');
  await user.click(screen.getByRole('button', { name: 'Submit my response' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Some details need fixing.');
  expect(screen.getByLabelText('State of residence')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByRole('button', { name: 'Submit my response' })).toBeEnabled();
});
