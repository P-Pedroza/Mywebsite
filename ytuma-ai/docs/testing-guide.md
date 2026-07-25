# Testing Guide — Is It Actually Ready?

A step-by-step order to test the system before you trust it with a real client. Test bottom-up: prove the
small pieces work in isolation before you test the whole chain, so a failure points you at one workflow
instead of "somewhere in 14 files."

Use a **test Telegram bot, a test Twilio number, and your own email/calendar** for all of this — never
your first real client's accounts. Get a second Telegram bot token from @BotFather for testing; it costs
nothing and keeps debug traffic out of production data.

## 0. Before you test anything

- [ ] Import all 16 workflows in the order listed in `n8n-workflows/README.md` — **`00_Client_Registry`
      first**, everything else calls it
- [ ] Re-select the target workflow inside every `Execute Workflow` node (n8n won't resolve the link from
      the raw JSON alone — do this once per link, per workflow); for the ones with a *dynamic* workflow ID
      (`Send Approved Email` in 11, which reads `email_sender_workflow_id` from the registry) there's
      nothing to re-select, just make sure that registry column's value matches a real workflow name
- [ ] Create every credential listed in that README
- [ ] Create the `YTUMA_Client_Registry` sheet (schema in the n8n README) and add **one test client row** —
      every workflow below needs a valid `client_id` to run against
- [ ] Replace `YTUMA_CLIENT_REGISTRY_SHEET_ID` in `00_Client_Registry.json`, and `ADMIN_EMAIL` +
      `AGENCY_ADMIN_TELEGRAM_CHAT_ID` in `99_Error_Handler.json` — these stay hardcoded on purpose, and the
      Telegram one specifically should NOT be the same bot as any client's `04_Telegram` copy (see the n8n
      README for why there are two independent alert channels)
- [ ] Create the actual Google Sheets/Docs your test client's registry row points to, with the exact tab
      names the workflows expect: `Contacts` + `Interactions` (CRM sheet), `Sheet1` (email approvals),
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

Every tool below now requires `client_id` — use whatever slug you put in your test row in
`YTUMA_Client_Registry`. If you get "no active client found," that's `00_Client_Registry` doing its job:
check the row exists and the `client_id` matches exactly (case-sensitive).

**`00_Client_Registry`** — test this one first, standalone: trigger it with just `{ "client_id": "your-test-client" }`
and confirm it returns `found: true` with every column from your test row. Then try a `client_id` that
doesn't exist and confirm it throws the "no active client found" error rather than silently returning
empty/wrong data — that error is what protects you from one client's request accidentally touching another
client's calendar or CRM.

**`03_Tool_Calendar`** — feed it:
```json
{ "client_id": "your-test-client", "action": "check_availability", "start_time": "2026-08-01T14:00:00-05:00", "end_time": "2026-08-01T15:00:00-05:00" }
```
Pass: returns `{ "success": true, "availability": ... }` without error. Then try `add_event` with a
`summary` and confirm the event actually appears on **your test client's** Google Calendar (the one in the
registry row), not some other calendar.

**`07_CRM_Sheets`** — the built-in `Test - Sample Event` node ships with a placeholder
`client_id: "YOUR_TEST_CLIENT_ID"` — edit that to your real test client_id, then right-click → Execute
Node. Confirm a row appears in both the `Contacts` tab (upserted) and `Interactions` tab (appended) of
**that client's** CRM sheet.

**`06_Tool_Journal`** — manually trigger with `{ "note_to_add": "Test note - ignore", "user_id": "test", "client_id": "your-test-client" }`.
Confirm it appears in your test client's journal Google Doc AND as a new vector in the `ytuma-memory-v3`
Pinecone index, under the namespace matching that client's `pinecone_namespace` (check the Pinecone
console's namespace breakdown). Then trigger again with an **empty** `note_to_add` and confirm it logs to
that client's rejections doc instead of writing garbage to memory.

**`99_Error_Handler`** — use `Start - Manual Test Trigger` with:
```json
{ "workflow_name": "test", "node_name": "test_node", "severity": "high", "message": "Test error", "error_type": "TEST", "trace_id": "test-001", "client_id": "your-test-client" }
```
Pass: a row appears in `Error_Log` with `client_id` populated, a row appears in `Alert_Dedupe`, and you get
**both** an email alert (subject includes `[your-test-client]`) **and** a Telegram alert on your agency ops
bot (severity high should always notify on first occurrence). Run it 3 times in under 10 minutes with the
same payload and confirm you get exactly one of each (cooldown working), not three. Then run it once more
with a **different** `client_id` and confirm it's treated as a brand-new incident (separate dedupe row,
separate alerts) rather than being folded into the first client's count. Finally, confirm the two alert
channels really are independent: temporarily point the Gmail credential at something invalid (or just
watch what happens during the forced-failure email test below) and confirm the Telegram alert still comes
through even when the email one can't — that's the whole reason there are two channels instead of one.

**`98_Retry_Engine`** — trigger with `{ "workflow_name": "test", "severity": "low", "attempt": 0 }` a few
times in a row, incrementing nothing yourself — confirm `attempt` increments each call and that after 3
calls (default `max_attempts`) it returns `action: "stop"` instead of retrying forever. Then chain it
through `12_Email_Sender` directly (see the forced-failure test below) rather than only testing 98 in
isolation — the counter has to survive being passed back and forth through 12's own retry loop, not just
increment when 98 is called with a hand-fed `attempt` value.

## 3. Test each channel end-to-end (through the Gateway this time)

Now that the Brain and tools are proven, test the real entry points — this exercises `01_Gateway` too.

**Telegram (production `04_Telegram`):**
- [ ] Before testing: confirm you set `client_id` to your real test client's slug (not the
      `YOUR_CLIENT_ID_HERE` placeholder) in both `Format - Text` and `Format - Voice`, and that the
      credential points at your **test** bot token, not a real client's bot
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
- [ ] **Force a failure**: temporarily break the Gmail credential (revoke/expire it), approve a draft, and
      confirm it retries a bounded number of times (3 by default — watch the execution timestamps; it
      should escalate within a few minutes, not hang) and then escalates to `99_Error_Handler`. Confirm:
      the approvals row still shows `status: approved` (the human decision stands, independent of send
      outcome), the Telegram confirmation says "approved, but sending failed/is retrying" instead of falsely
      claiming success, and — since Gmail is what's broken — the **Telegram** admin alert from `99` is what
      actually reaches you, not the email one. This whole chain (approve → send → retry → escalate → two
      independent alert channels) is the single most important test in this guide since it's your core
      sales differentiator: an assistant that fails loudly instead of silently.

**Phone (`08` outbound, `09b` inbound) — only if you're on the Pro tier build:**
- [ ] Outbound: POST to the `08` webhook with a test `to_phone` (your own number) and confirm you receive
      a call **from your test client's own registered Twilio number** (check caller ID), with a sensible
      script, and that it logs to that client's CRM
- [ ] Inbound: call your Twilio test number, speak a request, confirm you get a spoken reply and a row in
      the CRM `Interactions` tab
- [ ] **Wrong-number test**: call a Twilio number that either doesn't exist in the registry yet, or
      temporarily rename the `twilio_number` value in your test client's row, then call the real number —
      confirm you get a polite message and a hangup instead of dead air or a dropped call, and confirm an
      `Error_Log` row shows up so you'd actually notice a client's number got disconnected or reassigned.
      Repeat by staying on the line past the greeting (so you hit the gather step) if you can reproduce the
      mismatch mid-call — both entry points need this to degrade gracefully independently.

## 4. Load/abuse test the Gateway

- [ ] POST to the Gateway webhook **without** `client_id` and confirm it's rejected with the "Missing
      client_id" error rather than silently defaulting to some client
- [ ] Send 4+ messages within 10 seconds from the same `user_id` + `client_id` and confirm the 4th gets
      rate-limited (check `rate_limited: true` in the execution data, or add a temporary reply-back of the
      rate-limit reason so you can see it without digging through logs)
- [ ] Send a message containing `<script>alert(1)</script>` and confirm it's stripped before reaching the
      Brain (check the sanitized `prompt` in the Gateway's execution output)
- [ ] Send one of your test "blocked words" (edit the placeholder list in `01_Gateway.json`'s
      `Content_Filter_Profanity` node to something you can safely trigger) and confirm it's censored

## 4b. The tenant-isolation test (do this if you're onboarding a second client)

Add a **second** test row to `YTUMA_Client_Registry` (a different `client_id`, its own test Calendar/Sheet/
Doc/Pinecone namespace). Then:
- [ ] Ask client A's assistant something that would only be answerable from client B's knowledge base or
      calendar, and confirm it can't see it (no leakage across the `pinecone_namespace` boundary)
- [ ] Trigger the same simulated error for both clients back-to-back and confirm they produce **two**
      separate dedupe rows/alerts in `99_Error_Handler`, not one merged count
- [ ] Book a calendar event for client A and confirm it lands on client A's calendar (from the registry),
      not client B's — this is the one that actually matters if you ever fat-finger a registry row

## 5. Sign-off checklist before a real client touches it

- [ ] All of section 1–4 pass
- [ ] That client has a complete row in `YTUMA_Client_Registry` — every column filled, no leftover
      placeholder text
- [ ] Admin alert email/Telegram chat ID actually goes to a channel you monitor, not a burner
- [ ] You've personally read `business/service-agreement-template.md`'s liability section with a lawyer
      if this is going in front of a paying client
- [ ] You've decided your real `blockedWords` list (the placeholder ones are literally `badword1/2/3`)
- [ ] You've set real rate limits appropriate for expected volume (defaults: 3 per 10s, 60 per hour)

If something fails at any step, fix that one workflow and re-run **only that section** — you don't need to
re-test everything above it once it's already passed.
