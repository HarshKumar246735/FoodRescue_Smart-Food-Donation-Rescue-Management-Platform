import { useEffect, useRef } from 'react';
import L from 'leaflet';

const TILE = import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const icon = (cls = '') => L.divIcon({ className: '', html: `<div class="fr-pin ${cls}"></div>`, iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [0, -26] });

/**
 * Leaflet map. Popups are built with DOM nodes + textContent (never innerHTML) so listing text cannot inject markup.
 * markers: [{ id, lat, lng, title, subtitle, kind }]   line: [[lat,lng],...]
 */
export default function MapView({ markers = [], center, zoom = 12, height, onSelect, onMapClick, line, fit = true, className = '', label = 'Map' }) {
  const el = useRef(null); const map = useRef(null); const layer = useRef(null);
  const cb = useRef({ onSelect, onMapClick }); cb.current = { onSelect, onMapClick };

  useEffect(() => {
    map.current = L.map(el.current, { scrollWheelZoom: false }).setView(center || [20.59, 78.96], center ? zoom : 4);
    L.tileLayer(TILE, { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    map.current.on('click', (e) => cb.current.onMapClick?.({ lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) }));
    return () => { map.current.remove(); map.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!map.current) return;
    layer.current.clearLayers();
    const pts = [];
    markers.forEach((m) => {
      if (!Number.isFinite(m.lat) || !Number.isFinite(m.lng)) return;
      const mk = L.marker([m.lat, m.lng], { icon: icon(m.kind), title: m.title }).addTo(layer.current); pts.push([m.lat, m.lng]);
      const box = document.createElement('div'); const t = document.createElement('div'); t.className = 'pop-title'; t.textContent = m.title || ''; box.appendChild(t);
      if (m.subtitle) { const s = document.createElement('div'); s.textContent = m.subtitle; box.appendChild(s); }
      if (m.id && cb.current.onSelect) { const b = document.createElement('button'); b.className = 'pop-btn'; b.textContent = 'View details'; b.onclick = () => cb.current.onSelect(m.id); box.appendChild(b); }
      mk.bindPopup(box);
    });
    if (line?.length > 1) { L.polyline(line, { color: '#15803d', weight: 4, dashArray: '8 8' }).addTo(layer.current); }
    if (fit && pts.length > 1) map.current.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });
    else if (pts.length === 1) map.current.setView(pts[0], Math.max(map.current.getZoom(), 13));
    else if (center) map.current.setView(center, zoom);
  }, [markers, line, center?.[0], center?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className={`map ${className}`} style={height ? { height } : undefined} role="region" aria-label={label} />;
}
