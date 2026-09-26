# CSS Dashboard: Notion connection plan

This file holds the decisions for connecting the dashboard to Notion. `NOTION_MAPPING.md` holds the schema. **If the two disagree on a property name or option value, `NOTION_MAPPING.md` ("Canonical property names") wins.**

## Context
- Owner: Eashwar, Notion workspace owner for the University of Nottingham Malaysia Computer Science Society (UNM CSS).
- The dashboard (React + Vite on Vercel) is built around the **existing** Notion workspace. Notion is the database; nothing is being migrated.
- Current goal: replace all placeholder/mock data with real Notion data. Two further features come later and are out of scope.

## Architecture
- **Auth:** Supabase email OTP, restricted to `@nottingham.edu.my`. The `committee_members` table is the allowlist. This already works.
- **Server layer:** Vercel serverless functions in `/api`, with shared code in `/api/_lib` (not routed). The Notion token never reaches the browser. Hooks call `/api`, and `/api` calls Notion.
- **Every endpoint** verifies the Supabase session (Bearer access token → `supabase.auth.getUser`) and checks the email is in `committee_members`.
- **Notion API:** `@notionhq/client` v5.12.0+ with `notionVersion: "2026-03-11"`.
  - Query with `notion.dataSources.query` and a `data_source_id`, not `databases.query`.
  - Delete by setting `in_trash: true`, not `archived`.
- **Caching:** 60s in-memory per function, cleared after writes. No CDN cache headers on authenticated responses (`Cache-Control: no-store`).
- **Env vars** live in `.env.local`, which is gitignored:
  - `NOTION_TOKEN`
  - one `NOTION_*_DS_ID` per data source
  - the Supabase server variables

  No `VITE_` prefix on secrets. `.env.example` lists the names only.
- Keep each hook's return shape the same. Delete a section's mock data only once that section works with real data.
- "This week" means Asia/Kuala_Lumpur time, with weeks starting Monday.

## Data sources in use
| Dashboard section | Notion data source | Data source ID | Env var |
|---|---|---|---|
| Tasks, weekly scrum, event to-dos | Team Dashboard > Tasks | `382a80c6-3b0a-80d3-8b35-000b68a5e907` | `NOTION_TASKS_DS_ID` |
| Events | Team Dashboard > Events | `382a80c6-3b0a-80ae-8ff7-000b7e904f97` | `NOTION_EVENTS_DS_ID` |
| Meetings (on the calendar) | Team Dashboard > Meetings | `382a80c6-3b0a-8179-9c4d-000b5b12fca0` | `NOTION_MEETINGS_DS_ID` |
| Team | Computer Science Society > Executive Committee (ExCo) | `381a80c6-3b0a-80c0-8fdf-000b433f267f` | `NOTION_EXCO_DS_ID` |
| Documents | Team Dashboard > Documents > Documents (1) | `382a80c6-3b0a-8114-af2d-000b723f3007` | `NOTION_DOCUMENTS_DS_ID` |
| Finance | Finance Tracker > Transactions | `3e7a80c6-3b0a-8007-87dd-000b20131ed1` | `NOTION_TRANSACTIONS_DS_ID` |

The integration is `css-dashboard`, an internal connection using an API token. It can read, update and insert content, and read user emails. Everything else it can see is ignored. `NOTION_MAPPING.md` §8 lists those data sources and why.

## Events and meetings
- The canonical events list is Team Dashboard > Events:
  - `Name` → title
  - `Timeline` (date range) → start/end
  - `Location` (text) → location
- Status mapping: Not started → `scheduled`, In progress → `planning-in-progress`, Done → `done`.
- **An event with no date shows a "TBA" tag.** TBA events appear in the list view and the sidebar, since the month grid can't place them. Most events have no date yet, so this is the normal case.
- **Meetings are not events.** Add `kind: 'event' | 'meeting'`.
  - Meetings appear on the calendar with their own label and colour, and no status badge. So `status` becomes optional.
  - Meeting mapping: `Task` → title, `Date` → start/end, `Venue` → location.
- Hide agenda, RSVP and description in the UI for now, but don't delete the components.
- `startDateTime` and `dueDate` become optional. Fix every unguarded `parseISO` and every other unguarded date use.

## Tasks and weekly scrum to-dos
- Weekly scrum to-dos are per-person, per-event to-do items that get reviewed and checked off weekly. They are rows in Tasks.
- `PIC` (people) is the owner of each to-do, not of the event. `Events` (relation) links the to-do to its event.
- The weekly view shows:
  - the logged-in user's tasks (those whose PIC includes them), grouped by linked event, with "General" for tasks that have no event;
  - then a **"Shared"** group with every task whose PIC has no individual person (only groups such as "Everyone" or a department, or nobody). Each shared task shows its group name, or "Unassigned" if PIC is empty. Every member sees these.

  In both, it includes:
  - tasks not yet Done
  - Done tasks whose `last_edited_time` falls in the current week
- Ticking a task sets Status to Done. Unticking sets it back to Not started.
- Event detail to-dos are the Tasks linked to that event.
- A to-do created from the dashboard gets PIC = the creator, and links to the event if it was created from one. The creator's Notion user id is looked up by email via `notion.users.list`, cached.
- The task's project label is the linked event's name. It's hidden when there's no event.

## Ownership rules (enforced server-side on every write)
- A user can **tick, edit or delete** a task if any PIC person's email matches their login email or their `committee_members.notion_email`, compared case-insensitively. `notion_email` is a nullable column; one member's Notion email is a personal Gmail.
- Tasks assigned only to a group (e.g. "Everyone", a department) or with no PIC can be **ticked/unticked** by any committee member. Editing or deleting them is admin-only.
- `committee_members.role = 'admin'` can do anything.

## Team
- From Notion:
  - `Name` → name
  - `Position` → role
  - `Picture` → avatar

  Picture URLs expire after about an hour, so always serve them from a fresh query. The 60s cache is fine.
- **Department and year come from a server-side file, `/api/_lib/memberDetails.js`**, keyed by the member's Notion page id, not their name.
  - Generate it pre-filled with every current ExCo page id, the member's name as a comment, and department/year left blank for the owner to fill in.
  - Put a comment at the top explaining what the file is and how to update it.
- **Email comes from Supabase `committee_members`**, matched on name. List any members that couldn't be matched so they can be fixed by hand.
- Members missing from `memberDetails.js` still appear, just without department/year. Keep the Department/Year filters and stats.
- Never expose `Shirt Size`.

## Documents
- The source is the Documents data source. There are no real documents yet because the academic year hasn't started.
- The committee will create new documents **inside** that database, so each document is a row.
- Mapping:
  - `Name` → name
  - Link = `Document URL`, otherwise the Notion page URL. Never use the expiring file URL.
  - Category = `Document Type`, mapped to Lucide icon names with a sensible default.

## Finance (Finance Tracker > Transactions)
Every ringgit in or out is one row. Exact property names and options are in `NOTION_MAPPING.md`. In summary:

| Property | Type | Notes |
|---|---|---|
| `Description` | title | |
| `Type` | select | `Income` / `Expense` |
| `Amount` | number (ringgit) | |
| `Date` | date | |
| `Event` | relation → Team Dashboard > Events | Two-way (the reverse is `Transactions` on Events). Optional; empty means not tied to an event |
| `Category` | select | `Other`, `Prizes`, `Merch`, `Printing`, `Food`, `Membership`, `Ticket Sales`, `Sponsorship` |
| `Paid By` | select | `Society Account` / `Member` |
| `Claimant` | people | Only when Paid By = Member |
| `Reimbursement Status` | select | `Pending` / `Approved` / `Paid Back`. Only when Paid By = Member |
| `Receipt` | files | |
| `Recorded by` | people | Set by the dashboard to the creator |

- A reimbursement is an Expense row with Paid By = Member, so each expense is counted exactly once.
- The dashboard shows income, spending, balance, and outstanding reimbursements, per event and overall. Outstanding means Paid By = Member and status not Paid Back.
- Permissions: any committee member can add entries and change reimbursement status for now. This may be restricted to admin/treasurer later.
- The one existing row in Transactions is a test row. It can be deleted once finance works.

## Still hard-coded
- Home **Announcements**. There's no Notion source yet. Leave it, but list it in the final sweep.

## Steps
1. ~~Re-run the survey and update `NOTION_MAPPING.md`.~~ **Done 2026-09-26.**
2. ~~Build `/api/_lib`: Notion client, property helpers, auth and committee check, ownership helper, plus `GET /api/me` for testing.~~ **Done.**
3. ~~Team (read), including `memberDetails.js` and the email join from Supabase.~~ **Done** (`api/_lib/memberDetails.ts`; email join needs `SUPABASE_SERVICE_ROLE_KEY`).
4. ~~Documents (read).~~ **Done.**
5. ~~Events and Meetings (read), including the TBA tag, `kind`, and optional status and dates.~~ **Done.**
6. ~~Tasks and weekly scrum (read).~~ **Done** (ticking is local-only until step 7).
7. ~~Task writes: tick/untick, create, edit, delete, with the ownership rules.~~ **Done** (`/api/tasks` POST/PATCH/DELETE).
8. Finance: read and write for Transactions, including reimbursement status.
9. Supabase: add the nullable `notion_email` column to `committee_members`. The SQL comes from the agent in step 2; the owner runs it.
10. Final sweep: remove leftover mock arrays and artificial delays, and list anything still hard-coded.
11. Deploy: add all env vars to Vercel, redeploy, then test with two different committee accounts (own vs other people's to-dos, finance entries).

Work one section at a time, test with `vercel dev`, and show the result to the owner before moving on. Don't commit unless asked.