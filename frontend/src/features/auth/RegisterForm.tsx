'use client';

/* login.html's create-account view. A new account is signed straight in for this browser
   session only, as login.html does. */
import { IconCircle, IconCircleCheck, IconKey, IconMail, IconShieldLock, IconUser } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';

import { CheckField, FormAlert, SelectField, SubmitButton, TextField } from '@/components/forms/Fields';
import { ApiError } from '@/lib/api/client';
import { useReference, useSignIn } from '@/lib/api/queries';
import { useForm } from '@/lib/form';
import { cn } from '@/lib/utils';

import { SwitchLine, useArriveFocus, useAuthShell, ViewHead, ViewLink } from './AuthShell';
import { confirmError, emailError, firstNameOf, fullNameError, newPasswordError, passwordChecks, strength, STRENGTH } from './rules';

const RULES = [
  { key: 'length', label: '8+ characters' },
  { key: 'letter', label: 'A letter' },
  { key: 'number', label: 'A number' },
] as const;

const FILL = ['', 'bg-red', 'bg-gold', 'bg-green-soft', 'bg-green'];
const TONE = ['text-muted', 'text-red', 'text-gold-ink', 'text-green', 'text-green'];

function PasswordHelp({ password }: { password: string }) {
  const score = strength(password);
  return (
    <>
      <div aria-hidden="true" className="mt-0.5 flex items-center gap-2.5">
        <div className="h-1 flex-1 overflow-hidden rounded-[2px] bg-navy/8">
          <span className={cn('block h-full bg-faint transition-[width,background-color] duration-250', FILL[score])} style={{ width: `${score * 25}%` }} />
        </div>
        <span className={cn('min-w-14 text-right font-mono text-[10px] uppercase tracking-[0.1em]', TONE[score])}>{STRENGTH[score]}</span>
      </div>
      <PasswordRules id="reg-password-rules" password={password} />
    </>
  );
}

/** The ticks under a new password: 8+ characters, a letter, a number */
export function PasswordRules({ id, password }: { id: string; password: string }) {
  const checks = passwordChecks(password);
  return (
    <ul id={id} aria-label="Password requirements" className="flex flex-wrap gap-x-4 gap-y-1">
      {RULES.map((rule) => {
        const met = checks[rule.key];
        const Icon = met ? IconCircleCheck : IconCircle;
        return (
          <li key={rule.key} className={cn('flex items-center gap-[5px] text-[12px] transition-colors', met ? 'text-green' : 'text-muted')}>
            <Icon aria-hidden="true" size={14} /> {rule.label}
          </li>
        );
      })}
    </ul>
  );
}

export function RegisterForm({ next }: { next: string | null }) {
  const router = useRouter();
  const shell = useAuthShell();
  const signIn = useSignIn();
  const reference = useReference();
  // Emails the API said are registered, so "already exists" survives checking the field again
  const taken = useRef(new Set<string>());
  const formRef = useRef<HTMLFormElement>(null);
  const form = useForm(
    { fullName: '', email: '', state: '', ageRange: '', password: '', confirmPassword: '', terms: false as boolean },
    {
      fullName: (v) => fullNameError(v.fullName),
      email: (v) =>
        emailError(v.email) ||
        (taken.current.has(v.email.trim().toLowerCase()) ? (
          <>
            An account with this email already exists.{' '}
            {/* …carrying the email over to the sign-in form */}
            <ViewLink href="/login" focus="password" onClick={() => shell.setEmail(v.email.trim())}>
              Sign in instead
            </ViewLink>
            .
          </>
        ) : (
          ''
        )),
      state: (v) => (v.state ? '' : 'Select your state of residence.'),
      ageRange: (v) => (v.ageRange ? '' : 'Select your age range.'),
      password: (v) => newPasswordError(v.password),
      confirmPassword: (v) => confirmError(v.confirmPassword, v.password),
      terms: (v) => (v.terms ? '' : 'You must confirm you are 18+ and accept the terms to register.'),
    },
    { formRef, dependents: { password: ['confirmPassword'] } },
  );
  const { values } = form;
  const nameRef = useRef<HTMLInputElement>(null);
  useArriveFocus({ first: nameRef });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (signIn.isPending || !form.validate()) return;
    const email = values.email.trim();
    signIn.mutate(
      {
        email,
        password: values.password,
        remember: false,
        register: { ...values, fullName: values.fullName.trim(), email, terms: true },
      },
      {
        onSuccess: (user) => {
          if (next) {
            router.push(next);
            return;
          }
          shell.showSuccess({
            title: 'Account created',
            text: `Thank you, ${firstNameOf(user.fullName)}. You’re signed in and can respond to every live poll.`,
            meta: `Signed in as ${user.email}`,
          });
        },
        onError: (err) => {
          if (!(err instanceof ApiError)) throw err;
          if (err.status === 409) {
            taken.current.add(email.toLowerCase());
            form.recheck('email');
            return;
          }
          form.fail(err);
        },
      },
    );
  }

  const lists = reference.data;
  const listOf = (key: 'states' | 'ageRanges') => (lists ? lists[key] : reference.isError ? null : undefined);

  return (
    <>
      <ViewHead title="Create your account" sub="Takes under a minute. Adults 18+ resident in the United States of Africa." />
      {form.alert ? <FormAlert text={form.alert.text} /> : null}
      <form ref={formRef} noValidate onSubmit={onSubmit} aria-label="Create account" className="flex flex-col gap-4">
        <TextField
          id="reg-name"
          label="Full name"
          Icon={IconUser}
          autoComplete="name"
          placeholder="e.g. Adaeze Okafor"
          value={values.fullName}
          onChange={(v) => form.set('fullName', v)}
          onBlur={() => form.blur('fullName')}
          status={form.status('fullName')}
          error={form.errors.fullName}
          inputRef={nameRef}
        />
        <TextField
          id="reg-email"
          label="Email address"
          Icon={IconMail}
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          hint="Your email is never published."
          value={values.email}
          onChange={(v) => form.set('email', v)}
          onBlur={() => form.blur('email')}
          status={form.status('email')}
          error={form.errors.email}
        />
        <div className="grid grid-cols-2 gap-3.5 mobile:grid-cols-1">
          <SelectField
            id="reg-state"
            label="State of residence"
            placeholder="Select your state…"
            options={listOf('states')}
            value={values.state}
            onChange={(v) => form.set('state', v, true)}
            status={form.status('state')}
            error={form.errors.state}
          />
          <SelectField
            id="reg-age"
            label="Age range"
            placeholder="Select…"
            options={listOf('ageRanges')}
            value={values.ageRange}
            onChange={(v) => form.set('ageRange', v, true)}
            status={form.status('ageRange')}
            error={form.errors.ageRange}
          />
        </div>
        <TextField
          id="reg-password"
          label="Password"
          Icon={IconKey}
          type="password"
          reveal
          autoComplete="new-password"
          placeholder="8 to 72 characters"
          describedBy="reg-password-rules"
          after={<PasswordHelp password={values.password} />}
          value={values.password}
          onChange={(v) => form.set('password', v)}
          onBlur={() => form.blur('password')}
          status={form.status('password')}
          error={form.errors.password}
        />
        <TextField
          id="reg-confirm"
          label="Confirm password"
          Icon={IconKey}
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          value={values.confirmPassword}
          onChange={(v) => form.set('confirmPassword', v)}
          onBlur={() => form.blur('confirmPassword')}
          status={form.status('confirmPassword')}
          error={form.errors.confirmPassword}
        />
        <CheckField
          id="reg-terms"
          checked={values.terms}
          onChange={(v) => form.set('terms', v, true)}
          status={form.status('terms')}
          error={form.errors.terms ?? ''}
        >
          {/* No Terms or Privacy pages yet: plain text, not placeholder links (D40) */}I am 18 or older and agree to the Terms of Use and Privacy Policy.
        </CheckField>
        <SubmitButton label="Create account" busy={signIn.isPending} />
      </form>
      <div role="note" className="mt-5 flex items-start gap-2.5 rounded-[6px] border border-gold/20 bg-gold/6 px-3.5 py-3">
        <IconShieldLock aria-hidden="true" size={15} className="mt-px shrink-0 text-gold-ink" />
        <p className="text-[12px] leading-[1.65] text-muted">
          State and age range are never published individually; results only show them as totals for groups of at least 10 people. Results aren&apos;t
          weighted yet; weighting is planned.{' '}
          <Link href="/methodology" className="font-medium text-green hover:text-gold-ink">
            How weighting will work
          </Link>
        </p>
      </div>
      <SwitchLine>
        Already registered? <ViewLink href="/login">Sign in</ViewLink>
      </SwitchLine>
    </>
  );
}
