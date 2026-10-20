import type { Metadata } from 'next';

import { nextOf, type NextProps } from '@/features/auth/next';
import { SignInForm } from '@/features/auth/SignInForm';

export const metadata: Metadata = { title: 'Sign In — PulseAfrica' };

export default async function LoginPage(props: NextProps) {
  return <SignInForm next={await nextOf(props)} />;
}
