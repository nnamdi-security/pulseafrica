import { poll } from '@/test/server';

import { confirmError, emailError, firstNameOf, fullNameError, livePollsText, newPasswordError, strength } from './rules';

it('checks emails as login.html does', () => {
  expect(emailError('')).toBe('Enter your email address.');
  expect(emailError('ngozi@example')).toBe('Enter a valid email address, e.g. name@example.com.');
  expect(emailError('  ngozi@example.com ')).toBe('');
});

it('asks for a first and last name in letters', () => {
  expect(fullNameError(' ')).toBe('Enter your full name.');
  expect(fullNameError('Ngozi')).toBe('Enter your first and last name.');
  expect(fullNameError('Ngozi 3ze')).toBe('Name can only contain letters, spaces, hyphens, and apostrophes.');
  expect(fullNameError("Adaeze O'Neil-Okafor")).toBe('');
  expect(fullNameError('Chloé Ìyá')).toBe('');
});

it('asks for 8 characters with a letter and a number', () => {
  expect(newPasswordError('')).toBe('Create a password.');
  for (const weak of ['secret1', 'secretpassword', '12345678']) {
    expect(newPasswordError(weak)).toBe('Password must be at least 8 characters and include a letter and a number.');
  }
  expect(newPasswordError('secret123')).toBe('');
});

it('matches the confirmation', () => {
  expect(confirmError('', 'secret123')).toBe('Confirm your password.');
  expect(confirmError('secret124', 'secret123')).toBe('Passwords do not match.');
  expect(confirmError('secret123', 'secret123')).toBe('');
});

it.each([
  ['', 0],
  ['abc', 1],
  ['secret123', 2],
  ['secret123456', 3],
  ['secret12!', 3],
  ['Secret123456!', 4],
  ['secret123456!', 3],
])('scores %j as %i', (password, score) => {
  expect(strength(password)).toBe(score);
});

it('counts the live polls for the success panel', () => {
  expect(livePollsText(null)).toBe('Live polls are waiting for your response.');
  expect(livePollsText([poll({ status: 'closed' })])).toBe('There are no live polls right now — check back soon.');
  expect(livePollsText([poll({ status: 'active' })])).toBe('There is 1 live poll waiting for your response.');
  expect(livePollsText([poll({ status: 'active' }), poll({ status: 'active' })])).toBe('There are 2 live polls waiting for your response.');
});

it('greets by first name', () => {
  expect(firstNameOf('  Ngozi Adaeze Eze ')).toBe('Ngozi');
});
