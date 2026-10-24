import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LocateFixed, Map as MapIcon, LayoutGrid, SearchX } from 'lucide-react';
import toast from 'react-hot-toast';
import useFetch from '../../hooks/useFetch.js';
import useCategories from '../../hooks/useCategories.js';
import DonationCard from './DonationCard.jsx';
import MapView from '../maps/MapView.jsx';
import { EmptyState, ErrorState, Pagination, SkeletonCards } from '../common/ui.jsx';
import { qty } from '../../utils/format.js';

/** Search + filters + list/map views. Used on the public page and inside the NGO dashboard. */
export default function BrowseDonations({ detailBase = '/donations' }) {
  const [sp, setSp] = useSearchParams(); const nav = useNavigate(); const { categories } = useCategories();
  const [view, setView] = useState('list'); const [here, setHere] = useState(null);
  const f = { q: sp.get('q') || '', category: sp.get('category') || '', sort: sp.get('sort') || '', radiusKm: sp.get('radiusKm') || '25', minQuantity: sp.get('minQuantity') || '', availability: sp.get('availability') || '', page: sp.get('page') || '1' };
  const params = useMemo(() => ({ ...Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '')), limit: view === 'map' ? 50 : 12, ...(here ? { lat: here.lat, lng: here.lng } : {}) }), [sp, view, here]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data, meta, loading, error, reload } = useFetch('/donations', { params });
  const set = (k, v) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); if (k !== 'page') n.delete('page'); setSp(n, { replace: true }); };
  const locate = () => navigator.geolocation?.getCurrentPosition((p) => { setHere({ lat: p.coords.latitude, lng: p.coords.longitude }); set('sort', 'nearest'); }, () => toast.error('Location permission denied. You can still browse all listings.'), { timeout: 8000 });
  const donations = data?.donations || [];
  const markers = donations.map((d) => ({ id: d._id, lat: d.location.coordinates[1], lng: d.location.coordinates[0], title: d.title, subtitle: `${qty(d.quantityAvailable, d.unit)} · approximate location` }));
  if (here) markers.push({ id: null, lat: here.lat, lng: here.lng, title: 'You are here', kind: 'me' });

  return (
    <div>
      <form className="filters" onSubmit={(e) => e.preventDefault()} role="search" aria-label="Search donations">
        <div className="field"><label htmlFor="b-q">Search</label><input id="b-q" className="input" type="search" placeholder="Bread, rice, vegetables…" defaultValue={f.q} onChange={(e) => { clearTimeout(window.__bq); const v = e.target.value; window.__bq = setTimeout(() => set('q', v), 350); }} /></div>
        <div className="field"><label htmlFor="b-c">Category</label><select id="b-c" className="select" value={f.category} onChange={(e) => set('category', e.target.value)}><option value="">All categories</option>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></div>
        <div className="field"><label htmlFor="b-m">Minimum quantity</label><input id="b-m" className="input" type="number" min="0" value={f.minQuantity} onChange={(e) => set('minQuantity', e.target.value)} /></div>
        <div className="field"><label htmlFor="b-r">Distance</label><select id="b-r" className="select" value={f.radiusKm} onChange={(e) => set('radiusKm', e.target.value)} disabled={!here}>{[5, 10, 25, 50, 100].map((r) => <option key={r} value={r}>Within {r} km</option>)}</select></div>
        <div className="field"><label htmlFor="b-a">Availability</label><select id="b-a" className="select" value={f.availability} onChange={(e) => set('availability', e.target.value)}><option value="">Any time</option><option value="now">Available now</option></select></div>
        <div className="field"><label htmlFor="b-s">Sort by</label><select id="b-s" className="select" value={f.sort} onChange={(e) => set('sort', e.target.value)}><option value="">Newest</option><option value="deadline">Pickup deadline</option><option value="nearest" disabled={!here}>Nearest</option></select></div>
      </form>
      <div className="row between" style={{ marginBottom: 16 }}>
        <div className="row"><button className="btn btn-secondary btn-sm" onClick={locate}><LocateFixed size={16} />{here ? 'Location set' : 'Use my location'}</button>{here && <button className="btn btn-ghost btn-sm" onClick={() => { setHere(null); set('sort', ''); }}>Clear location</button>}</div>
        <div className="view-toggle" role="group" aria-label="View"><button aria-pressed={view === 'list'} onClick={() => setView('list')}><LayoutGrid size={14} /> List</button><button aria-pressed={view === 'map'} onClick={() => setView('map')}><MapIcon size={14} /> Map</button></div>
      </div>
      {loading && !data ? <SkeletonCards /> : error ? <ErrorState message={error} onRetry={reload} /> : donations.length === 0 ? <EmptyState icon={SearchX} title="No donations match">Try a wider distance or fewer filters. New surplus is posted throughout the day.</EmptyState> : view === 'map' ? (
        <div className="map-split"><MapView markers={markers} className="tall" onSelect={(id) => nav(`${detailBase}/${id}`)} label="Available donations map" />
          <div className="map-list">{donations.map((d) => <DonationCard key={d._id} d={d} to={`${detailBase}/${d._id}`} />)}</div></div>
      ) : <div className="d-grid" aria-busy={loading}>{donations.map((d) => <DonationCard key={d._id} d={d} to={`${detailBase}/${d._id}`} />)}</div>}
      <Pagination meta={view === 'list' ? meta : null} onPage={(p) => set('page', String(p))} />
      <p className="small muted" style={{ marginTop: 16 }}>Map pins show approximate locations. The exact address is shared only after a request is accepted.</p>
    </div>
  );
}
