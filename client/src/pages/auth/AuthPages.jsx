
import { useEffect, useState } from 'react';

import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';

import { Building2, HandHeart, Utensils } from 'lucide-react';

import toast from 'react-hot-toast';

import api from '../../services/api.js';

import { useAuth } from '../../context/AuthContext.jsx';

import { homeFor } from '../../components/layout/nav.js';

import { Button, Field, PageLoader } from '../../components/common/ui.jsx';

const Shell = ({ title, sub, children, wide }) => (
  <div className="auth-wrap">
    <div className={`card auth-card ${wide ? 'wide' : ''} stack`}>
      <div>
        <h1>{title}</h1>

        {sub && (
          <p className="muted" style={{ margin: 0 }}>
            {sub}
          </p>
        )}
      </div>

      {children}
    </div>
  </div>
);

// Demo accounts are available only during local development.
// Set VITE_DEMO_PASSWORD in client/.env to fill the password.
const DEMO_ACCOUNTS = {
  admin: {
    label: 'Admin',
    email: 'admin@foodrescue.test',
  },
  donor: {
    label: 'Donor',
    email: 'donor@foodrescue.test',
  },
  ngo: {
    label: 'NGO',
    email: 'ngo@foodrescue.test',
  },
  volunteer: {
    label: 'Volunteer',
    email: 'volunteer@foodrescue.test',
  },
};


function DemoAccounts({ onSelect }) {
  return (
    <div className="demo-accounts">
      <h3>Demo accounts</h3>

      <p className="muted">
        Select a role to automatically fill the login form.
      </p>

      <div className="demo-account-buttons">
        {Object.entries(DEMO_ACCOUNTS).map(([role, account]) => (
          <button
            key={role}
            type="button"
            className="demo-account-button"
            onClick={() => onSelect(role)}
          >
            {account.label}
          </button>
        ))}
      </div>

      <p className="demo-account-note">
        Select an account, then click Log in.
      </p>
    </div>
  );
}



export function Login() {
  const { login, user } = useAuth();

  const nav = useNavigate();
  const loc = useLocation();

  const [f, setF] = useState({
    email: '',
    password: '',
  });

  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const fillDemoAccount = (role) => {
    const account = DEMO_ACCOUNTS[role];

    if (!account) return;

    setF({
      email: account.email,
      password: import.meta.env.VITE_DEMO_PASSWORD || '',
    });

    setErr('');

    toast.success(`${account.label} demo account selected`);
  };

  if (user) {
    return (
      <Navigate
        to={loc.state?.from || homeFor(user.role)}
        replace
      />
    );
  }

  const submit = async (e) => {
    e.preventDefault();

    if (busy) return;

    setBusy(true);
    setErr('');

    try {
      const u = await login({
        email: f.email.trim(),
        password: f.password,
      });

      nav(
        loc.state?.from || homeFor(u.role),
        { replace: true }
      );
    } catch (x) {
      setErr(x.message || 'Unable to log in. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell
      title="Welcome back"
      sub="Log in to manage donations, requests and pickups."
    >
      <form className="stack" onSubmit={submit} noValidate>
        {err && (
          <div className="form-error" role="alert">
            {err}
          </div>
        )}

        <Field label="Email" id="l-e">
          <input
            id="l-e"
            className="input"
            type="email"
            autoComplete="email"
            required
            value={f.email}
            onChange={(e) =>
              setF({ ...f, email: e.target.value })
            }
          />
        </Field>

        <Field label="Password" id="l-p">
          <input
            id="l-p"
            className="input"
            type="password"
            autoComplete="current-password"
            required
            value={f.password}
            onChange={(e) =>
              setF({ ...f, password: e.target.value })
            }
          />
        </Field>

        <div className="auth-links">
          <span />

          <Link to="/forgot-password">
            Forgot password?
          </Link>
        </div>

        <Button loading={busy} className="btn-block">
          Log in
        </Button>

        <DemoAccounts onSelect={fillDemoAccount} />

        <div className="auth-links">
          <span>
            New here? <Link to="/register">Create an account</Link>
          </span>
        </div>
      </form>
    </Shell>
  );
}

const ROLES = [
  ['donor', 'Donor', Utensils],
  ['ngo', 'NGO / charity', Building2],
  ['volunteer', 'Volunteer', HandHeart],
];

export function Register() {
  const { register, user } = useAuth();

  const nav = useNavigate();
  const [sp] = useSearchParams();

  const [f, setF] = useState({
    role: ['donor', 'ngo', 'volunteer'].includes(sp.get('role'))
      ? sp.get('role')
      : 'donor',
    name: '',
    email: '',
    password: '',
    phone: '',
    organizationName: '',
    businessName: '',
  });

  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);

  if (user) {
    return <Navigate to={homeFor(user.role)} replace />;
  }

  const set = (k) => (e) =>
    setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();

    if (busy) return;

    const local = {};

    if (f.name.trim().length < 2) {
      local.name = 'Enter your name';
    }

    if (!/^\S+@\S+\.\S+$/.test(f.email)) {
      local.email = 'Enter a valid email';
    }

    if (f.role === 'ngo' && !f.organizationName.trim()) {
      local.organizationName = 'Enter your organization’s name';
    }

    if (
      f.password.length < 10 ||
      !/[a-z]/.test(f.password) ||
      !/[A-Z]/.test(f.password) ||
      !/\d/.test(f.password)
    ) {
      local.password =
        'Use 10+ characters with upper-case, lower-case and a number';
    }

    if (Object.keys(local).length) {
      return setErrs(local);
    }

    setBusy(true);
    setErrs({});

    try {
      const body = {
        role: f.role,
        name: f.name.trim(),
        email: f.email.trim(),
        password: f.password,
        ...(f.phone && { phone: f.phone }),
        ...(f.role === 'ngo' && {
          organizationName: f.organizationName.trim(),
        }),
        ...(f.role === 'donor' &&
          f.businessName && {
            businessName: f.businessName.trim(),
          }),
      };

      const r = await register(body);

      toast.success(r.message);
      nav(homeFor(f.role), { replace: true });
    } catch (x) {
      setErrs(
        x.fieldErrors?.email || Object.keys(x.fieldErrors || {}).length
          ? x.fieldErrors
          : { form: x.message }
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell
      title="Create your account"
      sub="Join as a donor, an organization or a volunteer."
      wide
    >
      <form className="stack" onSubmit={submit} noValidate>
        {errs.form && (
          <div className="form-error" role="alert">
            {errs.form}
          </div>
        )}

        <fieldset
          style={{ border: 0, padding: 0, margin: 0 }}
        >
          <legend
            className="label"
            style={{
              fontWeight: 600,
              fontSize: '.88rem',
              marginBottom: 8,
            }}
          >
            I am a…
          </legend>

          <div className="role-pick">
            {ROLES.map(([v, t, I]) => (
              <label key={v}>
                <input
                  type="radio"
                  name="role"
                  value={v}
                  checked={f.role === v}
                  onChange={set('role')}
                />

                <I size={20} />
                {t}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="form-grid">
          <Field label="Full name" id="r-n" error={errs.name}>
            <input
              id="r-n"
              className="input"
              autoComplete="name"
              value={f.name}
              onChange={set('name')}
              aria-invalid={!!errs.name}
            />
          </Field>

          <Field label="Phone (optional)" id="r-ph">
            <input
              id="r-ph"
              className="input"
              type="tel"
              autoComplete="tel"
              value={f.phone}
              onChange={set('phone')}
            />
          </Field>

          {f.role === 'ngo' && (
            <Field
              label="Organization name"
              id="r-o"
              error={errs.organizationName}
              className="full"
            >
              <input
                id="r-o"
                className="input"
                value={f.organizationName}
                onChange={set('organizationName')}
                aria-invalid={!!errs.organizationName}
              />
            </Field>
          )}

          {f.role === 'donor' && (
            <Field
              label="Business name (optional)"
              id="r-b"
              className="full"
            >
              <input
                id="r-b"
                className="input"
                value={f.businessName}
                onChange={set('businessName')}
              />
            </Field>
          )}

          <Field
            label="Email"
            id="r-e"
            error={errs.email}
            className="full"
          >
            <input
              id="r-e"
              className="input"
              type="email"
              autoComplete="email"
              value={f.email}
              onChange={set('email')}
              aria-invalid={!!errs.email}
            />
          </Field>

          <Field
            label="Password"
            id="r-p"
            error={errs.password}
            className="full"
            hint="At least 10 characters with upper-case, lower-case and a number."
          >
            <input
              id="r-p"
              className="input"
              type="password"
              autoComplete="new-password"
              value={f.password}
              onChange={set('password')}
              aria-invalid={!!errs.password}
            />
          </Field>
        </div>

        <p className="small muted">
          By creating an account you agree to the{' '}
          <Link to="/terms">Terms</Link> and{' '}
          <Link to="/privacy">Privacy policy</Link>.
        </p>

        <Button loading={busy} className="btn-block">
          Create account
        </Button>

        <div className="auth-links">
          <span>
            Already registered? <Link to="/login">Log in</Link>
          </span>
        </div>
      </form>
    </Shell>
  );
}

export function VerifyEmail() {
  const [sp] = useSearchParams();

  const { refresh, user } = useAuth();

  const [state, setState] = useState({
    s: 'working',
    msg: '',
  });

  useEffect(() => {
    const token = sp.get('token');

    if (!token) {
      setState({
        s: 'error',
        msg: 'This link is missing its token.',
      });

      return;
    }

    let live = true;

    api
      .post('/auth/verify-email', { token })
      .then(async () => {
        if (live) {
          setState({ s: 'ok' });
          await refresh();
        }
      })
      .catch((e) => {
        if (live) {
          setState({
            s: 'error',
            msg: e.message,
          });
        }
      });

    return () => {
      live = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Shell title="Email verification">
      {state.s === 'working' ? (
        <PageLoader />
      ) : state.s === 'ok' ? (
        <>
          <p>
            Your email is verified. You can publish donations,
            send requests and accept pickups.
          </p>

          <Link
            className="btn btn-primary"
            to={user ? homeFor(user.role) : '/login'}
          >
            Continue
          </Link>
        </>
      ) : (
        <>
          <div className="form-error" role="alert">
            {state.msg}
          </div>

          <Link
            to={user ? homeFor(user.role) : '/login'}
            className="btn btn-secondary"
          >
            Back
          </Link>

          {user && (
            <p className="small muted">
              Open your dashboard and use “Resend email” to get a new link.
            </p>
          )}
        </>
      )}
    </Shell>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();

    setBusy(true);

    try {
      await api.post('/auth/forgot-password', { email });
      setDone(true);
    } catch (x) {
      toast.error(x.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell
      title="Forgot your password?"
      sub="Enter your email and we’ll send a reset link."
    >
      {done ? (
        <div role="status">
          <p>
            If that email has an account, a reset link is on its way.
            It works once and expires in 30 minutes.
          </p>

          <Link to="/login" className="btn btn-secondary">
            Back to log in
          </Link>
        </div>
      ) : (
        <form className="stack" onSubmit={submit}>
          <Field label="Email" id="f-e">
            <input
              id="f-e"
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Button loading={busy}>Send reset link</Button>
        </form>
      )}
    </Shell>
  );
}

export function ResetPassword() {
  const [sp] = useSearchParams();

  const nav = useNavigate();

  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();

    setBusy(true);
    setErr('');

    try {
      await api.post('/auth/reset-password', {
        token: sp.get('token'),
        password,
      });

      toast.success('Password updated. Log in with your new password');
      nav('/login');
    } catch (x) {
      setErr(x.fieldErrors?.password || x.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Choose a new password">
      <form className="stack" onSubmit={submit}>
        {err && (
          <div className="form-error" role="alert">
            {err}
          </div>
        )}

        <Field
          label="New password"
          id="n-p"
          hint="At least 10 characters with upper-case, lower-case and a number."
        >
          <input
            id="n-p"
            className="input"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        <Button loading={busy}>Update password</Button>
      </form>
    </Shell>
  );
}

