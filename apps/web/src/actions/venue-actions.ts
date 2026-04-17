'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

// DB check constraint uses different strings, change these:
const HH_STATUS_DRAFT = 'draft';
const HH_STATUS_PUBLISHED = 'published';

function toStr(v: FormDataEntryValue | null | undefined) {
  return String(v ?? '').trim();
}

function toNullableStr(v: FormDataEntryValue | null | undefined) {
  const s = toStr(v);
  return s.length ? s : null;
}

function toTimeStr(v: FormDataEntryValue | null | undefined) {
  // input[type=time] usually returns "HH:MM"
  // Postgres time can be "HH:MM:SS"
  // We store "HH:MM" or "HH:MM:SS" fine; but keep it clean:
  const s = toStr(v);
  return s;
}

function toNumberOrNull(v: FormDataEntryValue | null | undefined) {
  const s = toStr(v);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function redirectWithError(orgId: string, venueId: string, error: string): never {
  redirect(`/orgs/${orgId}/venues/${venueId}?error=${error}`);
}

function requireField(formData: FormData, key: string, orgId: string, venueId: string, error: string) {
  const value = toStr(formData.get(key));
  if (!value) redirectWithError(orgId, venueId, error);
  return value;
}

function parseDowArray(formData: FormData): number[] {
  // Supports:
  // - multiple checkboxes: formData.getAll('dow')
  // - single select: formData.get('dow')
  const all = formData.getAll('dow');
  const raw = all.length
    ? all
    : ([formData.get('dow')].filter(Boolean) as FormDataEntryValue[]);

  const days = raw
    .map((x) => Number(String(x)))
    .filter((n) => Number.isFinite(n))
    .map((n) => Math.trunc(n))
    .filter((n) => n >= 0 && n <= 6);

  // unique + stable
  return Array.from(new Set(days)).sort((a, b) => a - b);
}

async function requireAuth() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');
  return { supabase, userId: auth.user.id };
}

async function requireVenueAccess(orgId: string, venueId: string) {
  const { supabase, userId } = await requireAuth();

  const { data: membership } = await supabase
    .from('org_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!membership) redirectWithError(orgId, venueId, 'not_authorized');

  const { data: venue } = await supabase
    .from('venues')
    .select('id')
    .eq('id', venueId)
    .eq('org_id', orgId)
    .maybeSingle();

  if (!venue) redirectWithError(orgId, venueId, 'not_authorized');

  return { supabase, userId };
}

function revalidateVenue(orgId: string, venueId: string) {
  revalidatePath(`/orgs/${orgId}/venues/${venueId}`);
}

async function nextSortOrder(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  table: 'menu_sections' | 'menu_items',
  filterField: 'menu_id' | 'section_id',
  filterValue: string,
) {
  const { data: maxRow } = await supabase
    .from(table)
    .select('sort_order')
    .eq(filterField, filterValue)
    .order('sort_order', { ascending: false })
    .limit(1);

  return (maxRow?.[0]?.sort_order ?? 0) + 1;
}

export async function updateVenue(orgId: string, venueId: string, formData: FormData) {
  const { supabase } = await requireAuth();

  const patch: {
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    timezone: string;
    app_name_preference?: 'org' | 'venue';
  } = {
    name: toStr(formData.get('name')),
    address: toNullableStr(formData.get('address')),
    city: toNullableStr(formData.get('city')),
    state: toNullableStr(formData.get('state')),
    zip: toNullableStr(formData.get('zip')),
    timezone: toNullableStr(formData.get('timezone')) ?? 'America/Chicago',
  };

  const appNamePreferenceRaw = formData.get('app_name_preference');
  if (appNamePreferenceRaw !== null) {
    const appNamePreference = toStr(appNamePreferenceRaw);
    patch.app_name_preference = appNamePreference === 'venue' ? 'venue' : 'org';
  }

  if (!patch.name) redirectWithError(orgId, venueId, 'missing_venue_name');

  const { error } = await supabase
    .from('venues')
    .update(patch)
    .eq('id', venueId)
    .eq('org_id', orgId);

  if (error) {
    console.error(error);
    redirectWithError(orgId, venueId, 'venue_update_failed');
  }

  revalidateVenue(orgId, venueId);
}

export async function addHappyHour(orgId: string, venueId: string, formData: FormData) {
  const { supabase } = await requireAuth();

  // Pull venue timezone (happy_hour_windows.timezone is NOT NULL in your schema)
  const { data: venue, error: vErr } = await supabase
    .from('venues')
    .select('id,org_id,timezone')
    .eq('id', venueId)
    .eq('org_id', orgId)
    .single();

  if (vErr || !venue) {
    console.error(vErr);
    redirectWithError(orgId, venueId, 'venue_not_found');
  }

  const dow = parseDowArray(formData);
  const start_time = toTimeStr(formData.get('start_time'));
  const end_time = toTimeStr(formData.get('end_time'));
  const label = toNullableStr(formData.get('label'));
  const timezone = toStr(formData.get('timezone')) || venue.timezone || 'America/Chicago';

  if (!dow.length) redirectWithError(orgId, venueId, 'missing_dow');
  if (!start_time || !end_time) redirectWithError(orgId, venueId, 'missing_time');

  const { error } = await supabase.from('happy_hour_windows').insert({
    venue_id: venueId,
    dow,                // ✅ ARRAY column (supports multi-day)
    start_time,
    end_time,
    timezone,
    status: HH_STATUS_DRAFT, // ✅ starts unpublished
    label,              // ✅ optional
  });

  if (error) {
    console.error(error);
    redirectWithError(orgId, venueId, 'happyhour_create_failed');
  }

  revalidateVenue(orgId, venueId);
}

export async function updateHappyHour(orgId: string, venueId: string, formData: FormData) {
  const { supabase } = await requireAuth();

  const hh_id = requireField(formData, 'hh_id', orgId, venueId, 'missing_hh_id');

  const dow = parseDowArray(formData);
  const start_time = toTimeStr(formData.get('start_time'));
  const end_time = toTimeStr(formData.get('end_time'));
  const label = toNullableStr(formData.get('label'));

  if (!dow.length) redirectWithError(orgId, venueId, 'missing_dow');
  if (!start_time || !end_time) redirectWithError(orgId, venueId, 'missing_time');

  const { error } = await supabase
    .from('happy_hour_windows')
    .update({ dow, start_time, end_time, label })
    .eq('id', hh_id)
    .eq('venue_id', venueId);

  if (error) {
    console.error(error);
    redirectWithError(orgId, venueId, 'happyhour_update_failed');
  }

  revalidateVenue(orgId, venueId);
}

export async function deleteHappyHour(orgId: string, venueId: string, formData: FormData) {
  const { supabase } = await requireAuth();

  const hh_id = requireField(formData, 'hh_id', orgId, venueId, 'missing_hh_id');

  const { error } = await supabase
    .from('happy_hour_windows')
    .delete()
    .eq('id', hh_id)
    .eq('venue_id', venueId);

  if (error) {
    console.error(error);
    redirectWithError(orgId, venueId, 'happyhour_delete_failed');
  }

  revalidateVenue(orgId, venueId);
}

export async function publishHappyHour(orgId: string, venueId: string, formData: FormData) {
  const { supabase } = await requireAuth();
  const hh_id = requireField(formData, 'hh_id', orgId, venueId, 'missing_hh_id');

  const { error } = await supabase
    .from('happy_hour_windows')
    .update({ status: HH_STATUS_PUBLISHED })
    .eq('id', hh_id)
    .eq('venue_id', venueId);

  if (error) {
    console.error(error);
    redirectWithError(orgId, venueId, 'happyhour_publish_failed');
  }

  revalidateVenue(orgId, venueId);
}

export async function unpublishHappyHour(orgId: string, venueId: string, formData: FormData) {
  const { supabase } = await requireAuth();

  const hh_id = requireField(formData, 'hh_id', orgId, venueId, 'missing_hh_id');

  const { error } = await supabase
    .from('happy_hour_windows')
    .update({ status: HH_STATUS_DRAFT })
    .eq('id', hh_id)
    .eq('venue_id', venueId);

  if (error) {
    console.error(error);
    redirectWithError(orgId, venueId, 'happyhour_unpublish_failed');
  }

  revalidateVenue(orgId, venueId);
}

export async function updateHappyHourMenus(orgId: string, venueId: string, formData: FormData) {
  const { supabase } = await requireAuth();

  const hh_id = requireField(formData, 'hh_id', orgId, venueId, 'missing_hh_id');

  const menuIds = formData
    .getAll('menu_ids')
    .map((value) => toStr(value))
    .filter(Boolean);
  const uniqueMenuIds = Array.from(new Set(menuIds));

  const { data: window, error: windowErr } = await supabase
    .from('happy_hour_windows')
    .select('id,venue_id')
    .eq('id', hh_id)
    .eq('venue_id', venueId)
    .single();

  if (windowErr || !window) {
    console.error(windowErr);
    redirectWithError(orgId, venueId, 'happyhour_not_found');
  }

  const { error: deleteErr } = await supabase
    .from('happy_hour_window_menus')
    .delete()
    .eq('happy_hour_window_id', hh_id);

  if (deleteErr) {
    console.error(deleteErr);
    redirectWithError(orgId, venueId, 'happyhour_menus_update_failed');
  }

  if (uniqueMenuIds.length) {
    const { data: menus, error: menusErr } = await supabase
      .from('menus')
      .select('id')
      .eq('venue_id', venueId)
      .in('id', uniqueMenuIds);

    if (menusErr) {
      console.error(menusErr);
      redirectWithError(orgId, venueId, 'happyhour_menus_update_failed');
    }

    const validMenuIds = (menus ?? []).map((menu: any) => menu.id).filter(Boolean);

    if (validMenuIds.length) {
      const payload = validMenuIds.map((menu_id) => ({
        happy_hour_window_id: hh_id,
        menu_id,
      }));

      const { error: insertErr } = await supabase.from('happy_hour_window_menus').insert(payload);

      if (insertErr) {
        console.error(insertErr);
        redirectWithError(orgId, venueId, 'happyhour_menus_update_failed');
      }
    }
  }

  revalidateVenue(orgId, venueId);
}

/* ---------------------------
   MENUS / SECTIONS / ITEMS
   --------------------------- */

export async function createMenu(orgId: string, venueId: string, formData: FormData) {
  const { supabase } = await requireAuth();

  const name = requireField(formData, 'menu_name', orgId, venueId, 'missing_menu_name');

  const { error } = await supabase.from('menus').insert({
    venue_id: venueId,
    name,
    status: HH_STATUS_DRAFT, // reuse "draft" concept; OK if menus.status is free-text
    is_active: true,
  });

  if (error) {
    console.error(error);
    redirectWithError(orgId, venueId, 'menu_create_failed');
  }

  revalidateVenue(orgId, venueId);
}

export async function updateMenu(orgId: string, venueId: string, formData: FormData) {
  const { supabase } = await requireAuth();

  const menu_id = requireField(formData, 'menu_id', orgId, venueId, 'missing_menu_id');
  const name = toStr(formData.get('menu_name'));
  const is_active = formData.get('menu_is_active') === 'on';

  if (!name) redirectWithError(orgId, venueId, 'missing_menu_name');

  const { error } = await supabase
    .from('menus')
    .update({ name, is_active })
    .eq('id', menu_id)
    .eq('venue_id', venueId);

  if (error) {
    console.error(error);
    redirectWithError(orgId, venueId, 'menu_update_failed');
  }

  revalidateVenue(orgId, venueId);
}

export async function publishMenu(orgId: string, venueId: string, formData: FormData) {
  const { supabase } = await requireAuth();

  const menu_id = requireField(formData, 'menu_id', orgId, venueId, 'missing_menu_id');

  const { error } = await supabase
    .from('menus')
    .update({ status: HH_STATUS_PUBLISHED })
    .eq('id', menu_id)
    .eq('venue_id', venueId);

  if (error) {
    console.error(error);
    redirectWithError(orgId, venueId, 'menu_publish_failed');
  }

  revalidateVenue(orgId, venueId);
}

export async function unpublishMenu(orgId: string, venueId: string, formData: FormData) {
  const { supabase } = await requireAuth();

  const menu_id = requireField(formData, 'menu_id', orgId, venueId, 'missing_menu_id');

  const { error } = await supabase
    .from('menus')
    .update({ status: HH_STATUS_DRAFT })
    .eq('id', menu_id)
    .eq('venue_id', venueId);

  if (error) {
    console.error(error);
    redirectWithError(orgId, venueId, 'menu_unpublish_failed');
  }

  revalidateVenue(orgId, venueId);
}

export async function deleteMenu(orgId: string, venueId: string, formData: FormData) {
  const { supabase } = await requireAuth();

  const menu_id = requireField(formData, 'menu_id', orgId, venueId, 'missing_menu_id');

  // robust delete even if cascade isn't configured
  const { data: sections } = await supabase
    .from('menu_sections')
    .select('id')
    .eq('menu_id', menu_id);

  const sectionIds = (sections ?? []).map((s: any) => s.id).filter(Boolean);

  if (sectionIds.length) {
    await supabase.from('menu_items').delete().in('section_id', sectionIds);
  }
  await supabase.from('menu_sections').delete().eq('menu_id', menu_id);

  const { error } = await supabase
    .from('menus')
    .delete()
    .eq('id', menu_id)
    .eq('venue_id', venueId);

  if (error) {
    console.error(error);
    redirectWithError(orgId, venueId, 'menu_delete_failed');
  }

  revalidateVenue(orgId, venueId);
}

export async function createSection(orgId: string, venueId: string, formData: FormData) {
  const { supabase } = await requireAuth();

  const menu_id = requireField(formData, 'menu_id', orgId, venueId, 'missing_section_fields');
  const name = requireField(formData, 'section_name', orgId, venueId, 'missing_section_fields');
  const nextSort = await nextSortOrder(supabase, 'menu_sections', 'menu_id', menu_id);

  const { error } = await supabase.from('menu_sections').insert({
    menu_id,
    name,
    sort_order: nextSort,
  });

  if (error) {
    console.error(error);
    redirectWithError(orgId, venueId, 'section_create_failed');
  }

  revalidateVenue(orgId, venueId);
}

export async function updateSection(orgId: string, venueId: string, formData: FormData) {
  const { supabase } = await requireVenueAccess(orgId, venueId);

  const section_id = requireField(formData, 'section_id', orgId, venueId, 'missing_section_fields');
  const name = requireField(formData, 'section_name', orgId, venueId, 'missing_section_fields');

  // Verify section belongs to a menu owned by this venue
  const { data: section } = await supabase
    .from('menu_sections')
    .select('id, menus!inner(venue_id)')
    .eq('id', section_id)
    .eq('menus.venue_id', venueId)
    .maybeSingle();

  if (!section) redirectWithError(orgId, venueId, 'not_authorized');

  const { error } = await supabase
    .from('menu_sections')
    .update({ name })
    .eq('id', section_id);

  if (error) {
    console.error(error);
    redirectWithError(orgId, venueId, 'section_update_failed');
  }

  revalidateVenue(orgId, venueId);
}

export async function deleteSection(orgId: string, venueId: string, formData: FormData) {
  const { supabase } = await requireVenueAccess(orgId, venueId);

  const section_id = requireField(formData, 'section_id', orgId, venueId, 'missing_section_id');

  // Verify section belongs to a menu owned by this venue
  const { data: section } = await supabase
    .from('menu_sections')
    .select('id, menus!inner(venue_id)')
    .eq('id', section_id)
    .eq('menus.venue_id', venueId)
    .maybeSingle();

  if (!section) redirectWithError(orgId, venueId, 'not_authorized');

  await supabase.from('menu_items').delete().eq('section_id', section_id);

  const { error } = await supabase.from('menu_sections').delete().eq('id', section_id);

  if (error) {
    console.error(error);
    redirectWithError(orgId, venueId, 'section_delete_failed');
  }

  revalidateVenue(orgId, venueId);
}

export async function createItem(orgId: string, venueId: string, formData: FormData) {
  const { supabase } = await requireAuth();

  const section_id = requireField(formData, 'section_id', orgId, venueId, 'missing_item_fields');
  const name = toStr(formData.get('item_name'));
  const description = toNullableStr(formData.get('item_description'));
  const price = toNumberOrNull(formData.get('item_price'));
  const is_happy_hour = formData.get('item_is_happy_hour') === 'on';

  if (!name) redirectWithError(orgId, venueId, 'missing_item_fields');

  const nextSort = await nextSortOrder(supabase, 'menu_items', 'section_id', section_id);

  const { error } = await supabase.from('menu_items').insert({
    section_id,
    name,
    description,
    price,
    is_happy_hour,
    sort_order: nextSort,
  });

  if (error) {
    console.error(error);
    redirectWithError(orgId, venueId, 'item_create_failed');
  }

  revalidateVenue(orgId, venueId);
}

export async function updateItem(orgId: string, venueId: string, formData: FormData) {
  const { supabase } = await requireVenueAccess(orgId, venueId);

  const item_id = requireField(formData, 'item_id', orgId, venueId, 'missing_item_fields');
  const name = toStr(formData.get('item_name'));
  const description = toNullableStr(formData.get('item_description'));
  const price = toNumberOrNull(formData.get('item_price'));
  const is_happy_hour = formData.get('item_is_happy_hour') === 'on';

  if (!name) redirectWithError(orgId, venueId, 'missing_item_fields');

  // Verify item traces back to this venue via section → menu
  const { data: item } = await supabase
    .from('menu_items')
    .select('id, menu_sections!inner(menu_id, menus!inner(venue_id))')
    .eq('id', item_id)
    .eq('menu_sections.menus.venue_id', venueId)
    .maybeSingle();

  if (!item) redirectWithError(orgId, venueId, 'not_authorized');

  const { error } = await supabase
    .from('menu_items')
    .update({ name, description, price, is_happy_hour })
    .eq('id', item_id);

  if (error) {
    console.error(error);
    redirectWithError(orgId, venueId, 'item_update_failed');
  }

  revalidateVenue(orgId, venueId);
}

export async function deleteItem(orgId: string, venueId: string, formData: FormData) {
  const { supabase } = await requireVenueAccess(orgId, venueId);

  const item_id = requireField(formData, 'item_id', orgId, venueId, 'missing_item_id');

  // Verify item traces back to this venue via section → menu
  const { data: item } = await supabase
    .from('menu_items')
    .select('id, menu_sections!inner(menu_id, menus!inner(venue_id))')
    .eq('id', item_id)
    .eq('menu_sections.menus.venue_id', venueId)
    .maybeSingle();

  if (!item) redirectWithError(orgId, venueId, 'not_authorized');

  const { error } = await supabase.from('menu_items').delete().eq('id', item_id);

  if (error) {
    console.error(error);
    redirectWithError(orgId, venueId, 'item_delete_failed');
  }

  revalidateVenue(orgId, venueId);
}
