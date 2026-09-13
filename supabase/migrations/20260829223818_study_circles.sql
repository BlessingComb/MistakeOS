-- Study Circles are private, invite-only groups. This migration deliberately
-- never references local MistakeOS mistakes, photos, answers, or repair rules.
create table if not exists public.study_circles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 72),
  subject text not null check (char_length(btrim(subject)) between 2 and 48),
  goal text check (goal is null or char_length(btrim(goal)) between 1 and 180),
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{3}-[A-Z0-9]{4}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.circle_members (
  circle_id uuid not null references public.study_circles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);

create table if not exists public.circle_posts (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.study_circles(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (char_length(btrim(subject)) between 1 and 72),
  mistake_type text check (mistake_type is null or char_length(btrim(mistake_type)) <= 80),
  problem_summary text check (problem_summary is null or char_length(problem_summary) <= 500),
  what_went_wrong text check (what_went_wrong is null or char_length(what_went_wrong) <= 1200),
  lesson text check (lesson is null or char_length(lesson) <= 1200),
  prevention_rule text check (prevention_rule is null or char_length(prevention_rule) <= 1200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.circle_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.circle_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.circle_reactions (
  post_id uuid not null references public.circle_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('same', 'helpful', 'good_catch')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, reaction)
);

create index if not exists circle_members_user_idx on public.circle_members(user_id, circle_id);
create index if not exists circle_posts_feed_idx on public.circle_posts(circle_id, created_at desc);
create index if not exists circle_comments_post_idx on public.circle_comments(post_id, created_at asc);
create index if not exists study_circles_invite_code_idx on public.study_circles(invite_code);

alter table public.study_circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.circle_posts enable row level security;
alter table public.circle_comments enable row level security;
alter table public.circle_reactions enable row level security;

grant select, insert, update, delete on public.study_circles, public.circle_members, public.circle_posts, public.circle_comments, public.circle_reactions to authenticated;

create or replace function public.is_circle_member(target_circle_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.circle_members where circle_id = target_circle_id and user_id = (select auth.uid()));
$$;

create or replace function public.create_study_circle(circle_name text, circle_subject text, circle_goal text default null)
returns public.study_circles language plpgsql security definer set search_path = '' as $$
declare created public.study_circles; code text;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 3) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
  insert into public.study_circles (owner_id, name, subject, goal, invite_code)
  values ((select auth.uid()), btrim(circle_name), btrim(circle_subject), nullif(btrim(circle_goal), ''), code)
  returning * into created;
  insert into public.circle_members(circle_id, user_id, role) values (created.id, (select auth.uid()), 'owner');
  return created;
end;
$$;

create or replace function public.preview_circle_by_code(code text)
returns table(id uuid, name text, subject text, member_count bigint) language sql stable security definer set search_path = '' as $$
  select c.id, c.name, c.subject, count(m.user_id)
  from public.study_circles c left join public.circle_members m on m.circle_id = c.id
  where c.invite_code = upper(btrim(code))
  group by c.id;
$$;

create or replace function public.join_circle_by_code(code text)
returns table(id uuid, name text, subject text) language plpgsql security definer set search_path = '' as $$
declare target public.study_circles;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into target from public.study_circles where invite_code = upper(btrim(code));
  if target.id is null then raise exception 'Invalid invite code'; end if;
  insert into public.circle_members(circle_id, user_id) values (target.id, (select auth.uid())) on conflict do nothing;
  return query select target.id, target.name, target.subject;
end;
$$;

revoke all on function public.is_circle_member(uuid) from public;
revoke all on function public.create_study_circle(text, text, text) from public;
revoke all on function public.preview_circle_by_code(text) from public;
revoke all on function public.join_circle_by_code(text) from public;
grant execute on function public.create_study_circle(text, text, text), public.preview_circle_by_code(text), public.join_circle_by_code(text) to authenticated;

create policy "circles members read" on public.study_circles for select to authenticated using (public.is_circle_member(id));
create policy "circles owner update" on public.study_circles for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "circles owner delete" on public.study_circles for delete to authenticated using (owner_id = (select auth.uid()));
create policy "circle members read" on public.circle_members for select to authenticated using (public.is_circle_member(circle_id));
create policy "circle members owner removes" on public.circle_members for delete to authenticated using (exists (select 1 from public.study_circles where id = circle_id and owner_id = (select auth.uid())) and role = 'member');
create policy "circle members self leave" on public.circle_members for delete to authenticated using (user_id = (select auth.uid()) and role = 'member');
create policy "circle posts members read" on public.circle_posts for select to authenticated using (public.is_circle_member(circle_id));
create policy "circle posts members insert" on public.circle_posts for insert to authenticated with check (author_id = (select auth.uid()) and public.is_circle_member(circle_id));
create policy "circle posts author update" on public.circle_posts for update to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()) and public.is_circle_member(circle_id));
create policy "circle posts author delete" on public.circle_posts for delete to authenticated using (author_id = (select auth.uid()));
create policy "circle comments members read" on public.circle_comments for select to authenticated using (exists (select 1 from public.circle_posts p where p.id = post_id and public.is_circle_member(p.circle_id)));
create policy "circle comments members insert" on public.circle_comments for insert to authenticated with check (author_id = (select auth.uid()) and exists (select 1 from public.circle_posts p where p.id = post_id and public.is_circle_member(p.circle_id)));
create policy "circle comments author delete" on public.circle_comments for delete to authenticated using (author_id = (select auth.uid()));
create policy "circle reactions members read" on public.circle_reactions for select to authenticated using (exists (select 1 from public.circle_posts p where p.id = post_id and public.is_circle_member(p.circle_id)));
create policy "circle reactions members insert" on public.circle_reactions for insert to authenticated with check (user_id = (select auth.uid()) and exists (select 1 from public.circle_posts p where p.id = post_id and public.is_circle_member(p.circle_id)));
create policy "circle reactions self delete" on public.circle_reactions for delete to authenticated using (user_id = (select auth.uid()));
