# Instagram Marketing Strategy — YTUMA AI

Goal: turn Instagram into a lead-gen channel that funnels into a booked discovery call (see
`../business/sales-call-script.md`), not a channel that just accumulates likes.

## Funnel

```
IG post/reel (demonstrates a real capability)
    → Profile visit
    → DM ("How does this work for my business?") or link in bio
    → Booked discovery call
    → Sales call script → proposal → signed agreement
```

Every single post should point somewhere. If a post doesn't move someone toward a DM or a booked call,
it's not doing its job — it's fine as occasional trust-building content, but it shouldn't be the majority
of the calendar.

## Content pillars (rotate through all four every week)

1. **Proof / demo (40%)** — screen recordings of the actual assistant doing something: booking a meeting
   from a voice note, drafting and sending an approved email, answering a phone call. This is your strongest
   content because it's not a claim, it's a recording.
2. **Problem/agitation (25%)** — short posts naming the specific pain (missed follow-ups, double-booked
   showings, drafting the same email for the 50th time) before showing the fix.
3. **Behind-the-build (20%)** — "here's what's actually happening when you send that voice note" — light
   technical credibility without jargon overload. Builds trust that this isn't smoke and mirrors.
4. **Social proof / results (15%)** — time saved, response-time improvements, before/after — using
   **anonymized or aggregate** numbers only. Never post a real client's name, phone number, or specifics
   without their written permission, and never post the raw CRM/observability data itself.

## Posting cadence

- 3–4 feed posts/reels per week
- 1 story sequence per weekday (even just a screenshot + caption) — stories are where DMs get warmed up
- 1 longer-form post every 2 weeks (carousel or reel) walking through "how it actually works end to end"

## Reels > static posts

Given the product is inherently visual (a voice note turning into a booked calendar event, a phone call
being answered by AI), prioritize reels/video over static graphics. Use the camera + style prompt framework
already in your prompt library for any B-roll or illustrative shots you need to generate:

`(Camera move) + (Object) + (Action) + (Background) + (Style)`

## Hook discipline

Every post's first line (or first 2 seconds of a reel) must do one job: stop the scroll. Use the hook
framework in `caption-hook-templates.md` — pick one hook type per post, don't stack three.

## What NOT to post

- Real client names, phone numbers, addresses, or screenshots of their actual CRM rows — even blurred
  screenshots of real data are a liability if anything is legible
- Screenshots of actual n8n workflows containing real API keys, webhook secrets, or credential names
  visible in node config panels
- Claims you can't back up ("replaces a full-time employee") — say what it actually does instead
- Anything that reads as impersonating or ghostwriting on someone else's business page without disclosure

## Bio / link-in-bio

- Bio line: one sentence naming who this is for + what it does (e.g., "AI ops for real estate agents & solo
  contractors — book, follow up, and answer calls automatically.")
- Link-in-bio: a single link to a booking page (Calendly-style) for the discovery call, not a generic
  website homepage
