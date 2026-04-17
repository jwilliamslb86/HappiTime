import Link from 'next/link';
import UserBar from '@/components/layout/UserBar';
import { createClient } from '@/utils/supabase/server';
import { createVenue } from '../../actions/organization-actions';

type VenueRow = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
};

export default async function OrgPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { orgId } = await params;
  const sp = await searchParams;
  const pageError = sp?.error;
  const supabase = await createClient();

  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('id,name')
    .eq('id', orgId)
    .single();

  const { data: venues, error: venuesErr } = await supabase
    .from('venues')
    .select('id,name,city,state')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  return (
    <main className="container">
      <div className="col" style={{ gap: 16 }}>
        <UserBar />

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="col" style={{ gap: 4 }}>
            <h2 style={{ marginBottom: 0 }}>
              {orgErr ? 'Organization' : org?.name}
            </h2>
            <div className="muted">Manage locations (venues) and staff access.</div>
          </div>
          <Link href="/dashboard">
            <button className="secondary">Back</button>
          </Link>
        </div>

        {pageError ? (
          <div className="card error">
            <strong>Error</strong>
            <div className="muted">{pageError}</div>
          </div>
        ) : null}

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Add a venue/location</h3>
          <form className="col" style={{ gap: 10 }}>
            <label>
              Venue name
              <input name="name" placeholder="e.g., Smith's Taproom" required />
            </label>
            <div className="row">
              <input name="address" placeholder="Street address (required)" required />
              <input name="city" placeholder="City (required)" required />
            </div>
            <div className="row">
              <input name="state" placeholder="State (required)" required />
              <input name="zip" placeholder="ZIP (required)" required />
            </div>
            <label>
              Timezone
              <input name="timezone" defaultValue="America/Chicago" />
            </label>
            <button formAction={createVenue.bind(null, orgId)}>Create venue</button>
          </form>
        </div>

        <div className="col" style={{ gap: 12 }}>
          <h3 style={{ marginBottom: 0 }}>Venues</h3>
          {venuesErr ? (
            <div className="card error">
              <strong>DB error</strong>
              <div className="muted">{venuesErr.message}</div>
            </div>
          ) : null}

          {(venues as VenueRow[] | null)?.length ? (
            (venues as VenueRow[]).map((v) => (
              <Link key={v.id} href={`/orgs/${orgId}/venues/${v.id}`}>
                <div className="card">
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <div className="col" style={{ gap: 4 }}>
                      <strong>{v.name}</strong>
                      <span className="muted">
                        {(v.city || v.state) ? `${v.city ?? ''}${v.city && v.state ? ', ' : ''}${v.state ?? ''}` : '—'}
                      </span>
                    </div>
                    <button className="secondary">Manage</button>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <p className="muted">No venues yet.</p>
          )}
        </div>
      </div>
    </main>
  );
}
