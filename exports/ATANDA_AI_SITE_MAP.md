# ATANDA.AI Site Map

**Domain reviewed:** [https://atanda.ai](https://atanda.ai)  
**Review date:** 5 September 2026  
**Product:** ARK Career Intelligence  
**Method:** Live-page review, public search-index review, and route inventory cross-check.

## 1. Executive analysis

Atanda.ai is the public domain for the ARK Career Intelligence platform. The experience combines:

- A public marketing and conversion layer
- A no-login guided product demo
- Authentication and account recovery
- An authenticated individual career-intelligence workspace
- Learning, certification, marketplace, and mobility tools
- Institution and enterprise workforce tools
- Public sharing and verification links
- A separate staff-only command-centre subdomain

The main conversion journey is:

`Landing page → Demo or sign-up → CV upload → Assessment → Intelligence Hub → Recommended next move`

The platform is implemented as a client-rendered single-page application. Public search results currently expose only a small portion of the actual route surface.

## 2. Hierarchical sitemap

```text
ATANDA.AI / ARK Career Intelligence
│
├── Public marketing
│   ├── /                              Landing page
│   │   ├── Product proposition
│   │   ├── How it works
│   │   ├── Intelligence layers
│   │   ├── F1000 promotion
│   │   ├── Product walkthroughs
│   │   ├── Plans and pricing
│   │   └── Context Craft book promotion
│   ├── /f1000                         First 1,000 promotion
│   ├── /context-craft                 Context Craft information
│   ├── /subscription                  Plans and subscription options
│   ├── /privacy                       Privacy policy
│   └── /terms                         Terms of service
│
├── Product demonstration
│   ├── /demo                          Investor/product demo
│   └── /demo-tour                     Guided no-login demo
│       ├── JST Index
│       ├── Skill Games
│       ├── SPHINX Marketplace
│       ├── Career Mobility
│       ├── Workforce Intelligence
│       ├── Book Companion
│       └── Plan walkthroughs
│
├── Authentication
│   ├── /login                         Sign in
│   ├── /signup                        Create account
│   ├── /forgot-password               Request reset code
│   └── Password-reset continuation    Code/password workflow
│
├── Analyze
│   ├── /upload                        Upload or paste CV
│   ├── /assessment                    Assessment processing/results
│   ├── /dashboard                     Intelligence Hub
│   ├── /ark-resume                    Verified, ATS-oriented ARK Resume
│   ├── /ark/history                   ARK identity and score history
│   ├── /report                        ARK Report and ARK Guide
│   ├── /book                          Context Craft Book Companion
│   └── /merlin                        Completion Assurance Guide
│
├── Explore
│   ├── /play                          CCGE skill games
│   ├── /pathways                      Career Mobility pathways
│   ├── /training                      Training-provider directory
│   │   ├── /training/p/:slug          Provider detail
│   │   └── /training/register         Provider registration
│   ├── /marketplace                   SPHINX marketplace
│   │   ├── /marketplace/:id           Listing detail
│   │   ├── /marketplace/publish       Publish a listing
│   │   ├── /marketplace/bonsai        BONSAI surface
│   │   ├── /marketplace/corporate     Institution marketplace
│   │   ├── /marketplace/roundtable    Top-12 SPC leaderboard
│   │   ├── /marketplace/synergy       Card-combination lab
│   │   ├── /marketplace/synthesis     Synthesis surface
│   │   └── /marketplace/forge-lab     Document pre-check lab
│   └── /matchmaking                   Talent Exchange
│       └── /matchmaking/:id           Match detail
│
├── Organization and workforce
│   ├── /school                        Institution/cohort dashboard
│   ├── /enterprise                    Enterprise workforce overview
│   └── /workforce                     HR roster and workforce intelligence
│
├── Account
│   ├── /profile                       Personal profile and data controls
│   ├── /subscription                  Plan and billing management
│   └── /checkout/:id                  Checkout for selected plan
│
├── Public and token-based views
│   ├── /u/:username                   Public GUIN profile
│   ├── /r/:token                      Shared ARK report
│   └── /confirm/:token                Confirmation request
│
├── Administration
│   └── /admin/ccge-import             CCGE bulk importer
│
└── Separate Atanda subdomain
    └── command-center.atanda.ai       Staff-only ATANDA Command Centre
```

## 3. Access-level map

| Area | Access | Primary purpose |
|---|---|---|
| Landing, legal, pricing | Public | Explain ARK and convert visitors |
| Demo tour | Public | Let visitors experience representative product flows |
| Authentication | Public | Account creation, sign-in, and recovery |
| Shared reports and public profiles | Public link | Controlled sharing and public identity |
| Personal intelligence tools | Authenticated | CV analysis, scores, guidance, learning, and mobility |
| Marketplace and Talent Exchange | Authenticated; some plan/feature restrictions | Publish, discover, combine, and match verified capabilities |
| School and workforce areas | Institution/enterprise access | Cohort and workforce intelligence |
| CCGE importer | Administrator | Controlled bulk certification import |
| Command Centre | Staff-only subdomain | Internal ATANDA operations |

## 4. Primary user journeys

### New individual

`/ → /signup → /upload → /assessment → /dashboard → /merlin or /pathways`

### Returning individual

`/login → /dashboard → /merlin → recommended completion route`

### Product evaluator

`/ → /demo-tour → selected demo module → /signup`

### Learner and certification seeker

`/dashboard or /merlin → /book or /play → /training → updated ARK identity`

### Marketplace creator

`/marketplace → /marketplace/publish → listing detail → marketplace discovery`

### Institution administrator

`/login → /enterprise or /workforce → department/cohort drill-down → report or action`

### Shared-report recipient

`/r/:token → review shared ARK information → platform entry point`

## 5. Navigation observations

The authenticated navigation is organized into four functional groups:

1. **Analyze** — Home, CV upload, Intelligence Hub, ARK Resume, Book Companion, MERLIN
2. **Explore** — Skill Games, Marketplace tools, Career Mobility, Training Providers
3. **Talent** — Talent Exchange
4. **Organization** — Workforce and Workforce Intelligence

Account, institution, subscription, and administration links are presented separately.

This is a broad product surface. MERLIN is therefore important as a cross-platform guide because the navigation reflects platform capabilities rather than a single linear journey.

## 6. Crawlability and discoverability findings

### Confirmed

- The homepage, demo tour, login, sign-up, password recovery, privacy, and terms pages are discoverable in public search.
- `robots.txt` permits general search indexing.
- The site identifies itself consistently as ARK Career Intelligence.

### Issues

1. **No functioning XML sitemap**
   - `https://atanda.ai/sitemap.xml` returns application content rather than XML.
   - Search engines do not receive a canonical inventory of public URLs.

2. **Client-side fallback on infrastructure paths**
   - `robots.txt` includes crawler policy text followed by the application HTML.
   - This suggests unmatched paths may be falling through to the SPA entry document.

3. **Limited indexed route coverage**
   - Search results expose only a small subset of the intended public and shareable pages.

4. **Generic metadata across routes**
   - Indexed pages share the same ARK title in search results.
   - Distinct titles and descriptions would make legal, demo, training, profile, and shared-report pages easier to identify.

5. **Social metadata is not fully branded**
   - The reviewed document uses a generic Replit Open Graph image and Replit Twitter account metadata.

6. **Potential URL inconsistency**
   - The live homepage extraction contained an `/sign-up` link while the application route is `/signup`.
   - Conversion links should resolve to one canonical path.

7. **Placeholder contact**
   - The indexed privacy policy displays `privacy@arkplatform.example`.
   - This should be replaced with an operational, domain-owned privacy contact before relying on the page for production compliance.

## 7. Recommended public XML sitemap scope

The XML sitemap should include stable, indexable pages only:

```text
https://atanda.ai/
https://atanda.ai/demo
https://atanda.ai/demo-tour
https://atanda.ai/signup
https://atanda.ai/login
https://atanda.ai/subscription
https://atanda.ai/context-craft
https://atanda.ai/f1000
https://atanda.ai/training
https://atanda.ai/privacy
https://atanda.ai/terms
```

Add public provider and GUIN profile URLs only when each page:

- Has meaningful public content
- Has a canonical URL
- Is allowed to be indexed by its owner
- Does not reveal protected or personal information

Do **not** include authenticated dashboards, admin routes, checkout URLs, tokenized reports, confirmation links, or private workforce pages in the public XML sitemap.

## 8. Recommended next actions

1. Serve a valid XML response at `/sitemap.xml`.
2. Serve a clean text-only `/robots.txt`.
3. Add route-specific page titles, descriptions, canonical tags, and social cards.
4. Replace generic Replit social metadata with ARK/ATANDA branding.
5. Canonicalize `/signup` and remove or redirect `/sign-up`.
6. Replace placeholder privacy contact information.
7. Decide which training-provider and public-profile pages should be indexed.
8. Add conversion links from public content pages back to sign-up and the guided demo.

## 9. Source-confidence note

- **Live-verified:** Homepage appearance and content, public search-index results, `robots.txt`, and `/sitemap.xml` behavior.
- **Codebase-verified:** Application route inventory and authenticated navigation grouping.
- **Access-inferred:** Exact authorization and plan restrictions for routes not available without the relevant account role.
