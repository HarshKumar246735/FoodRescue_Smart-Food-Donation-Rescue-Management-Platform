import { useEffect, useRef } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, Loader2 } from 'lucide-react';
import { statusLabel } from '../../utils/format.js';

export const Spinner = ({ label = 'Loading' }) => <span className="spinner" role="status" aria-label={label} />;
export const PageLoader = () => <div className="page-loader"><Spinner label="Loading page" /></div>;
export const Skeleton = ({ h = 16, w = '100%', style }) => <div className="skeleton" style={{ height: h, width: w, ...style }} aria-hidden="true" />;
export const SkeletonCards = ({ n = 6 }) => (
  <div className="d-grid" aria-busy="true" aria-label="Loading">{Array.from({ length: n }, (_, i) => (
    <div className="d-card" key={i}><Skeleton h={160} style={{ borderRadius: 0 }} /><div className="d-body"><Skeleton h={18} w="70%" /><Skeleton h={12} /><Skeleton h={12} w="50%" /></div></div>))}</div>
);
export const SkeletonRows = ({ n = 4 }) => <div className="stack" aria-busy="true" aria-label="Loading">{Array.from({ length: n }, (_, i) => <Skeleton key={i} h={72} />)}</div>;

export function EmptyState({ icon: Icon = Inbox, title, children, action }) {
  return <div className="empty"><div className="ico"><Icon size={24} /></div><h3>{title}</h3>{children && <p className="muted">{children}</p>}{action}</div>;
}
export function ErrorState({ message, onRetry }) {
  return <div className="error-state" role="alert"><div className="ico"><AlertTriangle size={24} /></div><h3>We couldn’t load this</h3><p className="muted">{message}</p>{onRetry && <button className="btn btn-secondary" onClick={onRetry}>Try again</button>}</div>;
}

const TONES = { available: 'green', completed: 'green', delivered: 'green', accepted: 'green', verified: 'green', active: 'green', resolved: 'green', open: 'blue', request_pending: 'amber', pending: 'amber', reserved: 'blue', ready_for_pickup: 'blue', picked_up: 'blue', en_route: 'blue', assigned: 'amber', draft: '', paused: 'amber', cancelled: 'red', expired: 'red', rejected: 'red', suspended: 'red', dismissed: '' };
export const Badge = ({ children, tone }) => <span className={`badge ${tone || ''}`}>{children}</span>;
export const StatusBadge = ({ status }) => <Badge tone={TONES[status] ?? ''}>{statusLabel(status)}</Badge>;

export function StatCard({ icon: Icon, label, value, delta }) {
  return <div className="card stat"><div className="ico"><Icon size={22} /></div><div><div className="num">{value}</div><div className="lbl">{label}</div>{delta && <div className="delta">{delta}</div>}</div></div>;
}
export function PageHeader({ title, subtitle, children }) {
  return <div className="page-head"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div><div className="row">{children}</div></div>;
}
export function Pagination({ meta, onPage }) {
  if (!meta || meta.pages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <button className="btn btn-secondary btn-sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}><ChevronLeft size={16} /> Previous</button>
      <span className="small muted" aria-current="page">Page {meta.page} of {meta.pages}</span>
      <button className="btn btn-secondary btn-sm" disabled={meta.page >= meta.pages} onClick={() => onPage(meta.page + 1)}>Next <ChevronRight size={16} /></button>
    </nav>
  );
}
export function Field({ label, error, hint, children, id, className = '' }) {
  return <div className={`field ${className}`}><label htmlFor={id}>{label}</label>{children}{hint && !error && <span className="hint">{hint}</span>}{error && <span className="field-error" role="alert">{error}</span>}</div>;
}
export function Button({ loading, children, variant = 'primary', size, className = '', ...p }) {
  return <button className={`btn btn-${variant} ${size ? `btn-${size}` : ''} ${className}`} disabled={loading || p.disabled} {...p}>{loading && <Loader2 size={16} className="spinner-icon" />}{children}</button>;
}

/** Accessible modal: focus moves in, Escape closes, focus returns on close. */
export function Modal({ open, title, onClose, children, actions }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement; ref.current?.focus();
    const key = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-title" tabIndex={-1} ref={ref}>
        <h3 id="dlg-title">{title}</h3>{children}{actions && <div className="actions">{actions}</div>}
      </div>
    </div>
  );
}
export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger, busy, onConfirm, onCancel, children }) {
  return (
    <Modal open={open} title={title} onClose={onCancel} actions={<><button className="btn btn-secondary" onClick={onCancel}>Keep as is</button><button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={busy} onClick={onConfirm}>{confirmLabel}</button></>}>
      <p className="muted">{message}</p>{children}
    </Modal>
  );
}
