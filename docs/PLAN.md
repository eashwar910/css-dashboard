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
| Tasks, Weekly tab, event to-dos | Team Dashboard > Tasks | `382a80c6-3b0a-80d3-8b35-000b68a5e907` | `NOTION_TASKS_DS_ID` |
| Events | Team Dashboard > Events | `382a80c6-3b0a-80ae-8ff7-000b7e904f97` | `NOTION_EVENTS_DS_ID` |
| Meetings tab | Team Dashboard > Meetings | `382a80c6-3b0a-8179-9c4d-000b5b12fca0` | `NOTION_MEETINGS_DS_ID` |
| Team | Computer Science Society > Executive Committee (ExCo) | `381a80c6-3b0a-80c0-8fdf-000b433f267f` | `NOTION_EXCO_DS_ID` |
| Documents | Team Dashboard > Documents > Documents (1) | `382a80c6-3b0a-8114-af2d-000b723f3007` | `NOTION_DOCUMENTS_DS_ID` |
| Finance | Finance Tracker > Transactions | `3e7a80c6-3b0a-8007-87dd-000b20131ed1` | `NOTION_TRANSACTIONS_DS_ID` |

The integration is `css-dashboard`, an internal connection using an API token. It can read, update and insert content, and read user emails. Everything else it can see is ignored. `NOTION_MAPPING.md` §8 lists those data sources and why.

## Events and meetings
Restructured 2026-09-29 after the President's review (`scripts/restructure-meetings-and-weeks.mjs`). Tabs: Home, Weekly, Events, Meetings, Team, Finance, External Relations. There is no Calendar tab; Events and Meetings each have a List / Calendar switch, and each calendar shows only its own items.

**Events tab** reads only Team Dashboard > Events (`/api/events`):
- `Name` → title, `Timeline` (date range) → start/end, `Location` (text) → location.
- Status mapping: Not started → `scheduled`, In progress → `planning-in-progress`, Done → `done`.
- **An event with no date shows a "TBA" tag.** TBA events appear in the list; the month calendar can't place them and says how many are missing.
- **The dashboard is the primary tool; Notion is the backend.** Everything about an event is edited from its dialog and saved to Notion:
  - Name, date/time (or TBA), Location and Status: `PATCH /api/events?id=`, by any committee member.
  - Overview (the page body): the rich-text editor (see "Page bodies" below), by any committee member.
  - Delete: moves the page to Notion's trash (restorable for 30 days), organisers only (`DELETE /api/events?id=`).
- Hide agenda, RSVP and description in the UI for now, but don't delete the components.

**Meetings tab** reads only Team Dashboard > Meetings (`/api/meetings`). Meetings never appear in Events or on Home.
- `Name` → title, `Date` → start/end (a datetime carries the time), `Venue` → location, `Type` (JC / ExCo / Weekly Meeting), `Created By` (people, set by the dashboard). Minutes are the page body.
- **Upcoming Meetings**: not over yet, soonest first, plus TBA meetings. **Meeting Minutes**: over, most recent first. A meeting moves across automatically once its end (or its day, if it has no time) has passed. There is no status property to go stale.
- **Organisers** (President, Vice President, Secretary, Head of Tech via ExCo `Position` or `committee_members.role`, plus `is_admin`; `api/_lib/roles.ts`) add, edit and delete meetings and write their notes and minutes:
  - Add: title, date, time (Malaysia), optional venue, type and notes (`POST /api/meetings`).
  - Edit: title, date/time (or TBA), venue, type (`PATCH /api/meetings?id=`). Delete moves the page to Notion's trash (`DELETE`).
  - Notes (upcoming) and minutes (past) are the page body, edited with the rich-text editor.
  - Everyone else can read them. Nothing is recurring; the weekly meeting is added like any other.
- **Attendance**: Notion `Attendees` (people) is who's going; `Not Going` (people) is who said they can't come. Each upcoming meeting shows Going / Not going / No reply (the ExCo minus both lists, matched by Notion user id from the member's email, else by name). Any committee member sets **their own** reply (`PATCH /api/meetings?id=` with `{ rsvp: 'going' | 'not-going' | null }`); pressing the current answer again clears it. Past meetings show Attended / Didn't attend, read-only. Events have no attendance. Until the `Not Going` property exists in Notion, "Not going" replies are refused with a message saying so.

**Page bodies** (event Overview, meeting notes/minutes) are edited in a rich-text editor (TipTap, `src/components/RichTextEditor.tsx`), never raw Markdown. Markdown is only the wire format:
- `GET /api/event-content?id=` returns `editorMarkdown` (from `toEditorMarkdown` in `api/_lib/notionMarkdown.ts`), the stored `source`, and `canEdit`. `PUT` saves with `pages.updateMarkdown` `replace_content`, sending `source` back as `base`; if the page changed meanwhile the server answers 409 instead of overwriting.
- Round-trips unchanged (`src/lib/editorExtensions.ts`): headings, bold/italic/strike/code, links, lists, checklists, quotes, tables, dividers, code, images (Notion keeps its hosted image), `<br>`, blank lines (`<empty-block/>`), text colours, @mentions and date mentions. Notion-only blocks (AI meeting notes, callouts, toggles, sub-pages…) are kept verbatim as read-only blocks. Paragraphs with indented children are flattened to the parent's level (text unchanged).
- Child pages/databases are never deleted by a save, and pages too long for Notion to return in full are edit-in-Notion only.
- After changing the conversion or the editor, run `npx tsx --env-file=.env.local scripts/check-editor-roundtrip.ts`: it round-trips every event and meeting page through the editor into a scratch page and reports any difference.

## Tasks and the Weekly tab
- Weekly to-dos are rows in Tasks. `PIC` (people) is the owner of each to-do. `Events` (relation) links it to an event. `Week` (date) is the Monday of the week it was planned for.
- The Weekly tab shows **everyone's** to-dos, grouped by PIC person (a task with several PICs appears under each; the signed-in member first), then "Everyone" (tasks whose only PIC is Notion's Everyone group), then "Unassigned". **To-dos are individual: there is no grouping by department.** A department group as PIC is ignored (the task shows as Unassigned until a person is named).
  - Each to-do's date is its `Due Date`, or, with none, the day the page was created (the day it was added).
  - **This week**: that date is this week or later (Done or not). A to-do due next month stays here until its due date is in the past.
  - **Overdue**: that date is before this week and it's still open; or it's Done and the date is in the two weeks before this week. Older Done to-dos are hidden.
  - Order: to-dos with a due date first, soonest first; then undated ones, oldest added first.
  - Weeks are Asia/Kuala_Lumpur, starting Monday.
- `Week` no longer decides the column. A task created from the dashboard still gets `Week` = this week, and ticking a task with no `Week` sets it to this week.
- Ticking a task sets Status to Done. Unticking sets it back to Not started.
- Event detail to-dos are the Tasks linked to that event.
- A to-do created from the dashboard gets PIC = the creator, and links to the event if it was created from one. The creator's Notion user id is looked up by email via `notion.users.list`, cached.
- The task's project label is the linked event's name. It's hidden when there's no event.

## Ownership rules (enforced server-side on every write)
- A user can **tick, edit or delete** a task if any PIC person's email matches their login email or their `committee_members.notion_email`, compared case-insensitively. `notion_email` is a nullable column; one member's Notion email is a personal Gmail.
- Tasks assigned only to a group (e.g. "Everyone") or with no PIC can be **ticked/unticked** by any committee member. Editing or deleting them is admin-only.
- `committee_members.is_admin = true` can do anything. `is_admin` is a boolean column, default false. `role` is only a job title and grants no permissions.

## Team
- From Notion:
  - `Name` → name
  - `Position` → role
  - `Picture` → avatar

  Picture URLs expire after about an hour, so always serve them from a fresh query. The 60s cache is fine.
- **Year comes from a server-side file, `/api/_lib/memberDetails.ts`**, keyed by the member's Notion page id, not their name. Members are individuals: there is no department field or grouping (removed 2026-09-29).
  - It's pre-filled with every current ExCo page id, the member's name as a comment, and year left blank for the owner to fill in.
  - Put a comment at the top explaining what the file is and how to update it.
- **Email comes from Supabase `committee_members`**, matched on name. List any members that couldn't be matched so they can be fixed by hand.
- Members missing from `memberDetails.js` still appear, just without a year.
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
- Validation (server): Type required; Amount > 0; Claimant and Reimbursement Status only when Paid By = Member; Paid By = Member only for expenses. A Member-paid expense defaults to Pending, and to the creator as Claimant if none is picked. Paid By defaults to Society Account. Date defaults to today (Kuala Lumpur).
- Receipts: shown as a link to the transaction's Notion page (no upload yet).
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
8. ~~Finance: read and write for Transactions, including reimbursement status.~~ **Done** (`/api/finance`; Finance page in the sidebar; event dialog Finance tab).
9. Supabase: add the nullable `notion_email` column to `committee_members`. The SQL comes from the agent in step 2; the owner runs it.
10. ~~Final sweep: remove leftover mock arrays and artificial delays, and list anything still hard-coded.~~ **Done.** Still hard-coded on purpose:
    - Home announcements (`HomeView.tsx`, no Notion source).
    - Member year (`api/_lib/memberDetails.ts`, filled in by hand).
    - UI option lists: task statuses and event status labels.
    - Switched off in `src/lib/features.ts`: event agenda, RSVP, description, event editing (add/delete/dates/status), and the EPF button.
11. Deploy: add all env vars to Vercel, redeploy, then test with two different committee accounts (own vs other people's to-dos, finance entries).

Work one section at a time, test with `vercel dev`, and show the result to the owner before moving on. Don't commit unless asked.