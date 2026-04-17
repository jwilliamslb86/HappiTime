import Link from 'next/link';
import UserBar from '@/components/layout/UserBar';
import ConfirmDeleteForm from '@/components/ConfirmDeleteForm';
import { createClient } from '@/utils/supabase/server';
import {
  cancelOrgInvite,
  createOrgInvite,
  removeMember,
  updateMemberAccess,
} from '@/actions/access-actions';

type VenueRow = {
  id: string;
  name: string;
};

type MemberRow = {
  user_id: string;
  role: string;
  email: string | null;
};

type InviteRow = {
  id: string;
  email: string;
  role: string;
  venue_ids: string[] | null;
  created_at: string;
  expires_at: string | null;
  accepted_at: string | null;
};

type AssignmentRow = {
  venue_id: string;
  user_id: string;
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid_email: 'Please enter a valid email address.',
  invalid_role: 'Please select a valid role.',
  invite_exists: 'An active invite already exists for that email.',
  invite_create_failed: 'Unable to create invite.',
  invite_email_failed: 'Unable to send invite email.',
  invite_cancel_failed: 'Unable to cancel invite.',
  member_not_found: 'Member not found.',
  member_role_update_failed: 'Unable to update member role.',
  assignments_lookup_failed: 'Unable to load assignments.',
  assignments_add_failed: 'Unable to assign venues.',
  assignments_remove_failed: 'Unable to remove venue assignments.',
  member_delete_failed: 'Unable to remove member.',
  member_assignments_delete_failed: 'Unable to remove member assignments.',
  cannot_edit_self: 'You cannot edit your own role here.',
  cannot_remove_self: 'You cannot remove yourself.',
  cannot_edit_owner: 'Owner role cannot be edited.',
  cannot_remove_owner: 'Owner cannot be removed.',
  invalid_venues: 'One or more venues were invalid.',
  venue_lookup_failed: 'Unable to validate venues.',
  missing_service_role_key: 'Missing server credentials for invitations.',
  invalid_service_role_key: 'Invalid server credentials for invitations. Check SUPABASE_SERVICE_ROLE_KEY.',
};

export default async function OrgAccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ error?: string; error_detail?: string }>;
}) {
  const { orgId } = await params;
  const sp = await searchParams;
  const pageError = sp?.error;
  const errorDetail = process.env.NODE_ENV === 'development' ? sp?.error_detail : null;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    return (
      <main className="container">
        <p>Not authenticated.</p>
      </main>
    );
  }

  const { data: membership } = await supabase
    .from('org_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .maybeSingle();

  const isOwner = String(membership?.role ?? '') === 'owner';

  if (!isOwner) {
    return (
      <main className="container">
        <div className="col" style={{ gap: 16 }}>
          <UserBar />
          <div className="card error">
            <strong>Not authorized</strong>
            <div className="muted">Only organization owners can manage access.</div>
          </div>
          <Link href={`/orgs/${orgId}`}>
            <button className="secondary">Back to organization</button>
          </Link>
        </div>
      </main>
    );
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('id,name')
    .eq('id', orgId)
    .maybeSingle();

  const { data: venues } = await supabase
    .from('venues')
    .select('id,name')
    .eq('org_id', orgId)
    .order('name', { ascending: true });

  const { data: members } = await supabase
    .from('org_members')
    .select('user_id,role,email')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true });

  const { data: assignments } = await supabase
    .from('venue_members')
    .select('venue_id,user_id')
    .eq('org_id', orgId);

  const { data: invites } = await supabase
    .from('org_invites')
    .select('id,email,role,venue_ids,created_at,expires_at,accepted_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  const venueRows = (venues as VenueRow[] | null) ?? [];
  const memberRows = (members as MemberRow[] | null) ?? [];
  const inviteRows = (invites as InviteRow[] | null)?.filter((i) => !i.accepted_at) ?? [];
  const assignmentRows = (assignments as AssignmentRow[] | null) ?? [];

  const venueNameById = new Map(venueRows.map((v) => [v.id, v.name]));
  const assignmentsByUser = new Map<string, string[]>();
  for (const row of assignmentRows) {
    const list = assignmentsByUser.get(row.user_id) ?? [];
    list.push(String(row.venue_id));
    assignmentsByUser.set(row.user_id, list);
  }

  const errorMessage = pageError ? ERROR_MESSAGES[pageError] ?? pageError : null;

  return (
    <main className="container">
      <div className="col" style={{ gap: 16 }}>
        <UserBar />

        <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
          <div className="col" style={{ gap: 4 }}>
            <h2 style={{ marginBottom: 0 }}>{org?.name ?? 'Organization'}</h2>
            <div className="muted">Manage staff invitations and access.</div>
          </div>
          <Link href={`/orgs/${orgId}`}>
            <button className="secondary">Back to org</button>
          </Link>
        </div>

        {errorMessage ? (
          <div className="card error">
            <strong>Action failed</strong>
            <div className="muted">{errorMessage}</div>
            {errorDetail ? <div className="muted">Details: {errorDetail}</div> : null}
          </div>
        ) : null}

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Invite staff</h3>
          <form className="col" style={{ gap: 10 }}>
            <label>
              Email
              <input name="email" type="email" placeholder="user@example.com" required />
            </label>
            <label>
              Role
              <select name="role" defaultValue="manager">
                <option value="manager">Manager</option>
                <option value="host">Host</option>
              </select>
            </label>
            <div className="col" style={{ gap: 6 }}>
              <strong>Assign venues</strong>
              {venueRows.length ? (
                venueRows.map((venue) => (
                  <label key={venue.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" name="venue_ids" value={venue.id} />
                    <span>{venue.name}</span>
                  </label>
                ))
              ) : (
                <div className="muted">No venues yet. You can add venues first.</div>
              )}
              <span className="muted" style={{ fontSize: 12 }}>
                You can update assignments later.
              </span>
            </div>
            <button formAction={createOrgInvite.bind(null, orgId)}>Send invite</button>
          </form>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Pending invites</h3>
          {inviteRows.length ? (
            <div className="col" style={{ gap: 12 }}>
              {inviteRows.map((invite) => {
                const venuesForInvite =
                  invite.venue_ids?.map((id) => venueNameById.get(id) ?? id).filter(Boolean) ?? [];
                return (
                  <div key={invite.id} className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
                    <div className="col" style={{ gap: 4 }}>
                      <strong>{invite.email}</strong>
                      <span className="muted">Role: {invite.role}</span>
                      <span className="muted">
                        Venues: {venuesForInvite.length ? venuesForInvite.join(', ') : 'None assigned'}
                      </span>
                    </div>
                    <ConfirmDeleteForm
                      action={cancelOrgInvite.bind(null, orgId, invite.id)}
                      message="Cancel this invite?"
                    >
                      <button className="secondary" type="submit">
                        Cancel
                      </button>
                    </ConfirmDeleteForm>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="muted">No pending invites.</p>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Current members</h3>
          {memberRows.length ? (
            <div className="col" style={{ gap: 16 }}>
              {memberRows.map((member) => {
                const label = member.email ?? member.user_id;
                const assignedVenueIds = assignmentsByUser.get(member.user_id) ?? [];
                const isMemberOwner = member.role === 'owner';
                const normalizedRole =
                  member.role === 'host' || member.role === 'viewer' ? 'host' : 'manager';

                return (
                  <div key={member.user_id} className="card" >
                    <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
                      <div className="col" style={{ gap: 4 }}>
                        <strong>{label}</strong>
                        <span className="muted">Role: {member.role}</span>
                      </div>
                      {isMemberOwner ? null : (
                        <ConfirmDeleteForm
                          action={removeMember.bind(null, orgId, member.user_id)}
                          message="Remove this member and revoke access?"
                        >
                          <button className="secondary" type="submit">
                            Remove
                          </button>
                        </ConfirmDeleteForm>
                      )}
                    </div>

                    {isMemberOwner ? (
                      <p className="muted" style={{ marginTop: 10 }}>
                        Owners have full access to all venues.
                      </p>
                    ) : (
                      <form className="col" style={{ gap: 10, marginTop: 12 }}>
                        <label>
                          Role
                          <select name="role" defaultValue={normalizedRole}>
                            <option value="manager">Manager</option>
                            <option value="host">Host</option>
                          </select>
                        </label>
                        <div className="col" style={{ gap: 6 }}>
                          <strong>Assigned venues</strong>
                          {venueRows.length ? (
                            venueRows.map((venue) => (
                              <label key={venue.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input
                                  type="checkbox"
                                  name="venue_ids"
                                  value={venue.id}
                                  defaultChecked={assignedVenueIds.includes(venue.id)}
                                />
                                <span>{venue.name}</span>
                              </label>
                            ))
                          ) : (
                            <div className="muted">No venues yet.</div>
                          )}
                        </div>
                        <button
                          className="secondary"
                          formAction={updateMemberAccess.bind(null, orgId, member.user_id)}
                        >
                          Save access
                        </button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="muted">No members yet.</p>
          )}
        </div>
      </div>
    </main>
  );
}
