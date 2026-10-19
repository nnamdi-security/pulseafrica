import { render, screen } from '@testing-library/react';

import { SiteFooter } from './SiteFooter';

it('links the entries that have a page, and shows the rest as plain text (decision 0019)', () => {
  render(<SiteFooter />);
  const links = Object.fromEntries(
    screen.getAllByRole('link').map((a) => [a.getAttribute('aria-label') || a.textContent, a.getAttribute('href')]),
  );
  expect(links).toEqual({
    'PulseAfrica home': '/',
    'Active Polls': '/polls',
    'Results Dashboard': '/results',
    Methodology: '/methodology',
    'Our Mission': '/about',
  });
  for (const text of ['State Tracker', 'The Team', 'FAQ', 'Press', 'Privacy Policy', 'Terms of Use', 'Data Ethics', 'Cookie Policy']) {
    expect(screen.getByText(text).tagName).toBe('SPAN');
  }
  expect(document.querySelector('a[href="#"]')).toBeNull();
});
