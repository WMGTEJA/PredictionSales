-- Run this in your Supabase SQL Editor (https://nqxkywfmkakdkhdwivck.supabase.co)
-- Safe to run on an existing table or a fresh project.

create table if not exists public.sales_monthly_records (
  id bigserial primary key,
  source_db text not null check (source_db in ('ACC-0002', 'ACC-0006')),
  doc_type text not null,
  period text not null,              -- YYYY-MM
  item_code text not null,
  item_desc text not null default '',
  stock_group text not null default '',
  company_code text not null default '',
  company_name text not null default '',
  qty numeric not null default 0,      -- SQTY (base units)
  doc_qty numeric not null default 0,  -- QTY (document UOM)
  amount numeric not null default 0,   -- LOCALAMOUNT
  synced_at timestamptz not null default now(),
  unique (source_db, doc_type, period, item_code, company_code, company_name)
);

-- Upgrade existing table if created with the earlier schema
alter table public.sales_monthly_records
  add column if not exists doc_qty numeric not null default 0;

alter table public.sales_monthly_records
  drop constraint if exists sales_monthly_records_doc_type_check;

alter table public.sales_monthly_records
  add constraint sales_monthly_records_doc_type_check
  check (doc_type in ('SO', 'SI', 'IV', 'DO', 'CS', 'CN', 'DN'));

create index if not exists idx_sales_monthly_source_type_period
  on public.sales_monthly_records (source_db, doc_type, period);

alter table public.sales_monthly_records enable row level security;

drop policy if exists "Allow public read access" on public.sales_monthly_records;
create policy "Allow public read access"
  on public.sales_monthly_records
  for select
  using (true);
