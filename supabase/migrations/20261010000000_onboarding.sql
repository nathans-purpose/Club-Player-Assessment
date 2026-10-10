-- Onboarding (Kom igång): create a club with its first team in one go, preview
-- invites before accepting them, and store club crests.

-- ---------------------------------------------------------------------------
-- create_club: club, first team, active season with phases, position targets
-- and assessment categories, atomically. Runs as the caller (security
-- invoker), so every insert goes through RLS: the caller becomes admin of the
-- new club through on_club_created and may then write its settings.
-- The app supplies the defaults (lib/onboarding/defaults.ts).
-- ---------------------------------------------------------------------------

create or replace function public.create_club(
  p_name text,
  p_slug text,
  p_team_name text,
  p_game_format smallint,
  p_has_minors boolean,
  p_season_label text,
  p_phases text[],
  p_position_targets jsonb,  -- [{"position_code": "MV", "target_count": 1}, …]
  p_categories jsonb         -- [{"name": "Teknik", "question": "…"}, …]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_club_id uuid;
  v_team_id uuid;
  v_season_id uuid;
  v_slug text;
  v_attempt int := 1;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  -- Slugs are globally unique, but the caller can only see their own clubs,
  -- so try the slug and add a number until it is free.
  loop
    v_slug := case when v_attempt = 1 then p_slug else p_slug || '-' || v_attempt end;
    begin
      insert into public.clubs (name, slug, created_by)
      values (trim(p_name), v_slug, auth.uid())
      returning id into v_club_id;
      exit;
    exception when unique_violation then
      v_attempt := v_attempt + 1;
      if v_attempt > 50 then
        raise;
      end if;
    end;
  end loop;

  insert into public.teams (club_id, name, game_format, has_minors)
  values (v_club_id, trim(p_team_name), p_game_format, p_has_minors)
  returning id into v_team_id;

  insert into public.seasons (team_id, label, is_active)
  values (v_team_id, p_season_label, true)
  returning id into v_season_id;

  insert into public.season_phases (season_id, name, sort_order)
  select v_season_id, phase.name, phase.ord
  from unnest(p_phases) with ordinality as phase (name, ord);

  insert into public.position_targets (team_id, position_code, target_count)
  select v_team_id, t ->> 'position_code', (t ->> 'target_count')::smallint
  from jsonb_array_elements(coalesce(p_position_targets, '[]'::jsonb)) as t;

  insert into public.categories (team_id, name, question, sort_order)
  select v_team_id, c.value ->> 'name', c.value ->> 'question', c.ord
  from jsonb_array_elements(coalesce(p_categories, '[]'::jsonb)) with ordinality as c (value, ord);

  return v_club_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- invite_preview: what the invite page shows before the user accepts. Only
-- reveals the club's name and the role, and only to someone holding the token.
-- state: 'ok' | 'member' | 'expired' | 'used' | 'wrong_email'
-- ---------------------------------------------------------------------------

create or replace function public.invite_preview(p_token text)
returns table (club_name text, role text, state text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_invite public.invites%rowtype;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into v_invite from public.invites where token = p_token;
  if not found then
    return;
  end if;

  select email into v_email from auth.users where id = auth.uid();

  return query
  select
    c.name,
    v_invite.role,
    case
      when exists (
        select 1 from public.club_members m
        where m.club_id = v_invite.club_id and m.user_id = auth.uid()
      ) then 'member'
      when v_invite.expires_at < now() then 'expired'
      when v_invite.email is not null and v_invite.accepted_at is not null then 'used'
      when v_invite.email is not null and lower(v_email) is distinct from lower(v_invite.email) then 'wrong_email'
      else 'ok'
    end
  from public.clubs c
  where c.id = v_invite.club_id;
end;
$$;

revoke execute on function
  public.create_club(text, text, text, smallint, boolean, text, text[], jsonb, jsonb),
  public.invite_preview(text)
from public, anon;
grant execute on function
  public.create_club(text, text, text, smallint, boolean, text, text[], jsonb, jsonb),
  public.invite_preview(text)
to authenticated;

-- ---------------------------------------------------------------------------
-- Club crests: a public bucket (crests are shown openly, they are not personal
-- data). Files live under <club_id>/ and only that club's admins may write.
-- Skipped where Supabase Storage is not installed (the RLS test database).
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('club-crests', 'club-crests', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
  on conflict (id) do nothing;

  create policy club_crests_insert on storage.objects for insert to authenticated
    with check (
      bucket_id = 'club-crests'
      and public.is_club_admin(((storage.foldername(name))[1])::uuid)
    );
  create policy club_crests_update on storage.objects for update to authenticated
    using (
      bucket_id = 'club-crests'
      and public.is_club_admin(((storage.foldername(name))[1])::uuid)
    );
  create policy club_crests_delete on storage.objects for delete to authenticated
    using (
      bucket_id = 'club-crests'
      and public.is_club_admin(((storage.foldername(name))[1])::uuid)
    );
end;
$$;
