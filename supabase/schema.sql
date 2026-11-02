-- =============================================================================
-- Sales Forecast – Supabase Schema (Permissive RLS for Team Access)
-- Run this in Supabase: Dashboard → SQL Editor → New query → Run
-- =============================================================================

-- 1. Tables --------------------------------------------------------------------

create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  period        date not null unique,          -- e.g. 2026-07-01
  file_name     text not null,
  file_path     text,                          -- storage path
  grand_total   numeric,
  item_count    integer not null default 0,
  total_qty     numeric not null default 0,
  total_amount  numeric not null default 0,
  uploaded_by   uuid default auth.uid() references auth.users (id) on delete set null,
  uploaded_at   timestamptz not null default now()
);

create table if not exists public.report_items (
  id         bigint generated always as identity primary key,
  report_id  uuid not null references public.reports (id) on delete cascade,
  item_code  text not null,
  qty        numeric not null,
  amount     numeric not null
);

create index if not exists report_items_report_id_idx on public.report_items (report_id);
create index if not exists report_items_item_code_idx on public.report_items (item_code);

-- 2. Row Level Security: Allow both anon and authenticated with project key ----

alter table public.reports      enable row level security;
alter table public.report_items enable row level security;

drop policy if exists "Allow read reports" on public.reports;
drop policy if exists "Signed-in users manage reports" on public.reports;
create policy "Allow read reports" on public.reports
  for select to anon, authenticated using (true);

drop policy if exists "Allow insert/update/delete reports" on public.reports;
create policy "Allow insert/update/delete reports" on public.reports
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "Allow read report items" on public.report_items;
drop policy if exists "Signed-in users manage report items" on public.report_items;
create policy "Allow read report items" on public.report_items
  for select to anon, authenticated using (true);

drop policy if exists "Allow insert/update/delete report items" on public.report_items;
create policy "Allow insert/update/delete report items" on public.report_items
  for all to anon, authenticated using (true) with check (true);

-- 3. Stored Procedure to save a report atomically ------------------------------

create or replace function public.save_report(
  p_period       date,
  p_file_name    text,
  p_file_path    text,
  p_grand_total  numeric,
  p_items        jsonb
) returns text
language plpgsql
security definer -- runs with elevated privileges to guarantee atomic save
set search_path = public
as $$
declare
  v_old_path text;
  v_id       uuid;
begin
  select file_path into v_old_path from reports where period = p_period;
  delete from reports where period = p_period;

  insert into reports (period, file_name, file_path, grand_total, item_count, total_qty, total_amount)
  select p_period, p_file_name, p_file_path, p_grand_total,
         count(*),
         coalesce(sum((e ->> 'qty')::numeric), 0),
         coalesce(sum((e ->> 'amount')::numeric), 0)
  from jsonb_array_elements(p_items) as e
  returning id into v_id;

  insert into report_items (report_id, item_code, qty, amount)
  select v_id, coalesce(e ->> 'code', ''), (e ->> 'qty')::numeric, (e ->> 'amount')::numeric
  from jsonb_array_elements(p_items) as e;

  return v_old_path;
end;
$$;

-- Grant execution to both anon and authenticated users
grant execute on function public.save_report(date, text, text, numeric, jsonb) to anon, authenticated;

-- 4. Storage Bucket Setup ------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('reports', 'reports', true)
on conflict (id) do update set public = true;

drop policy if exists "Allow read reports files" on storage.objects;
drop policy if exists "Signed-in users read report files" on storage.objects;
create policy "Allow read reports files" on storage.objects
  for select to anon, authenticated using (bucket_id = 'reports');

drop policy if exists "Allow upload reports files" on storage.objects;
drop policy if exists "Signed-in users upload report files" on storage.objects;
create policy "Allow upload reports files" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'reports');

drop policy if exists "Allow delete reports files" on storage.objects;
drop policy if exists "Signed-in users delete report files" on storage.objects;
create policy "Allow delete reports files" on storage.objects
  for delete to anon, authenticated using (bucket_id = 'reports');
