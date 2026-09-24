# Notion → CS Society Dashboard: Developer Roadmap

**Who this is for:** The dashboard developer. You are a regular member of the Notion workspace with no admin permissions. You own everything in the codebase.
**Companion doc:** `notion-dashboard-roadmap-WORKSPACE-OWNER.md`. The workspace owner does the Notion-side steps.
**Docs verified against:** Notion API changelog as of 24 Sep 2026 (API version `2026-03-11`, Developer portal, "connections" terminology).

---

## Ground rule: additive only

The workspace holds years of existing information. **Nothing in this roadmap renames, retypes, moves, deletes, or restructures anything that already exists in Notion.** This is enforced in three layers:

1. **Notion permission:** The connection is created with the **Read content** capability only. Its token cannot modify the workspace even if the code tries.
2. **Code:** The Notion client wrapper only exposes read methods (see Prompt 2).
3. **Process:** Mismatches between Notion's shape and the dashboard's TypeScript shape are fixed **in the code's mapper layer**, never by reformatting Notion. Anything that truly needs a change in Notion goes to the owner as a written *additive* request (new property or new database only). The owner can decline, and the code must still work.

---

## Master order (both people)

Do the steps strictly in this order. "Waits for" means don't start until that step is done.

| # | Who | Step | Waits for |
|---|-----|------|-----------|
| 1 | **Developer** | D1: Write data requirements and send the request to the owner | nothing |
| 2 | **Owner** | O1: Optional backup, pick existing databases, create a read-only connection, share, send the token | Step 1 |
| 3 | **Developer** | D2: Store the token, build the read-only client, run discovery | Step 2 |
| 4 | **Developer** | D3: Map existing properties to the TS interfaces, write the additive request | Step 3 |
| 5 | **Owner** | O2: Review the additive request, apply only approved additions | Step 4 |
| 6 | **Developer** | D4: Build the API layer, swap hooks, test locally | Step 5 * |
| 7 | **Developer** | D5: Deploy | Step 6 |
| 8 | **Owner** | O3: Sign off, then ongoing care | Step 7 |

\* You can start D4 for any entity whose mapping has **no** additive request pending. Only the entities waiting on O2 are blocked.

**Later, not now:** Writing to Notion (the add-event form, RSVPs) waits until the auth decision is made. See the last section.

---

## Why the architecture looks like this (read once)

- **The browser can't call Notion.** Notion's API doesn't allow browser (CORS) requests, and calling it from React would expose the token to every visitor. So Notion sits behind serverless functions (`/api/*`), and your existing hooks call those.
- **Use an internal connection, not a personal access token.** A PAT acts as one person. When that person graduates or leaves, the dashboard breaks. An internal connection is its own bot, keeps its access when members leave, and only the owner can create it. (On Free and Business workspaces, PAT creation defaults to owners only anyway.)
- **Query data sources, not databases.** Since API `2025-09-03`, a database is a container holding one or more *data sources*. You query the data source ID, which is not the ID in the database URL. The discovery script resolves this.
- **API version `2026-03-11` changes:** Use `in_trash`, not `archived`. Append-block uses `position`, not `after` (irrelevant while read-only).
- **Rate limits:** 180 requests/min per connection on non-Business plans, plus a workspace-wide limit shared with every other connection the society uses. Caching (D4) keeps you well under this.
- **Free workspace block limits** now apply to REST API calls from internal connections. Reads are fine; mention this if a 403 ever shows up.

---

## Step 1 — D1: Data requirements and the request to the owner

### Manual

1. Check where the dashboard is deployed (bolt.new usually uses Netlify; check your dashboard). Note it as `[HOST]` for the prompts below.
2. Run Prompt 1.
3. Send the owner:
   - the generated `docs/owner-request-01.md`
   - the companion doc `notion-dashboard-roadmap-WORKSPACE-OWNER.md`
4. Tell the owner how you want to receive the token: a password-manager share link or a one-time secret link. **Not** a group chat, email thread, or Notion page.

### Claude Code — Prompt 1 (planning only, no code changes)

```
We're connecting this dashboard to an EXISTING, years-old Notion workspace. Rule: we never restructure Notion. All shape mismatches will be solved in our code.

Do not modify any source files in this step.

1. Read the TypeScript interfaces Task, Event (incl. agenda), TeamMember, Document, and every place they're consumed via the hooks.

2. Create docs/dashboard-data-requirements.md listing, per interface:
   - each field, its type, whether the UI actually requires it or it's optional/decorative
   - which UI views use it
   - a plain-English description of what kind of Notion data could supply it (e.g. "a date with start and end time")
   Mark fields that could be derived in code (defaults, computed values) so they don't need to exist in Notion.

3. Create docs/owner-request-01.md, a short, friendly, non-technical message to the workspace owner that:
   - explains the dashboard will only READ from Notion, via a read-only connection
   - asks which EXISTING databases (if any) hold: events, tasks/to-dos, team/committee members, documents/resources
   - asks them to follow Step O1 in the owner roadmap doc
   - flags that sharing a page with the connection also shares all its sub-pages, so they should share the specific databases, not large top-level pages
   - asks whether any of those databases contain sensitive personal data (phone numbers, IC numbers, addresses) so we know to exclude those fields
   Keep it under 300 words.
```

---

## Step 3 — D2: Store the token, read-only client, discovery

*Starts after the owner finishes O1 and sends you the token plus the list of shared databases.*

### Manual

1. Create `.env.local` in the project root:

   ```
   NOTION_TOKEN=paste_token_here
   NOTION_EVENTS_DB_URL=
   NOTION_TASKS_DB_URL=
   NOTION_TEAM_DB_URL=
   NOTION_DOCUMENTS_DB_URL=
   NOTION_DASHBOARD_PAGE_URL=
   ```

   Leave a URL blank if the owner said no existing database covers that entity.

2. ⚠️ **Never prefix these with `VITE_`.** Vite ships `VITE_*` variables to the browser, which would publish the token.
3. Confirm `.env.local` is in `.gitignore` **before** your next commit.
4. Run Prompt 2, then run the discovery script.

### Claude Code — Prompt 2 (read-only client + discovery)

```
Set up a READ-ONLY Notion client and a discovery script. The Notion workspace is old and must never be modified. Treat any write as a bug.

1. Install the latest @notionhq/client.

2. Create server/notion/client.ts:
   - Instantiate Client with auth: process.env.NOTION_TOKEN and notionVersion: "2026-03-11".
   - Do NOT export the raw Client. Export a small readOnlyNotion object exposing only: databases.retrieve, dataSources.retrieve, dataSources.query, pages.retrieve, blocks.children.list.
   - Add a header comment: server-only, never import from src/, read-only by design.

3. Add a guard: a test (or ESLint no-restricted-imports / no-restricted-syntax rule) that fails if anything under src/ imports from server/, or if any file calls .create( / .update( / .delete( / .append( / .move( on a Notion client. Wire it into `npm test` or lint.

4. Create scripts/notion-discover.ts (run with `npx tsx scripts/notion-discover.ts`) that:
   - loads .env.local
   - extracts the database ID from each NOTION_*_DB_URL (skip blanks)
   - retrieves each database and lists its data sources (id + name); warn if there is more than one
   - for each data source, retrieves the schema and records every property: name, property ID, type, and select/status options where relevant
   - queries at most 5 rows per data source for samples. Write the samples ONLY to .notion-samples/ and add that folder to .gitignore (they may contain personal data)
   - writes docs/notion-discovery.md containing schemas only (no row data)
   - prints ready-to-paste lines: NOTION_EVENTS_DATA_SOURCE_ID=... etc.
   - makes zero write calls (use readOnlyNotion only)

Use 2026-03-11 semantics: in_trash (not archived), dataSources.query (not databases.query).
```

### Manual

5. Paste the printed `NOTION_*_DATA_SOURCE_ID=` lines into `.env.local`.
6. If discovery returns `object_not_found` for a database, ask the owner to share it (O1, step 5). Don't try to work around it.

---

## Step 4 — D3: Mapping and the additive request

### Claude Code — Prompt 3 (mapping, no Notion changes)

```
Using docs/dashboard-data-requirements.md, docs/notion-discovery.md and the samples in .notion-samples/, produce a mapping plan. Do not change Notion and do not write app code yet.

1. docs/notion-mapping.md. For every interface field, one of:
   (A) MAPPED: existing property. Record the property ID (primary key for lookups) and the name (fallback). Include the transformation (e.g. select → union type, multi_select → string[], date {start,end,time_zone} → ISO strings, people → names, relation → ids, rich_text → plain text).
   (B) DERIVED IN CODE: a default or computed value. Explain the logic.
   (C) NEEDS ADDITIVE PROPERTY: only if the UI genuinely requires it and it can't be derived.
   (D) NEEDS NEW DATABASE: only if no existing database can supply the entity (e.g. Event.agenda if events have no sub-schedule data).
   Prefer A or B wherever at all reasonable. Messy old data should be tolerated by the mapper, not cleaned in Notion.

2. For each data source, propose a read filter so we don't pull years of history, e.g. events on_or_after a relative date like "one_month_ago", team members filtered by an existing "active"/"year" property if one exists. If nothing suitable exists, note it as a C request or a code-side filter.

3. A "Protected properties" list: every Notion property the dashboard reads. The owner will share this with the committee so nobody deletes or retypes them. (Renaming is OK, since we look up by property ID.)

4. A privacy check: list any property in shared databases that looks sensitive and confirm the mappers will NOT read or return it.

5. docs/owner-request-02.md: a plain-language additive request for the owner containing ONLY C and D items. For each item: what to add, exact name and type, where, why the dashboard needs it, and what happens if they decline (the code fallback). State clearly that nothing existing will be renamed, retyped, moved or deleted. If there are no C/D items, say so and that O2 can be skipped.
```

### Manual

1. Read `docs/notion-mapping.md` critically. Push category C/D items back toward B wherever you can live with a default. Every request you send is something the owner has to trust.
2. Send `docs/owner-request-02.md` and the "Protected properties" list to the owner.

---

## Step 6 — D4: API layer, hook swap, local testing

*Starts after O2 is done, or immediately for entities with no pending requests.*

### Manual

If the owner created new databases (e.g. Agenda Items) in the "Dashboard Data" page, add their URLs to `.env.local` and **rerun discovery** first. Update the mapping doc if anything changed.

### Claude Code — Prompt 4 (serverless API layer)

```
Build a READ-ONLY serverless API layer for [HOST: Netlify Functions / Vercel Functions], following docs/notion-mapping.md exactly.

Endpoints (GET only): /api/events, /api/tasks, /api/team-members, /api/documents

- Use only readOnlyNotion from server/notion/client.ts.
- Query each data source by NOTION_*_DATA_SOURCE_ID with the filters from the mapping doc. Follow next_cursor pagination. Stop and log a warning if a response has request_status.type === "incomplete".
- Mappers in server/notion/mappers/*.ts return EXACTLY the existing TS interfaces (import shared types, don't duplicate them).
- Look up properties by property ID first and fall back to name, so a committee member renaming a column doesn't break the dashboard.
- Mappers are defensive: missing, empty, or oddly typed legacy values produce defaults, never crashes. Formula/rollup values of type "unsupported" count as missing. Ignore unknown properties.
- Whitelist output: mappers only emit interface fields. Sensitive properties from the privacy check must never be read into the response.
- Use page.id as the id. Never parse Notion URLs for identity. A page's url may be used as a display link only.
- Events: if an Agenda source exists, attach its items to agenda[], sorted. Otherwise agenda = [].
- Dates are ISO strings with timezone offsets preserved.
- Headers: Cache-Control "public, s-maxage=60, stale-while-revalidate=300".
- Errors: log details server-side and return { error: { code, message } }. Never leak the token or raw Notion error bodies.
- Local dev: `[netlify dev | vercel dev]` must serve the Vite app plus functions with /api working. Document this in README.
- Unit tests for every mapper, using fixtures built from the shapes in .notion-samples/ with personal values replaced by fake data. Commit the fixtures, not the samples. Include fixtures for messy legacy rows (empty title, missing dates, unknown select option).
```

### Claude Code — Prompt 5 (swap the hooks)

```
Switch useTasks, useEvents, useTeamMembers, useDocuments from mock data to the /api endpoints.

- Keep each hook's public signature exactly: { data, isLoading, error }. No UI component should need edits. If one does, stop and explain why.
- Remove the artificial delay.
- Keep mocks behind VITE_USE_MOCKS=true for offline work and for testing loading/empty/error states.
- Map API error responses into the existing error shape.
- Grep for numeric-id assumptions (parseInt on ids, numeric comparisons or sorting by id) and fix them, since ids are now UUID strings.
- List every modified file at the end.
```

### Manual — local test checklist

- [ ] Run `[netlify dev | vercel dev]`, not plain `npm run dev`.
- [ ] Home, Calendar & Events, and Team Directory all render real data.
- [ ] The Network tab shows calls to `/api/...` only, and **nothing** to `api.notion.com`.
- [ ] Old or messy rows don't crash anything, and empty states still work.
- [ ] No sensitive fields appear in any `/api/*` JSON response. Open each one directly.
- [ ] Ask the owner (or anyone with edit access) to change one harmless value in a shared database. It appears within about a minute.

---

## Step 7 — D5: Deploy

1. In the host dashboard (Netlify: *Site configuration → Environment variables*; Vercel: *Project → Settings → Environment Variables*), add `NOTION_TOKEN` and every `NOTION_*_DATA_SOURCE_ID`. Set them for **Production and Preview**. Don't set `VITE_USE_MOCKS`.
2. Deploy, then open `https://<site>/api/events` directly and check that it returns JSON.
3. Tell the owner it's live so they can do O3.

---

## Later: writes (add-event form, RSVPs)

Not part of this roadmap. When the auth decision is made:

- Writing needs the owner to enable **Insert content** on the connection. That breaks the "token can't write" safety net, so writes should target **only** the new "Dashboard Data" page's databases, never the legacy ones.
- Without auth, any write endpoint is callable by anyone on the internet.
- RSVPs don't belong in Notion: they need user identity and would burn rate limits. They'll go in a small separate database alongside auth.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `object_not_found` | Database not shared with the connection | Ask the owner (O1, step 5) |
| `unauthorized` / 401 | Wrong or missing token in that environment | Check `.env.local` or host env vars |
| Query validation error / empty results | Using the database ID instead of the data source ID | Rerun discovery |
| CORS error in browser console | Something in `src/` is calling Notion | Route it through `/api`; the guard test should catch this |
| Field suddenly empty | Someone deleted or retyped a protected property | Ask the owner. The mapper should have defaulted gracefully |
| Works locally, fails in production | Env vars missing, or set only for Preview | Check the host dashboard |
| 429 errors | Cache disabled or too many cold requests | Check the Cache-Control header is present |
| 403 mentioning block limit | Free-plan block limit reached | Owner's decision; not fixable in code |
