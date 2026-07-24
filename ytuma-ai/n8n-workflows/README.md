# YTUMA AI — n8n Workflow Pack

Importable n8n workflow JSON implementing the full YTUMA system: a central AI "brain" that answers
Telegram, phone, and email requests, backed by calendar/CRM/knowledge-base tools, with production-grade
retry and error-handling infrastructure.

Built from the internal architecture docs (`01_Gateway` → `12_Email_Sender`, `98_Retry_Engine`,
`99_Error_Handler`). These are real, structurally valid n8n workflow exports — node types, `typeVersion`s,
expressions, and connections are all correct — but every workflow ships with **placeholder IDs and a
generic system prompt** instead of any real person's data. You must wire your own credentials and content
before going live.

## Import order

Import in this order so `Execute Workflow` references resolve (n8n matches by workflow name):

1. `99_Error_Handler.json`
2. `98_Retry_Engine.json`
3. `07_CRM.json`
4. `06_Tool_Journal.json`
5. `03_Tool_Calendar.json`
6. `05_Knowledge_Ingestion.json`
7. `02_Brain.json`
8. `01_Gateway.json`
9. `04_Telegram.json`
10. `08_Phone_Outbound.json`
11. `09_Phone_Inbound_Receptionist.json`
12. `10_Email_Drafter.json`
13. `11_Email_Approval_Handler.json`
14. `12_Email_Sender.json`

After importing, open each `Execute Workflow` node and re-select the target workflow from the dropdown —
n8n stores an internal workflow ID that won't match until you do this once per link.

## What each workflow does

| # | Workflow | Role |
|---|---|---|
| 01 | Gateway | Front door. Auth, input validation, rate limiting, profanity filter, source tagging. Hands off to 02. |
| 02 | Brain | The AI agent (GPT-4o). Loads context, builds the system prompt, calls tools, remembers short-term, returns `{success, output, meta}`. |
| 03 | Tool: Calendar | Validates and executes `add_event` / `check_availability` against Google Calendar. |
| 04 | Telegram | Text + voice message channel. Transcribes voice via Whisper, forwards to Brain, replies. |
| 05 | Knowledge Ingestion | Watches a Drive folder, chunks + embeds new docs into Pinecone so the Brain can retrieve them. |
| 06 | Tool: Journal | Writes durable facts to Pinecone + a human-readable Google Doc. Rejects and logs empty writes; alerts if spammed. |
| 07 | CRM | Normalizes any channel event into one Contacts row (upsert) + one Interactions row (append) in Google Sheets. |
| 08 | Phone (Outbound) | Takes a call request, asks the Brain for a script, places the call via Twilio, logs to CRM. |
| 09 | Phone (Inbound Receptionist) | Answers Twilio calls, transcribes speech, asks the Brain for a reply, speaks it back, logs to CRM. |
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

## Placeholders you must replace

Search each file for these tokens and replace with your real values:

- `ALEX_PROFILE_FILE_ID`, `PREFERENCES_FILE_ID`, `PATTERNS_FILE_ID`, `MEMORY_LOG_FILE_ID`, `SOL_LEARNINGS_FILE_ID` — Drive file IDs (02_Brain)
- `YTUMA_KNOWLEDGE_BASE_FOLDER_ID` — Drive folder ID to watch (05)
- `YTUMA_JOURNAL_DOC_ID`, `YTUMA_MEMORY_REJECTIONS_DOC_ID` — Google Doc IDs (06)
- `YTUMA_CRM_SHEET_ID` — Google Sheet ID with `Contacts` and `Interactions` tabs (07)
- `YTUMA_EMAIL_APPROVALS_SHEET_ID` — Google Sheet ID (10, 11)
- `YTUMA_OBSERVABILITY_SHEET_ID` — Google Sheet ID with `Error_Log` and `Alert_Dedupe` tabs (99)
- `ADMIN_EMAIL`, `ADMIN_TELEGRAM_CHAT_ID` — where alerts and approval pings go
- `+13176434814` — your real Twilio number (08)
- All `id`/`name` values inside `"credentials": {...}` blocks — n8n regenerates these on first save; the placeholders just need a real credential selected once

## The generic system prompt (02_Brain)

The reference docs described a persona hard-coded around one specific person's life. That's a liability if
this is going to be sold to multiple clients — a template shouldn't ship with anyone's private profile baked
in. `02_Brain.json` instead builds `system_message` from **the client's own** profile/preferences/patterns
docs (loaded fresh per deployment) plus a neutral protocol block. Per-client personalization should happen by
swapping those five Drive documents, not by editing the workflow.

## Multi-client packaging note

Right now every workflow assumes one tenant. To sell this to more than one client without rebuilding it per
client, the cheapest real change is: prefix every Sheet/Doc/Pinecone-namespace ID with a `client_id`, and pass
`client_id` through the Gateway → Brain → tools chain the same way `user_id` already flows. That's a
half-day refactor, not a rewrite — the routing skeleton here already supports it.
