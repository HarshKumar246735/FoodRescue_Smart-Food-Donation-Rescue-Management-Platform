import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, MapPin, Navigation, Timer, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api.js';
import useFetch from '../../hooks/useFetch.js';
import useAction from '../../hooks/useAction.js';
import { getSocket } from '../../services/socket.js';
import { useAuth } from '../../context/AuthContext.jsx';
import MapView from '../../components/maps/MapView.jsx';
import { QrScanner, parseQr } from '../../components/dashboard/QrParts.jsx';
import { Button, EmptyState, ErrorState, Field, PageHeader, PageLoader, Pagination, SkeletonRows, StatCard, StatusBadge } from '../../components/common/ui.jsx';
import { directionsUrl, fmtDateTime, haversineKm, qty, timeLeft } from '../../utils/format.js';
import { PickupStepper } from '../shared/SharedPages.jsx';

const Row = ({ a, children }) => (
  <div className="card"><div className="row between"><div><h3 style={{ margin: 0 }}><Link to={`/volunteer/pickups/${a._id}`}>{a.donation.title}</Link></h3>
    <div className="small muted"><MapPin size={13} /> {a.pickup.address} → {a.delivery.name || 'Recipient'} · {qty(a.quantity, a.donation.unit)} · {timeLeft(a.donation.pickupDeadline)}</div></div><StatusBadge status={a.status} /></div>
    <div className="row" style={{ marginTop: 12 }}><Link className="btn btn-secondary btn-sm" to={`/volunteer/pickups/${a._id}`}>Details</Link>{children}</div></div>
);

export function VolunteerDashboard() {
  const { user } = useAuth(); const a = useFetch('/analytics/me'); const mine = useFetch('/pickups/mine', { params: { limit: 5 } });
  return (
    <>
      <PageHeader title={`Hi, ${user.name}`} subtitle="Thank you for helping food reach people."><Link className="btn btn-primary" to="/volunteer/available">Find pickups</Link></PageHeader>
      {!user.phone && <div className="banner"><span>Add a phone number to accept pickups.</span><Link className="btn btn-sm btn-secondary" to="/volunteer/profile">Open profile</Link></div>}
      <div className="grid-3"><StatCard icon={Truck} label="Active pickups" value={a.data?.active ?? '-'} /><StatCard icon={CheckCircle2} label="Completed deliveries" value={a.data?.totals?.completed ?? '-'} /><StatCard icon={Timer} label="Avg. minutes accept → delivered" value={a.data?.totals?.avgCompletionMinutes ?? 'n/a'} /></div>
      <div className="stack" style={{ marginTop: 16 }}><h3>Your active pickups</h3>{mine.loading ? <SkeletonRows n={2} /> : mine.data?.assignments.length ? mine.data.assignments.map((x) => <Row key={x._id} a={x} />) : <EmptyState icon={Truck} title="Nothing active">Browse open pickups and accept one that suits you.</EmptyState>}</div>
    </>
  );
}

export function AvailablePickups() {
  const nav = useNavigate(); const [page, setPage] = useState(1); const { data, meta, loading, error, reload } = useFetch('/pickups/available', { params: { page } }); const [run, busy] = useAction();
  useEffect(() => { const s = getSocket(); s?.on('assignment:new', reload); return () => s?.off('assignment:new', reload); }, [reload]);
  const accept = (a) => run(() => api.post(`/pickups/${a._id}/accept`), { success: 'Pickup accepted', onDone: () => nav(`/volunteer/pickups/${a._id}`) }).then(reload);
  const markers = (data?.assignments || []).map((a) => ({ id: a._id, lat: a.pickup.location?.coordinates[1], lng: a.pickup.location?.coordinates[0], title: a.donation.title, subtitle: `${qty(a.quantity, a.donation.unit)} · approximate pickup area` }));
  return (
    <>
      <PageHeader title="Available pickups" subtitle="Exact addresses are shown after you accept." />
      {loading && !data ? <SkeletonRows /> : error ? <ErrorState message={error} onRetry={reload} /> : !data.assignments.length ? <EmptyState icon={Truck} title="No open pickups right now">New pickups appear here instantly when organizations ask for a volunteer.</EmptyState> :
        <div className="stack"><MapView markers={markers} onSelect={(id) => nav(`/volunteer/pickups/${id}`)} label="Open pickups map" />{data.assignments.map((a) => <Row key={a._id} a={a}><Button size="sm" loading={busy} onClick={() => accept(a)}>Accept pickup</Button></Row>)}</div>}
      <Pagination meta={meta} onPage={setPage} />
    </>
  );
}

export function MyPickups({ completed = false }) {
  const [page, setPage] = useState(1); const { data, meta, loading, error, reload } = useFetch('/pickups/mine', { params: { view: completed ? 'completed' : 'active', page } });
  return <><PageHeader title={completed ? 'Completed assignments' : 'My pickups'} />{loading && !data ? <SkeletonRows /> : error ? <ErrorState message={error} onRetry={reload} /> : !data.assignments.length ? <EmptyState icon={Truck} title={completed ? 'No completed pickups yet' : 'No active pickups'} /> : <div className="stack">{data.assignments.map((a) => <Row key={a._id} a={a} />)}</div>}<Pagination meta={meta} onPage={setPage} /></>;
}

function VerifyBox({ id, status, onDone }) {
  const [code, setCode] = useState(''); const [run, busy] = useAction();
  const submit = (raw) => { const q = parseQr(raw); if (q.assignment && q.assignment !== id) return toast.error('That code belongs to a different pickup'); run(() => api.post(`/pickups/${id}/verify`, { token: q.token }), { success: (r) => r.data.message, onDone }); };
  return (
    <div className="card stack"><h3>{status === 'en_route' ? 'Verify pickup' : 'Verify delivery'}</h3><p className="muted small">{status === 'en_route' ? 'Ask the donor for their one-time code and scan it, or type it in.' : 'Ask the organization for their one-time delivery code.'}</p>
      <QrScanner onResult={submit} />
      <form className="row" style={{ flexWrap: 'nowrap' }} onSubmit={(e) => { e.preventDefault(); if (code.trim()) submit(code); }}><label className="sr-only" htmlFor="vc">Handover code</label><input id="vc" className="input" placeholder="Type the code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" /><Button loading={busy}>Verify</Button></form></div>
  );
}

export function PickupDetails() {
  const { id } = useParams(); const { user, refresh } = useAuth(); const { data, loading, error, reload } = useFetch(`/pickups/${id}`); const [run, busy] = useAction(); const watch = useRef(null); const [sharing, setSharing] = useState(false);
  useEffect(() => { if (data) setSharing(!!data.assignment.sharingLocation); }, [data?.assignment?.sharingLocation]); // eslint-disable-line react-hooks/exhaustive-deps
  const stop = () => { if (watch.current != null) navigator.geolocation.clearWatch(watch.current); watch.current = null; };
  useEffect(() => stop, []);
  const a = data?.assignment; const status = a?.status;
  // Live location runs only while sharing is on AND the pickup is active; it stops on toggle-off, completion or leaving the page.
  useEffect(() => {
    if (!(sharing && ['en_route', 'picked_up'].includes(status))) { stop(); return; }
    const s = getSocket(); watch.current = navigator.geolocation?.watchPosition((p) => s?.emit('location:update', { assignmentId: id, lat: p.coords.latitude, lng: p.coords.longitude }), () => { toast.error('Could not read your location'); setSharing(false); api.post(`/pickups/${id}/sharing`, { on: false }).catch(() => {}); }, { enableHighAccuracy: true, maximumAge: 5000 });
    return stop;
  }, [sharing, status, id]);
  if (loading && !data) return <PageLoader />; if (error) return <ErrorState message={error} onRetry={reload} />;
  const mine = a.volunteer && String(a.volunteer._id || a.volunteer) === user._id;
  const act = (path, msg, extra) => run(() => api.post(`/pickups/${id}/${path}`, extra), { success: msg, onDone: reload });
  const toggle = async () => { const on = !sharing; try { await api.post(`/pickups/${id}/sharing`, { on }); setSharing(on); toast.success(on ? 'Location sharing on' : 'Location sharing off'); } catch (e) { toast.error(e.message); } };
  const p = a.pickup.location?.coordinates; const d = a.delivery.location?.coordinates;
  const markers = [p && { lat: p[1], lng: p[0], title: 'Pickup', subtitle: a.pickup.address }, d && { lat: d[1], lng: d[0], title: 'Delivery', subtitle: a.delivery.name, kind: 'alt' }].filter(Boolean);
  const km = p && d ? haversineKm({ lat: p[1], lng: p[0] }, { lat: d[1], lng: d[0] }).toFixed(1) : null;
  return (
    <>
      <PageHeader title={a.donation.title} subtitle={`${qty(a.quantity, a.donation.unit)} · deadline ${fmtDateTime(a.donation.pickupDeadline)}`}><StatusBadge status={status} /></PageHeader>
      <div className="card"><PickupStepper status={status} /></div>
      <div className="grid-2" style={{ marginTop: 16, alignItems: 'start' }}>
        <div className="stack">
          <div className="card"><h3>Route</h3>{markers.length ? <MapView markers={markers} line={markers.length === 2 ? markers.map((m) => [m.lat, m.lng]) : undefined} label="Pickup and delivery map" /> : <p className="muted">The map appears once you accept and exact locations are shared.</p>}
            {km && <p className="small muted" style={{ marginTop: 8 }}>Straight-line distance about {km} km. Road routing isn’t built in; use the directions links below.</p>}
            <div className="row" style={{ marginTop: 8 }}>{p && <a className="btn btn-secondary btn-sm" target="_blank" rel="noreferrer" href={directionsUrl(null, { lat: p[1], lng: p[0] })}><Navigation size={14} />Directions to pickup</a>}{d && <a className="btn btn-secondary btn-sm" target="_blank" rel="noreferrer" href={directionsUrl(p ? { lat: p[1], lng: p[0] } : null, { lat: d[1], lng: d[0] })}><Navigation size={14} />Pickup to delivery</a>}</div></div>
          <div className="card"><h3>Details</h3><dl className="kv"><dt>Pickup</dt><dd>{a.pickup.address}</dd>{a.pickup.instructions && <><dt>Instructions</dt><dd>{a.pickup.instructions}</dd></>}{a.pickup.handlingNotes && <><dt>Handling</dt><dd>{a.pickup.handlingNotes}</dd></>}{a.pickup.allergens?.length > 0 && <><dt>Allergens</dt><dd>{a.pickup.allergens.join(', ')}</dd></>}{a.pickup.storage && <><dt>Storage</dt><dd>{a.pickup.storage.replace('_', ' ')}</dd></>}
            <dt>Deliver to</dt><dd>{a.delivery.name} · {a.delivery.address}</dd>{a.contacts?.donor?.phone && <><dt>Donor contact</dt><dd>{a.contacts.donor.name} · {a.contacts.donor.phone}</dd></>}{a.contacts?.recipient?.phone && <><dt>Recipient contact</dt><dd>{a.contacts.recipient.name} · {a.contacts.recipient.phone}</dd></>}</dl></div>
        </div>
        <div className="stack">
          <div className="card stack"><h3>Next step</h3>
            {status === 'open' && <Button loading={busy} onClick={() => act('accept', 'Pickup accepted')}>Accept pickup</Button>}
            {status === 'assigned' && mine && <div className="row"><Button loading={busy} onClick={() => act('accept', 'Pickup accepted')}>Accept</Button><Button variant="secondary" loading={busy} onClick={() => act('decline', 'Returned to the pool')}>Decline</Button></div>}
            {status === 'accepted' && mine && <Button loading={busy} onClick={() => act('start', 'On your way')}>Start pickup</Button>}
            {['accepted', 'en_route'].includes(status) && mine && <Button variant="ghost" loading={busy} onClick={() => act('cancel', 'Pickup released')}>I can’t do this pickup</Button>}
            {status === 'delivered' && <p className="muted">Delivered. Waiting for the organization to confirm receipt.</p>}{status === 'completed' && <p className="muted">All done. Thank you!</p>}</div>
          {mine && ['en_route', 'picked_up'].includes(status) && <VerifyBox id={id} status={status} onDone={reload} />}
          {mine && ['en_route', 'picked_up'].includes(status) && <div className="card stack"><h3>Share live location</h3><p className="small muted">Lets the donor and organization see where you are during this pickup only. It stops when you turn it off or finish.</p>
            {user.volunteer?.shareLocationConsent ? <button className="btn btn-secondary" onClick={toggle}>{sharing ? 'Stop sharing' : 'Start sharing'}</button> : <Link to="/volunteer/profile" className="btn btn-secondary">Enable consent in profile</Link>}</div>}
        </div>
      </div>
    </>
  );
}

export function ScanPage() {
  const nav = useNavigate(); const [run] = useAction(); const mine = useFetch('/pickups/mine'); const [sel, setSel] = useState(''); const [code, setCode] = useState('');
  const active = (mine.data?.assignments || []).filter((a) => ['en_route', 'picked_up'].includes(a.status));
  const verify = (raw) => { const q = parseQr(raw); const target = q.assignment || sel || active[0]?._id; if (!target) return toast.error('Start a pickup first'); run(() => api.post(`/pickups/${target}/verify`, { token: q.token }), { success: (r) => r.data.message, onDone: () => nav(`/volunteer/pickups/${target}`) }); };
  return (
    <>
      <PageHeader title="QR verification" subtitle="Scan the one-time code shown by the donor (pickup) or the organization (delivery)." />
      <div className="card stack" style={{ maxWidth: 520 }}>
        {mine.loading ? <SkeletonRows n={1} /> : !active.length ? <EmptyState icon={Truck} title="No pickup ready to verify">Open a pickup and tap “Start pickup” first.</EmptyState> : <>
          {active.length > 1 && <Field label="Pickup" id="sp"><select id="sp" className="select" value={sel} onChange={(e) => setSel(e.target.value)}>{active.map((a) => <option key={a._id} value={a._id}>{a.donation.title}</option>)}</select></Field>}
          <QrScanner onResult={verify} />
          <form className="row" style={{ flexWrap: 'nowrap' }} onSubmit={(e) => { e.preventDefault(); if (code.trim()) verify(code); }}><label className="sr-only" htmlFor="sc">Handover code</label><input id="sc" className="input" placeholder="Or type the code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" /><button className="btn btn-primary">Verify</button></form></>}
      </div>
    </>
  );
}
