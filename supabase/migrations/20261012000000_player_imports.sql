-- Step 5: player list import.
--
-- Uploaded squad lists (photos, PDFs, spreadsheets, Word files) go to a
-- private bucket under <club_id>/ while the server reads them. Only that
-- club's admins may upload, read or delete them, and the server deletes each
-- file right after reading it, so nothing is kept beyond the reviewed rows.
-- Skipped where Supabase Storage is not installed (the RLS test database).

do $$
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'player-imports',
    'player-imports',
    false,
    20971520,
    array[
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'application/pdf',
      'text/csv',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  )
  on conflict (id) do nothing;

  create policy player_imports_insert on storage.objects for insert to authenticated
    with check (
      bucket_id = 'player-imports'
      and public.is_club_admin(((storage.foldername(name))[1])::uuid)
    );
  create policy player_imports_select on storage.objects for select to authenticated
    using (
      bucket_id = 'player-imports'
      and public.is_club_admin(((storage.foldername(name))[1])::uuid)
    );
  create policy player_imports_delete on storage.objects for delete to authenticated
    using (
      bucket_id = 'player-imports'
      and public.is_club_admin(((storage.foldername(name))[1])::uuid)
    );
end;
$$;
