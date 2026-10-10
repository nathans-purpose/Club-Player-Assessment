-- Demo data for local development: one club, one team, 17 players, 4 leaders
-- (1 admin + 3 leaders) and sample assessments. Every name here is made up.
-- Runs automatically on `supabase db reset`.
--
-- Sign in locally with a magic link to any of:
--   demo-admin@example.com (admin), demo-ledare1/2/3@example.com (leaders)
-- The emails land in the local mail viewer (http://127.0.0.1:54324).

do $$
declare
  v_club_id uuid := '00000000-0000-4000-a000-000000000001';
  v_team_id uuid := '00000000-0000-4000-a000-000000000002';
  v_season_id uuid := '00000000-0000-4000-a000-000000000003';
  v_leaders uuid[] := array[
    '00000000-0000-4000-b000-000000000001',
    '00000000-0000-4000-b000-000000000002',
    '00000000-0000-4000-b000-000000000003',
    '00000000-0000-4000-b000-000000000004'
  ]::uuid[];
  v_leader_names text[] := array['Demo Admin', 'Demo Ledare Ett', 'Demo Ledare Två', 'Demo Ledare Tre'];
  v_leader_emails text[] := array[
    'demo-admin@example.com', 'demo-ledare1@example.com',
    'demo-ledare2@example.com', 'demo-ledare3@example.com'
  ];

  -- shirt number, name, squad group, natural position, secondary position, base rating
  v_players jsonb := '[
    ["1",  "Albin Ekström",    "MV", "MV",  null,  7],
    ["12", "Hugo Lindqvist",   "MV", "MV",  null,  6],
    ["2",  "Elias Berg",       "FÖ", "HB",  "HMB", 6],
    ["3",  "Oskar Nyberg",     "FÖ", "VMB", "HMB", 7],
    ["4",  "Liam Sandberg",    "FÖ", "HMB", "VMB", 8],
    ["5",  "Viktor Holm",      "FÖ", "VB",  "VM",  6],
    ["13", "Theo Wikström",    "FÖ", "HB",  "HM",  5],
    ["15", "Isak Lund",        "FÖ", "VMB", "DM",  5],
    ["6",  "Leo Forsberg",     "MF", "DM",  "CM",  7],
    ["8",  "Noah Engström",    "MF", "CM",  "OM",  8],
    ["10", "Lucas Åberg",      "MF", "OM",  "CM",  8],
    ["7",  "William Dahl",     "MF", "HM",  "HY",  6],
    ["11", "Adam Sjöberg",     "MF", "VM",  "VY",  6],
    ["9",  "Melvin Strand",    "AN", "A",   null,  8],
    ["14", "Alvin Björk",      "AN", "A",   "OM",  7],
    ["17", "Sixten Hedlund",   "AN", "VY",  "A",   6],
    ["19", "Gustav Falk",      "AN", "HY",  "A",   5]
  ]';
  v_categories text[][] := array[
    array['Teknik', 'Hur väl behärskar spelaren bollen?'],
    array['Spelförståelse', 'Hur väl läser spelaren spelet?'],
    array['Fysik', 'Hur stark, snabb och uthållig är spelaren?'],
    array['Inställning', 'Hur är spelarens attityd och vilja?'],
    array['Lagspel', 'Hur väl spelar spelaren för laget?'],
    array['Utveckling', 'Hur mycket har spelaren utvecklats?']
  ];
  v_comments text[] := array[
    'Stark säsong, tar stort ansvar.',
    'Behöver jobba på första touchen.',
    'Bra inställning på träningarna.',
    null,
    'Kan ta nästa steg med mer speltid.'
  ];
  v_attendance smallint[] := array[95, 80, 55, 25];

  v_player_ids uuid[] := '{}';
  v_category_ids uuid[] := '{}';
  v_subcategory_ids uuid[] := '{}';
  v_phase_ids uuid[] := '{}';
  v_id uuid;
  v_assessment_id uuid;
  v_player jsonb;
  v_status text;
  v_base int;
  v_score int;
  p int;
  i int;
  c int;
  s int;
  ph int;
begin
  -- Leaders. The profile is created by the on_auth_user_created trigger.
  for i in 1..4 loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token,
      email_change_token_new, email_change, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000', v_leaders[i], 'authenticated', 'authenticated',
      v_leader_emails[i], '', now(),
      '{"provider": "email", "providers": ["email"]}', jsonb_build_object('full_name', v_leader_names[i]),
      '', '', '', '', now(), now()
    );
    insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      v_leaders[i]::text, v_leaders[i],
      jsonb_build_object('sub', v_leaders[i]::text, 'email', v_leader_emails[i]),
      'email', now(), now(), now()
    );
  end loop;

  -- Club; the creator becomes admin through the on_club_created trigger.
  insert into public.clubs (id, name, slug, created_by)
  values (v_club_id, 'Exempelklubben IF', 'exempelklubben', v_leaders[1]);
  for i in 2..4 loop
    insert into public.club_members (club_id, user_id, role, invited_by)
    values (v_club_id, v_leaders[i], 'leader', v_leaders[1]);
  end loop;

  insert into public.teams (id, club_id, name, game_format, has_minors)
  values (v_team_id, v_club_id, 'Herr A', 11, false);

  insert into public.seasons (id, team_id, label, match_count, is_active)
  values (v_season_id, v_team_id, '2026', 22, true);

  for ph in 1..4 loop
    insert into public.season_phases (season_id, name, starts_on, ends_on, sort_order)
    values (
      v_season_id,
      (array['Försäsong', 'Första halvan', 'Uppstart andra halvan', 'Andra halvan'])[ph],
      (array['2026-01-15', '2026-04-01', '2026-07-15', '2026-08-15'])[ph]::date,
      (array['2026-03-31', '2026-06-30', '2026-08-14', '2026-10-31'])[ph]::date,
      ph
    )
    returning id into v_id;
    v_phase_ids := v_phase_ids || v_id;
  end loop;

  -- 4-4-2
  insert into public.position_targets (team_id, position_code, target_count)
  values
    (v_team_id, 'MV', 1), (v_team_id, 'VB', 1), (v_team_id, 'VMB', 1), (v_team_id, 'HMB', 1),
    (v_team_id, 'HB', 1), (v_team_id, 'VM', 1), (v_team_id, 'CM', 2), (v_team_id, 'HM', 1),
    (v_team_id, 'A', 2);

  for c in 1..6 loop
    insert into public.categories (team_id, name, question, sort_order)
    values (v_team_id, v_categories[c][1], v_categories[c][2], c)
    returning id into v_id;
    v_category_ids := v_category_ids || v_id;
  end loop;

  -- Teknik is deepened with three subcategories.
  foreach v_status in array array['Passningar', 'Första touch', 'Avslut'] loop
    insert into public.subcategories (category_id, name, sort_order)
    values (v_category_ids[1], v_status, coalesce(array_length(v_subcategory_ids, 1), 0) + 1)
    returning id into v_id;
    v_subcategory_ids := v_subcategory_ids || v_id;
  end loop;

  for p in 1..jsonb_array_length(v_players) loop
    v_player := v_players -> (p - 1);
    insert into public.players (team_id, shirt_number, full_name, squad_group)
    values (v_team_id, v_player ->> 0, v_player ->> 1, v_player ->> 2)
    returning id into v_id;
    v_player_ids := v_player_ids || v_id;

    insert into public.player_season_stats (player_id, season_id, matches, minutes_est, goals, assists, yellow_cards)
    values (
      v_id, v_season_id,
      8 + (p * 5) % 15,
      (8 + (p * 5) % 15) * (60 + (p * 7) % 31),
      case when v_player ->> 2 in ('AN', 'MF') then (p * 3) % 9 else (p % 3) / 2 end,
      case when v_player ->> 2 = 'MV' then 0 else (p * 2) % 6 end,
      (p * 5) % 4
    );
  end loop;

  -- Assessments. Each leader skips a few players and leaves a few drafts.
  -- The last player only gets two assessments ("få bedömningar"), and player 5
  -- gets a split verdict on Teknik ("Oeniga – diskutera").
  for p in 1..array_length(v_player_ids, 1) loop
    v_player := v_players -> (p - 1);
    v_base := (v_player ->> 5)::int;

    for i in 1..4 loop
      continue when (p + i) % 9 = 0;
      continue when p = 17 and i > 2;
      v_status := case when (p * 3 + i) % 11 = 0 then 'draft' else 'submitted' end;

      insert into public.assessments (season_id, player_id, leader_id, status, comment)
      values (v_season_id, v_player_ids[p], v_leaders[i], v_status, v_comments[1 + (p + i) % 5])
      returning id into v_assessment_id;

      for c in 1..6 loop
        v_score := least(10, greatest(1, v_base + (p * 7 + i * 13 + c * 5) % 3 - 1 - (c = 6)::int));
        if p = 5 and c = 1 then
          v_score := case when i = 1 then 9 else 5 end;
        end if;

        if c = 1 then
          -- Deepened: one score per subcategory.
          for s in 1..3 loop
            insert into public.assessment_scores (assessment_id, category_id, subcategory_id, score)
            values (
              v_assessment_id, v_category_ids[c], v_subcategory_ids[s],
              least(10, greatest(1, v_score + (p + s + i) % 3 - 1))
            );
          end loop;
        else
          insert into public.assessment_scores (assessment_id, category_id, score)
          values (v_assessment_id, v_category_ids[c], v_score);
        end if;
      end loop;

      insert into public.assessment_positions (assessment_id, position_code, level)
      values (v_assessment_id, v_player ->> 3, case when (p + i) % 5 = 0 then 2 else 3 end);
      if v_player ->> 4 is not null and (p + i) % 3 <> 0 then
        insert into public.assessment_positions (assessment_id, position_code, level)
        values (v_assessment_id, v_player ->> 4, 1 + (p + i) % 2);
      end if;

      -- Attendance; some phases are left as "Vet ej" (no row).
      for ph in 1..4 loop
        continue when (p + i + ph) % 7 = 0;
        insert into public.assessment_attendance (assessment_id, phase_id, value)
        values (v_assessment_id, v_phase_ids[ph], v_attendance[1 + (p * ph + i) % 4 / 2 + (p % 5 = 0)::int * 2]);
      end loop;
    end loop;
  end loop;
end;
$$;
