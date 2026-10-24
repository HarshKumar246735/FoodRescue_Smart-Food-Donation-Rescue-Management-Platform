import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from '../components/layout/ProtectedRoute.jsx';

let mockAuth = { user: null, loading: false };
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => mockAuth }));

const tree = (roles) => (
  <MemoryRouter initialEntries={['/admin']}>
    <Routes>
      <Route element={<ProtectedRoute roles={roles} />}><Route path="/admin" element={<div>secret admin page</div>} /></Route>
      <Route path="/login" element={<div>login page</div>} /><Route path="/donor" element={<div>donor home</div>} />
    </Routes>
  </MemoryRouter>
);

describe('ProtectedRoute', () => {
  it('redirects anonymous users to login', () => { mockAuth = { user: null, loading: false }; render(tree(['admin'])); expect(screen.getByText('login page')).toBeInTheDocument(); });
  it('sends users with the wrong role to their own dashboard', () => { mockAuth = { user: { role: 'donor' }, loading: false }; render(tree(['admin'])); expect(screen.getByText('donor home')).toBeInTheDocument(); expect(screen.queryByText('secret admin page')).toBeNull(); });
  it('renders for the right role', () => { mockAuth = { user: { role: 'admin' }, loading: false }; render(tree(['admin'])); expect(screen.getByText('secret admin page')).toBeInTheDocument(); });
  it('shows a loader, not a blank page, while restoring the session', () => { mockAuth = { user: null, loading: true }; render(tree(['admin'])); expect(screen.getByRole('status')).toBeInTheDocument(); });
});
