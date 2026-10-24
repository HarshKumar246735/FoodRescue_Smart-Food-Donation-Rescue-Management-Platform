import { useState } from 'react';
import toast from 'react-hot-toast';

/** Runs an async action once at a time (blocks double submits) and toasts success/failure. */
export default function useAction() {
  const [busy, setBusy] = useState(false);
  const run = async (fn, { success, onDone } = {}) => {
    if (busy) return null; setBusy(true);
    try { const r = await fn(); if (success) toast.success(typeof success === 'function' ? success(r) : success); onDone?.(r); return r; }
    catch (e) { toast.error(e.message); return null; }
    finally { setBusy(false); }
  };
  return [run, busy];
}
