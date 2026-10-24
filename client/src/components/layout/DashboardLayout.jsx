import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { Brand } from './PublicLayout.jsx';
import { NAV, ROLE_LABEL } from './nav.js';
import NotificationBell from '../notifications/NotificationBell.jsx';
import api from '../../services/api.js';
import toast from 'react-hot-toast';

export default function DashboardLayout() {
  const { user, logout } = useAuth(); const nav = useNavigate(); const { pathname } = useLocation(); const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const items = NAV[user.role] || [];
  const resend = async () => { try { await api.post('/auth/resend-verification'); toast.success('Verification email sent'); } catch (e) { toast.error(e.message); } };
  return (
    <div className={`shell ${open ? 'nav-open' : ''}`}>
      <a href="#main" className="skip-link">Skip to content</a>
      <aside className="sidebar" aria-label="Sidebar">
        <Brand to="/" />
        <nav className="side-nav" aria-label="Dashboard">
          {items.map(([to, label, Icon, end]) => <NavLink key={to} to={to} end={!!end} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}><Icon size={18} />{label}</NavLink>)}
        </nav>
        <div className="side-foot"><button className="side-link" onClick={async () => { await logout(); nav('/'); }}><LogOut size={18} />Log out</button></div>
      </aside>
      <div className="scrim" onClick={() => setOpen(false)} />
      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" aria-label="Open navigation" aria-expanded={open} onClick={() => setOpen(true)}><Menu /></button>
          <div className="grow" />
          <NotificationBell />
          <div className="user-chip"><div className="avatar" aria-hidden="true">{user.name?.[0]?.toUpperCase()}</div><div className="meta"><div className="name">{user.name}</div><div className="role">{ROLE_LABEL[user.role]}</div></div></div>
        </header>
        <main id="main" className="content">
          {!user.emailVerified && <div className="banner" role="status"><span>Verify your email to publish donations, send requests and accept pickups.</span><button className="btn btn-sm btn-secondary" onClick={resend}>Resend email</button></div>}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
