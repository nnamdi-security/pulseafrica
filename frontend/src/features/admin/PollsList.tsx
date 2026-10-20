'use client';

/* admin.html's poll list: every poll, drafts included, with a status filter kept in the URL
   (decision 0026, D50), and publish, close, reopen and delete. Which changes are allowed is the
   API's call (a poll with responses can't go back to draft); the page sends them and shows what
   it answers. Deleting asks first and says what will be lost (D53). */
import { IconPlus, IconTrash } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { CARD, CARD_LABEL } from '@/components/data/Notice';
import { CategoryBadge } from '@/components/data/CategoryBadge';
import { FormAlert } from '@/components/forms/Fields';
import { ApiError, type Schemas } from '@/lib/api/client';
import { useDeletePoll, useSavePoll } from '@/lib/api/queries';
import { cn } from '@/lib/utils';

import { useAdmin } from './AdminShell';
import { useConfirm } from './ConfirmDialog';
import { closesOn, count, deleteText, pollFilterFrom, pollsSummary, POLL_FILTERS, type PollFilter } from './data';
import { BUTTON, BUTTON_PRIMARY, DANGER_GHOST, ICON_ONLY, LINK_BUTTON, NUM, SMALL, StatusBadge, TABLE, TABLE_WRAP, TD, TH } from './ui';

type Poll = Schemas['PollSummary'];

function useFilter() {
  const params = useSearchParams();
  const pathname = usePathname();
  const filter = pollFilterFrom(params.get('status'));
  const set = (next: PollFilter) => window.history.replaceState(null, '', next === 'all' ? pathname : `${pathname}?status=${next}`);
  return [filter, set] as const;
}

export function PollsList() {
  const { polls, flash, setFlash, sessionEnds } = useAdmin();
  const [filter, setFilter] = useFilter();
  const [busy, setBusy] = useState<number | null>(null);
  const [dialog, confirm] = useConfirm();
  const save = useSavePoll();
  const remove = useDeletePoll();
  const rows = polls.filter((p) => filter === 'all' || p.status === filter);

  function failed(err: unknown) {
    if (sessionEnds(err)) return;
    setFlash({ text: err instanceof ApiError ? err.message : String(err) });
  }

  function setStatus(poll: Poll, status: 'active' | 'closed') {
    setFlash(null);
    setBusy(poll.id);
    save
      .mutateAsync({ id: poll.id, body: { status } })
      .then(() => setFlash({ text: `“${poll.title}” is now ${status === 'active' ? 'live' : 'closed'}.`, success: true }))
      .catch(failed)
      .finally(() => setBusy(null));
  }

  async function onDelete(poll: Poll) {
    setFlash(null);
    if (!(await confirm({ title: 'Delete this poll?', text: deleteText(poll), confirm: 'Delete poll' }))) return;
    setBusy(poll.id);
    remove
      .mutateAsync(poll.id)
      .then(() => setFlash({ text: `“${poll.title}” was deleted.`, success: true }))
      .catch(failed)
      .finally(() => setBusy(null));
  }

  return (
    <section aria-labelledby="poll-list-heading" className={CARD}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="poll-list-heading" className={CARD_LABEL}>
            Polls
          </h2>
          <p className="mb-[18px] text-[12px] leading-normal text-muted">{pollsSummary(polls)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div role="group" aria-label="Filter by status" className="inline-flex overflow-hidden rounded-[5px] border border-navy/12">
            {POLL_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                aria-pressed={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  'border-l border-navy/12 px-3.5 py-[7px] text-[12px] first:border-l-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold',
                  filter === f.value ? 'bg-navy text-parchment' : 'bg-white text-slate',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Link href="/admin/polls/new" className={cn(BUTTON_PRIMARY, 'hover:bg-navy-hover')} onClick={() => setFlash(null)}>
            <IconPlus aria-hidden="true" size={15} /> New poll
          </Link>
        </div>
      </div>

      {flash ? <FormAlert text={flash.text} success={flash.success} /> : null}

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
              <th scope="col" className={TH}>
                Closes
              </th>
              <th scope="col" className={TH}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((p) => (
                <tr key={p.id}>
                  <td className={TD}>
                    <div className="flex min-w-[220px] flex-col items-start gap-1.5">
                      <CategoryBadge category={p.category} />
                      <span className="font-medium text-navy">{p.title}</span>
                    </div>
                  </td>
                  <td className={TD}>
                    <StatusBadge status={p.status} />
                  </td>
                  <td className={cn(TD, NUM)}>{count(p.responseCount)}</td>
                  <td className={TD}>{p.closesAt ? closesOn(p.closesAt) : <span className="text-muted">No date</span>}</td>
                  <td className={TD}>
                    <div className="flex justify-end gap-1.5">
                      <Link href={`/admin/polls/${p.id}/edit`} className={cn(LINK_BUTTON, SMALL)} onClick={() => setFlash(null)}>
                        Edit
                      </Link>
                      <button
                        type="button"
                        disabled={busy === p.id}
                        onClick={() => setStatus(p, p.status === 'active' ? 'closed' : 'active')}
                        className={cn(BUTTON, SMALL)}
                      >
                        {p.status === 'active' ? 'Close' : p.status === 'draft' ? 'Publish' : 'Reopen'}
                      </button>
                      <Link href={`/results/${p.id}`} className={cn(LINK_BUTTON, SMALL)}>
                        Results
                      </Link>
                      <button
                        type="button"
                        disabled={busy === p.id}
                        aria-label={`Delete ${p.title}`}
                        onClick={() => onDelete(p)}
                        className={cn(BUTTON, SMALL, ICON_ONLY, DANGER_GHOST)}
                      >
                        <IconTrash aria-hidden="true" size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className={cn(TD, 'py-7 text-center text-muted')}>
                  {polls.length ? 'No polls with this status.' : 'No polls yet. Create the first one.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {dialog}
    </section>
  );
}
