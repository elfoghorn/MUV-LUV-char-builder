-- =====================================================================
-- UNTSF-COMM: sign-up invite code.
--   * When the Administrator sets an invite code, new accounts can only be
--     created with it. The code is stored only as a bcrypt hash, in a schema
--     the Data API cannot see, and is stripped from the new account's record.
--   * The first account (the Administrator) never needs one.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.config (key text primary key, value text not null);

create or replace function public.check_invite() returns trigger
language plpgsql security definer set search_path = public, private, extensions as $$
declare h text; given text := new.raw_user_meta_data ->> 'invite';
begin
    select value into h from private.config where key = 'invite_hash';
    if h is not null and exists (select 1 from public.members) then
        if given is null or extensions.crypt(given, h) <> h then
            raise exception 'invite_code_invalid' using errcode = '42501';
        end if;
    end if;
    new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb) - 'invite';
    return new;
end $$;
drop trigger if exists on_auth_user_invite on auth.users;
create trigger on_auth_user_invite before insert on auth.users for each row execute function public.check_invite();

-- Administrator: set, change or clear (null / empty) the invite code.
create or replace function public.admin_set_invite_code(p_code text) returns void
language plpgsql security definer set search_path = public, private, extensions as $$
begin
    if coalesce(public.my_role(), '') <> 'owner' then raise exception 'Only the Administrator sets the invite code' using errcode = '42501'; end if;
    if coalesce(trim(p_code), '') = '' then delete from private.config where key = 'invite_hash'; return; end if;
    if length(trim(p_code)) < 6 then raise exception 'Use an invite code of at least 6 characters'; end if;
    insert into private.config (key, value) values ('invite_hash', extensions.crypt(trim(p_code), extensions.gen_salt('bf')))
    on conflict (key) do update set value = excluded.value;
end $$;
-- Anyone may ask whether a code is needed (never what it is), so the sign-up form can say so.
create or replace function public.invite_required() returns boolean
language sql stable security definer set search_path = public, private as $$
    select exists (select 1 from private.config where key = 'invite_hash') and exists (select 1 from public.members)
$$;

revoke execute on function public.admin_set_invite_code(text) from public, anon;
grant execute on function public.admin_set_invite_code(text) to authenticated;
grant execute on function public.invite_required() to anon, authenticated;
