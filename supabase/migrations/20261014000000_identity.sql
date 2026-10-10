-- Step 7: visual identity.
--
-- The club's colours, fonts, logos and tone words live in club_identity
-- (created in step 1). Two Storage buckets are added:
--
-- * brand-imports (private): the pages of a brand document, prepared in the
--   browser, while the server reads them with Claude. Deleted right after.
-- * club-assets (public): the club's logos (PNG) and uploaded font files,
--   which every member's browser loads. Paths are <club_id>/logos/<id>.png and
--   <club_id>/fonts/<id>.<ext>. No SVG, since the bucket is public.
--
-- Only the club's admins may write, list or delete in either bucket.
-- Skipped where Supabase Storage is not installed (the RLS test database).

alter table public.club_identity
  add constraint club_identity_colors_object check (jsonb_typeof(colors) = 'object'),
  add constraint club_identity_fonts_object check (jsonb_typeof(fonts) = 'object'),
  add constraint club_identity_logos_object check (jsonb_typeof(logos) = 'object');

do $$
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values
    ('brand-imports', 'brand-imports', false, 5242880, array['image/png', 'image/jpeg']),
    ('club-assets', 'club-assets', true, 5242880,
      array['image/png', 'font/woff2', 'font/woff', 'font/otf', 'font/ttf'])
  on conflict (id) do nothing;

  create policy brand_imports_insert on storage.objects for insert to authenticated
    with check (
      bucket_id = 'brand-imports'
      and public.is_club_admin(((storage.foldername(name))[1])::uuid)
    );
  create policy brand_imports_select on storage.objects for select to authenticated
    using (
      bucket_id = 'brand-imports'
      and public.is_club_admin(((storage.foldername(name))[1])::uuid)
    );
  create policy brand_imports_delete on storage.objects for delete to authenticated
    using (
      bucket_id = 'brand-imports'
      and public.is_club_admin(((storage.foldername(name))[1])::uuid)
    );

  -- Public reads go through the public URL; this policy is for listing (cleanup).
  create policy club_assets_select on storage.objects for select to authenticated
    using (
      bucket_id = 'club-assets'
      and public.is_club_admin(((storage.foldername(name))[1])::uuid)
    );
  create policy club_assets_insert on storage.objects for insert to authenticated
    with check (
      bucket_id = 'club-assets'
      and public.is_club_admin(((storage.foldername(name))[1])::uuid)
    );
  create policy club_assets_delete on storage.objects for delete to authenticated
    using (
      bucket_id = 'club-assets'
      and public.is_club_admin(((storage.foldername(name))[1])::uuid)
    );
end;
$$;
