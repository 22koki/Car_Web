# VELOCITY Motor Co.

### For the love of the drive.

An interactive car showroom with a persistent dealership backend, built with React, TypeScript, Vinext, Cloudflare D1 and R2. The public showroom and staff workspace share the same inventory, enquiry and appointment records.

![VELOCITY editorial car photography](public/images/hero.webp)

## What works

- Cinematic showroom, searchable vehicle collection, brand/body/powertrain/budget filters, saved favourites, and comparisons of up to three cars.
- Interactive concept-car driving scene with play/pause, adjustable pace, day/night lighting and reduced-motion support.
- Vehicle records with actual stock statuses, condition, colour, price, mileage, specifications, features and image galleries.
- Protected **`/admin` dealership workspace** with inventory editing, photo uploads, enquiry management, staff notes, test-drive slots, appointment confirmation and dealership settings.
- Persistent enquiries with server references, retry protection, customer consent and downloadable receipts. A successful response means the record was stored in the dealership inbox.
- Test-drive requests against available slots. A request is confirmed only through the staff booking action; database constraints prevent two confirmed appointments sharing a slot.
- Optional Flutterwave reservation-deposit checkout. The server independently verifies payments and stock before treating a reservation as paid.
- D1 database records, R2 uploaded photos, inventory edit-version checks, bounded request bodies, server authorization, origin checks and API abuse limits.

Parts, accessories and garage services remain the next expansion phase.

## Run locally on Windows

Install **Node.js 22.13 or newer** and Git. From PowerShell:

```powershell
git clone https://github.com/22koki/Car_Web.git
cd Car_Web
npm.cmd ci
npm.cmd run setup
npm.cmd run dev
```

If the repository already exists, run `git pull origin main` inside it before the npm commands. `npm.cmd` avoids PowerShell execution-policy problems with `npm.ps1`.

`npm run setup` creates an ignored `.dev.vars` file with a fresh local secret, builds the app and applies pending database migrations to local D1. It preserves an existing configuration file. The local database is separate from the hosted database.

Open the URL printed by the development server, normally `http://localhost:5173`. Visit **`/admin`** and use **Sign in with ChatGPT**. On a portable loopback development server, the supplied Sites development integration simulates sign-in as `seedy@sites.test`; no real ChatGPT credentials are required for that local simulation. The simulation is absent from production builds.

Use **Load sample vehicles** in the staff workspace to explore the demo inventory, or add your real cars. Sample vehicles remain marked as demonstrations and cannot accept reservation payments.

## The staff workflow

1. Open `/admin` with an account in the configured staff allowlist.
2. Set the dealership's real name, contact details, location and time zone.
3. Add a vehicle, upload photographs of that actual car, complete its specifications and choose its stock status. Keep incomplete listings as drafts.
4. Publish available vehicles to the showroom. Update status when a vehicle is reserved or sold; archive old records to retain their history.
5. Review incoming enquiries, add staff notes and track follow-up status.
6. Add hourly test-drive slots, then confirm a customer's request against an available slot. A confirmation is saved in the system; this release does not send email, WhatsApp or SMS notifications.

The staff page is only a user interface. The API checks staff authorization independently on every protected operation.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run setup` | Create local configuration, build and apply local database migrations. |
| `npm run dev` | Start the development server. |
| `npm run typecheck` | Check TypeScript source. |
| `npm test` | Run catalog, finance, authorization and backend state tests. |
| `npm run build` | Build the full-stack Worker and browser assets. |
| `npm start` | Run the built Worker locally through Wrangler. |
| `npm run db:generate` | Generate a new migration after changing the Drizzle schema. |
| `npm run db:local` | Apply pending migrations to local D1 after building. |

Never rewrite an applied migration. Add a new one and keep the SQL, Drizzle snapshots and journal in Git.

## Hosted deployment

This is now a **full-stack Worker application**, not a static-only export. The existing Sites project is declared in `.openai/hosting.json`; the platform provisions the logical `DB` and `BUCKET` bindings and applies the committed database migrations during deployment.

Hosted authentication is provided by Sites. Staff identities are authorized against the server-side `STAFF_EMAILS` allowlist. Public access and staff access are distinct: making a showroom public does not make visitors staff. The current hosted preview retains its existing private audience.

A standalone production deployment must provide compatible D1/R2 bindings and a trusted authentication layer. Do not expose the Worker directly while trusting user-supplied `oai-authenticated-user-*` headers. Static Netlify or Render hosting alone cannot run this version's backend.

## Runtime configuration

Keep all real secrets out of source, browser code and `.openai/hosting.json`. For local development, use `.dev.vars`; for the hosted Site, use its server environment-variable configuration.

| Variable | Purpose |
| --- | --- |
| `STAFF_EMAILS` | Comma-separated authorized staff email addresses, checked against trusted Sites identities. |
| `PRIVATE_API_KEY` | At least 32 random characters for authorized service access and secure enquiry receipt generation. The setup script creates a fresh local value. |
| `SITE_URL` | The application's canonical origin, used for safe redirects and request checks. |
| `FLW_SECRET_KEY` | Your own Flutterwave merchant secret key; absent until you configure payments. |
| `FLW_WEBHOOK_SECRET` | Your configured Flutterwave webhook secret. |
| `FLW_WEBHOOK_SIGNATURE_MODE` | Signature mode for your merchant integration; see the payment setup notes. |

Use the private service key only from trusted server tools, as `Authorization: Bearer <key>`. On a private hosted Site, the platform's separate service-access credential is also required by its access boundary. Neither key belongs in the browser.

### Activate reservation deposits

Payment processing remains disabled until the merchant credentials are configured and a positive reservation-deposit amount has been explicitly saved in dealership settings. The default deposit is zero. Use your merchant's test environment first; no real charge is required to run the repository's tests.

Configure the gateway webhook endpoint as **`/api/payments/webhook`** on your deployed origin. The application returns the customer to **`/payment`** and checks the recorded transaction with the backend. Redirect parameters are never proof of payment.

The integration uses signature validation plus independent provider verification of the transaction reference, currency, amount and status. A short inventory hold prevents concurrent checkouts for the same car. Mismatched transaction references, amounts, currencies or customer identities are rejected without confirming a reservation. A matching, successful payment received after its stock hold expired, or after availability changed, is marked for dealership review.

The webhook signature mode defaults to `hmac`, validating the raw body with HMAC-SHA256 and the `flutterwave-signature` header. Accounts using Flutterwave's documented v3 `verif-hash` callbacks must explicitly set `FLW_WEBHOOK_SIGNATURE_MODE=legacy-verif-hash`. Confirm the mode emitted by your own merchant account before activation; there is no automatic downgrade. Independent transaction verification is required in both modes. The private preview is not a public webhook destination: complete gateway testing and configure public access deliberately before taking customer deposits.

You still need a verified merchant account and your own credentials. The application never invents bank details or marks an unconfigured payment as successful.

## Customer data and demo records

Enquiry name, email, optional phone, message and requested appointment are stored in the dealership database after consent. Staff notes are protected API data. Saved favourites remain browser-local. Contact information is not written to browser storage. Uploaded photographs are stored as dealership media; use images you have permission to publish.

The included reference cars and their prices/mileage remain sample records. Each example's imagery and specification assumptions are documented. Replace them with verified inventory before representing a listing as real stock.

The finance calculator is an estimate using the chosen deposit, rate and term; it excludes fees, insurance and taxes and is not a lender offer.

## Project map

| Path | Responsibility |
| --- | --- |
| `app/` | Showroom, staff and payment-return routes; server API handlers. |
| `src/App.tsx` | Interactive showroom and live inventory presentation. |
| `src/admin/` | Staff inventory, enquiries, appointment and settings interface. |
| `src/components/` | Vehicle details, comparison, enquiries, finance and payment UI. |
| `server/` | Authorization, input validation, dealership services and payment logic. |
| `db/schema.ts` | Database schema. |
| `drizzle/` | Committed schema migrations and metadata. |
| `src/types/dealership.ts` | Shared request/response domain types. |
| `tests/` | Backend and authorization tests. |
| `src/lib/catalog.test.ts` | Catalog and finance tests. |
| `public/images/`, `public/fonts/` | Bundled photography, concept imagery, fonts and licenses. |
| `scripts/` | Portable setup, build, local migrations and Sites integrations. |

## Sources and credits

- [Vehicle reference specifications](docs/VEHICLE_SOURCES.md)
- [Photography, generated concept image and font credits](docs/IMAGE_CREDITS.md)
- [Browser-readable photo credits](public/credits.html)
- [Flutterwave Standard checkout](https://developer.flutterwave.com/docs/flutterwave-standard-1), [transaction verification](https://developer.flutterwave.com/docs/transaction-verification), [v3 webhook documentation](https://developer.flutterwave.com/docs/webhooks) and [HMAC webhook documentation](https://developer.flutterwave.com/v4.0/docs/webhooks).

Manufacturer names identify reference vehicles; no manufacturer endorsement is implied. Image assets retain their documented licenses.
