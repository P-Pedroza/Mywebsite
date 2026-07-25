> **Not legal advice.** This is a cleaned-up starting draft consolidated from the source material —
> placeholders bracketed, tone made professional, ambiguous liability language flagged. Have an actual
> lawyer in your state review this before you use it with a paying client. Contract terms around liability,
> data handling, and termination carry real legal weight and a template found on the internet (or written by
> an AI) is not a substitute for that review.

# SERVICE AGREEMENT

This Service Agreement ("Agreement") is made between:

**Service Provider:** [Your Business Name], [Your Name], [Phone], [Email]

**Client:** [Client Name], [Business Name], [Email], [Phone]

**Effective Date:** [Date]

## 1. Purpose

Client is engaging Service Provider to design, build, and deploy a customized AI assistant and automation
system to support Client's business operations (e.g., proposal/bid generation, email handling, scheduling,
client communication logging), as scoped in the attached intake form and quote.

## 2. Scope of Work

### 2.1 AI System Development
- Build a custom AI assistant configured on Client's data, tone, and preferences
- Configure short-term and long-term memory (client preferences, active jobs, communication history)
- Automate the core workflow identified during intake (bidding, follow-up, etc.)
- Generate documents/proposals/estimates as scoped
- Implement basic safety and accuracy controls (input validation, rate limiting, content filtering)

### 2.2 Email Automation (if scoped)
- Connect Client's email account via delegated access or API
- AI-assisted inbox scanning, categorization, and reply drafting
- Auto-send only if explicitly enabled by Client in writing; default is human-approval-required

### 2.3 Messaging Interface
- Telegram (or agreed alternative) conversational assistant
- Custom commands as scoped in intake

### 2.4 Phone Agent (Pro tier only, if scoped)
- Inbound and/or outbound calling via Twilio
- Call scripts generated per-call by the AI, reviewed during testing phase

### 2.5 System Integration
- Connect Client's files, drive, templates, and relevant data sources
- Build the automation pipeline connecting the above

### 2.6 Testing + Handoff
- Test all scoped features with Client before go-live
- Provide a walkthrough/tutorial and written documentation of what was built

## 3. Client Responsibilities

Client agrees to provide, in a timely manner:
- Access to relevant accounts (email, calendar, CRM) via secure, revocable methods (OAuth/delegated access
  — **not** shared passwords)
- Sample documents, templates, and pricing information needed to train the assistant
- Clear feedback and approvals at each phase

Delays in providing required materials extend the timeline proportionally.

## 4. Timeline

Estimated for a Standard-tier build:
- Phase 1 — Intake & workflow blueprint: 1–2 days
- Phase 2 — Core AI + channel integration: 3–5 days
- Phase 3 — Automation buildout: 5–7 days
- Phase 4 — Testing & handoff: 2–4 days

Total estimate: 10–18 days from receipt of all required materials. Pro-tier builds (phone agent, full
observability stack) typically add 1–2 weeks.

## 5. Fees & Payment

- **Project Fee:** $[amount] USD, per the agreed package (see `pricing-packages.md`)
- **Payment structure:** 50% due to begin work, 50% due on delivery
- **Monthly support (optional, recommended):** $[amount]/month — includes monitoring, minor fixes, and
  ongoing tuning; does not include net-new feature development
- Payments for work already performed are non-refundable

## 6. Revisions

- Client receives revisions during the active build phase at no extra charge
- Revisions requested after handoff, or outside the originally scoped features, are billed separately at
  Service Provider's standard hourly rate — quoted before work begins

## 7. Confidentiality & Data Handling

- Both parties agree Client's data, documents, and business information remain confidential
- Service Provider will not sell or disclose Client data to third parties
- Client data is processed through third-party AI/infrastructure providers (OpenAI, Twilio, Google, Pinecone,
  etc.) under those providers' own data-processing terms; Client should be informed which providers will
  process their data, and any industry-specific compliance requirements (e.g., real estate licensing rules,
  HIPAA if relevant) must be disclosed by Client before build begins
- API keys and credentials are stored using [Service Provider's credential-storage method]; Client is
  responsible for revoking access if the relationship ends

## 8. Ownership & Rights

- On full payment, Client owns the specific workflows and automations built for them
- Service Provider retains rights to its general methods, reusable components, and underlying architecture,
  which allows Service Provider to support Client and to build for other clients
- Third-party AI models and infrastructure remain licensed by their respective providers, not owned by
  either party

## 9. Warranty & Support

- [X] days of complimentary bug-fix support after delivery (recommend 7–14 days)
- Paid monthly support available for ongoing improvements (see Section 5)

## 10. Termination

Either party may terminate with [X] days' written notice. Work completed up to the termination date is
billable. On termination, Service Provider will revoke its own access to Client accounts and provide Client
with exported copies of workflows/automations Client owns per Section 8.

## 11. Limitation of Liability

Service Provider is not liable for indirect, incidental, or consequential damages arising from use of the
system, including but not limited to: losses from Client's own data errors, third-party service outages
(OpenAI, Twilio, Google, etc.), or Client's failure to review AI-generated content before it reaches an
end customer (e.g., an auto-sent email or a phone script). **This limitation should be reviewed by counsel**
— liability caps and carve-outs (e.g., for gross negligence) vary significantly by jurisdiction and are not
something to finalize from a template.

## 12. Signatures

Service Provider: ______________________ Date: __________

Client: ______________________ Date: __________
