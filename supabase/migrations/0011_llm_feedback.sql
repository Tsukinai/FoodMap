create table llm_feedback (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  msg_content   text,
  feedback_text text,
  created_at    timestamptz not null default now()
);

alter table llm_feedback enable row level security;

-- Any authenticated user can submit feedback
create policy "authed_insert_llm_feedback"
  on llm_feedback for insert
  with check (auth.uid() = user_id);

-- Owner can read and delete feedback
create policy "owner_read_llm_feedback"
  on llm_feedback for select
  using (auth.uid() = 'YOUR-OWNER-UUID'::uuid);

create policy "owner_delete_llm_feedback"
  on llm_feedback for delete
  using (auth.uid() = 'YOUR-OWNER-UUID'::uuid);
