-- Mobile user accounts: profiles, preferences, follows, lists, and saved venues.

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text unique,
  display_name text,
  avatar_url text,
  bio text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  home_city text,
  home_state text,
  home_lat double precision,
  home_lng double precision,
  max_distance_miles numeric,
  price_tier_min int,
  price_tier_max int,
  cuisines text[] not null default '{}'::text[],
  notifications_marketing boolean not null default false,
  notifications_product boolean not null default true,
  notifications_push boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_user_id),
  check (follower_id <> following_user_id)
);

create table if not exists public.user_followed_venues (
  user_id uuid not null references auth.users(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, venue_id)
);

create table if not exists public.user_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  visibility text not null default 'private'
    check (visibility in ('private','public','unlisted')),
  share_slug text,
  share_token uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.user_lists(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  sort_order int not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (list_id, venue_id)
);

create table if not exists public.user_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  venue_id uuid references public.venues(id) on delete set null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists user_follows_following_idx
  on public.user_follows (following_user_id);
create index if not exists user_follows_follower_idx
  on public.user_follows (follower_id);
create index if not exists user_followed_venues_venue_idx
  on public.user_followed_venues (venue_id);
create index if not exists user_lists_user_id_idx
  on public.user_lists (user_id);
create unique index if not exists user_lists_share_slug_key
  on public.user_lists (share_slug);
create index if not exists user_lists_visibility_idx
  on public.user_lists (visibility);
create index if not exists user_list_items_list_id_idx
  on public.user_list_items (list_id);
create index if not exists user_events_user_id_idx
  on public.user_events (user_id);

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at
before update on public.user_preferences
for each row execute function public.set_updated_at();

drop trigger if exists user_lists_set_updated_at on public.user_lists;
create trigger user_lists_set_updated_at
before update on public.user_lists
for each row execute function public.set_updated_at();

drop trigger if exists user_list_items_set_updated_at on public.user_list_items;
create trigger user_list_items_set_updated_at
before update on public.user_list_items
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id, display_name, handle, is_public)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'display_name',
      nullif(split_part(new.email, '@', 1), '')
    ),
    nullif(lower(new.raw_user_meta_data->>'handle'), ''),
    false
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.user_profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.user_follows enable row level security;
alter table public.user_followed_venues enable row level security;
alter table public.user_lists enable row level security;
alter table public.user_list_items enable row level security;
alter table public.user_events enable row level security;

drop policy if exists "user_profiles_select_owner_or_public" on public.user_profiles;
create policy "user_profiles_select_owner_or_public"
on public.user_profiles
for select
using (user_id = auth.uid() or is_public = true);

drop policy if exists "user_profiles_insert_owner" on public.user_profiles;
create policy "user_profiles_insert_owner"
on public.user_profiles
for insert
with check (user_id = auth.uid());

drop policy if exists "user_profiles_update_owner" on public.user_profiles;
create policy "user_profiles_update_owner"
on public.user_profiles
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "user_profiles_delete_owner" on public.user_profiles;
create policy "user_profiles_delete_owner"
on public.user_profiles
for delete
using (user_id = auth.uid());

drop policy if exists "user_preferences_select_owner" on public.user_preferences;
create policy "user_preferences_select_owner"
on public.user_preferences
for select
using (user_id = auth.uid());

drop policy if exists "user_preferences_insert_owner" on public.user_preferences;
create policy "user_preferences_insert_owner"
on public.user_preferences
for insert
with check (user_id = auth.uid());

drop policy if exists "user_preferences_update_owner" on public.user_preferences;
create policy "user_preferences_update_owner"
on public.user_preferences
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "user_preferences_delete_owner" on public.user_preferences;
create policy "user_preferences_delete_owner"
on public.user_preferences
for delete
using (user_id = auth.uid());

drop policy if exists "user_follows_select_related" on public.user_follows;
create policy "user_follows_select_related"
on public.user_follows
for select
using (follower_id = auth.uid() or following_user_id = auth.uid());

drop policy if exists "user_follows_insert_owner" on public.user_follows;
create policy "user_follows_insert_owner"
on public.user_follows
for insert
with check (follower_id = auth.uid() and follower_id <> following_user_id);

drop policy if exists "user_follows_delete_owner" on public.user_follows;
create policy "user_follows_delete_owner"
on public.user_follows
for delete
using (follower_id = auth.uid());

drop policy if exists "user_followed_venues_select_owner" on public.user_followed_venues;
create policy "user_followed_venues_select_owner"
on public.user_followed_venues
for select
using (user_id = auth.uid());

drop policy if exists "user_followed_venues_insert_owner" on public.user_followed_venues;
create policy "user_followed_venues_insert_owner"
on public.user_followed_venues
for insert
with check (user_id = auth.uid());

drop policy if exists "user_followed_venues_delete_owner" on public.user_followed_venues;
create policy "user_followed_venues_delete_owner"
on public.user_followed_venues
for delete
using (user_id = auth.uid());

drop policy if exists "user_lists_select_owner_or_public" on public.user_lists;
create policy "user_lists_select_owner_or_public"
on public.user_lists
for select
using (user_id = auth.uid() or visibility = 'public');

drop policy if exists "user_lists_insert_owner" on public.user_lists;
create policy "user_lists_insert_owner"
on public.user_lists
for insert
with check (user_id = auth.uid());

drop policy if exists "user_lists_update_owner" on public.user_lists;
create policy "user_lists_update_owner"
on public.user_lists
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "user_lists_delete_owner" on public.user_lists;
create policy "user_lists_delete_owner"
on public.user_lists
for delete
using (user_id = auth.uid());

drop policy if exists "user_list_items_select_owner_or_public" on public.user_list_items;
create policy "user_list_items_select_owner_or_public"
on public.user_list_items
for select
using (
  exists (
    select 1
    from public.user_lists l
    where l.id = list_id
      and (l.user_id = auth.uid() or l.visibility = 'public')
  )
);

drop policy if exists "user_list_items_insert_owner" on public.user_list_items;
create policy "user_list_items_insert_owner"
on public.user_list_items
for insert
with check (
  exists (
    select 1
    from public.user_lists l
    where l.id = list_id
      and l.user_id = auth.uid()
  )
);

drop policy if exists "user_list_items_update_owner" on public.user_list_items;
create policy "user_list_items_update_owner"
on public.user_list_items
for update
using (
  exists (
    select 1
    from public.user_lists l
    where l.id = list_id
      and l.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.user_lists l
    where l.id = list_id
      and l.user_id = auth.uid()
  )
);

drop policy if exists "user_list_items_delete_owner" on public.user_list_items;
create policy "user_list_items_delete_owner"
on public.user_list_items
for delete
using (
  exists (
    select 1
    from public.user_lists l
    where l.id = list_id
      and l.user_id = auth.uid()
  )
);

drop policy if exists "user_events_select_owner" on public.user_events;
create policy "user_events_select_owner"
on public.user_events
for select
using (user_id = auth.uid());

drop policy if exists "user_events_insert_owner" on public.user_events;
create policy "user_events_insert_owner"
on public.user_events
for insert
with check (user_id = auth.uid());

create or replace function public.get_venue_follower_user_stats(p_venue_id uuid)
returns table (user_id uuid, follower_count int)
language sql
security definer
set search_path = public
as $$
  select
    ufv.user_id,
    (
      select count(*)
      from public.user_follows f
      where f.following_user_id = ufv.user_id
    )::int as follower_count
  from public.user_followed_venues ufv
  join public.venues v on v.id = ufv.venue_id
  join public.org_members om
    on om.org_id = v.org_id
   and om.user_id = auth.uid()
  where ufv.venue_id = p_venue_id
    and om.role in ('owner','manager','viewer');
$$;

grant select, insert, update, delete on public.user_profiles to authenticated;
grant select on public.user_profiles to anon;
grant select, insert, update, delete on public.user_preferences to authenticated;
grant select, insert, delete on public.user_follows to authenticated;
grant select, insert, delete on public.user_followed_venues to authenticated;
grant select, insert, update, delete on public.user_lists to authenticated;
grant select, insert, update, delete on public.user_list_items to authenticated;
grant select, insert on public.user_events to authenticated;
grant select on public.user_lists to anon;
grant select on public.user_list_items to anon;
grant execute on function public.get_venue_follower_user_stats(uuid) to authenticated;
