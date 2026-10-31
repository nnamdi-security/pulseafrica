'use client';

/* admin.html's users list: search, role and status filters and the page kept in the URL
   (decision 0026, D50), and suspend, reactivate, make admin and remove admin, each after a
   confirmation that says what it does (D53). Who may change whom is the API's call: it refuses
   an admin's own access and the last active admin. The own row's buttons are disabled only so
   nobody asks for what will be refused. */
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { CARD, CARD_LABEL } from '@/components/data/Notice';
import { FormAlert } from '@/components/forms/Fields';
import { ApiError } from '@/lib/api/client';
import { useAdminUsers, useUpdateUser } from '@/lib/api/queries';
import { cn } from '@/lib/utils';

import { useAdmin } from './AdminShell';
import { useConfirm } from './ConfirmDialog';
import {
  count,
  longDate,
  pageRange,
  stateName,
  userAction,
  userChangedText,
  userQueryFrom,
  userQueryString,
  usersSummary,
  USERS_PER_PAGE,
  type AdminUser,
  type UserQuery,
} from './data';
import { BUTTON, DANGER_GHOST, INPUT, NUM, RoleBadge, SMALL, TABLE, TABLE_WRAP, TD, TH, UserStatus } from './ui';

const SELF_NOTE = 'You can’t change your own access. Ask another admin.';

function useUserQuery() {
  const params = useSearchParams();
  const pathname = usePathname();
  const query = userQueryFrom(params);
  const set = (next: UserQuery) => window.history.replaceState(null, '', pathname + userQueryString(next));
  return [query, set] as const;
}

export function UsersList() {
  const { user: me, flash, setFlash, sessionEnds } = useAdmin();
  const [query, setQuery] = useUserQuery();
  const [search, setSearch] = useState(query.search);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [busy, setBusy] = useState<number | null>(null);
  const [dialog, confirm] = useConfirm();
  const update = useUpdateUser();
  const users = useAdminUsers({
    search: query.search,
    role: query.role,
    status: query.status,
    limit: USERS_PER_PAGE,
    offset: (query.page - 1) * USERS_PER_PAGE,
  });

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (users.error) sessionEnds(users.error);
  }, [users.error, sessionEnds]);

  function onSearch(value: string) {
    setSearch(value);
    clearTimeout(timer.current);
    // The filters as they are when the pause ends, not when typing started
    timer.current = setTimeout(() => setQuery({ ...userQueryFrom(new URLSearchParams(window.location.search)), search: value.trim(), page: 1 }), 300);
  }

  async function onAction(u: AdminUser, action: 'status' | 'role') {
    setFlash(null);
    const { changes, dialog: opts } = userAction(u, action);
    if (!(await confirm(opts))) return;
    setBusy(u.id);
    update
      .mutateAsync({ id: u.id, body: changes })
      .then((updated) => setFlash({ text: userChangedText(updated, changes), success: true }))
      .catch((err: unknown) => {
        if (!sessionEnds(err)) setFlash({ text: err instanceof ApiError ? err.message : String(err) });
      })
      .finally(() => setBusy(null));
  }

  const page = users.data;
  const range = page ? pageRange(query, page.items.length, page.total) : null;
  const alert = flash ?? (users.error && !page ? { text: users.error.message } : null);

  return (
    <section aria-labelledby="users-heading" className={CARD}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="users-heading" className={CARD_LABEL}>
            Users
          </h2>
          <p aria-live="polite" className="mb-[18px] text-[12px] leading-normal text-muted">
            {page ? usersSummary(page.total, query) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 tablet:w-full">
          <label className="sr-only" htmlFor="user-search">
            Search users
          </label>
          <input
            id="user-search"
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search name or email…"
            className={cn(INPUT, 'w-[220px] tablet:w-full')}
          />
          <label className="sr-only" htmlFor="user-role">
            Role
          </label>
          <select
            id="user-role"
            value={query.role}
            onChange={(e) => setQuery({ ...query, role: e.target.value as UserQuery['role'], page: 1 })}
            className={INPUT}
          >
            <option value="">All roles</option>
            <option value="admin">Admins</option>
            <option value="citizen">Citizens</option>
          </select>
          <label className="sr-only" htmlFor="user-status">
            Status
          </label>
          <select
            id="user-status"
            value={query.status}
            onChange={(e) => setQuery({ ...query, status: e.target.value as UserQuery['status'], page: 1 })}
            className={INPUT}
          >
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {alert ? <FormAlert text={alert.text} success={alert.success} /> : null}

      <div className={TABLE_WRAP}>
        <table className={TABLE}>
          <thead>
            <tr>
              <th scope="col" className={TH}>
                User
              </th>
              <th scope="col" className={TH}>
                State
              </th>
              <th scope="col" className={TH}>
                Joined
              </th>
              <th scope="col" className={cn(TH, NUM)}>
                Polls answered
              </th>
              <th scope="col" className={TH}>
                Role
              </th>
              <th scope="col" className={TH}>
                Status
              </th>
              <th scope="col" className={TH}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody aria-busy={users.isFetching}>
            {!page ? (
              <tr>
                <td colSpan={7} className={cn(TD, 'py-7 text-center text-muted')}>
                  {users.isError ? '' : 'Loading users…'}
                </td>
              </tr>
            ) : page.items.length ? (
              page.items.map((u) => {
                const self = u.id === me.id;
                const title = self ? SELF_NOTE : undefined;
                return (
                  <tr key={u.id} className={u.isActive ? undefined : 'bg-red/3'}>
                    <td className={TD}>
                      <div className="flex min-w-[200px] flex-col gap-0.5">
                        <span className="font-medium text-navy">
                          {u.fullName}
                          {self ? <span className="ml-1 font-mono text-[10px] uppercase tracking-[0.08em] text-green">you</span> : null}
                        </span>
                        <span className="text-[12px] text-muted [overflow-wrap:anywhere]">{u.email}</span>
                      </div>
                    </td>
                    <td className={TD}>{stateName(u.state)}</td>
                    <td className={cn(TD, 'whitespace-nowrap')}>{longDate(u.createdAt)}</td>
                    <td className={cn(TD, NUM)}>{count(u.responseCount)}</td>
                    <td className={TD}>
                      <RoleBadge role={u.role} />
                    </td>
                    <td className={TD}>
                      <UserStatus active={u.isActive} />
                    </td>
                    <td className={TD}>
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={self || busy === u.id}
                          title={title}
                          onClick={() => onAction(u, 'role')}
                          className={cn(BUTTON, SMALL)}
                        >
                          {u.role === 'admin' ? 'Remove admin' : 'Make admin'}
                        </button>
                        <button
                          type="button"
                          disabled={self || busy === u.id}
                          title={title}
                          onClick={() => onAction(u, 'status')}
                          className={cn(BUTTON, SMALL, u.isActive && DANGER_GHOST)}
                        >
                          {u.isActive ? 'Suspend' : 'Reactivate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className={cn(TD, 'py-7 text-center text-muted')}>
                  No users match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <nav aria-label="User list pages" className="mt-4 flex items-center justify-end gap-3">
        <button
          type="button"
          disabled={!range?.previous}
          onClick={() => setQuery({ ...query, page: query.page - 1 })}
          className={BUTTON}
        >
          <IconChevronLeft aria-hidden="true" size={15} /> Previous
        </button>
        <span className="whitespace-nowrap font-mono text-[11px] text-muted">{range?.text}</span>
        <button type="button" disabled={!range?.next} onClick={() => setQuery({ ...query, page: query.page + 1 })} className={BUTTON}>
          Next <IconChevronRight aria-hidden="true" size={15} />
        </button>
      </nav>
      {dialog}
    </section>
  );
}
