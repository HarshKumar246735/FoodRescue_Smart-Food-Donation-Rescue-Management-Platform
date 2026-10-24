import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { PageLoader } from '../common/ui.jsx';
import { homeFor } from './nav.js';

/** UI guard only. Every API call is authorised again on the server. */
export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth(); const loc = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <Outlet />;
}
