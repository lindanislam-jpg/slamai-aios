# SlamAI AIOS — Where To Edit

A map of this codebase: "I want to change X → go to this file."

---

## Quick reference

| I want to change… | Go to |
|---|---|
| Prices on the public site | `src/app/page.tsx` → `plans` array (line ~29) |
| Module names/descriptions on the public site | `src/app/page.tsx` → `modules` array (line ~10) |
| Headline / hero copy | `src/app/page.tsx` → HERO section (line ~76) |
| Stats ("10,000+ agents deployed") | `src/app/page.tsx` → `stats` array (line ~52) |
| Footer | `src/app/page.tsx` → FOOTER section (bottom of file) |
| Browser tab title, SEO description | `src/app/layout.tsx` → `metadata` |
| Brand colours (purple, dark background) | `tailwind.config.ts` → `colors.brand` and `colors.slam` |
| Fonts | `tailwind.config.ts` → `fontFamily` |
| Buttons / glass / gradient styles | `src/app/globals.css` |
| Left sidebar menu items | `src/components/dashboard/Sidebar.tsx` → `nav` array (line ~14) |
| Top bar (search, notifications, avatar) | `src/components/dashboard/Header.tsx` |
| Login page | `src/app/(auth)/login/page.tsx` |
| Sign-up page | `src/app/(auth)/register/page.tsx` |
| Who can log in / password rules | `src/lib/auth.ts` and `src/app/api/auth/register/route.ts` |
| Database tables and fields | `prisma/schema.prisma` |
| Demo/starter data | `prisma/seed.ts` |
| The AI's personality when chatting | `src/app/api/agents/chat/route.ts` → the `system` message |
| The AI's marketing writing instructions | `src/app/api/marketing/generate/route.ts` → `prompts` object |
| The AI's document-analysis instructions | `src/app/api/documents/analyze/route.ts` → `modePrompts` |
| Which OpenAI model is used | Same three files above — search for `gpt-4o` |
| Port the app runs on | `package.json` → `dev` / `start` scripts (currently 3005) |

---

## The layout of the project

```
src/
  app/
    page.tsx              ← THE PUBLIC WEBSITE (everything a visitor sees)
    layout.tsx            ← site-wide title/SEO/toast notifications
    globals.css           ← shared styles (.btn-primary, .glass, .gradient-text)

    (auth)/               ← pages for logged-OUT people
      login/page.tsx
      register/page.tsx

    (dashboard)/          ← pages for logged-IN people
      layout.tsx          ← the "you must be signed in" gate + sidebar frame
      dashboard/page.tsx  ← the main overview screen
      agents/page.tsx     ← AI Agent Hub
      crm/page.tsx        ← CRM
      automation/page.tsx
      marketing/page.tsx
      voice-ai/page.tsx
      documents/page.tsx
      analytics/page.tsx
      projects/page.tsx
      marketplace/page.tsx
      website/page.tsx

    api/                  ← THE BACK END (no visuals, just logic)
      auth/register       ← creates accounts
      auth/[...nextauth]  ← handles sign in/out
      agents              ← list/create agents
      agents/chat         ← talks to OpenAI
      crm/contacts        ← list/create contacts
      projects            ← list/create projects
      marketing/generate  ← AI writes marketing content
      documents/analyze   ← AI reads documents
      dashboard/stats     ← the numbers on the overview screen

  components/
    dashboard/Sidebar.tsx ← left menu
    dashboard/Header.tsx  ← top bar
    SessionProvider.tsx

  lib/
    auth.ts               ← login rules
    db.ts                 ← database connection
    utils.ts              ← small helpers

prisma/
  schema.prisma           ← the shape of the database
  seed.ts                 ← demo data + the admin account
```

**The naming rule:** a folder in `src/app/` becomes a web address. `src/app/(dashboard)/crm/page.tsx` is the page at `/crm`. Folders in `(brackets)` are grouping only — they do **not** appear in the URL.

---

## Common jobs, step by step

### Change a price
1. Open `src/app/page.tsx`
2. Find `const plans = [` near the top
3. Edit `price:` — it's a plain number; the `€` is added automatically

### Add a new page to the dashboard
1. Create `src/app/(dashboard)/yourpage/page.tsx`
2. Add an entry to the `nav` array in `src/components/dashboard/Sidebar.tsx`
3. Icons come from `lucide-react` — pick one at lucide.dev and add it to the import list

### Change what an AI agent says
- **Per agent:** the `systemPrompt` field on that agent (set at creation, stored in the database)
- **The fallback for all agents:** `src/app/api/agents/chat/route.ts`, the `content:` under `role: "system"`

### Add a field to the database (e.g. a contact's website)
1. Add the field in `prisma/schema.prisma` under the right `model`
2. Run `npm run db:push`
3. Then use it in the API route and the page

---

## Important: current state of the build

**The dashboard pages are all front-end mockups.** Not one of the eleven dashboard pages calls the back end — the numbers, charts, call logs, and workflows you see are hardcoded arrays inside each page file. The API routes underneath them are real and working, but nothing is plugged into them yet.

Only two things are genuinely wired end to end:
- **Sign up** (`register/page.tsx` → `/api/auth/register` → database)
- **Sign in** (`login/page.tsx` → `src/lib/auth.ts` → database)

So: editing a dashboard page changes what's on screen, but it isn't reading real data yet. Connecting a page means replacing its hardcoded array with a call to the matching API route.

**Not built at all:**
- Stripe billing — the package is installed but there is no checkout, no subscription handling, no webhook. Every "Get Started" button just goes to the sign-up page.
- A `/settings` page — the sidebar links to it, but the page doesn't exist (that link 404s).
- Voice AI, Automation, Website Builder, Marketplace — visuals only, no back end behind them.

---

## Security — worth fixing

Your admin password is written in plain text in two files that are committed to GitHub:
- `prisma/seed.ts` (line 8)
- `Start SlamAI AIOS.bat`

Anyone who can see the repository can read it. Two things to do: change that password wherever else you use it, and move it into an environment variable so it isn't in the code.

---

## Environment variables

Set these in `.env.local` locally, and in Vercel's dashboard for the live site. They are deliberately not in the repo.

| Variable | What it's for |
|---|---|
| `DATABASE_URL` | Postgres connection |
| `DIRECT_URL` | Postgres direct connection (for migrations) |
| `NEXTAUTH_SECRET` | Signs login sessions |
| `OPENAI_API_KEY` | Every AI feature |

---

## Commands

```bash
npm run dev        # run locally at http://localhost:3005
npm run build      # production build — run before pushing to catch errors
npm run db:push    # apply schema.prisma changes to the database
npm run db:studio  # browse the database in a visual editor
npm run db:seed    # load the demo data
npm run lint       # check code style
```
