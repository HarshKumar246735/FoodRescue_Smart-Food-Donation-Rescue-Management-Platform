import { useState } from 'react';
import { LocateFixed, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api.js';
import MapView from './MapView.jsx';
import { Field } from '../common/ui.jsx';

/** Pick a point by clicking the map, searching an address (server-side geocoder) or using device location (on click only). */
export default function LocationPicker({ value, onChange, error }) {
  const [q, setQ] = useState(''); const [results, setResults] = useState([]); const [busy, setBusy] = useState(false);
  const has = value && Number.isFinite(value.lat) && Number.isFinite(value.lng);
  const search = async () => {
    if (q.trim().length < 3) return; setBusy(true);
    try { const { data } = await api.get('/geo/search', { params: { q } }); setResults(data.data.results); if (!data.data.results.length) toast('No matches. Try the map instead.'); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const locate = () => navigator.geolocation?.getCurrentPosition(
    (p) => onChange({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) }),
    () => toast.error('Location permission was denied. Click the map instead.'), { timeout: 8000 });
  return (
    <div className="stack">
      <Field label="Find the pickup point" id="loc-q" error={error} hint="Search an address, use your location, or click the map to drop a pin.">
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input id="loc-q" className="input" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } }} placeholder="e.g. 12 Market Road, Pune" />
          <button type="button" className="btn btn-secondary" onClick={search} disabled={busy}><Search size={16} />Search</button>
          <button type="button" className="btn btn-secondary" onClick={locate} aria-label="Use my current location"><LocateFixed size={16} /></button>
        </div>
      </Field>
      {results.length > 0 && <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>{results.map((r, i) => (
        <li key={i}><button type="button" className="btn btn-ghost btn-block" style={{ justifyContent: 'flex-start', whiteSpace: 'normal', textAlign: 'left' }} onClick={() => { onChange({ lat: r.lat, lng: r.lng, label: r.label, city: r.city }); setResults([]); }}>{r.label}</button></li>))}</ul>}
      <MapView markers={has ? [{ id: 'p', lat: value.lat, lng: value.lng, title: 'Pickup point' }] : []} center={has ? [value.lat, value.lng] : undefined} onMapClick={(p) => onChange({ ...value, ...p })} height={280} label="Pickup location map" />
      {has && <span className="hint">Selected: {value.lat.toFixed(5)}, {value.lng.toFixed(5)}</span>}
    </div>
  );
}
