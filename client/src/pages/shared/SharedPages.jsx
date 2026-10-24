import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { Bell, CheckCircle2, Scale, Timer, TrendingUp, Truck, Users, Utensils } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api.js';
import useFetch from '../../hooks/useFetch.js';
import useAction from '../../hooks/useAction.js';
import useCategories from '../../hooks/useCategories.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { getSocket } from '../../services/socket.js';
import MapView from '../../components/maps/MapView.jsx';
import { HandoverCode } from '../../components/dashboard/QrParts.jsx';
import { Button, EmptyState, ErrorState, Field, PageHeader, Pagination, SkeletonRows, StatCard, StatusBadge } from '../../components/common/ui.jsx';
import { fmtDateTime, qty } from '../../utils/format.js';

const COLORS = ['#15803d', '#0ea5e9', '#f59e0b', '#a855f7', '#ef4444', '#64748b'];

export function ImpactCharts() {
  const { data, loading, error, reload } = useFetch('/analytics/me'); const { label } = useCategories();
  if (loading && !data) return <SkeletonRows />; if (error) return <ErrorState message={error} onRetry={reload} />;
  const t = data.totals || {}; const monthly = data.monthly || []; const cats = (data.byCategory || []).map((c) => ({ name: label(c.category), value: c.count }));
  const vol = data.role === 'volunteer';
  return (
    <div className="stack">
      <div className="grid-4">
        <StatCard icon={CheckCircle2} label={vol ? 'Completed deliveries' : 'Completed handovers'} value={t.completed ?? 0} />
        {!vol && <StatCard icon={Scale} label="Food weight (kg)" value={t.weightKg ?? 0} />}
        {!vol && <StatCard icon={Utensils} label="Estimated servings" value={t.servings ?? 0} />}
        {!vol && <StatCard icon={TrendingUp} label="Completion rate" value={data.completionRate == null ? 'n/a' : `${data.completionRate}%`} />}
        {vol && <StatCard icon={Timer} label="Avg. accept → delivered (min)" value={t.avgCompletionMinutes ?? 'n/a'} />}
        {vol && <StatCard icon={Truck} label="Active pickups" value={data.active ?? 0} />}
      </div>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card"><h3>Completed per month</h3>{monthly.length ? <div style={{ height: 260 }}><ResponsiveContainer><BarChart data={monthly}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="completed" name="Completed" fill="#15803d" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div> : <p className="muted">No completed handovers in the last 6 months yet.</p>}</div>
        {!vol && <div className="card"><h3>Food categories</h3>{cats.length ? <div style={{ height: 260 }}><ResponsiveContainer><PieChart><Pie data={cats} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>{cats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div> : <p className="muted">Categories appear after your first completed handover.</p>}</div>}
      </div>
      <p className="small muted">Counts include completed, confirmed handovers only; cancelled and expired listings are excluded. Weight is counted only for donations listed in kg, g or lb. We do not estimate environmental savings.</p>
    </div>
  );
}

export function NotificationsPage() {
  const [page, setPage] = useState(1); const { data, meta, loading, error, reload } = useFetch('/notifications', { params: { page } });
  useEffect(() => { const h = () => reload(); window.addEventListener('fr:notification', h); return () => window.removeEventListener('fr:notification', h); }, [reload]);
  const read = async (n) => { if (!n.readAt) { await api.patch(`/notifications/${n._id}/read`).catch(() => {}); reload(); } };
  const all = async () => { await api.patch('/notifications/read-all'); toast.success('All caught up'); reload(); };
  return (
    <>
      <PageHeader title="Notifications" subtitle={data ? `${data.unread} unread` : ''}><button className="btn btn-secondary" onClick={all} disabled={!data?.unread}>Mark all as read</button></PageHeader>
      {loading && !data ? <SkeletonRows /> : error ? <ErrorState message={error} onRetry={reload} /> : !data.notifications.length ? <EmptyState icon={Bell} title="You’re all caught up">Updates about requests, pickups and your account will appear here.</EmptyState> :
        <div className="note-list">{data.notifications.map((n) => <div key={n._id} className={`note ${n.readAt ? '' : 'unread'}`}><div style={{ flex: 1 }}><h4>{n.title}</h4><p>{n.message}</p><span className="small muted">{fmtDateTime(n.createdAt)}</span></div>
          <div className="row">{n.link && <Link className="btn btn-secondary btn-sm" to={n.link} onClick={() => read(n)}>Open</Link>}{!n.readAt && <button className="btn btn-ghost btn-sm" onClick={() => read(n)}>Mark read</button>}</div></div>)}</div>}
      <Pagination meta={meta} onPage={setPage} />
    </>
  );
}

const STEPS = [['assigned', 'Assigned'], ['accepted', 'Accepted'], ['en_route', 'En route'], ['picked_up', 'Picked up'], ['delivered', 'Delivered'], ['completed', 'Completed']];
export function PickupStepper({ status }) {
  const idx = Math.max(0, STEPS.findIndex(([s]) => s === (status === 'open' ? 'assigned' : status)));
  return <ol className="stepper" style={{ listStyle: 'none', padding: 0 }} aria-label="Pickup progress">{STEPS.map(([s, l], i) => <li key={s} className={`step ${i < idx ? 'done' : i === idx && status !== 'open' ? 'current' : ''}`} aria-current={i === idx ? 'step' : undefined}><div className="dot">{i < idx ? '✓' : i + 1}</div>{l}</li>)}</ol>;
}

/** Live volunteer position, visible only to parties of an assignment while the volunteer shares it. */
function LiveTrack({ a }) {
  const [pos, setPos] = useState(null);
  useEffect(() => {
    const s = getSocket(); if (!s || !a.sharingLocation) return undefined;
    s.emit('assignment:join', a._id, () => {}); const h = (p) => p.assignmentId === a._id && setPos(p); s.on('location:update', h);
    return () => { s.off('location:update', h); s.emit('assignment:leave', a._id); };
  }, [a._id, a.sharingLocation]);
  if (!a.sharingLocation) return null;
  return pos ? <MapView markers={[{ lat: pos.lat, lng: pos.lng, title: 'Volunteer', kind: 'me' }]} height={200} label="Volunteer live location" /> : <p className="small muted">The volunteer is sharing location. Waiting for the next update…</p>;
}

/** Donor / NGO view of volunteer pickups, with handover codes. */
export function PartyPickups() {
  const { user } = useAuth(); const [page, setPage] = useState(1); const { data, meta, loading, error, reload } = useFetch('/pickups/party', { params: { page } }); const [run, busy] = useAction();
  useEffect(() => { const s = getSocket(); const h = () => reload(); s?.on('pickup:updated', h); s?.on('request:updated', h); return () => { s?.off('pickup:updated', h); s?.off('request:updated', h); }; }, [reload]);
  const receipt = (a) => run(() => api.patch(`/donation-requests/${a.request}/receipt`), { success: 'Receipt confirmed', onDone: reload });
  return (
    <>
      <PageHeader title={user.role === 'ngo' ? 'Pickup coordination' : 'Volunteer pickups'} subtitle="Track volunteers and create one-time handover codes." />
      {loading && !data ? <SkeletonRows /> : error ? <ErrorState message={error} onRetry={reload} /> : !data.assignments.length ? <EmptyState icon={Truck} title="No volunteer pickups">When a request asks for a volunteer, you can follow the pickup here.</EmptyState> :
        <div className="stack">{data.assignments.map((a) => {
          const pickupCode = user.role === 'donor' && ['accepted', 'en_route'].includes(a.status) && a.volunteer; const deliveryCode = user.role === 'ngo' && a.status === 'picked_up';
          return <div className="card stack" key={a._id}><div className="row between"><div><h3 style={{ margin: 0 }}>{a.donation.title}</h3><div className="small muted">{qty(a.quantity, a.donation.unit)} · deadline {fmtDateTime(a.donation.pickupDeadline)} · {a.volunteer ? `Volunteer: ${a.volunteer.name}` : 'Waiting for a volunteer'}</div></div><StatusBadge status={a.status} /></div>
            <PickupStepper status={a.status} /><LiveTrack a={a} />
            {pickupCode && <div><p className="small muted">Show this code to the volunteer when they arrive. It works once and expires in 10 minutes.</p><HandoverCode assignmentId={a._id} label="Create pickup code" /></div>}
            {deliveryCode && <div><p className="small muted">Show this code to the volunteer when they deliver the food.</p><HandoverCode assignmentId={a._id} label="Create delivery code" /></div>}
            {user.role === 'ngo' && a.status === 'delivered' && <Button loading={busy} onClick={() => receipt(a)}>Confirm food received</Button>}</div>; })}</div>}
      <Pagination meta={meta} onPage={setPage} />
    </>
  );
}

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function ProfilePage() {
  const { user, setUser } = useAuth(); const [run, busy] = useAction(); const [pw, setPw] = useState({ currentPassword: '', newPassword: '' }); const [pwErr, setPwErr] = useState({});
  const [f, setF] = useState({ name: user.name, phone: user.phone || '', business: { name: user.business?.name || '', type: user.business?.type || 'restaurant', address: user.business?.address || '', description: user.business?.description || '' },
    volunteer: { bio: user.volunteer?.bio || '', vehicle: user.volunteer?.vehicle || 'none', available: !!user.volunteer?.available, shareLocationConsent: !!user.volunteer?.shareLocationConsent, availability: user.volunteer?.availability || [] } });
  const [errs, setErrs] = useState({});
  const save = (e) => { e.preventDefault(); setErrs({}); const body = { name: f.name, phone: f.phone, ...(user.role === 'donor' && { business: f.business }), ...(user.role === 'volunteer' && { volunteer: f.volunteer }) };
    run(async () => { try { const r = await api.patch('/users/me', body); setUser(r.data.data.user); } catch (x) { setErrs(x.fieldErrors || {}); throw x; } }, { success: 'Profile updated' }); };
  const changePw = (e) => { e.preventDefault(); setPwErr({}); run(async () => { try { await api.post('/users/me/password', pw); setPw({ currentPassword: '', newPassword: '' }); } catch (x) { setPwErr(x.fieldErrors || {}); throw x; } }, { success: 'Password changed' }); };
  const setV = (k, v) => setF({ ...f, volunteer: { ...f.volunteer, [k]: v } }); const setB = (k, v) => setF({ ...f, business: { ...f.business, [k]: v } });
  const addSlot = () => setV('availability', [...f.volunteer.availability, { day: 1, from: '09:00', to: '17:00' }]);
  const upSlot = (i, k, v) => setV('availability', f.volunteer.availability.map((s, j) => (j === i ? { ...s, [k]: k === 'day' ? Number(v) : v } : s)));
  return (
    <>
      <PageHeader title="Profile settings" subtitle={user.email} />
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <form className="card stack" onSubmit={save} noValidate><h3>Your details</h3>
          <Field label="Name" id="p-n" error={errs.name}><input id="p-n" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Phone" id="p-p" error={errs.phone} hint={user.role === 'volunteer' ? 'Required to accept pickups.' : undefined}><input id="p-p" className="input" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          {user.role === 'donor' && <><Field label="Business name" id="p-bn"><input id="p-bn" className="input" value={f.business.name} onChange={(e) => setB('name', e.target.value)} /></Field>
            <Field label="Business type" id="p-bt"><select id="p-bt" className="select" value={f.business.type} onChange={(e) => setB('type', e.target.value)}>{['restaurant', 'grocery', 'bakery', 'hotel', 'event', 'other'].map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Business address" id="p-ba"><input id="p-ba" className="input" value={f.business.address} onChange={(e) => setB('address', e.target.value)} /></Field></>}
          {user.role === 'volunteer' && <><Field label="About you" id="p-bio"><textarea id="p-bio" className="textarea" maxLength={500} value={f.volunteer.bio} onChange={(e) => setV('bio', e.target.value)} /></Field>
            <Field label="Vehicle" id="p-v"><select id="p-v" className="select" value={f.volunteer.vehicle} onChange={(e) => setV('vehicle', e.target.value)}>{['none', 'bicycle', 'motorbike', 'car', 'van'].map((t) => <option key={t}>{t}</option>)}</select></Field>
            <label className="check"><input type="checkbox" checked={f.volunteer.available} onChange={(e) => setV('available', e.target.checked)} /><span>I’m available for pickups right now</span></label>
            <label className="check"><input type="checkbox" checked={f.volunteer.shareLocationConsent} onChange={(e) => setV('shareLocationConsent', e.target.checked)} /><span>Allow sharing my live location with the donor and organization during an active pickup (you choose per pickup, and it stops when you turn it off)</span></label>
            <div><div className="label" style={{ fontWeight: 600, fontSize: '.88rem', marginBottom: 6 }}>Weekly availability</div>
              {f.volunteer.availability.map((s, i) => <div className="row" key={i} style={{ marginBottom: 8 }}><select className="select" style={{ width: 90 }} aria-label="Day" value={s.day} onChange={(e) => upSlot(i, 'day', e.target.value)}>{DAY.map((d, n) => <option key={d} value={n}>{d}</option>)}</select><input className="input" style={{ width: 120 }} type="time" aria-label="From" value={s.from} onChange={(e) => upSlot(i, 'from', e.target.value)} /><input className="input" style={{ width: 120 }} type="time" aria-label="To" value={s.to} onChange={(e) => upSlot(i, 'to', e.target.value)} /><button type="button" className="btn btn-ghost btn-sm" onClick={() => setV('availability', f.volunteer.availability.filter((_, j) => j !== i))}>Remove</button></div>)}
              <button type="button" className="btn btn-secondary btn-sm" onClick={addSlot}>Add time slot</button></div></>}
          <Button loading={busy}>Save changes</Button></form>
        <form className="card stack" onSubmit={changePw} noValidate><h3>Change password</h3>
          <Field label="Current password" id="cp" error={pwErr.currentPassword}><input id="cp" className="input" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
          <Field label="New password" id="np" error={pwErr.newPassword} hint="10+ characters with upper-case, lower-case and a number."><input id="np" className="input" type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
          <Button loading={busy} variant="secondary">Update password</Button></form>
      </div>
    </>
  );
}
