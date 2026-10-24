const dtf = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const df = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
export const fmtDateTime = (d) => (d ? dtf.format(new Date(d)) : '-');
export const fmtDate = (d) => (d ? df.format(new Date(d)) : '-');
export const statusLabel = (s) => String(s || '').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
export const qty = (n, unit) => `${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit || ''}`.trim();
export function timeLeft(deadline, now = Date.now()) {
  const ms = new Date(deadline) - now; if (ms <= 0) return 'Expired';
  const m = Math.floor(ms / 60000); if (m < 60) return `${m} min left`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ${m % 60}m left`;
  return `${Math.floor(h / 24)}d ${h % 24}h left`;
}
export const toLocalInput = (d) => { if (!d) return ''; const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
export const fromLocalInput = (v) => (v ? new Date(v).toISOString() : undefined);
export const haversineKm = (a, b) => { const r = (x) => (x * Math.PI) / 180; const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng); const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
export const directionsUrl = (from, to) => `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${from ? `${from.lat}%2C${from.lng}` : ''}%3B${to.lat}%2C${to.lng}`;
