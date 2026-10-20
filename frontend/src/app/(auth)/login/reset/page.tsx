import type { Metadata } from 'next';

import { ResetNotice } from '@/features/auth/ResetNotice';

export const metadata: Metadata = { title: 'Reset Password — PulseAfrica' };

export default function ResetPage() {
  return <ResetNotice />;
}
