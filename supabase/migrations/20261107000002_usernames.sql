-- =====================================================================
-- UNTSF-COMM: usernames instead of email addresses. No personal data.
--   * Accounts sign in with a username. Supabase still needs an address
--     internally, so each username maps to <username>@players.untsf.invalid:
--     a reserved domain (RFC 2606) that can never receive mail.
--   * members keeps only the username and role: the email and display-name
--     columns are removed.
--   * The Administrator resets passwords and deletes accounts in the app
--     (System Administration → Accounts); nobody needs a recovery email.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

alter table public.members add column if not exists username text;
update public.members m
   set username = lower(coalesce(nullif(u.raw_user_meta_data ->> 'username', ''), split_part(u.email, '@', 1)))
  from auth.users u
 where u.id = m.user_id and m.username is null;
alter table public.members alter column username set not null;
create unique index if not exists members_username_key on public.members (lower(username));
alter table public.members drop column if exists email;
alter table public.members drop column if exists display_name;

create or replace function public.handle_new_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
    insert into public.members (user_id, username, role)
    values (new.id, lower(coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), split_part(new.email, '@', 1))),
            case when exists (select 1 from public.members) then 'player' else 'owner' end);
    return new;
end $$;

create or replace function public.guard_member_role() returns trigger
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
        if new.user_id is distinct from old.user_id or new.username is distinct from old.username then
            raise exception 'Usernames are fixed once created' using errcode = '42501';
        end if;
    end if;
    return new;
end $$;

-- Administrator: set a new password for an account, and sign it out everywhere.
create function public.admin_reset_password(p_user uuid, p_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
    if coalesce(public.my_role(), '') <> 'owner' then raise exception 'Only the Administrator resets passwords' using errcode = '42501'; end if;
    if p_user = auth.uid() then raise exception 'Change your own password from the account menu' using errcode = '42501'; end if;
    if length(coalesce(p_password, '')) < 8 then raise exception 'Use a password of at least 8 characters'; end if;
    update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now() where id = p_user;
    if not found then raise exception 'No such account'; end if;
    delete from auth.sessions where user_id = p_user;
end $$;

-- Administrator: remove an account entirely (its sign-in and membership). Characters stay in the campaign.
create function public.admin_delete_account(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
    if coalesce(public.my_role(), '') <> 'owner' then raise exception 'Only the Administrator deletes accounts' using errcode = '42501'; end if;
    if p_user = auth.uid() then raise exception 'The Administrator account cannot delete itself' using errcode = '42501'; end if;
    delete from auth.users where id = p_user;
    if not found then raise exception 'No such account'; end if;
end $$;

revoke execute on function public.admin_reset_password(uuid, text), public.admin_delete_account(uuid) from public, anon;
grant execute on function public.admin_reset_password(uuid, text), public.admin_delete_account(uuid) to authenticated;
