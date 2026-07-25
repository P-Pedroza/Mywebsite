# Pricing & Packages

Two components per client: a one-time **build fee** and a recurring **monthly retainer**. Quote both,
always — see `business-model.md` for why.

## Build fee tiers

### Starter — $1,200–$2,500
- Email drafting assistant (draft-only, human sends)
- Basic Telegram bot with simple commands
- Standard short-term memory (recent messages + custom instructions)
- Best for: solo operators who just want inbox relief

### Standard — $2,500–$5,500 (most clients land here)
- Full bidding/proposal or follow-up automation (inputs → generated document → summary → email)
- Full email assistant: read inbox, summarize, draft replies, categorize, human-approval flow
- AI memory of past conversations, preferences, active clients/jobs
- Telegram assistant with commands, file retrieval, document generation
- Calendar integration (book, check availability, reschedule via voice or text)
- CRM logging (contacts + interaction history)

### Pro — $6,000+
- Everything in Standard, plus:
- Inbound + outbound phone agent (Twilio voice, bilingual)
- Full observability stack (retry engine + error handler + escalation alerts)
- Custom dashboards, multi-user access, industry-specific logic
- Knowledge-base ingestion (client's own documents become searchable AI context)

## Monthly retainer tiers

| Tier | Monthly | Includes |
|---|---|---|
| Starter Ops | $500–$1,000 | Email + basic automations, uptime monitoring, minor fixes |
| Professional AI Ops | $2,000–$4,000 | Phone, CRM, knowledge base, observability, priority response |
| Enterprise AI Operator | $6,000–$10,000+ | Custom workflows, dashboards, SLAs, priority support, quarterly strategy review |

Match the retainer tier to the build tier — don't sell a Pro build with a Starter Ops retainer; the
API/hosting costs alone won't be covered.

## Payment terms

- 50% deposit to begin build
- 50% on delivery/handoff
- Retainer billed monthly starting at go-live, auto-renewing until cancelled with notice (set your own
  notice period — 30 days is standard)
- Revisions: major revisions included during the build phase; anything requested after handoff and outside
  the retainer's included hours is billed separately at your hourly rate

## What NOT to underprice

Phone agents (inbound/outbound) and observability/error-handling infrastructure are the two things that
took the most engineering effort in this system and are the hardest for a client to replicate with
off-the-shelf tools (Zapier, Make). Don't discount these into the Starter tier just to close a deal — they
belong in Standard/Pro pricing.
