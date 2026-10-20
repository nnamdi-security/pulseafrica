'use client';

/* The form controls of login.html and dashboard.html (style.css .auth-*): labelled fields with
   an icon, a show/hide button for passwords, selects, a tick box, the error banner and the
   submit button. Errors are tied to their inputs with aria-describedby and aria-invalid. */
import { IconAlertCircle, IconArrowRight, IconCheck, IconEye, IconEyeOff, type Icon } from '@tabler/icons-react';
import { useState, type ReactNode, type Ref } from 'react';

import { cn } from '@/lib/utils';

export const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold';
export const LABEL = 'font-mono text-[10px] uppercase tracking-[0.12em] text-muted';

type Status = 'error' | 'valid' | undefined;

const CONTROL =
  'w-full rounded-md border bg-cream text-[14px] leading-normal text-ink outline-none transition-[border-color,box-shadow,background-color] focus:bg-white focus:ring-3 mobile:text-[16px]';

function controlState(status: Status) {
  if (status === 'error') return 'border-red bg-red/3 focus:ring-red/12';
  return cn('focus:border-gold focus:ring-gold/15', status === 'valid' ? 'border-green/55' : 'border-navy/15');
}

/** The message under a field; always rendered, so aria-describedby always points somewhere */
export function FieldError({ id, error }: { id: string; error: ReactNode }) {
  return (
    <p id={id} className={cn('items-start gap-[5px] text-[12px] text-red [&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-2', error ? 'flex' : 'hidden')}>
      {error ? (
        <>
          <IconAlertCircle aria-hidden="true" size={14} className="mt-px shrink-0" />
          <span>{error}</span>
        </>
      ) : null}
    </p>
  );
}

type TextFieldProps = {
  id: string;
  label: string;
  Icon: Icon;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  status: Status;
  error: ReactNode;
  type?: 'text' | 'email' | 'password';
  autoComplete: string;
  placeholder?: string;
  hint?: string;
  /** Beside the label, e.g. "Forgot password?" */
  labelAside?: ReactNode;
  /** Shown under the input, before the error (password rules) */
  after?: ReactNode;
  /** Ids of elements in `after` that describe the input */
  describedBy?: string;
  /** A show/hide button for a password */
  reveal?: boolean;
  inputRef?: Ref<HTMLInputElement>;
};

export function TextField({
  id,
  label,
  Icon,
  value,
  onChange,
  onBlur,
  status,
  error,
  type = 'text',
  autoComplete,
  placeholder,
  hint,
  labelAside,
  after,
  describedBy,
  reveal,
  inputRef,
}: TextFieldProps) {
  const [shown, setShown] = useState(false);
  const errorId = `${id}-error`;
  const hintId = hint ? `${id}-hint` : undefined;
  const labelEl = (
    <label htmlFor={id} className={LABEL}>
      {label}
    </label>
  );
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {labelAside ? (
        <div className="flex items-baseline justify-between">
          {labelEl}
          {labelAside}
        </div>
      ) : (
        labelEl
      )}
      <div className="group relative">
        <Icon
          aria-hidden="true"
          size={16}
          className={cn(
            'pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 transition-colors',
            status === 'error' ? 'text-red' : status === 'valid' ? 'text-green' : 'text-faint group-focus-within:text-gold',
          )}
        />
        <input
          ref={inputRef}
          id={id}
          name={id}
          type={reveal && shown ? 'text' : type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={status === 'error'}
          aria-describedby={[hintId, describedBy, errorId].filter(Boolean).join(' ')}
          className={cn(CONTROL, controlState(status), 'py-[11px] pr-10 pl-[38px] placeholder:text-faint')}
        />
        {reveal ? (
          <button
            type="button"
            aria-label={shown ? 'Hide password' : 'Show password'}
            aria-controls={id}
            onClick={() => setShown((s) => !s)}
            className={cn(
              'absolute top-1/2 right-1.5 -translate-y-1/2 rounded-sm px-1.5 py-[5px] text-faint hover:text-navy group-focus-within:text-gold',
              FOCUS_RING,
            )}
          >
            {shown ? <IconEyeOff aria-hidden="true" size={17} /> : <IconEye aria-hidden="true" size={17} />}
          </button>
        ) : null}
      </div>
      {hint && status !== 'error' ? (
        <p id={hintId} className="text-[12px] text-muted">
          {hint}
        </p>
      ) : hint ? (
        <span id={hintId} hidden>
          {hint}
        </span>
      ) : null}
      {after}
      <FieldError id={errorId} error={error} />
    </div>
  );
}

export function SelectField({
  id,
  label,
  placeholder,
  options,
  value,
  onChange,
  status,
  error,
}: {
  id: string;
  label: string;
  placeholder: string;
  /** undefined while loading, null if the lists couldn't load */
  options: string[] | null | undefined;
  value: string;
  onChange: (value: string) => void;
  status: Status;
  error: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <div className="relative after:pointer-events-none after:absolute after:top-1/2 after:right-3 after:-translate-y-1/4 after:border-4 after:border-t-[5px] after:border-transparent after:border-t-muted after:content-['']">
        <select
          id={id}
          name={id}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={status === 'error'}
          aria-describedby={`${id}-error`}
          className={cn(CONTROL, controlState(status), 'cursor-pointer appearance-none py-[11px] pr-8 pl-3 text-ellipsis')}
        >
          <option value="">{options === null ? 'Couldn’t load the list. Refresh to try again.' : placeholder}</option>
          {options?.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </div>
      <FieldError id={`${id}-error`} error={error} />
    </div>
  );
}

/** A real checkbox under a drawn box (style.css .auth-check), so clicks, Space and labels all work */
export function CheckField({
  id,
  checked,
  onChange,
  children,
  status,
  error,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  status?: Status;
  error?: ReactNode;
}) {
  const errorId = error === undefined ? undefined : `${id}-error`;
  const box = (
    <label className="group relative flex cursor-pointer items-start gap-2.5">
      <input
        id={id}
        name={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-invalid={errorId ? status === 'error' : undefined}
        aria-describedby={errorId}
        className="absolute m-0 size-[18px] opacity-0"
      />
      <span
        aria-hidden="true"
        className={cn(
          'mt-px flex size-[18px] shrink-0 items-center justify-center rounded-sm border bg-cream transition-colors',
          'group-has-[input:checked]:border-green group-has-[input:checked]:bg-green',
          'group-has-[input:focus-visible]:outline-2 group-has-[input:focus-visible]:outline-offset-2 group-has-[input:focus-visible]:outline-gold',
          status === 'error' ? 'border-red' : 'border-navy/25',
        )}
      >
        <IconCheck size={13} className="text-parchment opacity-0 group-has-[input:checked]:opacity-100" />
      </span>
      <span className="text-[13px] leading-normal text-slate">{children}</span>
    </label>
  );
  if (!errorId) return box;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {box}
      <FieldError id={errorId} error={error} />
    </div>
  );
}

/** The banner above a form: a summary of field errors, or why a request failed */
export function FormAlert({ text }: { text: string }) {
  return (
    <div role="alert" className="mb-[18px] flex items-start gap-2.5 rounded-[6px] border border-l-[3px] border-red/25 border-l-red bg-red/6 px-3.5 py-[11px]">
      <IconAlertCircle aria-hidden="true" size={16} className="mt-px shrink-0 text-red" />
      <p className="text-[13px] text-red-ink">{text}</p>
    </div>
  );
}

export const SUBMIT = cn(
  'mt-1 flex w-full items-center justify-center gap-2 rounded-md bg-navy px-5 py-[13px] text-[14px] font-medium tracking-[0.01em] text-parchment transition-colors hover:bg-navy/90 disabled:cursor-progress disabled:bg-navy/90',
  FOCUS_RING,
);

export function SubmitButton({ label, busy }: { label: string; busy: boolean }) {
  return (
    <button type="submit" className={SUBMIT} disabled={busy} aria-busy={busy}>
      <span>{label}</span>
      {busy ? (
        <span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-2 border-parchment/30 border-t-gold motion-reduce:animate-none" />
      ) : (
        <IconArrowRight aria-hidden="true" size={16} />
      )}
    </button>
  );
}
