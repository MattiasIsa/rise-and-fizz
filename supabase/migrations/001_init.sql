-- Rise & Fizz database. Run once in Supabase (SQL editor or migrations).
-- Every row belongs to one user, and row-level security makes sure people only ever see their own.

create table if not exists public.cultures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('starter', 'scoby')),
  name text not null,
  location text not null default 'counter',
  feed_every_hours numeric not null default 12,
  born_on date,
  notes text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.culture_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  culture_id uuid not null references public.cultures on delete cascade,
  type text not null,
  at timestamptz not null default now(),
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  type text not null check (type in ('bread', 'kombucha')),
  name text not null,
  culture_id uuid references public.cultures on delete set null,
  status text not null default 'active',
  stage text,
  specs jsonb not null default '{}',
  result jsonb not null default '{}',
  rating int,
  notes text default '',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid references public.projects on delete cascade,
  culture_id uuid references public.cultures on delete cascade,
  kind text not null,
  title text not null,
  detail text default '',
  idx int not null default 0,
  due_at timestamptz not null,
  done_at timestamptz,
  skipped boolean not null default false,
  notify boolean not null default true,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists reminders_due_idx on public.reminders (due_at) where done_at is null and notified_at is null;

create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid references public.projects on delete cascade,
  at timestamptz not null default now(),
  text text not null default '',
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null default 'fact',
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists cultures_user_idx on public.cultures (user_id);
create index if not exists culture_events_user_idx on public.culture_events (user_id);
create index if not exists culture_events_culture_idx on public.culture_events (culture_id);
create index if not exists projects_user_idx on public.projects (user_id);
create index if not exists projects_culture_idx on public.projects (culture_id);
create index if not exists reminders_user_idx on public.reminders (user_id);
create index if not exists reminders_project_idx on public.reminders (project_id);
create index if not exists reminders_culture_idx on public.reminders (culture_id);
create index if not exists logs_user_idx on public.logs (user_id);
create index if not exists logs_project_idx on public.logs (project_id);
create index if not exists facts_user_idx on public.facts (user_id);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- Lets the edge functions (and only them, via the service role) read secrets kept in Vault.
create or replace function public.rf_secret(secret_name text)
returns text
language sql
security definer
set search_path = ''
as $$ select decrypted_secret from vault.decrypted_secrets where name = secret_name limit 1 $$;
revoke all on function public.rf_secret(text) from public, anon, authenticated;
grant execute on function public.rf_secret(text) to service_role;

-- Row-level security: you can only read and write your own rows.
do $$
declare t text;
begin
  foreach t in array array['cultures', 'culture_events', 'projects', 'reminders', 'logs', 'facts', 'push_subscriptions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- Live updates, so a change on your phone shows up on your laptop right away.
do $$
declare t text;
begin
  foreach t in array array['cultures', 'culture_events', 'projects', 'reminders', 'logs', 'facts'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- Private photo storage: each user gets their own folder.
insert into storage.buckets (id, name, public) values ('photos', 'photos', false) on conflict (id) do nothing;
drop policy if exists "own photos read" on storage.objects;
drop policy if exists "own photos write" on storage.objects;
drop policy if exists "own photos delete" on storage.objects;
create policy "own photos read" on storage.objects for select to authenticated using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own photos write" on storage.objects for insert to authenticated with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own photos delete" on storage.objects for delete to authenticated using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
