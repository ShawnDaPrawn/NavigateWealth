# Password Manager

The Password Manager is the bridge between outside AI agents (Claude, ChatGPT, anything that speaks MCP) and the systems the firm signs in to. It keeps logins encrypted, holds the plain-English **skills** that explain how to do work in each system, and lets agents reach both over MCP. Only super admins can open it.

## Where it is

Sidebar → Practice → **Password Manager** (`/admin?module=password-manager`). It is a normal admin module with four tabs: **Logins**, **Skills**, **AI agents** and **Activity**. Super admins open it directly; the two-factor gate in `vault-unlock.ts` stays dormant while every vault route requires super admin.

## The model: services, logins, skills

- A **service** is a system you sign in to: Allan Gray, GoAML, a bank. **Navigate Wealth** is built in, always listed first, and cannot be deleted. Add its platform account (the account agents sign in to the admin panel with) as a Navigate Wealth login.
- A **login** belongs to one service. Ten brokers with ten Allan Gray logins are ten logins under one Allan Gray service. Each login says whether AI agents may use it: **Hidden from AI**, **Ask me first** (the default), or **Allowed**.
- A **skill** is instructions written the way you would brief a new colleague: the goal, the steps, what to check, what never to do. A skill is either **shared by every login of its service** (write it once for all ten Allan Gray logins) or **for one login only** (the differences for that login). Agents read the shared skills first, then the login's own, which win where they differ.

For Navigate Wealth logins, agents also receive the **platform map** (`src/shared/platform-guide.ts`): every admin module, what it is for and its deep link. `platformGuide.test.ts` fails if the map falls out of step with the sidebar.

On any login, **Preview** shows exactly the text an agent receives (`src/shared/vault-skills.ts`, used by both the screen and the MCP server).

## Connecting an agent

1. **AI agents → Connect agent.** Give it a name (one per person per tool, e.g. “Claude — Shawn”), choose the services it can work in (every service, or the ones you pick), and whether it may receive passwords: **Never** (find logins and read skills only), **Ask me each time**, or **Allowed**. A login set to “Ask me first” still asks.
2. For Claude the callback address is filled in (`https://claude.ai/api/mcp/auth_callback`); change it only if Claude shows a different one. ChatGPT gives each app its own callback address (`https://chatgpt.com/connector/oauth/…`), so for ChatGPT paste the one its app settings show; the form will not create a ChatGPT connection without it. If a sign-in is refused with "The AI tool asked to return to X", connect the agent again with X as its callback. Leave the address empty for any other client to get a bearer token instead.
3. Copy the **Client ID** and **Client Secret** (shown once) into the tool along with the server address `https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379/mcp/password-vault`. Use that address, not `https://www.navigatewealth.co/mcp/password-vault`: the website one still works for connectors already added with it, but it passes through Vercel's edge firewall, whose AI-bot rules can drop an assistant's calls after it has signed in (seen 2026-11-25: Claude received a token four times and its first authenticated call never arrived). In Claude: Settings → Connectors → Add custom connector. In ChatGPT: Settings → Apps & Connectors → Create (developer mode).
4. The tool sends you to `/oauth/authorize`, which brings you to **AI agents** with a sign-in request. Review and approve it. Access tokens last up to 30 days; reconnect within the connection's lifetime to renew.

**Pause all** stops every agent at once. **Disconnect** ends one for good and says how many passwords it had received, so you can change them.

## What an agent can do (MCP tools)

`list_services`, `search_logins`, `get_skills`, `get_platform_guide`, `get_approval_status`, and — unless the agent may never receive passwords — `get_login` (website, username, password and the current one-time code) and `get_one_time_code`. An agent connected with **Can it write skills?** switched on also gets `save_skill`: it adds a skill for one login it can see, or updates that login's skill with the same title. It cannot write a service-wide skill, cannot write for a login it cannot see, and is refused if the text contains that login's password. Each skill it saves is marked _AI agent · <name>_ under Skills and logged in Activity ("Wrote skill", "Updated skill"). The setting is off by default, and every agent reads skills, so switch it on only for agents you trust; you can change it later under **Change**. When a person must approve, the answer is `waiting_for_approval` with an `approval_id`; the request appears under **Activity → Waiting for you**. Once approved, the agent repeats the call with the `approval_id`, which works once.

Agents sign in themselves, in their own browser (Claude in Chrome, ChatGPT agent mode and the like). Every password handed out is recorded on the login (“given to an AI since it last changed”) and in Activity.

## Keys and storage

The database migration generates a 32-byte master key in Supabase Vault under `navigatewealth_password_manager_key`. Include that secret and the project's Vault recovery material in your backups: restoring records requires the matching key. Firm logins are sealed with the Brokerage collection's data key, itself sealed by the master key. Records live in the service-role KV store: `password-vault:` (logins, encrypted) and `pvault-*` (services, skills, connections, approvals, activity, settings). Skills, services and activity are not secret and are stored in clear; activity never records a password.

## Retired on 2026-11-24

The selector-based broker-reporting workflows, the “Use for broker reporting” option on a login, autonomy presets, hosted browser sessions (`scripts/vault-browser-host.mjs`), personal collections and “My saved logins” were removed from the Password Manager. None held data in production. The broker-operations backend (`broker-ops-*.ts`, `/mcp/broker-operations`) is untouched but no longer has a screen; its OAuth server still signs agents in for this module.
