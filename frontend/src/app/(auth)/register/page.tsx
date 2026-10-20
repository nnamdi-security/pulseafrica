import type { Metadata } from 'next';

import { nextOf, type NextProps } from '@/features/auth/next';
import { RegisterForm } from '@/features/auth/RegisterForm';

export const metadata: Metadata = { title: 'Create Account — PulseAfrica' };

export default async function RegisterPage(props: NextProps) {
  return <RegisterForm next={await nextOf(props)} />;
}
