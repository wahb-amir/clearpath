-- allow schema usage
grant usage on schema public to service_role;

-- give full access to all existing tables
grant all privileges on all tables in schema public to service_role;

-- give access to sequences (important for serial/identity)
grant all privileges on all sequences in schema public to service_role;

-- ensure future tables also get permissions automatically
alter default privileges in schema public
grant all on tables to service_role;

alter default privileges in schema public
grant all on sequences to service_role;