# Testing Guide — Is It Actually Ready?

A step-by-step order to test the system before you trust it with a real client. Test bottom-up: prove the
small pieces work in isolation before you test the whole chain, so a failure points you at one workflow
instead of "somewhere in 14 files."

Use a **test Telegram bot, a test Twilio number, and your own email/calendar** for all of this — never
your first real client's accounts. Get a second Telegram bot token from @BotFather for testing; it costs
nothing and keeps debug traffic out of production data.

## 0. Before you test anything

- [ ] Import all 14 workflows in the order listed in `n8n-workflows/README.md`
- [ ] Re-select the target workflow inside every `Execute Workflow` node (n8n won't resolve the link from
      the raw JSON alone — do this once per link, per workflow)
- [ ] Create every credential listed in that README
- [ ] Replace every placeholder ID (`grep -rn "_FILE_ID\|_SHEET_ID\|_DOC_ID\|ADMIN_" n8n-workflows/` from
      the repo root will list them all)
- [ ] Create the actual Google Sheets/Docs the placeholders point to, with the exact tab names the
      workflows expect: `Contacts` + `Interactions` (CRM sheet), `Sheet1` (email approvals),
      `Error_Log` + `Alert_Dedupe` (observability sheet)

## 1. Test the Brain alone (no channels, no tools required to pass)

Import `04b_Debug_Telegram_Brain.json` and point it at your **test bot**. This is the same pattern as a
`04_Debug` sandbox — it skips the Gateway, skips rate limiting/routing, and just asks: does the Brain
respond at all?

1. Activate the workflow.
2. Message your test bot: "Hey, who are you?"
3. **Pass**: you get a coherent reply back within a few seconds.
4. **Fail modes and what they mean**:
   - No reply at all → check the n8n execution log for `02_YTUMA_Brain`; likely a missing OpenAI credential
     or the `Execute Workflow` node isn't pointed at the right workflow.
   - Reply is the `⚠️ Brain returned empty output` fallback → the Agent node ran but produced nothing;
     check the OpenAI credential and the `gpt-4o` model access on that API key.
   - Reply mentions "(profile not loaded)" for everything → expected until you wire real Drive file IDs
     into `02_Brain.json`'s five `Read - *` nodes; not a bug, just unconfigured.

Don't move on until this step passes — every other workflow calls the Brain, so a broken Brain fails
everything downstream in a way that's harder to diagnose.

## 2. Test each tool workflow in isolation

n8n lets you execute a single node with a manual test payload — right-click the trigger node → "Execute
step" (or use a temporary Manual Trigger wired to the same input) — no need to go through the Brain yet.

**`03_Tool_Calendar`** — feed it:
```json
{ "action": "check_availability", "start_time": "2026-08-01T14:00:00-05:00", "end_time": "2026-08-01T15:00:00-05:00" }
```
Pass: returns `{ "success": true, "availability": ... }` without error. Then try `add_event` with a
`summary` and confirm the event actually appears on the real Google Calendar.

**`07_CRM_Sheets`** — use the built-in `Test - Sample Event` node (right-click → Execute Node). Confirm a
row appears in both the `Contacts` tab (upserted) and `Interactions` tab (appended) of your CRM sheet.

**`06_Tool_Journal`** — manually trigger with `{ "note_to_add": "Test note - ignore", "user_id": "test" }`.
Confirm it appears in your journal Google Doc AND as a new vector in the `ytuma-memory-v3` Pinecone index
(check the Pinecone console). Then trigger again with an **empty** `note_to_add` and confirm it logs to
the rejections doc instead of writing garbage to memory.

**`99_Error_Handler`** — use `Start - Manual Test Trigger` with:
```json
{ "workflow_name": "test", "node_name": "test_node", "severity": "high", "message": "Test error", "error_type": "TEST", "trace_id": "test-001" }
```
Pass: a row appears in `Error_Log`, a row appears in `Alert_Dedupe`, and you get an email alert (severity
high should always notify on first occurrence). Run it 3 times in under 10 minutes with the same payload
and confirm you get exactly one email (cooldown working), not three.

**`98_Retry_Engine`** — trigger with `{ "workflow_name": "test", "severity": "low", "attempt": 0 }` a few
times in a row, incrementing nothing yourself — confirm `attempt` increments each call and that after 3
calls (default `max_attempts`) it returns `action: "stop"` instead of retrying forever.

## 3. Test each channel end-to-end (through the Gateway this time)

Now that the Brain and tools are proven, test the real entry points — this exercises `01_Gateway` too.

**Telegram (production `04_Telegram`):**
- [ ] Send plain text → get a reply
- [ ] Send a voice note → get a reply that reflects what you said (proves Whisper transcription works)
- [ ] Send a photo or sticker → get the "I only understand text and voice" fallback, not silence or an error
- [ ] Ask something that requires the calendar tool ("what's on my calendar Tuesday?") → confirm the Brain
      actually calls `03_Tool_Calendar` rather than making up an answer (check the execution log's tool
      calls, not just the reply text)

**Email pipeline (`10` → `11` → `12`):**
- [ ] Manually trigger `10_Email_Drafter` with a real test `to_email` (use your own address)
- [ ] Confirm a row appears in the approvals sheet with `status: pending_approval`
- [ ] Confirm you get the Telegram approval card with the draft and an `approval_id`
- [ ] Reply `approve <id>` → confirm the sheet row flips to `approved` and you get a confirmation message
- [ ] Confirm `12_Email_Sender` actually sends the email and you receive it in your test inbox
- [ ] Repeat with `cancel <id>` and `edit <id>: new body` and confirm each does what it says
- [ ] **Force a failure**: temporarily break the Gmail credential (revoke/expire it), trigger a send, and
      confirm it retries per `98_Retry_Engine` and eventually escalates to `99_Error_Handler` with an alert
      — this is the single most important test since it's your core sales differentiator

**Phone (`08` outbound, `09b` inbound) — only if you're on the Pro tier build:**
- [ ] Outbound: POST to the `09a`/`08` webhook with a test `to_phone` (your own number) and confirm you
      receive a call with a sensible script
- [ ] Inbound: call your Twilio test number, speak a request, confirm you get a spoken reply and a row in
      the CRM `Interactions` tab

## 4. Load/abuse test the Gateway

- [ ] Send 4+ messages within 10 seconds from the same `user_id` and confirm the 4th gets rate-limited
      (check `rate_limited: true` in the execution data, or add a temporary reply-back of the rate-limit
      reason so you can see it without digging through logs)
- [ ] Send a message containing `<script>alert(1)</script>` and confirm it's stripped before reaching the
      Brain (check the sanitized `prompt` in the Gateway's execution output)
- [ ] Send one of your test "blocked words" (edit the placeholder list in `01_Gateway.json`'s
      `Content_Filter_Profanity` node to something you can safely trigger) and confirm it's censored

## 5. Sign-off checklist before a real client touches it

- [ ] All of section 1–4 pass
- [ ] Every placeholder ID replaced (re-run the grep from step 0 — it should return nothing)
- [ ] Admin alert email/Telegram chat ID actually goes to a channel you monitor, not a burner
- [ ] You've personally read `business/service-agreement-template.md`'s liability section with a lawyer
      if this is going in front of a paying client
- [ ] You've decided your real `blockedWords` list (the placeholder ones are literally `badword1/2/3`)
- [ ] You've set real rate limits appropriate for expected volume (defaults: 3 per 10s, 60 per hour)

If something fails at any step, fix that one workflow and re-run **only that section** — you don't need to
re-test everything above it once it's already passed.
