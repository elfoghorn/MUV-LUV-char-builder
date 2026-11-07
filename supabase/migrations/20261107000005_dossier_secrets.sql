-- =====================================================================
-- UNTSF-COMM: GM-only dossier fields.
--   dossier_secrets   one record per character, keyed by the character's
--                     id: secret connections, secrets and plot hooks.
--   Readable and writable only by Command Authority (the Administrator
--   and Moderators) and by the account that currently plays the
--   character. Other players never receive these rows, so the fields
--   stay hidden even from someone reading the database directly.
--   Following the character's userId means a character moved to another
--   account takes its secrets with it.
-- =====================================================================

-- The signed-in account plays this character.
create or replace function public.owns_pilot(p_id text) returns boolean
language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.docs where collection = 'pilots' and id = p_id and data ->> 'userId' = auth.uid()::text)
$$;
grant execute on function public.owns_pilot(text) to authenticated;

create or replace function public.may_read(c text) returns boolean
language sql stable security definer set search_path = public as $$
    select case when c like 'data/users/%' then public.own_private(c)
                when c = any (array['gm_notes', 'dossier_secrets']) then public.is_gm()
                else public.is_member() end
$$;
create or replace function public.may_write(c text) returns boolean
language sql stable security definer set search_path = public as $$
    select case when c like 'data/users/%' then public.own_private(c)
                when c = 'dossier_secrets' then public.is_gm()
                when c = any (array['rules', 'vocab', 'factions', 'zones', 'fronts']) then coalesce(public.my_role(), '') = 'owner'
                when c = any (array['models', 'variants', 'equipment', 'manufacturers']) then public.has_tool('catalogue')
                when c = any (array['units', 'slots']) then public.has_tool('personnel')
                when public.gm_only_collection(c) then public.is_gm()
                else public.is_member() end
$$;

-- A player also reads and writes the secrets of the character they play (but cannot delete them).
drop policy if exists docs_read on public.docs;
drop policy if exists docs_insert on public.docs;
drop policy if exists docs_update on public.docs;
create policy docs_read on public.docs for select to authenticated
    using (public.may_read(collection) or (collection = 'dossier_secrets' and public.owns_pilot(id)));
create policy docs_insert on public.docs for insert to authenticated
    with check (public.may_write(collection) or (collection = 'dossier_secrets' and public.owns_pilot(id)));
create policy docs_update on public.docs for update to authenticated
    using (public.may_write(collection) or (collection = 'dossier_secrets' and public.owns_pilot(id)))
    with check (public.may_write(collection) or (collection = 'dossier_secrets' and public.owns_pilot(id)));
