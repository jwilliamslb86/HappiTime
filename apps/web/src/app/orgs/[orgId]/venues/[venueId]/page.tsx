import Link from 'next/link';
import UserBar from '@/components/layout/UserBar';
import VenueMediaUploader from '@/components/VenueMediaUploader';
import { createClient } from '@/utils/supabase/server';
import {
  updateVenue,
  addHappyHour,
  updateHappyHour,
  deleteHappyHour,
  publishHappyHour,
  unpublishHappyHour,
  updateHappyHourMenus,
  createMenu,
  updateMenu,
  deleteMenu,
  publishMenu,
  unpublishMenu,
  createSection,
  updateSection,
  deleteSection,
  createItem,
  updateItem,
  deleteItem,
} from '../../../../../actions/venue-actions';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const HH_STATUS_PUBLISHED = 'published'; // UI check (must match actions.ts + DB constraint)

type Venue = {
  id: string;
  org_id: string;
  name: string;
  app_name_preference?: 'org' | 'venue' | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  timezone: string | null;
};

type HappyHourWindow = {
  id: string;
  dow: number[];                 // ✅ ARRAY
  start_time: string;
  end_time: string;
  timezone: string;
  status: string;
  label: string | null;
};

type HappyHourWindowMenu = {
  happy_hour_window_id: string;
  menu_id: string;
};

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  is_happy_hour?: boolean;
  sort_order: number;
};

type MenuSection = {
  id: string;
  name: string;
  sort_order: number;
  menu_items: MenuItem[] | null;
};

type Menu = {
  id: string;
  name: string;
  status?: string;
  is_active: boolean;
  menu_sections: MenuSection[] | null;
};

type EventCount = {
  event_type: string;
  cnt: number;
};

function timeForInput(t: string) {
  // "HH:MM:SS" -> "HH:MM"
  if (!t) return '';
  return t.length >= 5 ? t.slice(0, 5) : t;
}

function formatDays(days: number[]) {
  const labels = (days ?? []).map((d) => DOW[d] ?? String(d));
  return labels.length ? labels.join(', ') : '—';
}

interface Coordinates {
  lat: number;
  lon: number;
}

function distanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (x: number): number => (x * Math.PI) / 180;
  const R = 3958.8; // miles

  return (
    R *
    Math.acos(
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.cos(toRad(lon2) - toRad(lon1)) +
        Math.sin(toRad(lat1)) * Math.sin(toRad(lat2))
    )
  );
}

export default async function VenuePage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; venueId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { orgId, venueId } = await params;
  const sp = await searchParams;
  const pageError = sp?.error;

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

  const role = String(membership?.role ?? '');
  const isOwner = role === 'owner';
  const isManager = role === 'manager' || role === 'admin' || role === 'editor';
  const isHost = role === 'host';
  const canManageVenue = isOwner || isManager;
  const canEditMenuItems = canManageVenue || isHost;

  const { data: venue, error: venueErr } = await supabase
    .from('venues')
    .select('id,org_id,name,address,city,state,zip,timezone,app_name_preference')
    .eq('id', venueId)
    .eq('org_id', orgId)
    .single();

  // ✅ happy_hour_windows has venue_id but may not have org_id
  const { data: happyHours, error: hhErr } = await supabase
    .from('happy_hour_windows')
    .select('id,dow,start_time,end_time,timezone,status,label')
    .eq('venue_id', venueId)
    .order('start_time', { ascending: true });

  // ✅ FIXED: full select string + correct sort_order column names
  const { data: menus, error: menusErr } = await supabase
    .from('menus')
    .select(
      'id,name,status,is_active,menu_sections(id,name,sort_order,menu_items(id,name,description,price,is_happy_hour,sort_order))'
    )
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false });

  const happyHourIds = (happyHours as HappyHourWindow[] | null)?.map((h) => h.id) ?? [];
  let windowMenus: HappyHourWindowMenu[] = [];
  let windowMenusErr: { message: string } | null = null;

  if (happyHourIds.length) {
    const { data: hhMenus, error: hhMenusErr } = await supabase
      .from('happy_hour_window_menus')
      .select('happy_hour_window_id,menu_id')
      .in('happy_hour_window_id', happyHourIds);

    windowMenus = (hhMenus as HappyHourWindowMenu[] | null) ?? [];
    windowMenusErr = hhMenusErr;
  }

  const { data: eventCounts } = await supabase
    .from('venue_event_counts')
    .select('event_type,cnt')
    .eq('org_id', orgId)
    .eq('venue_id', venueId)
    .order('cnt', { ascending: false })
    .limit(20);

  const v = venue as Venue | null;
  const menuList = (menus as Menu[] | null) ?? [];
  const menuSelections = new Map<string, Set<string>>();

  for (const link of windowMenus) {
    if (!menuSelections.has(link.happy_hour_window_id)) {
      menuSelections.set(link.happy_hour_window_id, new Set());
    }
    menuSelections.get(link.happy_hour_window_id)?.add(link.menu_id);
  }
  const previewHref = `/app-preview/orgs/${orgId}/venues/${venueId}`;

  return (
    <main className="container">
      <div className="col" style={{ gap: 16 }}>
        <UserBar />

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="col" style={{ gap: 4 }}>
            <h2 style={{ marginBottom: 0 }}>{v?.name ?? 'Venue'}</h2>
            <div className="muted">
              {v?.city || v?.state ? `${v?.city ?? ''}${v?.city && v?.state ? ', ' : ''}${v?.state ?? ''}` : '—'}
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <Link href={previewHref} target="_blank" rel="noopener noreferrer">
              <button className="secondary">Preview in App</button>
            </Link>
            <Link href={`/orgs/${orgId}`}>
              <button className="secondary">Back to org</button>
            </Link>
          </div>
        </div>

        {pageError ? (
          <div className="card error">
            <strong>Error</strong>
            <div className="muted">{pageError}</div>
          </div>
        ) : null}

        {venueErr ? (
          <div className="card error">
            <strong>Venue load error</strong>
            <div className="muted">{venueErr.message}</div>
          </div>
        ) : null}

        {hhErr ? (
          <div className="card error">
            <strong>Happy hour load error</strong>
            <div className="muted">{hhErr.message}</div>
          </div>
        ) : null}

        {menusErr ? (
          <div className="card error">
            <strong>Menus load error</strong>
            <div className="muted">{menusErr.message}</div>
          </div>
        ) : null}

        {windowMenusErr ? (
          <div className="card error">
            <strong>Happy hour menu mapping load error</strong>
            <div className="muted">{windowMenusErr.message}</div>
          </div>
        ) : null}

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Venue info</h3>
          <form className="col" style={{ gap: 10 }}>
            <label>
              Name
              <input name="name" defaultValue={v?.name ?? ''} required readOnly={!canManageVenue} />
            </label>
            <label>
              App display name
              <select
                name="app_name_preference"
                defaultValue={v?.app_name_preference ?? 'org'}
                disabled={!canManageVenue}
              >
                <option value="org">Organization name (default)</option>
                <option value="venue">Venue/location name</option>
              </select>
              <span className="muted" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                Defaults to the organization name in the consumer app.
              </span>
            </label>
            <div className="row">
              <input
                name="address"
                placeholder="Address"
                defaultValue={v?.address ?? ''}
                readOnly={!canManageVenue}
              />
              <input
                name="city"
                placeholder="City"
                defaultValue={v?.city ?? ''}
                readOnly={!canManageVenue}
              />
            </div>
            <div className="row">
              <input
                name="state"
                placeholder="State"
                defaultValue={v?.state ?? ''}
                readOnly={!canManageVenue}
              />
              <input
                name="zip"
                placeholder="ZIP"
                defaultValue={v?.zip ?? ''}
                readOnly={!canManageVenue}
              />
            </div>
            <label>
              Timezone
              <input
                name="timezone"
                defaultValue={v?.timezone ?? 'America/Chicago'}
                readOnly={!canManageVenue}
              />
            </label>
            {canManageVenue ? (
              <button formAction={updateVenue.bind(null, orgId, venueId)}>Save changes</button>
            ) : (
              <span className="muted" style={{ fontSize: 12 }}>
                You can view venue details, but editing requires manager access.
              </span>
            )}
          </form>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Happy hour times</h3>

          {(happyHours as HappyHourWindow[] | null)?.length ? (
            <div className="col" style={{ gap: 10 }}>
              {(happyHours as HappyHourWindow[]).map((h) => {
                const isPublished = (h.status ?? '').toLowerCase() === HH_STATUS_PUBLISHED;
                const selectedMenus = menuSelections.get(h.id) ?? new Set<string>();

                return (
                  <div key={h.id} className="card" style={{ background: 'var(--surface)' }}>
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div className="col" style={{ gap: 4 }}>
                        <strong>{formatDays(h.dow)}</strong>
                        <span>
                          {timeForInput(h.start_time)} - {timeForInput(h.end_time)}
                          {h.label ? <span className="muted"> ({h.label})</span> : null}
                        </span>
                        <span className="muted">
                          Status: <strong>{isPublished ? 'Published' : 'Draft'}</strong>
                        </span>
                      </div>

                      {canManageVenue ? (
                        <form className="row" style={{ gap: 8 }}>
                          <input type="hidden" name="hh_id" value={h.id} />
                          {isPublished ? (
                            <button className="secondary" formAction={unpublishHappyHour.bind(null, orgId, venueId)}>
                              Unpublish
                            </button>
                          ) : (
                            <button className="secondary" formAction={publishHappyHour.bind(null, orgId, venueId)}>
                              Publish
                            </button>
                          )}
                        </form>
                      ) : null}
                    </div>

                    {canManageVenue ? (
                      <>
                        <hr style={{ margin: '12px 0' }} />

                        {/* ? Editable (even if published) */}
                        <form className="col" style={{ gap: 10 }}>
                          <input type="hidden" name="hh_id" value={h.id} />

                          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
                            <div className="col" style={{ gap: 6 }}>
                              <div className="muted">Days</div>
                              <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                                {DOW.map((d, i) => (
                                  <label key={d} className="row" style={{ gap: 6, alignItems: 'center' }}>
                                    <input
                                      type="checkbox"
                                      name="dow"
                                      value={i}
                                      defaultChecked={(h.dow ?? []).includes(i)}
                                    />
                                    <span>{d}</span>
                                  </label>
                                ))}
                              </div>
                            </div>

                            <label style={{ width: 170 }}>
                              Start
                              <input name="start_time" type="time" defaultValue={timeForInput(h.start_time)} required />
                            </label>

                            <label style={{ width: 170 }}>
                              End
                              <input name="end_time" type="time" defaultValue={timeForInput(h.end_time)} required />
                            </label>

                            <label style={{ flex: 1, minWidth: 220 }}>
                              Label (optional)
                              <input name="label" defaultValue={h.label ?? ''} placeholder="e.g., Late night, Brunch" />
                            </label>
                          </div>

                          <div className="row" style={{ gap: 8 }}>
                            <button className="secondary" formAction={updateHappyHour.bind(null, orgId, venueId)}>
                              Save
                            </button>
                            <button className="secondary" formAction={deleteHappyHour.bind(null, orgId, venueId)}>
                              Delete
                            </button>
                          </div>
                        </form>

                        <hr style={{ margin: '12px 0' }} />

                        <div className="col" style={{ gap: 8 }}>
                          <strong>Menus available in this window</strong>
                          {menuList.length ? (
                            <form className="col" style={{ gap: 8 }}>
                              <input type="hidden" name="hh_id" value={h.id} />
                              <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                                {menuList.map((menu) => (
                                  <label key={menu.id} className="row" style={{ gap: 6, alignItems: 'center' }}>
                                    <input
                                      type="checkbox"
                                      name="menu_ids"
                                      value={menu.id}
                                      defaultChecked={selectedMenus.has(menu.id)}
                                    />
                                    <span>{menu.name}</span>
                                  </label>
                                ))}
                              </div>
                              <button className="secondary" formAction={updateHappyHourMenus.bind(null, orgId, venueId)}>
                                Save menus
                              </button>
                            </form>
                          ) : (
                            <span className="muted">Create a menu to attach it to this window.</span>
                          )}
                        </div>
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="muted">No happy hour times yet.</p>
          )}

          {canManageVenue ? (
            <>
              <hr />

              {/* ? Create new window (multi-day) */}
              <form className="col" style={{ gap: 10 }}>
                <div className="muted">Create a new window (can cover multiple days)</div>

                <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                  <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                    {DOW.map((d, i) => (
                      <label key={d} className="row" style={{ gap: 6, alignItems: 'center' }}>
                        <input type="checkbox" name="dow" value={i} defaultChecked={i === 1} />
                        <span>{d}</span>
                      </label>
                    ))}
                  </div>

                  <label style={{ width: 170 }}>
                    Start
                    <input name="start_time" type="time" required />
                  </label>

                  <label style={{ width: 170 }}>
                    End
                    <input name="end_time" type="time" required />
                  </label>

                  <label style={{ flex: 1, minWidth: 220 }}>
                    Label (optional)
                    <input name="label" placeholder="e.g., Late night, Brunch" />
                  </label>
                </div>

                <button formAction={addHappyHour.bind(null, orgId, venueId)}>Add (Draft)</button>
              </form>
            </>
          ) : null}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Menus (structured)</h3>

          {canManageVenue ? (
            <form className="row" style={{ marginBottom: 12 }}>
              <input name="menu_name" placeholder="New menu name (e.g., Happy Hour Drinks)" required />
              <button formAction={createMenu.bind(null, orgId, venueId)}>Create menu</button>
            </form>
          ) : null}

          {(menus as Menu[] | null)?.length ? (
            <div className="col" style={{ gap: 12 }}>
              {(menus as Menu[]).map((m) => (
                <div key={m.id} className="card" style={{ background: 'var(--surface)' }}>
                  {/* Menu edit/delete */}
                  {canManageVenue ? (
                    <form className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
                      <input type="hidden" name="menu_id" value={m.id} />

                      <div className="col" style={{ gap: 6, flex: 1 }}>
                        <input name="menu_name" defaultValue={m.name} required />
                        <label className="row" style={{ gap: 8, alignItems: 'center' }}>
                          <input type="checkbox" name="menu_is_active" defaultChecked={m.is_active} />
                          <span className="muted">Active</span>
                        </label>
                      </div>

                      <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                        <button className="secondary" formAction={updateMenu.bind(null, orgId, venueId)}>
                          Save
                        </button>
                        <button className="secondary" formAction={deleteMenu.bind(null, orgId, venueId)}>
                          Delete
                        </button>
                      </div>
                      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                        <span className="muted">Status:</span>
                        <strong>
                          {(m.status ?? '').toLowerCase() === HH_STATUS_PUBLISHED ? 'Published' : 'Draft'}
                        </strong>
                        {(m.status ?? '').toLowerCase() === HH_STATUS_PUBLISHED ? (
                          <button className="secondary" formAction={unpublishMenu.bind(null, orgId, venueId)}>
                            Unpublish
                          </button>
                        ) : (
                          <button className="secondary" formAction={publishMenu.bind(null, orgId, venueId)}>
                            Publish
                          </button>
                        )}
                      </div>
                    </form>
                  ) : (
                    <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
                      <div className="col" style={{ gap: 6 }}>
                        <strong>{m.name}</strong>
                        <span className="muted">
                          Status: {(m.status ?? '').toLowerCase() === HH_STATUS_PUBLISHED ? 'Published' : 'Draft'}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="col" style={{ gap: 10, marginTop: 10 }}>
                    {/* Create section */}
                    {canManageVenue ? (
                      <form className="row">
                        <input type="hidden" name="menu_id" value={m.id} />
                        <input name="section_name" placeholder="New section (e.g., Cocktails)" required />
                        <button className="secondary" formAction={createSection.bind(null, orgId, venueId)}>
                          Add section
                        </button>
                      </form>
                    ) : null}

                    {(m.menu_sections ?? []).length ? (
                      (m.menu_sections ?? []).map((s) => (
                        <div key={s.id} className="card">
                          {/* Section edit/delete */}
                          {canManageVenue ? (
                            <form className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
                              <input type="hidden" name="section_id" value={s.id} />
                              <input name="section_name" defaultValue={s.name} required style={{ flex: 1 }} />
                              <div className="row" style={{ gap: 8 }}>
                                <button className="secondary" formAction={updateSection.bind(null, orgId, venueId)}>
                                  Save
                                </button>
                                <button className="secondary" formAction={deleteSection.bind(null, orgId, venueId)}>
                                  Delete
                                </button>
                              </div>
                            </form>
                          ) : (
                            <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
                              <strong>{s.name}</strong>
                            </div>
                          )}

                          <div className="col" style={{ gap: 8, marginTop: 10 }}>
                            {/* Create item */}
                            {canEditMenuItems ? (
                              <form className="col" style={{ gap: 8 }}>
                                <input type="hidden" name="section_id" value={s.id} />
                                <div className="row">
                                  <input name="item_name" placeholder="Item name" required />
                                  <input name="item_price" type="number" step="0.01" placeholder="Price (optional)" />
                                </div>
                                <textarea name="item_description" placeholder="Description (optional)" rows={2} />
                                <label className="row" style={{ gap: 8, alignItems: 'center' }}>
                                  <input type="checkbox" name="item_is_happy_hour" />
                                  <span className="muted">Happy hour item</span>
                                </label>
                                <button className="secondary" formAction={createItem.bind(null, orgId, venueId)}>
                                  Add item
                                </button>
                              </form>
                            ) : (
                              <span className="muted">Menu items are read-only for your role.</span>
                            )}

                            {(s.menu_items ?? []).length ? (
                              <div className="col" style={{ gap: 10 }}>
                                {(s.menu_items ?? []).map((it) => (
                                  <div key={it.id} className="card" >
                                    {/* Item edit/delete */}
                                    {canEditMenuItems ? (
                                      <form className="col" style={{ gap: 8 }}>
                                        <input type="hidden" name="item_id" value={it.id} />
                                        <div className="row" style={{ gap: 10 }}>
                                          <input name="item_name" defaultValue={it.name} required style={{ flex: 1 }} />
                                          <input
                                            name="item_price"
                                            type="number"
                                            step="0.01"
                                            defaultValue={it.price ?? ''}
                                            placeholder="Price"
                                            style={{ width: 160 }}
                                          />
                                        </div>
                                        <textarea
                                          name="item_description"
                                          defaultValue={it.description ?? ''}
                                          placeholder="Description (optional)"
                                          rows={2}
                                        />
                                        <label className="row" style={{ gap: 8, alignItems: 'center' }}>
                                          <input
                                            type="checkbox"
                                            name="item_is_happy_hour"
                                            defaultChecked={!!it.is_happy_hour}
                                          />
                                          <span className="muted">Happy hour item</span>
                                        </label>

                                        <div className="row" style={{ gap: 8 }}>
                                          <button className="secondary" formAction={updateItem.bind(null, orgId, venueId)}>
                                            Save
                                          </button>
                                          <button className="secondary" formAction={deleteItem.bind(null, orgId, venueId)}>
                                            Delete
                                          </button>
                                        </div>
                                      </form>
                                    ) : (
                                      <div className="col" style={{ gap: 6 }}>
                                        <strong>{it.name}</strong>
                                        <span className="muted">{it.description ?? 'No description'}</span>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="muted">No items yet.</span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <span className="muted">No sections yet.</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No menus yet.</p>
          )}
        </div>

        {canManageVenue ? (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Media (images, videos, menu PDFs)</h3>
            <VenueMediaUploader orgId={orgId} venueId={venueId} />
          </div>
        ) : null}

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Analytics (starter)</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            This reads from <code>events</code> (user app) via the <code>venue_event_counts</code> view.
          </p>

          {(eventCounts as EventCount[] | null)?.length ? (
            <div className="col" style={{ gap: 8 }}>
              {(eventCounts as EventCount[]).map((e) => (
                <div key={e.event_type} className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>{e.event_type}</strong>
                  <span className="muted">{e.cnt}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No events recorded yet.</p>
          )}
        </div>
      </div>
    </main>
  );
}
