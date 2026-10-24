import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog, EmptyState, Field, Pagination, StatusBadge } from '../components/common/ui.jsx';

describe('common UI', () => {
  it('ConfirmDialog confirms, cancels and closes on Escape', async () => {
    const onConfirm = vi.fn(); const onCancel = vi.fn();
    render(<ConfirmDialog open title="Cancel donation?" message="Are you sure?" confirmLabel="Yes, cancel" onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByRole('dialog', { name: 'Cancel donation?' })).toBeInTheDocument();
    await userEvent.click(screen.getByText('Yes, cancel')); expect(onConfirm).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Escape}'); expect(onCancel).toHaveBeenCalled();
  });
  it('ConfirmDialog renders nothing when closed', () => { render(<ConfirmDialog open={false} title="x" message="y" />); expect(screen.queryByRole('dialog')).toBeNull(); });
  it('Field links label, shows hint or error', () => {
    const { rerender } = render(<Field label="Quantity" id="q" hint="Up to 5"><input id="q" /></Field>);
    expect(screen.getByLabelText('Quantity')).toBeInTheDocument(); expect(screen.getByText('Up to 5')).toBeInTheDocument();
    rerender(<Field label="Quantity" id="q" error="Required"><input id="q" /></Field>); expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });
  it('Pagination hides for a single page and pages correctly', async () => {
    const onPage = vi.fn(); const { rerender, container } = render(<Pagination meta={{ page: 1, pages: 1 }} onPage={onPage} />); expect(container).toBeEmptyDOMElement();
    rerender(<Pagination meta={{ page: 2, pages: 3 }} onPage={onPage} />); await userEvent.click(screen.getByText(/Next/)); expect(onPage).toHaveBeenCalledWith(3);
  });
  it('StatusBadge humanises status and EmptyState shows its message', () => {
    render(<><StatusBadge status="request_pending" /><EmptyState title="Nothing here">Try later</EmptyState></>);
    expect(screen.getByText('Request pending')).toBeInTheDocument(); expect(screen.getByText('Try later')).toBeInTheDocument();
  });
});
