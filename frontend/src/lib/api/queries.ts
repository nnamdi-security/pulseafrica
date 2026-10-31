'use client';

/* Query hooks shared across pages. The keys and fetchers are in options.ts, so the server's
   prefetches (server.ts) fill exactly the queries these hooks read. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, ApiError, type AdminUsersQuery, type Schemas } from './client';
import { pollQuery, pollsQuery, queryKeys, referenceQuery, resultsQuery, statsQuery } from './options';

export { queryKeys };

/** The signed-in user, or null when signed out. An unreachable server is an error, not "signed out". */
export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) =>
      api.me(signal).catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }),
    retry: false,
  });
}

/** The signed-in user's participation history; only asked for while someone is signed in */
export function useMyResponses(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.myResponses,
    queryFn: ({ signal }) => api.myResponses(signal),
    enabled,
    retry: false,
  });
}

/** Signs out everywhere, then forgets every cached response so nothing of this user is left behind */
export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.logout().catch(() => null),
    onSettled: () => {
      queryClient.clear();
      queryClient.setQueryData<Schemas['UserOut'] | null>(queryKeys.me, null);
    },
  });
}

/** Signs in (and, for a new account, registers first), then treats every cached response as
    another user's: `me` is set, everything else is refetched (FRONTEND_MIGRATION.md §8) */
export function useSignIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ register, ...login }: Schemas['UserLogin'] & { register?: Schemas['UserRegister'] }) => {
      if (register) await api.register(register);
      await api.signIn(login);
      return api.me();
    },
    onSuccess: (user) => {
      // A history refused before (an ended session) must not outlive the new sign-in
      queryClient.removeQueries({ queryKey: queryKeys.myResponses });
      queryClient.setQueryData(queryKeys.me, user);
      return queryClient.invalidateQueries({ predicate: (query) => query.queryHash !== JSON.stringify(queryKeys.me) });
    },
  });
}

/** Saves profile changes; the nav and dashboard show the new details at once */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Schemas['ProfileUpdate']) => api.updateProfile(body),
    onSuccess: (user) => queryClient.setQueryData(queryKeys.me, user),
  });
}

/** Changes the password, which ends every session (decision 0010), then signs this browser
    back in with the new one for the browser session only (decision 0024, D46). If that
    sign-in fails, the page shows that the session has ended. */
export function useChangePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, ...body }: Schemas['PasswordChange'] & { email: string }) => {
      await api.changePassword(body);
      try {
        await api.signIn({ email, password: body.newPassword, remember: false });
      } catch {
        queryClient.setQueryData(queryKeys.me, null);
      }
    },
  });
}

/** Deletes the account, then forgets everything cached about it, as signing out does.
    `onDeleted` runs first, so the page can say what happened before it loses the user. */
export function useDeleteAccount(onDeleted: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Schemas['AccountDelete']) => api.deleteAccount(body),
    onSuccess: () => {
      onDeleted();
      // `me` is kept and set, so the nav (which holds that query) shows "Sign in" at once
      queryClient.setQueryData<Schemas['UserOut'] | null>(queryKeys.me, null);
      queryClient.removeQueries({ predicate: (query) => query.queryHash !== JSON.stringify(queryKeys.me) });
    },
  });
}

export function useStats() {
  return useQuery(statsQuery());
}

export function usePolls() {
  return useQuery(pollsQuery());
}

/** One poll with its questions, and whether the signed-in user has answered it */
export function usePoll(id: number | null) {
  return useQuery({ ...pollQuery(id ?? 0), enabled: id !== null });
}

/** Submits a response, then refreshes what it changes, as poll.html's thank-you screen does
    (FRONTEND_MIGRATION.md §8) */
export function useSubmitResponse(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Schemas['ResponseCreate']) => api.submitResponse(body),
    onSuccess: () =>
      Promise.all(
        [queryKeys.poll(id), queryKeys.results(id), ['polls'], queryKeys.stats, queryKeys.myResponses].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  });
}

/** One poll's published figures */
export function useResults(id: number | null) {
  return useQuery({ ...resultsQuery(id ?? 0), enabled: id !== null });
}

export function useReference() {
  return useQuery(referenceQuery());
}

/** The admin Overview's figures; only asked for once /auth/me says the user is an admin */
export function useAdminOverview(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.adminOverview,
    queryFn: ({ signal }) => api.adminOverview(signal),
    enabled,
    retry: false,
  });
}

/** Every poll, drafts included, for the admin pages */
export function useAdminPolls(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.adminPolls,
    queryFn: ({ signal }) => api.polls({ signal }),
    enabled,
    retry: false,
  });
}

/** After a poll changes: everything that shows it, as admin.html's refreshData() and more,
    since the public pages share this cache */
function refreshPolls(queryClient: ReturnType<typeof useQueryClient>, id?: number) {
  const keys: readonly (readonly unknown[])[] = [['admin'], ['polls'], queryKeys.stats, ...(id ? [queryKeys.poll(id), queryKeys.results(id)] : [])];
  return Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

/** Creates a poll (no id) or changes one: a full edit, or just its status */
export function useSavePoll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: number; body: Schemas['PollCreate'] | Schemas['PollUpdate'] }) =>
      id ? api.updatePoll(id, body) : api.createPoll(body as Schemas['PollCreate']),
    onSuccess: (poll) => refreshPolls(queryClient, poll.id),
  });
}

export function useDeletePoll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deletePoll(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.poll(id) });
      queryClient.removeQueries({ queryKey: queryKeys.results(id) });
      return refreshPolls(queryClient);
    },
  });
}

/** One page of the admin users list. The last page stays on screen while the next one loads. */
export function useAdminUsers(query: AdminUsersQuery) {
  return useQuery({
    queryKey: queryKeys.adminUsers(query),
    queryFn: ({ signal }) => api.adminUsers(query, signal),
    placeholderData: keepPreviousData,
    retry: false,
  });
}

/** Suspends, reactivates, promotes or demotes a user. The row changes in place, as in
    admin.html, so a user doesn't vanish from a filtered page; the Overview's figures refresh. */
export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: Schemas['AdminUserUpdate'] }) => api.adminUpdateUser(id, body),
    onSuccess: (user) => {
      queryClient.setQueriesData<Schemas['AdminUserPage']>({ queryKey: ['admin', 'users'] }, (page) =>
        page && { ...page, items: page.items.map((u) => (u.id === user.id ? user : u)) },
      );
      return queryClient.invalidateQueries({ queryKey: queryKeys.adminOverview });
    },
  });
}
