'use client';

/* admin.html's Overview: platform totals, responses per day for the last 14 days, and
   participation by poll. Counts only: no admin view shows how anyone answered. */
import Link from 'next/link';
import type { ReactNode } from 'react';

import { CARD, CARD_LABEL } from '@/components/data/Notice';
import { plural, shortDate } from '@/features/results/figures';
import { cn } from '@/lib/utils';

import { useAdmin } from './AdminShell';
import { columnLabel, count, daily, share, totals, type Day } from './data';
import { NUM, StatusBadge, TABLE, TABLE_WRAP, TD, TH } from './ui';

const SUB = 'mb-[18px] text-[12px] leading-normal text-muted';

function Card({ id, label, sub, children, className }: { id: string; label: string; sub?: string; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={cn(CARD, className)}>
      <h2 id={id} className={CARD_LABEL}>
        {label}
      </h2>
      {sub ? <p className={SUB}>{sub}</p> : null}
      {children}
    </section>
  );
}

function Totals() {
  const { overview } = useAdmin();
  return (
    <Card id="totals-heading" label="Platform totals">
      <dl className="mt-3.5 mb-5 grid grid-cols-3 gap-x-5 gap-y-4 tablet:grid-cols-1">
        {totals(overview).map(([group, rows]) => (
          <div key={group}>
            <dt className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{group}</dt>
            {rows.map(([label, value]) => (
              <dd key={label} className="flex justify-between gap-2 border-b border-navy/6 py-[5px] text-[13px]">
                <span className="text-muted">{label}</span>
                <strong className="font-mono font-bold text-navy">{count(value)}</strong>
              </dd>
            ))}
          </div>
        ))}
      </dl>
    </Card>
  );
}

/** One series, so the card title names it and there's no legend. Each column is focusable and
    shows its value on hover and focus; the table below lists every day. */
function Columns({ days }: { days: Day[] }) {
  const { max, first, last, label } = daily(days);
  return (
    <div role="img" aria-label={label} className="mt-3.5">
      <div className="grid h-[150px] grid-cols-14 items-end gap-0.5 border-b border-navy/25 bg-[linear-gradient(color-mix(in_srgb,var(--color-navy)_5%,transparent)_1px,transparent_1px)] bg-size-[100%_50%]">
        {days.map((d, i) => {
          const tip = `${shortDate(d.date)}: ${plural(d.count, 'response')}`;
          return (
            <div
              key={d.date}
              role="img"
              tabIndex={0}
              aria-label={tip}
              data-tip={tip}
              className={cn(
                'group relative flex h-[150px] cursor-default items-end focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold',
                'after:pointer-events-none after:absolute after:bottom-[calc(100%+6px)] after:z-2 after:rounded-sm after:bg-navy after:px-2 after:py-[5px] after:font-mono after:text-[10px] after:whitespace-nowrap after:text-parchment after:opacity-0 after:transition-opacity after:duration-100 after:content-[attr(data-tip)] hover:after:opacity-100 focus-visible:after:opacity-100',
                i === 0 ? 'after:left-0' : i === days.length - 1 ? 'after:right-0' : 'after:left-1/2 after:-translate-x-1/2',
              )}
            >
              <div
                style={{ height: `${(100 * d.count) / max}%` }}
                className={cn(
                  'min-h-0.5 w-full rounded-t-sm transition-colors group-hover:bg-gold-dark group-focus-visible:bg-gold-dark',
                  d.count ? 'bg-gold' : 'bg-navy/12',
                )}
              />
              <span aria-hidden="true" className="absolute right-0 -bottom-5 left-0 text-center font-mono text-[10px] text-muted">
                {columnLabel(days, i)}
              </span>
            </div>
          );
        })}
      </div>
      <div aria-hidden="true" className="mt-6 flex justify-between font-mono text-[10px] text-muted">
        <span>{first}</span>
        <span>{last}</span>
      </div>
    </div>
  );
}

function Daily() {
  const { overview } = useAdmin();
  const days = overview.dailyResponses;
  return (
    <Card id="daily-heading" label="Responses per day · last 14 days" sub={daily(days).sub}>
      <Columns days={days} />
      <details className="mt-3.5 text-[12px] text-muted">
        <summary className="cursor-pointer font-medium text-green [[open]>&]:mb-1.5">Show as table</summary>
        <table className={TABLE}>
          <thead>
            <tr>
              <th scope="col" className={cn(TH, 'pb-1.5')}>
                Day (UTC)
              </th>
              <th scope="col" className={cn(TH, NUM, 'pb-1.5')}>
                Responses
              </th>
            </tr>
          </thead>
          <tbody>
            {days
              .slice()
              .reverse()
              .map((d) => (
                <tr key={d.date}>
                  <td className={cn(TD, 'py-1.5')}>{shortDate(d.date)}</td>
                  <td className={cn(TD, NUM, 'py-1.5')}>{count(d.count)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </Card>
  );
}

function Participation() {
  const { overview } = useAdmin();
  return (
    <Card id="part-heading" label="Participation by poll" sub="Every poll, drafts included, most responses first">
      <div className={TABLE_WRAP}>
        <table className={TABLE}>
          <thead>
            <tr>
              <th scope="col" className={TH}>
                Poll
              </th>
              <th scope="col" className={TH}>
                Status
              </th>
              <th scope="col" className={cn(TH, NUM)}>
                Responses
              </th>
              <th scope="col" className={cn(TH, NUM)}>
                Last 7 days
              </th>
              <th scope="col" className={TH}>
                Share of all responses
              </th>
            </tr>
          </thead>
          <tbody>
            {overview.polls.length ? (
              overview.polls.map((p) => {
                const pct = share(p.responseCount, overview.totalResponses);
                return (
                  <tr key={p.id}>
                    <td className={TD}>
                      <Link href={`/results/${p.id}`} className="font-medium text-navy hover:text-gold-ink">
                        {p.title}
                      </Link>
                    </td>
                    <td className={TD}>
                      <StatusBadge status={p.status} />
                    </td>
                    <td className={cn(TD, NUM)}>{count(p.responseCount)}</td>
                    <td className={cn(TD, NUM)}>{count(p.responsesLast7Days)}</td>
                    <td className={TD}>
                      <div title={`${pct}% of all responses`} className="flex min-w-[140px] items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-[3px] bg-navy/6">
                          <div style={{ width: `${pct}%` }} className="h-full rounded-r-[3px] bg-gold" />
                        </div>
                        <span className="w-8 text-right font-mono text-[10px] text-muted">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className={cn(TD, 'py-7 text-center text-muted')}>
                  No polls yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function Overview() {
  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-5 tablet:grid-cols-1 [&>*]:mb-0">
        <Totals />
        <Daily />
      </div>
      <Participation />
    </>
  );
}
