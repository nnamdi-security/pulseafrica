'use client';

/* login.html's sign-in view on the cookie session (decisions 0011 and 0024). */
import { IconKey, IconMail } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';

import { CheckField, FormAlert, SubmitButton, TextField } from '@/components/forms/Fields';
import { ApiError } from '@/lib/api/client';
import { pollsQuery } from '@/lib/api/options';
import { useSignIn } from '@/lib/api/queries';
import { useForm } from '@/lib/form';

import { SwitchLine, useArriveFocus, useAuthShell, ViewHead, ViewLink } from './AuthShell';
import { emailError, firstNameOf, livePollsText } from './rules';

export function SignInForm({ next }: { next: string | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const shell = useAuthShell();
  const signIn = useSignIn();
  const formRef = useRef<HTMLFormElement>(null);
  const form = useForm(
    { email: shell.email, password: '', remember: false as boolean },
    { email: (v) => emailError(v.email), password: (v) => (v.password ? '' : 'Enter your password.') },
    { formRef },
  );
  const { values } = form;
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  useArriveFocus({ first: emailRef, password: passwordRef });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (signIn.isPending || !form.validate()) return;
    signIn.mutate(
      { email: values.email.trim(), password: values.password, remember: values.remember },
      {
        onSuccess: async (user) => {
          if (next) {
            router.push(next);
            return;
          }
          const polls = await queryClient.fetchQuery(pollsQuery()).catch(() => null);
          shell.showSuccess({
            title: 'You’re signed in',
            text: `Welcome back, ${firstNameOf(user.fullName)}. ${livePollsText(polls)}`,
            meta: `Signed in as ${user.email}`,
          });
        },
        onError: (err) => {
          if (!(err instanceof ApiError)) throw err;
          if (err.status === 401) {
            // Don't say which of the two was wrong — the API doesn't reveal it either
            form.setAlert({ text: 'That email and password don’t match an account. Check them and try again.', fromServer: true });
            form.setValues({ password: '' });
            passwordRef.current?.focus();
            return;
          }
          form.fail(err);
        },
      },
    );
  }

  return (
    <>
      <ViewHead title="Welcome back" sub="Sign in to continue participating in live polls." />
      {form.alert ? <FormAlert text={form.alert.text} /> : null}
      <form ref={formRef} noValidate onSubmit={onSubmit} aria-label="Sign in" className="flex flex-col gap-4">
        <TextField
          id="login-email"
          label="Email address"
          Icon={IconMail}
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={values.email}
          onChange={(v) => form.set('email', v)}
          onBlur={() => form.blur('email')}
          status={form.status('email')}
          error={form.errors.email}
          inputRef={emailRef}
        />
        <TextField
          id="login-password"
          label="Password"
          Icon={IconKey}
          type="password"
          reveal
          autoComplete="current-password"
          placeholder="Your password"
          labelAside={
            <ViewLink href="/login/reset" className="text-[12px] font-medium text-green hover:text-gold-ink">
              Forgot password?
            </ViewLink>
          }
          value={values.password}
          onChange={(v) => form.set('password', v)}
          onBlur={() => form.blur('password')}
          status={form.status('password')}
          error={form.errors.password}
          inputRef={passwordRef}
        />
        <CheckField id="login-remember" checked={values.remember} onChange={(v) => form.set('remember', v)}>
          Keep me signed in on this device
        </CheckField>
        <SubmitButton label="Sign in" busy={signIn.isPending} />
      </form>
      <SwitchLine>
        New to PulseAfrica? <ViewLink href="/register">Create an account</ViewLink>
      </SwitchLine>
    </>
  );
}
