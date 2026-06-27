create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  share_id text not null unique,
  owner_token text not null unique,
  title text not null,
  description text default '',
  start_date date not null,
  end_date date not null,
  required_slots integer not null default 1,
  min_participants_mode text not null default 'all',
  min_participants_count integer not null default 1,
  host_rule text not null default 'host_or_staff',
  maybe_rule text not null default 'penalty',
  same_day_rule text not null default 'penalty',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  name text not null,
  role text not null default 'participant',
  preferences text[] not null default '{}',
  consecutive_preference text not null default 'none',
  comment text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id, name)
);

create table if not exists public.availability (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  date date not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(participant_id, date)
);

alter table public.sessions enable row level security;
alter table public.participants enable row level security;
alter table public.availability enable row level security;

drop policy if exists "public sessions read" on public.sessions;
drop policy if exists "public sessions insert" on public.sessions;
drop policy if exists "public sessions update" on public.sessions;
drop policy if exists "public participants read" on public.participants;
drop policy if exists "public participants insert" on public.participants;
drop policy if exists "public participants update" on public.participants;
drop policy if exists "public availability read" on public.availability;
drop policy if exists "public availability insert" on public.availability;
drop policy if exists "public availability update" on public.availability;

create policy "public sessions read" on public.sessions for select using (true);
create policy "public sessions insert" on public.sessions for insert with check (true);
create policy "public sessions update" on public.sessions for update using (true) with check (true);
create policy "public participants read" on public.participants for select using (true);
create policy "public participants insert" on public.participants for insert with check (true);
create policy "public participants update" on public.participants for update using (true) with check (true);
create policy "public availability read" on public.availability for select using (true);
create policy "public availability insert" on public.availability for insert with check (true);
create policy "public availability update" on public.availability for update using (true) with check (true);
