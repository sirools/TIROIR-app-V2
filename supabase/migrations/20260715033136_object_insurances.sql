-- ================================================================
-- 20260715033136_object_insurances.sql
-- Assurances multiples par objet (prix + date), avec contrats PDF
-- liés via object_documents.insurance_id.
-- ================================================================

create table if not exists public.object_insurances (
  id         uuid primary key default gen_random_uuid(),
  object_id  uuid not null references public.objects(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  label      text          null,
  price      numeric(12,2) null,
  date       date          null,
  position   integer       not null default 0,
  created_at timestamptz   not null default now(),
  updated_at timestamptz   not null default now()
);

create index if not exists object_insurances_object_id_idx on public.object_insurances(object_id);
create index if not exists object_insurances_user_id_idx   on public.object_insurances(user_id);

alter table public.object_insurances enable row level security;

create policy "Users can view their own insurances"
  on public.object_insurances for select using (auth.uid() = user_id);
create policy "Users can insert their own insurances"
  on public.object_insurances for insert with check (auth.uid() = user_id);
create policy "Users can update their own insurances"
  on public.object_insurances for update using (auth.uid() = user_id);
create policy "Users can delete their own insurances"
  on public.object_insurances for delete using (auth.uid() = user_id);

-- Lien optionnel d'un document vers une assurance (contrat PDF).
-- ON DELETE CASCADE : supprimer une assurance retire ses lignes de documents
-- (le nettoyage du storage est fait côté client avant suppression).
alter table public.object_documents
  add column if not exists insurance_id uuid null
    references public.object_insurances(id) on delete cascade;

create index if not exists object_documents_insurance_id_idx
  on public.object_documents(insurance_id);
