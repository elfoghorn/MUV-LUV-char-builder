-- =====================================================================
-- UNTSF-COMM: Moderators.
--   * Roles become owner / mod / player. The owner (Administrator) has
--     every tool. A Moderator has only the tool groups the Administrator
--     ticks for them in System Administration → Accounts:
--       sessions   GM Command Centre, approvals, operations, combat
--       personnel  personnel, units, command structure, access control
--       catalogue  TSF database, manufacturers, equipment, procurement,
--                  production, maintenance, design approval
--   * World and rules (rules, vocabulary, factions, map zones and fronts)
--     stay with the Administrator alone.
--   * Existing Command Authority (gm) accounts become Moderators with
--     every tool group, so nobody loses access on upgrade.
-- =====================================================================

alter table public.members add column if not exists mod_tools text[] not null default '{}';
alter table public.members drop constraint if exists members_role_check;
update public.members set role = 'mod', mod_tools = array['sessions', 'personnel', 'catalogue'] where role = 'gm';
alter table public.members add constraint members_role_check check (role in ('owner', 'mod', 'player'));
alter table public.members drop constraint if exists members_mod_tools_check;
alter table public.members add constraint members_mod_tools_check check (mod_tools <@ array['sessions', 'personnel', 'catalogue']);

-- ---------------------------------------------------------------- helpers
-- Command Authority of any level: the Administrator or a Moderator.
create or replace function public.is_gm() returns boolean
language sql stable security definer set search_path = public as $$
    select coalesce((select role in ('owner', 'mod') from public.members where user_id = auth.uid()), false)
$$;
-- The Administrator, or a Moderator who has been given this tool group.
create or replace function public.has_tool(t text) returns boolean
language sql stable security definer set search_path = public as $$
    select coalesce((select role = 'owner' or (role = 'mod' and t = any (mod_tools)) from public.members where user_id = auth.uid()), false)
$$;
create or replace function public.may_write(c text) returns boolean
language sql stable security definer set search_path = public as $$
    select case when c like 'data/users/%' then public.own_private(c)
                when c = any (array['rules', 'vocab', 'factions', 'zones', 'fronts']) then coalesce(public.my_role(), '') = 'owner'
                when c = any (array['models', 'variants', 'equipment', 'manufacturers']) then public.has_tool('catalogue')
                when c = any (array['units', 'slots']) then public.has_tool('personnel')
                when public.gm_only_collection(c) then public.is_gm()
                else public.is_member() end
$$;
grant execute on function public.has_tool(text) to authenticated;

-- Only the Administrator changes roles and Moderator tools; nobody can make themselves owner.
create or replace function public.guard_member_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
    -- Requests from signed-in users carry their id; the SQL editor and migrations do not.
    if auth.uid() is not null then
        if (new.role is distinct from old.role or new.mod_tools is distinct from old.mod_tools) and coalesce(public.my_role(), '') <> 'owner' then
            raise exception 'Only the Administrator changes roles' using errcode = '42501';
        end if;
        if new.role = 'owner' and old.role <> 'owner' then
            raise exception 'There is one Administrator' using errcode = '42501';
        end if;
        if new.user_id is distinct from old.user_id or new.username is distinct from old.username then
            raise exception 'Usernames are fixed once created' using errcode = '42501';
        end if;
    end if;
    if new.role <> 'mod' then new.mod_tools := '{}'; end if;
    return new;
end $$;
