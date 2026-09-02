# SlamAI AIOS — Where To Edit

A map of this codebase: "I want to change X → go to this file."

---

## Quick reference

| I want to change… | Go to |
|---|---|
| Prices (site AND checkout AND settings) | `src/lib/plans.ts` → the `PLANS` array — **one place, everywhere** |
| Module names/descriptions on the public site | `src/app/page.tsx` → `modules` array |
| The four "what happens when someone rings" steps | `src/app/page.tsx` → `howItWorks` array |
| The example call transcript on the site | `src/app/page.tsx` → SAMPLE CALL section |
| Your demo number, contact email, booking link | `src/lib/site.ts` (set via `NEXT_PUBLIC_*` env vars) |
| Headline / hero copy | `src/app/page.tsx` → HERO section |
| Footer | `src/app/page.tsx` → FOOTER section |
| Browser tab title, SEO description | `src/app/layout.tsx` → `metadata` |
| Brand colours (purple, dark background) | `tailwind.config.ts` → `colors.brand` / `colors.slam` |
| Fonts | `tailwind.config.ts` → `fontFamily` |
| Buttons / glass / gradient styles | `src/app/globals.css` |
| Left sidebar menu items | `src/components/dashboard/Sidebar.tsx` → `nav` array |
| Top bar (search, notifications, avatar) | `src/components/dashboard/Header.tsx` |
| Loading / error / empty screens | `src/components/dashboard/States.tsx` |
| Login page | `src/app/(auth)/login/page.tsx` |
| Sign-up page | `src/app/(auth)/register/page.tsx` |
| Minimum password length | `src/lib/utils.ts` → `MIN_PASSWORD_LENGTH` |
| Who can log in | `src/lib/auth.ts` |
| Database tables and fields | `prisma/schema.prisma` |
| Demo data and the admin account | `prisma/seed.ts` (reads env vars — no passwords in code) |
| The AI's personality when chatting | `src/app/api/agents/chat/route.ts` → the `system` message |
| The AI's marketing writing instructions | `src/app/api/marketing/generate/route.ts` → `prompts` |
| The AI's document-analysis instructions | `src/app/api/documents/analyze/route.ts` → `modePrompts` |
| Which OpenAI model is used | Those three files — search for `gpt-4o` |
| Which apps appear in Automation | `src/lib/integrations.ts` → `PROVIDERS` |
| What the phone agent says first | Voice AI page → Greeting (stored per account) |
| How the phone agent behaves | Voice AI page → Instructions, or `prisma/schema.prisma` for the default |
| The phone conversation loop | `src/app/api/voice/twilio/respond/route.ts` |
| Turning a call into a CRM lead | `src/app/api/voice/twilio/status/route.ts` |
| Which voices are offered | `src/lib/voices.ts` |
| The new-customer setup checklist steps | `src/app/api/onboarding/route.ts` → the `steps` array |
| How the checklist looks | `src/components/dashboard/SetupChecklist.tsx` |
| Stripe checkout / portal behaviour | `src/app/api/stripe/checkout/route.ts`, `portal/route.ts` |
| What happens when someone pays | `src/app/api/stripe/webhook/route.ts` |
| Port the app runs on | `package.json` → `dev` / `start` scripts (3005) |

---

## The layout of the project

```
src/
  app/
    page.tsx              ← THE PUBLIC WEBSITE
    layout.tsx            ← site-wide title/SEO/notifications
    globals.css           ← shared styles

    (auth)/               ← pages for logged-OUT people
      login/ register/

    (dashboard)/          ← pages for logged-IN people
      layout.tsx          ← the "you must be signed in" gate
      dashboard/          ← overview
      agents/ crm/ automation/ marketing/ voice-ai/
      documents/ analytics/ projects/ marketplace/ website/
      settings/           ← profile, password, billing

    api/                  ← THE BACK END
      auth/               register · [...nextauth]
      agents/             list · create · [id] · chat
      crm/                contacts · contacts/[id] · deals
      projects/           list · create · [id]
      tasks/              list · create · [id]
      documents/          list · create · [id] · analyze
      campaigns/          list · create · [id]
      workflows/          list · create · [id]
      integrations/       list · connect
      voice/              agent config · calls
      voice/twilio/       incoming · respond · status (Twilio webhooks)
      websites/           list · create · [id]
      marketplace/        catalogue · install
      analytics/          real aggregates
      dashboard/stats     overview numbers, chart, activity
      settings/           profile · password
      stripe/             checkout · portal · webhook

  components/dashboard/   Sidebar · Header · States
  lib/
    auth.ts               login rules
    db.ts                 database connection
    api.ts                requireUser() + shared route helpers
    useApi.ts             useResource() hook + mutate()
    plans.ts              ← PRICING LIVES HERE
    plan-pricing.ts       server-only Stripe price lookups
    stripe.ts  openai.ts  lazy API clients
    twilio.ts             webhook signature verification
    twiml.ts              TwiML builders (pure, testable)
    voices.ts             the voice options
    integrations.ts       the provider list
    utils.ts              formatting helpers

prisma/
  schema.prisma           the shape of the database
  seed.ts                 admin account + marketplace catalogue
```

**The naming rule:** a folder in `src/app/` becomes a web address. `src/app/(dashboard)/crm/page.tsx` is the page at `/crm`. Folders in `(brackets)` are grouping only — they do **not** appear in the URL.

---

## Common jobs, step by step

### Change a price
Open `src/lib/plans.ts`, edit `price:` in the `PLANS` array. That updates the landing page, the settings page, and what Stripe charges — all three read from it. If the plan is new, add its Stripe price ID env var too.

### Add a new dashboard page
1. Create `src/app/(dashboard)/yourpage/page.tsx`
2. Add an entry to `nav` in `src/components/dashboard/Sidebar.tsx`
3. Icons come from lucide.dev — add yours to the import list

### Add a page that loads data
```tsx
const { data, loading, error, refresh } = useResource<Thing[]>("/api/things");
```
Then render `<LoadingState/>`, `<ErrorState/>` or `<EmptyState/>` from `components/dashboard/States`. Every dashboard page follows this pattern.

### Add a new API route
Copy an existing one. Every route starts with:
```ts
const gate = await requireUser();
if (!gate.ok) return gate.response;
```
and scopes every query by `gate.userId` so one account can never read another's data.

### Add a field to the database
1. Add it in `prisma/schema.prisma`
2. Run `npm run db:push`
3. Use it in the API route and the page

---

## Current state

**Working end to end:** sign-up, sign-in, password change, profile editing, AI agents and chat, CRM contacts and deals, projects and tasks, marketing generation with saved campaigns, document analysis with saved results, automation workflows, integration toggles, website records, marketplace install/uninstall, analytics, Stripe checkout + customer portal + webhook, and the **Twilio phone agent** — it answers calls, holds a conversation, transfers to a human, and files the caller as a CRM lead. New customers get a setup checklist on the dashboard that walks them from sign-up to a live answered phone.

Every dashboard page reads and writes real records scoped to the signed-in user. There is no hardcoded sample data left in the UI.

**Needs configuration before it works in production:**

| Feature | What's needed |
|---|---|
| Billing | Stripe keys + a price ID per plan, and a webhook endpoint pointed at `/api/stripe/webhook` |
| AI features | `OPENAI_API_KEY` |
| Voice AI | Twilio credentials and two webhook URLs — see below. |
| Integrations | Each provider's OAuth credentials. Toggling one records your choice; no data syncs yet. |
| Website builder | Records and tracks sites. It does not yet generate or host the site itself. |

### Where this deploys

The Vercel project is **slamai-aios**, connected to `lindanislam-jpg/slamai-aios`,
building from `main`. Every push to `main` deploys automatically; there is no
manual step. It serves `slamai-aios.vercel.app`.

Note this is a *different* Vercel project from the one serving slamai.ie. When
you point the domain here, also change `NEXTAUTH_URL` to `https://slamai.ie`,
or sign-in redirects and Stripe returns will send people to the wrong address.

Redeploying an old deployment from the Vercel dashboard rebuilds *that commit*,
not the latest code — push to `main` instead.

### Connecting the phone agent

1. Buy a number in Twilio.
2. On that number's config page, set both webhooks to **HTTP POST**:
   - *A call comes in* → `https://slamai.ie/api/voice/twilio/incoming`
   - *Call status changes* → `https://slamai.ie/api/voice/twilio/status`
3. Put `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` in your environment.
4. In the app: Voice AI → paste the number, set the greeting and instructions, hit **Activate**.

What happens on a call: the agent greets the caller, listens, replies through GPT-4o, and loops. It can transfer to a human if you set a transfer number. When the call ends, the transcript is summarised and — if the caller gave a name or email — a CRM contact is created or updated automatically, tagged `voice-ai`.

Every webhook verifies Twilio's signature, so a forged request is rejected.

**Known gap:** `npm run lint` prompts to configure ESLint because the project has no ESLint config file. `npm run build` type-checks everything, so this doesn't block you.

---

## Environment variables

Copy `.env.example` to `.env.local` and fill it in. On Vercel, set the same values in the project's Environment Variables.

| Variable | What it's for |
|---|---|
| `DATABASE_URL` / `DIRECT_URL` | Postgres |
| `NEXTAUTH_SECRET` | Signs login sessions (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Public site URL — used for Stripe redirects |
| `OPENAI_API_KEY` | Every AI feature |
| `STRIPE_SECRET_KEY` | Billing |
| `STRIPE_WEBHOOK_SECRET` | Verifies webhooks are really from Stripe |
| `STRIPE_PRICE_*` | One price ID per paid plan |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | The phone agent; the token verifies every webhook |
| `TWILIO_WEBHOOK_BASE_URL` | Only if the public URL differs from `NEXTAUTH_URL` (e.g. an ngrok tunnel) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seed script only — never read at runtime |

Missing keys degrade gracefully: AI and billing routes return a clear 503 rather than crashing.

---

## Commands

```bash
npm run dev        # run locally at http://localhost:3005
npm run build      # production build — run before pushing, it type-checks everything
npm run db:push    # apply schema.prisma changes to the database
npm run db:studio  # browse the database visually
npm run db:seed    # create the admin account (needs ADMIN_EMAIL + ADMIN_PASSWORD)
npm run check:defaults  # guards the setup checklist against schema drift
```
