# Notion → Dashboard Mapping Plan

Survey run: 2026-09-26 (re-run twice the same day: after Transactions was added, then after the Notion fixes) · `node scripts/notion-survey.mjs` · Notion API `2026-03-11` · `@notionhq/client` 5.26.0
Raw output: `notion-survey.json` (gitignored, contains member data). This file lists schema and counts only, never member data.

The integration (`css-dashboard`) can see **19 data sources**. Row counts are small everywhere: the largest has 13 rows.

### Data sources in use

| Data source | Data source ID | Env var | Reachable | Rows |
|---|---|---|---|---|
| Team Dashboard > Tasks | `382a80c6-3b0a-80d3-8b35-000b68a5e907` | — | ✅ query OK | 13 |
| Team Dashboard > Events | `382a80c6-3b0a-80ae-8ff7-000b7e904f97` | — | ✅ query OK | 4 |
| Team Dashboard > Meetings | `382a80c6-3b0a-8179-9c4d-000b5b12fca0` | — | ✅ query OK | 6 |
| Computer Science Society > ExCo > *(untitled)* | `381a80c6-3b0a-80c0-8fdf-000b433f267f` | — | ✅ query OK | 11 |
| Team Dashboard > Documents > Documents (1) | `382a80c6-3b0a-8114-af2d-000b723f3007` | — | ✅ query OK | 1 |
| Finance Tracker > Transactions | `3e7a80c6-3b0a-8007-87dd-000b20131ed1` | `NOTION_TRANSACTIONS_DS_ID` | ✅ query OK | 1 |

Checked with a direct `dataSources.query` on each ID (all pages). No permission errors.

Confidence: **High** = same meaning and type, and populated. **Medium** = right place, but needs a transform or is sparsely filled. **Low** = only loosely related. **None** = nothing in Notion.

---

## 1. Workspace inventory

| Path | Rows | Data source ID | Last row edit | Relevant to |
|---|---|---|---|---|
| Team Dashboard > **Tasks** | 13 | `382a80c6-3b0a-80d3-8b35-000b68a5e907` | 2026-09-24 | Tasks, Weekly To-Do, event to-dos |
| Team Dashboard > **Events** | 4 | `382a80c6-3b0a-80ae-8ff7-000b7e904f97` | 2026-09-24 | Events |
| Team Dashboard > **Meetings** | 6 | `382a80c6-3b0a-8179-9c4d-000b5b12fca0` | 2026-09-25 | Events (category `meeting`) |
| Team Dashboard > Documents > **Documents (1)** | 1 | `382a80c6-3b0a-8114-af2d-000b723f3007` | 2026-07-08 | Documents |
| Team Dashboard > Forms | 0 | `36ca80c6-3b0a-80c0-a7e2-000b79305949` | — | Documents? |
| Computer Science Society > Executive Committee (ExCo) > *(untitled)* | 11 | `381a80c6-3b0a-80c0-8fdf-000b433f267f` | 2026-09-22 | Team members |
| Finance Tracker > **Transactions** | 1 | `3e7a80c6-3b0a-8007-87dd-000b20131ed1` | 2026-09-26 | Event finance (new, see §2) |
| Events Team > **Events** | 2 | `382a80c6-3b0a-80a0-8ba8-000b01308117` | 2026-06-24 | Ignored (§8) |
| Events Team > Inventory | 4 | `36ca80c6-3b0a-808f-806c-000be4220472` | 2026-06-17 | — |
| Events Team > Post Event Reports | 0 | `382a80c6-3b0a-80c6-ab1e-000bb9d2924c` | — | Documents? |
| Finance Tracker > Reimbursements | 1 (all fields empty) | `36ca80c6-3b0a-8020-bd91-000b9f9c52ae` | 2026-06-17 | Ignored (§8) |
| Finance Tracker > Ledger | 1 | `382a80c6-3b0a-8060-be05-000b666c25b5` | 2026-06-17 | Ignored (§8) |
| Marketing Team > *(untitled content calendar)* | 3 | `382a80c6-3b0a-80fc-ba72-000b8d7a751f` | 2026-08-31 | Ignored (§8) |
| Marketing Team > Designs > Designs | 7 | `382a80c6-3b0a-80a8-96ac-000b14459fd3` | 2026-09-24 | Ignored (§8) |
| Marketing Team > Content Ideas | 4 | `382a80c6-3b0a-80a7-b43a-000b877c6054` | 2026-09-03 | Ignored (§8) |
| Marketing Team > Contacts | 8 | `2b2a80c6-3b0a-80a9-a766-000b04eebb2f` | 2026-04-15 | Ignored (§8) |
| Computer Science Resources > Hackathons / Scholarships / Workshops | 10 / 5 / 4 | — | 2026-05-26 | Ignored (§8) |

---

## 2. Field mapping

### Tasks: `useTasks()` → `Task` (also feeds Home "Weekly To-Do")

Source: **Team Dashboard > Tasks**

| Dashboard field | Notion property (type) | Filled | Confidence | Notes |
|---|---|---|---|---|
| `id` | page id | 13/13 | High | |
| `title` | `Task` (title) | 12/13 | High | 1 row has an empty title; skip or show "(untitled)" |
| `status` | `Status` (status: Not started / In progress / Done) | 13/13 | High | `Not started→todo`, `In progress→in-progress`, `Done→done` |
| `completed` | derived from `Status == Done` | — | High | |
| `project` | `Events` (relation → Team Dashboard > Events), use the event's name | 2/13 | Low | The dashboard's "project" label has no Notion equivalent. See Q3 |
| `dueDate` | `Due Date` (date) | 5/13 | Medium | **8 tasks have no date.** `HomeView` calls `parseISO(task.dueDate)` unguarded, so the type needs to become optional (see §6) |
| *(unused by dashboard)* | `PIC` (people), `🎨 Designs` (relation), `Files & media` (files) | 10, 4, 0 | — | `PIC` is the ownership candidate (§5) |

### Events: `useEvents()` → `Event`

Source: **Team Dashboard > Events** (recommended canonical, see §4) plus **Meetings** for `category: 'meeting'`

| Dashboard field | Notion property (type) | Filled | Confidence | Notes |
|---|---|---|---|---|
| `id` | page id | 4/4 | High | |
| `title` | `Name` (title) | 4/4 | High | |
| `startDateTime` / `endDateTime` | `Timeline` (date range) | **0/4** | Medium | Right property, but **no event has a date**, so the calendar will be empty until someone fills this in |
| `status` | `Status` (Not started / In progress / Done) | 4/4 | Medium | Meaning differs: `In progress→planning-in-progress`, `Done→done`, but `Not started` ≠ `scheduled` |
| `todos[]` | Tasks where `Tasks.Events` contains this event | 2 tasks linked | Medium | Single-property relation, so there is no reverse property on Events. Query Tasks with a relation filter. Writing to-dos back means creating Tasks rows |
| `location` | `Location` (rich_text) | **0/4** | Medium | Added 2026-09-26. The property exists, but no event has a value yet. Map plain text to `location` and treat empty as `undefined`. Meetings rows use `Venue` (select, 6/6) instead |
| `description` | none | — | None | Could read the page body via `pages.retrieveMarkdown`. See Q5 |
| `category` | none | — | None | Could be `meeting` for Meetings rows and `other` for everything else. See Q5 |
| `agenda[]` | none | — | None | |
| `rsvpCount` | none | — | None | No RSVP data anywhere in the workspace |
| `financeItems[]` | `Transactions` (relation, two-way ↔ Transactions.`Event`) | 1/4 | High | Page ids of the linked Transactions come from the event row. Field values need a Transactions query (filter `Event` contains the event id) or a per-page retrieve. `Description`→`description`, `Amount`→`amount`, `Type` (`Income`/`Expense`)→`type` (lowercased). See the Transactions section below |

**Meetings → `Event` (category `meeting`):** `Task` (title) → `title` · `Date` (date, 6/6, some are ranges) → `start/endDateTime` · `Venue` (select, 6/6) → `location` · `Type` (select JC / ExCo / Weekly Meeting) is 0/6 filled · `Attendees` (people) has no dashboard field. Confidence: **Medium**. Only the Meetings data source has real dates right now.

### Finance: Finance Tracker > Transactions → `Event.financeItems[]`

Data source ID `3e7a80c6-3b0a-8007-87dd-000b20131ed1` (database `3e7a80c6-3b0a-8084-89d1-ce0e772ccf65`) · env `NOTION_TRANSACTIONS_DS_ID` · **1 row** · created 2026-09-26 · inline.

#### Canonical property names

**Code must use these exact strings.** They are copied from the API on 2026-09-26. The spellings in the original handoff (`Paid by`, `Reimbursement status`, `Society account`, `Paid back`) are wrong. Names and option values are case-sensitive. None has leading or trailing whitespace.

| Property | Type | Option values (exact, in Notion's order) |
|---|---|---|
| `Description` | title | — |
| `Type` | select | `Expense`, `Income` |
| `Amount` | number (format `ringgit`) | — |
| `Date` | date | — |
| `Event` | relation → Events (two-way; reverse is `Transactions` on Events) | — |
| `Category` | select | `Other`, `Prizes`, `Merch`, `Printing`, `Food`, `Membership`, `Ticket Sales`, `Sponsorship` |
| `Paid By` | select | `Member`, `Society Account` |
| `Claimant` | people | — |
| `Reimbursement Status` | select | `Paid Back`, `Approved`, `Pending` |
| `Receipt` | files | — |
| `Recorded by` | people | — |

On Team Dashboard > Events, the related names are: `Transactions` (relation, reverse of `Event`) and `Location` (rich_text).

#### Schema check against the handoff

| Exact Notion name | API type | Filled | Expected | Status |
|---|---|---|---|---|
| `Description` | title | 1/1 | Description (title) | ✅ |
| `Type` | select | 1/1 | Type (select: Income/Expense) | ✅ |
| `Amount` | number | 1/1 | Amount (number) | ✅ |
| `Date` | date | 1/1 | Date (date) | ✅ |
| `Event` | relation, `dual_property` | 1/1 | Event (relation), two-way | ✅ Fixed 2026-09-26 (was `single_property`) |
| `Category` | select | 1/1 | Category (select) | ✅ |
| `Paid By` | select | 1/1 | Paid by (select: Society account/Member) | ⚠️ Casing differs from the handoff. Use the Notion spelling |
| `Claimant` | people | 1/1 | Claimant (person) | ✅ (`people` is the API name for Person) |
| `Reimbursement Status` | select | 1/1 | Reimbursement status (select: Pending/Approved/Paid back) | ⚠️ Casing differs from the handoff. Use the Notion spelling |
| `Receipt` | files | 0/1 | Receipt (files) | ✅ |
| `Recorded by` | people | 1/1 | Recorded by (person) | ✅ Fixed 2026-09-26 (trailing space removed) |

**Event relation:**
- **Target:** Team Dashboard > Events, data source `382a80c6-3b0a-80ae-8ff7-000b7e904f97` (database `382a80c6-3b0a-8067-83b1-f12f18457de5`). The one existing row links to a visible Events row.
- **Two-way?** **Yes.** `Transactions.Event` is `dual_property` with `synced_property_name: "Transactions"`. `Events.Transactions` is `dual_property` pointing to data source `3e7a80c6-3b0a-8007-87dd-000b20131ed1`, with `synced_property_name: "Event"`.
- **Limited to 1 page?** Unknown. The API doesn't expose the "Limit" setting in relation config. The current row links 1 event.

**Mapping to `FinanceItem`:** `id`←page id · `description`←`Description` · `amount`←`Amount` · `type`←`Type` lowercased. `Category`, `Paid By`, `Claimant`, `Reimbursement Status`, `Receipt` and `Recorded by` have no dashboard field yet.

### Team: `useTeamMembers()` → `TeamMember`

Source: **Computer Science Society > Executive Committee (ExCo) > (untitled)**. 11 rows, while the mock has 9.

| Dashboard field | Notion property (type) | Filled | Confidence | Notes |
|---|---|---|---|---|
| `id` | page id | 11/11 | High | |
| `name` | `Name` (title) | 11/11 | High | |
| `role` | `Position` (rich_text) | 11/11 | High | |
| `avatarUrl` | `Picture` (files) | 8/11 | Medium | Notion-hosted file URLs **expire after about 1 hour**, so they must be re-fetched or proxied, not cached |
| `email` | none | — | None | Could be joined to Notion workspace users by name, but names don't match reliably (see Q6) |
| `department` | none | — | None | The Notion teams (Events / Marketing / Finance) are pages, not a property |
| `year` | none | — | None | |
| *(unused)* | `LinkedIn` (url), `Fun fact`, `Shirt Size` | 9, 9, 9 | — | Shirt size is private-ish; don't expose it |

### Documents: `useDocuments()` → `Document`

Source: **Team Dashboard > Documents > Documents (1)**. Only **1 row**.

| Dashboard field | Notion property (type) | Filled | Confidence | Notes |
|---|---|---|---|---|
| `id` | page id | 1/1 | High | |
| `name` | `Name` (title) | 1/1 | High | |
| `url` | `Document URL` (url) or else `Document File` (files) or else the page `url` | 0 / 1 / 1 | Medium | File URLs expire, so link to the Notion page instead |
| `category` | `Document Type` (select, only option `SA`) | 1/1 | Low | One option doesn't give a useful grouping |
| `icon` | page icon (emoji) | — | Low | The dashboard expects Lucide icon names, so a map would be needed |

The mock's documents (Meeting Minutes, Budget Report, Slides Archive, NottsHack 2027) look like **Notion pages**, not database rows. See Q4.

### Weekly scrum to-dos (Home → "Weekly To-Do")

There is no separate store in code. The widget is `useTasks()` with a local-only checkbox toggle. It maps to **Team Dashboard > Tasks** (same as above). "Weekly" would be a `Due Date` filter on the current week, but 8/13 tasks have no due date. See Q2 and §5 for ownership.

### Not asked, but also unmapped

- Home **Announcements**: hard-coded in `HomeView.tsx`. There is no Notion source.

---

## 3. Relations to data sources the token can't see

In API `2026-03-11`, **a relation whose target isn't shared with the integration is left out of the data source's schema entirely**. It only appears on page rows. The survey detects these by comparing row properties to the schema.

| From | Property | Rows with values | Likely target |
|---|---|---|---|
| Finance Tracker > Reimbursements | `Event` (relation) | 0/1 | An events database that isn't shared (not either visible Events list, because those would appear in the schema) |
| Marketing Team > Contacts | `Events Involved` (relation) | 0/8 | Probably the same unshared events database |

All relations in the visible schemas (Tasks → Events, Tasks → Designs, Meetings → Events, content calendar `URL` → Designs, Transactions → Events) resolve to visible data sources. This suggests a **third, unshared events database** exists. Both relations into it are empty (0 rows with values). **Decision: ignored** (§8).

---

## 4. Duplicate / competing data sources

### Events: three candidates (two visible, one hidden)

| | Team Dashboard > Events | Events Team > Events | (unshared, see §3) |
|---|---|---|---|
| Rows | **4** | 2 | ? |
| Latest row edit | **2026-09-24** | 2026-06-24 | ? |
| Schema | Name, Status, Timeline (empty) | Event Name, Venue, S-CPD, EPF & HIRARC (PDF), EPF Reference Number (all empty) | ? |
| Linked from | **Tasks.Events, Meetings.Events** | nothing | Reimbursements, Contacts |
| Overlap | "Year 1 Induction", "CS Fair Booth" | "Year 1 Induction", "CS Fair" | |

**Decision: Team Dashboard > Events is the canonical list.** It has more rows, recent edits, and is the hub that Tasks, Meetings and now Transactions relate to. *Events Team > Events* and the unshared events database are ignored (§8).

### Other overlaps (lower impact)

- **Meetings vs Events**: meetings are a separate list with real dates. Plan to merge both into the calendar (§2).
- **Content Ideas vs Marketing content calendar vs Designs**: three overlapping marketing lists with shared names (e.g. recruitment posts). Not used by the dashboard, so no action needed.
- **Computer Science Resources > Workshops / Hackathons** are external opportunities (other organisers), **not** society events. Don't map them to `useEvents`.
- **Transactions vs Reimbursements / Ledger**: Transactions replaces both. It covers income and expenses, reimbursement status and receipts, and links to canonical Events. Reimbursements and Ledger are ignored (§8).

---

## 5. Ownership for "only edit your own scrum to-dos"

**No data source has an Email property.** The best available option is:

**`Tasks.PIC` (people) → `person.email`.** The integration has the user-email capability: 21 of 23 workspace users have an email. The owner check would be `session.user.email ∈ PIC[].person.email` (Supabase login email vs Notion email).

Problems with using it as-is:

1. **5/13 tasks are assigned to groups** ("Everyone", "Marketing Department"). Groups have no email, so nobody would own them. Should everyone in the group be allowed to edit, or should they be read-only?
2. **3/13 tasks have no PIC.** Unowned tasks: read-only, or editable by anyone?
3. **Some tasks have multiple PICs.** Can any of them edit, or only the first?
4. **At least one workspace user's Notion email is a personal Gmail**, not `@nottingham.edu.my`. If Supabase logins use university emails, that person will never match.
5. The check must run **server-side** (the token can't be in the browser anyway). Otherwise a client could skip it.

Alternative (needs a Notion write, so not done): add an `Owner Email` (email) property to Tasks. It's explicit and matches Supabase exactly, but someone has to fill it in by hand. The PIC email is derived automatically.

---

## 6. Integration notes (for the implementation phase)

- **Server layer (decided): Vercel serverless functions in `/api`**, with shared code in `/api/_lib` (TypeScript, not routed). The hooks call `/api`, and `/api` calls Notion. The token has no `VITE_` prefix and never reaches the browser. See `docs/PLAN.md` → Architecture.
- `Task.dueDate` and `Event.startDateTime` are typed as required strings, but Notion data is mostly empty. The types or the UI need null handling before switching over. That's an app-code change, so it isn't made here.
- File URLs (`Picture`, `Document File`) expire after about 1 hour, so don't cache them.
- Data volume is tiny (≤13 rows per source), so a full query per request is fine. No sync layer is needed yet.

---

## 7. Questions for you

1. ~~**Hidden events database**~~: resolved. Ignored (§8).
2. ~~**What are "weekly scrum to-dos"?**~~: decided. Per-person rows in Tasks. See `docs/PLAN.md` → Tasks and weekly scrum to-dos.
3. ~~**Task `project` label**~~: decided. The linked event's name, hidden when there's no event. See `docs/PLAN.md` → Tasks and weekly scrum to-dos.
4. ~~**Documents**~~: decided. Rows in the Documents data source. See `docs/PLAN.md` → Documents.
5. ~~**Events without data**~~: decided. TBA tag for undated events, meetings on the calendar as `kind: 'meeting'`, agenda/RSVP/description hidden. See `docs/PLAN.md` → Events and meetings.
6. ~~**Team `email`, `department`, `year`**~~: decided. Email from Supabase `committee_members`; department and year from `/api/_lib/memberDetails.ts`. See `docs/PLAN.md` → Team.
7. ~~**Ownership edge cases**~~: decided. PIC email (or `committee_members.notion_email`) owns the task; group-only or empty PIC means anyone can tick, admin-only edit/delete. See `docs/PLAN.md` → Ownership rules. Implemented in `api/_lib/ownership.ts`.
8. ~~**Events Team > Events**~~: resolved. Ignored (§8).
9. ~~**Missing `Location` on Events**~~: resolved. Added as rich_text (0/4 filled).
10. ~~**Transactions ↔ Events relation is one-way**~~: resolved. Now `dual_property`; the reverse is `Events.Transactions`.
11. ~~**Property name casing**~~: resolved. The trailing space was removed from `Recorded by`. `Paid By` and `Reimbursement Status` keep their Notion casing (see Canonical property names).

---

## 8. Ignored data sources

These are out of scope for the dashboard. The survey still records them, but no hook will read them.

| Data source | Reason |
|---|---|
| Events Team > Events | Superseded by Team Dashboard > Events: 2 rows, all fields empty, not edited since June, nothing links to it. |
| Finance Tracker > Reimbursements | Replaced by Transactions (`Paid By` + `Reimbursement Status`). Its 1 row is entirely empty. |
| Finance Tracker > Ledger | Replaced by Transactions. It holds a monthly file upload, not line items. |
| Computer Science Resources (Hackathons, Scholarships, Workshops) | External opportunities run by other organisers, not society events or tasks. |
| Marketing Team (content calendar, Designs, Content Ideas, Contacts) | Marketing's internal workflow and contact list. No dashboard section uses them. |
| Unshared events database (target of `Reimbursements.Event` and `Contacts.Events Involved`) | Not shared with the integration, and both relations into it are empty. |
