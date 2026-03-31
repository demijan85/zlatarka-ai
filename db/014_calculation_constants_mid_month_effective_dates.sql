alter table public.calculation_constants_versions
drop constraint if exists calculation_constants_versions_valid_from_check;

update public.calculation_constants_versions
set valid_from = valid_from || '-01'
where valid_from ~ '^[0-9]{4}-(0[1-9]|1[0-2])$';

alter table public.calculation_constants_versions
add constraint calculation_constants_versions_valid_from_check
check (valid_from ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(01|16)$');
