import { Link } from 'react-router-dom';
import { Clock, MapPin, Package, Salad } from 'lucide-react';
import { StatusBadge } from '../common/ui.jsx';
import { qty, timeLeft } from '../../utils/format.js';
import useCategories from '../../hooks/useCategories.js';

export const Photo = ({ d, size = 28 }) => (d.imageUrl ? <img src={d.imageUrl} alt={d.title} loading="lazy" /> : <Salad size={size} aria-label="No photo provided" />);

export default function DonationCard({ d, to }) {
  const { label } = useCategories();
  return (
    <article className="d-card">
      <div className="d-photo"><Photo d={d} size={44} /><span className="badge green">{label(d.category)}</span></div>
      <div className="d-body">
        <h3><Link to={to || `/donations/${d._id}`}>{d.title}</Link></h3>
        <div className="d-meta">
          <span><Package size={14} />{qty(d.quantityAvailable ?? d.quantity, d.unit)} left</span>
          <span><Clock size={14} />{timeLeft(d.pickupDeadline)}</span>
          <span><MapPin size={14} />{d.city || 'Nearby'}{d.distanceKm !== undefined ? ` · ${d.distanceKm} km` : ''}</span>
        </div>
        <div className="small muted">By {d.donor?.name}</div>
      </div>
      <div className="d-foot"><Link className="btn btn-primary btn-block" to={to || `/donations/${d._id}`}>View details</Link></div>
    </article>
  );
}

export function DonationRow({ d, actions }) {
  const { label } = useCategories();
  return (
    <div className="d-row">
      <div className="thumb"><Photo d={d} /></div>
      <div><strong><Link to={`/donations/${d._id}`}>{d.title}</Link></strong><div className="d-meta"><span>{label(d.category)}</span><span>{qty(d.quantity, d.unit)}</span><span><Clock size={13} />{timeLeft(d.pickupDeadline)}</span>{d.pendingRequests > 0 && <span className="badge amber">{d.pendingRequests} pending</span>}</div></div>
      <div className="row"><StatusBadge status={d.suspended ? 'suspended' : d.status} />{actions}</div>
    </div>
  );
}
