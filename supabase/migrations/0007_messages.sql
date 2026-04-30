create table messages (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  author_name  text        not null,
  author_avatar text,
  content      text        not null,
  reply        text,
  replied_at   timestamptz,
  created_at   timestamptz not null default now()
);

alter table messages enable row level security;

-- Anyone can read messages
create policy "public_read_messages"
  on messages for select using (true);

-- Any authenticated user can post a message
create policy "authed_insert_messages"
  on messages for insert
  with check (auth.uid() = user_id);

-- Owner can update (reply) and delete messages
create policy "owner_write_messages"
  on messages for all
  using (auth.uid() = 'YOUR-OWNER-UUID'::uuid);
