# YTUMA AI — n8n Workflow Pack

Importable n8n workflow JSON implementing the full YTUMA system: a central AI "brain" that answers
Telegram, phone, and email requests, backed by calendar/CRM/knowledge-base tools, with production-grade
retry and error-handling infrastructure — and built **multi-client from the ground up**, so onboarding a
new client is "add a row to a registry sheet," not "duplicate 15 workflows."

Built from the internal architecture docs (`01_Gateway` → `12_Email_Sender`, `98_Retry_Engine`,
`99_Error_Handler`). These are real, structurally valid n8n workflow exports — node types, `typeVersion`s,
expressions, and connections are all correct — but every workflow ships with **placeholder IDs and a
generic system prompt** instead of any real person's data. You must wire your own credentials and content
before going live.

## Import order

Import in this order so `Execute Workflow` references resolve (n8n matches by workflow name):

1. `00_Client_Registry.json` — **import this first.** Every other workflow calls it.
2. `99_Error_Handler.json`
3. `98_Retry_Engine.json`
4. `07_CRM.json`
5. `06_Tool_Journal.json`
6. `03_Tool_Calendar.json`
7. `05_Knowledge_Ingestion.json`
8. `02_Brain.json`
9. `01_Gateway.json`
10. `04_Telegram.json`
11. `04b_Debug_Telegram_Brain.json`
12. `08_Phone_Outbound.json`
13. `09_Phone_Inbound_Receptionist.json`
14. `10_Email_Drafter.json`
15. `11_Email_Approval_Handler.json`
16. `12_Email_Sender.json`

After importing, open each `Execute Workflow` node and re-select the target workflow from the dropdown —
n8n stores an internal workflow ID that won't match until you do this once per link.

**Before wiring anything else, read `../docs/testing-guide.md`** — it's the order to actually test these
in (Brain alone → tools alone → channels → abuse/failure cases) so a problem points you at one workflow
instead of "somewhere in 14 files."

## What each workflow does

| # | Workflow | Role |
|---|---|---|
| 00 | Client Registry | The tenancy layer. Looks up a client's Calendar/Sheet/Doc/Pinecone-namespace IDs by `client_id` (or reverse-looks-up by Twilio number or Drive folder ID). Every other workflow calls this before touching a resource. |
| 01 | Gateway | Front door. Auth, input validation, per-client rate limiting, profanity filter, source tagging. Requires `client_id`. Hands off to 02. |
| 02 | Brain | The AI agent (GPT-4o). Loads context, builds the system prompt, calls tools, remembers short-term, returns `{success, output, meta}`. |
| 03 | Tool: Calendar | Validates and executes `add_event` / `check_availability` against Google Calendar. |
| 04 | Telegram | Text + voice message channel. Transcribes voice via Whisper, forwards to Brain, replies. |
| 04b | Debug: Telegram → Brain | Testing sandbox only. Bypasses the Gateway/routing entirely so you can see raw Brain output — point it at a separate test bot, never production. |
| 05 | Knowledge Ingestion | Watches a Drive folder, chunks + embeds new docs into Pinecone so the Brain can retrieve them. |
| 06 | Tool: Journal | Writes durable facts to Pinecone + a human-readable Google Doc. Rejects and logs empty writes; alerts if spammed. |
| 07 | CRM | Normalizes any channel event into one Contacts row (upsert) + one Interactions row (append) in Google Sheets. |
| 08 | Phone (Outbound) | Takes a call request, asks the Brain for a script, places the call via Twilio, logs to CRM. |
| 09 | Phone (Inbound Receptionist) | Answers Twilio calls, transcribes speech, asks the Brain for a reply, speaks it back, logs to CRM. A call to an unrecognized/decommissioned number gets a polite hangup and an Error_Log entry instead of crashing the workflow. |
| 10 | Email Drafter | Asks the Brain to write an email, logs a "pending approval" row, pings you on Telegram. |
| 11 | Email Approval Handler | Listens for `approve` / `edit` / `cancel` replies in Telegram and updates the approval row. |
| 12 | Email Sender | Sends the approved email via Gmail with schema validation, delayed send, attachments, and automatic retry/escalation. |
| 98 | Retry Engine | Shared decision logic: retry, escalate, or stop — used by any workflow that can fail (wired into 12 as the reference example). |
| 99 | Error Handler | Central incident intake: logs every error, dedupes repeats, escalates on frequency, cools down alerts, emails you only when it matters. |

## Required credentials (create these in n8n before activating)

- **OpenAI API** — GPT-4o (Brain, call scripts) + Whisper (voice transcription) + embeddings
- **Pinecone API** — two indexes: `ytuma-memory-v3` (journal/short facts) and `ytuma-knowledge-base` (ingested docs)
- **Google Drive OAuth2** — reading profile/preference docs, watching the knowledge-base folder
- **Google Docs OAuth2** — journal doc + memory-rejections log
- **Google Sheets OAuth2** — CRM sheet, email-approvals sheet, observability sheet
- **Google Calendar OAuth2** — the calendar the assistant manages
- **Gmail OAuth2** — sending drafted emails, sending admin alerts
- **Telegram Bot API token** — the assistant's Telegram bot
- **Twilio API** (Account SID + Auth Token) — outbound/inbound calling
- **Header Auth credential** (`YTUMA Gateway Secret`) — a secret string only your own webhook callers know

## Multi-client architecture

Every workflow that touches a client-specific resource (calendar, CRM sheet, journal doc, Pinecone
namespace, knowledge-base folder) takes a `client_id` and calls **`00_Client_Registry`** to resolve which
actual Sheet/Doc/Calendar/namespace it means. That lookup is one Google Sheet — the entire "how do I add a
new client" runbook is: add one row to it.

### The Client Registry sheet

Create a new Google Sheet named `YTUMA_Client_Registry` with a tab called `Clients` and these columns
(this is the ONE sheet not tied to a single client, since it's what defines all of them):

| Column | Used by | Notes |
|---|---|---|
| `client_id` | everything | short slug, e.g. `certus-partners`. Primary key. |
| `client_name` | Brain, Telegram/email messages | shown to end users and in your admin notifications |
| `status` | (future use) | `active` / `paused` |
| `calendar_id` | 03 (Calendar tool) | the client's Google Calendar address |
| `crm_sheet_id` | 07 (CRM) | a Sheet with `Contacts` + `Interactions` tabs, dedicated to this client |
| `journal_doc_id` | 06 (Journal tool) | dedicated Google Doc |
| `memory_rejections_doc_id` | 06 (Journal tool) | dedicated Google Doc |
| `knowledge_base_folder_id` | 05 (Ingestion) | the client's subfolder under your shared knowledge-base parent folder |
| `pinecone_namespace` | 02, 05, 06 | defaults to `client_id` if left blank — one shared Pinecone index, hard-isolated per client by namespace |
| `alex_profile_file_id`, `preferences_file_id`, `patterns_file_id`, `memory_log_file_id`, `sol_learnings_file_id` | 02 (Brain) | the client's own 5 "life file" Drive docs |
| `admin_email` | 06, 10 | where that client's alerts/approvals go (can be your own address for every row, or delegated per account manager) |
| `admin_telegram_chat_id` | 10 (Email Drafter) | where that client's draft-approval pings go |
| `twilio_number` | 08, 09 (Phone) | the client's own caller ID, purchased under **your** Twilio account — see below |
| `email_sender_workflow_id` | 11 (Approval Handler) | defaults to `12_YTUMA_Email_Sender` (shared); see below for the Pro-tier alternative |
| `preferred_language` | 02 (Brain) | `en` / `es` |

### What's genuinely shared vs. what has to be duplicated per client

n8n binds credentials statically to a node — you can't pick which OAuth2 credential a node uses via an
expression. That constraint decides what can be multi-tenant "for free" (one workflow, resolved by
`client_id`) versus what needs a small per-client copy:

**Shared across all clients, resolved dynamically — no duplication:**
- `02_Brain`, `03_Tool_Calendar`, `06_Tool_Journal`, `07_CRM`, `05_Knowledge_Ingestion`, `98_Retry_Engine`,
  `99_Error_Handler`, `10_Email_Drafter`, `11_Email_Approval_Handler`, `08_Phone_Outbound`,
  `09b_Phone_Inbound_Receptionist`. All of these look up per-client resource IDs at runtime — the
  *document/calendar ID* varies, the *credential* (your own Google/Twilio account) does not. This works
  because you (the agency) provision each client's Sheet/Doc/Calendar and buy each client's Twilio number
  under your own accounts — one Google credential and one Twilio credential can reach all of them.
- **Twilio phone numbers specifically**: one Twilio account can hold many numbers. `08`/`09b` pick the
  `from`/expected `to` number per client via the registry — no per-client workflow copy needed here, unlike
  the two cases below.

**Genuinely need a thin per-client duplicate** (because the *identity itself*, not just the data, must be
the client's own):
- **Telegram bot (`04_Telegram`, `04b_Debug`)** — each client's assistant lives in *their own* Telegram bot
  (that's the actual product), and a bot token is a credential bound to one workflow. Duplicate `04` (and
  optionally `04b`) per client, set `client_id` to a **fixed** value in the `Format - Text` / `Format -
  Voice` nodes (search for `YOUR_CLIENT_ID_HERE`), point the credential at that client's bot token. Both
  copies still call the shared `02_Brain`, `07_CRM`, etc. — only the front door is duplicated.
- **Client-owned email identity (Pro tier only)** — the default (`12_Email_Sender` shared, used by every
  client unless overridden) sends from **your** Gmail account with `Reply-To` set to the client's own
  address. That's zero-duplication and fine for Starter/Standard. If a Pro client wants email to literally
  come from their own business address, duplicate `12_Email_Sender.json`, swap its Gmail credential for the
  client's own, and set that client's `email_sender_workflow_id` row to the new workflow's name — `11`
  already resolves and calls whichever sender the registry points at.

### Placeholders you must still replace

- Every `_FILE_ID`, `_SHEET_ID`, `_DOC_ID`, `_FOLDER_ID` value now lives in the **Client Registry row**,
  not hardcoded in the workflow JSON — add one client row per real client instead of editing 15 files.
- `YTUMA_CLIENT_REGISTRY_SHEET_ID` in `00_Client_Registry.json` — the one ID that *is* still hardcoded,
  since the registry itself isn't per-client.
- `ADMIN_EMAIL` in `99_Error_Handler.json` — this stays a fixed value on purpose: it's your own
  agency-wide ops inbox, not a per-client field (see below).
- `AGENCY_ADMIN_TELEGRAM_CHAT_ID` in `99_Error_Handler.json`'s `Notify - Admin (Telegram)` node — your own
  personal/ops Telegram chat, deliberately separate from any client's bot. This exists because `Notify -
  Admin` (Gmail) uses the same credential as `12_Email_Sender`'s client-facing send by default — if that
  one Gmail account's token dies, email alerting dies with it. The Telegram path is the one that still
  reaches you when Gmail itself is what's broken.
- `YOUR_CLIENT_ID_HERE` / `YOUR_TEST_CLIENT_ID` in `04_Telegram.json` / `04b_Debug_Telegram_Brain.json` —
  set once per duplicated copy.
- `+13176434814` in `08_Phone_Outbound.json` is now a fallback only; the real per-client number comes from
  the registry's `twilio_number` column.
- All `id`/`name` values inside `"credentials": {...}` blocks — n8n regenerates these on first save; the
  placeholders just need a real credential selected once.

### What stays intentionally shared, not per-client

Two things are **your own internal ops tooling**, not client-facing data, so they deliberately stay as one
shared sheet across all clients rather than being split per tenant (with `client_id` added as a logged
column so you can filter):
- **`YTUMA_Email_Approvals`** — you are the one reading and approving drafts; one Telegram inbox showing
  `[ClientName]` per draft is simpler than juggling N approval sheets, and 11's lookup-by-`approval_id`
  design doesn't need to know which client a draft belongs to until *after* it finds the row.
- **`YTUMA_Observability`** (`Error_Log` / `Alert_Dedupe`) — one incident feed across your whole business.
  The dedupe key now includes `client_id` so two different clients hitting the "same shaped" error don't
  get merged into one escalation count.

### The generic system prompt (02_Brain)

`02_Brain.json` builds `system_message` from **the resolved client's own** profile/preferences/patterns
docs (loaded fresh per request via the registry) plus a neutral protocol block that explicitly instructs
the model never to reference another client's data. Per-client personalization happens by pointing that
client's registry row at their own 5 Drive documents, not by editing the workflow.
