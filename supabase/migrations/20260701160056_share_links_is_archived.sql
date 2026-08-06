-- Adds an archive flag to share_links so owners can disable a share link
-- without deleting it. Archived links are treated like expired ones by
-- the public /s/[token] pages and the CSV export endpoint.
alter table public.share_links
  add column if not exists is_archived boolean not null default false;
