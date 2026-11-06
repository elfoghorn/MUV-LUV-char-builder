-- =====================================================================
-- UNTSF-COMM self-hosted edition: database set-up.
--   members   one row per account: role owner / gm / player.
--             The first account to sign up becomes owner (Administrator
--             and Command Authority).
--   docs      the campaign's records, one row per record, by collection.
--   assets    a public Storage bucket for portraits and artwork.
-- Rules (row-level security):
--   * Members read campaign records; GM notes are Command Authority only;
--     each person's private storage (drafts, read state) is theirs alone.
--   * Only Command Authority writes the catalogue, rules, settings, map,
--     units and command structure. Players write everything else.
-- Grants are explicit: new Supabase projects no longer expose tables to
-- the Data API automatically.
-- =====================================================================

create table public.members (
    user_id      uuid primary key references auth.users (id) on delete cascade,
    email        text,
    display_name text,
    role         text not null default 'player' check (role in ('owner', 'gm', 'player')),
    created_at   timestamptz not null default now()
);

create table public.docs (
    collection  text not null check (length(collection) between 1 and 200),
    id          text not null check (length(id) between 1 and 200),
    data        jsonb not null,
    updated_at  timestamptz not null default now(),
    updated_by  uuid default auth.uid(),
    primary key (collection, id)
);

-- ---------------------------------------------------------------- helpers
create function public.my_role() returns text
language sql stable security definer set search_path = public as $$
    select role from public.members where user_id = auth.uid()
$$;
create function public.is_gm() returns boolean
language sql stable security definer set search_path = public as $$
    select coalesce((select role in ('owner', 'gm') from public.members where user_id = auth.uid()), false)
$$;
create function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.members where user_id = auth.uid())
$$;
-- Collections only Command Authority may change.
create function public.gm_only_collection(c text) returns boolean
language sql immutable as $$
    select c = any (array['vocab', 'models', 'variants', 'equipment', 'manufacturers', 'factions', 'rules', 'settings',
                          'gm_notes', 'fronts', 'zones', 'units', 'slots'])
$$;
-- Private storage: data/users/<account id> and anything beneath it.
create function public.own_private(c text) returns boolean
language sql stable as $$
    select c = 'data/users/' || auth.uid()::text or c like 'data/users/' || auth.uid()::text || '/%'
$$;
create function public.may_read(c text) returns boolean
language sql stable security definer set search_path = public as $$
    select case when c like 'data/users/%' then public.own_private(c)
                when c = 'gm_notes' then public.is_gm()
                else public.is_member() end
$$;
create function public.may_write(c text) returns boolean
language sql stable security definer set search_path = public as $$
    select case when c like 'data/users/%' then public.own_private(c)
                when public.gm_only_collection(c) then public.is_gm()
                else public.is_member() end
$$;

-- Keep updated_at / updated_by honest.
create function public.docs_touch() returns trigger
language plpgsql as $$
begin new.updated_at := now(); new.updated_by := auth.uid(); return new; end $$;
create trigger docs_touch before insert or update on public.docs for each row execute function public.docs_touch();

-- ---------------------------------------------------------------- new accounts
create function public.handle_new_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
    insert into public.members (user_id, email, display_name, role)
    values (new.id, new.email, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)),
            case when exists (select 1 from public.members) then 'player' else 'owner' end);
    return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_member();

-- Only the owner changes roles; nobody can make themselves owner.
create function public.guard_member_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
    -- Requests from signed-in users carry their id; the SQL editor and migrations do not.
    if auth.uid() is not null then
        if new.role is distinct from old.role and coalesce(public.my_role(), '') <> 'owner' then
            raise exception 'Only the Administrator changes roles' using errcode = '42501';
        end if;
        if new.role = 'owner' and old.role <> 'owner' then
            raise exception 'There is one Administrator' using errcode = '42501';
        end if;
        if new.user_id is distinct from old.user_id or new.email is distinct from old.email then
            raise exception 'Account details are managed by sign-in' using errcode = '42501';
        end if;
    end if;
    return new;
end $$;
create trigger members_guard before update on public.members for each row execute function public.guard_member_role();

-- ---------------------------------------------------------------- row-level security
alter table public.members enable row level security;
alter table public.docs enable row level security;

create policy members_read on public.members for select to authenticated using (public.is_member());
create policy members_update on public.members for update to authenticated
    using (user_id = auth.uid() or public.my_role() = 'owner') with check (user_id = auth.uid() or public.my_role() = 'owner');

create policy docs_read   on public.docs for select to authenticated using (public.may_read(collection));
create policy docs_insert on public.docs for insert to authenticated with check (public.may_write(collection));
create policy docs_update on public.docs for update to authenticated using (public.may_write(collection)) with check (public.may_write(collection));
create policy docs_delete on public.docs for delete to authenticated using (public.may_write(collection));

-- ---------------------------------------------------------------- explicit grants
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.docs to authenticated;
grant select, update on public.members to authenticated;
grant execute on function public.my_role(), public.is_gm(), public.is_member(), public.gm_only_collection(text),
                          public.own_private(text), public.may_read(text), public.may_write(text) to authenticated;

-- Keep-awake ping for the scheduled GitHub job (touches the database, returns nothing private).
create function public.keepalive() returns text language sql stable as $$ select 'ok'::text $$;
grant execute on function public.keepalive() to anon, authenticated;

-- ---------------------------------------------------------------- live updates
alter table public.docs replica identity full;
do $$ begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        alter publication supabase_realtime add table public.docs;
    end if;
end $$;

-- ---------------------------------------------------------------- image storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('assets', 'assets', true, 15728640, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;
create policy "assets: members upload" on storage.objects for insert to authenticated
    with check (bucket_id = 'assets' and public.is_member());
create policy "assets: members list" on storage.objects for select to authenticated
    using (bucket_id = 'assets');
create policy "assets: owner or GM removes" on storage.objects for delete to authenticated
    using (bucket_id = 'assets' and (owner_id = auth.uid()::text or public.is_gm()));
