# HackVerse Allocator

Build a complete, production-ready web application for HackVerse 2K26 whose primary purpose is problem statement selection for registered hackathon teams.

The application must have two completely separate experiences:

Participant Problem Statement Selection

Secure Admin Dashboard

The website must feel like a real hackathon competition platform, not like a generic AI-generated SaaS dashboard.

1. Core Hackathon Rules

There are:

80 registered teams

25 problem statements

Every problem statement can be selected by a maximum of 2 teams

Therefore, only 50 teams can successfully receive a problem statement

The remaining 30 teams must be marked as disqualified / unsuccessful

Allocation works on a strict first-come-first-served basis

Once the capacity of a problem statement reaches 2 teams, nobody else can select it

The system must handle simultaneous users correctly so that two users cannot accidentally receive the final remaining slot at the same time

Important:

The allocation must be controlled by the backend/database, not just frontend state.

Use proper transactional logic / atomic database operations when a team confirms a problem statement.

Example:

Problem Statement PS-01 has capacity = 2.

Initial state:

2 / 2 slots available

Team A selects it:

1 / 2 slots available

Team B selects it:

0 / 2 slots available

Team C tries to select it:

FULL — This problem statement has already been taken by 2 teams.

Team C must not receive it.

2. Overall Website Structure

Create these routes/pages:

Public Participant Side

/

Landing / selection entry page

/select

Problem statement selection flow

/success

Successful allocation confirmation

/closed

Selection closed / unsuccessful page

Admin Side

/admin/login

Secure admin login

/admin

Admin dashboard

/admin/problem-statements

Manage problem statements

/admin/teams

View all teams

/admin/allocations

View problem statement allocations

/admin/domains

Manage domains

/admin/settings

Hackathon configuration / controls

3. Participant Landing Page

Create a polished HackVerse-branded landing page.

The page should immediately communicate:

HACKVERSE 2K26

Main heading

Problem Statement Selection

Subheading:

Choose your domain. Secure your problem statement. First come, first served.

Add a prominent CTA:

START SELECTION

Also show a live status section:

50 / 50 Slots Available

or dynamically:

34 / 50 Teams Allocated

Display:

Teams already allocated

Slots remaining

Total problem statements

Available problem statement slots

Make this visually interesting using a competition / esports / hackathon aesthetic.

Do not overdo futuristic effects.

Avoid:

excessive gradients

excessive glassmorphism

unnecessary floating 3D objects

generic AI dashboard cards

overly rounded everything

stock illustrations

fake AI-generated visual elements

The site should feel intentionally designed by a professional product designer.

4. Participant Selection Flow

The participant flow must be extremely simple.

Step 1 — Team Verification

Show a clean form.

Fields:

Team Name

Text input

Team ID

Text input

Button:

CONTINUE

When submitted:

Validate that the team exists

Validate that the team has not already selected a problem statement

Validate that the team is eligible

Validate that the team has not already been disqualified

Do not allow the same Team ID to make multiple allocations.

If already allocated:

Show:

This team has already selected a problem statement.

And display their previously assigned problem statement.

If the team ID does not exist:

Invalid Team ID. Please check your registration details.

If the team is already disqualified:

This team is not eligible for problem statement selection.

5. Step 2 — Domain Selection

After successful team verification, show all available domains.

Use large competition-style domain cards.

Example domains:

AI, Data Science & Smart Automation

Smart Manufacturing, MSMEs & Industry 6.0

Healthcare, Agriculture & Sustainable Development

Cyber Security, Cloud Computing & Digital Infrastructure

Smart Education, Mobility & Digital Society

The exact domains must come from the database and must be manageable from the admin dashboard.

Each domain should display:

Domain name

Number of problem statements

Number of remaining problem statement slots

Example:

AI, Data Science & Smart Automation

4 Problem Statements

3 Slots Remaining

6. Domain Full Logic

Before a participant can open a domain, check whether every problem statement inside that domain is already full.

Remember:

One problem statement has maximum capacity = 2.

For example:

Domain contains:

PS01 — 0 slots remaining
PS02 — 0 slots remaining
PS03 — 0 slots remaining
PS04 — 0 slots remaining

Then the entire domain is full.

Display:

DOMAIN FULL

Disable the domain card/button.

Under it show:

All problem statements in this domain have already been selected.

Do not allow the participant to enter that domain.

This check must be performed using live database data.

Do not rely only on frontend state.

7. Step 3 — Problem Statement Selection

When the participant selects an available domain, show all problem statements belonging to that domain.

Each problem statement should appear as a clean card.

Each card should contain:

Problem Statement ID

Example:

PS-07

Title

Example:

AI-Based Crop Disease Detection

Short Description

Display a concise preview.

Available Slots

Example:

2 slots available

or

1 slot available

or

FULL

Use a clear visual state system.

Available:

2 SLOTS

One remaining:

1 SLOT

Full:

FULL

A participant must never be able to select a problem statement whose remaining slots are 0.

8. Problem Statement Details

Clicking a problem statement should open a detailed view/modal/page.

Show:

Problem Statement ID

Domain

Title

Full problem statement

Requirements

Expected solution direction, if configured

Available slots

Current status

Primary button:

SELECT THIS PROBLEM STATEMENT

Do not immediately allocate it.

The participant must go through a confirmation step.

9. Confirmation Screen

Before allocation, show a clear confirmation screen.

Example:

Confirm Your Selection

Team:

Team Alpha

Team ID:

HV1023

Domain:

Artificial Intelligence, Data Science & Smart Automation

Problem Statement:

PS-07 — AI-Based Crop Disease Detection

Available slots:

1 remaining

Display warning:

Once confirmed, your problem statement cannot be changed.

Buttons:

GO BACK

CONFIRM & LOCK PROBLEM STATEMENT

The second button performs the actual allocation.

10. Critical Allocation Logic

This is the most important part of the application.

When the participant presses:

CONFIRM & LOCK PROBLEM STATEMENT

the backend must:

Re-check the team eligibility

Re-check whether the team already has an allocation

Re-check whether the problem statement still has an available slot

Atomically reserve the slot

Create the team allocation record

Reduce the remaining available slot

Mark the team as successfully allocated

Return the final allocation result

Update the admin dashboard immediately

The system must be safe against race conditions.

Example:

There is exactly 1 remaining slot.

Team A clicks confirm.

Team B clicks confirm almost simultaneously.

Only one team may receive the problem statement.

The other team must receive:

This problem statement was just taken by another team.

Then refresh the available problem statements.

Never allow:

remaining_slots = -1

Never allow:

3 teams assigned to one problem statement

11. Slot Display Logic

Every problem statement has:

capacity = 2

and:

remaining_slots = capacity - allocated_count

Display:

2 Available

when allocated_count = 0

1 Available

when allocated_count = 1

FULL

when allocated_count = 2

The UI must update automatically after any successful allocation.

12. Success Page

After successful allocation, redirect the participant to:

/success

Make this page feel like a competition victory/lock-in moment.

Show:

PROBLEM STATEMENT LOCKED

Team Name

Team ID

Domain

Problem Statement ID

Problem Statement Title

Allocation Number

Example:

Team #37 of 50

Add:

Your problem statement has been successfully locked.

Important message:

Problem statement allocations cannot be changed after confirmation.

Add a downloadable / printable allocation confirmation if possible.

Also show the timestamp of selection.

Example:

Selected on 18 August 2026, 10:03:21 AM

13. Selection Closed Logic

If all 50 available team slots are already occupied, participant selection must close.

Show a dedicated page:

SELECTION CLOSED

Message:

All 50 problem statement slots have been successfully allocated.

Also show:

80 Teams Registered

50 Teams Allocated

30 Teams Not Allocated

Do not allow new allocations after the allocation limit is reached.

This must be enforced by the backend.

14. Team Data Model

Create a proper database structure.

Teams table should contain at minimum:

id

team_id

team_name

leader_name if available

status

allocation_status

selected_problem_statement_id

selected_at

created_at

updated_at

Statuses can include:

eligible

allocated

disqualified

inactive

15. Problem Statement Data Model

Create a proper problem_statements table.

Fields:

id

problem_statement_id

title

description

full_description

domain_id

capacity

allocated_count

remaining_slots

status

created_at

updated_at

Default:

capacity = 2

Never hardcode 2 throughout the application.

Store it in the database/configuration so the admin can change it if required.

16. Domain Data Model

Create a domains table.

Fields:

id

name

description

display_order

is_active

created_at

updated_at

Problem statements should reference the domain through a foreign key.

17. Allocation Data Model

Create an allocations table.

Fields:

id

team_id

problem_statement_id

domain_id

allocation_number

selected_at

status

created_at

Add database constraints that prevent:

duplicate allocation for the same team

more than the allowed number of allocations for a problem statement

18. Global Allocation Counter

Create a central allocation counter or derive it safely from successful allocations.

Maximum:

50

Current:

COUNT(successful allocations)

Remaining:

50 - current allocations

Display this live throughout the application.

Example:

37 / 50 TEAMS ALLOCATED

13 SLOTS REMAINING

The admin should also be able to see this immediately.

19. Real-Time Updates

The participant UI and admin dashboard should reflect allocation changes immediately.

When one team selects a problem statement:

The following should update:

problem statement remaining slots

domain available count

total allocated teams

total remaining slots

admin allocation table

team statistics

Implement using realtime database subscriptions / websocket / appropriate realtime mechanism supported by the backend.

Do not require users to manually refresh the browser.

20. Admin Login

Create a secure admin login page.

Route:

/admin/login

Do not expose admin controls to normal users.

Use secure authentication.

Do not store passwords in frontend code.

Admin authentication must happen on the backend.

After authentication:

redirect to:

/admin

21. Admin Dashboard

Design a professional operational dashboard.

The dashboard should immediately show:

Total Teams

80

Successfully Allocated

37

Remaining Slots

13

Problem Statements

25

Domains

5

Disqualified

0

Make the numbers live.

Add a real-time activity feed:

Example:

10:03:21 — Team Alpha selected PS-07

10:03:28 — Team Nova selected PS-12

10:04:02 — Team Vertex selected PS-07

This helps admins monitor the live event.

22. Admin — Allocation Overview

Create a page where admins can see every problem statement.

Table columns:

PS ID

Problem Statement

Domain

Capacity

Allocated

Remaining

Status

Team 1

Team 2

Example:

PS IDProblemDomainCapacityAllocatedRemainingStatusPS-01AI Crop DetectionAI220FULLPS-02Smart LogisticsAutomation211AVAILABLE

Admins should be able to search and filter.

Filters:

Domain

Available

Full

Partially filled

23. Admin — Team Overview

Create an admin team page.

Display every team.

Columns:

Team ID

Team Name

Leader

Status

Problem Statement

Domain

Selected At

Allocation Status

Filters:

Allocated

Not Allocated

Disqualified

Eligible

Search by:

Team ID

Team Name

Leader Name

24. Admin — Add Problem Statement

Admins must be able to create new problem statements.

Form:

Problem Statement ID

Example:

PS-26

Title

Short Description

Full Description

Domain

Dropdown populated from the domain database.

Capacity

Default:

2

Status

Active / Inactive

Button:

CREATE PROBLEM STATEMENT

After creation, it must immediately appear in the participant system if active.

Validate unique Problem Statement IDs.

25. Admin — Edit Problem Statement

Admins should be able to edit:

title

description

full description

domain

capacity

active/inactive status

Be careful when editing capacity after allocations already exist.

Never allow the admin to reduce capacity below the number of currently allocated teams.

For example:

Allocated = 2

Admin cannot change capacity from 2 to 1.

Show:

Capacity cannot be lower than the number of existing allocations.

26. Admin — Add / Manage Domains

Admins must be able to:

Create domains

Edit domains

Activate/deactivate domains

Reorder domains

Deleting a domain with active problem statements should be prevented.

Show a warning:

This domain contains problem statements and cannot be deleted.

27. Admin — Allocation Details

When an admin clicks a problem statement, show detailed allocation information.

Example:

PS-07

AI-Based Crop Disease Detection

Domain:

AI, Data Science & Smart Automation

Capacity:

2

Allocated:

2

Remaining:

0

Status:

FULL

Teams:

Team Alpha — HV1007

Team Nova — HV1032

Show exact selection timestamps.

28. Admin — Emergency Controls

Create a Settings page with controls for the event admin.

Include:

Selection Status

OPEN

PAUSED

CLOSED

If paused:

Participants can access the website but cannot confirm a selection.

Display:

Problem statement selection is temporarily paused by the organizers.

If closed:

No further selection is allowed.

Also include:

Maximum Allocated Teams

Default:

50

Problem Statement Capacity

Default:

2

Event Name

HackVerse 2K26

All these should be stored in the database/configuration.

29. Disqualification Logic

The system must track the 80 registered teams.

Once 50 teams successfully receive problem statements:

50 teams = allocated

remaining eligible teams = unsuccessful / disqualified

Do not automatically mark them as disqualified before the allocation process is officially closed.

Instead, when the admin closes the selection process, provide a control:

FINALIZE & DISQUALIFY REMAINING TEAMS

After confirmation:

All eligible teams without an allocation become:

disqualified

Show a strong confirmation dialog before this action.

30. Audit Log

Create a complete audit log.

Track events such as:

Team verification

Problem statement selection attempt

Successful allocation

Failed allocation

Problem statement became full

Admin created problem statement

Admin edited problem statement

Admin paused selection

Admin closed selection

Admin finalized disqualifications

Store:

event

team

problem statement

timestamp

user/admin

metadata

This is extremely important during a live hackathon in case organizers need to investigate an issue.

31. Duplicate / Abuse Protection

Prevent the same participant from making multiple allocations.

Check:

Team ID

Authentication/session where applicable

Existing allocation record

Once a team receives a problem statement:

This team has already completed selection.

Do not allow them to return and change it.

Also add basic rate limiting to prevent excessive requests to selection endpoints.

32. Frontend UX

The participant flow should be extremely fast.

Target flow:

Team ID → Domain → Problem Statement → Confirm → Locked

Avoid unnecessary pages.

Show a progress indicator:

01 VERIFY

02 DOMAIN

03 SELECT

04 CONFIRM

On desktop it should look polished.

On mobile it must be equally usable because teams may select from phones.

33. Visual Design Direction

Create a premium hackathon competition interface.

Reference the visual language of:

coding competitions

esports tournament dashboards

modern developer conferences

high-end competition registration platforms

Do not copy an existing website.

The visual identity should feel custom-made for HackVerse.

Use:

strong typography

structured grids

subtle borders

clean cards

compact information design

bold section headers

subtle motion

interactive hover states

clean status indicators

professional spacing

Avoid making everything a giant rounded card.

Use a combination of:

rectangular surfaces

slightly rounded panels

sharp information blocks

compact buttons

The design should look like a product built by a strong frontend team.

34. Color Direction

Use a sophisticated competition-oriented palette.

Primary colors should be based around the HackVerse branding.

Possible direction:

near-black / charcoal foundation

white / off-white typography

electric accent color

secondary accent used sparingly

muted gray UI surfaces

Do not use excessive neon.

Do not use random gradients everywhere.

Do not make every component glow.

Use gradients only where they genuinely improve the design.

35. Typography

Use a modern professional font system.

Headings:

bold, confident, compact

Body:

highly readable

Problem Statement IDs:

monospace / technical typography can be used for IDs such as:

PS-07

HV1024

Create a visual hierarchy that makes the website easy to scan during a high-pressure live selection process.

36. Microinteractions

Add subtle animations:

button hover

card hover

selection confirmation

loading states

success state

slot count transition

live status updates

When a problem statement becomes full:

Animate the transition to:

FULL

Do not use excessive animations that slow down the selection process.

37. Loading & Error States

Every important operation must have proper loading states.

Example:

While checking Team ID:

VERIFYING TEAM...

While confirming:

LOCKING PROBLEM STATEMENT...

Prevent double clicking.

Disable the confirm button while the request is processing.

Show meaningful error messages.

Example:

This problem statement was selected by another team moments ago.

Please select another problem statement.

Do not display raw backend/database errors to participants.

38. Empty States

Examples:

No problem statements in domain:

No active problem statements are currently available in this domain.

No allocations:

No teams have selected problem statements yet.

No search results:

No matching teams found.

39. Admin Export

Provide export functionality.

Admins should be able to export:

Team Allocation CSV

Columns:

Team ID

Team Name

Domain

Problem Statement ID

Problem Statement

Selected At

Status

Also export:

Problem Statement Allocation Report

Columns:

PS ID

Problem Statement

Domain

Capacity

Allocated

Remaining

Status

40. Security

Implement proper security throughout the application.

Important:

Backend validation for all important operations

Admin route protection

Secure authentication

Database constraints

Transactional allocation logic

Protection from duplicate allocations

Protection from race conditions

Input validation

Rate limiting for critical endpoints

Do not expose admin secrets in frontend

Do not trust frontend slot counters

Never allow the frontend to directly determine whether allocation succeeded

The server/database is always the source of truth.

41. Responsive Design

The participant experience must work perfectly on:

Desktop

Laptop

Tablet

Mobile

Especially optimize the selection interface for mobile.

Problem statement cards should remain readable.

Buttons should be large enough for touch interaction.

The admin dashboard can be desktop-first but should remain usable on tablets.

42. Data Seeding

Provide initial seed data for development/testing.

Create:

80 sample teams

25 problem statements

5 domains

Distribute the 25 problem statements across the domains.

Use realistic hackathon problem statements related to the existing HackVerse domains.

Clearly mark seeded data as development/sample data so it can be replaced with real event data.

43. Demo / Test Scenarios

The application must be tested against these scenarios:

Scenario 1

Team A selects PS-01.

Result:

2 → 1 remaining

Scenario 2

Team B selects PS-01.

Result:

1 → 0 remaining

PS-01 becomes:

FULL

Scenario 3

Team C tries PS-01.

Result:

Selection rejected.

Message:

This problem statement has already been taken by 2 teams.

Scenario 4

Two teams attempt the final slot simultaneously.

Result:

Exactly one succeeds.

The other receives a clear failure message.

Scenario 5

A team tries to allocate twice.

Result:

Rejected.

Scenario 6

All problem statements inside a domain become full.

Result:

Domain becomes:

FULL

and cannot be opened.

Scenario 7

50 teams have successfully allocated.

Result:

No new allocation is allowed.

Scenario 8

Admin creates a new active problem statement.

Result:

It becomes available in the appropriate domain immediately.

Scenario 9

Admin pauses the event.

Result:

Participants cannot complete new allocations.

Scenario 10

Admin closes the event and finalizes disqualifications.

Result:

Unallocated eligible teams become:

DISQUALIFIED

44. Recommended Architecture

Build this as a proper full-stack application.

Preferred stack:

Frontend

React + TypeScript

Modern routing

Responsive CSS / Tailwind if appropriate

Backend / Database

Use a reliable server-side backend and PostgreSQL database.

Use database transactions for allocation.

Authentication

Secure admin authentication.

Realtime

Use realtime database subscriptions / websocket updates where appropriate.

The architecture should be modular and production-ready.

Do not build the entire system as fake frontend-only mock data.

45. Important Database Constraints

The database must enforce business rules.

Examples:

A team can have at most one successful allocation.

A problem statement cannot exceed its capacity.

A problem statement with:

capacity = 2

must never have:

allocated_count > 2

Allocation must be transactional.

The database should remain correct even if multiple requests arrive at the same time.

46. UI Status Language

Use consistent language across the application.

For participant side:

AVAILABLE

1 SLOT LEFT

FULL

LOCKED

SELECTION CLOSED

DOMAIN FULL

For admin side:

AVAILABLE

PARTIALLY ALLOCATED

FULL

PAUSED

CLOSED

DISQUALIFIED

47. Admin Dashboard Layout

Use a professional layout:

Sidebar

HackVerse logo

Dashboard

Allocations

Teams

Problem Statements

Domains

Activity Log

Settings

Main Area

Top:

HackVerse 2K26

Problem Statement Allocation Control Center

Then live metrics.

Then:

Live Allocation Overview

Then:

Recent Activity

Then:

Problem Statement Capacity

Use charts only where they genuinely help.

Do not fill the dashboard with pointless graphs.

48. Participant UI Layout

Keep it much simpler than the admin dashboard.

Header:

HackVerse 2K26 logo

Problem Statement Selection

Main content:

Step indicator

Current step

Selection content

Live allocation information

Footer:

HackVerse 2K26

TRR College of Technology

Use strong visual hierarchy.

49. Important Participant Messaging

When a user reaches a problem statement with 1 available slot:

1 SLOT REMAINING — FIRST COME, FIRST SERVED

When it becomes full during their session:

This problem statement was just taken by another team.

When selection succeeds:

PROBLEM STATEMENT LOCKED SUCCESSFULLY

When selection closes:

ALL AVAILABLE SLOTS HAVE BEEN ALLOCATED

50. Do Not Make It Look AI-Generated

This is extremely important.

Do NOT produce the typical generic AI-generated web design containing:

giant centered gradients

excessive glassmorphism

floating gradient blobs

meaningless dashboard charts

excessive purple/blue gradients

huge rounded cards everywhere

repetitive icon cards

oversized hero sections

generic AI illustrations

random decorative shapes

excessive animations

Instead:

Think like a senior product designer creating a real-time hackathon allocation system used during a live event.

The design should prioritize:

Speed + clarity + competition + trust + operational reliability.

Every element should have a purpose.

51. Final Product Goal

The completed platform should make the live selection process feel like this:

Team leader opens website

↓

Enters Team Name + Team ID

↓

System verifies team

↓

Selects available domain

↓

Sees live problem statement availability

↓

Opens problem statement

↓

Clicks select

↓

Confirms selection

↓

Backend atomically locks the slot

↓

Allocation instantly appears in admin dashboard

↓

Remaining slots update

↓

Team receives confirmation

The organizers should be able to watch the entire process live from the admin dashboard.

52. Final Requirement

Build the application as a real working product, not a UI prototype.

Do not fake the allocation logic with frontend counters.

Do not use static mock data for the core selection workflow.

Create the required database schema, backend logic, authentication, validations, realtime updates, admin controls, and responsive frontend.

Before considering the build complete, verify that the application correctly handles concurrent selection attempts, duplicate team submissions, full problem statements, full domains, the 50-team global limit, and final disqualification of remaining teams.

The result should feel like a professionally built HackVerse 2K26 live competition platform, with a clean, premium, competitive UI and a highly reliable allocation engine.

---

## Project Structure

This is a **TanStack Start** app: one full-stack project, not a separate frontend
and backend. Server code is colocated with the UI on purpose — server functions
are compiled into the same build and invoked as typed RPCs, so a physical
`frontend/` + `backend/` split would break file-based routing, the `@/` alias and
the Nitro build. The separation is by **file role**, mapped below.

### Frontend — browser

| Path | Role |
| --- | --- |
| `src/routes/index.tsx` | Landing page with live counters |
| `src/routes/select.tsx` | 4-step participant flow: verify → domain → select → confirm |
| `src/routes/success.tsx` | Allocation receipt (printable) |
| `src/routes/closed.tsx` | Selection-closed page |
| `src/routes/admin/login.tsx` | Organiser sign-in + first-time setup |
| `src/routes/admin/_dash.tsx` | Guarded admin layout (auth gate, sidebar, realtime) |
| `src/routes/admin/_dash/*.tsx` | Dashboard, allocations, teams, problem statements, domains, activity, settings |
| `src/components/hv/` | HackVerse-specific UI (participant + admin chrome) |
| `src/components/ui/` | shadcn/ui primitives |
| `src/styles.css` | Design tokens (oklch) and Tailwind theme |

`_dash` is a **pathless layout route**: it wraps every admin page in the auth
guard while leaving `/admin/login` outside it. Renaming it changes the URLs.

### Backend — server only

| Path | Role |
| --- | --- |
| `src/lib/hackverse.server.ts` | Core logic: allocation, verification, rate limiting, audit |
| `src/lib/participant.functions.ts` | Participant RPC endpoints |
| `src/lib/admin.functions.ts` | Admin RPC endpoints (zod-validated, admin-role gated) |
| `src/integrations/supabase/client.server.ts` | Service-role client — **never import from a route** |
| `src/integrations/supabase/auth-middleware.ts` | Verifies the bearer token, exposes `userId` |
| `src/server.ts`, `src/start.ts` | Server entry and global middleware |

Anything ending `.server.ts` is server-only. Files ending `.functions.ts` ship a
client stub, so they must not import the service-role client at module scope.

### Shared

`src/lib/hackverse-types.ts` (types + status language), `src/lib/live.ts`
(realtime subscription, CSV, formatting), `src/lib/audit-format.ts`,
`src/lib/admin.queries.ts` (React Query options).

### Database

| Path | Role |
| --- | --- |
| `supabase/setup-new-project.sql` | **Rebuild step 1** — schema, RLS, allocate RPC, realtime, domains + placeholder problem statements |
| `supabase/seed-real-teams.sql` | **Rebuild step 2** — the 88 real teams + registered count |
| `supabase/migrations/` | Original migration history — **never run these by hand** |

The allocation engine is `allocate_problem_statement()`, a `security definer`
PL/pgSQL function. It locks `event_settings` then the problem statement row
`for update`, so concurrent confirmations serialise and the last slot can only
be won once. Constraints back this up: `allocated_count <= capacity`, a unique
`team_id` on `allocations`, and `remaining_slots` as a generated column.

### Ops

| Path | Role |
| --- | --- |
| `scripts/problem-statements.json` | Source of truth for the 25 problem statements + 5 domains |
| `scripts/load-problem-statements.mjs` | **Rebuild step 3** — loads them; refuses to run if allocations exist |
| `scripts/verify-scenarios.mjs` | 32-assertion suite; uses throwaway teams and resets afterwards |

### Rebuilding the database from scratch

1. Run `supabase/setup-new-project.sql` in the Supabase SQL Editor
2. Run `supabase/seed-real-teams.sql`
3. `node scripts/load-problem-statements.mjs`

> Step 1 begins with a reset block that **drops every HackVerse table**. Never
> run it against a live event database.

### Environment

`.env` (committed) holds public values: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`
and their `VITE_` twins. `.env.local` (gitignored) holds
`SUPABASE_SERVICE_ROLE_KEY` — it bypasses RLS and must never be committed or
exposed to the browser. See `.env.example`.

---

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://hackverse2k26.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1fe0f9a8-f36a-4ee6-881f-85ed5fa7a4c8).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
