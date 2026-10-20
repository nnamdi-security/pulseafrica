'use client';

/* The shared form behaviour of login.html and dashboard.html (decision 0025, D42), in plain
   React state:
   - a field is checked when it loses focus (on change for selects and tick boxes); once it
     shows an error, it is checked again as the user types. A field left without being typed
     in isn't flagged on blur: focus that a view link put there would otherwise raise an
     error, shift the page, and make the next click miss its link;
   - submitting checks every field, shows a summary above the form and focuses the first
     invalid field;
   - the API stays the authority: its 422 field errors land on the same fields, and its other
     errors in the summary.
   The rules only help people fill the form in; they never decide anything the API decides. */
import { useEffect, useState, type ReactNode, type RefObject } from 'react';

import { ApiError } from '@/lib/api/client';

export type Values = Record<string, string | boolean>;
/** An error to show under the field, or '' when the value is fine */
export type Rule<V extends Values> = (values: V) => ReactNode;
export type Rules<V extends Values> = { [K in keyof V]?: Rule<V> };

/** The banner above the form. `fromServer` marks one that explains a failed request, which
    stays put while fields change; a summary of field errors follows the fields instead. */
export type FormAlert = { text: string; fromServer: boolean };

export function errorSummary(count: number) {
  return count === 1 ? 'Please fix the highlighted field below.' : `Please fix the ${count} highlighted fields below.`;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Errors for every field with a rule, keeping only the failing ones */
export function validateAll<V extends Values>(rules: Rules<V>, values: V) {
  const errors: Partial<Record<keyof V, ReactNode>> = {};
  for (const name of Object.keys(rules) as (keyof V)[]) {
    const error = rules[name]?.(values);
    if (error) errors[name] = error;
  }
  return errors;
}

/** The API's field errors (camelCase names) that belong to this form's fields */
export function apiFieldErrors<V extends Values>(err: ApiError, values: V) {
  const errors: Partial<Record<keyof V, ReactNode>> = {};
  for (const [name, message] of Object.entries(err.fields)) {
    if (name in values) errors[name as keyof V] = message;
  }
  return errors;
}

function count(errors: object) {
  return Object.values(errors).filter(Boolean).length;
}

type Options<V extends Values> = {
  /** The <form>, to move focus to its first invalid field */
  formRef: RefObject<HTMLFormElement | null>;
  /** Fields checked again when another changes, if they hold a value (confirm ← password) */
  dependents?: { [K in keyof V]?: (keyof V)[] };
};

export function useForm<V extends Values>(initial: V, rules: Rules<V>, { formRef, dependents = {} }: Options<V>) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof V, ReactNode>>>({});
  // Fields checked at least once: they show as valid or invalid from then on
  const [checked, setChecked] = useState<Partial<Record<keyof V, boolean>>>({});
  const [typed, setTyped] = useState<Partial<Record<keyof V, boolean>>>({});
  const [alert, setAlert] = useState<FormAlert | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);

  // Focus moves once the errors are on screen
  useEffect(() => {
    if (!focusRequest) return;
    const form = formRef.current;
    const target = form?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? form?.querySelector<HTMLElement>('input');
    target?.focus();
  }, [focusRequest, formRef]);

  /** Applies new field errors and keeps a summary banner in step with them */
  function show(next: Partial<Record<keyof V, ReactNode>>, names: (keyof V)[]) {
    setChecked((c) => ({ ...c, ...Object.fromEntries(names.map((n) => [n, true])) }));
    setErrors(next);
    setAlert((a) => (a && !a.fromServer ? (count(next) ? { text: errorSummary(count(next)), fromServer: false } : null) : a));
  }

  function recheck(nextValues: V, names: (keyof V)[], base = errors) {
    const next = { ...base };
    for (const name of names) {
      const error = rules[name]?.(nextValues);
      if (error) next[name] = error;
      else delete next[name];
    }
    show(next, names);
  }

  return {
    values,
    errors,
    alert,
    setAlert,
    /** How the field looks: 'error', 'valid' once checked and filled, or neither */
    status(name: keyof V): 'error' | 'valid' | undefined {
      if (errors[name]) return 'error';
      const value = values[name];
      return checked[name] && typeof value === 'string' && value !== '' ? 'valid' : undefined;
    },
    /** A typed change; `now` checks the field at once (selects and tick boxes) */
    set<K extends keyof V>(name: K, value: V[K], now = false) {
      const next = { ...values, [name]: value };
      setValues(next);
      setTyped((t) => (t[name] ? t : { ...t, [name]: true }));
      const names = [
        ...(now || errors[name] ? [name] : []),
        ...(dependents[name] ?? []).filter((d) => next[d] !== '' && next[d] !== false),
      ];
      if (names.length) recheck(next, names);
    },
    blur(name: keyof V) {
      if (typed[name] || checked[name]) recheck(values, [name]);
    },
    /** Checks every field; false (with the summary shown and focus moved) if any fails */
    validate() {
      const next = validateAll(rules, values);
      show(next, Object.keys(rules) as (keyof V)[]);
      if (!count(next)) {
        setAlert(null);
        return true;
      }
      setAlert({ text: errorSummary(count(next)), fromServer: false });
      setFocusRequest((n) => n + 1);
      return false;
    },
    /** A failed request: field errors on their fields, otherwise the API's message */
    fail(err: ApiError) {
      const fields = apiFieldErrors(err, values);
      const n = count(fields);
      show({ ...errors, ...fields }, Object.keys(fields) as (keyof V)[]);
      setAlert(n ? { text: errorSummary(n), fromServer: false } : { text: err.message, fromServer: true });
      setFocusRequest((r) => r + 1);
    },
    /** Checks these fields again after the rules learned something (an email the API says is
        taken), then summarises and moves focus as a failed submit does */
    recheck(...names: (keyof V)[]) {
      const next = { ...errors };
      for (const name of names) {
        const error = rules[name]?.(values);
        if (error) next[name] = error;
        else delete next[name];
      }
      show(next, names);
      setAlert(count(next) ? { text: errorSummary(count(next)), fromServer: false } : null);
      setFocusRequest((r) => r + 1);
    },
    /** Sets values without checking them, e.g. clearing a wrong password */
    setValues(patch: Partial<V>) {
      setValues((v) => ({ ...v, ...patch }));
    },
    reset() {
      setValues(initial);
      setErrors({});
      setChecked({});
      setTyped({});
      setAlert(null);
    },
  };
}
