# VELOCITY Motor Co.

### For the love of the drive.

A cinematic car showroom built with **React, TypeScript and Vite**. Dark automotive photography, electric lime accents and oversized typography set the scene; practical discovery tools help visitors find their next favourite car.

This is the first release of **Car_Web**: cars first, with space to grow into parts, accessories and garage services.

![Porsche Panamera in motion — VELOCITY's editorial hero photograph](public/images/hero.webp)

## The experience

| Feature | What works |
| --- | --- |
| Cinematic landing page | Editorial car photography, selectable hero slides, animated entrances and collection navigation. |
| Interactive driving scene | Play/pause, three animation speeds, day/night lighting, and automatic pause when the scene leaves the viewport. |
| Vehicle discovery | Search by make, model, year, colour and other details; filter by brand, body type, powertrain, budget and saved cars. |
| Sorting | Curated picks, price ascending/descending, newest year and lowest mileage. |
| Vehicle details | Representative photography, price, colour, model year, mileage, transmission, drivetrain, engine, seats, performance figures and features. |
| Your shortlist | Heart a car to save it in the current browser. Compare up to three vehicles side by side. |
| Find my match | Choose a driving style and budget to narrow the collection. |
| Finance exploration | Adjustable deposit, term and annual interest rate with amortized monthly payment and total-cost breakdown. Zero-interest calculations are supported. |
| Enquiry drafts | Validate contact details, select a request type and preferred date, then prepare and download a text enquiry. |
| Responsive interaction | Mobile navigation, keyboard-operable controls, native modal dialogs, visible focus states and reduced-motion support. |

### What this release represents

The inventory is a **demonstration collection**, not actual dealership stock. Asking prices, mileage, colours and availability are illustrative. Vehicle photography shows reference cars; the exact trim, year or equipment can differ from the sample entry. Each detail view includes the relevant context.

The enquiry flow prepares a downloadable draft. It **does not send a lead, book a test drive, reserve a car or accept a payment**. Contact details remain in the open dialog's memory and are not stored in browser storage or sent to a server. Only saved vehicle IDs persist locally.

Finance figures are fixed-rate estimates with monthly repayments. They exclude fees, insurance and taxes and are not lender offers or approvals.

## Run locally

Requirements: **Node.js 22.12 or newer**, npm and Git.

```bash
git clone https://github.com/22koki/Car_Web.git
cd Car_Web
npm ci
npm run dev
```

Open the development URL printed in the terminal. No database, API keys or environment variables are required for the current release.

On Windows PowerShell, if execution policy blocks `npm.ps1`, use `npm.cmd` in the same commands, for example `npm.cmd ci` and `npm.cmd run dev`.

### Project commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run typecheck` | Check all TypeScript source files. |
| `npm test` | Run the catalog and finance calculation tests. |
| `npm run build` | Type-check and generate the production site in `dist/`. |
| `npm run preview` | Serve the production build locally after building. |

Before publishing changes:

```bash
npm test
npm run build
```

The tests cover combined searching/filtering, inclusive budgets, saved-only results, non-mutating sorting, readable price/mileage formatting, an independent amortization example, zero-interest financing, full deposits and invalid inputs.

## Make it your dealership

### Add real inventory

Edit [`src/data/cars.ts`](src/data/cars.ts). Each `Car` record contains the visible listing content and image paths. Keep the `id` stable so saved cars remain recognizable across updates.

```ts
{
  id: 'your-unique-car-id',
  brand: 'Porsche',
  model: '911 GT3',
  year: 2023,
  price: 28900000,              // Kenyan shillings
  bodyType: 'Coupe',
  fuel: 'Petrol',
  mileage: 4200,                // Kilometres
  color: 'Your verified colour',
  colorHex: '#303030',
  image: '/images/your-car.webp',
  gallery: [
    '/images/your-car.webp',
    '/images/your-car-interior.webp',
  ],
  // Complete the remaining fields using the existing records as a template.
}
```

Place photographs in [`public/images`](public/images). Use photographs of the **same actual vehicle** for its gallery, provide meaningful `imageAlt` text, and keep image rights/credits with the project. Match body type and fuel values to the exported TypeScript types. Power is metric horsepower (**PS**), acceleration is **0–100 km/h in seconds**, and top speed is **km/h**; use `null` when a performance figure is not verified.

The current `heroCars` selection in [`src/App.tsx`](src/App.tsx) references specific inventory entries. Update that selection when reorganizing or replacing the collection. The first hero image is separate editorial photography and should keep an accurate caption.

### Change the brand and design

| Edit | Location |
| --- | --- |
| Brand name, navigation, landing-page copy, hero selection and section content | [`src/App.tsx`](src/App.tsx) |
| Site colours, typography, layouts and driving animation | [`src/styles.css`](src/styles.css) |
| Shared modal branding | [`src/components/Modal.tsx`](src/components/Modal.tsx) |
| Enquiry draft branding and form flow | [`src/components/EnquiryDialog.tsx`](src/components/EnquiryDialog.tsx) |
| Detail, comparison and calculator styling | [`src/components/overlays.css`](src/components/overlays.css) |
| Browser title, description and social metadata | [`index.html`](index.html) |
| Browser icon | [`public/favicon.svg`](public/favicon.svg) |
| Currency formatting and catalog behaviour | [`src/lib/catalog.ts`](src/lib/catalog.ts) |

The main theme uses `--ink`, `--paper` and `--lime` CSS variables. Overlay styles use their own `--ov-*` variables so both surfaces can be adjusted together. Fonts and imagery are served from the project, including their source/license information.

### Connect real customer enquiries

The current form is deliberately a local draft flow. For a live dealership, add a server endpoint or suitable form service and connect `prepareEnquiry` in `EnquiryDialog.tsx` to it. Keep server credentials out of the frontend; validate submissions on the server, store them appropriately, and confirm success only after the service accepts the request.

Replace the concept/sample wording only after real inventory, photographs, dealership contact details and lead delivery are configured. A real booking flow should also check the dealer's available dates before confirming an appointment.

## Deploy

This release is a static frontend. Deploy the generated **`dist/`** folder at the root of a domain or subdomain.

### Netlify

Import the GitHub repository. The included [`netlify.toml`](netlify.toml) sets:

- Build command: `npm run build`
- Publish directory: `dist`
- Node version: `22`

### Render

Create a **Static Site** connected to the repository:

- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- Use Node.js 22.12 or newer.

The app currently uses in-page navigation, so it does not need a client-side route rewrite. Asset paths such as `/images/...` and `/fonts/...` assume a domain root. For GitHub Pages under `/Car_Web/` or another subdirectory, first make those asset paths respect the deployment base; changing Vite's `base` alone does not rewrite hardcoded image URLs in the inventory or CSS.

## Code map

| Path | Responsibility |
| --- | --- |
| `src/App.tsx` | Main showroom, discovery controls, saved cars, comparison selection, match finder and driving scene. |
| `src/data/cars.ts` | Typed demonstration inventory. |
| `src/lib/catalog.ts` | Pure filtering, sorting, currency/mileage formatting and finance calculations. |
| `src/lib/catalog.test.ts` | Domain tests using Node's built-in test runner. |
| `src/components/Modal.tsx` | Native dialog, focus restoration and dismissal. |
| `src/components/VehicleDetails.tsx` | Vehicle gallery, full details and enquiry actions. |
| `src/components/CompareDialog.tsx` | Side-by-side comparison table. |
| `src/components/FinanceCalculator.tsx` | Interactive payment estimates. |
| `src/components/EnquiryDialog.tsx` | Validated local enquiry preparation and download. |
| `public/images/` | Bundled automotive and editorial imagery. |
| `public/fonts/` | Self-hosted fonts and license files. |
| `public/credits.html` | Published photography credits. |

## Next chapters

The interface introduces these later phases without pretending they are already available:

1. **Live dealership operations:** real inventory management, actual stock status, authenticated staff tools, lead delivery and verified test-drive availability.
2. **Parts and accessories:** category browsing, vehicle compatibility, inventory, cart and checkout.
3. **Garage and care:** service packages, garage information, available appointment slots and booking management.

## Sources and image credits

- [Vehicle reference specifications and model-year assumptions](docs/VEHICLE_SOURCES.md)
- [Photograph sources, creators, licenses and display guidance](docs/IMAGE_CREDITS.md)
- [Published photo credits](public/credits.html)

Manufacturer names are used to identify reference vehicles. No manufacturer endorsement is implied. Image assets retain their documented licenses; preserve required attribution and applicable share-alike terms when reusing them.
