/* login.html's field rules and messages, word for word (decision 0025). They only help people
   fill the form in: the API checks every one of them again (schemas/user.py). */
import type { Schemas } from '@/lib/api/client';
import { EMAIL_RE } from '@/lib/form';

export function emailError(value: string) {
  if (!value.trim()) return 'Enter your email address.';
  if (!EMAIL_RE.test(value.trim())) return 'Enter a valid email address, e.g. name@example.com.';
  return '';
}

export function fullNameError(value: string) {
  const name = value.trim();
  if (!name) return 'Enter your full name.';
  if (name.split(/\s+/).length < 2) return 'Enter your first and last name.';
  if (!/^[\p{L}\s'.-]+$/u.test(name)) return 'Name can only contain letters, spaces, hyphens, and apostrophes.';
  return '';
}

export function passwordChecks(password: string) {
  return { length: password.length >= 8, letter: /[A-Za-z]/.test(password), number: /\d/.test(password) };
}

export function newPasswordError(value: string) {
  if (!value) return 'Create a password.';
  const c = passwordChecks(value);
  if (!c.length || !c.letter || !c.number) return 'Password must be at least 8 characters and include a letter and a number.';
  return '';
}

export function confirmError(value: string, password: string) {
  if (!value) return 'Confirm your password.';
  if (value !== password) return 'Passwords do not match.';
  return '';
}

export const STRENGTH = ['Strength', 'Weak', 'Fair', 'Good', 'Strong'] as const;

/** 0 (empty) to 4 (strong), as login.html's meter scores it */
export function strength(password: string) {
  if (!password) return 0;
  const c = passwordChecks(password);
  if (!(c.length && c.letter && c.number)) return 1;
  const long = password.length >= 12;
  const symbol = /[^A-Za-z0-9]/.test(password);
  if (!long && !symbol) return 2;
  return long && symbol && /[a-z]/.test(password) && /[A-Z]/.test(password) ? 4 : 3;
}

/** The success panel's line about live polls; generic if the list couldn't load */
export function livePollsText(polls: Schemas['PollSummary'][] | null) {
  if (!polls) return 'Live polls are waiting for your response.';
  const live = polls.filter((p) => p.status === 'active').length;
  if (live === 0) return 'There are no live polls right now — check back soon.';
  return live === 1 ? 'There is 1 live poll waiting for your response.' : `There are ${live} live polls waiting for your response.`;
}

export function firstNameOf(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? '';
}
