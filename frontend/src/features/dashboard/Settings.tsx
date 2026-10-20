'use client';

/* dashboard.html's Account settings: profile details, password and account deletion. The
   rules only help people fill the forms in; the API checks everything again, and decides
   whether the current password is right (403). */
import { IconKey, IconLock, IconMail, IconTrash, IconUser } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { CheckField, FormAlert, SelectField, SettingsButton, TextField } from '@/components/forms/Fields';
import { PasswordRules } from '@/features/auth/RegisterForm';
import { passwordChecks } from '@/features/auth/rules';
import { ApiError } from '@/lib/api/client';
import { queryKeys, useChangePassword, useDeleteAccount, useReference, useUpdateProfile } from '@/lib/api/queries';
import { useForm } from '@/lib/form';
import { cn } from '@/lib/utils';

import { CARD, CARD_LABEL, useDashboard } from './DashboardShell';

const SUB = 'mb-[18px] text-[12px] leading-normal text-muted';

/** A 401 means the session ended: asking for the history again lets the page say so, as it
    does for any refused request (DashboardShell) */
function useSessionCheck() {
  const queryClient = useQueryClient();
  return (err: ApiError) => {
    if (err.status !== 401) return false;
    void queryClient.invalidateQueries({ queryKey: queryKeys.myResponses });
    return true;
  };
}
const FORM = 'flex flex-col gap-4';

function ProfileForm() {
  const { user } = useDashboard();
  const reference = useReference();
  const update = useUpdateProfile();
  const ended = useSessionCheck();
  const [saved, setSaved] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const form = useForm(
    { fullName: user.fullName, state: user.state, ageRange: user.ageRange },
    {
      fullName: (v) => {
        const name = v.fullName.trim();
        if (!name) return 'Enter your full name.';
        return name.split(/\s+/).length < 2 ? 'Enter your first and last name.' : '';
      },
      state: (v) => (v.state ? '' : 'Select your state of residence.'),
      ageRange: (v) => (v.ageRange ? '' : 'Select your age range.'),
    },
    { formRef },
  );
  const { values } = form;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved('');
    if (update.isPending || !form.validate()) return;
    // Send only what changed
    const fullName = values.fullName.trim().replace(/\s+/g, ' ');
    const changes = {
      ...(fullName !== user.fullName && { fullName }),
      ...(values.state !== user.state && { state: values.state }),
      ...(values.ageRange !== user.ageRange && { ageRange: values.ageRange }),
    };
    if (!Object.keys(changes).length) {
      setSaved('Nothing to save — your details are already up to date.');
      return;
    }
    update.mutate(changes, {
      onSuccess: () => setSaved('Your profile has been updated.'),
      onError: (err) => {
        if (!(err instanceof ApiError)) throw err;
        if (!ended(err)) form.fail(err);
      },
    });
  }

  const listOf = (key: 'states' | 'ageRanges') => (reference.data ? reference.data[key] : reference.isError ? null : undefined);

  return (
    <section aria-labelledby="edit-heading" className={CARD}>
      <h2 id="edit-heading" className={CARD_LABEL}>
        Profile details
      </h2>
      <p className={SUB}>Your state and age range pre-fill each poll&apos;s demographics step.</p>
      {form.alert ? <FormAlert text={form.alert.text} /> : saved ? <FormAlert text={saved} success /> : null}
      <form ref={formRef} noValidate onSubmit={onSubmit} aria-label="Profile details" className={FORM}>
        <TextField
          id="set-name"
          label="Full name"
          Icon={IconUser}
          autoComplete="name"
          value={values.fullName}
          onChange={(v) => form.set('fullName', v)}
          onBlur={() => form.blur('fullName')}
          status={form.status('fullName')}
          error={form.errors.fullName}
        />
        <TextField
          id="set-email"
          label="Email address"
          Icon={IconMail}
          type="email"
          autoComplete="email"
          readOnly
          value={user.email}
          onChange={() => {}}
          onBlur={() => {}}
          status={undefined}
          error={null}
          hint="Your email can't be changed yet. It's never published."
        />
        <div className="grid grid-cols-2 gap-3.5 mobile:grid-cols-1">
          <SelectField
            id="set-state"
            label="State of residence"
            placeholder="Select your state…"
            options={listOf('states')}
            value={values.state}
            onChange={(v) => form.set('state', v, true)}
            status={form.status('state')}
            error={form.errors.state}
          />
          <SelectField
            id="set-age"
            label="Age range"
            placeholder="Select…"
            options={listOf('ageRanges')}
            value={values.ageRange}
            onChange={(v) => form.set('ageRange', v, true)}
            status={form.status('ageRange')}
            error={form.errors.ageRange}
          />
        </div>
        <SettingsButton label={update.isPending ? 'Saving…' : 'Save changes'} busy={update.isPending} />
      </form>
    </section>
  );
}

function PasswordForm() {
  const { user } = useDashboard();
  const change = useChangePassword();
  const ended = useSessionCheck();
  const [saved, setSaved] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const form = useForm(
    { currentPassword: '', newPassword: '', confirmPassword: '' },
    {
      currentPassword: (v) => (v.currentPassword ? '' : 'Enter your current password.'),
      newPassword: (v) => {
        if (!v.newPassword) return 'Choose a new password.';
        const c = passwordChecks(v.newPassword);
        if (!c.length || !c.letter || !c.number) return 'Use at least 8 characters, including a letter and a number.';
        return v.newPassword === v.currentPassword ? 'Choose a password different from your current one.' : '';
      },
      confirmPassword: (v) => {
        if (!v.confirmPassword) return 'Confirm your new password.';
        return v.confirmPassword !== v.newPassword ? 'Passwords do not match.' : '';
      },
    },
    { formRef, dependents: { newPassword: ['confirmPassword'] } },
  );
  const { values } = form;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    if (change.isPending || !form.validate()) return;
    change.mutate(
      { email: user.email, ...values },
      {
        onSuccess: () => {
          form.reset();
          setSaved(true);
        },
        onError: (err) => {
          if (!(err instanceof ApiError)) throw err;
          if (ended(err)) return;
          if (err.status === 403) {
            // The API decides; the field says so, empties and takes focus
            form.setValues({ currentPassword: '' });
            form.fail(new ApiError(422, '', { currentPassword: 'That isn’t your current password.' }));
            form.setAlert(null);
            return;
          }
          form.fail(err);
        },
      },
    );
  }

  return (
    <section aria-labelledby="password-heading" className={CARD}>
      <h2 id="password-heading" className={CARD_LABEL}>
        Change password
      </h2>
      <p className={SUB}>You&apos;ll stay signed in on this device.</p>
      {form.alert ? <FormAlert text={form.alert.text} /> : saved ? <FormAlert text="Your password has been changed." success /> : null}
      <form ref={formRef} noValidate onSubmit={onSubmit} aria-label="Change password" className={FORM}>
        <TextField
          id="pw-current"
          label="Current password"
          Icon={IconLock}
          type="password"
          autoComplete="current-password"
          reveal
          value={values.currentPassword}
          onChange={(v) => form.set('currentPassword', v)}
          onBlur={() => form.blur('currentPassword')}
          status={form.status('currentPassword')}
          error={form.errors.currentPassword}
        />
        <TextField
          id="pw-new"
          label="New password"
          Icon={IconKey}
          type="password"
          autoComplete="new-password"
          placeholder="8 to 72 characters"
          reveal
          value={values.newPassword}
          onChange={(v) => form.set('newPassword', v)}
          onBlur={() => form.blur('newPassword')}
          status={form.status('newPassword')}
          error={form.errors.newPassword}
          describedBy="pw-new-rules"
          after={<PasswordRules id="pw-new-rules" password={values.newPassword} />}
        />
        <TextField
          id="pw-confirm"
          label="Confirm new password"
          Icon={IconKey}
          type="password"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={(v) => form.set('confirmPassword', v)}
          onBlur={() => form.blur('confirmPassword')}
          status={form.status('confirmPassword')}
          error={form.errors.confirmPassword}
        />
        <SettingsButton label={change.isPending ? 'Changing…' : 'Change password'} busy={change.isPending} />
      </form>
    </section>
  );
}

function DeleteForm() {
  const { markDeleted } = useDashboard();
  const remove = useDeleteAccount(markDeleted);
  const ended = useSessionCheck();
  const formRef = useRef<HTMLFormElement>(null);
  const form = useForm(
    { password: '', confirm: false as boolean },
    {
      password: (v) => (v.password ? '' : 'Enter your password.'),
      confirm: (v) => (v.confirm ? '' : 'Tick the box to confirm.'),
    },
    { formRef },
  );
  const { values } = form;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (remove.isPending || !form.validate()) return;
    remove.mutate(
      { password: values.password },
      {
        onError: (err) => {
          if (!(err instanceof ApiError)) throw err;
          if (ended(err)) return;
          if (err.status === 403) {
            form.setValues({ password: '' });
            form.fail(new ApiError(422, '', { password: 'That password isn’t right.' }));
            form.setAlert(null);
            return;
          }
          form.fail(err);
        },
      },
    );
  }

  return (
    <section aria-labelledby="delete-heading" className={cn(CARD, 'border-red/30')}>
      <h2 id="delete-heading" className={cn(CARD_LABEL, 'text-red')}>
        Delete account
      </h2>
      <p className={SUB}>
        This permanently deletes your account and every response you&apos;ve given, and removes them from all results. It can&apos;t be undone.
      </p>
      {form.alert ? <FormAlert text={form.alert.text} /> : null}
      <form ref={formRef} noValidate onSubmit={onSubmit} aria-label="Delete account" className={cn(FORM, 'max-w-[440px]')}>
        <TextField
          id="del-password"
          label="Enter your password to confirm"
          Icon={IconLock}
          type="password"
          autoComplete="current-password"
          value={values.password}
          onChange={(v) => form.set('password', v)}
          onBlur={() => form.blur('password')}
          status={form.status('password')}
          error={form.errors.password}
        />
        <CheckField
          id="del-confirm"
          checked={values.confirm}
          onChange={(v) => form.set('confirm', v, true)}
          status={form.status('confirm')}
          error={form.errors.confirm ?? null}
        >
          I understand my account and responses will be deleted permanently.
        </CheckField>
        <SettingsButton label={remove.isPending ? 'Deleting…' : 'Delete my account'} busy={remove.isPending} Icon={IconTrash} danger />
      </form>
    </section>
  );
}

export function Settings() {
  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-5 tablet:grid-cols-1 [&>*]:mb-0">
        <ProfileForm />
        <PasswordForm />
      </div>
      <DeleteForm />
    </>
  );
}
