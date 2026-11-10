-- Command Authority (the Administrator and Moderators) can read applications that players are still writing,
-- so the Applications page can show who is making what and how far they've got.
-- Only application drafts: everything else in each person's private storage stays theirs alone.
create policy docs_read_application_drafts on public.docs for select to authenticated
  using (collection like 'data/users/%' and id like 'application-%' and public.is_gm());
