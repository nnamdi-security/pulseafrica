import { IconCheck, IconX } from '@tabler/icons-react';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { ConceptCard, Eyebrow, GoldLink, Paragraph } from '@/components/content/Content';
import { SectionNav } from '@/components/content/SectionNav';
import { cn } from '@/lib/utils';

/* methodology.html, word for word (decision 0023, D37). The copy is decision 0013's. */

export const metadata: Metadata = { title: 'Methodology — PulseAfrica' };

const SECTIONS = [
  { id: 'sec-what', label: 'What is polling?' },
  { id: 'sec-how', label: 'How polling works' },
  { id: 'sec-sample', label: 'Sample collection' },
  { id: 'sec-weighting', label: 'Weighting (planned)' },
  { id: 'sec-error', label: 'Sample size' },
  { id: 'sec-limitations', label: 'Limitations' },
  { id: 'sec-dont', label: "What we don't do" },
  { id: 'sec-faq', label: 'FAQ' },
];

const CHIPS = ['Sample collection', 'Weighting (planned)', 'Sample size', 'Limitations', 'Independence'];

const STEPS = [
  {
    title: 'Question design',
    text: 'Questions are written to be neutral, unambiguous, and free from leading language. Each question is reviewed internally for balance and clarity before the poll is opened.',
  },
  {
    title: 'Who answers',
    text: 'Any registered user can answer any live poll. Nobody is selected or invited, so the people who answer choose themselves; they are not matched to the population by age, gender, state or education.',
  },
  {
    title: 'Data collection',
    text: 'Responses are collected through the online poll page from signed-in accounts. Each account can submit one response per poll, and the database refuses a second one.',
  },
  {
    title: 'Counting',
    text: 'Responses are counted as they are, without weighting. Figures count whole steps of 10 responses, so no single answer moves them.',
  },
  {
    title: 'Publication',
    text: 'Overall results appear once 10 people have answered. Breakdowns by group, and the trend over time, are published when the poll closes, leaving out any group with fewer than 10 responses. Every figure shows how many responses it is based on.',
  },
];

const SAMPLE_STATS = [
  { value: '1', label: 'Response per account' },
  { value: '10', label: 'Min. group shown' },
  { value: '100', label: 'Small-sample line' },
  { value: '40', label: 'States' },
];

const COMMITMENTS = [
  {
    kept: false,
    heading: "We don't accept poll commissions",
    text: 'No government body, political party, or private organisation can commission, fund, or direct a poll on this platform.',
  },
  {
    kept: true,
    heading: 'We publish all results',
    text: 'Results are published regardless of outcome. Unfavourable findings for any leader or party are never suppressed. The only things held back protect respondents: groups under 10, and breakdowns until a poll closes.',
  },
  {
    kept: false,
    heading: "We don't share individual data",
    text: "Individual responses are never shared with third parties, governments, advertisers, or any other organisation under any circumstances. Published breakdowns leave out any group with fewer than 10 responses, and a poll's percentages appear only once 10 people have answered.",
  },
  {
    kept: true,
    heading: 'We publish our methodology',
    text: 'Every results page shows how many responses each figure is based on and links to this methodology, which describes how every figure is calculated.',
  },
  {
    kept: false,
    heading: "We don't interpret results politically",
    text: 'PulseAfrica publishes data, not commentary. We do not tell citizens what results mean politically or which leader they should prefer.',
  },
  {
    kept: true,
    heading: 'We correct our errors',
    text: 'If a methodological error is discovered after publication, we correct and republish with a clearly dated correction notice explaining what changed.',
  },
];

const FAQ = [
  {
    q: 'Can anyone participate in a poll?',
    a: 'Any registered adult citizen of the United States of Africa may participate. Registration asks for an email address, state of residence and age range; none of them is verified. Each account may submit one response per poll.',
  },
  {
    q: 'Are results updated in real time?',
    a: 'Response counts update as soon as people answer. Percentages move in steps of 10 responses, so no single answer changes them, and breakdowns by group are published when the poll closes. This protects respondents: nobody watching the results can tell how one person answered.',
  },
  {
    q: 'Who funds PulseAfrica?',
    a: 'PulseAfrica is an independent civic platform. It does not accept advertising, government funding, or political donations. Operational costs are covered through a transparent public interest grant model.',
  },
  {
    q: 'Why do I need to register to answer a poll?',
    a: 'Registration is required to prevent duplicate responses. Your answers are stored with your account so each person is counted once. They are never published, shown to other users or included in results except as totals.',
  },
  {
    q: 'How is PulseAfrica different from a government survey?',
    a: 'PulseAfrica is entirely independent. No government body has access to our data, can influence our questions, or can prevent publication of results. This independence is what makes the data credible and the platform useful.',
  },
  {
    q: "How do I know results haven't been manipulated?",
    a: 'Every results page shows the number of responses behind each figure, and the breakdowns by group once the poll closes. This page explains exactly how the figures are calculated.',
  },
];

function Section({ id, number, title, children }: { id: string; number: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`heading-${id}`} className="mb-14 scroll-mt-7">
      <Eyebrow>Section {number}</Eyebrow>
      <h2
        id={`heading-${id}`}
        className="mb-4 font-serif text-[26px] leading-[1.2] font-bold tracking-[-0.025em] text-navy"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function MethodologyPage() {
  return (
    <>
      <section className="border-b-2 border-gold bg-navy px-10 pt-11 pb-[52px] tablet:px-6 tablet:pt-8 tablet:pb-10">
        <Eyebrow onDark>How we work</Eyebrow>
        <h1 className="mb-3 font-serif text-[34px] leading-[1.1] font-bold tracking-[-0.03em] text-parchment tablet:text-[26px]">
          Polling methodology
        </h1>
        <p className="max-w-[540px] text-[14px] leading-[1.75] text-parchment/55">
          How PulseAfrica collects, protects and publishes public opinion data, and what its figures can and can’t
          tell you.
        </p>
        <ul aria-label="Topics covered" className="mt-[22px] flex flex-wrap gap-2.5">
          {CHIPS.map((chip) => (
            <li
              key={chip}
              className="rounded-xs border border-gold/25 bg-gold/8 px-3 py-[5px] font-mono text-[10px] uppercase tracking-[0.09em] text-gold"
            >
              {chip}
            </li>
          ))}
        </ul>
      </section>

      <div className="grid min-h-[70vh] grid-cols-[210px_1fr] bg-cream tablet:grid-cols-1">
        <SectionNav sections={SECTIONS} />

        <div className="max-w-[760px] px-12 pt-11 pb-16 tablet:px-6 tablet:pt-8 tablet:pb-12">
          <Section id="sec-what" number="01" title="What is polling?">
            <Paragraph>
              Public opinion polling is a systematic method of measuring the views, attitudes, and beliefs of a
              defined population by surveying a carefully selected sample of that population. Rather than asking
              every person in a country — which is both impractical — polling asks a smaller group and draws
              conclusions from their answers. How far those conclusions hold depends on how that group was chosen.
            </Paragraph>
            <ConceptCard term="Population" tone="amber">
              The full group whose opinions we aim to measure. For PulseAfrica, this is all adult citizens of the
              United States of Africa — approximately 180 million people across 40 states and 450 tribes.
            </ConceptCard>
            <ConceptCard term="Sample" tone="green">
              The smaller group who answer a poll. A random sample of 1,000–2,000 people can represent the views of
              millions. PulseAfrica’s samples are not random: they are the registered users who choose to answer each
              poll.
            </ConceptCard>
            <ConceptCard term="Bias" tone="red">
              Any systematic error that causes a sample to over-represent or under-represent certain groups.
              PulseAfrica doesn’t correct for bias yet: results are raw counts, and the limitations below explain
              which groups are likely to be over- or under-represented.
            </ConceptCard>
          </Section>

          <Section id="sec-how" number="02" title="How polling works">
            <Paragraph>Every poll on PulseAfrica goes through five stages, from question design to publication.</Paragraph>
            <ol className="mt-2 flex flex-col">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex items-start gap-[18px] border-b border-navy/6 py-4 last:border-b-0">
                  <span aria-hidden="true" className="mt-0.5 w-[26px] shrink-0 font-mono text-[13px] font-bold text-gold-ink">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="mb-[5px] font-serif text-[15px] font-semibold text-navy">{step.title}</h3>
                    <p className="text-[13px] leading-[1.65] text-muted">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          <Section id="sec-sample" number="03" title="Sample collection">
            <Paragraph>
              PulseAfrica uses a voluntary opt-in panel of registered users. This differs from probability sampling:
              people decide for themselves whether to answer, and no stratification or weighting is applied, so
              results describe the people who answered rather than the whole population.
            </Paragraph>
            <ul aria-label="Key sample statistics" className="my-5 flex flex-wrap gap-3 mobile:flex-col">
              {SAMPLE_STATS.map((stat) => (
                <li
                  key={stat.label}
                  className="min-w-[110px] rounded-[6px] bg-navy px-[18px] py-3.5 text-center mobile:flex mobile:min-w-0 mobile:items-center mobile:gap-3 mobile:text-left"
                >
                  <p className="mb-[5px] font-mono text-[22px] leading-none font-bold tracking-[-0.02em] text-parchment mobile:mb-0 mobile:text-[18px]">
                    {stat.value}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-parchment/50">{stat.label}</p>
                </li>
              ))}
            </ul>
            <Paragraph>
              Responses are accepted only from signed-in, registered accounts, and each account may respond to a given
              poll once. Registration doesn’t verify email addresses, age or citizenship, so a person could create
              more than one account.
            </Paragraph>
            <Paragraph>
              Coverage across states varies from poll to poll. Each results page shows how many of the 40 states its
              respondents came from.
            </Paragraph>
          </Section>

          <Section id="sec-weighting" number="04" title="Weighting (planned)">
            <Paragraph>
              PulseAfrica doesn’t weight its results yet. Every figure is a raw, unweighted count of the responses
              received.
            </Paragraph>
            <Paragraph>
              Weighting adjusts each response so that the people who answered match the population’s make-up by state,
              age, gender and other characteristics. It needs reliable population figures for each of those groups,
              which aren’t available yet.
            </Paragraph>
            <ConceptCard term="Planned" tone="amber">
              Weighting will be introduced only once reliable population figures exist. It will be labelled on every
              result it affects, and the raw figures will stay available beside the weighted ones.
            </ConceptCard>
          </Section>

          <Section id="sec-error" number="05" title="Sample size and uncertainty">
            <Paragraph>
              PulseAfrica doesn’t publish margins of error. A margin of error assumes a random sample, and
              PulseAfrica’s respondents choose to take part, so a margin calculated that way would make the results
              look more precise than they are.
            </Paragraph>
            <ConceptCard term="How to read our figures" tone="amber">
              Every figure shows n, the number of responses it is based on. Figures based on fewer than 100 responses
              are marked as a small sample: at that size, a few people answering differently move the percentage
              noticeably. Groups with fewer than 10 responses aren’t published at all.
            </ConceptCard>
            <Paragraph>
              Breakdowns by state, age group or occupation rest on fewer responses than the overall figures, so they
              swing more. Treat differences between small groups with caution.
            </Paragraph>
          </Section>

          <Section id="sec-limitations" number="06" title="Poll limitations">
            <Paragraph>
              We believe transparency about what our polls cannot do is as important as explaining what they can. The
              following limitations apply to all PulseAfrica polls.
            </Paragraph>
            <ConceptCard term="Online access bias" tone="red">
              Our polls are conducted online. Citizens without reliable internet access are less likely to
              participate, which may under-represent rural and lower-income populations. Results are not weighted, so
              this isn’t corrected.
            </ConceptCard>
            <ConceptCard term="Voluntary response bias" tone="red">
              People with strong opinions are more likely to seek out and complete opinion polls. This is a known
              limitation of opt-in panels, and PulseAfrica doesn’t correct for it yet.
            </ConceptCard>
            <ConceptCard term="Social desirability bias" tone="red">
              Respondents may answer in ways they believe are socially acceptable rather than reflecting their true
              opinions. Careful question wording, and publishing answers only as totals, help mitigate this, but it
              cannot be fully eliminated.
            </ConceptCard>
            <ConceptCard term="Snapshot in time" tone="red">
              Poll results reflect public opinion at a specific point in time. Opinions can shift rapidly in response
              to events. Each closed poll’s results page shows how answers changed while it was open, but a single
              poll result should not be treated as a permanent measure.
            </ConceptCard>
          </Section>

          <Section id="sec-dont" number="07" title="What we don't do">
            <Paragraph>
              Independence and integrity are the foundation of credible polling. These commitments are non-negotiable
              and permanent.
            </Paragraph>
            <ul className="mt-2 grid grid-cols-2 gap-3 tablet:grid-cols-1">
              {COMMITMENTS.map((item) => {
                const Icon = item.kept ? IconCheck : IconX;
                return (
                  <li
                    key={item.heading}
                    className={cn(
                      'flex items-start gap-3 rounded-[6px] border-[0.5px] p-4',
                      item.kept ? 'border-green/15 bg-green/4' : 'border-red/15 bg-red/4',
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      size={17}
                      className={cn('mt-px shrink-0', item.kept ? 'text-green' : 'text-red')}
                    />
                    <div>
                      <h3 className="mb-1 font-serif text-[14px] font-semibold text-navy">{item.heading}</h3>
                      {/* Darker than muted: muted fails 4.5:1 on the tinted card (decision 0017) */}
                      <p className="text-[12px] leading-[1.65] text-ink/65">{item.text}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Section>

          <Section id="sec-faq" number="08" title="Frequently asked questions">
            <ul className="flex flex-col">
              {FAQ.map((item) => (
                <li key={item.q} className="border-b border-navy/7 py-[18px] last:border-b-0">
                  <h3 className="mb-[7px] font-serif text-[16px] leading-[1.3] font-semibold text-navy">{item.q}</h3>
                  <p className="text-[13px] leading-[1.75] text-muted">{item.a}</p>
                </li>
              ))}
            </ul>
          </Section>

          <aside
            aria-label="Call to action"
            className="mt-2 flex flex-wrap items-center justify-between gap-5 rounded-lg bg-navy px-8 py-7 mobile:flex-col mobile:items-start mobile:px-5 mobile:py-[22px]"
          >
            <div>
              <h3 className="mb-1.5 font-serif text-[22px] font-bold tracking-[-0.02em] text-parchment">
                Satisfied with the methodology?
              </h3>
              <p className="text-[13px] text-parchment/55">
                Your participation makes the data more representative for every citizen across all 40 states.
              </p>
            </div>
            <GoldLink href="/polls" className="mobile:w-full mobile:text-center">
              Participate in a poll
            </GoldLink>
          </aside>
        </div>
      </div>
    </>
  );
}
