-- public_stats is the anon-facing live counter for the participant pages.
-- It was created with security_invoker = true, so the view executed under the
-- caller's RLS. allocations and teams are admin-only, which meant anon read
-- allocated_teams = 0 no matter how many teams had locked a problem statement:
-- the landing progress bar, "N / 50 TEAMS ALLOCATED" and the client-side
-- closed gate were all permanently stuck at zero.
--
-- Running the view as its owner keeps the aggregate correct while the
-- underlying rows stay unreadable to anon — only these six scalars are exposed.
alter view public.public_stats set (security_invoker = false);
