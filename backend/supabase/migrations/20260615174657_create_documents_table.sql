-- 1. Enable UUID extension if not already present
create extension if not exists "uuid-ossp";

-- 2. Create the Custom Users Table
create table public.users (
    id uuid primary key default gen_random_uuid(),
    email varchar(254) not null unique,
    full_name varchar(100) not null,
    password_hash text not null,
    created_at timestamp with time zone default current_timestamp,
    updated_at timestamp with time zone default current_timestamp
);

-- Index for optimized low-latency sign-ins
create index idx_users_email on public.users(email);

-- 3. Create the Custom Sessions Table
create table public.sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete cascade,
    refresh_token text not null unique,
    device_meta text not null,
    ip_address varchar(45) not null,
    is_revoked boolean not null default false,
    created_at timestamp with time zone default current_timestamp,
    updated_at timestamp with time zone default current_timestamp
);

-- Index for rapid verification during token rotation loops
create index idx_sessions_lookup on public.sessions(id, refresh_token);