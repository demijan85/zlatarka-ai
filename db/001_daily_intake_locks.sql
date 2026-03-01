-- Month-level lock table for daily intake edits.
-- Locked month => all API writes for dates in that month return HTTP 423.

create table if not exists public.daily_intake_locks (
  year_month text primary key
    check (year_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  is_locked boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_daily_intake_locks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_daily_intake_locks_updated_at on public.daily_intake_locks;

create trigger trg_daily_intake_locks_updated_at
before update on public.daily_intake_locks
for each row
execute function public.set_daily_intake_locks_updated_at();
