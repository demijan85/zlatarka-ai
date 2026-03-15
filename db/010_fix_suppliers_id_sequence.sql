select setval(
  pg_get_serial_sequence('public.suppliers', 'id'),
  greatest(coalesce((select max(id) from public.suppliers), 0), 1),
  true
);
