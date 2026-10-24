import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, CheckCircle2, ClipboardList, Flag, ShieldCheck, Truck, Users, Utensils, Hourglass, Timer } from 'lucide-react';
import api from '../../services/api.js';
import useFetch from '../../hooks/useFetch.js';
import useAction from '../../hooks/useAction.js';
import { Button, ConfirmDialog, EmptyState, ErrorState, Field, PageHeader, Pagination, SkeletonRows, StatCard, StatusBadge } from '../../components/common/ui.jsx';
import { fmtDateTime, qty } from '../../utils/format.js';

/** Generic server-paginated table with search/filter. `columns`: [{ h, cell(row) }]. */
function AdminTable({ title, subtitle, url, dataKey, columns, statuses, search, extraParams, reloadKey }) {
  const [page, setPage] = useState(1); const [q, setQ] = useState(''); const [status, setStatus] = useState('');
  const { data, meta, loading, error, reload } = useFetch(url, { params: { page, ...(search && q ? { q } : {}), ...(status ? { status } : {}), ...extraParams } });
  useEffect(() => { if (reloadKey) reload(); }, [reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="toolbar">{search && <input className="input" type="search" aria-label="Search" placeholder="Search…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />}
        {statuses && <select className="select" aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All</option>{statuses.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</select>}</div>
      {loading && !data ? <SkeletonRows /> : error ? <ErrorState message={error} onRetry={reload} /> : !data[dataKey].length ? <EmptyState icon={ClipboardList} title="Nothing to show" /> :
        <div className="table-wrap"><table className="table"><thead><tr>{columns.map((c) => <th key={c.h} scope="col">{c.h}</th>)}</tr></thead><tbody>{data[dataKey].map((r) => <tr key={r._id}>{columns.map((c) => <td key={c.h}>{c.cell(r, reload)}</td>)}</tr>)}</tbody></table></div>}
      <Pagination meta={meta} onPage={setPage} />
    </>
  );
}

export function AdminOverview() {
  const { data, loading, error, reload } = useFetch('/analytics/admin'); const logs = useFetch('/admin/audit-logs', { params: { limit: 8 } });
  if (loading && !data) return <SkeletonRows />; if (error) return <ErrorState message={error} onRetry={reload} />;
  const c = data.counts;
  return (
    <>
      <PageHeader title="Platform overview" subtitle="Live figures from the database." />
      <div className="grid-4">
        <StatCard icon={Users} label="Total users" value={c.users} /><StatCard icon={Utensils} label="Donors" value={c.donors} /><StatCard icon={ShieldCheck} label="Verified organizations" value={c.verifiedOrganizations} /><StatCard icon={Hourglass} label="Pending verifications" value={c.pendingVerifications} />
        <StatCard icon={ClipboardList} label="Active donations" value={c.activeDonations} /><StatCard icon={CheckCircle2} label="Completed donations" value={c.completedDonations} /><StatCard icon={Truck} label="Active pickups" value={c.activeAssignments} /><StatCard icon={AlertTriangle} label="Expired listings" value={c.expiredListings} />
        <StatCard icon={Flag} label="Open reports" value={c.openReports} /><StatCard icon={CheckCircle2} label="Completion rate" value={data.completionRate == null ? 'n/a' : `${data.completionRate}%`} /><StatCard icon={Timer} label="Avg. pickup minutes" value={data.avgPickupMinutes ?? 'n/a'} /><StatCard icon={Utensils} label="Food redistributed (kg)" value={data.totals.weightKg} />
      </div>
      <div className="grid-2" style={{ marginTop: 16, alignItems: 'start' }}>
        <div className="card"><h3>Completed handovers per month</h3>{data.monthly.length ? <div style={{ height: 240 }}><ResponsiveContainer><BarChart data={data.monthly}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="completed" fill="#15803d" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div> : <p className="muted">No completed handovers yet.</p>}</div>
        <div className="card"><div className="card-head"><h3>Recent activity</h3><Link to="/admin/audit-logs" className="small">Audit log</Link></div>{logs.loading ? <SkeletonRows n={3} /> : logs.data?.logs.length ? <ul className="stack small" style={{ listStyle: 'none', margin: 0, padding: 0 }}>{logs.data.logs.map((l) => <li key={l._id}><strong>{l.action}</strong> by {l.actor?.name || 'system'} · {fmtDateTime(l.createdAt)}</li>)}</ul> : <p className="muted">No administrative actions yet.</p>}</div>
      </div>
    </>
  );
}

function ReasonDialog({ open, title, message, confirmLabel, busy, onConfirm, onCancel, label = 'Reason (optional)' }) {
  const [v, setV] = useState(''); useEffect(() => { if (open) setV(''); }, [open]);
  return <ConfirmDialog open={open} danger title={title} message={message} confirmLabel={confirmLabel} busy={busy} onCancel={onCancel} onConfirm={() => onConfirm(v)}><Field label={label} id="rs"><input id="rs" className="input" maxLength={300} value={v} onChange={(e) => setV(e.target.value)} /></Field></ConfirmDialog>;
}

export function AdminUsers() {
  const [run, busy] = useAction(); const [target, setTarget] = useState(null); const [key, setKey] = useState(0);
  const toggle = (u) => (u.status === 'active' ? setTarget(u) : run(() => api.post(`/admin/users/${u._id}/reactivate`), { success: 'Account reactivated', onDone: () => setKey((k) => k + 1) }));
  return (
    <>
      <AdminTable title="Users" subtitle="Search, suspend and reactivate accounts." url="/admin/users" dataKey="users" search reloadKey={key} statuses={['active', 'suspended']}
        columns={[{ h: 'Name', cell: (u) => u.name }, { h: 'Email', cell: (u) => <>{u.email}{!u.emailVerified && <span className="badge amber" style={{ marginLeft: 6 }}>Unverified</span>}</> }, { h: 'Role', cell: (u) => u.role }, { h: 'Status', cell: (u) => <StatusBadge status={u.status} /> }, { h: 'Joined', cell: (u) => fmtDateTime(u.createdAt) },
          { h: '', cell: (u) => u.role === 'admin' ? <span className="muted small">Protected</span> : <button className="btn btn-secondary btn-sm" onClick={() => toggle(u)}>{u.status === 'active' ? 'Suspend' : 'Reactivate'}</button> }]} />
      <ReasonDialog open={!!target} busy={busy} title={`Suspend ${target?.name}?`} message="They will be signed out of every action immediately and notified." confirmLabel="Suspend account" onCancel={() => setTarget(null)}
        onConfirm={(reason) => run(() => api.post(`/admin/users/${target._id}/suspend`, { reason: reason || undefined }), { success: 'Account suspended', onDone: () => { setTarget(null); setKey((k) => k + 1); } })} />
    </>
  );
}

export function AdminOrganizations() {
  const [run, busy] = useAction(); const [t, setT] = useState(null); const [notes, setNotes] = useState(''); const [key, setKey] = useState(0);
  const decide = (decision) => run(() => api.post(`/admin/organizations/${t._id}/decision`, { decision, notes }), { success: `Organization ${decision}`, onDone: () => { setT(null); setNotes(''); setKey((k) => k + 1); } });
  return (
    <>
      <AdminTable title="Organization verification" subtitle="Review details before allowing organizations to request food." url="/admin/organizations" dataKey="organizations" reloadKey={key} statuses={['pending', 'verified', 'rejected']}
        columns={[{ h: 'Organization', cell: (o) => <><strong>{o.name}</strong><div className="small muted">{o.type} · reg. {o.registrationNumber || 'not provided'}</div></> }, { h: 'Contact', cell: (o) => <>{o.owner?.name}<div className="small muted">{o.owner?.email}{o.owner?.emailVerified ? '' : ' (unverified)'}</div></> }, { h: 'Address', cell: (o) => o.address || '-' }, { h: 'Status', cell: (o) => <StatusBadge status={o.verificationStatus} /> }, { h: '', cell: (o) => <button className="btn btn-secondary btn-sm" onClick={() => { setT(o); setNotes(o.verificationNotes || ''); }}>Review</button> }]} />
      <ConfirmDialog open={!!t} busy={busy} title={`Review ${t?.name}`} message={t?.description || 'No description provided.'} confirmLabel="Verify" onCancel={() => setT(null)} onConfirm={() => decide('verified')}>
        <Field label="Notes (shown to the organization)" id="vn"><textarea id="vn" className="textarea" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field><button className="btn btn-danger btn-sm" style={{ marginTop: 10 }} disabled={busy} onClick={() => decide('rejected')}>Reject instead</button></ConfirmDialog>
    </>
  );
}

export function AdminDonations() {
  const [run, busy] = useAction(); const [t, setT] = useState(null); const [mode, setMode] = useState('suspend'); const [key, setKey] = useState(0);
  const bump = () => { setT(null); setKey((k) => k + 1); };
  return (
    <>
      <AdminTable title="Donations" subtitle="Monitor listings and suspend anything that needs review." url="/admin/donations" dataKey="donations" search reloadKey={key} statuses={['draft', 'available', 'request_pending', 'reserved', 'ready_for_pickup', 'picked_up', 'delivered', 'completed', 'cancelled', 'expired', 'rejected']}
        columns={[{ h: 'Title', cell: (d) => <Link to={`/donations/${d._id}`}>{d.title}</Link> }, { h: 'Donor', cell: (d) => d.donor?.name }, { h: 'Quantity', cell: (d) => `${qty(d.quantityReserved, '')}/${qty(d.quantity, d.unit)}` }, { h: 'Deadline', cell: (d) => fmtDateTime(d.pickupDeadline) }, { h: 'Status', cell: (d) => <StatusBadge status={d.suspended ? 'suspended' : d.status} /> },
          { h: '', cell: (d) => <div className="row">{d.suspended ? <button className="btn btn-secondary btn-sm" onClick={() => run(() => api.post(`/admin/donations/${d._id}/unsuspend`), { success: 'Listing restored', onDone: bump })}>Restore</button> : !['completed', 'cancelled', 'expired', 'rejected'].includes(d.status) && <><button className="btn btn-secondary btn-sm" onClick={() => { setMode('suspend'); setT(d); }}>Suspend</button><button className="btn btn-ghost btn-sm" onClick={() => { setMode('reject'); setT(d); }}>Remove</button></>}</div> }]} />
      <ReasonDialog open={!!t} busy={busy} title={mode === 'suspend' ? 'Suspend this listing?' : 'Remove this listing?'} message={mode === 'suspend' ? 'It is hidden from browsing until restored.' : 'Open requests are cancelled and the donor is notified. This cannot be undone.'} confirmLabel={mode === 'suspend' ? 'Suspend' : 'Remove listing'} onCancel={() => setT(null)}
        onConfirm={(reason) => run(() => api.post(`/admin/donations/${t._id}/${mode === 'suspend' ? 'suspend' : 'reject'}`, { reason: reason || undefined }), { success: mode === 'suspend' ? 'Listing suspended' : 'Listing removed', onDone: bump })} />
    </>
  );
}

export const AdminRequests = () => <AdminTable title="Requests" url="/admin/requests" dataKey="requests" statuses={['pending', 'accepted', 'ready_for_pickup', 'picked_up', 'delivered', 'completed', 'rejected', 'cancelled', 'expired']}
  columns={[{ h: 'Donation', cell: (r) => r.donation?.title }, { h: 'Organization', cell: (r) => r.ngo?.name }, { h: 'Donor', cell: (r) => r.donor?.name }, { h: 'Quantity', cell: (r) => qty(r.quantity, r.donation?.unit) }, { h: 'Status', cell: (r) => <StatusBadge status={r.status} /> }, { h: 'Created', cell: (r) => fmtDateTime(r.createdAt) }]} />;
export const AdminPickups = () => <AdminTable title="Pickups" url="/admin/pickups" dataKey="pickups" statuses={['open', 'assigned', 'accepted', 'en_route', 'picked_up', 'delivered', 'completed', 'cancelled']}
  columns={[{ h: 'Donation', cell: (p) => p.donation?.title }, { h: 'Volunteer', cell: (p) => p.volunteer?.name || 'Unassigned' }, { h: 'Status', cell: (p) => <StatusBadge status={p.status} /> }, { h: 'Created', cell: (p) => fmtDateTime(p.createdAt) }]} />;
export const AdminAuditLogs = () => <AdminTable title="Audit logs" subtitle="Security-sensitive administrative actions." url="/admin/audit-logs" dataKey="logs"
  columns={[{ h: 'When', cell: (l) => fmtDateTime(l.createdAt) }, { h: 'Admin', cell: (l) => l.actor?.name || 'system' }, { h: 'Action', cell: (l) => <code>{l.action}</code> }, { h: 'Target', cell: (l) => `${l.targetType || ''} ${l.targetId || ''}` }, { h: 'IP', cell: (l) => l.ip || '-' }]} />;

export function AdminReports() {
  const [run, busy] = useAction(); const [t, setT] = useState(null); const [note, setNote] = useState(''); const [suspend, setSuspend] = useState(false); const [key, setKey] = useState(0);
  const resolve = (outcome) => run(() => api.post(`/admin/reports/${t._id}/resolve`, { outcome, note, suspendListing: suspend }), { success: 'Report updated', onDone: () => { setT(null); setNote(''); setSuspend(false); setKey((k) => k + 1); } });
  return (
    <>
      <AdminTable title="Reports and moderation" subtitle="Review reported listings." url="/admin/reports" dataKey="reports" reloadKey={key} statuses={['open', 'resolved', 'dismissed']}
        columns={[{ h: 'Listing', cell: (r) => r.donation ? <Link to={`/donations/${r.donation._id}`}>{r.donation.title}</Link> : 'Removed' }, { h: 'Reason', cell: (r) => <>{r.reason.replace(/_/g, ' ')}{r.details && <div className="small muted">{r.details}</div>}</> }, { h: 'Reporter', cell: (r) => r.reporter?.name }, { h: 'Status', cell: (r) => <StatusBadge status={r.status} /> }, { h: 'Reported', cell: (r) => fmtDateTime(r.createdAt) }, { h: '', cell: (r) => r.status === 'open' && <button className="btn btn-secondary btn-sm" onClick={() => setT(r)}>Review</button> }]} />
      <ConfirmDialog open={!!t} busy={busy} title="Resolve report" message={t ? `${t.reason.replace(/_/g, ' ')}${t.details ? `: ${t.details}` : ''}` : ''} confirmLabel="Mark resolved" onCancel={() => setT(null)} onConfirm={() => resolve('resolved')}>
        <Field label="Resolution note" id="rn"><textarea id="rn" className="textarea" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></Field><label className="check" style={{ marginTop: 10 }}><input type="checkbox" checked={suspend} onChange={(e) => setSuspend(e.target.checked)} /><span>Also suspend the listing</span></label><button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} disabled={busy} onClick={() => resolve('dismissed')}>Dismiss report</button></ConfirmDialog>
    </>
  );
}

export function AdminCategories() {
  const { data, loading, error, reload } = useFetch('/admin/categories'); const [run, busy] = useAction(); const blank = { slug: '', name: '', description: '', requiresPrepTime: false, active: true }; const [f, setF] = useState(blank); const [editing, setEditing] = useState(null); const [errs, setErrs] = useState({});
  const save = (e) => { e.preventDefault(); setErrs({}); run(async () => { try { await (editing ? api.put(`/admin/categories/${editing}`, f) : api.post('/admin/categories', f)); } catch (x) { setErrs(x.fieldErrors || {}); throw x; } }, { success: 'Category saved', onDone: () => { setF(blank); setEditing(null); reload(); } }); };
  return (
    <>
      <PageHeader title="Food categories" subtitle="Categories donors can choose. “Requires prep time” enforces preparation time and a short collection window." />
      <form className="card stack" onSubmit={save} noValidate style={{ marginBottom: 16 }}><div className="form-grid">
        <Field label="Slug" id="k-s" error={errs.slug} hint="lowercase letters, numbers and underscores"><input id="k-s" className="input" value={f.slug} disabled={!!editing} onChange={(e) => setF({ ...f, slug: e.target.value })} /></Field>
        <Field label="Name" id="k-n" error={errs.name}><input id="k-n" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Description" id="k-d" className="full"><input id="k-d" className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <label className="check"><input type="checkbox" checked={f.requiresPrepTime} onChange={(e) => setF({ ...f, requiresPrepTime: e.target.checked })} /><span>Requires prep time</span></label><label className="check"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /><span>Active</span></label></div>
        <div className="row"><Button loading={busy}>{editing ? 'Save category' : 'Add category'}</Button>{editing && <button type="button" className="btn btn-ghost" onClick={() => { setEditing(null); setF(blank); }}>Cancel</button>}</div></form>
      {loading && !data ? <SkeletonRows /> : error ? <ErrorState message={error} onRetry={reload} /> : <div className="table-wrap"><table className="table"><thead><tr><th scope="col">Name</th><th scope="col">Slug</th><th scope="col">Prep time</th><th scope="col">Status</th><th /></tr></thead><tbody>{data.categories.map((c) => <tr key={c._id}><td>{c.name}</td><td><code>{c.slug}</code></td><td>{c.requiresPrepTime ? 'Required' : '-'}</td><td><StatusBadge status={c.active ? 'active' : 'paused'} /></td><td><button className="btn btn-secondary btn-sm" onClick={() => { setEditing(c._id); setF({ slug: c.slug, name: c.name, description: c.description || '', requiresPrepTime: !!c.requiresPrepTime, active: c.active }); }}>Edit</button></td></tr>)}</tbody></table></div>}
    </>
  );
}

export function AdminSettings() {
  const { data, loading, error, reload } = useFetch('/admin/settings'); const [run, busy] = useAction(); const [f, setF] = useState(null);
  useEffect(() => { if (data) setF(data.settings); }, [data]);
  if (loading && !f) return <SkeletonRows />; if (error) return <ErrorState message={error} onRetry={reload} />; if (!f) return null;
  const num = (k) => (e) => setF({ ...f, [k]: Number(e.target.value) });
  const save = (e) => { e.preventDefault(); run(() => api.put('/admin/settings', f), { success: 'Settings saved', onDone: reload }); };
  return (
    <>
      <PageHeader title="Platform settings" subtitle="Eligibility and food-safety rules enforced by the server." />
      <form className="card stack" onSubmit={save} style={{ maxWidth: 640 }}><div className="form-grid">
        <Field label="Request expiry (hours)" id="s1"><input id="s1" className="input" type="number" min="1" max="168" value={f.requestExpiryHours} onChange={num('requestExpiryHours')} /></Field>
        <Field label="Max active pickups per volunteer" id="s2"><input id="s2" className="input" type="number" min="1" max="20" value={f.maxActiveAssignmentsPerVolunteer} onChange={num('maxActiveAssignmentsPerVolunteer')} /></Field>
        <Field label="Prepared food: max hours from preparation to deadline" id="s3"><input id="s3" className="input" type="number" min="0.5" step="0.5" value={f.cookedMealMaxHoursSincePrep} onChange={num('cookedMealMaxHoursSincePrep')} /></Field>
        <Field label="Minimum pickup window (minutes)" id="s4"><input id="s4" className="input" type="number" min="5" value={f.minPickupWindowMinutes} onChange={num('minPickupWindowMinutes')} /></Field>
        <Field label="Maximum pickup window (hours)" id="s5"><input id="s5" className="input" type="number" min="1" value={f.maxPickupWindowHours} onChange={num('maxPickupWindowHours')} /></Field>
        <label className="check full"><input type="checkbox" checked={f.requireVerifiedOrgDefault} onChange={(e) => setF({ ...f, requireVerifiedOrgDefault: e.target.checked })} /><span>New listings accept requests only from verified organizations by default</span></label></div><Button loading={busy}>Save settings</Button></form>
    </>
  );
}
