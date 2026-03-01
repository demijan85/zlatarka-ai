-- Apply this if daily_intake_locks already exists with the old invalid check pattern.

alter table public.daily_intake_locks
  drop constraint if exists daily_intake_locks_year_month_check;

alter table public.daily_intake_locks
  add constraint daily_intake_locks_year_month_check
  check (year_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
