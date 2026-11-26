This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Install dependencies once at the project root and start the Next.js server:

```bash
npm install
npm run dev
```

Next.js serves the UI, catalog, shipping, authentication, and payments on port
3000. No Express process or separate API port is needed. `npm run dev:full`
remains an alias for the same single server. Production uses `npm run build`
followed by `npm start`.

Domestic checkout adds one provisional **$8.95 per order** fee. Change
`DOMESTIC_SHIPPING_FEE_USD` in `lib/domestic-shipping.ts` to adjust it.
This is a merchant-set estimate, not a live USPS quote; larger/farther shipments
may cost more. Item weights remain product data but no longer price delivery.
The single migration `0000000000000_baseline.js` creates the current schema from
`db/schema/baseline.sql`, without product, user, or order data. It includes the
domestic-shipping changes and does not create the retired international rate table.
Run `npm run migrate:up` on an empty database, then import catalog data separately.
Add new incremental migrations for future changes; do not regenerate the baseline
after it has been deployed.

An existing database matching this baseline must be marked as already migrated,
not run through schema creation. After backup and schema comparison, use
`npm run migrate:up -- --fake` once to record the baseline without running its SQL.
Do not use `--fake` on an empty database or to bypass unapplied future migrations.

Browser API calls use `/api/store`, for example `/api/store/products` and
`/api/store/auth/signup`. Existing `/backend/...` URLs are rewritten internally
to these Next routes for compatibility. NextAuth and server-rendered product
titles call the server modules directly, without loopback HTTP.

Configure server-only settings in `.env.local` (never `NEXT_PUBLIC_` secrets):

```bash
PGHOST=localhost
PGPORT=5433
PGUSER=postgres
PGPASSWORD=your-local-database-password
PGDATABASE=clothes
```

OutlierFit's local database runs on the isolated PostgreSQL 17.12 instance at
`localhost:5433`. The older shared PostgreSQL instance remains on port 5432 for
other projects. The pgAdmin entry is `OutlierFit Dev PostgreSQL 17.12`.

The project-root `.env.local` is the only local configuration file. It contains
app, database, Resend, Google, Stripe, storage, proxy and test-account settings.
Next.js, standalone server helpers, Playwright and Java UI tests all use this
file. Process environment variables can still override settings in CI or production.
Nested backend and test env files are no longer read. Keep `.env.local` out of Git.
The `backend/` directory now contains server modules only, not a separate app.
`API_BASE_URL` and `NEXT_PUBLIC_API_BASE_URL` are no longer used by the app.

When upgrading an existing PM2 deployment, remove its old process once with
`pm2 delete project888-api`, then deploy only `project888-web` using the updated
Jenkins pipeline and ecosystem configuration.

## Cloud Deployment

The new VMs use Nginx and two systemd-managed Next.js ports (3001/3002), rather
than running the application in the Jenkins workspace. Jenkins checks out
`codex/deployment` and builds the release on the build VM.
The staging job polls that branch every five minutes, so Jenkins need not expose
an unauthenticated public webhook endpoint.

- `Jenkinsfile.staging`: checkout; build/migrate/package; blue-green deployment;
  health check; Playwright regression (UI and API); publish
  the verified artifact; finalize; optionally trigger production.
- `Jenkinsfile`: promote the exact staging-tested commit and checksum-verified
  artifact; migrate production; deploy; health check; tagged Playwright smoke
  features against production; finalize. Failure rolls back the app backend.
- `Jenkinsfile.staging.full-tests`: manually run the same staging Playwright
  regression gate without deployment or promotion.

Staging's post-deployment test gate runs only Playwright `@regression` cases,
excluding `@dev-only` mock checkout. It includes real email and Stripe test-mode
flows and runs on Jenkins against `https://staging.outlierfit.shop`. Ordinary UI
scenarios run in parallel with up to three workers. Email/payment scenarios, API
tests, and support checks each use a separate single-worker project, with a total
limit of three workers across the run. The combined report includes each test once.
The old standalone UI smoke and Java auth runners no longer run in staging jobs.
Build-time Node unit checks are unchanged. Production uses the separate
`playwright.production.config.ts` and `features/production/smoke.feature`.
Jenkins selects `@smoke` feature scenarios against `https://outlierfit.shop`,
covering catalog/photos, product details, and shipping/returns. The config loads
only production-safe steps, without DB fixtures or email/payment credentials;
its browser fixture blocks state-changing requests. Existing signup/payment smoke
tags remain available for staging, not live production. The standalone smoke
script and Java auth/email smoke runner have been removed from deployment.
Production reports are archived under `playwright-report-production/` and
`test-results-production/`, with JUnit results visible in the Jenkins build.
`scripts/deploy/ci.sh staging regression` installs the test package, opens a
temporary private DB tunnel, and calls `scripts/deploy/playwright-regression.mjs`.
The runner reads only staging and CI secrets, requires `outlierfit_staging` and a
test-mode Stripe key, enables mail/payment cases, and disables local proxy settings.
The Jenkins VM must have Chrome installed; Gmail OAuth settings remain in
`outlierfit-ci-env`, not committed files. Staging's configured Stripe webhook must
deliver real test events to that staging app.

Jenkins publishes JUnit results under each build's **Test Result** and archives
`playwright-tests/playwright-report/` plus failure artifacts under **Artifacts**.
Those artifacts can contain test-account links and must remain authenticated.
Failed regression stops artifact publication/promotion and rolls staging back.
For example, the manual suite can be rerun through its existing Jenkins job, but
it still shares staging's public IP rate limits; do not overlap it with a deploy.

Jenkins is available at https://jenkins.outlierfit.shop while its VM is running.
Sign in with the existing private Jenkins account, then open, for example,
`/job/outlierfit-staging/3/console` to inspect that build's output.
Nginx terminates HTTPS; Jenkins itself remains on `127.0.0.1:8080`.
Anonymous access is disabled, login submissions are rate limited, and the public
HTTP CLI is blocked. `scripts/deploy/setup-jenkins-web.sh` installs the gateway
from `scripts/deploy/jenkins-nginx.conf`; its Cloudflare DNS credential stays
root-only and outside the repository. The reserved Jenkins IP keeps DNS stable
across VM restarts. The link is unavailable when the Jenkins VM is stopped.
Its DNS A record points to `34.170.47.211`, reserved as `outlierfit-jenkins-ip`
in `us-central1`. The `outlierfit-jenkins-https` firewall rule exposes only ports
80/443 on the Jenkins VM; it does not expose the controller's port 8080.

For example, a release is stored in `/opt/outlierfit/releases/<commit SHA>`.
Nginx switches to its inactive port only after the catalog endpoint is healthy;
the old backend remains running until smoke tests pass. Failures restore the
previous application backend. Database migrations are **not** automatically
reversed: future migrations must remain compatible with the previous release.

Environment credentials come from the `outlierfit-staging-env`,
`outlierfit-production-env`, and `outlierfit-ci-env` Secret Manager secrets.
Runtime identities can read only their own environment and private image bucket.
The root-only certificate credential is separate from application secrets.
Never commit `.env.local`, `.local/`, admin credentials, or private SSH keys.

Staging uses **Stripe test mode**; production uses its separate **live-mode**
API key and webhook signing secret in `outlierfit-production-env`. Catalog data
and registered product photos are imported once, independently of schema
migrations; redeployments do not reset inventory or copy dev users/orders.

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Sitemap

`npm run build` runs `next-sitemap` after building the app. The sitemap includes
public pages and one URL per product returned by the storefront catalog, for
example product ID `13` becomes `https://outlierfit.shop/products/13`. Account,
authentication, cart, checkout, admin, and API routes are excluded. Product names
are not used as URL slugs. The generator needs the normal PostgreSQL settings
and closes its build-time connection; a failed catalog query fails generation
instead of silently omitting all products. No running HTTP app is required.

Generated `public/sitemap*.xml` and `public/robots.txt` remain gitignored build
artifacts. Rebuild and deploy to update the public sitemap, then resubmit
`https://outlierfit.shop/sitemap.xml` in Search Console. Removing a URL from the
sitemap is not an authentication or deindexing mechanism; existing route guards
remain unchanged.

## Private Product Photos

The Next.js server reads catalog photos from a private Google Cloud Storage bucket
using Application Default Credentials. Configure these server-only variables in
`.env.local` for development:

```bash
GOOGLE_CLOUD_PROJECT=outlierfit
PRODUCT_IMAGES_BUCKET=outlierfit-dev
GOOGLE_APPLICATION_CREDENTIALS=/Users/Mark_1/project888/.local/outlierfit-storage-adc.json
```

The local credential file uses service-account impersonation and is gitignored.
The `dev-product-images@outlierfit.iam.gserviceaccount.com` account has Object
Viewer access on the development bucket. The developer account needs Service
Account Token Creator permission on that service account.

When a local VPN requires an explicit HTTP proxy, set `HTTPS_PROXY` and
`HTTP_PROXY` to its address in `.env.local`, with
`NO_PROXY=localhost,127.0.0.1,::1`. For example, the current local VPN exposes
`http://127.0.0.1:59527`. Its port may change after reconnecting. Run
`scutil --proxy` outside a sandbox to read the current HTTPS proxy host and port.

For example, a `product_variant_images.image_link` value of
`/api/product-images/FB7909-010/front.webp` serves the bucket object
`gs://outlierfit-dev/products/FB7909-010/front.webp`. The route exposes only
database-registered raster photos. Catalog photos are viewable through the app,
while direct anonymous bucket access stays blocked.

For deployment, set `PRODUCT_IMAGES_BUCKET` to the intended bucket and grant the
runtime identity Object Viewer access there. Google-hosted runtimes can use their
attached service account through ADC.

## Email Verification

Email verification and password reset run inside Next.js and send through Resend.

Required server-only environment variables:

```bash
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=onboarding@your-domain.com
CLIENT_ORIGIN=http://localhost:3000
```

Optional server-only environment variables:

```bash
EMAIL_VERIFICATION_APP_URL=http://localhost:3000
EMAIL_VERIFICATION_TTL_HOURS=24
```

Notes:

- `CLIENT_ORIGIN` is the default base URL for verification and reset links; no separate CORS setup is needed.
- `EMAIL_VERIFICATION_APP_URL` overrides the link target if you want emails to point somewhere else.
- New signups must verify their email before they can log in.
- Moving to one server does not repair an invalid Resend key. A valid key and verified sender are still required.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


Notes for this project(Only visible to myself, the developer)

https://docs.google.com/document/d/1DHpEzztZBd8EhRBhO4K2jrpKekXwEouzXqEK2Xs3XGY/edit?tab=t.0
