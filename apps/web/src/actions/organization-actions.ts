'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

export async function createVenue(orgId: string, formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) redirect(`/orgs/${orgId}?error=missing_venue_name`);

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');
  const { data: membership, error: membershipErr } = await supabase
    .from('org_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (membershipErr || !membership || String(membership.role) !== 'owner') {
    redirect(`/orgs/${orgId}?error=not_org_owner`);
  }

  const payload = {
    org_id: orgId,
    name,
    address: String(formData.get('address') ?? '').trim() || null,
    city: String(formData.get('city') ?? '').trim() || null,
    state: String(formData.get('state') ?? '').trim() || null,
    zip: String(formData.get('zip') ?? '').trim() || null,
    timezone: String(formData.get('timezone') ?? '').trim() || 'America/Chicago',
  };

  const { data: venue, error } = await supabase
    .from('venues')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    console.error(error);
    redirect(`/orgs/${orgId}?error=venue_create_failed`);
  }

  revalidatePath(`/orgs/${orgId}`);
  redirect(`/orgs/${orgId}/venues/${venue!.id}`);
}

export async function deleteVenue(orgId: string, formData: FormData) {
  const venueId = String(formData.get('venue_id') ?? '').trim();
  if (!venueId) redirect(`/orgs/${orgId}?error=missing_venue_id`);

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');
  const { data: membership, error: membershipErr } = await supabase
    .from('org_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (membershipErr || !membership || String(membership.role) !== 'owner') {
    redirect(`/orgs/${orgId}?error=not_org_owner`);
  }

  const { error } = await supabase
    .from('venues')
    .delete()
    .eq('id', venueId)
    .eq('org_id', orgId);

  if (error) {
    console.error(error);
    redirect(`/orgs/${orgId}?error=venue_delete_failed`);
  }

  revalidatePath(`/orgs/${orgId}`);
}
