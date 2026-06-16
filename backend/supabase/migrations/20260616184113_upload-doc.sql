create type upload_session_status as enum (
  'pending',
  'signed',
  'client_uploaded',
  'completed',
  'failed',
  'expired'
);

create table document_upload_sessions (
  id uuid primary key default gen_random_uuid(),

  document_id uuid not null
    references documents(id)
    on delete cascade,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  storage_path text not null,

  status upload_session_status not null default 'pending',

  signed_at timestamptz,
  expires_at timestamptz,

  uploaded_at timestamptz,
  completed_at timestamptz,

  error_message text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_upload_sessions_document
on document_upload_sessions(document_id);

create index idx_upload_sessions_status
on document_upload_sessions(status);



alter table documents
add column if not exists uploaded_at timestamptz;

alter table documents
add column if not exists verified_at timestamptz;

alter table documents
add column if not exists checksum_sha256 text;

alter table documents
add column if not exists last_error text;