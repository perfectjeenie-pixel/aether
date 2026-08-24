-- Supabase schema for Aether (users, prekeys, messages)

create table if not exists users (
  username text primary key,
  public_key text,
  created_at timestamp with time zone default timezone('utc', now())
);

create table if not exists prekeys (
  username text primary key references users(username) on delete cascade,
  bundle jsonb,
  updated_at timestamp with time zone default timezone('utc', now())
);

create table if not exists messages (
  id bigserial primary key,
  from_user text references users(username) on delete set null,
  to_user text references users(username) on delete set null,
  ciphertext text,
  iv text,
  created_at timestamp with time zone default timezone('utc', now())
);
