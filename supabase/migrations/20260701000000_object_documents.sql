-- Table des documents liés à un objet (factures, notices, assurances, etc.)
create table if not exists object_documents (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references objects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint,
  doc_type text not null default 'autre' check (doc_type in ('facture', 'notice', 'assurance', 'autre')),
  doc_type_label text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists object_documents_object_id_idx on object_documents(object_id);
create index if not exists object_documents_user_id_idx on object_documents(user_id);

alter table object_documents enable row level security;

create policy "Users can view their own documents"
  on object_documents for select
  using (auth.uid() = user_id);

create policy "Users can insert their own documents"
  on object_documents for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own documents"
  on object_documents for update
  using (auth.uid() = user_id);

create policy "Users can delete their own documents"
  on object_documents for delete
  using (auth.uid() = user_id);

-- Bucket de stockage dédié (privé, accès via URLs signées)
insert into storage.buckets (id, name, public)
values ('object-documents', 'object-documents', false)
on conflict (id) do nothing;

create policy "Users can upload their own documents"
  on storage.objects for insert
  with check (
    bucket_id = 'object-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can view their own documents storage"
  on storage.objects for select
  using (
    bucket_id = 'object-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own documents storage"
  on storage.objects for delete
  using (
    bucket_id = 'object-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
