-- Step 8: privacy. Teams with players under 18 show the admin an information
-- text for guardians before the club starts assessing; the admin confirms
-- that the guardians have been told. Exporting and deleting club data run
-- under the existing RLS policies (admins read and delete their own club).

alter table public.teams
  -- When an admin confirmed that guardians got the information text (has_minors only).
  add column guardian_info_confirmed_at timestamptz;

-- ---------------------------------------------------------------------------
-- Deleting a club removes its files too. The crest bucket had no select
-- policy, so the club's admins could not list (and so not find) its files;
-- they can now. Skipped where Supabase Storage is not installed (the RLS test
-- database).
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;

  create policy club_crests_select on storage.objects for select to authenticated
    using (
      bucket_id = 'club-crests'
      and public.is_club_admin(((storage.foldername(name))[1])::uuid)
    );
end;
$$;
