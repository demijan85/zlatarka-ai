-- Data integrity hardening for daily entries.
-- If duplicate (supplier_id, date) rows exist, resolve them before adding the unique constraint.

do $$
begin
  if exists (
    select 1
    from public.daily_entries
    group by supplier_id, date
    having count(*) > 1
  ) then
    raise exception 'Cannot add unique constraint on daily_entries(supplier_id, date): duplicate rows exist';
  end if;
end
$$;

update public.daily_entries
set qty = 0
where qty is null;

alter table public.daily_entries
  alter column qty set default 0,
  alter column qty set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'daily_entries_qty_nonnegative'
      and conrelid = 'public.daily_entries'::regclass
  ) then
    alter table public.daily_entries
      add constraint daily_entries_qty_nonnegative check (qty >= 0);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'daily_entries_fat_pct_range'
      and conrelid = 'public.daily_entries'::regclass
  ) then
    alter table public.daily_entries
      add constraint daily_entries_fat_pct_range check (fat_pct is null or (fat_pct >= 0 and fat_pct <= 20));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'daily_entries_supplier_date_unique'
      and conrelid = 'public.daily_entries'::regclass
  ) then
    alter table public.daily_entries
      add constraint daily_entries_supplier_date_unique unique (supplier_id, date);
  end if;
end
$$;

