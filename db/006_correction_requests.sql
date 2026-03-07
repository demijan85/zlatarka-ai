-- Controlled correction workflow for locked months.
-- Pending request can be approved/rejected; approved request is then applied by API workflow.

create table if not exists public.correction_requests (
  id bigint generated always as identity primary key,
  year_month text not null check (year_month ~ '^\d{4}-\d{2}$'),
  supplier_id bigint not null references public.suppliers(id) on delete restrict,
  entry_date date not null,
  field_name text not null check (field_name in ('qty', 'fat_pct')),
  current_value numeric(12, 3),
  requested_value numeric(12, 3) not null,
  reason text not null check (char_length(trim(reason)) >= 3),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_by text not null,
  requested_at timestamptz not null default now(),
  reviewed_by text,
  reviewed_at timestamptz,
  review_note text,
  applied_entry_id bigint references public.daily_entries(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  check (requested_value >= 0),
  check (field_name <> 'fat_pct' or requested_value <= 20)
);

create index if not exists idx_correction_requests_year_month on public.correction_requests (year_month);
create index if not exists idx_correction_requests_status on public.correction_requests (status);
create index if not exists idx_correction_requests_supplier_date on public.correction_requests (supplier_id, entry_date);
create index if not exists idx_correction_requests_requested_at on public.correction_requests (requested_at desc);

create unique index if not exists idx_correction_requests_pending_unique
  on public.correction_requests (supplier_id, entry_date, field_name)
  where status = 'pending';

