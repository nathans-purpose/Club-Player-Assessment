-- Step 6: settings. Admins edit the team's assessment categories and the
-- positions on the pitch, and choose how the club shows results.

-- ---------------------------------------------------------------------------
-- Club display options
-- ---------------------------------------------------------------------------

alter table public.clubs
  -- Per-leader scores and comment authors are hidden; only averages and spread show.
  add column anonymous_leader_view boolean not null default false,
  -- For showing Översikt on a big screen: "Lägst" instead of "Svagast".
  add column screen_friendly boolean not null default false;

-- ---------------------------------------------------------------------------
-- save_categories: replaces the team's active categories with p_categories,
-- in the given order, in one transaction. Runs as the caller, so RLS lets only
-- the club's admins write.
--
-- p_categories: [{"id": uuid | null, "name": text, "question": text | null,
--                 "subcategories": [{"id": uuid | null, "name": text}, …]}, …]
--
-- Rows with an id update that category (and reactivate it if it was removed);
-- rows without one are created. Categories and subcategories left out are
-- deactivated, never deleted, so scores already given stay in the history.
-- A category with no subcategories is not deepened.
-- ---------------------------------------------------------------------------

create or replace function public.save_categories(p_team_id uuid, p_categories jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_category jsonb;
  v_sub jsonb;
  v_category_id uuid;
  v_sub_id uuid;
  v_kept uuid[] := '{}';
  v_kept_subs uuid[];
  v_order int := 0;
  v_sub_order int;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if not public.is_club_admin(public.team_club_id(p_team_id)) then
    raise exception 'Only the club''s admins can change categories';
  end if;
  if jsonb_typeof(p_categories) is distinct from 'array' then
    raise exception 'Categories must be a list';
  end if;

  for v_category in select value from jsonb_array_elements(p_categories) loop
    v_order := v_order + 1;
    v_category_id := nullif(v_category ->> 'id', '')::uuid;

    if v_category_id is null then
      insert into public.categories (team_id, name, question, sort_order, is_active)
      values (
        p_team_id,
        trim(v_category ->> 'name'),
        nullif(trim(v_category ->> 'question'), ''),
        v_order,
        true
      )
      returning id into v_category_id;
    else
      update public.categories c
      set name = trim(v_category ->> 'name'),
          question = nullif(trim(v_category ->> 'question'), ''),
          sort_order = v_order,
          is_active = true
      where c.id = v_category_id and c.team_id = p_team_id;
      if not found then
        raise exception 'Category does not belong to the team';
      end if;
    end if;
    v_kept := v_kept || v_category_id;

    v_kept_subs := '{}';
    v_sub_order := 0;
    for v_sub in select value from jsonb_array_elements(coalesce(v_category -> 'subcategories', '[]'::jsonb)) loop
      v_sub_order := v_sub_order + 1;
      v_sub_id := nullif(v_sub ->> 'id', '')::uuid;
      if v_sub_id is null then
        insert into public.subcategories (category_id, name, sort_order, is_active)
        values (v_category_id, trim(v_sub ->> 'name'), v_sub_order, true)
        returning id into v_sub_id;
      else
        update public.subcategories s
        set name = trim(v_sub ->> 'name'), sort_order = v_sub_order, is_active = true
        where s.id = v_sub_id and s.category_id = v_category_id;
        if not found then
          raise exception 'Subcategory does not belong to the category';
        end if;
      end if;
      v_kept_subs := v_kept_subs || v_sub_id;
    end loop;

    update public.subcategories s
    set is_active = false
    where s.category_id = v_category_id and s.is_active and not (s.id = any (v_kept_subs));
  end loop;

  update public.categories c
  set is_active = false
  where c.team_id = p_team_id and c.is_active and not (c.id = any (v_kept));
end;
$$;

-- ---------------------------------------------------------------------------
-- save_position_targets: replaces the positions shown on the team's pitch and
-- their target counts in one transaction. A row means the position is shown.
--
-- p_targets: [{"position_code": "MV", "target_count": 1}, …]
-- ---------------------------------------------------------------------------

create or replace function public.save_position_targets(p_team_id uuid, p_targets jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if not public.is_club_admin(public.team_club_id(p_team_id)) then
    raise exception 'Only the club''s admins can change positions';
  end if;
  if jsonb_typeof(p_targets) is distinct from 'array' then
    raise exception 'Targets must be a list';
  end if;

  delete from public.position_targets pt where pt.team_id = p_team_id;
  insert into public.position_targets (team_id, position_code, target_count)
  select p_team_id, r ->> 'position_code', (r ->> 'target_count')::smallint
  from jsonb_array_elements(p_targets) as r;
end;
$$;

revoke execute on function
  public.save_categories(uuid, jsonb),
  public.save_position_targets(uuid, jsonb)
from public, anon;
grant execute on function
  public.save_categories(uuid, jsonb),
  public.save_position_targets(uuid, jsonb)
to authenticated;
