import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api.js';
import { getSocket } from '../../services/socket.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function NotificationBell() {
  const { user } = useAuth(); const [count, setCount] = useState(0);
  const load = useCallback(() => api.get('/notifications/unread-count').then((r) => setCount(r.data.data.unread)).catch(() => {}), []);
  useEffect(() => {
    load();
    let s = getSocket(); let tries = 0;
    const attach = () => {
      s = getSocket(); if (!s) { if (tries++ < 10) setTimeout(attach, 400); return; }
      s.on('notification', onNote); s.on('connect', load); // reconnect: re-sync the count from MongoDB, the source of truth
    };
    const onNote = (n) => { setCount((c) => c + 1); toast(n.title, { icon: '🔔' }); window.dispatchEvent(new CustomEvent('fr:notification', { detail: n })); };
    attach();
    return () => { s?.off('notification', onNote); s?.off('connect', load); };
  }, [user?._id, load]);
  return (
    <Link to="/notifications" className="icon-btn" aria-label={count ? `Notifications, ${count} unread` : 'Notifications'}>
      <Bell size={20} />{count > 0 && <span className="bell-badge">{count > 99 ? '99+' : count}</span>}
    </Link>
  );
}
