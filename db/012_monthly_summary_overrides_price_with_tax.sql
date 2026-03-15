alter table public.monthly_summary_overrides
add column if not exists price_with_tax_override numeric(12, 2) null;

update public.monthly_summary_overrides as overrides
set price_with_tax_override = round(
  overrides.price_per_qty_override * (1 + coalesce(constants.tax_percentage, 0) / 100.0),
  2
)
from lateral (
  select version.tax_percentage
  from public.calculation_constants_versions as version
  where version.valid_from <= overrides.year_month
  order by version.valid_from desc
  limit 1
) as constants
where overrides.price_per_qty_override is not null
  and overrides.price_with_tax_override is null;

alter table public.monthly_summary_overrides
drop constraint if exists monthly_summary_overrides_any_value_check;

alter table public.monthly_summary_overrides
add constraint monthly_summary_overrides_any_value_check check (
  price_with_tax_override is not null
  or stimulation_override is not null
);

alter table public.monthly_summary_overrides
drop column if exists price_per_qty_override;
