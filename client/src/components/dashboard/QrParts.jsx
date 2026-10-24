import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api.js';
import { Button } from '../common/ui.jsx';

/** Shows a short-lived single-use handover code as a QR plus a typed fallback. */
export function HandoverCode({ assignmentId, label, onCreated }) {
  const [code, setCode] = useState(null); const [busy, setBusy] = useState(false); const [left, setLeft] = useState(0);
  useEffect(() => { if (!code) return undefined; const t = setInterval(() => { const s = Math.max(0, Math.round((new Date(code.expiresAt) - Date.now()) / 1000)); setLeft(s); if (!s) setCode(null); }, 1000); return () => clearInterval(t); }, [code]);
  const make = async () => { setBusy(true); try { const { data } = await api.post(`/pickups/${assignmentId}/handover-token`); setCode(data.data); setLeft(600); onCreated?.(); } catch (e) { toast.error(e.message); } finally { setBusy(false); } };
  return (
    <div className="qr-box">
      {code ? <><QRCodeSVG value={code.qrPayload} size={176} level="M" title="Handover QR code" /><div className="code" aria-label="Typed code">{code.token}</div><span className="small muted">Valid for {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')} · works once</span></>
        : <Button loading={busy} onClick={make}>{label}</Button>}
    </div>
  );
}

/** Camera QR scanner. Stops the camera when closed or unmounted. */
export function QrScanner({ onResult }) {
  const [on, setOn] = useState(false); const ref = useRef(null);
  useEffect(() => {
    if (!on) return undefined; let live = true; const s = new Html5Qrcode('qr-reader'); ref.current = s;
    s.start({ facingMode: 'environment' }, { fps: 8, qrbox: 220 }, (text) => { if (live) { live = false; s.stop().catch(() => {}); setOn(false); onResult(text); } }, () => {})
      .catch(() => { toast.error('Camera unavailable. Type the code instead.'); setOn(false); });
    return () => { live = false; s.isScanning && s.stop().catch(() => {}); };
  }, [on]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="stack">{on && <div id="qr-reader" style={{ width: '100%', maxWidth: 320 }} />}<button type="button" className="btn btn-secondary" onClick={() => setOn(!on)}>{on ? <><CameraOff size={16} />Stop camera</> : <><Camera size={16} />Scan QR code</>}</button></div>;
}

export const parseQr = (text) => { try { const j = JSON.parse(text); if (j?.t === 'fr-handover' && j.p && j.k) return { assignment: j.p, token: j.k }; } catch { /* not JSON */ } return { token: String(text).trim() }; };
