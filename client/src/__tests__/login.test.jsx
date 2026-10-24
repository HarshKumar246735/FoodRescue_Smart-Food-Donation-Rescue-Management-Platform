import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Login } from '../pages/auth/AuthPages.jsx';

const login = vi.fn();
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => ({ user: null, login }) }));
vi.mock('../services/api.js', () => ({ default: { post: vi.fn(), get: vi.fn() } }));

describe('Login page', () => {
  it('shows the server error message and re-enables the form', async () => {
    login.mockRejectedValueOnce(new Error('Incorrect email or password'));
    render(<MemoryRouter><Login /></MemoryRouter>);
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co'); await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password');
    await waitFor(() => expect(screen.getByRole('button', { name: /log in/i })).not.toBeDisabled());
  });
});
