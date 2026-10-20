import { IconChartBar, IconEye, IconLock, IconRefresh, IconShield, IconUsers } from '@tabler/icons-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Eyebrow, Paragraph } from '@/components/content/Content';
import { cn } from '@/lib/utils';

/* about.html, word for word (decision 0023, D37). The team biographies, funding model and
   2024–2025 timeline figures are unreviewed copy, left for Milestone 9 (decision 0013). */

export const metadata: Metadata = { title: 'About — PulseAfrica' };

const PILLARS = [
  {
    label: 'Mission',
    title: 'Measure the truth of public opinion',
    text: 'To provide every citizen of the United States of Africa with an accurate, independent, and transparent record of national public sentiment — free from political influence, editorial bias, or commercial interest.',
  },
  {
    label: 'Vision',
    title: 'A democracy that governs by public mandate',
    text: 'A nation where no leader can claim a public mandate they have not earned, where every policy decision is informed by real citizen data, and where the gap between government claims and public reality is zero.',
  },
  {
    label: 'Purpose',
    title: 'Close the gap between power and the people',
    text: 'To make public opinion visible, legible, and impossible to ignore — so that the 450 tribes across 40 states are never reduced to statistics invented by those they elected.',
  },
];

const VALUES = [
  {
    Icon: IconEye,
    title: 'Radical transparency',
    text: 'Our methodology, including what our figures can’t tell you, is published openly. We have nothing to hide because we have nothing to sell.',
  },
  {
    Icon: IconShield,
    title: 'Absolute independence',
    text: 'No government body, political party, or private interest can commission, influence, or suppress a poll on this platform. Ever.',
  },
  {
    Icon: IconUsers,
    title: 'Inclusive representation',
    text: 'All 40 states and 450 tribes deserve a voice in our data. Results aren’t weighted yet, so we show where each poll’s respondents come from and how many answered.',
  },
  {
    Icon: IconLock,
    title: 'Privacy by design',
    text: 'Your answers are stored with your account so each person is counted once. They are never published, shown to other users or included in results except as totals. Your opinion is yours — we only publish what citizens believe collectively, never individually.',
  },
  {
    Icon: IconChartBar,
    title: 'Data over narrative',
    text: 'We publish numbers, not conclusions. We describe what citizens believe — we never tell them what to believe or which leader to prefer.',
  },
  {
    Icon: IconRefresh,
    title: 'Continuous accountability',
    text: 'We correct our errors publicly and promptly. Every correction is logged, dated, and explained. Our record is permanent and fully auditable.',
  },
];

const TIMELINE = [
  {
    date: '2022',
    title: 'The founding observation',
    text: 'Three years after the founding of the United States of Africa, no independent polling institution existed. Government-commissioned surveys told the story leaders wanted told. Citizens had no neutral record of what they actually believed.',
  },
  {
    date: '2023',
    title: 'Research and methodology design',
    text: 'The founding team spent a year studying international polling standards from organisations including YouGov, Pew Research Center, and Gallup, adapting their methodologies to the unique demographic complexity of a 450-tribe, 40-state nation.',
  },
  {
    date: '2024',
    title: 'Platform launch — beta',
    text: 'PulseAfrica launched in private beta with 500 registered users across 12 states. The first poll — presidential approval at 6 months into office — generated 1,840 responses and was published in full, methodology included.',
  },
  {
    date: '2025',
    title: 'National expansion',
    text: 'Coverage extended to all 40 states. Registered users passed 20,000. The platform ran its first multi-sector national poll covering presidency, economy, security, education, and healthcare simultaneously, producing 44,210 responses.',
  },
  {
    date: '2026',
    title: 'Today',
    text: 'Polls open to every registered citizen, with live figures on the home page. And a public record that no government press release can erase.',
  },
];

const TEAM = [
  {
    initials: 'NI',
    avatar: 'bg-navy',
    name: 'Nnamdi Ileh',
    role: 'Founder & Director',
    bio: 'Former survey researcher at the African Union Statistical Institute. 14 years in public opinion measurement across West and Central Africa.',
  },
  {
    initials: 'NO',
    avatar: 'bg-green',
    name: 'Ngozi Orabueze',
    role: 'Head of Methodology',
    bio: 'PhD in Political Science from the University of Chicago. Expert in post-stratification weighting and multilingual survey design for linguistically diverse populations.',
  },
  {
    initials: 'EA',
    avatar: 'bg-gold',
    name: 'Emmanuel Akpan',
    role: 'Lead Data Engineer',
    bio: 'Built data pipeline systems for census operations across 3 states. Leads all backend infrastructure, data integrity, and anti-duplication systems.',
  },
  {
    initials: 'FA',
    avatar: 'bg-indigo',
    name: 'Fatima Abubakar',
    role: 'Civic Outreach Lead',
    bio: 'Coordinates community partnerships across all 40 states to improve demographic representation in our registered user base and extend reach into underserved areas.',
  },
];

const GOALS = [
  {
    title: '100,000 registered voices by 2027',
    text: 'Expanding our registered user base to ensure every state has a statistically significant sample size on every poll we publish.',
  },
  {
    title: 'Offline polling access',
    text: 'Partner with civil society organisations in rural areas to extend polling access beyond internet-connected citizens through assisted data entry programmes.',
  },
  {
    title: 'Multi-language support',
    text: 'Translate the platform and all poll questions into the 12 most widely spoken languages across the United States of Africa to eliminate language barriers to participation.',
  },
  {
    title: 'Open data API',
    text: 'Publish all historical poll data through a free public API so researchers, journalists, and civil society organisations can build on our public record.',
  },
  {
    title: 'Governor-level approval tracking',
    text: 'Launch dedicated approval tracking polls for all 40 state governors, updated monthly and published per state with full demographic breakdowns.',
  },
  {
    title: 'Real-time trend forecasting',
    text: 'Develop predictive models to show where approval ratings are heading — not just where they are — based on historical trend patterns and leading indicators.',
  },
];

function Section({
  id,
  eyebrow,
  title,
  alt = false,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  alt?: boolean;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={cn('px-10 py-[60px] tablet:px-6 tablet:py-11', alt ? 'bg-white' : 'bg-cream')}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 id={id} className="mb-4 font-serif text-[30px] leading-[1.15] font-bold tracking-[-0.025em] text-navy">
        {title}
      </h2>
      {children}
    </section>
  );
}

const CARD = 'rounded-lg border-[0.5px] border-navy/10 bg-white transition-colors';

export default function AboutPage() {
  return (
    <>
      <section
        aria-label="About PulseAfrica"
        className="relative overflow-hidden bg-navy px-10 pt-[60px] pb-[68px] tablet:px-6 tablet:pt-11 tablet:pb-[52px] after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-[38%] after:bg-[repeating-linear-gradient(90deg,var(--gold-stripe)_0px,var(--gold-stripe)_1px,transparent_1px,transparent_52px)] after:content-[''] tablet:after:hidden"
      >
        <p className="mb-3.5 font-mono text-[10px] uppercase tracking-[0.18em] text-gold">Who we are</p>
        <h1 className="mb-[22px] max-w-[580px] font-serif text-[44px] leading-[1.06] font-bold tracking-[-0.035em] text-parchment tablet:text-[32px] mobile:text-[26px]">
          Data is how citizens
          <br />
          hold power <em className="text-gold not-italic">accountable.</em>
        </h1>
        <p className="max-w-[500px] text-[14px] leading-[1.8] text-parchment/55">
          PulseAfrica is an independent civic opinion research platform built to give the people of the United States
          of Africa a credible, transparent record of what they actually think — and to put that record in the hands
          of every citizen, not just those in power.
        </p>
      </section>

      <section aria-labelledby="mvv-heading" className="border-b border-navy/8 bg-parchment px-10 py-14 tablet:px-6 tablet:py-10">
        <h2 id="mvv-heading" className="sr-only">
          Mission, Vision, and Purpose
        </h2>
        <div className="grid grid-cols-3 gap-5 tablet:grid-cols-1 tablet:gap-3.5">
          {PILLARS.map((pillar) => (
            <div key={pillar.label} className="rounded-lg bg-navy px-6 py-7">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-gold">{pillar.label}</p>
              <h3 className="mb-3 font-serif text-[18px] leading-[1.25] font-bold tracking-[-0.02em] text-parchment">
                {pillar.title}
              </h3>
              <p className="text-[13px] leading-[1.75] text-parchment/50">{pillar.text}</p>
            </div>
          ))}
        </div>
      </section>

      <Section id="values-heading" eyebrow="Our values" title="What we stand for">
        <div className="mt-2 grid grid-cols-3 gap-4 tablet:grid-cols-2 mobile:grid-cols-1">
          {VALUES.map(({ Icon, title, text }) => (
            <div key={title} className={cn(CARD, 'px-5 py-[22px] hover:border-gold/40')}>
              <div
                aria-hidden="true"
                className="mb-3.5 flex size-[38px] items-center justify-center rounded-[6px] bg-gold/10 text-gold"
              >
                <Icon size={18} />
              </div>
              <h3 className="mb-1.5 font-serif text-[15px] font-semibold text-navy">{title}</h3>
              <p className="text-[12px] leading-[1.7] text-muted">{text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="story-heading" eyebrow="Our story" title="How PulseAfrica came to be" alt>
        <Paragraph className="max-w-[680px]">
          The United States of Africa was founded on the promise that its people — all 450 tribes across 40 states —
          would finally have a government that governed in their name. But promises require verification. Public
          opinion polling is how a democracy keeps that promise honest.
        </Paragraph>
        <Paragraph className="max-w-[680px]">
          When no independent polling institution emerged in the years after independence, citizens were left with
          only government-commissioned surveys that told the story leaders wanted told. PulseAfrica was built to
          change that.
        </Paragraph>
        <ol
          aria-label="PulseAfrica history timeline"
          className="relative mt-7 flex flex-col before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-0.5 before:bg-gold/20 before:content-[''] mobile:before:hidden"
        >
          {TIMELINE.map((item) => (
            <li key={item.date} className="flex items-start gap-[22px] py-4">
              <div
                aria-hidden="true"
                className="z-1 flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-gold bg-navy"
              >
                <div className="size-2 rounded-full bg-gold" />
              </div>
              <div>
                <p className="mb-[5px] font-mono text-[10px] tracking-[0.06em] text-gold-ink">{item.date}</p>
                <h3 className="mb-[5px] font-serif text-[16px] font-semibold text-navy">{item.title}</h3>
                <p className="max-w-[620px] text-[13px] leading-[1.7] text-muted">{item.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="team-heading" eyebrow="The team" title="The people behind the data">
        <Paragraph className="max-w-[680px]">
          PulseAfrica is built by a small team of researchers, civic technologists, and data scientists committed to
          one thing: an honest record of what citizens of the United States of Africa believe.
        </Paragraph>
        <div className="mt-2 grid grid-cols-4 gap-4 tablet:grid-cols-2 mobile:grid-cols-1">
          {TEAM.map((person) => (
            <div
              key={person.name}
              className={cn(CARD, 'px-[18px] py-[22px] text-center hover:-translate-y-0.5 hover:border-gold/35')}
            >
              <div
                aria-hidden="true"
                className={cn(
                  'mx-auto mb-3.5 flex size-14 items-center justify-center rounded-full font-mono text-[16px] font-bold text-parchment',
                  person.avatar,
                )}
              >
                {person.initials}
              </div>
              <h3 className="mb-1 font-serif text-[15px] font-semibold text-navy">{person.name}</h3>
              <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">{person.role}</p>
              <p className="text-[12px] leading-[1.65] text-muted">{person.bio}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="goals-heading" eyebrow="Platform goals" title="What we are building toward" alt>
        <div className="mt-2 grid grid-cols-2 gap-3.5 tablet:grid-cols-1">
          {GOALS.map((goal, i) => (
            <div
              key={goal.title}
              className="flex items-start gap-3.5 rounded-[6px] border-[0.5px] border-navy/10 bg-cream px-4 py-[18px] transition-colors hover:border-gold/30"
            >
              <span className="mt-0.5 shrink-0 font-mono text-[13px] font-bold text-gold-ink">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <h3 className="mb-[5px] font-serif text-[14px] font-semibold text-navy">{goal.title}</h3>
                <p className="text-[12px] leading-[1.65] text-muted">{goal.text}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <aside
        aria-label="Call to action"
        className="flex flex-wrap items-center justify-between gap-6 bg-green px-10 py-[52px] tablet:flex-col tablet:items-start tablet:px-6 tablet:py-10"
      >
        <div>
          <h2 className="mb-[7px] font-serif text-[28px] font-bold tracking-[-0.025em] text-parchment">
            Be part of the record.
          </h2>
          <p className="max-w-[480px] text-[14px] text-parchment/90">
            Every response makes the data more representative for every citizen across all 40 states. It takes under
            4 minutes.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3 mobile:w-full mobile:flex-col">
          <Link
            href="/polls"
            className="inline-block rounded-md bg-parchment px-6 py-3 text-[13px] font-medium text-navy transition-colors hover:bg-white mobile:w-full mobile:text-center"
          >
            Participate in a poll
          </Link>
          <Link
            href="/methodology"
            className="inline-block rounded-md border border-parchment/30 px-6 py-3 text-[13px] text-parchment transition-colors hover:border-parchment/60 mobile:w-full mobile:text-center"
          >
            Read our methodology
          </Link>
        </div>
      </aside>
    </>
  );
}
