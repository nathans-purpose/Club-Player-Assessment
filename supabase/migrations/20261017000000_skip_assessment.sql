-- Hoppa över: a leader who can't assess a player (hasn't seen enough of them)
-- can skip the player. A skipped assessment is the leader's own row with
-- status 'skipped': it is never shown to the club and never counts towards
-- averages, which only read submitted assessments. Any draft answers are kept,
-- so undoing the skip brings the draft back.

alter table public.assessments drop constraint assessments_status_check;
alter table public.assessments
  add constraint assessments_status_check check (status in ('draft', 'submitted', 'skipped'));

-- submitted_at is set only while an assessment is submitted.
create or replace function public.validate_assessment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.players p
    join public.seasons s on s.team_id = p.team_id
    where p.id = new.player_id and s.id = new.season_id
  ) then
    raise exception 'Player and season belong to different teams';
  end if;

  if tg_op = 'UPDATE' and (
    new.leader_id <> old.leader_id
    or new.player_id <> old.player_id
    or new.season_id <> old.season_id
  ) then
    raise exception 'Assessment author, player and season cannot change';
  end if;

  if new.status = 'submitted' and (tg_op = 'INSERT' or old.status <> 'submitted') then
    new.submitted_at = now();
  elsif new.status <> 'submitted' then
    new.submitted_at = null;
  end if;

  return new;
end;
$$;

-- save_assessment: as before, but a skipped player takes no draft saves.
-- Submitting a full assessment of a skipped player is allowed and replaces the skip.

create or replace function public.save_assessment(
  p_season_id uuid,
  p_player_id uuid,
  p_submit boolean,
  p_comment text,
  p_scores jsonb,
  p_positions jsonb,
  p_attendance jsonb
)
returns table (assessment_id uuid, status text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select a.id, a.status into v_id, v_status
  from public.assessments a
  where a.season_id = p_season_id and a.player_id = p_player_id and a.leader_id = auth.uid()
  for update;

  if v_status = 'submitted' and not p_submit then
    raise exception 'A submitted assessment changes only when it is submitted again';
  end if;
  if v_status = 'skipped' and not p_submit then
    raise exception 'A skipped player is not assessed until the skip is undone';
  end if;

  if v_id is null then
    insert into public.assessments (season_id, player_id, leader_id, status, comment)
    values (p_season_id, p_player_id, auth.uid(), 'draft', nullif(trim(p_comment), ''))
    returning id into v_id;
  else
    update public.assessments a set comment = nullif(trim(p_comment), '') where a.id = v_id;
  end if;

  -- Replace the answers on active categories; keep history on inactive ones.
  delete from public.assessment_scores s
  using public.categories c
  where s.assessment_id = v_id
    and c.id = s.category_id
    and c.is_active
    and (
      s.subcategory_id is null
      or exists (select 1 from public.subcategories sc where sc.id = s.subcategory_id and sc.is_active)
    );

  insert into public.assessment_scores (assessment_id, category_id, subcategory_id, score)
  select v_id, (r ->> 'category_id')::uuid, (r ->> 'subcategory_id')::uuid, (r ->> 'score')::smallint
  from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb)) as r
  where exists (select 1 from public.categories c where c.id = (r ->> 'category_id')::uuid and c.is_active)
    and (
      r ->> 'subcategory_id' is null
      or exists (
        select 1 from public.subcategories sc
        where sc.id = (r ->> 'subcategory_id')::uuid and sc.is_active
      )
    );

  delete from public.assessment_positions p where p.assessment_id = v_id;
  insert into public.assessment_positions (assessment_id, position_code, level)
  select v_id, r ->> 'position_code', (r ->> 'level')::smallint
  from jsonb_array_elements(coalesce(p_positions, '[]'::jsonb)) as r;

  delete from public.assessment_attendance aa where aa.assessment_id = v_id;
  insert into public.assessment_attendance (assessment_id, phase_id, value)
  select v_id, (r ->> 'phase_id')::uuid, (r ->> 'value')::smallint
  from jsonb_array_elements(coalesce(p_attendance, '[]'::jsonb)) as r;

  if p_submit then
    update public.assessments a set status = 'submitted' where a.id = v_id;
  end if;

  return query
  select a.id, a.status from public.assessments a where a.id = v_id;
end;
$$;

revoke execute on function public.save_assessment(uuid, uuid, boolean, text, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_assessment(uuid, uuid, boolean, text, jsonb, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- set_assessment_skipped: skips the caller's assessment of (season, player),
-- or undoes the skip (back to a draft). A submitted assessment can't be
-- skipped; it is part of the club's view. Runs as the caller, so RLS applies.
-- ---------------------------------------------------------------------------

create or replace function public.set_assessment_skipped(
  p_season_id uuid,
  p_player_id uuid,
  p_skipped boolean
)
returns table (assessment_id uuid, status text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select a.id, a.status into v_id, v_status
  from public.assessments a
  where a.season_id = p_season_id and a.player_id = p_player_id and a.leader_id = auth.uid()
  for update;

  if v_status = 'submitted' then
    raise exception 'A submitted assessment cannot be skipped';
  end if;

  if p_skipped then
    if v_id is null then
      insert into public.assessments (season_id, player_id, leader_id, status)
      values (p_season_id, p_player_id, auth.uid(), 'skipped')
      returning id into v_id;
    else
      update public.assessments a set status = 'skipped' where a.id = v_id;
    end if;
  elsif v_status = 'skipped' then
    update public.assessments a set status = 'draft' where a.id = v_id;
  end if;

  return query
  select a.id, a.status from public.assessments a where a.id = v_id;
end;
$$;

revoke execute on function public.set_assessment_skipped(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_assessment_skipped(uuid, uuid, boolean) to authenticated;
