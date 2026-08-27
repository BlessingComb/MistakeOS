-- MistakeOS social data deliberately excludes mistakes, photos, answers and Repair Rules.
-- This migration may encounter a pre-existing Auth-compatible profiles table. Reuse it
-- and add only the columns/constraints required by MistakeOS without replacing its rows.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade
);

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'id' and udt_name = 'uuid'
  ) then
    raise exception 'public.profiles.id must exist and use type uuid before MistakeOS can migrate it';
  end if;
end
$$;

alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists created_at timestamptz;

-- Backfill only values missing from a legacy profiles table. Existing display names and
-- timestamps are preserved. User metadata is used only as presentation data, never auth.
update public.profiles as profile
set display_name = case
  when char_length(btrim(coalesce(users.raw_user_meta_data ->> 'display_name', ''))) between 2 and 32
    then btrim(users.raw_user_meta_data ->> 'display_name')
  when char_length(btrim(coalesce(users.raw_user_meta_data ->> 'full_name', ''))) between 2 and 32
    then btrim(users.raw_user_meta_data ->> 'full_name')
  else 'Learner ' || left(profile.id::text, 8)
end
from auth.users as users
where users.id = profile.id and profile.display_name is null;

update public.profiles
set display_name = 'Learner ' || left(id::text, 8)
where display_name is null;

update public.profiles set created_at = now() where created_at is null;

alter table public.profiles alter column display_name set not null;
alter table public.profiles alter column created_at set default now();
alter table public.profiles alter column created_at set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'p'
  ) then
    alter table public.profiles add constraint profiles_pkey primary key (id);
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid = 'public.profiles'::regclass
      and constraint_row.contype = 'f'
      and constraint_row.confrelid = 'auth.users'::regclass
      and constraint_row.conkey = array[(
        select attribute.attnum
        from pg_attribute attribute
        where attribute.attrelid = 'public.profiles'::regclass and attribute.attname = 'id'
      )]::smallint[]
  ) then
    alter table public.profiles
      add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and conname = 'profiles_display_name_check'
  ) then
    alter table public.profiles
      add constraint profiles_display_name_check
      check (char_length(display_name) between 2 and 32) not valid;
  end if;

  -- A NOT VALID constraint preserves incompatible legacy names while protecting all new
  -- writes. Validate it immediately when the existing data already conforms.
  if not exists (
    select 1 from public.profiles
    where char_length(display_name) not between 2 and 32
  ) then
    alter table public.profiles validate constraint profiles_display_name_check;
  end if;
end
$$;

create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 48),
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9-]{6,20}$'),
  captain_user_id uuid not null references public.profiles(id),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

do $$
begin
  if to_regtype('public.league_member_status') is null then
    create type public.league_member_status as enum ('active', 'paused', 'left');
  end if;
end
$$;

create table if not exists public.league_members (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.league_member_status not null default 'active',
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

do $$
begin
  if to_regtype('public.xp_event_type') is null then
    create type public.xp_event_type as enum (
      'mistake_added',
      'never_again_completed',
      'pattern_resisted',
      'risk_score_reduced',
      'topic_recovering',
      'topic_mastered',
      'exam_prep_map_completed',
      'league_challenge_completed'
    );
  end if;
end
$$;

create table if not exists public.xp_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type public.xp_event_type not null,
  amount integer not null check (amount > 0 and amount <= 100),
  source_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, event_type, source_id)
);

do $$
begin
  if to_regtype('public.league_challenge_type') is null then
    create type public.league_challenge_type as enum ('recovery', 'mastery', 'prep', 'consistency');
  end if;
end
$$;

create table if not exists public.league_challenges (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  type public.league_challenge_type not null,
  title text not null check (char_length(title) between 2 and 100),
  target integer not null check (target > 0 and target <= 20),
  ends_at timestamptz not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.challenge_progress (
  challenge_id uuid not null references public.league_challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  progress integer not null default 0 check (progress >= 0),
  completed_at timestamptz,
  primary key (challenge_id, user_id)
);

create index if not exists league_members_user_id_idx on public.league_members(user_id);
create index if not exists xp_transactions_weekly_idx on public.xp_transactions(user_id, created_at desc);
create index if not exists league_challenges_league_idx on public.league_challenges(league_id, ends_at desc);

alter table public.profiles enable row level security;
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.xp_transactions enable row level security;
alter table public.league_challenges enable row level security;
alter table public.challenge_progress enable row level security;

-- Keep client privileges explicit and scoped to this migration's tables. Social writes
-- other than the user's own profile remain server-only, as documented below.
revoke all privileges on table
  public.profiles,
  public.leagues,
  public.league_members,
  public.xp_transactions,
  public.league_challenges,
  public.challenge_progress
from anon, authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant select on table
  public.leagues,
  public.league_members,
  public.xp_transactions,
  public.league_challenges,
  public.challenge_progress
to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles self update') then
    create policy "profiles self update" on public.profiles for update to authenticated
      using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles league members read') then
    create policy "profiles league members read" on public.profiles for select to authenticated
      using (id = (select auth.uid()) or exists (
        select 1 from public.league_members mine
        join public.league_members theirs on mine.league_id = theirs.league_id
        where mine.user_id = (select auth.uid()) and mine.status = 'active' and theirs.user_id = profiles.id
      ));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles self create') then
    create policy "profiles self create" on public.profiles for insert to authenticated
      with check ((select auth.uid()) = id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'league_members' and policyname = 'members read own leagues') then
    create policy "members read own leagues" on public.league_members for select to authenticated
      using (exists (
        select 1 from public.league_members mine
        where mine.league_id = league_members.league_id and mine.user_id = (select auth.uid()) and mine.status <> 'left'
      ));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'leagues' and policyname = 'leagues read as member') then
    create policy "leagues read as member" on public.leagues for select to authenticated
      using (exists (
        select 1 from public.league_members mine
        where mine.league_id = leagues.id and mine.user_id = (select auth.uid()) and mine.status <> 'left'
      ));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'xp_transactions' and policyname = 'xp read own or league peers') then
    create policy "xp read own or league peers" on public.xp_transactions for select to authenticated
      using (user_id = (select auth.uid()) or exists (
        select 1 from public.league_members mine
        join public.league_members peer on mine.league_id = peer.league_id
        where mine.user_id = (select auth.uid()) and mine.status = 'active'
          and peer.user_id = xp_transactions.user_id and peer.status <> 'left'
      ));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'league_challenges' and policyname = 'challenges read as member') then
    create policy "challenges read as member" on public.league_challenges for select to authenticated
      using (exists (
        select 1 from public.league_members mine
        where mine.league_id = league_challenges.league_id and mine.user_id = (select auth.uid()) and mine.status <> 'left'
      ));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'challenge_progress' and policyname = 'progress read as member') then
    create policy "progress read as member" on public.challenge_progress for select to authenticated
      using (exists (
        select 1 from public.league_challenges challenge
        join public.league_members mine on mine.league_id = challenge.league_id
        where challenge.id = challenge_progress.challenge_id
          and mine.user_id = (select auth.uid()) and mine.status <> 'left'
      ));
  end if;
end
$$;

-- Writes that change membership, captainship or XP are intentionally server-only.
-- A Supabase Edge Function must verify RevenueCat's pro entitlement before calling
-- privileged commands, and must insert xp_transactions from trusted domain events.
