import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { resetCsrf, setUnauthorizedHandler } from '../services/api.js';
import { connectSocket, disconnectSocket } from '../services/socket.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try { const { data } = await api.get('/auth/me'); setUser(data.data.user); setOrganization(data.data.organization); return data.data.user; }
    catch { setUser(null); setOrganization(null); return null; }
  }, []);

  useEffect(() => { refresh().finally(() => setLoading(false)); }, [refresh]);
  useEffect(() => { setUnauthorizedHandler(() => { setUser(null); disconnectSocket(); }); }, []);
  useEffect(() => { if (user) connectSocket(); else disconnectSocket(); }, [user?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (body) => { const { data } = await api.post('/auth/login', body); setUser(data.data.user); await refresh(); return data.data.user; };
  const register = async (body) => { const { data } = await api.post('/auth/register', body); setUser(data.data.user); await refresh(); return data; };
  const logout = async () => { try { await api.post('/auth/logout'); } finally { setUser(null); setOrganization(null); resetCsrf(); disconnectSocket(); } };

  const value = useMemo(() => ({ user, organization, loading, login, register, logout, refresh, setUser }), [user, organization, loading, refresh]); // eslint-disable-line react-hooks/exhaustive-deps
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
