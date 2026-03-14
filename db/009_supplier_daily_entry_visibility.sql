alter table public.suppliers
  add column if not exists hidden_in_daily_entry boolean not null default false;

comment on column public.suppliers.hidden_in_daily_entry is
  'When true, the supplier is hidden from new daily milk intake screens but remains visible in months where entries already exist.';
