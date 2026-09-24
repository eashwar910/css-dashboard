# Notion → CS Society Dashboard: Workspace Owner Roadmap

**Who this is for:** The owner of the society's Notion workspace. No coding required.
**Companion doc:** `notion-dashboard-roadmap-DEVELOPER.md`. The dashboard developer handles all the code.
**Time needed from you:** About 20–30 minutes for Step O1, 10–20 minutes for O2 (if needed), 5 minutes for O3.
**Docs verified against:** Notion developer docs as of 24 Sep 2026.

---

## What this does, and what it will never do

The society dashboard (website) will **read** information from a few Notion databases, such as events, tasks, committee members, and documents, and display it.

**Promises this setup is built around:**

- **Nothing that already exists will be renamed, restructured, moved, or deleted.** The workspace's years of content stay exactly as they are.
- The dashboard connects with **read-only** permission. Even if something went wrong in the code, Notion itself would refuse any attempt to edit.
- It can only see the specific databases **you** choose to share with it, and nothing else.
- If the developer ever needs something *added* (a new column, or a new database), you'll receive a written request explaining why and what happens if you say no. You can always say no.

---

## Master order (both people)

Do the steps in this order. "Waits for" means don't start until that step is done.

| # | Who | Step | Waits for |
|---|-----|------|-----------|
| 1 | **Developer** | D1: Sends you a request message and this doc | nothing |
| 2 | **Owner (you)** | **O1:** Optional backup, pick databases, create a read-only connection, share, send the token | Step 1 |
| 3 | **Developer** | D2: Sets up the code and inspects the databases you shared | Step 2 |
| 4 | **Developer** | D3: Works out what fits; sends you an "additive request" if anything is missing | Step 3 |
| 5 | **Owner (you)** | **O2:** Review the request, add only what you approve | Step 4 |
| 6 | **Developer** | D4: Builds and tests the dashboard connection | Step 5 |
| 7 | **Developer** | D5: Puts it live | Step 6 |
| 8 | **Owner (you)** | **O3:** Sign off, then ongoing care | Step 7 |

---

## Step 2 — O1: Set up the read-only connection

*Start after you receive the developer's request message (`owner-request-01.md`).*

### 1. (Optional, recommended) Back up

The connection is read-only, so it cannot damage anything. A backup is simply good practice before letting anything new near an old workspace, and it covers any additions you approve later in O2.

- Export the workspace from your workspace **Settings** (look for the option to export all workspace content), or export just the relevant pages via each page's **•••** menu → **Export**.
- Store the export somewhere safe, such as the society's shared drive.

### 2. Decide which existing databases to share

Using the developer's questions, find the **existing** databases (if any) that hold:

- Events
- Tasks / to-dos
- Team / committee members
- Documents / resources

Write down each one. It's fine if some don't exist; the developer will handle that.

⚠️ **Share databases, not big top-level pages.** Sharing a page with the connection automatically shares **every page nested under it**. If your events database lives inside a large page like "Society HQ" that also contains finances or private notes, share only the events database itself.

⚠️ **Check the members database for sensitive data.** If it contains phone numbers, IC numbers, addresses, and so on, tell the developer which columns those are. The code will be set to never read or display them. If you're uncomfortable sharing it at all, don't. The developer can work with a new, minimal members database instead (see O2).

### 3. Create a "Dashboard Data" page (new and empty)

Create one new, empty page somewhere sensible, called **Dashboard Data**. Any *new* databases the dashboard needs later will live here, completely separate from existing content.

*Optional:* Give the developer **Can edit** access to **only this page** (Share → invite them). This lets them build any new databases themselves without having edit access to anything else in the workspace.

### 4. Create the connection

You need to be a Workspace Owner for this.

1. If you don't see developer tools in Notion, turn on **Developer Mode** in your Notion **Settings**.
2. Go to the Developer portal: **https://app.notion.com/developers/connections**
3. In the sidebar under **Build**, choose **Internal connections**.
4. Click **Create a new connection**.
   - **Name:** `CS Society Dashboard`. Members will see this name, so keep it recognizable.
   - **Workspace:** the society workspace.
5. Open the **Configuration** tab and set the capabilities:
   - ✅ **Read content**: ON
   - ❌ **Update content**: OFF
   - ❌ **Insert content**: OFF
   - ❌ **Read user information**: OFF, unless the developer specifically asks for it
6. On the same **Configuration** tab, find the **Installation access token**. You'll send this in step 6.

> **Why a connection and not a personal token?** A personal access token acts as one person. When that person graduates or leaves, the dashboard would break. A connection is its own "bot" that stays working through committee changeovers.

### 5. Share the chosen databases with the connection

A new connection can see **nothing** until you share things with it. For each database from step 2, **plus** the new "Dashboard Data" page, use either method:

- **From the Developer portal:** Open the connection → **Content access** tab → **Edit access** → select the databases and the Dashboard Data page.
- **From the page itself:** Open the database → **•••** (top right) → **Connections** → **+ Add connection** → search "CS Society Dashboard" → confirm.

Sharing does not change the databases in any way. It only grants read access.

### 6. Send the developer the token and the list

Send the developer:

1. **The token**, via a password-manager share or a one-time secret link.
   🚫 **Never** in a group chat, an email thread, or a Notion page. Anyone with the token can read everything you shared.
2. **The links** to each shared database, labelled (Events / Tasks / Members / Documents), plus the Dashboard Data page link.
3. **Notes:** Which entities have no existing database, and any sensitive columns to exclude.

Then you're done until the developer sends the additive request.

---

## Step 5 — O2: Review the additive request

*Start after you receive `owner-request-02.md` from the developer. If it says no additions are needed, skip to O3.*

The request only ever asks for two kinds of things:

**A. A new column (property) on an existing database**
- A new column shows up on every row, empty by default. Existing content isn't changed.
- It will appear as a new column in existing views; you can hide it from any view.
- If you approve: open the database → add the property with **exactly** the name and type in the request.

**B. A new database**
- This always goes **inside the Dashboard Data page**, never elsewhere.
- Because Dashboard Data is already shared with the connection, anything created inside it is automatically visible to the dashboard. No extra sharing is needed.
- If you gave the developer edit access to Dashboard Data, they can create it themselves.

**Rules for O2:**

- ✅ Add new columns and new databases that you approve.
- 🚫 Do not rename, retype, delete, or move anything existing to "help" the dashboard. The code adapts to your workspace, not the other way round.
- You may decline any item. The request states what the dashboard does without it.

Tell the developer which items you approved and completed.

---

## Step 8 — O3: Sign-off and ongoing care

### Sign-off (once, after the developer says it's live)

- [ ] Open the live dashboard. Does the information match Notion?
- [ ] Nothing you consider private is visible on the dashboard.
- [ ] In the Developer portal, the connection still shows **Read content** only.

### Ongoing care

**Protected properties.** The developer will give you a list of the columns the dashboard reads. Share it with the committee (pin it on the Dashboard Data page):
- **Renaming** these columns is fine.
- **Deleting** them or **changing their type** (e.g. Date → Text) will make that information disappear from the dashboard.

**If the token leaks** (posted somewhere by accident): Open the connection's **Configuration** tab and refresh/regenerate the token. Send the new one to the current developer the same secure way. The old one stops working immediately.

**Committee handover:** When you hand over workspace ownership, show the new owner the connection in the Developer portal and this doc. The connection keeps working through the change, since it doesn't depend on any one person.

**Developer handover:** When a new developer takes over, send them the token securely and remove the old developer's edit access to Dashboard Data (if you granted it). Consider regenerating the token at the same time.

**Future writes:** At some point the developer may ask to let the dashboard *create* things (such as events from a form). That would mean turning on **Insert content**, and it should only ever apply to databases inside Dashboard Data. That's a separate decision for later. Nothing in this roadmap requires it.

---

## Quick reference

| Thing | Where |
|---|---|
| Developer portal | https://app.notion.com/developers/connections |
| Connection capabilities | Connection → **Configuration** tab |
| What the connection can see | Connection → **Content access** tab |
| Share a single database | Database → **•••** → **Connections** → **+ Add connection** |
| Regenerate the token | Connection → **Configuration** tab |
