import { notFound } from 'next/navigation';

import { EditPoll } from '@/features/admin/PollEditor';

export default async function EditPollPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <EditPoll id={Number(id)} />;
}
