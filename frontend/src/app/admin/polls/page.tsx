import { Suspense } from 'react';

import { PollsList } from '@/features/admin/PollsList';

export default function AdminPollsPage() {
  return (
    <Suspense>
      <PollsList />
    </Suspense>
  );
}
