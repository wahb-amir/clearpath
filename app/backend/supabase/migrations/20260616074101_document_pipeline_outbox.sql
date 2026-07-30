-- create the missing table if it is supposed to exist
create table if not exists document_pipeline_outbox (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  processed_at timestamptz null,
  payload jsonb not null,
  status text not null default 'pending'
);