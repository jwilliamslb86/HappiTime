create table if not exists public.user_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  expo_push_token text not null,
  device_name text,
  device_model text,
  platform text not null,
  os_name text,
  os_version text,
  app_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_push_tokens_user_token_unique
  on public.user_push_tokens (user_id, expo_push_token);

alter table public.user_push_tokens enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_push_tokens'
      and policyname = 'Users can view their push tokens'
  ) then
    create policy "Users can view their push tokens"
      on public.user_push_tokens
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_push_tokens'
      and policyname = 'Users can insert their push tokens'
  ) then
    create policy "Users can insert their push tokens"
      on public.user_push_tokens
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_push_tokens'
      and policyname = 'Users can update their push tokens'
  ) then
    create policy "Users can update their push tokens"
      on public.user_push_tokens
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_push_tokens'
      and policyname = 'Users can delete their push tokens'
  ) then
    create policy "Users can delete their push tokens"
      on public.user_push_tokens
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;
