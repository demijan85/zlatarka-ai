-- Performance-oriented indexes for common reads (dashboards/summaries/filters).

create index if not exists idx_daily_entries_date on public.daily_entries (date);
create index if not exists idx_daily_entries_supplier_date on public.daily_entries (supplier_id, date);
create index if not exists idx_daily_entries_date_supplier on public.daily_entries (date, supplier_id);

create index if not exists idx_suppliers_city on public.suppliers (city);
create index if not exists idx_suppliers_order_index on public.suppliers (order_index);

