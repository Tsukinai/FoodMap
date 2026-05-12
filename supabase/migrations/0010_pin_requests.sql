create table pin_requests (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  author_name   text        not null,
  author_avatar text,
  name          text        not null,
  address       text        not null,
  postal_code   text,
  lng           float8      not null,
  lat           float8      not null,
  cuisine_tag_ids uuid[]    not null default '{}',
  scene_tag_ids   uuid[]    not null default '{}',
  notes         text        not null,
  status        text        not null default 'pending'
                            check (status in ('pending', 'approved', 'rejected')),
  created_at    timestamptz not null default now()
);

alter table pin_requests enable row level security;

-- Any authenticated user can submit a request
-- Owner operations (SELECT/DELETE) bypass RLS via service_role client in API routes
create policy "authed_insert_pin_requests"
  on pin_requests for insert
  with check (auth.uid() = user_id);
