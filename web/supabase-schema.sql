-- TMWRC: online database for the worker app and staff Case Desk.
-- Run this once in Supabase: Project > SQL Editor > New query > paste > Run.

-- Every SOS, help request, check-in and registration is one row.
create table if not exists public.events (
  id          uuid primary key,                       -- created on the phone, so a retry never duplicates
  created_at  timestamptz not null,                   -- when the worker pressed the button (phone time)
  received_at timestamptz not null default now(),     -- when the server received it
  worker_id   uuid not null,                          -- one id per installed app
  kind        text not null check (kind in ('register','sos','help','checkin')),
  category    text,
  message     text check (char_length(message) <= 4000),
  lat         double precision check (lat between -90 and 90),
  lng         double precision check (lng between -180 and 180),
  accuracy    real,
  loc_time    timestamptz,
  place       text,
  worker      jsonb,                                  -- snapshot of the worker's registration details
  channel     text not null default 'app' check (channel in ('app','sms')),
  status      text not null default 'new' check (status in ('new','in_progress','resolved')),
  staff_note  text
);
create index if not exists events_created_idx on public.events (created_at desc);
create index if not exists events_worker_idx  on public.events (worker_id, created_at desc);

-- Staff accounts allowed to see cases. Add a row for each staff member (see README).
create table if not exists public.staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name    text
);

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;

alter table public.events enable row level security;
alter table public.staff  enable row level security;

-- Workers (no login) may only ADD new rows. They can never read anyone's data.
drop policy if exists "workers send events" on public.events;
create policy "workers send events" on public.events
  for insert to anon, authenticated
  with check (status = 'new' and staff_note is null);

-- Only staff can read and update cases.
drop policy if exists "staff read events" on public.events;
create policy "staff read events" on public.events
  for select to authenticated using (public.is_staff());

drop policy if exists "staff update events" on public.events;
create policy "staff update events" on public.events
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "staff see own staff row" on public.staff;
create policy "staff see own staff row" on public.staff
  for select to authenticated using (user_id = auth.uid());

-- Live updates on the Case Desk when a new SOS arrives.
do $$ begin
  alter publication supabase_realtime add table public.events;
exception when duplicate_object then null; end $$;

-- ============================================================
-- Messages between the Centre (TMWRC Centre app / Case Desk) and the worker (TMWRC app)
-- ============================================================
create table if not exists public.replies (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  worker_id   uuid not null,
  event_id    uuid not null references public.events(id) on delete cascade,
  sender      text not null check (sender in ('staff','worker')),
  staff_name  text,
  body        text not null check (char_length(body) between 1 and 2000)
);
create index if not exists replies_worker_idx on public.replies (worker_id, created_at);
alter table public.replies enable row level security;

drop policy if exists "staff read replies" on public.replies;
create policy "staff read replies" on public.replies for select to authenticated using (public.is_staff());
drop policy if exists "staff send replies" on public.replies;
create policy "staff send replies" on public.replies for insert to authenticated
  with check (public.is_staff() and sender = 'staff');

-- The worker's phone holds a long random private id (worker_id). With it, the phone can read
-- ONLY the status of its own cases and the messages about them, and answer on its own cases.
create or replace function public.worker_feed(p_worker uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'events', coalesce((select json_agg(json_build_object('id', id, 'status', status, 'kind', kind, 'category', category, 'created_at', created_at) order by created_at desc)
                        from events where worker_id = p_worker and kind in ('sos','help')), '[]'::json),
    'replies', coalesce((select json_agg(json_build_object('id', id, 'created_at', created_at, 'event_id', event_id, 'sender', sender, 'staff_name', staff_name, 'body', body) order by created_at)
                        from replies where worker_id = p_worker), '[]'::json));
$$;

create or replace function public.worker_reply(p_worker uuid, p_event uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from events where id = p_event and worker_id = p_worker) then
    raise exception 'not your case';
  end if;
  insert into replies (worker_id, event_id, sender, body) values (p_worker, p_event, 'worker', left(p_body, 2000));
end $$;

revoke all on function public.worker_feed(uuid) from public;
revoke all on function public.worker_reply(uuid, uuid, text) from public;
grant execute on function public.worker_feed(uuid) to anon, authenticated;
grant execute on function public.worker_reply(uuid, uuid, text) to anon, authenticated;

do $$ begin
  alter publication supabase_realtime add table public.replies;
exception when duplicate_object then null; end $$;
