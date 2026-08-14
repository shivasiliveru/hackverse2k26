-- =========================================================================
-- HackVerse 2K26 — replace sample teams with the real registered roster
--
-- 88 teams. Team IDs are DERIVED from row position in the organiser's
-- spreadsheet (position N -> HV2026-00NN); positions 7, 8 and 10 were blank
-- in both columns, so HV2026-0007/0008/0010 do not exist. IDs therefore run
-- 0001..0091 with those three absent.
--
-- Removes every is_sample = true team (and any allocation they hold) and
-- inserts these as real teams: is_sample = false, status 'eligible'.
-- Finally syncs event_settings.total_registered_teams to the real roster size.
-- Re-runnable: real teams are upserted on team_id.
--
-- Rebuilding from scratch is therefore exactly two steps:
--   1. setup-new-project.sql   (schema, domains, problem statements)
--   2. this file               (real roster + registered count)
-- =========================================================================

begin;

-- Sample teams hold no real allocations, but clear them first so the
-- teams delete cannot trip the allocations foreign key.
delete from public.allocations
where team_id in (select id from public.teams where is_sample = true);

delete from public.teams where is_sample = true;

insert into public.teams (team_id, team_name, is_sample, status, allocation_status) values
  ('HV2026-0001', 'DeepThinkers', false, 'eligible', 'not_allocated'),
  ('HV2026-0002', 'Falcon', false, 'eligible', 'not_allocated'),
  ('HV2026-0003', 'Team Combat', false, 'eligible', 'not_allocated'),
  ('HV2026-0004', 'Error 404', false, 'eligible', 'not_allocated'),
  ('HV2026-0005', 'VLAJ', false, 'eligible', 'not_allocated'),
  ('HV2026-0006', 'Tech Titans', false, 'eligible', 'not_allocated'),
  ('HV2026-0009', 'SheRise', false, 'eligible', 'not_allocated'),
  ('HV2026-0011', 'Ravens', false, 'eligible', 'not_allocated'),
  ('HV2026-0012', 'Tech Titans', false, 'eligible', 'not_allocated'),
  ('HV2026-0013', 'Spark', false, 'eligible', 'not_allocated'),
  ('HV2026-0014', 'Team nova', false, 'eligible', 'not_allocated'),
  ('HV2026-0015', 'Code Titans', false, 'eligible', 'not_allocated'),
  ('HV2026-0016', 'EXECUTIONERS', false, 'eligible', 'not_allocated'),
  ('HV2026-0017', 'Void', false, 'eligible', 'not_allocated'),
  ('HV2026-0018', 'Black Opps', false, 'eligible', 'not_allocated'),
  ('HV2026-0019', 'Void', false, 'eligible', 'not_allocated'),
  ('HV2026-0020', 'ARIA', false, 'eligible', 'not_allocated'),
  ('HV2026-0021', 'MARUTHI', false, 'eligible', 'not_allocated'),
  ('HV2026-0022', 'TECH TOPPERS', false, 'eligible', 'not_allocated'),
  ('HV2026-0023', 'HackSmiths', false, 'eligible', 'not_allocated'),
  ('HV2026-0024', 'VAJRA', false, 'eligible', 'not_allocated'),
  ('HV2026-0025', 'OverClock', false, 'eligible', 'not_allocated'),
  ('HV2026-0026', 'The sparkle Moon 🌙', false, 'eligible', 'not_allocated'),
  ('HV2026-0027', 'HackX', false, 'eligible', 'not_allocated'),
  ('HV2026-0028', 'Innovexa', false, 'eligible', 'not_allocated'),
  ('HV2026-0029', 'Mind hack Zombies', false, 'eligible', 'not_allocated'),
  ('HV2026-0030', 'TEAM MARVEL', false, 'eligible', 'not_allocated'),
  ('HV2026-0031', 'Vajrion', false, 'eligible', 'not_allocated'),
  ('HV2026-0032', 'Code Sprout', false, 'eligible', 'not_allocated'),
  ('HV2026-0033', 'CODE4CHANGE', false, 'eligible', 'not_allocated'),
  ('HV2026-0034', 'Spirts', false, 'eligible', 'not_allocated'),
  ('HV2026-0035', 'Devil squad', false, 'eligible', 'not_allocated'),
  ('HV2026-0036', 'Future Stack', false, 'eligible', 'not_allocated'),
  ('HV2026-0037', 'Hack Titans', false, 'eligible', 'not_allocated'),
  ('HV2026-0038', '404 NOT FOUND', false, 'eligible', 'not_allocated'),
  ('HV2026-0039', 'Team vignan', false, 'eligible', 'not_allocated'),
  ('HV2026-0040', 'Code-X', false, 'eligible', 'not_allocated'),
  ('HV2026-0041', 'Achievers', false, 'eligible', 'not_allocated'),
  ('HV2026-0042', 'Among Us', false, 'eligible', 'not_allocated'),
  ('HV2026-0043', 'Algorithm avengers', false, 'eligible', 'not_allocated'),
  ('HV2026-0044', 'Hackers', false, 'eligible', 'not_allocated'),
  ('HV2026-0045', 'logic legends', false, 'eligible', 'not_allocated'),
  ('HV2026-0046', 'CODE4GE', false, 'eligible', 'not_allocated'),
  ('HV2026-0047', 'GARUDA TEAM', false, 'eligible', 'not_allocated'),
  ('HV2026-0048', 'Team X', false, 'eligible', 'not_allocated'),
  ('HV2026-0049', 'Team Kanyaraasi', false, 'eligible', 'not_allocated'),
  ('HV2026-0050', 'DATA DYNAMOS', false, 'eligible', 'not_allocated'),
  ('HV2026-0051', 'Vortex', false, 'eligible', 'not_allocated'),
  ('HV2026-0052', 'Team INVICTUS', false, 'eligible', 'not_allocated'),
  ('HV2026-0053', 'Code & chaos', false, 'eligible', 'not_allocated'),
  ('HV2026-0054', 'Data Miners', false, 'eligible', 'not_allocated'),
  ('HV2026-0055', 'Mahadev', false, 'eligible', 'not_allocated'),
  ('HV2026-0056', 'DYGAS UNITED', false, 'eligible', 'not_allocated'),
  ('HV2026-0057', 'Innovexa', false, 'eligible', 'not_allocated'),
  ('HV2026-0058', 'Team Lakshmi', false, 'eligible', 'not_allocated'),
  ('HV2026-0059', 'PNK', false, 'eligible', 'not_allocated'),
  ('HV2026-0060', 'Team Gopika', false, 'eligible', 'not_allocated'),
  ('HV2026-0061', 'CARE-CONNECT', false, 'eligible', 'not_allocated'),
  ('HV2026-0062', 'Team Freaks.exe', false, 'eligible', 'not_allocated'),
  ('HV2026-0063', 'innovateX', false, 'eligible', 'not_allocated'),
  ('HV2026-0064', 'TEAM FRONX', false, 'eligible', 'not_allocated'),
  ('HV2026-0065', 'TechVortex', false, 'eligible', 'not_allocated'),
  ('HV2026-0066', 'Aa Naluguru', false, 'eligible', 'not_allocated'),
  ('HV2026-0067', 'Hack veda', false, 'eligible', 'not_allocated'),
  ('HV2026-0068', 'tech titans', false, 'eligible', 'not_allocated'),
  ('HV2026-0069', 'Octanova', false, 'eligible', 'not_allocated'),
  ('HV2026-0070', 'Hackaholic', false, 'eligible', 'not_allocated'),
  ('HV2026-0071', 'TEAM 47', false, 'eligible', 'not_allocated'),
  ('HV2026-0072', 'Nexora', false, 'eligible', 'not_allocated'),
  ('HV2026-0073', 'Trackers', false, 'eligible', 'not_allocated'),
  ('HV2026-0074', 'The Warriors', false, 'eligible', 'not_allocated'),
  ('HV2026-0075', 'Power house', false, 'eligible', 'not_allocated'),
  ('HV2026-0076', 'CODE NOVA', false, 'eligible', 'not_allocated'),
  ('HV2026-0077', 'Deadlock', false, 'eligible', 'not_allocated'),
  ('HV2026-0078', 'UDHBAV', false, 'eligible', 'not_allocated'),
  ('HV2026-0079', 'Tech squad', false, 'eligible', 'not_allocated'),
  ('HV2026-0080', 'TEAM ROBLOX', false, 'eligible', 'not_allocated'),
  ('HV2026-0081', 'Mind Matrix', false, 'eligible', 'not_allocated'),
  ('HV2026-0082', 'Nexora team', false, 'eligible', 'not_allocated'),
  ('HV2026-0083', 'Smart solutions', false, 'eligible', 'not_allocated'),
  ('HV2026-0084', 'CodeX⚡', false, 'eligible', 'not_allocated'),
  ('HV2026-0085', 'CODESLAYERS', false, 'eligible', 'not_allocated'),
  ('HV2026-0086', 'Team SyncX', false, 'eligible', 'not_allocated'),
  ('HV2026-0087', 'Data Dragons', false, 'eligible', 'not_allocated'),
  ('HV2026-0088', 'Quantum hackers', false, 'eligible', 'not_allocated'),
  ('HV2026-0089', 'Code commanders', false, 'eligible', 'not_allocated'),
  ('HV2026-0090', 'RIYAN''S TEAM', false, 'eligible', 'not_allocated'),
  ('HV2026-0091', 'Demon Slayer', false, 'eligible', 'not_allocated')
on conflict (team_id) do update set
  team_name = excluded.team_name,
  is_sample = false;

-- Idempotent: re-running refreshes the name and clears sample status.
-- (Deliberately does NOT reset status/allocation_status, so a re-run
--  mid-event cannot wipe an allocation a team already locked.)


-- public_stats.total_registered_teams reads this stored column, NOT a live
-- count of public.teams — and event_settings.total_registered_teams carries a
-- column default of 80, applied whenever setup-new-project.sql recreates the
-- table. Without this the landing page and /closed report 80 registered teams
-- against an 88-team roster. Derived from the table so it cannot drift.
update public.event_settings
set total_registered_teams = (select count(*) from public.teams where is_sample = false)
where id = 1;

commit;
