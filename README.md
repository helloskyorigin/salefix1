# SaleFix — MVP

A clean, iOS-inspired, no-signup product offer auditor with the approved SaleFix growth-arrow logo, free page analysis and a clearly gated $49 paid funnel.

## Current implementation

- Fully responsive landing page, analyze form, actual loading state, personalized free report, before/after headline and $49 checkout screen.
- Real server-side retrieval of publicly readable HTML, up to three specific content observations and source-backed headline advice.
- Optional Gemini API integration for headline suggestions; deterministic, evidence-based fallbacks if no key is supplied.
- Public URL protections: HTTP(S) only, nonstandard ports blocked, private IPs/hostnames blocked, redirects rechecked, DNS pinned to resolved public IP, request timeout and response size limit.
- Manual content fallback for websites that block crawling; source is disclosed in results.
- One-time $49 pricing, no login required for free audit.
- **NO fake testimonials, sales figures, readiness percentages, or fake progress.**

## Local setup

Requires Node.js 20+; zero npm packages.

```bash
npm run dev
```

Open http://localhost:3000 . To enable AI-assisted headline suggestions, copy `.env.example` to `.env.local` and set `GEMINI_API_KEY`; Node doesn't automatically read `.env.local` in this dependency-free local server, so pass it via your shell or deployment environment instead.

## Deployment

1. Create a GitHub repository and upload all the files in this directory.
2. Import the repository into Vercel. Framework preset: **Other** (no build step), root `./`.
3. Deploy. Vercel will treat `/api/analyze.js` as a Node serverless function and serve the static frontend.
4. Optional: add `GEMINI_API_KEY` as a server-side environment variable. Do **not** prefix it with `NEXT_PUBLIC_`.
5. Test a public product URL end-to-end and test the manual fallback.

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

`Landing → Analyze form → Actual analysis → Free result → $49 order preview → (payment integration pending)`

## Brand / design

- Name: SaleFix (platform-agnostic)
- One-time price: $49
- Soft white + light blue, 24px radius, shadow-only/borderless cards
- Approved icon: `assets/salefix-logo.png`
- Mobile-first responsive layout
- No account requirement for free audits

