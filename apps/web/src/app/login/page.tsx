import OAuthButtons from '@/components/OAuthButtons';
import { login, signup } from '../../actions/login-actions';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const error = sp?.error;

  return (
    <main className="container">
      <div className="col" style={{ gap: 18, maxWidth: 520 }}>
        <h1 style={{ marginBottom: 0, color: 'var(--brand)' }}>HappiTime</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Manage venues, happy hour times, menus, pricing, and media.
        </p>

        {error ? (
          <div className="card error">
            <strong>Login error</strong>
            <div className="muted">Try again or use a social login.</div>
          </div>
        ) : null}

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Social login</h3>
          <OAuthButtons />
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Email + password</h3>
          <form className="col" style={{ gap: 10 }}>
            <label>
              Email
              <input name="email" type="email" required />
            </label>
            <label>
              Password
              <input name="password" type="password" minLength={8} required />
            </label>
            <div className="row">
              <button formAction={login}>Log in</button>
              <button className="secondary" formAction={signup}>Sign up</button>
            </div>
            <p className="muted" style={{ margin: 0 }}>
              For production you should enforce strong passwords and add email verification.
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
