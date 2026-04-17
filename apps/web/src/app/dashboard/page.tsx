import Link from 'next/link';
import { redirect } from 'next/navigation';
import UserBar from '@/components/layout/UserBar';
import { createClient } from '@/utils/supabase/server';
import { createOrganization, deleteOrganization, updateOrganization } from '../../actions/dashboard-actions';
import ConfirmDeleteForm from '@/components/ConfirmDeleteForm';

type MembershipRow = {
  role: string;
  organizations: { id: string; name: string; slug: string }[];
};

export default async function DashboardPage({
  searchParams,
}: {
  // Next.js 15 passes searchParams as a Promise
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const pageError = sp?.error;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  // Middleware should have redirected, but keep it defensive
  if (!user) {
    redirect('/login');
  }

  const { data, error } = await supabase
    .from("org_members")
    .select("role, organizations:organizations ( id, name, slug )")
    .eq("user_id", user.id);


  const memberships: MembershipRow[] = (data ?? []).map((m) => ({
    role: String(m.role),
    organizations: Array.isArray(m.organizations)
      ? m.organizations.map((org) => ({
          id: String(org.id),
          name: String(org.name),
          slug: String(org.slug ?? ''),
        }))
      : [],
  }));

  const orgMemberships =
    (data ?? [])
      .filter((m: any) => m.organizations)
      .map((m: any) => ({
        id: String(m.organizations.id),
        name: String(m.organizations.name),
        slug: String(m.organizations.slug ?? ''),
        role: String(m.role),
      }));

  return (
    <main className="container">
      <div className="col" style={{ gap: 16 }}>
        <UserBar />

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ marginBottom: 0 }}>Dashboard</h2>
            <div className="muted">Organizations you have access to.</div>
          </div>
        </div>

        {pageError ? (
          <div className="card error">
            <strong>Something went wrong</strong>
            <div className="muted">{pageError}</div>
          </div>
        ) : null}

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Create an organization (multi-location group)</h3>
          <form className="row">
            <input name="name" placeholder="e.g., The Smith Group" required />
            <button formAction={createOrganization}>Create</button>
          </form>
          <p className="muted" style={{ marginBottom: 0 }}>
            An organization can contain multiple venues/locations and shared staff access.
          </p>
        </div>

        <div className="col" style={{ gap: 12 }}>
          {error ? (
            <div className="card error">
              <strong>DB error</strong>
              <div className="muted">{error.message}</div>
            </div>
          ) : null}

          {orgMemberships.length === 0 ? (
            <p className="muted">No organizations yet. Create one above.</p>
          ) : (
            orgMemberships.map((m) => (
              <div key={m.id} className="card">
                <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
                  <div className="col" style={{ gap: 4 }}>
                    <strong>{m.name}</strong>
                    <span className="muted">Role: {m.role}</span>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <Link href={`/orgs/${m.id}`}>
                      <button className="secondary">Edit</button>
                    </Link>
                    {m.role === 'owner' ? (
                      <ConfirmDeleteForm
                        action={deleteOrganization.bind(null, m.id)}
                        message="This will permanently delete all data for this organization. Continue?"
                      >
                        <button className="secondary" type="submit">
                          Delete
                        </button>
                      </ConfirmDeleteForm>
                    ) : null}
                  </div>
                </div>

                {m.role === 'owner' ? (
                  <form className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <input name="name" defaultValue={m.name} placeholder="Organization name" required />
                    <input name="slug" defaultValue={m.slug} placeholder="Slug (optional)" />
                    <button className="secondary" formAction={updateOrganization.bind(null, m.id)}>
                      Save
                    </button>
                  </form>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
