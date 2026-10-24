import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, BadgeCheck, ClipboardList, History, Search, Truck } from 'lucide-react';
import api from '../../services/api.js';
import useFetch from '../../hooks/useFetch.js';
import useAction from '../../hooks/useAction.js';
import { useAuth } from '../../context/AuthContext.jsx';
import BrowseDonations from '../../components/donations/BrowseDonations.jsx';
import LocationPicker from '../../components/maps/LocationPicker.jsx';
import MapView from '../../components/maps/MapView.jsx';
import { Button, ConfirmDialog, EmptyState, ErrorState, Field, PageHeader, PageLoader, Pagination, SkeletonRows, StatCard, StatusBadge } from '../../components/common/ui.jsx';
import { directionsUrl, fmtDateTime, qty } from '../../utils/format.js';
import { ImpactCharts, PickupStepper } from '../shared/SharedPages.jsx';
import { getSocket } from '../../services/socket.js';

export function NgoDashboard() {
  const { organization, user } = useAuth(); const a = useFetch('/analytics/me'); const reqs = useFetch('/donation-requests', { params: { limit: 5 } });
  const v = organization?.verificationStatus;
  return (
    <>
      <PageHeader title={`Welcome, ${organization?.name || user.name}`} subtitle="Find nearby food and coordinate pickups."><Link className="btn btn-primary" to="/ngo/browse"><Search size={16} />Find food</Link></PageHeader>
      {v !== 'verified' && <div className="banner" role="status"><span><AlertTriangle size={16} style={{ verticalAlign: -3 }} /> {v === 'rejected' ? 'Your verification was not approved. Update your organization details and contact support.' : 'Your organization is awaiting verification. Many donors only accept requests from verified organizations.'}</span><Link className="btn btn-sm btn-secondary" to="/ngo/organization">Complete profile</Link></div>}
      <div className="grid-4"><StatCard icon={BadgeCheck} label="Verification" value={v ? v[0].toUpperCase() + v.slice(1) : '-'} /><StatCard icon={ClipboardList} label="Open requests" value={a.data?.openRequests ?? '-'} /><StatCard icon={History} label="Completed handovers" value={a.data?.totals?.completed ?? '-'} /><StatCard icon={Truck} label="Weight received (kg)" value={a.data?.totals?.weightKg ?? '-'} /></div>
      <div className="card" style={{ marginTop: 16 }}><div className="card-head"><h3>Recent requests</h3><Link to="/ngo/requests" className="small">View all</Link></div>{reqs.loading ? <SkeletonRows n={2} /> : reqs.data?.requests.length ? <div className="stack">{reqs.data.requests.map((r) => <div className="row between" key={r._id}><Link to={`/ngo/requests/${r._id}`}>{r.donation?.title}</Link><StatusBadge status={r.status} /></div>)}</div> : <p className="muted">No requests yet. <Link to="/ngo/browse">Find food</Link> to get started.</p>}</div>
    </>
  );
}

export const NgoBrowse = () => <><PageHeader title="Find food" subtitle="Search by category, distance, quantity and deadline." /><BrowseDonations detailBase="/donations" /></>;

export function NgoRequests({ history = false }) {
  const [page, setPage] = useState(1); const [run, busy] = useAction(); const [cancel, setCancel] = useState(null);
  const status = history ? 'completed,cancelled,rejected,expired' : 'pending,accepted,ready_for_pickup,picked_up,delivered';
  const { data, meta, loading, error, reload } = useFetch('/donation-requests', { params: { status, page } });
  useEffect(() => { const s = getSocket(); s?.on('request:updated', reload); return () => s?.off('request:updated', reload); }, [reload]);
  const doCancel = () => run(() => api.patch(`/donation-requests/${cancel._id}/cancel`), { success: 'Request cancelled', onDone: () => { setCancel(null); reload(); } });
  return (
    <>
      <PageHeader title={history ? 'Donation history' : 'My requests'} subtitle={history ? 'Completed and closed requests.' : 'Track the status of every request.'} />
      {loading && !data ? <SkeletonRows /> : error ? <ErrorState message={error} onRetry={reload} /> : !data.requests.length ? <EmptyState icon={ClipboardList} title={history ? 'No history yet' : 'No active requests'} action={!history && <Link className="btn btn-primary" to="/ngo/browse">Find food</Link>}>{history ? 'Completed requests will appear here.' : 'Browse nearby donations and send a request.'}</EmptyState> :
        <div className="stack">{data.requests.map((r) => <div className="card" key={r._id}><div className="row between"><div><h3 style={{ margin: 0 }}><Link to={`/ngo/requests/${r._id}`}>{r.donation?.title}</Link></h3><div className="small muted">{qty(r.quantity, r.donation?.unit)} · requested {fmtDateTime(r.createdAt)} · deadline {fmtDateTime(r.donation?.pickupDeadline)}</div></div><StatusBadge status={r.status} /></div>
          {r.rejectionReason && <p className="small muted" style={{ marginTop: 8 }}>Reason: {r.rejectionReason}</p>}
          <div className="row" style={{ marginTop: 12 }}><Link className="btn btn-secondary btn-sm" to={`/ngo/requests/${r._id}`}>Details</Link>{['pending', 'accepted', 'ready_for_pickup'].includes(r.status) && <button className="btn btn-ghost btn-sm" onClick={() => setCancel(r)}>Cancel request</button>}
            {r.status === (r.needsVolunteer ? 'delivered' : 'picked_up') && <Button size="sm" loading={busy} onClick={() => run(() => api.patch(`/donation-requests/${r._id}/receipt`), { success: 'Receipt confirmed', onDone: reload })}>Confirm received</Button>}</div></div>)}</div>}
      <Pagination meta={meta} onPage={setPage} />
      <ConfirmDialog open={!!cancel} danger busy={busy} title="Cancel this request?" message="Any reserved quantity is released for other organizations." confirmLabel="Cancel request" onConfirm={doCancel} onCancel={() => setCancel(null)} />
    </>
  );
}

export function NgoRequestDetails() {
  const { id } = useParams(); const { data, loading, error, reload } = useFetch(`/donation-requests/${id}`); const [run, busy] = useAction();
  useEffect(() => { const s = getSocket(); s?.on('request:updated', reload); return () => s?.off('request:updated', reload); }, [reload]);
  if (loading && !data) return <PageLoader />; if (error) return <ErrorState message={error} onRetry={reload} />;
  const r = data.request; const d = r.donation; const precise = d.location && !String(d.address).includes('after');
  const a = r.assignment; const canReceive = r.status === (r.needsVolunteer ? 'delivered' : 'picked_up');
  return (
    <>
      <PageHeader title={d.title} subtitle={`Request for ${qty(r.quantity, d.unit)}`}><StatusBadge status={r.status} /></PageHeader>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="stack">
          {a && <div className="card"><h3>Pickup progress</h3><PickupStepper status={a.status} />{a.volunteer && <p className="small muted">Volunteer: {a.volunteer.name}{a.volunteer.phone ? ` · ${a.volunteer.phone}` : ''}</p>}<Link className="btn btn-secondary btn-sm" to="/ngo/pickups">Open pickup coordination</Link></div>}
          <div className="card"><h3>Pickup details</h3><dl className="kv"><dt>Donor</dt><dd>{r.donor?.business?.name || r.donor?.name}</dd>{r.donor?.phone && <><dt>Donor phone</dt><dd>{r.donor.phone}</dd></>}<dt>Address</dt><dd>{d.address}</dd>{d.pickupInstructions && <><dt>Instructions</dt><dd>{d.pickupInstructions}</dd></>}<dt>Deadline</dt><dd>{fmtDateTime(d.pickupDeadline)}</dd><dt>Handling</dt><dd>{d.handlingNotes || 'None'}</dd><dt>Allergens</dt><dd>{d.allergens?.join(', ') || 'None declared'}</dd></dl>
            {precise && <a className="btn btn-secondary" target="_blank" rel="noreferrer" href={directionsUrl(null, { lat: d.location.coordinates[1], lng: d.location.coordinates[0] })} style={{ marginTop: 12 }}>Open directions</a>}</div>
          {precise && <MapView markers={[{ lat: d.location.coordinates[1], lng: d.location.coordinates[0], title: d.title, subtitle: d.address }]} center={[d.location.coordinates[1], d.location.coordinates[0]]} zoom={15} label="Pickup location" />}
        </div>
        <div className="card stack"><h3>Status</h3><p className="muted">{{ pending: 'Waiting for the donor to respond.', accepted: 'Accepted. Collect within the pickup window.', ready_for_pickup: 'Ready. Collect now.', picked_up: r.needsVolunteer ? 'The volunteer has the food and is on the way.' : 'Handed over. Confirm once you have it.', delivered: 'Delivered by the volunteer. Please confirm receipt.', completed: 'Completed. Thank you!', rejected: `Declined${r.rejectionReason ? `: ${r.rejectionReason}` : ''}.`, cancelled: 'Cancelled.', expired: 'Expired.' }[r.status]}</p>
          {canReceive && <Button loading={busy} onClick={() => run(() => api.patch(`/donation-requests/${r._id}/receipt`), { success: 'Receipt confirmed', onDone: reload })}>Confirm food received</Button>}
          {['pending', 'accepted', 'ready_for_pickup'].includes(r.status) && <Button variant="secondary" loading={busy} onClick={() => run(() => api.patch(`/donation-requests/${r._id}/cancel`), { success: 'Request cancelled', onDone: reload })}>Cancel request</Button>}
          <ol className="stack small" style={{ paddingLeft: 18, margin: 0 }}>{(r.history || []).map((h, i) => <li key={i}>{fmtDateTime(h.at)} · {h.to.replace(/_/g, ' ')}</li>)}</ol></div>
      </div>
    </>
  );
}

export const NgoAnalytics = () => <><PageHeader title="Impact analytics" subtitle="What your organization has received." /><ImpactCharts /></>;

export function Organization() {
  const { organization, refresh } = useAuth(); const [run, busy] = useAction(); const [errs, setErrs] = useState({});
  const [f, setF] = useState({ name: organization?.name || '', type: organization?.type || 'ngo', registrationNumber: organization?.registrationNumber || '', description: organization?.description || '', address: organization?.address || '', contactPhone: organization?.contactPhone || '' });
  const [loc, setLoc] = useState(organization?.location?.coordinates ? { lat: organization.location.coordinates[1], lng: organization.location.coordinates[0] } : null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = (e) => { e.preventDefault(); setErrs({}); run(async () => { try { await api.put('/organizations/me', { ...f, ...(loc ? { lat: loc.lat, lng: loc.lng } : {}) }); await refresh(); } catch (x) { setErrs(x.fieldErrors || {}); throw x; } }, { success: 'Organization saved' }); };
  const v = organization?.verificationStatus;
  return (
    <>
      <PageHeader title="Organization profile" subtitle="Administrators review this information to verify your organization."><StatusBadge status={v || 'pending'} /></PageHeader>
      {organization?.verificationNotes && <div className="banner">Reviewer note: {organization.verificationNotes}</div>}
      <form className="card stack" onSubmit={save} noValidate><div className="form-grid">
        <Field label="Organization name" id="o-n" error={errs.name}><input id="o-n" className="input" value={f.name} onChange={set('name')} required /></Field>
        <Field label="Type" id="o-t"><select id="o-t" className="select" value={f.type} onChange={set('type')}>{[['ngo', 'NGO'], ['charity', 'Charity'], ['shelter', 'Shelter'], ['community_kitchen', 'Community kitchen'], ['other', 'Other']].map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></Field>
        <Field label="Registration number" id="o-r" hint="Helps reviewers verify you."><input id="o-r" className="input" value={f.registrationNumber} onChange={set('registrationNumber')} /></Field>
        <Field label="Contact phone" id="o-p"><input id="o-p" className="input" type="tel" value={f.contactPhone} onChange={set('contactPhone')} /></Field>
        <Field label="Address" id="o-a" className="full" hint="Shared with the donor and volunteer only for accepted requests."><input id="o-a" className="input" value={f.address} onChange={set('address')} /></Field>
        <Field label="About your work" id="o-d" className="full"><textarea id="o-d" className="textarea" maxLength={800} value={f.description} onChange={set('description')} /></Field>
        <div className="full"><LocationPicker value={loc} onChange={setLoc} /></div></div><Button loading={busy}>Save organization</Button></form>
    </>
  );
}
