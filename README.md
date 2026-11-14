# SaleFix — MVP

A clean, iOS-inspired, no-signup product offer auditor with the approved SaleFix growth-arrow logo, free page analysis and a clearly gated $49 paid funnel.

## Current implementation

- Fully responsive landing page, **two-choice audit form (file upload OR product URL; either one is enough)**, real loading state, personalized free report, before/after headline and $49 checkout preview. No repeated URL field and no extra audience, benefit, title or description questions.
- Real server-side retrieval of publicly readable HTML, up to three specific content observations and source-backed headline advice.
- Optional Gemini API integration for headline suggestions and, only when explicitly enabled, content suggestions grounded in exact quotes from uploaded files. Deterministic, evidence-based fallbacks work without a key.
- Public URL protections: HTTP(S) only, nonstandard ports blocked, private IPs/hostnames blocked, redirects rechecked, DNS pinned to resolved public IP, request timeout and response size limit.
- When a website blocks crawling, the two-choice form suggests uploading product files instead. Backend retains legacy manual-copy support for integrations but the public form no longer exposes that extra field.
- One-time $49 pricing, no login required for free audit.
- **NO fake testimonials, sales figures, readiness percentages, or fake progress.**

## Local setup

Requires Node.js 20+; zero npm packages.

```bash
npm run dev
```

Open http://localhost:3000 . To enable AI-assisted headlines, set `GEMINI_API_KEY` on the server. For optional file-content AI suggestions, also set `SALEFIX_ENABLE_FILE_AI=true` (disabled by default). File content is sent as capped text excerpts, never raw binaries. **Do not enable paid AI usage on the public endpoint before durable rate limits and billing monitoring are in place.** Google Gemini consumer subscriptions are separate from API billing. This dependency-free local server does not automatically read `.env.local`; export your variables in the shell. Run `npm test` to exercise the upload-only flow, real ZIP/Office fixture extraction and backend audit.

## Deployment

1. Create a GitHub repository and upload all the files in this directory.
2. Import the repository into Vercel. Framework preset: **Other** (no build step), root `./`.
3. Deploy. Vercel will treat `/api/analyze.js` as a Node serverless function and serve the static frontend.
4. Optional: add `GEMINI_API_KEY` as a server-side environment variable. Do **not** prefix it with `NEXT_PUBLIC_`.
5. Test a public product URL and upload-only PDF/ZIP flow on a real mobile browser before promoting the link. GitHub Actions runs `npm test` and a separate public-production smoke check. If the smoke check returns `302` to `vercel.com/sso-api`, the project is protected by Vercel Authentication and must be made publicly accessible in Vercel's deployment-protection settings.

## IMPORTANT: Before paid launch

**Payment is intentionally OFF.** Do not replace it with a direct payment link without implementing verified entitlement and delivery. The finished paid product must include:

- Dodo Payments (or another approved provider) checkout at $49, receipt, and server-side webhook signature/payment verification.
- Buyer ownership and passwordless edit-access, stored using a real database/KV service.
- A paid kit generator, branded asset exports and a publish endpoint. Never unlock from query parameters or a client-side success message alone.
- A real live sales-page URL for each paid product, with buyer-controlled existing checkout link. No analytics are promised.
- Payment, failed-payment, fulfilled-delivery, refunds, rate-limit and replay tests.
- Accurate Terms/Privacy/Refund details, verified support email, and merchant age/KYC eligibility.

The audit is intentionally open for internal tests, but **add durable per-IP/user rate limiting and abuse controls** before marketing broadly. Gemini API use is not included in consumer subscriptions and can have usage charges.

## Product flow

`Landing CTA → Two-choice form (files or URL) → Actual analysis → Free result → $49 preview (payment integration pending)`

## Brand / design

- Name: SaleFix (platform-agnostic)
- One-time price: $49
- Soft white + light blue, 24px radius, shadow-only/borderless cards
- Approved icon: `assets/salefix-logo.png`
- Mobile-first responsive layout
- No account requirement for free audits


## Verified-purchase Sales Kit screen

The `#/kit?access=<SIGNED_TOKEN>` route is a secure customer workspace, not a public preview. The frontend sends the token in the `Authorization` header to `/api/paid-kit`. That endpoint verifies a server-side HMAC signature and expiry using `SALEFIX_KIT_SECRET` (minimum 32 characters). Without configuration or a valid token, access is denied.

The kit currently includes editable sales-page copy and downloadable HTML; 10 editable marketing posts; 3 SVG graphics; buyer replies; a 7-day plan; and a single ZIP export. Edits are saved only in that browser and are **not** synced across devices. Source text is reviewed with grounded, deterministic templates; there is no claim of revenue or proven conversions. One-click hosted publishing is not active.

**Payment integration is still missing.** `/api/checkout` remains disabled. Never issue tokens from a public endpoint or from client-supplied `verifiedProviderEvent` fields. Only invoke `issueKitAccess` server-side after checking a completed $49 USD payment via a **cryptographically verified provider webhook**, and email the resulting link to its purchaser. The signed link currently expires after 7 days; before charging customers, add a secure email reissue mechanism (and persistent purchase records) so they can regain access without logging in. The local server supports `/api/paid-kit` with the same access validation.

For security, do not put actual payment tokens, private email addresses, or `SALEFIX_KIT_SECRET` in Git. The paid workspace cannot be used by customers until the payment verification, secure link delivery, reissue and support processes are connected and tested.


## Product-first file audit (free)

Visitors can upload up to three digital-product files (20 MB each, 45 MB combined) **without a website link**; a sales-page URL and manual description are optional. The browser extracts supported content and sends only excerpts, file inventory and metadata to `/api/analyze` (not the raw binary files). The backend reviews product completeness and usability using format-specific, conservative heuristics and displays the exact source of each observation. A separate sales-page check appears only when an accessible link is provided.

Supported top-level input formats: PDF, ZIP, DOCX, XLSX, PPTX, EPUB, TXT, Markdown, CSV/TSV, JSON, PNG/JPEG/WEBP, and SVG. PDF text is extracted with lazy-loaded PDF.js (first 90 pages or capped excerpt); archive/Office/EPUB text is parsed using lazy-loaded JSZip. In ZIPs, the tool inventories up to 120 entries and samples small readable text files; it **does not execute files or visually inspect templates**, parse nested PDFs, detect broken formulas, verify factual claims, or perform OCR. For image assets, metadata is inspected, not design quality. Truncated/unsupported inspection is clearly disclosed. PDF.js requires internet connectivity to load; JSZip is bundled locally.

Archive protections: max 220 entries, 75 MB estimated uncompressed; no executable execution; no server-side file storage. This is a useful preliminary product audit, not a guarantee of sales, factual correctness, or complete file validation. Use appropriate rate limiting on `/api/analyze` before high traffic. Checkout remains disabled.
