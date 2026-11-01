import type { Metadata } from 'next';
import Link from 'next/link';

import { CONTACT_EMAIL, LegalList, LegalPage, Paragraph, type LegalSection } from '@/components/content/LegalPage';

/* Milestone 9, D64 (FE-05). Every statement here describes the code as it is:
   models/user.py and models/response.py (what's stored), api/ratelimit.py (attempts, kept for
   the longest limit, an hour), core/logging.py (no query strings or bodies), routes/auth.py
   (the session cookie; account deletion removes responses), the results rules (decisions
   0001, 0006), and render.yaml (the host and region). Check them before changing a sentence. */

export const metadata: Metadata = { title: 'Privacy — PulseAfrica' };

const LINK = 'font-medium text-navy underline underline-offset-2 hover:text-gold-ink';

const SECTIONS: LegalSection[] = [
  {
    id: 'who',
    label: 'Who we are',
    title: 'Who runs this site',
    body: (
      <>
        <Paragraph>
          PulseAfrica is an independent, non-commercial portfolio project about a fictional nation, the United States
          of Africa (<Link href="/about#project-heading" className={LINK}>about the project</Link>). The site runs as
          a demonstration: its polls, and most of the responses in its results, are synthetic.
        </Paragraph>
        <Paragraph>
          For any question about your data, write to{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className={LINK}>
            {CONTACT_EMAIL}
          </a>
          .
        </Paragraph>
      </>
    ),
  },
  {
    id: 'stored',
    label: 'What we store',
    title: 'What we store',
    body: (
      <>
        <LegalList
          items={[
            <>
              <strong className="font-medium text-navy">Your account:</strong> your full name, email address, state and
              age range; a one-way hash of your password, never the password itself; whether you are a citizen or an
              administrator; and when you registered.
            </>,
            <>
              <strong className="font-medium text-navy">Your responses:</strong> for each poll you answer, the options you
              chose, the details you gave with that response (age range, gender and state, and education and occupation
              if you chose to give them), and when you answered. Your answers are stored with your account so each person
              is counted once.
            </>,
            <>
              <strong className="font-medium text-navy">Sign-in protection:</strong> to limit repeated attempts to sign
              in or register, we record the network (IP) address and the email address of each attempt. Records older
              than an hour are deleted the next time the limits are checked.
            </>,
            <>
              <strong className="font-medium text-navy">Server logs:</strong> for each request, its method, path, status
              and duration, with a request number. Not search terms, form contents, passwords or sign-in tokens. Our
              hosting provider keeps its own access logs, which can include network addresses.
            </>,
          ]}
        />
        <Paragraph>We don&rsquo;t use analytics, advertising or tracking of any kind.</Paragraph>
      </>
    ),
  },
  {
    id: 'published',
    label: 'What we publish',
    title: 'What we publish',
    body: (
      <>
        <Paragraph>
          Your answers are never published, shown to other users or included in results except as totals. Your name and
          email address are never published.
        </Paragraph>
        <LegalList
          items={[
            'A poll’s percentages appear only once 10 people have answered, and move in steps of 10 responses.',
            'Breakdowns by group are published only after a poll closes, and any group with fewer than 10 responses is left out.',
            'Administrators can see account details and how many polls each account has answered, but not anyone’s answers.',
          ]}
        />
        <Paragraph>
          The <Link href="/methodology" className={LINK}>methodology</Link> explains how every figure is calculated.
        </Paragraph>
      </>
    ),
  },
  {
    id: 'cookies',
    label: 'Cookies',
    title: 'Cookies',
    body: (
      <>
        <Paragraph>
          We set one cookie, when you sign in: a session cookie that keeps you signed in. Page scripts can&rsquo;t read
          it, and your browser sends it only with requests to this site&rsquo;s API. It lasts until you close your
          browser, or for up to an hour if you choose &ldquo;Keep me signed in&rdquo;, and signing out removes it.
        </Paragraph>
        <Paragraph>
          There are no analytics, advertising or third-party cookies. Fonts and scripts are served from this site.
        </Paragraph>
      </>
    ),
  },
  {
    id: 'where',
    label: 'Where it is kept',
    title: 'Where your data is kept',
    body: (
      <Paragraph>
        The site, its API and its database run on Render, a hosting provider, in its Frankfurt (European Union) region.
        The database is not reachable from the internet, and it is backed up daily; backups are kept for the
        provider&rsquo;s retention period and then deleted. We don&rsquo;t sell or share your data with anyone else.
      </Paragraph>
    ),
  },
  {
    id: 'choices',
    label: 'Your choices',
    title: 'Your choices',
    body: (
      <LegalList
        items={[
          <>
            <strong className="font-medium text-navy">See your data:</strong> your Dashboard shows your account details
            and the polls you have answered.
          </>,
          <>
            <strong className="font-medium text-navy">Correct it:</strong> change your name, state and age range in
            Settings.
          </>,
          <>
            <strong className="font-medium text-navy">Delete it:</strong> deleting your account in Settings removes your
            account and every response you gave, so your answers leave the results. Copies in backups are deleted when
            those backups expire.
          </>,
          <>
            <strong className="font-medium text-navy">Anything else,</strong> including a password you can&rsquo;t
            reset yourself yet: write to{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className={LINK}>
              {CONTACT_EMAIL}
            </a>
            .
          </>,
        ]}
      />
    ),
  },
  {
    id: 'changes',
    label: 'Changes',
    title: 'Changes to this notice',
    body: (
      <Paragraph>
        When this notice changes, the new version is published here with its date. If a change affects what we store or
        publish about you, the site will say so before it takes effect.
      </Paragraph>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title="Privacy notice"
      intro="What PulseAfrica stores about you, what it publishes, and how to remove your data."
      sections={SECTIONS}
    />
  );
}
