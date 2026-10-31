import { Suspense } from 'react';

import { UsersList } from '@/features/admin/UsersList';

export default function AdminUsersPage() {
  return (
    <Suspense>
      <UsersList />
    </Suspense>
  );
}
