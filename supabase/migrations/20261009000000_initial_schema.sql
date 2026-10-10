-- Initial schema: clubs, members, squad, seasons, categories, assessments.
-- Every table is scoped to a club through Row Level Security.

-- Supabase installs pgcrypto in the extensions schema; this is a no-op there.
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  crest_url text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.club_members (
  club_id uuid not null references public.clubs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'leader')),
  invited_by uuid references auth.users (id) on delete set null,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (club_id, user_id)
);
create index club_members_user_id_idx on public.club_members (user_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  -- null for shareable link invites
  email text,
  role text not null default 'leader' check (role in ('admin', 'leader')),
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index invites_club_id_idx on public.invites (club_id);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  game_format smallint not null default 11 check (game_format in (11, 9, 7, 5)),
  has_minors boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index teams_club_id_idx on public.teams (club_id);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  label text not null,
  match_count integer not null default 0 check (match_count >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index seasons_team_id_idx on public.seasons (team_id);
-- At most one active season per team.
create unique index seasons_one_active_per_team on public.seasons (team_id) where is_active;

create table public.season_phases (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  name text not null,
  starts_on date,
  ends_on date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_on is null or ends_on is null or starts_on <= ends_on)
);
create index season_phases_season_id_idx on public.season_phases (season_id);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  shirt_number text,
  full_name text not null check (length(trim(full_name)) > 0),
  squad_group text check (squad_group in ('MV', 'FÖ', 'MF', 'AN')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index players_team_id_idx on public.players (team_id);

create table public.player_season_stats (
  player_id uuid not null references public.players (id) on delete cascade,
  season_id uuid not null references public.seasons (id) on delete cascade,
  matches integer check (matches >= 0),
  minutes_est integer check (minutes_est >= 0),
  goals integer check (goals >= 0),
  assists integer check (assists >= 0),
  yellow_cards integer check (yellow_cards >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (player_id, season_id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  question text,
  sort_order integer not null default 0,
  -- Deactivate instead of deleting so historic scores are kept.
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index categories_team_id_idx on public.categories (team_id);

create table public.subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subcategories_category_id_idx on public.subcategories (category_id);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  leader_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  comment text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, player_id, leader_id)
);
create index assessments_player_id_idx on public.assessments (player_id);
create index assessments_leader_id_idx on public.assessments (leader_id);

create table public.assessment_scores (
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  subcategory_id uuid references public.subcategories (id) on delete cascade,
  score smallint not null check (score between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (assessment_id, category_id, subcategory_id)
);

create table public.assessment_positions (
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  position_code text not null check (
    position_code in ('MV', 'VB', 'VMB', 'HMB', 'HB', 'DM', 'VM', 'CM', 'HM', 'OM', 'VY', 'HY', 'A')
  ),
  -- 3 = Naturlig, 2 = Funkar bra, 1 = Kan spela
  level smallint not null check (level in (1, 2, 3)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (assessment_id, position_code)
);

create table public.assessment_attendance (
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  phase_id uuid not null references public.season_phases (id) on delete cascade,
  -- Row absent = "Vet ej"
  value smallint not null check (value in (95, 80, 55, 25)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (assessment_id, phase_id)
);

create table public.position_targets (
  team_id uuid not null references public.teams (id) on delete cascade,
  position_code text not null check (
    position_code in ('MV', 'VB', 'VMB', 'HMB', 'HB', 'DM', 'VM', 'CM', 'HM', 'OM', 'VY', 'HY', 'A')
  ),
  target_count smallint not null default 1 check (target_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (team_id, position_code)
);

create table public.club_identity (
  club_id uuid primary key references public.clubs (id) on delete cascade,
  source_file_url text,
  colors jsonb not null default '{}'::jsonb,
  fonts jsonb not null default '{}'::jsonb,
  logos jsonb not null default '{}'::jsonb,
  tone_words text[] not null default '{}',
  is_applied boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ui_text_overrides (
  club_id uuid not null references public.clubs (id) on delete cascade,
  key text not null,
  value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (club_id, key)
);

-- updated_at triggers on every table
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'clubs', 'club_members', 'invites', 'teams', 'seasons', 'season_phases',
    'players', 'player_season_stats', 'categories', 'subcategories', 'assessments',
    'assessment_scores', 'assessment_positions', 'assessment_attendance', 'position_targets',
    'club_identity', 'ui_text_overrides'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Access helpers. SECURITY DEFINER so policies can look up membership without
-- recursing into club_members' own policies.
-- ---------------------------------------------------------------------------

create or replace function public.is_club_member(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.club_members
    where club_id = p_club_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_club_admin(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.club_members
    where club_id = p_club_id and user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.team_club_id(p_team_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select club_id from public.teams where id = p_team_id;
$$;

create or replace function public.season_club_id(p_season_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.club_id
  from public.seasons s
  join public.teams t on t.id = s.team_id
  where s.id = p_season_id;
$$;

create or replace function public.category_club_id(p_category_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.club_id
  from public.categories c
  join public.teams t on t.id = c.team_id
  where c.id = p_category_id;
$$;

create or replace function public.player_club_id(p_player_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.club_id
  from public.players p
  join public.teams t on t.id = p.team_id
  where p.id = p_player_id;
$$;

-- An assessment is readable by its author, and by club members once submitted.
-- Drafts are private to the author.
create or replace function public.can_read_assessment(p_assessment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.assessments a
    where a.id = p_assessment_id
      and (
        a.leader_id = auth.uid()
        or (a.status = 'submitted' and public.is_club_member(public.season_club_id(a.season_id)))
      )
  );
$$;

-- Only the author may change an assessment's scores, positions and attendance,
-- and only while still a member of the club.
create or replace function public.owns_assessment(p_assessment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.assessments a
    where a.id = p_assessment_id
      and a.leader_id = auth.uid()
      and public.is_club_member(public.season_club_id(a.season_id))
  );
$$;

create or replace function public.shares_club_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.club_members mine
    join public.club_members theirs on theirs.club_id = mine.club_id
    where mine.user_id = auth.uid() and theirs.user_id = p_user_id
  );
$$;

-- ---------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------

-- New auth users get a profile row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The creator of a club becomes its first admin.
create or replace function public.handle_new_club()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.club_members (club_id, user_id, role)
    values (new.id, new.created_by, 'admin')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger on_club_created
  after insert on public.clubs
  for each row execute function public.handle_new_club();

-- A club must always keep at least one admin.
create or replace function public.ensure_club_keeps_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin'
     and (tg_op = 'DELETE' or new.role <> 'admin')
     -- Allow the cascade when the whole club is deleted.
     and exists (select 1 from public.clubs where id = old.club_id)
     and not exists (
       select 1 from public.club_members
       where club_id = old.club_id and role = 'admin' and user_id <> old.user_id
     )
  then
    raise exception 'A club must have at least one admin';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger club_members_keep_admin
  before update or delete on public.club_members
  for each row execute function public.ensure_club_keeps_admin();

-- Assessments: player and season must belong to the same team, the author must
-- be a club member, and submitted_at follows status.
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
  elsif new.status = 'draft' then
    new.submitted_at = null;
  end if;

  return new;
end;
$$;

create trigger assessments_validate
  before insert or update on public.assessments
  for each row execute function public.validate_assessment();

-- Scores must use the player's team's categories, and a subcategory must belong
-- to the given category.
create or replace function public.validate_assessment_score()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.assessments a
    join public.players p on p.id = a.player_id
    join public.categories c on c.team_id = p.team_id
    where a.id = new.assessment_id and c.id = new.category_id
  ) then
    raise exception 'Category does not belong to the player''s team';
  end if;

  if new.subcategory_id is not null and not exists (
    select 1 from public.subcategories
    where id = new.subcategory_id and category_id = new.category_id
  ) then
    raise exception 'Subcategory does not belong to the category';
  end if;

  return new;
end;
$$;

create trigger assessment_scores_validate
  before insert or update on public.assessment_scores
  for each row execute function public.validate_assessment_score();

create or replace function public.validate_assessment_attendance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.assessments a
    join public.season_phases ph on ph.season_id = a.season_id
    where a.id = new.assessment_id and ph.id = new.phase_id
  ) then
    raise exception 'Phase does not belong to the assessment''s season';
  end if;
  return new;
end;
$$;

create trigger assessment_attendance_validate
  before insert or update on public.assessment_attendance
  for each row execute function public.validate_assessment_attendance();

-- Stats must reference a season of the player's team.
create or replace function public.validate_player_season_stats()
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

create trigger player_season_stats_validate
  before insert or update on public.player_season_stats
  for each row execute function public.validate_player_season_stats();

-- ---------------------------------------------------------------------------
-- Invites
-- ---------------------------------------------------------------------------

-- Accept an invite for the signed-in user. Email invites are single-use and
-- must match the user's email; link invites (email is null) can be used by
-- anyone with the token until they expire.
create or replace function public.accept_invite(p_token text)
returns uuid
language plpgsql
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

  select * into v_invite from public.invites where token = p_token for update;
  if not found then
    raise exception 'Invite not found';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'Invite has expired';
  end if;

  if v_invite.email is not null then
    if v_invite.accepted_at is not null then
      raise exception 'Invite has already been used';
    end if;
    select email into v_email from auth.users where id = auth.uid();
    if lower(v_email) is distinct from lower(v_invite.email) then
      raise exception 'Invite was sent to another email address';
    end if;
    update public.invites set accepted_at = now() where id = v_invite.id;
  end if;

  -- Never downgrade an existing admin through an invite.
  insert into public.club_members (club_id, user_id, role, invited_by)
  values (v_invite.club_id, auth.uid(), v_invite.role, v_invite.created_by)
  on conflict (club_id, user_id) do update
    set role = case
      when public.club_members.role = 'admin' then 'admin'
      else excluded.role
    end;

  return v_invite.club_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.invites enable row level security;
alter table public.teams enable row level security;
alter table public.seasons enable row level security;
alter table public.season_phases enable row level security;
alter table public.players enable row level security;
alter table public.player_season_stats enable row level security;
alter table public.categories enable row level security;
alter table public.subcategories enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_scores enable row level security;
alter table public.assessment_positions enable row level security;
alter table public.assessment_attendance enable row level security;
alter table public.position_targets enable row level security;
alter table public.club_identity enable row level security;
alter table public.ui_text_overrides enable row level security;

-- profiles: yourself and people in your clubs.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_club_with(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- clubs: any signed-in user can create a club; members read; admins manage.
-- The creator clause lets `insert ... returning` see the new row before the
-- membership trigger's insert is visible to the policy check.
create policy clubs_select on public.clubs for select to authenticated
  using (public.is_club_member(id) or created_by = auth.uid());
create policy clubs_insert on public.clubs for insert to authenticated
  with check (created_by = auth.uid());
create policy clubs_update on public.clubs for update to authenticated
  using (public.is_club_admin(id)) with check (public.is_club_admin(id));
create policy clubs_delete on public.clubs for delete to authenticated
  using (public.is_club_admin(id));

-- club_members: members see each other; admins add, change and remove.
-- Joining happens through clubs_insert (creator) or accept_invite().
create policy club_members_select on public.club_members for select to authenticated
  using (public.is_club_member(club_id));
create policy club_members_insert on public.club_members for insert to authenticated
  with check (public.is_club_admin(club_id));
create policy club_members_update on public.club_members for update to authenticated
  using (public.is_club_admin(club_id)) with check (public.is_club_admin(club_id));
create policy club_members_delete on public.club_members for delete to authenticated
  using (public.is_club_admin(club_id) or user_id = auth.uid());

-- invites: admins only. Accepting goes through accept_invite().
create policy invites_select on public.invites for select to authenticated
  using (public.is_club_admin(club_id));
create policy invites_insert on public.invites for insert to authenticated
  with check (public.is_club_admin(club_id));
create policy invites_update on public.invites for update to authenticated
  using (public.is_club_admin(club_id)) with check (public.is_club_admin(club_id));
create policy invites_delete on public.invites for delete to authenticated
  using (public.is_club_admin(club_id));

-- Club-scoped settings and squad data: members read, admins write.
create policy teams_select on public.teams for select to authenticated
  using (public.is_club_member(club_id));
create policy teams_write on public.teams for all to authenticated
  using (public.is_club_admin(club_id)) with check (public.is_club_admin(club_id));

create policy seasons_select on public.seasons for select to authenticated
  using (public.is_club_member(public.team_club_id(team_id)));
create policy seasons_write on public.seasons for all to authenticated
  using (public.is_club_admin(public.team_club_id(team_id)))
  with check (public.is_club_admin(public.team_club_id(team_id)));

create policy season_phases_select on public.season_phases for select to authenticated
  using (public.is_club_member(public.season_club_id(season_id)));
create policy season_phases_write on public.season_phases for all to authenticated
  using (public.is_club_admin(public.season_club_id(season_id)))
  with check (public.is_club_admin(public.season_club_id(season_id)));

create policy players_select on public.players for select to authenticated
  using (public.is_club_member(public.team_club_id(team_id)));
create policy players_write on public.players for all to authenticated
  using (public.is_club_admin(public.team_club_id(team_id)))
  with check (public.is_club_admin(public.team_club_id(team_id)));

create policy player_season_stats_select on public.player_season_stats for select to authenticated
  using (public.is_club_member(public.player_club_id(player_id)));
create policy player_season_stats_write on public.player_season_stats for all to authenticated
  using (public.is_club_admin(public.player_club_id(player_id)))
  with check (public.is_club_admin(public.player_club_id(player_id)));

create policy categories_select on public.categories for select to authenticated
  using (public.is_club_member(public.team_club_id(team_id)));
create policy categories_write on public.categories for all to authenticated
  using (public.is_club_admin(public.team_club_id(team_id)))
  with check (public.is_club_admin(public.team_club_id(team_id)));

create policy subcategories_select on public.subcategories for select to authenticated
  using (public.is_club_member(public.category_club_id(category_id)));
create policy subcategories_write on public.subcategories for all to authenticated
  using (public.is_club_admin(public.category_club_id(category_id)))
  with check (public.is_club_admin(public.category_club_id(category_id)));

create policy position_targets_select on public.position_targets for select to authenticated
  using (public.is_club_member(public.team_club_id(team_id)));
create policy position_targets_write on public.position_targets for all to authenticated
  using (public.is_club_admin(public.team_club_id(team_id)))
  with check (public.is_club_admin(public.team_club_id(team_id)));

create policy club_identity_select on public.club_identity for select to authenticated
  using (public.is_club_member(club_id));
create policy club_identity_write on public.club_identity for all to authenticated
  using (public.is_club_admin(club_id)) with check (public.is_club_admin(club_id));

create policy ui_text_overrides_select on public.ui_text_overrides for select to authenticated
  using (public.is_club_member(club_id));
create policy ui_text_overrides_write on public.ui_text_overrides for all to authenticated
  using (public.is_club_admin(club_id)) with check (public.is_club_admin(club_id));

-- assessments: authors manage their own; submitted ones are visible to the club.
-- Admins may delete any assessment in their club (data deletion requests).
create policy assessments_select on public.assessments for select to authenticated
  using (
    leader_id = auth.uid()
    or (status = 'submitted' and public.is_club_member(public.season_club_id(season_id)))
  );
create policy assessments_insert on public.assessments for insert to authenticated
  with check (
    leader_id = auth.uid()
    and public.is_club_member(public.season_club_id(season_id))
  );
create policy assessments_update on public.assessments for update to authenticated
  using (leader_id = auth.uid() and public.is_club_member(public.season_club_id(season_id)))
  with check (leader_id = auth.uid() and public.is_club_member(public.season_club_id(season_id)));
create policy assessments_delete on public.assessments for delete to authenticated
  using (
    leader_id = auth.uid()
    or public.is_club_admin(public.season_club_id(season_id))
  );

create policy assessment_scores_select on public.assessment_scores for select to authenticated
  using (public.can_read_assessment(assessment_id));
create policy assessment_scores_write on public.assessment_scores for all to authenticated
  using (public.owns_assessment(assessment_id))
  with check (public.owns_assessment(assessment_id));

create policy assessment_positions_select on public.assessment_positions for select to authenticated
  using (public.can_read_assessment(assessment_id));
create policy assessment_positions_write on public.assessment_positions for all to authenticated
  using (public.owns_assessment(assessment_id))
  with check (public.owns_assessment(assessment_id));

create policy assessment_attendance_select on public.assessment_attendance for select to authenticated
  using (public.can_read_assessment(assessment_id));
create policy assessment_attendance_write on public.assessment_attendance for all to authenticated
  using (public.owns_assessment(assessment_id))
  with check (public.owns_assessment(assessment_id));

-- ---------------------------------------------------------------------------
-- Grants. The anon role gets nothing; signed-in users go through RLS.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke execute on function
  public.accept_invite(text),
  public.is_club_member(uuid),
  public.is_club_admin(uuid),
  public.team_club_id(uuid),
  public.season_club_id(uuid),
  public.category_club_id(uuid),
  public.player_club_id(uuid),
  public.can_read_assessment(uuid),
  public.owns_assessment(uuid),
  public.shares_club_with(uuid)
from public, anon;
grant execute on function
  public.accept_invite(text),
  public.is_club_member(uuid),
  public.is_club_admin(uuid),
  public.team_club_id(uuid),
  public.season_club_id(uuid),
  public.category_club_id(uuid),
  public.player_club_id(uuid),
  public.can_read_assessment(uuid),
  public.owns_assessment(uuid),
  public.shares_club_with(uuid)
to authenticated;
