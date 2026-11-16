# Content to confirm before launch

The site doesn't invent numbers, names or credentials. Everything below is either missing or written as a reasonable draft that someone at Mechbridge must check.

## Facts to supply

| What | Where it shows | Current text |
|---|---|---|
| Course duration per track | `/training/<track>`, "Duration" row | "To be confirmed" (`src/pages/training/[slug].astro`) |
| Fees and next start dates | Training FAQ answer | "Fees and dates depend on the track and format. Send an enquiry…" (`src/pages/training/index.astro`) |
| Trainer names (4) | `/training`, trainer cards | "Name to come" (`trainers` array in `src/pages/training/index.astro`) |
| Leadership names and roles (3) | `/about` | "Name to come" / "Role to come" (`src/pages/about.astro`) |
| Office addresses (Dubai, India city, KSA city) | Footer, contact page, JSON-LD | City or country only (`src/data/site.ts`) |
| Which Indian city the India HQ is in | Everywhere "India" appears as an office | "India" (`offices` in `src/data/site.ts`) |
| Web3Forms access key | All forms | Without it, forms open the visitor's email app. Copy `.env.example` to `.env` and add the key. |
| Social sharing image | `<meta property="og:image">` | `public/images/og-default.jpg` is missing (see IMAGES.md) |

## Draft claims to check

These lines read as fact. Confirm each one or edit it.

- **About, story section:** "We started as a small team of MEP engineers working on Gulf projects…", plus the three problems the firm was built to fix. This history was written from the brief and needs confirming.
- **Training:** "Every instructor is on current Mechbridge projects" and "Instructors come from our Dubai, India and Saudi teams".
- **Training formats:** Dubai classroom (evenings and weekends), Saudi batches, live online. Confirm all three run.
- **Training certificate:** "You receive a Mechbridge MEP Consultants certificate for each track you complete". Confirm, and say whether any external body accredits it.
- **Training:** "redacted drawings from live projects in Dubai and KSA". Confirm you're allowed to use client material this way.
- **Home:** the "6 tracks" count and the six track titles and modules in `src/data/tracks.ts`. These are a proposed curriculum; edit to match the real syllabus.
- **Codes and authorities** listed on the home page, the services page and each track (UAE Fire & Life Safety Code, SBC, NFPA, ASHRAE, DEWA, SEC, DM, DCD, Al Sa'fat, Estidama, ISO 19650). Remove any your teams don't work to.
- **Services:** peer review / value engineering, and supervision & commissioning. Confirm both are offered.
- **Sectors** on `/services`: residential, hospitality, retail, healthcare, industrial, offices.

## Confirmed by the brief

- Mechbridge International is the main name and logo. Training is delivered under Mechbridge MEP Consultants.
- 15+ years of industry experience.
- Headquarters in Dubai and India, operations in Saudi Arabia.
- connect@mechbridgegroup.com for inbound queries, support@mechbridgegroup.com for support.
