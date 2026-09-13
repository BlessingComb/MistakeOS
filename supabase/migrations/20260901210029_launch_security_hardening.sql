-- Explicitly revoke per-role execution as well as PUBLIC execution. Functions
-- otherwise remain callable by anon through the Data API on existing projects.
revoke all on function public.is_circle_member(uuid) from public, anon, authenticated;
revoke all on function public.create_study_circle(text, text, text) from public, anon, authenticated;
revoke all on function public.preview_circle_by_code(text) from public, anon, authenticated;
revoke all on function public.join_circle_by_code(text) from public, anon, authenticated;

grant execute on function public.create_study_circle(text, text, text) to authenticated;
grant execute on function public.preview_circle_by_code(text) to authenticated;
grant execute on function public.join_circle_by_code(text) to authenticated;

-- Defense in depth for the pending ranking migration as well as an already
-- deployed one. Only a signed-in member may invoke these functions.
revoke all on function public.record_study_group_correction(uuid) from public, anon, authenticated;
revoke all on function public.get_study_group_ranking(uuid, text) from public, anon, authenticated;
grant execute on function public.record_study_group_correction(uuid) to authenticated;
grant execute on function public.get_study_group_ranking(uuid, text) to authenticated;

-- Advisor-reported foreign-key indexes for common group/recovery cleanup and
-- membership reads. These are additive and do not change data or RLS behavior.
create index if not exists challenge_progress_user_id_idx on public.challenge_progress(user_id);
create index if not exists circle_comments_author_id_idx on public.circle_comments(author_id);
create index if not exists circle_posts_author_id_idx on public.circle_posts(author_id);
create index if not exists circle_reactions_user_id_idx on public.circle_reactions(user_id);
create index if not exists league_challenges_created_by_idx on public.league_challenges(created_by);
create index if not exists leagues_captain_user_id_idx on public.leagues(captain_user_id);
create index if not exists recovery_sessions_mistake_id_idx on public.recovery_sessions(mistake_id);
create index if not exists study_circles_owner_id_idx on public.study_circles(owner_id);
