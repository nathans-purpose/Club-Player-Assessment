-- Spelarkort: save a leader's assessment of one player, with its scores,
-- positions and attendance, in one transaction.

-- ---------------------------------------------------------------------------
-- save_assessment: upserts the caller's assessment for (season, player) and
-- replaces its answers. Runs as the caller (security invoker), so RLS and the
-- validation triggers apply to every row.
--
-- p_scores:     [{"category_id": uuid, "subcategory_id": uuid | null, "score": 1–10}, …]
-- p_positions:  [{"position_code": "CM", "level": 1–3}, …]
-- p_attendance: [{"phase_id": uuid, "value": 95 | 80 | 55 | 25}, …]  (missing = "Vet ej")
--
-- Drafts are autosaved. Once submitted, an assessment only changes by
-- submitting it again (p_submit = true), so half-finished edits never show up
-- in the combined view. Scores on inactive categories and subcategories are
-- history: they are kept as they are and cannot be added to.
-- ---------------------------------------------------------------------------

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
