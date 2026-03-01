-- Audit log table for critical business actions.

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  action_type text not null,
  entity_type text not null,
  entity_id text,
  actor_identifier text not null,
  actor_ip text,
  actor_user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_created_at on public.audit_logs (created_at desc);
create index if not exists idx_audit_logs_action_type on public.audit_logs (action_type);
create index if not exists idx_audit_logs_entity on public.audit_logs (entity_type, entity_id);
create index if not exists idx_audit_logs_actor on public.audit_logs (actor_identifier);
