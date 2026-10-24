import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Clock, Flag, MapPin, Package, Pencil, Snowflake, Utensils, Wheat } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { unwrap } from '../../services/api.js';
import useFetch from '../../hooks/useFetch.js';
import useAction from '../../hooks/useAction.js';
import useCategories from '../../hooks/useCategories.js';
import { useAuth } from '../../context/AuthContext.jsx';
import MapView from '../../components/maps/MapView.jsx';
import { Photo } from '../../components/donations/DonationCard.jsx';
import { Button, ConfirmDialog, ErrorState, Field, Modal, PageLoader, StatusBadge } from '../../components/common/ui.jsx';
import { directionsUrl, fmtDateTime, qty, statusLabel, timeLeft } from '../../utils/format.js';

const REASONS = [['incorrect_information', 'Incorrect information'], ['unsafe_handling', 'Unsafe handling concerns'], ['expired_food', 'Expired food'], ['suspicious_listing', 'Suspicious listing'], ['inappropriate_content', 'Inappropriate content'], ['other', 'Other']];

export default function DonationDetails() {
  const { id } = useParams(); const nav = useNavigate(); const { user } = useAuth(); const { label } = useCategories();
  const { data, loading, error, reload } = useFetch(`/donations/${id}`);
  const [run, busy] = useAction(); const [rq, setRq] = useState({ quantity: '', message: '', needsVolunteer: false }); const [errs, setErrs] = useState({});
  const [reportOpen, setReportOpen] = useState(false); const [report, setReport] = useState({ reason: 'incorrect_information', details: '' }); const [cancelOpen, setCancelOpen] = useState(false);
  if (loading && !data) return <div className="container" style={{ padding: '32px 0' }}><PageLoader /></div>;
  if (error) return <div className="container" style={{ padding: '32px 0' }}><ErrorState message={error} onRetry={reload} /></div>;
  const d = data.donation; const isOwner = user && (user._id === d.donor?._id || user.role === 'admin');
  const open = ['available', 'request_pending'].includes(d.status) && d.quantityAvailable > 0 && new Date(d.pickupDeadline) > new Date();
  const [lng, lat] = d.location.coordinates;

  const sendRequest = (e) => {
    e.preventDefault(); setErrs({});
    run(async () => { try { await api.post('/donation-requests', { donation: d._id, quantity: Number(rq.quantity), message: rq.message || undefined, needsVolunteer: rq.needsVolunteer }); reload(); } catch (x) { setErrs(x.fieldErrors || {}); throw x; } }, { success: 'Request sent. The donor will respond soon' });
  };
  const doReport = () => run(() => api.post('/reports', { donation: d._id, ...report, details: report.details || undefined }), { success: 'Report sent. Our team will review it', onDone: () => setReportOpen(false) });
  const doCancel = () => run(() => api.post(`/donations/${d._id}/cancel`), { success: 'Donation cancelled', onDone: () => { setCancelOpen(false); reload(); } });
  const mine = d.myRequest;

  return (
    <div className="container" style={{ padding: '24px 0' }}>
      <button className="btn btn-ghost btn-sm" onClick={() => nav(-1)}><ArrowLeft size={16} />Back</button>
      <div className="detail-grid" style={{ marginTop: 12 }}>
        <div className="stack">
          <div className="detail-photo"><Photo d={d} size={72} /></div>
          <div className="card">
            <div className="row between"><h1 style={{ fontSize: '1.7rem', margin: 0 }}>{d.title}</h1><StatusBadge status={d.suspended ? 'suspended' : d.status} /></div>
            <p className="muted" style={{ marginTop: 8 }}>{d.description || 'No description provided.'}</p>
            <dl className="kv">
              <dt>Category</dt><dd>{label(d.category)}</dd>
              <dt>Quantity left</dt><dd><Package size={14} /> {qty(d.quantityAvailable, d.unit)} of {qty(d.quantity, d.unit)}{d.servings ? ` (about ${d.servings} servings)` : ''}</dd>
              <dt>Dietary</dt><dd><Utensils size={14} /> {statusLabel(d.dietary)}</dd>
              <dt>Allergens</dt><dd><Wheat size={14} /> {d.allergens?.length ? d.allergens.join(', ') : 'None declared'}</dd>
              <dt>Storage</dt><dd><Snowflake size={14} /> {statusLabel(d.storage)}</dd>
              {d.preparedAt && <><dt>Prepared at</dt><dd>{fmtDateTime(d.preparedAt)}</dd></>}
              <dt>Pickup window</dt><dd><Clock size={14} /> {fmtDateTime(d.availableFrom)} to {fmtDateTime(d.pickupDeadline)} · <strong>{timeLeft(d.pickupDeadline)}</strong></dd>
              <dt>Donor</dt><dd>{d.donor?.name}</dd>
              <dt>Pickup location</dt><dd><MapPin size={14} /> {d.address}</dd>
              {d.pickupInstructions && <><dt>Instructions</dt><dd>{d.pickupInstructions}</dd></>}
              {d.handlingNotes && <><dt>Handling notes</dt><dd>{d.handlingNotes}</dd></>}
            </dl>
          </div>
          <MapView markers={[{ lat, lng, title: d.title, subtitle: d.approximateLocation ? 'Approximate area' : d.address }]} center={[lat, lng]} zoom={d.approximateLocation ? 13 : 15} label="Donation location" />
          {d.approximateLocation ? <p className="small muted">The pin is approximate. The exact address is shared once your request is accepted.</p> : <a className="btn btn-secondary" href={directionsUrl(null, { lat, lng })} target="_blank" rel="noreferrer">Open directions</a>}
          {isOwner && d.statusHistory?.length > 0 && <div className="card"><h3>Status history</h3><ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>{d.statusHistory.map((h, i) => <li key={i} className="small">{fmtDateTime(h.at)} · {h.from ? `${statusLabel(h.from)} → ` : ''}<strong>{statusLabel(h.to)}</strong>{h.note ? ` · ${h.note}` : ''}</li>)}</ul></div>}
        </div>

        <aside className="stack">
          {d.suspended && isOwner && <div className="form-error"><AlertTriangle size={14} /> This listing is suspended for review{d.suspendedReason ? `: ${d.suspendedReason}` : ''}.</div>}
          {isOwner && user.role === 'donor' && <div className="card stack"><h3>Manage donation</h3>
            <Link className="btn btn-secondary" to={`/donor/requests`}>View requests</Link>
            {['draft', 'available', 'request_pending'].includes(d.status) && <Link className="btn btn-secondary" to={`/donor/donations/${d._id}/edit`}><Pencil size={16} />Edit</Link>}
            {!['completed', 'cancelled', 'expired', 'rejected', 'picked_up', 'delivered'].includes(d.status) && <button className="btn btn-danger" onClick={() => setCancelOpen(true)}>Cancel donation</button>}</div>}
          {user?.role === 'ngo' && !isOwner && (
            mine && ['pending', 'accepted', 'ready_for_pickup', 'picked_up', 'delivered'].includes(mine.status)
              ? <div className="card stack"><h3>Your request</h3><div className="row"><StatusBadge status={mine.status} /><span>{qty(mine.quantity, d.unit)}</span></div><Link className="btn btn-primary" to={`/ngo/requests/${mine._id}`}>Open request</Link></div>
              : open ? <form className="card stack" onSubmit={sendRequest} noValidate><h3>Request this donation</h3>
                <Field label={`Quantity needed (${d.unit})`} id="rq" error={errs.quantity} hint={`Up to ${d.quantityAvailable}`}><input id="rq" className="input" type="number" min="0" max={d.quantityAvailable} step="any" required value={rq.quantity} onChange={(e) => setRq({ ...rq, quantity: e.target.value })} aria-invalid={!!errs.quantity} /></Field>
                <Field label="Note to the donor (optional)" id="rm"><textarea id="rm" className="textarea" maxLength={500} value={rq.message} onChange={(e) => setRq({ ...rq, message: e.target.value })} /></Field>
                <label className="check"><input type="checkbox" checked={rq.needsVolunteer} onChange={(e) => setRq({ ...rq, needsVolunteer: e.target.checked })} /><span>I need a volunteer to collect and deliver this</span></label>
                <Button loading={busy}>Send request</Button></form>
              : <div className="card"><h3>Not available</h3><p className="muted">This donation is no longer accepting requests.</p></div>)}
          {!user && open && <div className="card stack"><h3>Want this food?</h3><p className="muted">Sign in with a verified organization account to send a request.</p><Link className="btn btn-primary" to="/login" state={{ from: `/donations/${d._id}` }}>Sign in to request</Link><Link className="btn btn-secondary" to="/register?role=ngo">Register your organization</Link></div>}
          {user && !isOwner && user.role !== 'admin' && <button className="btn btn-ghost" onClick={() => setReportOpen(true)}><Flag size={16} />Report listing</button>}
        </aside>
      </div>

      <Modal open={reportOpen} title="Report this listing" onClose={() => setReportOpen(false)} actions={<><button className="btn btn-secondary" onClick={() => setReportOpen(false)}>Cancel</button><Button loading={busy} onClick={doReport}>Send report</Button></>}>
        <div className="stack"><Field label="Reason" id="rr"><select id="rr" className="select" value={report.reason} onChange={(e) => setReport({ ...report, reason: e.target.value })}>{REASONS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></Field>
          <Field label="Details (optional)" id="rd"><textarea id="rd" className="textarea" maxLength={800} value={report.details} onChange={(e) => setReport({ ...report, details: e.target.value })} /></Field></div></Modal>
      <ConfirmDialog open={cancelOpen} danger busy={busy} title="Cancel this donation?" message="Pending and accepted requests will be cancelled and those organizations will be notified." confirmLabel="Cancel donation" onConfirm={doCancel} onCancel={() => setCancelOpen(false)} />
    </div>
  );
}
