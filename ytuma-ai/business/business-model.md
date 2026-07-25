# YTUMA AI — Business Model

## What you're selling

Not "an AI chatbot." A **business operating system**: one AI agent (the "Brain") that a client's team talks
to over Telegram, phone, or email, backed by tools that actually do things — books calendar events, drafts
and sends emails with human approval, logs every interaction to a CRM, and answers questions from the
client's own documents. It's infrastructure, not a script.

The n8n workflow pack in `../n8n-workflows/` is the product. Everything else in this folder is how you
package, price, and sell it.

## Target market

Solo operators and small teams doing high-touch, repetitive relationship work where a missed follow-up
costs real money: real estate agents/brokers, contractors who bid jobs, small agencies, independent
consultants. Anyone who currently plays "answer the phone, draft the same email, update a spreadsheet"
several times a day.

## Revenue model

**Two revenue lines, not one:**

1. **Build fee (one-time)** — scoping, wiring credentials, ingesting the client's documents/templates,
   testing, and handoff. This is where most of your hours go.
2. **Monthly retainer (recurring)** — hosting/monitoring, model + API costs, ongoing tuning, and support.
   This is the line that turns "a project" into "a business." See `pricing-packages.md` for tier detail.

Do not sell the build fee alone. A client who owns a static automation with no support contract will
churn the moment something breaks (an OAuth token expires, an API changes) and has no one to call — that
becomes a bad review, not a renewal.

## Unit economics (illustrative — replace with your real costs)

Per active client, monthly, at the "Standard" tier:

- OpenAI + Pinecone + Twilio usage: roughly $30–$120/mo depending on call/message volume
- Your time: 1–3 hours/month once stable (monitoring alerts, occasional tuning)
- Retainer charged: $150–$500/mo (see pricing)

At 10 clients on a $2,500–$5,500 build + $300 average retainer, that's $3,000/mo recurring before you've
sold a single new build that month — the retainer line is what makes this scale sublinearly with your time,
not the build fee.

## What actually makes this defensible

Most people selling "AI automation" are selling effort — a Zapier chain with no error handling, no retry
logic, no observability. The differentiator here, and the thing worth emphasizing in every pitch, is
workflows 98 and 99: retries that back off intelligently and an error handler that dedupes and escalates
instead of spamming. That's the difference between a demo and something a client can trust with real client
communication. Lead with that in sales conversations, not with "it uses GPT-4o."

## Positioning language (use, don't over-rely on)

"We build AI-operated business infrastructure that answers calls, drafts and sends emails, tracks every
client interaction, and tells you the moment something breaks — instead of failing silently at 2am."

## Honest risks to disclose to yourself before scaling

- **Single point of failure**: one n8n instance running everything for every client is a real operational
  risk. Plan for per-client isolation (see the multi-client note in the n8n README) before client #4 or #5.
- **Model/API cost drift**: OpenAI and Twilio pricing changes affect your margin directly. Build a cost
  review into your quarterly retainer check-in, not just at signing.
- **Liability**: an AI phone agent or auto-sent email that says the wrong thing to a client's client is a
  real legal exposure. The service agreement template addresses this, but read it with a lawyer before using
  it commercially, not just before adapting the wording.
