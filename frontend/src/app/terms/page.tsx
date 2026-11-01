import type { Metadata } from 'next';
import Link from 'next/link';

import { CONTACT_EMAIL, LegalList, LegalPage, Paragraph, type LegalSection } from '@/components/content/LegalPage';

/* Milestone 9, D64 (FE-05). Short terms for a demonstration site; the rules they mention are
   the API's own (one response per poll, 18+ at registration, admins can suspend accounts). */

export const metadata: Metadata = { title: 'Terms of Use — PulseAfrica' };

const LINK = 'font-medium text-navy underline underline-offset-2 hover:text-gold-ink';

const SECTIONS: LegalSection[] = [
  {
    id: 'what',
    label: 'What this site is',
    title: 'What this site is',
    body: (
      <>
        <Paragraph>
          PulseAfrica is an independent, non-commercial portfolio project. The United States of Africa, its states, its
          leaders and its polls are fictional, and the site runs as a demonstration: its polls and most of its responses
          are synthetic.
        </Paragraph>
        <Paragraph>
          It is not an election, a vote or an official survey, and its results are not research. Please don&rsquo;t
          quote them as findings about any real place or person.
        </Paragraph>
      </>
    ),
  },
  {
    id: 'account',
    label: 'Your account',
    title: 'Your account',
    body: (
      <LegalList
        items={[
          'You must be 18 or older to register.',
          'Keep one account for yourself, and keep your password to yourself.',
          'The details you give with a response are yours to choose; they are only ever published as totals.',
          <>
            You can delete your account at any time in Settings, as the{' '}
            <Link href="/privacy#choices" className={LINK}>
              privacy notice
            </Link>{' '}
            explains.
          </>,
        ]}
      />
    ),
  },
  {
    id: 'use',
    label: 'Fair use',
    title: 'Using the site fairly',
    body: (
      <>
        <Paragraph>Please don&rsquo;t:</Paragraph>
        <LegalList
          items={[
            'create more than one account, or answer on someone else’s behalf, to change the results;',
            'send automated or bulk requests, or try to get around the limits on signing in and registering;',
            'try to reach data or pages that aren’t yours, or to disrupt the site for others.',
          ]}
        />
        <Paragraph>Administrators may suspend an account that does.</Paragraph>
      </>
    ),
  },
  {
    id: 'availability',
    label: 'Availability',
    title: 'Availability and changes',
    body: (
      <Paragraph>
        The site is provided as it is, without any guarantee that it will be available, accurate or kept. As a
        demonstration it may change, be reset or be taken down at any time. To the extent the law allows, the project
        accepts no liability for any loss arising from using it.
      </Paragraph>
    ),
  },
  {
    id: 'contact',
    label: 'Contact',
    title: 'Changes and contact',
    body: (
      <Paragraph>
        When these terms change, the new version is published here with its date. Questions:{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className={LINK}>
          {CONTACT_EMAIL}
        </a>
        .
      </Paragraph>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms"
      title="Terms of use"
      intro="The short rules for using PulseAfrica, a demonstration site about a fictional nation."
      sections={SECTIONS}
    />
  );
}
