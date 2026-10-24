import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Leaf, Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { homeFor } from './nav.js';

export const Brand = ({ to = '/' }) => <Link to={to} className="brand" aria-label="FoodRescue home"><span className="brand-mark"><Leaf size={20} /></span>FoodRescue</Link>;

export default function PublicLayout() {
  const { user } = useAuth(); const [open, setOpen] = useState(false); const { pathname } = useLocation();
  const close = () => setOpen(false);
  const links = [['/browse', 'Find food'], ['/how-it-works', 'How it works'], ['/food-safety', 'Food safety'], ['/about', 'About'], ['/contact', 'Contact']];
  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <header className={`nav ${open ? 'open' : ''}`}>
        <div className="container nav-inner">
          <Brand />
          <nav className="nav-links" aria-label="Main">{links.map(([to, t]) => <NavLink key={to} to={to} onClick={close}>{t}</NavLink>)}</nav>
          <div className="nav-actions">
            {user ? <Link className="btn btn-primary" to={homeFor(user.role)} onClick={close}>Open dashboard</Link>
              : <><Link className="btn btn-ghost" to="/login" onClick={close}>Log in</Link><Link className="btn btn-primary" to="/register" onClick={close}>Sign up</Link></>}
          </div>
          <button className="icon-btn nav-toggle" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
        </div>
      </header>
      <main id="main" key={pathname}><Outlet /></main>
      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div><div className="brand" style={{ color: '#fff' }}><span className="brand-mark" style={{ background: '#134e32' }}><Leaf size={20} /></span>FoodRescue</div><p style={{ marginTop: 12, maxWidth: 320 }}>Connecting businesses with surplus food to verified organizations and volunteers. Less food waste, more smiles.</p></div>
            <div><h4>Platform</h4><ul><li><Link to="/browse">Find food</Link></li><li><Link to="/register">Donate food</Link></li><li><Link to="/how-it-works">How it works</Link></li></ul></div>
            <div><h4>Company</h4><ul><li><Link to="/about">About</Link></li><li><Link to="/contact">Contact</Link></li><li><Link to="/faq">FAQ</Link></li></ul></div>
            <div><h4>Policies</h4><ul><li><Link to="/food-safety">Food safety</Link></li><li><Link to="/privacy">Privacy policy</Link></li><li><Link to="/terms">Terms and conditions</Link></li></ul></div>
          </div>
          <div className="footer-bottom"><span>© {new Date().getFullYear()} FoodRescue. FoodRescue does not certify food as safe; donors and organizations must follow local food-safety rules.</span><span>support@foodrescue.example</span></div>
        </div>
      </footer>
    </>
  );
}
