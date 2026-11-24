# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Astro 5, built two ways (user decision, 2026-11-20):
- **Production on the owner's VPS:** `@astrojs/node` standalone, SQLite via `node:sqlite`, a staff portal with logins.
- **Static demo on GitHub Pages** for management review: the same UI, with data in the browser's localStorage.

Also GSAP 3.13 (ScrollTrigger, ScrollSmoother, SplitText) and three.js r159 for the home clay background.

## Users

1. **Consultancy clients** (primary): developers, main contractors, MEP contractors and architects who need HVAC, firefighting or plumbing engineering, MEP design and shop drawings, or BOQs, cost estimates and tender support, in the UAE, Saudi Arabia, Qatar, Kuwait, Bahrain, Oman and India.
2. **Engineers choosing training:** graduates and working engineers who want MEP design skills for the GCC.
3. **Students and fresh graduates** who want the GCC-ready internship package.
4. **Job seekers:** MEP engineers, draughtspeople and quantity surveyors.
5. **Employers** verifying a Mechbridge certificate.
6. **Staff** using the portal: superadmin, HR, Training, Sales.

## Product Purpose

The site presents Mechbridge International MEP Consultants as an MEP engineering consultancy. Success means proposal requests first, then training enquiries, internship applications and job applications, all landing as leads in the staff portal. It also publishes jobs, internship intakes and training batches, and issues certificates anyone can verify.

## Positioning

A multidisciplinary MEP consultancy specialising in HVAC, firefighting and fire protection, and plumbing and public health. It carries a project from load calculations and design through shop drawings, BOQs and tender to execution and as-built, with teams in Dubai and India working to one standard. Its training and internships are run by the same engineers. They are not academic.

## Operating Context

- Headquarters in Dubai (Unbox, World Trade Center). Operating from Dubai and Kozhikode, India (C.M Mathew Brothers Arcade, Edapally Panvel Highway, Vikas Nagar Housing Colony, West Nadakkave, Bilathikkulam, Kozhikode, Kerala 673006). Marketed worldwide with the GCC as the main market, kept implicit. Hiring in the six GCC states and India. 15+ years in the industry, 20+ projects completed, projects in 10+ countries, 3,000+ students trained (confirmed 2026-11-24).
- Copy says "GCC", never "Gulf" (user decision, 2026-11-20).
- Training is delivered online only, but the site never says so outright: no classroom, office or city-based training is advertised, and "live, instructor-led sessions" implies it.
- The five engineering services and their scope lists come from the company's own service portfolio (pasted by the user, Nov 2026). See `src/data/services.ts`.
- Training is **one course**: Professional MEP Engineering Training (HVAC, Firefighting, Plumbing). No AutoCAD, Revit MEP or BIM in the course content, and no mention of electrical or civil streams (user decision, 2026-11-22). Fees can be paid in instalments with Tabby or Tamara (Mechbridge is a merchant partner of both).
- Internship is a **package**: the full course plus supervised project work, portfolio, interview prep and a certificate.
- Codes listed (to confirm): UAE Fire & Life Safety Code, Saudi Building Code, NFPA, ASHRAE, SMACNA, UPC, BS EN 12056, Dubai Municipality, Civil Defence, Al Sa'fat, Estidama.

## Capabilities and Constraints

- Domain: mechbridgegroup.com. Inbound: connect@. Support: support@. Careers: careers@. Internships: intern@ (all @mechbridgegroup.com). Lead alerts route per type to the matching inbox.
- Logo and title: Mechbridge International. Company name in text: Mechbridge International MEP Consultants.
- Roles: superadmin (everything, staff accounts), HR (jobs, internships and their applications), Training (batches, certificates, training enquiries), Sales (proposal, contact and support leads).
- Certificate codes look like `MBI-YYYY-XXXXXX`. Public verification shows only holder name, programme, title, issue date and status.
- Undecided: course and internship durations and fees, batch dates, the certification or accreditation body. Never invent these.

## Brand Commitments

- Palette from `brand-theme/`: Midnight Navy #1A2841, Old Cream #F0E1CE, Vintage Red #B11722. Never red text on navy.
- Logo: skyscraper "M" monogram with MECHBRIDGE wordmark (Nov 2026), recoloured per ground.
- Home hero: a night business boulevard with red-edged towers. The clay scroll scene stays behind the home sections (user decision).
- Glass and fluted glass appear only over photos or the clay scene.
- **No team names, portraits or team photos anywhere** (user decision). Work scenes with incidental people are fine, but their alt text must not claim they show Mechbridge staff.
- Feel like a large firm through scale and confidence, never by claiming size.

## Evidence on Hand

- Logo, hero photo, brand tokens, clay background, and 50+ AI-generated illustrative photos (see IMAGE-GENERATION.md; none show real staff or projects).
- No testimonials or client logos. The only named projects are the three "Recent highlights" supplied by Mechbridge: Jasleena’s Residence, Mohammed’s Residence and Zangos. Present them as recent highlights, not as the client list. Don't fabricate any others.

## Product Principles

1. Consultancy first: services lead every page's hierarchy. Training, internships and careers follow.
2. Prove with specifics (scope items, codes, deliverables), not adjectives.
3. Big-firm calm: short sentences, no hype.
4. Never fabricate a number, client, person or credential.

## Accessibility & Inclusion

WCAG 2.2 AA. Full reduced-motion support. Content readable without WebGL. The admin portal is keyboard-operable.
