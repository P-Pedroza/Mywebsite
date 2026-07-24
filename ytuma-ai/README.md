# YTUMA AI

A complete package for building and selling the YTUMA AI business-automation system: the actual n8n
workflows, the business model and pricing to sell it, contract/intake templates, an Instagram marketing
plan, and a plain-English explainer of how the whole thing works.

Built from the internal architecture docs and cleaned up/generalized so nothing here contains real client
data (names, phone numbers, addresses) — everything is templated for reuse across clients.

## Folder guide

- **`n8n-workflows/`** — the 14 importable n8n workflow JSON files (Gateway, Brain, Calendar, Telegram,
  Knowledge Ingestion, Journal, CRM, Phone in/out, Email draft/approve/send, Retry Engine, Error Handler).
  Start with `n8n-workflows/README.md` for import order and required credentials.
- **`business/`** — business model, pricing tiers, a cleaned-up client intake form, a service agreement
  template (⚠️ needs a lawyer's review before use), and a sales call script.
- **`marketing/`** — Instagram strategy, a 30-day content calendar template, and reusable caption/hook
  templates.
- **`docs/how-it-works.md`** — the architecture explained end-to-end in plain language, with a diagram,
  suitable for walking a prospect through the system.

## Reality check on scope

This was built from documentation, not a live n8n instance — there's no n8n connector or API credentials
available in this session. The workflow JSON files are structurally correct and importable, but you still
need to:

1. Import them into your own n8n instance (see `n8n-workflows/README.md` for order)
2. Create the credentials listed there (OpenAI, Pinecone, Google Drive/Docs/Sheets/Calendar, Gmail,
   Telegram, Twilio)
3. Replace every placeholder ID (Drive file IDs, Sheet IDs, phone numbers, admin contacts)
4. Test each workflow individually before connecting them end-to-end

Nobody else can do steps 2–4 for you sight-unseen — they require your actual accounts and secrets, which
is exactly why they were left as placeholders rather than guessed at.
