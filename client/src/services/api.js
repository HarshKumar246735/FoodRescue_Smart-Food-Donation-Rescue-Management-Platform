import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || '/api/v1';
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined;

const api = axios.create({ baseURL: API_URL, withCredentials: true, timeout: 20000 });

// CSRF token: fetched from the API (never from localStorage) and kept in memory.
let csrf = null; let pending = null;
export const resetCsrf = () => { csrf = null; };
async function csrfToken() {
  if (csrf) return csrf;
  pending ||= axios.get(`${API_URL}/auth/csrf`, { withCredentials: true }).then((r) => (csrf = r.data.data.csrfToken)).finally(() => { pending = null; });
  return pending;
}

let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

api.interceptors.request.use(async (cfg) => {
  if (!['get', 'head', 'options'].includes((cfg.method || 'get').toLowerCase())) cfg.headers['X-CSRF-Token'] = await csrfToken();
  return cfg;
});

api.interceptors.response.use((r) => r, async (err) => {
  const status = err.response?.status; const data = err.response?.data; const cfg = err.config || {};
  if (status === 403 && /Security check/i.test(data?.message || '') && !cfg._retried) { cfg._retried = true; csrf = null; return api(cfg); }
  if (status === 401 && !String(cfg.url).startsWith('/auth/') && onUnauthorized) onUnauthorized();
  const e = new Error(data?.message || (err.code === 'ECONNABORTED' ? 'The request timed out. Check your connection and try again' : err.response ? 'Something went wrong. Please try again' : 'Cannot reach the server. Check your connection'));
  e.status = status; e.fieldErrors = Object.fromEntries((data?.errors || []).map((x) => [x.field, x.message]));
  return Promise.reject(e);
});

export const unwrap = (p) => p.then((r) => r.data);
export default api;
