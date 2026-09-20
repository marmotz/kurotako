import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginForm, strictLoginSchema } from './LoginForm';

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe('LoginForm', () => {
  afterEach(cleanup);

  it('shows the generated schema issues on submit', async () => {
    render(<LoginForm onLogin={vi.fn()} />);
    fireEvent.click(screen.getByText('Log in'));
    await waitFor(() =>
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0),
    );
  });

  it('shows the runtime-refined rule, which the contract does not carry', async () => {
    const onLogin = vi.fn();
    render(<LoginForm onLogin={onLogin} />);
    fill('Email', 'ada@example.com');
    fill('Password', 'my-password-1');
    fireEvent.click(screen.getByText('Log in'));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'must not contain the word',
      ),
    );
    expect(onLogin).not.toHaveBeenCalled();
  });

  it('submits the values once valid, and shows a server failure on the field', async () => {
    const onLogin = vi.fn().mockRejectedValue(new Error('401'));
    render(<LoginForm onLogin={onLogin} />);
    fill('Email', 'ada@example.com');
    fill('Password', 'correct-horse');
    fireEvent.click(screen.getByText('Log in'));
    await waitFor(() =>
      expect(onLogin).toHaveBeenCalledWith({
        email: 'ada@example.com',
        password: 'correct-horse',
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'Unknown email or password',
      ),
    );
  });

  it('the refined schema still accepts what the contract accepts', () => {
    expect(
      strictLoginSchema.safeParse({ email: 'ada@example.com', password: 'correct-horse' })
        .success,
    ).toBe(true);
  });
});
