import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { AdminShell } from '@/features/admin/AdminShell';

/* admin.html's frame for /admin and its polls and users (decision 0026, D50). Everything on it
   depends on the signed-in admin, and the session cookie only reaches /api, so it is all asked
   for in the browser (D51). */

export const metadata: Metadata = { title: 'Admin — PulseAfrica' };

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
