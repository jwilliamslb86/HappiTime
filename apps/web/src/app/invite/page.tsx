import Link from 'next/link';
import { createClient, createServiceClient, getServiceRoleKeyError } from '@/utils/supabase/server';
import { acceptOrgInvite, setInvitePassword } from '@/actions/access-actions';

type InviteDetails = {
  id: string;
  email: string;
  role: string;
  venue_ids: string[] | null;
  expires_at: string | null;
  accepted_at: string | null;
  org: { name: string } | null;
};

type RawInviteDetails = Omit<InviteDetails, 'org'> & {
  org: { name: string }[] | { name: string } | null;
};

const ERROR_MESSAGES: Record<string, string> = {
  missing_token: 'Missing invite token.',
  invalid_invite: 'Invite not found or already expired.',
  invite_already_used: 'This invite has already been accepted.',
  invite_expired: 'This invite has expired.',
  invite_email_mismatch: 'You are signed in with a different email address.',
  missing_service_role_key: 'Missing server credentials to look up invite.',
  invalid_service_role_key: 'Invalid server credentials to look up invite.',
  password_too_short: 'Password must be at least 8 characters.',
  password_mismatch: 'Passwords do not match.',
  password_set_failed: 'Unable to set your password.',
  invite_accept_failed: 'Unable to accept this invite.',
  invite_user_lookup_failed: 'Unable to look up your account.',
  invite_user_create_failed: 'Unable to create your account.',
  invite_password_login_failed: 'Unable to sign you in after setting a password.',
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const token = String(sp?.token ?? '').trim();
  const error = sp?.error;
  const errorMessage = error ? ERROR_MESSAGES[error] ?? error : null;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  let invite: InviteDetails | null = null;
  let inviteError: string | null = null;
  let venueNames: Record<string, string> = {};

  if (!token) {
    inviteError = 'Missing invite token.';
  } else {
    const serviceRoleError = getServiceRoleKeyError();
    if (serviceRoleError === 'missing') {
      inviteError = 'Missing server credentials to look up invite.';
    } else if (serviceRoleError === 'invalid') {
      inviteError = 'Invalid server credentials to look up invite. Check SUPABASE_SERVICE_ROLE_KEY.';
    } else {
      const admin = createServiceClient();
      const { data, error: fetchErr } = await admin
        .from('org_invites')
        .select('id,email,role,venue_ids,expires_at,accepted_at,org:organizations ( name )')
        .eq('token', token)
        .maybeSingle();

      if (fetchErr || !data) {
        inviteError = 'Invite not found.';
      } else {
        const raw = data as unknown as RawInviteDetails;
        const org = Array.isArray(raw.org) ? raw.org[0] ?? null : raw.org;
        invite = { ...raw, org };
        const venueIds = Array.isArray(invite.venue_ids) ? invite.venue_ids : [];
        if (venueIds.length) {
          const { data: venues } = await admin
            .from('venues')
            .select('id,name')
            .in('id', venueIds);
          venueNames = Object.fromEntries((venues ?? []).map((v: any) => [String(v.id), String(v.name)]));
        }
      }
    }
  }

  const venueLabels =
    invite?.venue_ids?.map((id) => venueNames[id] ?? id).filter(Boolean) ?? [];
  const inviteEmail = invite?.email ? normalizeEmail(invite.email) : '';
  const userEmail = user?.email ? normalizeEmail(user.email) : '';
  const emailMismatch = Boolean(inviteEmail && userEmail && inviteEmail !== userEmail);

  return (
    <main className="container">
      <div className="col" style={{ gap: 16 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ marginBottom: 0 }}>Invitation</h2>
          <Link href="/">
            <button className="secondary">Home</button>
          </Link>
        </div>

        {errorMessage ? (
          <div className="card error">
            <strong>Error</strong>
            <div className="muted">{errorMessage}</div>
          </div>
        ) : null}

        {inviteError ? (
          <div className="card error">
            <strong>Invite error</strong>
            <div className="muted">{inviteError}</div>
          </div>
        ) : null}

        {invite ? (
          <div className="card">
            <div className="col" style={{ gap: 6 }}>
              <strong>Organization</strong>
              <div className="muted">{invite.org?.name ?? 'Unknown org'}</div>
              <strong>Role</strong>
              <div className="muted">{invite.role}</div>
              <strong>Invited email</strong>
              <div className="muted">{invite.email}</div>
              {venueLabels.length ? (
                <>
                  <strong>Assigned venues</strong>
                  <div className="muted">{venueLabels.join(', ')}</div>
                </>
              ) : (
                <div className="muted">No venues assigned yet.</div>
              )}
              {invite.accepted_at ? (
                <div className="muted">This invite has already been accepted.</div>
              ) : null}
              {invite.expires_at ? (
                <div className="muted">Expires at {new Date(invite.expires_at).toLocaleString()}.</div>
              ) : null}
            </div>

            {invite.accepted_at ? null : emailMismatch ? (
              <div className="muted" style={{ marginTop: 12 }}>
                You are signed in as {user?.email}. Please log in as {invite.email} to accept this invite.
              </div>
            ) : user ? (
              <form style={{ marginTop: 12 }}>
                <input type="hidden" name="token" value={token} />
                <button formAction={acceptOrgInvite}>Accept invite</button>
              </form>
            ) : (
              <form className="col" style={{ gap: 10, marginTop: 12 }}>
                <input type="hidden" name="token" value={token} />
                <label>
                  Email
                  <input type="email" defaultValue={invite.email} disabled />
                </label>
                <label>
                  Create password
                  <input name="password" type="password" minLength={8} required />
                </label>
                <label>
                  Confirm password
                  <input name="password_confirm" type="password" minLength={8} required />
                </label>
                <button formAction={setInvitePassword}>Set password and accept invite</button>
                <div className="muted">
                  Already have access? <Link href="/login">Log in</Link>.
                </div>
              </form>
            )}
          </div>
        ) : null}
      </div>
    </main>
  );
}
