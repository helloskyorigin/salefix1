# SaleFix — MVP

A clean, iOS-inspired, no-signup product offer auditor with the approved SaleFix growth-arrow logo, free page analysis and a clearly gated $29 paid funnel.

## Current implementation

- Fully responsive landing page, **two-choice audit form (file upload OR product URL; either one is enough)**, real loading state, personalized free report, before/after headline and $29 checkout preview. No repeated URL field, optional 500-character product description with live counter, and no extra audience, benefit or product-name questions.
- Real server-side retrieval of publicly readable HTML, up to three specific content observations and source-backed headline advice.
- Optional Gemini API integration with **separate opt-in flags** for headline suggestions and file-content suggestions grounded in exact quotes from uploaded files. Deterministic, evidence-based fallbacks work without a key.
- Public URL protections: HTTP(S) only, nonstandard ports blocked, private IPs/hostnames blocked, redirects rechecked, DNS pinned to resolved public IP, request timeout and response size limit.
- When a website blocks crawling, the two-choice form suggests uploading product files instead. Backend retains legacy manual-copy support for integrations but the public form no longer exposes that extra field.
- One-time $29 pricing, no login required for free audit.
- **NO fake testimonials, sales figures, readiness percentages, or fake progress.**
- **Evidence-first Results Workspace v3:** real-source product snapshot, deduplicated actionable findings (observation → fix), per-report reviewed checklist saved only in the browser session, one-click fix/headline copying, readable before/after comparison, transparent file and URL coverage, downloadable plain-text report, and an optional $29 Sales Kit panel. No invented sales score or proof.
- **Browser-tested responsiveness:** desktop 1366px, tablet 768px, phone 390px, narrow phone 320px. Real Chromium tests include free upload → audit → results, checklist persistence, clipboard action, report download, legal navigation and closed checkout.

## Local setup

Requires Node.js 20+; zero npm packages.

```bash
npm run dev
```

Open http://localhost:3000 . To enable AI-assisted headlines, configure `GEMINI_API_KEY` and explicitly set `SALEFIX_ENABLE_HEADLINE_AI=true` on the server. For optional file-content AI suggestions, also set `SALEFIX_ENABLE_FILE_AI=true` (disabled by default). File content is sent as capped text excerpts, never raw binaries. **Do not enable paid AI usage on the public endpoint before durable rate limits and billing monitoring are in place.** Google Gemini consumer subscriptions are separate from API billing. This dependency-free local server does not automatically read `.env.local`; export your variables in the shell. Run `npm test` to exercise the upload-only flow, real ZIP/Office fixture extraction and backend audit.

## Deployment

1. Create a GitHub repository and upload all the files in this directory.
2. Import the repository into Vercel. Framework preset: **Other** (no build step), root `./`.
3. Deploy. Vercel will treat `/api/analyze.js` as a Node serverless function and serve the static frontend.
4. Optional: add `GEMINI_API_KEY` as a server-side environment variable. Do **not** prefix it with `NEXT_PUBLIC_`.
5. Test a public product URL and upload-only PDF/ZIP flow on a real mobile browser before promoting the link. GitHub Actions runs `npm test` and a separate public-production smoke check. If the smoke check returns `302` to `vercel.com/sso-api`, the project is protected by Vercel Authentication and must be made publicly accessible in Vercel's deployment-protection settings.

## Production activation & security

**Payment remains OFF by default.** The application now contains guarded Dodo checkout, HMAC-signed webhook verification, durable purchase records, email delivery, passwordless reissue, refund revocation and buyer-authorized hosting. None of these can take real payments without all of the following steps:

1. Make the Vercel **production domain public** under Project → Security → Deployment Protection, selecting Standard Protection or None. A 302 to `vercel.com/sso-api` means the deployment is still protected; this cannot be fixed in GitHub source.
2. For **paid checkout or billable Gemini analysis**, connect Upstash Redis and add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. The free deterministic audit works without this setup but uses a best-effort per-instance limit; before major traffic, enable platform-level abuse protection.
3. Obtain an approved **Dodo Payments merchant account**. The configured `DODO_PRODUCT_ID` must be a genuine one-time **USD $29** product with no discounts. Merchant identity, banking and age eligibility must comply with provider rules. Never use someone else's identity to bypass verification.
4. In **test_mode**, configure `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY`, `SALEFIX_PUBLIC_ORIGIN`, `SALEFIX_KIT_SECRET` (32+ random chars), `RESEND_API_KEY`, and `SALEFIX_DELIVERY_FROM` (a verified sender domain). Subscribe the Dodo webhook to `https://YOUR_DOMAIN/api/dodo-webhook` for payment success, refunds and dispute-related events.
5. Verify a full **sandbox** purchase: correct USD amount, product ID, webhook delivery, email link, `/api/paid-kit`, link reissue, public-page publish and refund revocation. The paid checkout requires the seller's real public product checkout URL; a file-only free audit can be run without one. Test duplicate, tampered and out-of-order webhooks. Then explicitly opt in with `SALEFIX_PAYMENTS_ENABLED=true` and `DODO_PAYMENTS_ENVIRONMENT=live_mode` only after merchant approval and successful production review.
6. Keep Gemini paid requests under control: `GEMINI_API_KEY` optional; `SALEFIX_ENABLE_FILE_AI=false` until cost budgets and monitoring are ready.

**No login is required for the free audit.** Paid customers access their kit using a signed link emailed only after provider-verified payment. Signed links last 7 days; `#/recover` can issue a fresh link to the same purchase email. Website publishing requires an active paid record and a real external checkout URL. All public input is escaped; no fabricated proof, sales numbers or fake customer claims are generated.

**Retention:** Pending orders expire within 90 days. Paid orders, link-reissue indexes and published pages are currently stored up to 365 days. Webhook replay IDs expire within 30 days. Do not promise permanent hosted pages without an explicit longevity plan.

**Operator monitoring:** `/api/status` exposes non-sensitive readiness flags; `/api/health` checks that the function itself responds. GitHub Actions runs both Node tests and a separate public production HTTP smoke check. The paid checkout API returns 503 unless fully configured; no payment can be started while disabled.

## Product flow

`Landing → Optional file/link + optional 500-character description → Free audit → $29 checkout (if configured) → Verified webhook → Email link → Paid kit → Optional hosted page`

## Brand / design

- Name: SaleFix (platform-agnostic)
- One-time price: $29
- Soft white + light blue, 24px radius, shadow-only/borderless cards
- Approved icon: `assets/salefix-logo.png`
- Mobile-first responsive layout
- No account requirement for free audits


## Verified-purchase Sales Kit screen

The `#/kit?access=<SIGNED_TOKEN>` route is a secure customer workspace, not a public preview. The frontend sends the token in the `Authorization` header to `/api/paid-kit`. That endpoint verifies a server-side HMAC signature and expiry using `SALEFIX_KIT_SECRET` (minimum 32 characters). Without configuration or a valid token, access is denied.

The kit includes editable sales-page copy and downloadable HTML; 10 editable marketing posts; 3 SVG graphics; buyer replies; a 7-day plan; and a single ZIP export. Edits are saved only in that browser and are **not** synced across devices. Source text is reviewed with grounded, deterministic templates; there is no claim of revenue or proven conversions. Verified buyers can publish a shareable page to `/p/<order-id>` after adding their existing checkout link; publishing requires a live, active paid record.

**Payment code is integrated but NOT enabled.** `/api/checkout` creates a provider session only after all required server keys and the explicit launch flag are present. `/api/dodo-webhook` validates the exact signed raw body, payment status, product and price before emailing an access link. `/api/recover` issues a fresh link to verified buyers; `/api/publish` requires that buyer token and an active stored order. Real merchant and sandbox tests must still be completed before charging customers.

For security, do not put actual payment tokens, private email addresses, or `SALEFIX_KIT_SECRET` in Git. Do not launch payment until merchant approval, Redis provisioning, email-domain verification, real sandbox checkout, refund and reissue tests are complete.


## Product-first file audit (free)

Visitors can upload up to three digital-product files (20 MB each, 45 MB combined) **without a website link**; a sales-page URL and manual description are optional. The browser extracts supported content and sends only excerpts, file inventory and metadata to `/api/analyze` (not the raw binary files). The backend reviews product completeness and usability using format-specific, conservative heuristics and displays the exact source of each observation. A separate sales-page check appears only when an accessible link is provided.

Supported top-level input formats: PDF, ZIP, DOCX, XLSX, PPTX, EPUB, TXT, Markdown, CSV/TSV, JSON, PNG/JPEG/WEBP, and SVG. PDF text is extracted with lazy-loaded PDF.js (first 90 pages or capped excerpt); archive/Office/EPUB text is parsed using lazy-loaded JSZip. In ZIPs, the tool inventories up to 120 entries and samples small readable text files; it **does not execute files or visually inspect templates**, parse nested PDFs, detect broken formulas, verify factual claims, or perform OCR. For image assets, metadata is inspected, not design quality. Truncated/unsupported inspection is clearly disclosed. PDF.js requires internet connectivity to load; JSZip is bundled locally.

Archive protections: max 220 entries, 75 MB estimated uncompressed; no executable execution; no server-side file storage. This is a useful preliminary product audit, not a guarantee of sales, factual correctness, or complete file validation. Use appropriate rate limiting on `/api/analyze` before high traffic. Checkout remains disabled.
