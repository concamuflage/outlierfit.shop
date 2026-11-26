# Playwright Scenario Migration

The active Java/Cucumber browser and API scenarios have executable Gherkin
equivalents in `features/`, using `playwright-bdd` and the Playwright test runner.
Java files are retained as legacy coverage references. Staging Jenkins jobs now
use Playwright regression; production uses separate read-only `@smoke` features. Two previously deleted
Playwright starter files are not restored; replacements have feature-based names.

## Coverage Map

Counts include all five password-policy outline rows, not just the outline title.

| Java feature | Cases | Playwright feature | Preserved checks |
| --- | ---: | --- | --- |
| `signup_login.feature` | 8 | `features/ui/signup_login.feature` | Unverified/wrong-password rejection, delivery/sender/link, resend, duplicate signup, five invalid passwords |
| `ResetPassword.feature` | 2 | `features/ui/ResetPassword.feature` | Verified/unverified reset, delivered link, confirmation, new-password login, already-verified link reuse |
| `modal.feature` | 1 | `features/ui/modal.feature` | Open, switch, and close auth modals |
| `cart.feature` | 1 | `features/ui/cart.feature` | Both categories, quantity changes, subtotal, one flat shipping fee |
| `CartAndDrawerSyn.feature` | 2 | `features/ui/CartAndDrawerSyn.feature` | Variant IDs, quantities, shipping, and total equality in both directions |
| `checkout.feature` | 2 | `features/ui/checkout.feature` | Saved/empty addresses, alternative selections, editing, adding shipping and separate billing |
| `paymentDev.feature` | 3 | `features/ui/paymentDev.feature` | New-user card payment, webhook fulfillment, invoice email/PDF/link, browser Back and Stripe Back |
| `orders-api.feature` | 1 | `features/api/orders-api.feature` | Order list/detail, paid/unshipped state, item snapshots |
| `orders-invoice-api.feature` | 1 | `features/api/orders-invoice-api.feature` | Complete invoice metadata, both addresses, prices, sizes, quantities |
| `cart-api.feature` | 1 | `features/api/cart-api.feature` | Save/retrieve/clear, item IDs, quantities, address selections |
| `checkout-api.feature` | 1 | `features/api/checkout-api.feature` | Local mock payment, list/detail/invoice, both PDF endpoints, stock deduction |
| `profile-api.feature` | 1 | `features/api/profile-api.feature` | Authentication/password checks, deletion, subsequent login rejection |
| **Active Java scenarios** | **24** | | |

Additional regression coverage includes the two existing desktop/mobile modal
login/cart cases, production URL rejection, live Stripe key rejection, and forced
failure-path fixture cleanup. The commented-out profile scenario, unused Java
step definitions, and Java helper unit tests are not represented as active
Cucumber scenarios in this map and have not been deleted.

## Feature Files And Step Definitions

`features/ui/*.feature` contains the seven browser feature files;
`features/api/*.feature` contains the five HTTP API feature files. Shared steps
remain in `steps/`. Discovery includes both folders with `features/**/*.feature`.
For example, `features/ui/signup_login.feature` includes:

```gherkin
Scenario: User cannot sign up twice with the same email address
  When I sign up with a unique email and password "StrongPass123A"
  Then signup should ask me to verify my email
  When I sign up again with the same email
  Then signup should show a validation error
```

`steps/auth.steps.ts`, `store.steps.ts`, `api.steps.ts`, and `payment.steps.ts`
bind those human-readable steps to real actions and assertions. Shared page
objects and the `sandbox` fixture preserve cleanup. `npm run bddgen` validates
all steps and generates `.features-gen/`, which is ignored and must not be edited.
The npm test commands regenerate it automatically before running Playwright.
No Java, Maven, or Cucumber JVM runner is involved in this suite.

Run one feature, for example:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3100 RUN_MAIL_TESTS=1 \
npm test -- features/ui/signup_login.feature
```

The checkout feature previously referenced unavailable Hoodies and undefined
Java steps. Its replacement exercises the same review/address behavior against
the current Shirts category. Tests no longer use arbitrary first products or a
shared customer's cart. Invoice mail checks preserve the original Java assertions
and validate the linked PDF. Despite the old step's wording, the app sends a
download link, not a PDF attachment.

## Setup And Run

Settings come only from the project-root `.env.local`, with process environment
overrides. No additional env file is needed. Use Node 22 and installed Chrome.

```bash
cd /Users/Mark_1/project888/playwright-tests
npm ci
npm run typecheck
```

Start a local app in another terminal. Explicit origins keep email/reset/payment
links on this app instead of another project using port 3000:

```bash
cd /Users/Mark_1/project888
CLIENT_ORIGIN=http://localhost:3100 NEXTAUTH_URL=http://localhost:3100 \
APP_URL=http://localhost:3100 EMAIL_VERIFICATION_APP_URL=http://localhost:3100 \
npm run dev -- --port 3100
```

For reliable browser runs, prefer a local production build instead of Fast Refresh:

```bash
cd /Users/Mark_1/project888
npm run build
npm run start
```

The root `.env.local` must set `APP_URL=http://localhost:3000` (and matching
`NEXTAUTH_URL` / `CLIENT_ORIGIN`) for that server. `APP_URL` controls verification,
reset, invoice, and Stripe redirect links even when `NODE_ENV=production`.
For example, a locally delivered verification link must start with
`http://localhost:3000/verify-email`, not `https://outlierfit.shop/verify-email`.
Optional `EMAIL_VERIFICATION_APP_URL` and `PASSWORD_RESET_APP_URL` override
`APP_URL` for their respective emails. Rebuild/restart after source changes;
restart after changing server env settings. Keep Stripe credentials in test mode.

Run non-mail/non-payment regression tests:

```bash
cd /Users/Mark_1/project888/playwright-tests
PLAYWRIGHT_BASE_URL=http://localhost:3100 npm run test:regression
```

All tests use a fresh browser context. Database tests additionally create unique
accounts, private product variants with 20 units, and their own addresses/orders.
The imported Shirts and T-shirts catalog supplies taxonomy prerequisites; tests
do not deduct or restore shared product inventory. Teardown runs on failure too
and transactionally removes owned rows, including Stripe/payment dependencies.
Open, owned Stripe test sessions are expired before deletion. Cleanup errors are
reported as failures, not hidden. No personal/shared configured account is edited.

Cart, cart/drawer synchronization, checkout/address review, and payment-cancellation
scenarios use API login for setup. For example, `I am a verified disposable customer`
calls `authenticate(page.request, account)` before opening `/products`; cookies are
shared with that scenario's browser, and the visible Sign out button confirms the
browser is authenticated. Saved-address setup uses the same method after seeding
the scenario's own addresses. No scenario reuses another test's account or session.
Explicit login steps in signup/password-reset scenarios, the modal-login regression,
and the full new-user signup-to-payment flow still exercise the UI login form.

Local parallel browser scenarios also use distinct simulated client IPs for
same-origin `/api/store/auth/*` requests. For example, two signup scenarios have
different reserved `2001:db8::/32` addresses, so they do not consume each other's
ten-attempt IP bucket. The real endpoint, validation, email send, and rate limit
still execute; multiple attempts within one scenario keep the same client IP.
Only the test fixture changes headers: no application limit is disabled or raised.
No identity headers are added to Stripe, Gmail, other app routes, or staging.
Staging still needs to respect the shared client-IP and provider rate limits;
this local isolation does not promise unrestricted parallel email sending there.

## Opt-in External Tests

Mail needs Gmail read credentials (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`GMAIL_REFRESH_TOKEN`, or a temporary `GMAIL_ACCESS_TOKEN`), `RESEND_FROM_EMAIL`,
and working app email delivery. `TEST_EMAIL_BASE` defaults to the existing Gmail
test mailbox; every scenario uses a unique plus alias. Polling defaults to 120
seconds (`GMAIL_POLL_TIMEOUT_MS`), accepts only fresh mail for the recipient, and
checks link origin instead of silently rewriting a production link to staging.

The resend-verification scenario records the original delivered link without
opening it, then confirms the resend response and waits for a different link.
For example, an original token delivered within two seconds of the resend cannot
satisfy the new-message lookup. This avoids following an invalidated token while
Gmail is still indexing the replacement email; timestamp tolerance alone cannot
distinguish the two messages.

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3100 RUN_MAIL_TESTS=1 \
npm run test:mail -- --grep-invert @payment
```

Payment scenarios require a test key and explicit opt-in. Each hosted session's
actual `livemode=false`, `cs_test_` ID, and owner are checked before card entry.
The successful-payment case also requires mail and genuine webhook delivery to
the app (Stripe CLI forwarding for localhost, or the staging test webhook).
Do not use synthetic `cs_test_api_*` IDs, fake successful responses, or test cards
on production. No test is retried automatically after a payment click.

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3100 RUN_PAYMENT_TESTS=1 RUN_MAIL_TESTS=1 \
npm run test:payment
```

The mock endpoint is development-only and remains disabled on staging/production:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3100 RUN_MOCK_PAYMENT_TESTS=1 \
npm test -- --grep @dev-only
```

Production hosts and production-named databases are blocked. For staging, the
process must also point DB settings at the staging database (for example via a
local tunnel), and email links must use the staging origin. A fixture's NextAuth
session is checked against its exact DB user ID before API assertions.

## Reports And CI

`npm test -- --list` lists 24 feature scenarios plus seven native router-cache/safety
checks without changing any data. `npm run test:headed`
opens Chrome; `npm run test:ui` opens Playwright's UI. `npm run report` displays
`playwright-report`; JUnit output is `test-results/junit.xml`. Failed browser tests
include a screenshot/video. Keep artifacts private: they can include test mail
links and hosted Checkout URLs.

Tags are `@smoke`, `@regression`, `@api`, `@mail`, `@payment`, and `@dev-only`.
The default `npm test` run skips mail/payment/mock cases unless their flags are
set. `npm run test:regression` remains the quick local subset excluding mail,
payment, and mock cases. `npm run test:regression:staging` selects all regression
cases except `@dev-only`, using up to three workers. It requires mail/payment opt-ins;
the Jenkins wrapper supplies those flags and staging/CI credentials automatically.

Staging uses separate projects: `chromium-ui` runs ordinary UI scenarios fully
in parallel (including scenarios in the same feature), capped at three workers.
`chromium-external` runs UI cases tagged `@mail` or `@payment` one at a time;
`api` and `support` also each have a one-worker cap. The global cap is three, not
three workers per project added together. Filters are disjoint, so email/payment
cases do not also run in `chromium-ui`. Results merge into the same JUnit/HTML
reports. Normal local commands keep their existing single-worker default.

After staging deployment and the HTTPS health check, `Jenkinsfile.staging` runs
`bash scripts/deploy/ci.sh staging regression`. No Java or separate smoke suite
runs in this post-deploy gate. This includes both API and browser scenarios,
Gmail verification/reset, and real test-mode Stripe payment/cancellation. Build
unit checks are unchanged. The manual
`Jenkinsfile.staging.full-tests` job uses the same Playwright regression command.

The wrapper installs this package's pinned dependencies, uses the Jenkins VM's
installed Chrome, reads `outlierfit-staging-env` and `outlierfit-ci-env` in memory,
and installs Playwright's matching FFmpeg binary using `npx playwright install ffmpeg`.
Chrome alone does not supply the versioned FFmpeg cache used by failure-video
recording. Both staging regression and production smoke install it as the Jenkins
user after `npm ci`; a missing/download-failed binary stops setup before tests.
The wrapper connects fixtures to the staging DB through an SSH tunnel. It rejects a live
Stripe key, production DB, or wrong configured origin, and disables proxies.
No local dev credentials are uploaded. Jenkins collects JUnit and HTML reports,
including failed-test artifacts, before any promotion can proceed. Keep artifacts
private because they may contain temporary mail or Checkout links. These changes
take effect when the configured Jenkins branch receives the updated files.

## Production Smoke Features

Production promotion now runs `npm run test:smoke:production` from Jenkins after
the health check and before finalization. This replaces both old deployment smoke
runners (the standalone browser script and Java auth/email runner).

`features/production/smoke.feature` contains `@smoke @production-safe` scenarios
for public catalog/photos, product details, and shipping/returns. For example,
`Customers can inspect a listed product` opens a catalog link and checks the name
and Generic brand. These are executable Gherkin scenarios, not the old script.

`playwright.production.config.ts` pins `https://outlierfit.shop`, loads only
`production/` step definitions/fixtures, and never imports the staging database
fixture. The fixture blocks non-read-only browser requests; there is no signup,
email verification, cart modification, or test-card payment on live production.
Google Analytics `POST /g/collect` beacons to `https://www.google-analytics.com`
and `https://www.google.com` are aborted without failing the smoke gate, preventing
test page views from reaching analytics. All other writes still abort and fail,
including `POST https://outlierfit.shop/g/collect` and `POST /api/cart`.
Existing staging `@smoke` cases that create accounts or payments are deliberately
not included. The normal/staging config excludes `features/production/` entirely.

The production command generates `.features-gen-production/` and produces separate
`playwright-report-production/` and `test-results-production/junit.xml` reports.
One worker runs with no retries. Only test dependencies are installed on Jenkins;
the promoted application artifact is not rebuilt or modified. Jenkins archives
the reports and rolls the production backend back if this gate fails.
