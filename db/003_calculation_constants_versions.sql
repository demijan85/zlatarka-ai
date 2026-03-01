-- Versioned calculation constants persisted in DB.

create table if not exists public.calculation_constants_versions (
  valid_from text primary key
    check (valid_from ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  price_per_fat_pct numeric not null check (price_per_fat_pct >= 0),
  tax_percentage numeric not null check (tax_percentage >= 0 and tax_percentage <= 100),
  stimulation_low_threshold numeric not null check (stimulation_low_threshold >= 0),
  stimulation_high_threshold numeric not null check (stimulation_high_threshold >= stimulation_low_threshold),
  stimulation_low_amount numeric not null check (stimulation_low_amount >= 0),
  stimulation_high_amount numeric not null check (stimulation_high_amount >= 0),
  premium_per_liter numeric not null check (premium_per_liter >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_calculation_constants_versions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_calculation_constants_versions_updated_at on public.calculation_constants_versions;

create trigger trg_calculation_constants_versions_updated_at
before update on public.calculation_constants_versions
for each row
execute function public.set_calculation_constants_versions_updated_at();

insert into public.calculation_constants_versions (
  valid_from,
  price_per_fat_pct,
  tax_percentage,
  stimulation_low_threshold,
  stimulation_high_threshold,
  stimulation_low_amount,
  stimulation_high_amount,
  premium_per_liter
)
values ('2020-01', 12, 8, 500, 1000, 1, 2, 19)
on conflict (valid_from) do nothing;
