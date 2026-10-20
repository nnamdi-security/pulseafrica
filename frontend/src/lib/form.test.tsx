import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';

import { ApiError } from '@/lib/api/client';

import { errorSummary, useForm } from './form';

function Demo({ onSubmit }: { onSubmit: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const form = useForm(
    { name: '', password: '', confirm: '' },
    {
      name: (v) => (v.name ? '' : 'Enter your name.'),
      password: (v) => (v.password.length >= 3 ? '' : 'Too short.'),
      confirm: (v) => (v.confirm === v.password ? '' : 'Passwords do not match.'),
    },
    { formRef, dependents: { password: ['confirm'] } },
  );
  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (form.validate()) onSubmit();
      }}
    >
      {form.alert ? <div role="alert">{form.alert.text}</div> : null}
      {(['name', 'password', 'confirm'] as const).map((f) => (
        <div key={f}>
          <input
            aria-label={f}
            value={form.values[f]}
            aria-invalid={form.status(f) === 'error'}
            data-status={form.status(f) ?? ''}
            onChange={(e) => form.set(f, e.target.value)}
            onBlur={() => form.blur(f)}
          />
          <span>{form.errors[f]}</span>
        </div>
      ))}
      <button type="button" onClick={() => form.fail(new ApiError(422, 'Some details need fixing.', { name: 'Taken by the API' }))}>
        fail
      </button>
      <button type="button" onClick={() => form.fail(new ApiError(0, 'We couldn’t reach the server.'))}>
        down
      </button>
      <button type="submit">go</button>
    </form>
  );
}

it('summarises errors in the plural', () => {
  expect(errorSummary(1)).toBe('Please fix the highlighted field below.');
  expect(errorSummary(3)).toBe('Please fix the 3 highlighted fields below.');
});

it('flags a field on blur only once something was typed in it', async () => {
  render(<Demo onSubmit={() => {}} />);
  const user = userEvent.setup();
  await user.click(screen.getByLabelText('name'));
  await user.tab();
  expect(screen.getByLabelText('name')).toHaveAttribute('aria-invalid', 'false');
  await user.type(screen.getByLabelText('password'), 'ab');
  await user.tab();
  expect(screen.getByLabelText('password')).toHaveAttribute('aria-invalid', 'true');
  // Checked again as the user types, once it shows an error
  await user.type(screen.getByLabelText('password'), 'c');
  expect(screen.getByLabelText('password')).toHaveAttribute('data-status', 'valid');
});

it('validates everything on submit, focuses the first error and keeps the summary in step', async () => {
  const onSubmit = vi.fn();
  render(<Demo onSubmit={onSubmit} />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('confirm'), 'x');
  await user.click(screen.getByRole('button', { name: 'go' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Please fix the 3 highlighted fields below.');
  expect(screen.getByLabelText('name')).toHaveFocus();
  await user.type(screen.getByLabelText('name'), 'Ngozi');
  expect(screen.getByRole('alert')).toHaveTextContent('Please fix the 2 highlighted fields below.');
  // The confirmation follows the password it depends on
  await user.type(screen.getByLabelText('password'), 'x');
  expect(screen.getByLabelText('confirm')).toHaveAttribute('aria-invalid', 'false');
  await user.type(screen.getByLabelText('password'), 'yz');
  expect(screen.getByLabelText('confirm')).toHaveAttribute('aria-invalid', 'true');
  expect(onSubmit).not.toHaveBeenCalled();
});

it('puts API field errors on their fields, and other failures in a banner that stays', async () => {
  render(<Demo onSubmit={() => {}} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'fail' }));
  expect(screen.getByText('Taken by the API')).toBeInTheDocument();
  expect(screen.getByLabelText('name')).toHaveFocus();
  expect(screen.getByRole('alert')).toHaveTextContent('Please fix the highlighted field below.');

  await user.click(screen.getByRole('button', { name: 'down' }));
  expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t reach the server.');
  await user.type(screen.getByLabelText('password'), 'abc');
  expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t reach the server.');
});
