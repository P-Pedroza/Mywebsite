# Workflow tests

A minimal n8n-workflow interpreter (`n8n_sim.js`) that executes the **real committed JSON** — the actual
`jsCode`, `assignments`, conditions, and expressions, not a re-implementation of intent — against mocked
Google Sheets/Gmail/Telegram, so the email approve→send→retry→escalate chain can be verified without a
live n8n instance or real credentials.

Run it:

```
node test_email_approval.js
```

(defaults to testing the workflows in the parent directory; pass a path to test a different copy).

It covers:
- **Scenario A**: approving a draft actually sends the email, updates the sheet, and confirms via Telegram.
- **Scenario B**: a fully-dead Gmail credential retries through `98_Retry_Engine`, escalates to
  `99_Error_Handler` without hanging, and reaches the admin via the independent Telegram alert channel
  even though the Gmail alert channel is down too.

## Bugs this caught (already fixed in the committed workflows)

1. **Approving a draft never triggered sending.** `11_Email_Approval_Handler` updated the sheet and said
   "queued to send" but nothing ever called `12_Email_Sender`.
2. **Two Telegram confirmations referenced a field a Sheets node had already dropped**, so `edit`/`cancel`
   confirmations would have sent to `chat_id: undefined`.
3. **Infinite retry loop.** `12_Email_Sender`'s `Build Retry Payload` re-read `attempt` from a stale
   snapshot instead of the current item, so `98_Retry_Engine` never saw the count go above 1 and retried
   forever instead of escalating after 3 attempts.
4. **`98_Retry_Engine` never forwarded `client_id`** to `99_Error_Handler`, so every escalated error logged
   as `unknown_client` regardless of which client it actually belonged to.
5. **`99_Error_Handler`'s own alert step read a field a Sheets node had already overwritten** —
   `Should Notify` checked `$json.shouldNotify`, but by that point `$json` was the just-written
   `Alert_Dedupe` row, which never had that field. Admin alerts silently never fired, in any workflow,
   ever — the exact thing the whole "fails loudly, not silently" pitch depends on.
6. **Single point of failure in alerting.** `Notify - Admin` shared a Gmail credential with the very
   channel it was meant to monitor — a dead Gmail token would kill both the client-send and the alert
   about it. Added an independent Telegram alert path in `99_Error_Handler` so alerting survives a Gmail
   outage.

None of these were caught by JSON-validity or node-reference checks — they're semantic bugs in what the
data actually does at runtime, which is exactly what this harness exists to catch without a live n8n
instance.
