import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, ClipboardList, Inbox, PackagePlus, Plus, Repeat, Scale, Utensils } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api.js';
import useFetch from '../../hooks/useFetch.js';
import useAction from '../../hooks/useAction.js';
import { useAuth } from '../../context/AuthContext.jsx';
import DonationForm from '../../components/forms/DonationForm.jsx';
import { DonationRow } from '../../components/donations/DonationCard.jsx';
import LocationPicker from '../../components/maps/LocationPicker.jsx';
import { Button, ConfirmDialog, EmptyState, ErrorState, Field, PageHeader, PageLoader, Pagination, SkeletonRows, StatCard, StatusBadge } from '../../components/common/ui.jsx';
import { fmtDate, fmtDateTime, qty } from '../../utils/format.js';
import { ImpactCharts } from '../shared/SharedPages.jsx';

export function DonorDashboard() {
  const { user } = useAuth(); const a = useFetch('/analytics/me'); const reqs = useFetch('/donation-requests', { params: { status: 'pending', limit: 5 } }); const mine = useFetch('/donations/mine', { params: { limit: 5 } });
  const t = a.data?.totals;
  return (
    <>
      <PageHeader title={`Welcome, ${user.business?.name || user.name}`} subtitle="Together we rescue food and help our community."><Link className="btn btn-primary" to="/donor/donations/new"><PackagePlus size={16} />New donation</Link></PageHeader>
      <div className="grid-4"><StatCard icon={Utensils} label="Live donations" value={a.data?.active ?? '-'} /><StatCard icon={CheckCircle2} label="Completed handovers" value={t?.completed ?? '-'} /><StatCard icon={Scale} label="Weight redistributed (kg)" value={t?.weightKg ?? '-'} /><StatCard icon={Inbox} label="Pending requests" value={reqs.data ? reqs.meta?.total ?? reqs.data.requests.length : '-'} /></div>
      <div className="grid-2" style={{ marginTop: 16, alignItems: 'start' }}>
        <div className="card"><div className="card-head"><h3>Requests waiting for you</h3><Link to="/donor/requests" className="small">View all</Link></div>{reqs.loading ? <SkeletonRows n={2} /> : reqs.data?.requests.length ? <div className="stack">{reqs.data.requests.map((r) => <div className="row between" key={r._id}><div><strong>{r.donation?.title}</strong><div className="small muted">{r.organization?.name || r.ngo?.name} · {qty(r.quantity, r.donation?.unit)}</div></div><Link className="btn btn-secondary btn-sm" to="/donor/requests">Review</Link></div>)}</div> : <p className="muted">No pending requests.</p>}</div>
        <div className="card"><div className="card-head"><h3>Recent donations</h3><Link to="/donor/donations" className="small">View all</Link></div>{mine.loading ? <SkeletonRows n={2} /> : mine.data?.donations.length ? <div className="stack">{mine.data.donations.map((d) => <div className="row between" key={d._id}><Link to={`/donations/${d._id}`}>{d.title}</Link><StatusBadge status={d.status} /></div>)}</div> : <p className="muted">You haven’t posted anything yet.</p>}</div>
      </div>
    </>
  );
}

export const CreateDonation = () => <><PageHeader title="New donation" subtitle="Share surplus food with verified organizations." /><DonationForm /></>;
export function EditDonation() {
  const { id } = useParams(); const nav = useNavigate(); const { data, loading, error, reload } = useFetch(`/donations/${id}`);
  if (loading && !data) return <PageLoader />; if (error) return <ErrorState message={error} onRetry={reload} />;
  return <><PageHeader title="Edit donation" subtitle={data.donation.title} /><DonationForm donation={data.donation} onSaved={() => nav('/donor/donations')} /></>;
}

export function MyDonations() {
  const [status, setStatus] = useState(''); const [q, setQ] = useState(''); const [page, setPage] = useState(1); const [run, busy] = useAction(); const [confirm, setConfirm] = useState(null);
  const { data, meta, loading, error, reload } = useFetch('/donations/mine', { params: { status, q, page } });
  const publish = (d) => run(() => api.post(`/donations/${d._id}/publish`, { safetyDeclaration: true }), { success: 'Donation published', onDone: reload });
  const cancel = () => run(() => api.post(`/donations/${confirm._id}/cancel`), { success: 'Donation cancelled', onDone: () => { setConfirm(null); reload(); } });
  return (
    <>
      <PageHeader title="My donations" subtitle="Everything you have listed."><Link className="btn btn-primary" to="/donor/donations/new"><Plus size={16} />New donation</Link></PageHeader>
      <div className="toolbar"><input className="input" type="search" placeholder="Search by title" aria-label="Search donations" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select className="select" aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option>{['draft', 'available', 'request_pending', 'reserved', 'ready_for_pickup', 'picked_up', 'delivered', 'completed', 'cancelled', 'expired', 'rejected'].map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</select></div>
      {loading && !data ? <SkeletonRows /> : error ? <ErrorState message={error} onRetry={reload} /> : !data.donations.length ? <EmptyState icon={ClipboardList} title="No donations found" action={<Link className="btn btn-primary" to="/donor/donations/new">Create your first donation</Link>}>Post surplus food and organizations nearby will see it right away.</EmptyState> :
        <div className="stack">{data.donations.map((d) => <DonationRow key={d._id} d={d} actions={<>
          {d.status === 'draft' && <Button size="sm" loading={busy} onClick={() => publish(d)}>Publish</Button>}
          {['draft', 'available', 'request_pending'].includes(d.status) && <Link className="btn btn-secondary btn-sm" to={`/donor/donations/${d._id}/edit`}>Edit</Link>}
          {['draft', 'available', 'request_pending', 'reserved', 'ready_for_pickup'].includes(d.status) && <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(d)}>Cancel</button>}</>} />)}</div>}
      <Pagination meta={meta} onPage={setPage} />
      <ConfirmDialog open={!!confirm} danger busy={busy} title="Cancel this donation?" message="Organizations with pending or accepted requests will be notified." confirmLabel="Cancel donation" onConfirm={cancel} onCancel={() => setConfirm(null)} />
    </>
  );
}

export function DonorRequests() {
  const [tab, setTab] = useState('pending'); const [page, setPage] = useState(1); const [run, busy] = useAction(); const [rej, setRej] = useState(null); const [reason, setReason] = useState('');
  const statuses = { pending: 'pending', active: 'accepted,ready_for_pickup,picked_up,delivered', past: 'completed,rejected,cancelled,expired' };
  const { data, meta, loading, error, reload } = useFetch('/donation-requests', { params: { status: statuses[tab], page } });
  const act = (id, path, success, body) => run(() => api.patch(`/donation-requests/${id}/${path}`, body), { success, onDone: reload });
  return (
    <>
      <PageHeader title="Donation requests" subtitle="Accept or decline requests from organizations." />
      <div className="tabs" role="tablist">{Object.keys(statuses).map((k) => <button key={k} role="tab" className="tab" aria-selected={tab === k} onClick={() => { setTab(k); setPage(1); }}>{k === 'pending' ? 'Needs review' : k === 'active' ? 'In progress' : 'Past'}</button>)}</div>
      {loading && !data ? <SkeletonRows /> : error ? <ErrorState message={error} onRetry={reload} /> : !data.requests.length ? <EmptyState icon={Inbox} title="Nothing here">Requests will appear as organizations respond to your listings.</EmptyState> :
        <div className="stack">{data.requests.map((r) => (
          <div className="card" key={r._id}><div className="row between"><div><h3 style={{ margin: 0 }}><Link to={`/donations/${r.donation?._id}`}>{r.donation?.title}</Link></h3><div className="small muted">{r.organization?.name || r.ngo?.name}{r.organization?.verificationStatus === 'verified' ? ' · Verified' : ''} · wants {qty(r.quantity, r.donation?.unit)} of {qty(r.donation?.quantity, r.donation?.unit)} · {fmtDateTime(r.createdAt)}</div></div><StatusBadge status={r.status} /></div>
            {r.message && <p className="muted" style={{ marginTop: 10 }}>“{r.message}”</p>}{r.needsVolunteer && <span className="badge blue">Volunteer requested</span>}
            <div className="row" style={{ marginTop: 12 }}>
              {r.status === 'pending' && <><Button size="sm" loading={busy} onClick={() => act(r._id, 'accept', 'Request accepted')}>Accept</Button><button className="btn btn-secondary btn-sm" onClick={() => { setRej(r); setReason(''); }}>Decline</button></>}
              {r.status === 'accepted' && <Button size="sm" variant="secondary" loading={busy} onClick={() => act(r._id, 'ready', 'Marked ready for pickup')}>Mark ready for pickup</Button>}
              {['accepted', 'ready_for_pickup'].includes(r.status) && !r.needsVolunteer && <Button size="sm" loading={busy} onClick={() => act(r._id, 'handover', 'Handover confirmed')}>Confirm handed over</Button>}
              {['accepted', 'ready_for_pickup'].includes(r.status) && r.needsVolunteer && <Link className="btn btn-secondary btn-sm" to="/donor/pickups">Volunteer pickup</Link>}
            </div></div>))}</div>}
      <Pagination meta={meta} onPage={setPage} />
      <ConfirmDialog open={!!rej} busy={busy} title="Decline this request?" message="The organization is notified. You can add a short reason." confirmLabel="Decline request" onCancel={() => setRej(null)} onConfirm={() => act(rej._id, 'reject', 'Request declined', { reason: reason || undefined }).then(() => setRej(null))}>
        <Field label="Reason (optional)" id="rj"><input id="rj" className="input" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} /></Field></ConfirmDialog>
    </>
  );
}

export function DonorHistory() {
  const [page, setPage] = useState(1); const { data, meta, loading, error, reload } = useFetch('/donations/mine', { params: { page, limit: 12 } });
  const done = data?.donations.filter((d) => ['completed', 'cancelled', 'expired', 'rejected'].includes(d.status));
  return <><PageHeader title="Donation history" subtitle="Completed, cancelled and expired listings." />{loading && !data ? <SkeletonRows /> : error ? <ErrorState message={error} onRetry={reload} /> : !done.length ? <EmptyState title="No history yet">Finished listings will show up here.</EmptyState> : <div className="stack">{done.map((d) => <DonationRow key={d._id} d={d} />)}</div>}<Pagination meta={meta} onPage={setPage} /></>;
}

export const DonorAnalytics = () => <><PageHeader title="Impact analytics" subtitle="Only completed, confirmed handovers are counted." /><ImpactCharts /></>;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function Recurring() {
  const { data, loading, error, reload } = useFetch('/recurring-donations'); const [run, busy] = useAction(); const [open, setOpen] = useState(false); const [drafts, setDrafts] = useState(null);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const blank = { title: '', category: 'bakery', quantity: '', unit: 'kg', address: '', frequency: 'daily', daysOfWeek: [], startDate: new Date().toISOString().slice(0, 10), endDate: '', windowStart: '17:00', windowEnd: '19:00', timezone: tz };
  const [f, setF] = useState(blank); const [loc, setLoc] = useState(null); const [errs, setErrs] = useState({});
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggleDay = (d) => setF({ ...f, daysOfWeek: f.daysOfWeek.includes(d) ? f.daysOfWeek.filter((x) => x !== d) : [...f.daysOfWeek, d] });
  const save = (e) => { e.preventDefault(); setErrs({}); if (!loc) return setErrs({ lat: 'Pick the pickup point on the map' });
    run(async () => { try { await api.post('/recurring-donations', { ...f, quantity: Number(f.quantity), lat: loc.lat, lng: loc.lng, city: loc.city, endDate: f.endDate || undefined }); } catch (x) { setErrs(x.fieldErrors || {}); throw x; } }, { success: 'Schedule created', onDone: () => { setOpen(false); setF(blank); reload(); } }); };
  const act = (id, a, msg) => run(() => api.post(`/recurring-donations/${id}/${a}`), { success: msg, onDone: reload });
  const showDrafts = async (id) => { const r = await api.get(`/recurring-donations/${id}/generated`); setDrafts(r.data.data.donations); };
  const publish = (id) => run(() => api.post(`/donations/${id}/publish`, { safetyDeclaration: true }), { success: 'Published', onDone: () => { setDrafts((x) => x.filter((d) => d._id !== id)); } });
  return (
    <>
      <PageHeader title="Recurring donations" subtitle="Drafts are created for you each day. Nothing goes live until you confirm there is surplus."><button className="btn btn-primary" onClick={() => setOpen(!open)}><Repeat size={16} />{open ? 'Close' : 'New schedule'}</button></PageHeader>
      {open && <form className="card stack" onSubmit={save} noValidate style={{ marginBottom: 16 }}><div className="form-grid">
        <Field label="Title" id="rc-t" error={errs.title} className="full"><input id="rc-t" className="input" required value={f.title} onChange={set('title')} /></Field>
        <Field label="Quantity" id="rc-q" error={errs.quantity}><input id="rc-q" className="input" type="number" min="0" step="any" required value={f.quantity} onChange={set('quantity')} /></Field>
        <Field label="Unit" id="rc-u"><select id="rc-u" className="select" value={f.unit} onChange={set('unit')}>{['kg', 'g', 'lb', 'portions', 'items', 'litres', 'trays', 'boxes'].map((u) => <option key={u}>{u}</option>)}</select></Field>
        <Field label="Category" id="rc-c"><select id="rc-c" className="select" value={f.category} onChange={set('category')}>{[['fresh_produce', 'Fresh produce'], ['packaged', 'Packaged'], ['bakery', 'Bakery'], ['dairy', 'Dairy'], ['other', 'Other']].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></Field>
        <Field label="How often" id="rc-f"><select id="rc-f" className="select" value={f.frequency} onChange={set('frequency')}><option value="daily">Daily</option><option value="weekly">Selected days of the week</option></select></Field>
        {f.frequency === 'weekly' && <div className="full"><div className="label" style={{ fontWeight: 600, fontSize: '.88rem', marginBottom: 6 }}>Days</div><div className="day-picks">{DAYS.map((d, i) => <label key={d}><input type="checkbox" checked={f.daysOfWeek.includes(i)} onChange={() => toggleDay(i)} />{d}</label>)}</div>{errs.daysOfWeek && <span className="field-error">{errs.daysOfWeek}</span>}</div>}
        <Field label="Start date" id="rc-s" error={errs.startDate}><input id="rc-s" className="input" type="date" value={f.startDate} onChange={set('startDate')} /></Field>
        <Field label="End date (optional)" id="rc-e" error={errs.endDate}><input id="rc-e" className="input" type="date" value={f.endDate} onChange={set('endDate')} /></Field>
        <Field label="Pickup from" id="rc-ws"><input id="rc-ws" className="input" type="time" value={f.windowStart} onChange={set('windowStart')} /></Field>
        <Field label="Pickup until" id="rc-we" error={errs.windowEnd}><input id="rc-we" className="input" type="time" value={f.windowEnd} onChange={set('windowEnd')} /></Field>
        <Field label="Time zone" id="rc-tz" className="full" error={errs.timezone}><input id="rc-tz" className="input" value={f.timezone} onChange={set('timezone')} /></Field>
        <Field label="Pickup address" id="rc-a" error={errs.address} className="full"><input id="rc-a" className="input" required value={f.address} onChange={set('address')} /></Field>
        <div className="full"><LocationPicker value={loc} onChange={setLoc} error={errs.lat} /></div></div><Button loading={busy}>Create schedule</Button></form>}
      {loading && !data ? <SkeletonRows /> : error ? <ErrorState message={error} onRetry={reload} /> : !data.schedules.length ? <EmptyState icon={Repeat} title="No schedules yet">Create one for surplus you have regularly, like end-of-day bakery items.</EmptyState> :
        <div className="stack">{data.schedules.map((s) => <div className="card" key={s._id}><div className="row between"><div><h3 style={{ margin: 0 }}>{s.title}</h3><div className="small muted">{s.frequency === 'daily' ? 'Every day' : s.daysOfWeek.map((d) => DAYS[d]).join(', ')} · {s.windowStart}–{s.windowEnd} ({s.timezone}) · from {fmtDate(s.startDate)}{s.endDate ? ` to ${fmtDate(s.endDate)}` : ''}</div></div><StatusBadge status={s.status} /></div>
          <div className="row" style={{ marginTop: 12 }}><button className="btn btn-secondary btn-sm" onClick={() => showDrafts(s._id)}>Review drafts</button>{s.status === 'active' ? <button className="btn btn-ghost btn-sm" onClick={() => act(s._id, 'pause', 'Schedule paused')}>Pause</button> : <button className="btn btn-ghost btn-sm" onClick={() => act(s._id, 'resume', 'Schedule resumed')}>Resume</button>}<button className="btn btn-ghost btn-sm" onClick={() => act(s._id, 'cancel', 'Schedule cancelled')}>Cancel</button></div></div>)}</div>}
      {drafts && <div className="card" style={{ marginTop: 16 }}><div className="card-head"><h3>Generated drafts</h3><button className="btn btn-ghost btn-sm" onClick={() => setDrafts(null)}>Close</button></div>{drafts.length ? <div className="stack">{drafts.map((d) => <div className="row between" key={d._id}><span>{d.title} · {fmtDateTime(d.availableFrom)}</span><div className="row"><Link className="btn btn-secondary btn-sm" to={`/donor/donations/${d._id}/edit`}>Edit</Link><Button size="sm" loading={busy} onClick={() => publish(d._id)}>I have surplus, publish</Button></div></div>)}</div> : <p className="muted">No unconfirmed drafts.</p>}</div>}
    </>
  );
}
