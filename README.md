# kyutodaze.com

Vite rebuild of `kyutodaze.com`, now split into a swapped editorial feed/info homepage, a detailed work archive, and a preserved Cargo-style legacy clone.

## Development

```bash
npm install
npm run dev
```

## Checks

```bash
npm test
npm run build
```

## JEJU WAVE RADIO

`/jeju-wave-radio-webapp` loads the bundled app from
`public/apps/jeju-wave-radio/web/`. Its six weather videos are in
`public/apps/jeju-wave-radio/assets/video/`; preserve that layout because the
WebGL renderer reads `../assets/video/`.

The app requests public Open-Meteo weather, marine, and air-quality data in the
visitor's browser. It falls back to its built-in demo values if requests fail,
and starts audio only after the visitor presses `START AUDIO`.

```bash
node --test public/apps/jeju-wave-radio/web/tests/*.test.mjs
```

## Feedback Delivery

The published GitHub Pages build sends feedback automatically to
`gray.ojat@gmail.com` through Formspree at
`https://formspree.io/f/xkodoakr`. This public form address is safe to include
in the static build; never put Gmail passwords, app passwords, SMTP
credentials, or API keys in frontend code or GitHub Actions.

For local development without the Formspree endpoint, the form falls back to
opening the visitor's mail application. Formspree's project settings should
allow `kyutomatte.github.io` while testing the Pages preview, then add
`kyutodaze.com` only after the custom domain is active.

## GitHub Pages Preview

The `main` branch deploys through `.github/workflows/deploy-pages.yml`.
GitHub Pages must be configured to use **GitHub Actions** as its publishing
source. The first build uses the project URL
`https://kyutomatte.github.io/kyutodaze-pages/`; test it before changing DNS.

When the custom domain is ready, rebuild with `VITE_BASE_PATH=/`. Do not change
DNS until direct routes, the Splatify iframe, and an automatic Formspree
feedback email have all been verified.

## Routes

- `/home` or `/` - Sebastian-style editorial homepage with feed on the left and Kyuto information plus Open works on the right
- `/kyutomatte` - detailed profile and work archive
- `/cargo` - preserved Cargo-style clone for reference

## Editable Data

- `public/data/works.xlsx` - editable Works workbook with two sheets:
  - `works` - controls the Overview and Feed work entries
  - `work-media` - controls still-image galleries for work entries
- `public/data/open-works.xlsx` - editable Open Works workbook with six sheets:
  - `open-works` - controls the Open Works list links and short summaries
  - `open-work-details` - controls each Open Works detail page
  - `open-works-page` - controls the Open Works index page title and summary
  - `open-work-links` - controls external pill links on each Open Works detail page
  - `open-work-examples` - controls optional example media sections on Open Works detail pages
  - `open-work-manuals` - controls optional manual sections on Open Works detail pages

CSV files cannot store multiple sheets. Edit the `.xlsx` files in Excel, then export the site CSV files with:

```bash
npm run works:csv
npm run openworks:csv
```

If you edit the Works CSV files directly and want to rebuild the workbook:

```bash
npm run works:xlsx
```

If you edit the Open Works CSV files directly and want to rebuild the workbook:

```bash
npm run openworks:xlsx
```

Check that each workbook and its CSV files match:

```bash
npm run works:check
npm run openworks:check
```

Set `overview` to `true` in the `works` sheet to show an item in Overview. Set it to `false` to keep it Feed-only.

Each `works` row needs a stable `id`. Add still images in the `work-media` sheet by matching that value in `work_id`:

```csv
work_id,type,url,caption,sort
blackpink-go,still,/assets/works/blackpink-go/01-main.jpg,,1
blackpink-go,still,/assets/works/blackpink-go/02.jpg,,2
```

When a work has one or more `still` rows, the Feed shows the first image as the representative image. Clicking it opens the full gallery for the same `work_id`.
