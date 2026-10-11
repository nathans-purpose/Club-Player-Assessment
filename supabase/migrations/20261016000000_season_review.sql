-- Säsong: the leaders' evaluation of a season as a team (results, ratings of
-- tactic and training areas, strengths and weaknesses, outlook) and their
-- plan for the next one (strategy, priorities, desired squad, recruitment).
-- Admins and leaders share all of it; players never have accounts.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Facts about a season that are not in the match log: the final league
-- position, how the goals came, and totals for seasons without a match log
-- (for example last season, entered only for comparison).
create table public.season_reviews (
  season_id uuid primary key references public.seasons (id) on delete cascade,
  final_position smallint check (final_position between 1 and 99),
  manual_matches smallint check (manual_matches between 0 and 99),
  manual_points smallint check (manual_points between 0 and 300),
  manual_goals_for smallint check (manual_goals_for between 0 and 999),
  manual_goals_against smallint check (manual_goals_against between 0 and 999),
  -- {"build_up": {"scored": 3, "conceded": 1}, …}; keys from lib/season/goal-sources.ts
  goal_sources jsonb not null default '{}'::jsonb check (jsonb_typeof(goal_sources) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.season_matches (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  round smallint check (round between 1 and 99),
  played_on date,
  opponent text not null check (length(trim(opponent)) between 1 and 80),
  venue text check (venue in ('home', 'away')),
  half text check (half in ('spring', 'autumn')),
  -- Both null = not played yet.
  goals_for smallint check (goals_for between 0 and 99),
  goals_against smallint check (goals_against between 0 and 99),
  comment text check (length(comment) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((goals_for is null) = (goals_against is null))
);
create index season_matches_season_id_idx on public.season_matches (season_id);

-- The tactic and training areas leaders rate, per team. Deactivate instead of
-- deleting so earlier seasons keep their ratings.
create table public.evaluation_areas (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  group_name text not null check (length(trim(group_name)) > 0),
  name text not null check (length(trim(name)) > 0),
  question text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index evaluation_areas_team_id_idx on public.evaluation_areas (team_id);

-- One evaluation per leader and season, filled in alone. Drafts are private.
create table public.season_evaluations (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  leader_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  strengths text[] not null default '{}' check (cardinality(strengths) <= 3),
  weaknesses text[] not null default '{}' check (cardinality(weaknesses) <= 3),
  -- How good the team is next season compared with the league, 1–10.
  outlook_level smallint check (outlook_level between 1 and 10),
  -- Where the team ends up next season if nothing changes.
  outlook_position smallint check (outlook_position between 1 and 99),
  outlook_key_factor text check (length(outlook_key_factor) <= 500),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, leader_id)
);
create index season_evaluations_leader_id_idx on public.season_evaluations (leader_id);

-- A row exists when the leader answered anything for the area. Score null =
-- "can't judge".
create table public.season_evaluation_ratings (
  evaluation_id uuid not null references public.season_evaluations (id) on delete cascade,
  area_id uuid not null references public.evaluation_areas (id) on delete cascade,
  score smallint check (score between 1 and 10),
  training text check (training in ('too_little', 'right', 'too_much')),
  comment text check (length(comment) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (evaluation_id, area_id)
);

-- The plan for a season, written before or during it.
create table public.season_plans (
  season_id uuid primary key references public.seasons (id) on delete cascade,
  goal text check (length(goal) <= 1000),
  strategy text check (length(strategy) <= 3000),
  formation text check (length(formation) <= 100),
  keep_doing text check (length(keep_doing) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- At most a handful of improvement areas, each with a goal, an action, an
-- owner and a follow-up date.
create table public.plan_priorities (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  sort_order integer not null default 0,
  area text not null check (length(trim(area)) between 1 and 100),
  goal text check (length(goal) <= 300),
  action text check (length(action) <= 300),
  owner text check (length(owner) <= 100),
  follow_up text check (length(follow_up) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index plan_priorities_season_id_idx on public.plan_priorities (season_id);

-- Desired squad: how many players the leaders want per position, and a
-- line on the role.
create table public.squad_plan_positions (
  season_id uuid not null references public.seasons (id) on delete cascade,
  position_code text not null check (
    position_code in ('MV', 'VB', 'VMB', 'HMB', 'HB', 'DM', 'VM', 'CM', 'HM', 'OM', 'VY', 'HY', 'A')
  ),
  wanted_count smallint not null default 0 check (wanted_count between 0 and 9),
  role_note text check (length(role_note) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (season_id, position_code)
);

-- Where each current player fits in the plan.
create table public.squad_plan_players (
  season_id uuid not null references public.seasons (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  status text not null check (status in ('key', 'stays', 'uncertain', 'leaving')),
  position_code text check (
    position_code in ('MV', 'VB', 'VMB', 'HMB', 'HB', 'DM', 'VM', 'CM', 'HM', 'OM', 'VY', 'HY', 'A')
  ),
  note text check (length(note) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (season_id, player_id)
);
create index squad_plan_players_player_id_idx on public.squad_plan_players (player_id);

-- Players from outside the club the leaders would like to sign. Kept to what
-- the leaders need: no contact details.
create table public.recruitment_targets (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 1 and 100),
  current_club text check (length(current_club) <= 100),
  position_code text check (
    position_code in ('MV', 'VB', 'VMB', 'HMB', 'HB', 'DM', 'VM', 'CM', 'HM', 'OM', 'VY', 'HY', 'A')
  ),
  priority smallint not null default 2 check (priority in (1, 2, 3)),
  status text not null default 'idea' check (status in ('idea', 'contacted', 'talking', 'signed', 'declined')),
  note text check (length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recruitment_targets_season_id_idx on public.recruitment_targets (season_id);

do $$
declare
  t text;
begin
  foreach t in array array[
    'season_reviews', 'season_matches', 'evaluation_areas', 'season_evaluations',
    'season_evaluation_ratings', 'season_plans', 'plan_priorities', 'squad_plan_positions',
    'squad_plan_players', 'recruitment_targets'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------

-- A season evaluation is readable by its author, and by club members once
-- submitted, like assessments.
create or replace function public.can_read_season_evaluation(p_evaluation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.season_evaluations e
    where e.id = p_evaluation_id
      and (
        e.leader_id = auth.uid()
        or (e.status = 'submitted' and public.is_club_member(public.season_club_id(e.season_id)))
      )
  );
$$;

create or replace function public.owns_season_evaluation(p_evaluation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.season_evaluations e
    where e.id = p_evaluation_id
      and e.leader_id = auth.uid()
      and public.is_club_member(public.season_club_id(e.season_id))
  );
$$;

-- ---------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------

create or replace function public.validate_season_evaluation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (new.leader_id <> old.leader_id or new.season_id <> old.season_id) then
    raise exception 'Evaluation author and season cannot change';
  end if;
  if new.status = 'submitted' and (tg_op = 'INSERT' or old.status <> 'submitted') then
    new.submitted_at = now();
  elsif new.status = 'draft' then
    new.submitted_at = null;
  end if;
  return new;
end;
$$;

create trigger season_evaluations_validate
  before insert or update on public.season_evaluations
  for each row execute function public.validate_season_evaluation();

-- Ratings must use areas of the season's own team.
create or replace function public.validate_season_evaluation_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.season_evaluations e
    join public.seasons s on s.id = e.season_id
    join public.evaluation_areas a on a.team_id = s.team_id
    where e.id = new.evaluation_id and a.id = new.area_id
  ) then
    raise exception 'Area does not belong to the evaluation''s team';
  end if;
  return new;
end;
$$;

create trigger season_evaluation_ratings_validate
  before insert or update on public.season_evaluation_ratings
  for each row execute function public.validate_season_evaluation_rating();

-- Planned players must be in the season's team.
create or replace function public.validate_squad_plan_player()
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
  return new;
end;
$$;

create trigger squad_plan_players_validate
  before insert or update on public.squad_plan_players
  for each row execute function public.validate_squad_plan_player();

-- Child rows cannot be moved to another season (and with it, another club).
create or replace function public.keep_season_id()
returns trigger
language plpgsql
as $$
begin
  if new.season_id <> old.season_id then
    raise exception 'Season cannot change';
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'season_reviews', 'season_matches', 'season_plans', 'plan_priorities',
    'squad_plan_positions', 'squad_plan_players', 'recruitment_targets'
  ] loop
    execute format(
      'create trigger keep_season_id before update on public.%I
         for each row execute function public.keep_season_id()', t);
  end loop;
end;
$$;

create or replace function public.keep_area_team_id()
returns trigger
language plpgsql
as $$
begin
  if new.team_id <> old.team_id then
    raise exception 'Team cannot change';
  end if;
  return new;
end;
$$;

create trigger keep_team_id before update on public.evaluation_areas
  for each row execute function public.keep_area_team_id();

-- ---------------------------------------------------------------------------
-- Default areas: the 21 areas of the season evaluation template, for every
-- team, existing and new.
-- ---------------------------------------------------------------------------

create or replace function public.insert_default_evaluation_areas(p_team_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.evaluation_areas (team_id, group_name, name, question, sort_order)
  select p_team_id, d.group_name, d.name, d.question, d.ord
  from (values
    (1, 'Med boll', 'Speluppbyggnad', 'Tar vi oss förbi motståndarens första press, från målvakt och backlinje?'),
    (2, 'Med boll', 'Etablerat anfallsspel', 'Skapar vi övertag, bredd och djup när vi har bollen på deras planhalva?'),
    (3, 'Med boll', 'Chansskapande och avslut', 'Skapar vi tillräckligt många bra lägen, och sätter vi dem?'),
    (4, 'Utan boll', 'Press och återerövring', 'Pressar vi tillsammans och vinner bollen där vi vill?'),
    (5, 'Utan boll', 'Försvar i block', 'Står vi kompakt med rätt avstånd när vi försvarar lågt eller på mitten?'),
    (6, 'Utan boll', 'Försvar av straffområdet', 'Stoppar vi inlägg och avslut i och runt boxen?'),
    (7, 'Omställningar', 'Omställning till anfall', 'Utnyttjar vi lägena direkt efter bollvinst?'),
    (8, 'Omställningar', 'Omställning till försvar', 'Reagerar vi snabbt efter bollförlust och stoppar kontringar?'),
    (9, 'Fasta situationer', 'Fasta situationer anfall', 'Gör vi mål på hörnor, frisparkar och inkast?'),
    (10, 'Fasta situationer', 'Fasta situationer försvar', 'Håller vi tätt på motståndarens fasta?'),
    (11, 'Matchplan och coachning', 'Spelidé och formation', 'Har vi en tydlig spelidé som passar truppen, och förstår spelarna den?'),
    (12, 'Matchplan och coachning', 'Matchförberedelse', 'Anpassar vi oss till motståndaren och vet spelarna sina uppgifter?'),
    (13, 'Matchplan och coachning', 'Coachning under match', 'Fungerar byten, omställningar i taktiken och besked från sidlinjen?'),
    (14, 'Träning', 'Röd tråd i träningen', 'Finns en plan över säsongen, och bygger passen på varandra?'),
    (15, 'Träning', 'Koppling träning – match', 'Tränar vi det vi vill se i matcherna, i matchlika situationer?'),
    (16, 'Träning', 'Tempo och kvalitet', 'Är intensiteten och kraven på träning tillräckligt höga?'),
    (17, 'Träning', 'Fysisk träning', 'Håller vi fysiskt hela matchen och säsongen ut? Få skador?'),
    (18, 'Träning', 'Träningsnärvaro', 'Kommer spelarna, hela säsongen?'),
    (19, 'Laget och ledarna', 'Mentalitet', 'Hur reagerar vi när vi ligger under? Vinner vi jämna matcher?'),
    (20, 'Laget och ledarna', 'Truppens nivå och bredd', 'Räcker nivån för serien? Har vi två alternativ per position?'),
    (21, 'Laget och ledarna', 'Kommunikation med spelarna', 'Vet spelarna vad som gäller: roller, uttagningar, besked?')
  ) as d (ord, group_name, name, question);
$$;

revoke execute on function public.insert_default_evaluation_areas(uuid) from public, anon, authenticated;

create or replace function public.handle_new_team()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.insert_default_evaluation_areas(new.id);
  return new;
end;
$$;

create trigger on_team_created
  after insert on public.teams
  for each row execute function public.handle_new_team();

select public.insert_default_evaluation_areas(t.id)
from public.teams t
where not exists (select 1 from public.evaluation_areas a where a.team_id = t.id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.season_reviews enable row level security;
alter table public.season_matches enable row level security;
alter table public.evaluation_areas enable row level security;
alter table public.season_evaluations enable row level security;
alter table public.season_evaluation_ratings enable row level security;
alter table public.season_plans enable row level security;
alter table public.plan_priorities enable row level security;
alter table public.squad_plan_positions enable row level security;
alter table public.squad_plan_players enable row level security;
alter table public.recruitment_targets enable row level security;

-- Shared season data: every member of the club reads and writes it.
do $$
declare
  t text;
begin
  foreach t in array array[
    'season_reviews', 'season_matches', 'season_plans', 'plan_priorities',
    'squad_plan_positions', 'squad_plan_players', 'recruitment_targets'
  ] loop
    execute format(
      'create policy %1$s_member on public.%1$I for all to authenticated
         using (public.is_club_member(public.season_club_id(season_id)))
         with check (public.is_club_member(public.season_club_id(season_id)))', t);
  end loop;
end;
$$;

create policy evaluation_areas_select on public.evaluation_areas for select to authenticated
  using (public.is_club_member(public.team_club_id(team_id)));
create policy evaluation_areas_write on public.evaluation_areas for all to authenticated
  using (public.is_club_admin(public.team_club_id(team_id)))
  with check (public.is_club_admin(public.team_club_id(team_id)));

create policy season_evaluations_select on public.season_evaluations for select to authenticated
  using (
    leader_id = auth.uid()
    or (status = 'submitted' and public.is_club_member(public.season_club_id(season_id)))
  );
create policy season_evaluations_insert on public.season_evaluations for insert to authenticated
  with check (leader_id = auth.uid() and public.is_club_member(public.season_club_id(season_id)));
create policy season_evaluations_update on public.season_evaluations for update to authenticated
  using (leader_id = auth.uid() and public.is_club_member(public.season_club_id(season_id)))
  with check (leader_id = auth.uid() and public.is_club_member(public.season_club_id(season_id)));
create policy season_evaluations_delete on public.season_evaluations for delete to authenticated
  using (leader_id = auth.uid());

create policy season_evaluation_ratings_select on public.season_evaluation_ratings for select to authenticated
  using (public.can_read_season_evaluation(evaluation_id));
create policy season_evaluation_ratings_write on public.season_evaluation_ratings for all to authenticated
  using (public.owns_season_evaluation(evaluation_id))
  with check (public.owns_season_evaluation(evaluation_id));

-- ---------------------------------------------------------------------------
-- create_season: a new (inactive) season for a team, with the default
-- phases, so the leaders can plan it. Admins only, through RLS.
-- ---------------------------------------------------------------------------

create or replace function public.create_season(p_team_id uuid, p_label text, p_phases text[])
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_season_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if exists (select 1 from public.seasons where team_id = p_team_id and label = trim(p_label)) then
    raise exception 'Season already exists';
  end if;

  insert into public.seasons (team_id, label, is_active)
  values (p_team_id, trim(p_label), false)
  returning id into v_season_id;

  insert into public.season_phases (season_id, name, sort_order)
  select v_season_id, phase.name, phase.ord
  from unnest(coalesce(p_phases, '{}')) with ordinality as phase (name, ord);

  return v_season_id;
end;
$$;

revoke execute on function public.create_season(uuid, text, text[]) from public, anon;
grant execute on function public.create_season(uuid, text, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- save_season_evaluation: upserts the caller's evaluation of a season and
-- replaces its ratings. Runs as the caller, so RLS applies. Like
-- assessments, a submitted evaluation changes only when submitted again.
--
-- p_ratings: [{"area_id": uuid, "score": 1–10 | null, "training": text | null, "comment": text | null}, …]
-- ---------------------------------------------------------------------------

create or replace function public.save_season_evaluation(
  p_season_id uuid,
  p_submit boolean,
  p_ratings jsonb,
  p_strengths text[],
  p_weaknesses text[],
  p_outlook_level smallint,
  p_outlook_position smallint,
  p_outlook_key_factor text
)
returns table (evaluation_id uuid, status text)
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

  select e.id, e.status into v_id, v_status
  from public.season_evaluations e
  where e.season_id = p_season_id and e.leader_id = auth.uid()
  for update;

  if v_status = 'submitted' and not p_submit then
    raise exception 'A submitted evaluation changes only when it is submitted again';
  end if;

  if v_id is null then
    insert into public.season_evaluations (season_id, leader_id, status)
    values (p_season_id, auth.uid(), 'draft')
    returning id into v_id;
  end if;

  update public.season_evaluations e set
    strengths = coalesce(p_strengths, '{}'),
    weaknesses = coalesce(p_weaknesses, '{}'),
    outlook_level = p_outlook_level,
    outlook_position = p_outlook_position,
    outlook_key_factor = nullif(trim(p_outlook_key_factor), '')
  where e.id = v_id;

  -- Replace ratings on active areas; keep history on inactive ones.
  delete from public.season_evaluation_ratings r
  using public.evaluation_areas a
  where r.evaluation_id = v_id and a.id = r.area_id and a.is_active;

  insert into public.season_evaluation_ratings (evaluation_id, area_id, score, training, comment)
  select v_id, (r ->> 'area_id')::uuid, (r ->> 'score')::smallint, r ->> 'training', nullif(trim(r ->> 'comment'), '')
  from jsonb_array_elements(coalesce(p_ratings, '[]'::jsonb)) as r
  where exists (select 1 from public.evaluation_areas a where a.id = (r ->> 'area_id')::uuid and a.is_active);

  if p_submit then
    update public.season_evaluations e set status = 'submitted' where e.id = v_id;
  end if;

  return query
  select e.id, e.status from public.season_evaluations e where e.id = v_id;
end;
$$;

revoke execute on function public.save_season_evaluation(uuid, boolean, jsonb, text[], text[], smallint, smallint, text)
  from public, anon;
grant execute on function public.save_season_evaluation(uuid, boolean, jsonb, text[], text[], smallint, smallint, text)
  to authenticated;

-- Same grants as the initial schema: nothing for anon, RLS decides for
-- signed-in users.
revoke all on
  public.season_reviews, public.season_matches, public.evaluation_areas, public.season_evaluations,
  public.season_evaluation_ratings, public.season_plans, public.plan_priorities,
  public.squad_plan_positions, public.squad_plan_players, public.recruitment_targets
  from anon;
grant select, insert, update, delete on
  public.season_reviews, public.season_matches, public.evaluation_areas, public.season_evaluations,
  public.season_evaluation_ratings, public.season_plans, public.plan_priorities,
  public.squad_plan_positions, public.squad_plan_players, public.recruitment_targets
  to authenticated;
revoke execute on function
  public.can_read_season_evaluation(uuid),
  public.owns_season_evaluation(uuid)
from public, anon;
grant execute on function
  public.can_read_season_evaluation(uuid),
  public.owns_season_evaluation(uuid)
to authenticated;
