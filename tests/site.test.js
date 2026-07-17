import { readFile } from "node:fs/promises";
import { statSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";

async function importProjectModule(path) {
  return import(new URL(`../${path}`, import.meta.url));
}

async function readProjectFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

async function readProjectBytes(path) {
  return readFile(new URL(`../${path}`, import.meta.url));
}

test("favicon uses a large transparent PNG", async () => {
  const html = await readProjectFile("index.html");

  assert.match(html, /<link rel="icon" type="image\/png" href="\/assets\/favicon\.png" \/>/);

  const { data, info } = await sharp(await readProjectBytes("public/assets/favicon.png"))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] === 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  assert.equal(info.width, 512);
  assert.equal(info.height, 512);
  assert.equal(data[3], 0);
  assert.ok(Math.max(maxX - minX + 1, maxY - minY + 1) >= 430);
  assert.ok(Math.min(maxX - minX + 1, maxY - minY + 1) >= 320);
});

test('site URL helpers preserve routes and assets below a GitHub Pages project base', async () => {
  const siteUrl = await importProjectModule('src/site-url.js');

  assert.equal(siteUrl.toSitePath('/home', '/kyutodaze.com/'), '/kyutodaze.com/home');
  assert.equal(siteUrl.toSitePath('/', '/kyutodaze.com/'), '/kyutodaze.com/');
  assert.equal(siteUrl.fromSitePath('/kyutodaze.com/home', '/kyutodaze.com/'), '/home');
  assert.equal(siteUrl.fromSitePath('/unrelated/home', '/kyutodaze.com/'), '/unrelated/home');
  assert.equal(siteUrl.toPublicAssetUrl('/data/works.csv', '/kyutodaze.com/'), '/kyutodaze.com/data/works.csv');
});

test('Jeju Wave Radio is served as a local static web app', async () => {
  const html = await readProjectFile('index.html');
  const js = await readProjectFile('src/main.js');
  const appHtml = await readProjectFile('public/apps/jeju-wave-radio/web/index.html');
  const renderer = await readProjectFile('public/apps/jeju-wave-radio/web/src/renderer.js');
  const videos = [
    'sunny_day.mp4',
    'sunny_night.mp4',
    'cloudy_day.mp4',
    'cloudy_night.mp4',
    'rainy_day.mp4',
    'rainy_night.mp4',
  ];

  assert.match(html, /data-jeju-wave-radio-frame/);
  assert.match(html, /title="JEJU WAVE RADIO web app"/);
  assert.match(html, /data-jeju-wave-radio-frame[^>]*allow="autoplay"/);
  assert.match(js, /const JEJU_WAVE_RADIO_WEBAPP_PATH = "\/apps\/jeju-wave-radio\/web\/"/);
  assert.match(js, /toPublicAssetUrl\(JEJU_WAVE_RADIO_WEBAPP_PATH\)/);
  assert.match(js, /data-jeju-wave-radio-frame/);
  assert.match(renderer, /\.\.\/assets\/video\/\$\{state\}\.mp4/);
  assert.match(appHtml, /id="start-audio"/);
  assert.match(appHtml, /id="refresh-live-data"/);

  videos.forEach((file) => {
    assert.ok(
      statSync(new URL(`../public/apps/jeju-wave-radio/assets/video/${file}`, import.meta.url)).isFile(),
      `expected local Jeju video ${file}`,
    );
  });
});

test('portfolio runtime resolves data, navigation, and Formspree feedback without a root-path assumption', async () => {
  const js = await readProjectFile('src/main.js');

  assert.match(js, /fromSitePath, toPublicAssetUrl, toSitePath/);
  assert.match(js, /new URL\(toPublicAssetUrl\(path\), window\.location\.origin\)/);
  assert.match(js, /window\.history\.pushState\(\{\}, "", `\$\{toSitePath\(nextPath\)\}/);
  assert.match(js, /"Accept": "application\/json"/);
  assert.match(js, /https:\/\/kyutomatte\.github\.io\/splatify-pre-release\//);
});

test('Pages route entry generation includes fixed routes, CSV slugs, and aliases', async () => {
  const routeEntries = await importProjectModule('scripts/create-pages-route-entries.js');
  const entries = routeEntries.collectRouteDirectories('title,slug\nSPLATIFY,/splatify\nVISUALS,/interactive-visuals\n');

  assert.deepEqual(entries, [
    'home',
    'kyutomatte',
    'cargo',
    'open-works',
    'jeju-wave-radio-webapp',
    'splatify-webapp',
    'splatify-webapp-export',
    'feedback',
    'splatify',
    'interactive-visuals',
    'touch-designer'
  ]);
});

test('Pages workflow deploys the main branch from the custom-domain root with the Formspree endpoint', async () => {
  const workflow = await readProjectFile('.github/workflows/deploy-pages.yml');

  assert.match(workflow, /branches:\s*\[main\]/);
  assert.match(workflow, /VITE_BASE_PATH=\/\s+VITE_FEEDBACK_ENDPOINT/);
  assert.match(workflow, /VITE_FEEDBACK_ENDPOINT=https:\/\/formspree\.io\/f\/xkodoakr/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
});

const ojatLookbook2020Files = [
  "01-main.jpeg",
  "02-img-5070.jpeg",
  "03-img-5071.jpeg",
  "04-img-5073.jpeg",
  "05-img-5075.jpeg",
  "06-img-5077.jpeg",
  "07-img-5078.jpeg",
  "08-img-5080.jpeg",
  "09-img-5081.jpeg",
  "10-img-5082.jpeg",
  "11-img-5083.jpeg",
  "12-img-5086.jpeg",
  "13-img-5088.jpeg",
  "14-img-5089.jpeg",
  "15-img-5090.jpeg",
  "16-img-5091.jpeg",
  "17-img-5093.jpeg",
  "18-img-5094.jpeg",
  "19-img-5097.jpeg",
  "20-img-5098.jpeg",
  "21-img-5099.jpeg",
  "22-img-5100.jpeg",
  "23-img-5101.jpeg",
  "24-img-5103.jpeg",
  "25-img-5105.jpeg",
  "26-img-5106.jpeg",
  "27-img-5107.jpeg",
  "28-img-5108.jpeg",
  "29-img-5109.jpeg",
  "30-img-5110.jpeg",
  "31-img-5111.jpeg",
  "32-img-5113.jpeg",
  "33-img-5114.jpeg",
  "34-img-5115.jpeg",
  "35-img-5116.jpeg",
  "36-img-5118.jpeg",
  "37-img-5119.jpeg",
  "38-img-5120.jpeg",
  "39-img-5121.jpeg",
  "40-img-5122.jpeg"
];

const ojatLookbook2020EditorialFiles = [
  "01-main.jpeg",
  "02-duo-eclipse.jpeg",
  "03-future-distopia-1836.jpeg",
  "04-future-distopia-1937.jpeg",
  "05-future-distopia-2183.jpeg",
  "06-future-distopia-2233.jpeg",
  "07-white-duo-1.jpeg",
  "08-white-duo-2.jpeg"
];

const ojatMagazineYunwhayFiles = [
  "01-img-0243.jpg",
  "02-img-0244.jpg",
  "03-img-0245.jpg",
  "04-img-0246.jpg",
  "05-img-0247.jpg",
  "06-img-0248.jpg",
  "07-img-0250.jpg",
  "08-img-0252.jpg",
  "09-img-0254.jpg",
  "10-img-0257.jpg"
];

const ojatMagazinePapFiles = [
  "01-main.jpeg",
  "02-img-0480.jpeg",
  "03-img-0481.jpeg",
  "04-img-0482.jpeg",
  "05-img-0483.jpeg",
  "06-img-0484.jpeg",
  "07-img-0485.jpeg",
  "08-img-0486.jpeg",
  "09-img-0487.jpeg",
  "10-img-0488.jpeg",
  "11-img-0490.jpeg",
  "12-img-0491.jpeg",
  "13-img-0492.jpeg",
  "14-img-0493.jpeg",
  "15-img-0494.jpeg",
  "16-img-0495.jpeg"
];

const ojatMagazineBabyyanaFiles = [
  "01-main.jpg",
  "02-img-0293.jpeg"
];

const ojatMagazineChorongFiles = [
  "01-main.jpg",
  "02-img-0688.jpeg"
];

const ojatMagazineSchonFiles = [
  "01-main.jpg",
  "02-walk.jpg",
  "03-standing.jpg"
];

const ojatMagazineNainFiles = [
  "01-main.jpeg",
  "02-img-1322.jpeg",
  "03-img-1323.jpeg",
  "04-img-1325.jpeg",
  "05-img-1326.jpeg",
  "06-img-1327.jpeg",
  "07-img-1328.jpeg",
  "08-img-1329.jpeg"
];

const ojatMagazineYenaFiles = [
  "01-main.jpg"
];

const ojatMagazineUggFiles = [
  "01-main.jpg",
  "02-pink-recline.jpg",
  "03-white-look.jpg",
  "04-pink-crop.jpg",
  "05-green-look.jpg",
  "06-black-sandals.jpg",
  "07-pink-sole.jpg"
];

const vfx2025XgFiles = [
  "01-main.mov",
  "01-main.png",
  "02-close-black.png",
  "03-crystal-close.png",
  "04-crystal-wide.png"
];

const vfx2025AesopFiles = [
  "01-main.mp4",
  "01-aesop-sign.png",
  "02-aesop-display.png"
];

const vfx2026LunarNewYearFiles = [
  "01-main.mp4",
  "01-horse-closeup.png",
  "02-horse-title.png",
  "03-rose-garden.png",
  "04-side-profile-roses.png",
  "05-title-card.png"
];

const vfx2025KiiiKiiiFiles = [
  "01-main.mp4",
  "01-main.png",
  "02-floral-splash.png",
  "03-water-splash.png",
  "04-blackberry-closeup.png",
  "05-white-object.png",
  "06-cloud-fruit.png",
  "07-dragonfruit-closeup.png",
  "08-flower-cloud.png"
];

const vfx2025NikeFiles = [
  "01-main.mp4",
  "01-lake-opening.png",
  "02-grass-detail.png",
  "03-lakeside-box.png",
  "04-nike-box-logo.png",
  "05-nike-box-top.png"
];

const vfx2025VivienneFiles = [
  "01-main.mp4",
  "01-main.png",
  "02-blue-forest-light.png",
  "03-teal-forest.png",
  "04-orange-forest-lights.png",
  "05-red-forest-glow.png"
];

const ohirBrandFilmFiles = [
  "01-main.mp4",
  "01-white-flowers.png",
  "02-glass-droplet.png",
  "03-glass-flower-device.png",
  "04-toner-bottle.png",
  "05-lab-apparatus.png",
  "06-ampoule-bottle.png",
  "07-cream-jar.png",
  "08-brand-logo-flower.png"
];

const vfx2026ShowreelFiles = [
  "01-main.mp4",
  "01-full-ai-blue.png",
  "02-kyuto-eye.png",
  "03-flower-face.png",
  "04-red-kyuto.png",
  "05-glass-orbs.png",
  "06-organic-eye.png"
];

const vfx2026VideoOnlyFiles = [
  "vfx-2026-bangbang/01-main.mp4",
  "vfx-2026-lesserafim/01-main.mp4",
  "vfx-2026-iyodrama/01-main.mp4",
  "vfx-2026-cortis-redred/01-main.mp4",
  "vfx-2026-newjeans/01-main.mp4"
];

test("home page exposes the swapped Sebastian-style feed and info layout", async () => {
  const html = await readProjectFile("index.html");
  const js = await readProjectFile("src/main.js");
  const css = await readProjectFile("src/styles.css");

  assert.match(html, /KYUTO\.MATTE/);
  assert.match(html, /id="top"/);
  assert.match(html, /data-work-view="summary"/);
  assert.match(html, /data-works-list/);
  assert.match(html, /data-open-works-list/);
  assert.match(html, /data-gallery-lightbox/);
  assert.match(html, /data-gallery-video/);
  assert.match(html, /data-route="home"/);
  assert.match(html, /home-shell/);
  assert.match(html, /home-feed-panel/);
  assert.match(html, /home-info-panel/);
  assert.doesNotMatch(html, /class="home-webgl-hero"/);
  assert.doesNotMatch(html, /data-hero-webgl/);
  assert.match(html, /work-view-switch/);
  assert.match(html, /data-view-toggle="summary"/);
  assert.match(html, /data-view-toggle="overview"/);
  assert.doesNotMatch(html, /data-view-toggle="feed"/);
  assert.match(html, /data-view-toggle="summary" aria-pressed="true"[\s\S]*work-view-icon-list[\s\S]*Summary[\s\S]*data-view-toggle="overview" aria-pressed="false"[\s\S]*work-view-icon-grid[\s\S]*Overview/);
  assert.doesNotMatch(html, /☷|▦/);
  assert.match(html, /category-filter/);
  assert.match(html, /data-category-filter="mv"/);
  assert.match(html, /data-category-filter="album"/);
  assert.match(html, /data-category-filter="graphic"/);
  assert.match(html, /data-category-filter="ai3d"/);
  assert.match(html, /data-category-filter="fashion"/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /KYUTO-LOGO\.png/);
  assert.match(html, /class="logo-mark"/);
  assert.match(html, /class="logo-mark"[\s\S]*data-home-reset/);
  assert.match(html, /<span class="contact-link contact-link-static" aria-label="Email address">gray\.ojat@gmail\.com<\/span>/);
  assert.doesNotMatch(html, /<a class="contact-link" href="mailto:gray\.ojat@gmail\.com">/);
  assert.match(html, /aria-label="Reset home view"/);
  assert.doesNotMatch(html, /class="logo-link"/);
  assert.match(html, /class="top-link"/);
  assert.match(html, />Top</);
  assert.match(html, /Information/);
  assert.match(html, /Overview/);
  assert.doesNotMatch(html, />Feed</);
  assert.match(html, /Open works/);
  assert.match(html, /class="open-works-heading-link" href="%BASE_URL%open-works"/);
  assert.match(html, /Loading works/);
  assert.match(html, /Loading open works/);
  assert.doesNotMatch(html, /Press/);
  assert.doesNotMatch(html, /kyuto-hongkong-hero\.png/);
  assert.doesNotMatch(html, /home-hero/);
  assert.doesNotMatch(html, /Hero thumbnail/);
  assert.match(html, /서울을 기반으로 아티스트와 브랜드를 위한 비주얼 크리에이티브 작업을 합니다/);
  assert.match(html, /Kyuto is a Seoul-based visual creative/i);
  assert.match(css, /\.info-section h1\s*\{[^}]*font-weight:\s*900;[^}]*letter-spacing:\s*-0\.035em;/s);
  assert.match(css, /\.info-lede\s*\{[^}]*font-weight:\s*690;[^}]*text-wrap:\s*balance;/s);
  assert.match(css, /\.info-detail\s*\{[^}]*word-break:\s*keep-all;[^}]*text-wrap:\s*pretty;/s);
  assert.doesNotMatch(html, /Kyuto creates atmospheric images/i);
  assert.doesNotMatch(html, /He works across artist visuals/i);
  assert.doesNotMatch(html, /We make/);
  assert.doesNotMatch(html, /We build/);
  assert.doesNotMatch(html, /Our motion/);
  assert.match(js, /cargo/);
  assert.match(js, /fetchCsv\("\/data\/works\.csv"\)/);
  assert.match(js, /fetchCsv\("\/data\/open-works\.csv"\)/);
  assert.match(js, /fetchCsv\("\/data\/work-media\.csv"\)/);
  assert.match(js, /const DATA_CACHE_VERSION = "2026-07-17-works-order"/);
  assert.match(js, /url\.searchParams\.set\("v", DATA_CACHE_VERSION\)/);
  assert.match(js, /parseCsv/);
  assert.match(js, /getYouTubeEmbedUrl/);
  assert.match(js, /normalizeMediaUrl/);
  assert.match(js, /renderGalleryTrigger/);
  assert.match(js, /openGallery/);
  assert.match(js, /type === "still" \|\| type === "video"/);
  assert.match(js, /item\.type === "video"/);
  assert.match(js, /item\.type === "still"/);
  assert.match(js, /url\.pathname === "\/watch"/);
  assert.match(js, /data-overview-featured/);
  assert.match(js, /renderWorks/);
  assert.match(js, /renderOpenWorks/);
  assert.match(js, /setWorkView/);
  assert.match(js, /scrollTo/);
  assert.match(js, /renderSummaryWorkRows/);
  assert.match(js, /renderSummaryWorkRows\(group\.items,\s*mediaByWorkId\)/);
  assert.match(js, /summary-detail-media/);
  assert.match(js, /renderMedia\(work,\s*mediaByWorkId\)/);
  assert.match(js, /renderSummaryGroups/);
  assert.match(js, /renderOverviewGrid/);
  assert.match(js, /OVERVIEW_MEDIA_LIMIT\s*=\s*3/);
  assert.match(js, /shuffleOverviewItems/);
  assert.match(js, /getOverviewItemsForWork/);
  assert.match(js, /getOverviewStillItems/);
  assert.match(js, /function isOverviewWork\(work\)/);
  assert.match(js, /\.filter\(\(work\) => isOverviewWork\(work\)\)/);
  assert.match(js, /for \(let index = 0; index < OVERVIEW_MEDIA_LIMIT; index \+= 1\)/);
  assert.match(js, /const stillItems = getOverviewStillItems\(works,\s*mediaByWorkId\)/);
  assert.match(js, /setCategoryFilter/);
  assert.match(js, /resetHomeView/);
  assert.match(js, /currentCategoryFilter = "all"/);
  assert.match(js, /data-home-reset/);
  assert.match(js, /setActiveSummaryArtist/);
  assert.match(js, /smoothScrollToWorks/);
  assert.match(js, /function smoothScrollToWorks\(\)\s*\{[^}]*window\.scrollTo\(\{\s*top:\s*0,\s*behavior:\s*"smooth"\s*\}\)/s);
  assert.doesNotMatch(js, /function smoothScrollToWorks\(\)\s*\{[^}]*scrollIntoView/s);
  assert.match(js, /getCategoryKey/);
  assert.match(js, /getArtistSummaryLabel/);
  assert.match(js, /value\.includes\("fashion"\)/);
  assert.match(js, /categoryKeys\.some\(\(key\) => key === "mv" \|\| key === "fashion"\)/);
  assert.match(js, /categoryLabelByKey/);
  assert.match(js, /getArtistYearRange/);
  assert.match(js, /setWorkView\("summary"/);
  assert.match(js, /data-summary-artist/);
  assert.match(js, /data-summary-group/);
  assert.match(js, /summary-detail-list/);
  assert.match(js, /data-category-filter/);
  assert.match(js, /extractEmbeddableUrl/);
  assert.doesNotMatch(js, /data-view-panel="feed"/);
  assert.match(js, /data-gallery-work-id/);
  assert.match(js, /function restoreSheetLeadingQuote\(value\)/);
  assert.match(js, /if \(\/\^\[‘’'“”\]\/\.test\(text\)\) return text;/);
  assert.match(js, /restoreSheetLeadingQuote\(work\.text\)/);
  assert.match(js, /function isAppRoutePath\(pathname\)/);
  assert.match(js, /!isAppRoutePath\(url\.pathname\)/);
  assert.match(js, /safeUrl\.startsWith\("\/assets\/downloads\/"\)\s*\?\s*" download"/);
  assert.doesNotMatch(html, /data-open-work-media-card/);
  assert.doesNotMatch(js, /renderOpenWorkMediaCard/);
  assert.match(js, /classList\.toggle\("has-open-work-media",\s*Boolean\(work\.imageUrl\)\)/);
  assert.doesNotMatch(js, /classList\.add\("has-open-work-media"\)/);
});

test("mixed-media galleries use a video first-frame trigger and still-only overview candidates", async () => {
  const js = await readProjectFile("src/main.js");

  assert.match(js, /function getGalleryTriggerMedia\(firstItem, alt\)/);
  assert.match(js, /import \{ getMediaPreviewUrl \} from "\.\/media-preview\.js";/);
  assert.match(js, /const previewUrl = getMediaPreviewUrl\(firstItem\.url\);/);
  assert.match(js, /<img src="\$\{escapeHtml\(previewUrl\)\}" alt="\$\{alt\}" loading="lazy"/);
  assert.doesNotMatch(js, /<video src="\$\{escapeHtml\(firstItem\.url\)\}" muted playsinline preload="metadata"><\/video>/);
  assert.match(
    js,
    /function getOverviewItemsForWork\(work, mediaByWorkId\)\s*\{[\s\S]*?filter\(\(item\) => item\.type === "still"\)/
  );
  assert.match(js, /activeGalleryItems = items;/);
});

test("every video gallery starts at media 01 and video triggers share thumbnail sizing", async () => {
  const workMedia = await readProjectFile("public/data/work-media.csv");
  const css = await readProjectFile("src/styles.css");
  const rowsByWorkId = new Map();

  for (const row of workMedia.trim().split(/\r?\n/).slice(1)) {
    const [workId, type, , , sort] = row.split(",");
    if (!rowsByWorkId.has(workId)) rowsByWorkId.set(workId, []);
    rowsByWorkId.get(workId).push({ type, sort: Number(sort) });
  }

  for (const [workId, rows] of rowsByWorkId) {
    if (!rows.some((row) => row.type === "video")) continue;
    const orderedRows = [...rows].sort((first, second) => first.sort - second.sort);
    assert.equal(orderedRows[0].type, "video", `${workId} must start with a video`);
    assert.deepEqual(
      orderedRows.map((row) => row.sort),
      Array.from({ length: orderedRows.length }, (_, index) => index + 1),
      `${workId} media order must be continuous`
    );
  }

  assert.match(
    css,
    /\.feed-gallery-trigger img\s*\{[^}]*width:\s*100%;[^}]*object-fit:\s*contain;/s
  );
});

test("gallery lightbox never renders its inactive still or video element", async () => {
  const css = await readProjectFile("src/styles.css");

  assert.match(
    css,
    /\.gallery-stage img\[hidden\],\s*\.gallery-stage video\[hidden\]\s*\{\s*display:\s*none;/s
  );
});

test("local work media uses generated WebP previews before loading originals", async () => {
  const { getMediaPreviewUrl, isPreviewableLocalMediaUrl } = await importProjectModule("src/media-preview.js");
  const js = await readProjectFile("src/main.js");
  const packageJson = await readProjectFile("package.json");

  assert.equal(isPreviewableLocalMediaUrl("/assets/works/vfx-2026-showreel/01-main.mp4"), true);
  assert.equal(isPreviewableLocalMediaUrl("/kyutodaze-pages/assets/works/vfx-2026-showreel/01-main.mp4"), true);
  assert.equal(isPreviewableLocalMediaUrl("/assets/works/vfx-2026-showreel/thumbs/01-main.mp4.webp"), false);
  assert.equal(isPreviewableLocalMediaUrl("https://example.com/image.jpg"), false);
  assert.equal(
    getMediaPreviewUrl("/assets/works/vfx-2026-showreel/01-main.mp4"),
    "/assets/works/vfx-2026-showreel/thumbs/01-main.mp4.webp"
  );
  assert.equal(
    getMediaPreviewUrl("/assets/works/album-cover-laegyu/01-main.png"),
    "/assets/works/album-cover-laegyu/thumbs/01-main.png.webp"
  );
  assert.equal(
    getMediaPreviewUrl("/kyutodaze-pages/assets/works/vfx-2026-showreel/01-main.mp4"),
    "/kyutodaze-pages/assets/works/vfx-2026-showreel/thumbs/01-main.mp4.webp"
  );
  assert.equal(getMediaPreviewUrl("https://example.com/image.jpg"), "https://example.com/image.jpg");

  assert.match(js, /import \{ getMediaPreviewUrl \} from "\.\/media-preview\.js";/);
  assert.match(js, /const previewUrl = getMediaPreviewUrl\(firstItem\.url\);/);
  assert.match(js, /<img src="\$\{escapeHtml\(previewUrl\)\}" alt="\$\{alt\}" loading="lazy"/);
  assert.doesNotMatch(js, /<video src="\$\{escapeHtml\(firstItem\.url\)\}" muted playsinline preload="metadata"><\/video>/);
  assert.match(packageJson, /"media:previews": "node scripts\/generate-media-previews\.js"/);
  assert.match(packageJson, /"media:previews:check": "node scripts\/generate-media-previews\.js --check"/);
});

test("inactive work views and collapsed summary groups do not mount media", async () => {
  const js = await readProjectFile("src/main.js");

  assert.match(js, /function getActiveWorkView\(\)/);
  assert.match(js, /activeSummaryArtist === group\.artist\s*\?\s*renderSummaryWorkRows\(group\.items,\s*mediaByWorkId\)\s*:\s*""/);
  assert.match(js, /activeView === "overview"\s*\?\s*renderOverviewGrid\(works,\s*mediaByWorkId\)\s*:\s*renderSummaryGroups\(summaryWorks,\s*mediaByWorkId\)/);
  assert.match(js, /setActiveSummaryArtist\(summaryButton\.dataset\.summaryArtist\);/);
});

test("root route exposes a full-page WebGL bead curtain before home", async () => {
  const html = await readProjectFile("index.html");
  const js = await readProjectFile("src/main.js");
  const css = await readProjectFile("src/styles.css");
  const heroWebgl = await readProjectFile("src/hero-webgl.js");
  const pointData = await readProjectBytes("public/assets/bead-curtain-points.bin");
  const cursorAsset = await readProjectBytes("public/assets/bead-ring-cursor.png");

  assert.match(html, /data-route="bead-curtain"/);
  assert.match(html, /class="route-page bead-curtain-page"/);
  assert.match(html, /data-bead-curtain-webgl/);
  assert.match(html, /data-bead-cursor/);
  assert.match(html, /Full-page interactive bead curtain/);
  assert.match(html, /src="\/assets\/KYUTO-LOGO\.png"/);
  assert.doesNotMatch(html, /%BASE_URL%assets\//);
  assert.doesNotMatch(html, /home-webgl-hero/);
  assert.match(js, /import \{ initHeroWebgl \} from "\.\/hero-webgl\.js";/);
  assert.match(js, /const routes = new Set\(\[[^\]]*"splatify-webapp"[^\]]*"splatify-webapp-export"[^\]]*\]\)/s);
  assert.match(js, /"bead-curtain"/);
  assert.match(js, /if \(!route\) return "bead-curtain";/);
  assert.match(js, /ensureBeadCurtainHero/);
  assert.match(js, /initHeroWebgl\(document\.querySelector\("\[data-bead-curtain-webgl\]"\)\)/);
  assert.match(js, /ensureBeadCursor/);
  assert.match(js, /document\.querySelector\("\[data-bead-cursor\]"\)/);
  assert.match(js, /const BEAD_CURSOR_CLICK_MS = 720;/);
  assert.match(js, /const isBeadCurtain = route === "bead-curtain";/);
  assert.match(js, /beadCursor\.classList\.toggle\("is-visible",\s*isBeadCurtain\)/);
  assert.match(js, /beadCursor\.classList\.add\("is-clicking"\)/);
  assert.match(js, /BEAD_CURSOR_CLICK_MS/);
  assert.match(js, /beadCursor\??\.classList\.add\("is-whiteout"\)/);
  assert.match(js, /beadCursor\.classList\.remove\("is-whiteout",\s*"is-clicking"\)/);
  assert.doesNotMatch(js, /if \("pointerType" in event && event\.pointerType === "touch"\) return;/);
  assert.match(js, /window\.addEventListener\(\s*"mousedown"/);
  assert.match(js, /const BEAD_CURTAIN_HOME_DELAY_MS = 2950;/);
  assert.match(js, /let beadCurtainTouchArmed = false;/);
  assert.match(js, /let beadCurtainEntering = false;/);
  assert.match(js, /function isCoarsePointerInput\(event\)/);
  assert.match(js, /function handleBeadCurtainPointerDown\(event\)/);
  assert.match(js, /if \(!beadCurtainTouchArmed\) \{\s*beadCurtainTouchArmed = true;/s);
  assert.match(js, /beadCurtainEntering = true;/);
  assert.match(js, /event\.stopImmediatePropagation\(\);/);
  assert.match(js, /if \(isCoarsePointerInput\(\)\) return;/);
  assert.match(js, /beadCurtainHero\?\.startTransition\(event\);/);
  assert.match(js, /enterHomeAfterBeadCurtain\(event\);/);
  assert.match(js, /enterHomeAfterBeadCurtain/);
  assert.match(js, /navigate\("\/home"\)/);
  assert.match(js, /route === "bead-curtain" \? "\/"/);
  assert.doesNotMatch(js, /BEAD CURTAIN — KYUTO\.MATTE/);
  assert.match(css, /\.bead-curtain-page\s*\{[^}]*min-height:\s*100vh;/s);
  assert.match(css, /\.bead-curtain-canvas\s*\{[^}]*width:\s*100vw;[^}]*height:\s*100vh;/s);
  assert.match(css, /body\[data-page="bead-curtain"\][^{]*\{[^}]*cursor:\s*none;/s);
  assert.match(css, /\.bead-cursor\s*\{[^}]*url\("\/assets\/bead-ring-cursor\.png"\)/s);
  assert.match(css, /\.bead-cursor\s*\{[^}]*width:\s*5\.7rem;[^}]*height:\s*5\.7rem;/s);
  assert.match(css, /\.bead-cursor\s*\{[^}]*drop-shadow\(0 0 0\.42rem rgba\(255,\s*88,\s*25,\s*0\.46\)\)/s);
  assert.match(css, /\.bead-cursor\.is-clicking\s*\{[^}]*animation:\s*bead-cursor-pop 680ms cubic-bezier\(0\.16,\s*1,\s*0\.3,\s*1\);/s);
  assert.match(css, /\.bead-cursor\.is-clicking::before\s*\{[^}]*animation:\s*bead-cursor-glitter 720ms ease-out;/s);
  assert.match(css, /\.bead-cursor\.is-clicking::after\s*\{[^}]*animation:\s*bead-cursor-spark 720ms ease-out;/s);
  assert.match(css, /\.bead-cursor\.is-whiteout\s*\{/);
  assert.match(css, /animation:\s*bead-cursor-whiteout 2\.24s ease-in forwards;/);
  assert.match(css, /@keyframes bead-cursor-glitter/);
  assert.match(css, /@keyframes bead-cursor-whiteout/);
  assert.match(css, /@media \(hover: none\), \(pointer: coarse\)\s*\{[\s\S]*?\.bead-cursor\s*\{\s*display: block;/);
  assert.match(css, /\.bead-cursor\.is-visible\s*\{\s*--bead-cursor-x: 50vw;\s*--bead-cursor-y: 56vh;\s*opacity: 0\.88;\s*animation: bead-cursor-mobile-float 1\.8s ease-in-out infinite;/s);
  assert.match(css, /\.bead-cursor\.is-visible\.is-whiteout\s*\{\s*animation: bead-cursor-whiteout 2\.24s ease-in forwards;/s);
  assert.match(css, /@keyframes bead-cursor-mobile-float/);
  assert.ok(cursorAsset.byteLength > 10000);
  assert.doesNotMatch(html, /data-route="splatify"/);
  assert.doesNotMatch(js, /ensureSplatifyHero/);
  assert.match(heroWebgl, /export function initHeroWebgl/);
  assert.match(heroWebgl, /createShader/);
  assert.match(heroWebgl, /gl\.POINTS/);
  assert.match(heroWebgl, /uTrailMouse/);
  assert.match(heroWebgl, /uShockStrength/);
  assert.match(heroWebgl, /import \{ toPublicAssetUrl \} from "\.\/site-url\.js"/);
  assert.match(heroWebgl, /const SOURCE_IMAGE_URL = toPublicAssetUrl\("\/assets\/hero_bg\.webp"\)/);
  assert.match(heroWebgl, /const POINT_DATA_URL = toPublicAssetUrl\("\/assets\/bead-curtain-points\.bin"\)/);
  assert.match(heroWebgl, /const SAMPLE_STEP = 7;/);
  assert.match(heroWebgl, /const MAX_TRAIL_POINTS = 72;/);
  assert.match(heroWebgl, /const DESKTOP_PIXEL_RATIO_CAP = 1\.5;/);
  assert.match(heroWebgl, /const MOBILE_PIXEL_RATIO_CAP = 1\.25;/);
  assert.match(heroWebgl, /const HERO_IMAGE_ASPECT = 1920 \/ 1072;/);
  assert.match(heroWebgl, /function getCoverTransform\(viewportAspect, imageAspect = HERO_IMAGE_ASPECT\)/);
  assert.match(heroWebgl, /const MOBILE_CURTAIN_FIT_ASPECT = 0\.9;/);
  assert.match(heroWebgl, /function getCurtainTransform\(viewportAspect\)/);
  assert.match(heroWebgl, /const MOBILE_CURTAIN_SCALE = 2\.11;/);
  assert.match(heroWebgl, /const MOBILE_CURTAIN_X_OFFSET = -0\.044;/);
  assert.match(heroWebgl, /if \(viewportAspect < MOBILE_CURTAIN_FIT_ASPECT\) \{\s*return \{\s*scale: \[MOBILE_CURTAIN_SCALE, 1\],\s*offset: \[MOBILE_CURTAIN_X_OFFSET, 0\]\s*\};/s);
  assert.match(heroWebgl, /return \{ scale: getCoverTransform\(viewportAspect\), offset: \[0, 0\] \};/);
  assert.match(heroWebgl, /function startTransition\(event\)/);
  assert.match(heroWebgl, /uniform vec2 uSceneCoverScale;/);
  assert.match(heroWebgl, /uniform vec2 uSceneOffset;/);
  assert.match(heroWebgl, /uniform float uViewportAspect;/);
  assert.match(heroWebgl, /uniform float uImageAspect;/);
  assert.match(heroWebgl, /coverUV/);
  assert.match(heroWebgl, /fetchPointData/);
  assert.match(heroWebgl, /response\.arrayBuffer\(\)/);
  assert.doesNotMatch(heroWebgl, /getImageData\(image\)/);
  assert.match(heroWebgl, /float curtainX = step\(-0\.455, ndcX\)/);
  const pointerDownHandler = heroWebgl.match(/const handlePointerDown = \(event\) => \{([\s\S]*?)\n  \};/);
  assert.ok(pointerDownHandler);
  assert.doesNotMatch(pointerDownHandler[1], /shockStartedAt/);
  assert.match(heroWebgl, /return \{\s*startTransition,/s);
  assert.match(heroWebgl, /gl_Position = vec4\(zoomedPos \* uSceneCoverScale \+ uSceneOffset, depthLift, 1\.0\);/);

  const points = new Float32Array(pointData.buffer, pointData.byteOffset, pointData.byteLength / 4);
  let leftFramePointCount = 0;
  let addedBeadPointCount = 0;
  let interactiveCurtainPointCount = 0;
  let rightFramePointCount = 0;
  const addedBeadColorSum = [0, 0, 0];
  const rightReferenceColorSum = [0, 0, 0];
  let rightReferencePointCount = 0;
  for (let index = 0; index < points.length; index += 8) {
    const x = points[index];
    const r = points[index + 2];
    const g = points[index + 3];
    const b = points[index + 4];
    if (x >= -0.51 && x < -0.455) leftFramePointCount += 1;
    if (x >= -0.455 && x < -0.405) {
      addedBeadPointCount += 1;
      addedBeadColorSum[0] += r;
      addedBeadColorSum[1] += g;
      addedBeadColorSum[2] += b;
    }
    if (x >= -0.405 && x < 0.50) interactiveCurtainPointCount += 1;
    if (x >= 0.455 && x < 0.50) {
      rightReferencePointCount += 1;
      rightReferenceColorSum[0] += r;
      rightReferenceColorSum[1] += g;
      rightReferenceColorSum[2] += b;
    }
    if (x >= 0.50) rightFramePointCount += 1;
  }
  assert.equal(leftFramePointCount, 0);
  assert.equal(addedBeadPointCount, rightReferencePointCount);
  assert.ok(addedBeadPointCount > 1800);
  for (let channel = 0; channel < 3; channel += 1) {
    const addedMean = addedBeadColorSum[channel] / addedBeadPointCount;
    const referenceMean = rightReferenceColorSum[channel] / rightReferencePointCount;
    assert.ok(Math.abs(addedMean - referenceMean) < 0.001);
  }
  assert.ok(interactiveCurtainPointCount > 30000);
  assert.equal(rightFramePointCount, 0);
});

test("editable CSV data drives home works and open works", async () => {
  const works = await readProjectFile("public/data/works.csv");
  const workMedia = await readProjectFile("public/data/work-media.csv");
  const openWorks = await readProjectFile("public/data/open-works.csv");
  const openWorksPage = await readProjectFile("public/data/open-works-page.csv");
  const openWorkDetails = await readProjectFile("public/data/open-work-details.csv");
  const openWorkLinks = await readProjectFile("public/data/open-work-links.csv");
  const openWorkExamples = await readProjectFile("public/data/open-work-examples.csv");
  const openWorkManuals = await readProjectFile("public/data/open-work-manuals.csv");
  const packageJson = await readProjectFile("package.json");
  const openWorksWorkbookScript = await readProjectFile("scripts/sync-open-works-workbook.py");
  const readme = await readProjectFile("README.md");

  assert.match(works, /^id,overview,artist,category,year,url,text/m);
  const requestedArtistOrder = ["BLACKPINK", "BABYMONSTER", "ENHYPEN", "AI Works / 3D", "OHIR", "OJAT", "GRAPHIC"];
  const artistOrder = [
    ...new Set(
      [...works.matchAll(/^[^,\r\n]+,[^,\r\n]*,([^,\r\n]+),/gm)]
        .map(([, artist]) => artist)
        .filter((artist) => requestedArtistOrder.includes(artist))
    )
  ];

  assert.deepEqual(artistOrder, requestedArtistOrder);
  assert.match(works, /blackpink-go,true,BLACKPINK,Music Video,2026,/);
  assert.match(works, /blackpink-go,true,BLACKPINK,Music Video,2026,,GO' M\/V/);
  assert.match(works, /babymonster-ilikeit,true,BABYMONSTER,Music Video,2026,,I LIKE IT' M\/V/);
  assert.match(works, /babymonster-ilikeit,true,BABYMONSTER,Music Video,2026,/);
  assert.match(works, /babymonster-choom-album,true,BABYMONSTER,Album,2026,/);
  assert.match(works, /babymonster-psycho,true,BABYMONSTER,Music Video,2025,/);
  assert.match(works, /babymonster-we-go-up,true,BABYMONSTER,Music Video,2025,,WE GO UP' M\/V/);
  assert.match(works, /babymonster-we-go-up-album,true,BABYMONSTER,Album,2025,https:\/\/i\.pinimg\.com\/736x\/bc\/67\/ab\/bc67ab391e677a71c533723b014e6fe3\.jpg,2rd Mini Album 'WE GO UP'/);
  assert.match(works, /babymonster-hot-sauce,true,BABYMONSTER,Music Video,2025,/);
  assert.match(works, /babymonster-billionaire-pv,true,BABYMONSTER,Music Video,2025,,Billionaire' P\/V/);
  assert.match(works, /babymonster-really-like-you,true,BABYMONSTER,Music Video,2025,,Really Like You' M\/V/);
  assert.match(works, /enhypen-romance-untold-daydream,true,ENHYPEN,Album,2024,/);
  assert.match(works, /enhypen-daydream,true,ENHYPEN,Music Video,2024,,Daydream' Track Video/);
  assert.match(works, /enhypen-brought-the-heat-back,true,ENHYPEN,Music Video,2024,,Brought the Heat Back' M\/V/);
  assert.match(works, /enhypen-XO,true,ENHYPEN,Music Video,2024,,XO' M\/V/);
  assert.match(works, /enhypen-concept-cinema,true,ENHYPEN,Music Video,2024,,UNTOLD' Concept Cinema/);
  assert.match(works, /enhypen-romance-untold-preview,true,ENHYPEN,Music Video,2024,,ROMANCE : UNTOLD' Preview/);
  assert.match(works, /enhypen-romance-untold-album,true,ENHYPEN,Album,2024,/);
  assert.match(works, /ohir-brand-film,true,OHIR,AI Works \/ 3D,2026,,‘OHIR' BRAND FILM - FULL AI/);
  assert.match(workMedia, /ohir-brand-film,still,\/assets\/works\/ohir-brand-film\/01-white-flowers\.png,,2/);
  assert.match(workMedia, /ohir-brand-film,still,\/assets\/works\/ohir-brand-film\/08-brand-logo-flower\.png,,9/);
  assert.match(workMedia, /ohir-brand-film,video,\/assets\/works\/ohir-brand-film\/01-main\.mp4,,1/);
  assert.match(works, /poster-2026-kyuto31,true,GRAPHIC,GRAPHIC,2026,,BIRTHDAY VISUALS for KYUTO/);
  assert.match(works, /poster-2025-kyuto30,true,GRAPHIC,GRAPHIC,2025,,BIRTHDAY VISUALS for KYUTO/);
  assert.match(works, /poster-2025-hanni,true,GRAPHIC,GRAPHIC,2024,,BIRTHDAY VISUALS for JONGIN/);
  assert.match(works, /album-cover-lack,true,GRAPHIC,GRAPHIC,2025,,ALBUM COVER for LACK/);
  assert.match(works, /album-cover-crane,true,GRAPHIC,GRAPHIC,2025,,ALBUM COVER for CRANE/);
  assert.match(works, /album-cover-laegyu,false,GRAPHIC,GRAPHIC,2024,,ALBUM COVER for LAEGYU/);
  assert.match(works, /vfx-2026-showreel,true,AI Works \/ 3D,AI Works \/ 3D,2026,,Personal Work - FULL AI/);
  assert.match(workMedia, /vfx-2026-showreel,still,\/assets\/works\/vfx-2026-showreel\/01-full-ai-blue\.png,,2/);
  assert.match(workMedia, /vfx-2026-showreel,still,\/assets\/works\/vfx-2026-showreel\/06-organic-eye\.png,,7/);
  assert.match(workMedia, /vfx-2026-showreel,video,\/assets\/works\/vfx-2026-showreel\/01-main\.mp4,,1/);
  assert.match(works, /vfx-2026-lunanewyear,true,AI Works \/ 3D,AI Works \/ 3D,2026,,\[Lunar New Year\] - FULL AI/);
  assert.match(workMedia, /vfx-2026-lunanewyear,still,\/assets\/works\/vfx-2026-lunanewyear\/01-horse-closeup\.png,,2/);
  assert.match(workMedia, /vfx-2026-lunanewyear,still,\/assets\/works\/vfx-2026-lunanewyear\/05-title-card\.png,,6/);
  assert.match(workMedia, /vfx-2026-lunanewyear,video,\/assets\/works\/vfx-2026-lunanewyear\/01-main\.mp4,,1/);
  assert.match(works, /vfx-2025-xg,(?:true|1),AI Works \/ 3D,AI Works \/ 3D,2025,,\[Something Ain’t Right\] - FULL 3D/);
  assert.match(workMedia, /vfx-2025-xg,still,\/assets\/works\/vfx-2025-xg\/01-main\.png,,2/);
  assert.match(workMedia, /vfx-2025-xg,still,\/assets\/works\/vfx-2025-xg\/02-close-black\.png,,3/);
  assert.match(workMedia, /vfx-2025-xg,video,\/assets\/works\/vfx-2025-xg\/01-main\.mov,,1/);
  assert.match(works, /vfx-2025-aesop,(?:true|1),AI Works \/ 3D,AI Works \/ 3D,2025,,\[Aesop\] - 3D Comp/);
  assert.match(workMedia, /vfx-2025-aesop,still,\/assets\/works\/vfx-2025-aesop\/01-aesop-sign\.png,,2/);
  assert.match(workMedia, /vfx-2025-aesop,still,\/assets\/works\/vfx-2025-aesop\/02-aesop-display\.png,,3/);
  assert.match(workMedia, /vfx-2025-aesop,video,\/assets\/works\/vfx-2025-aesop\/01-main\.mp4,,1/);
  assert.match(works, /vfx-2025-kiiikiii,(?:true|1),AI Works \/ 3D,AI Works \/ 3D,2025,,\[BTG\] - FULL 3D/);
  assert.match(workMedia, /vfx-2025-kiiikiii,still,\/assets\/works\/vfx-2025-kiiikiii\/01-main\.png,,2/);
  assert.match(workMedia, /vfx-2025-kiiikiii,still,\/assets\/works\/vfx-2025-kiiikiii\/06-cloud-fruit\.png,,7/);
  assert.match(workMedia, /vfx-2025-kiiikiii,video,\/assets\/works\/vfx-2025-kiiikiii\/01-main\.mp4,,1/);
  assert.match(works, /vfx-2025-nike,(?:true|1),AI Works \/ 3D,AI Works \/ 3D,2026,,\[NIKE\] - FULL 3D/);
  assert.match(workMedia, /vfx-2025-nike,still,\/assets\/works\/vfx-2025-nike\/01-lake-opening\.png,,2/);
  assert.match(workMedia, /vfx-2025-nike,still,\/assets\/works\/vfx-2025-nike\/04-nike-box-logo\.png,,5/);
  assert.match(workMedia, /vfx-2025-nike,video,\/assets\/works\/vfx-2025-nike\/01-main\.mp4,,1/);
  assert.match(works, /vfx-2025-vivienne,(?:true|1),AI Works \/ 3D,AI Works \/ 3D,2025,,\[Vivienne Westwood\] - FULL 3D/);
  assert.match(workMedia, /vfx-2025-vivienne,still,\/assets\/works\/vfx-2025-vivienne\/01-main\.png,,2/);
  assert.match(workMedia, /vfx-2025-vivienne,still,\/assets\/works\/vfx-2025-vivienne\/05-red-forest-glow\.png,,6/);
  assert.match(workMedia, /vfx-2025-vivienne,video,\/assets\/works\/vfx-2025-vivienne\/01-main\.mp4,,1/);
  assert.match(works, /vfx-2026-iyodrama,false,AI Works \/ 3D,AI Works \/ 3D,2026,,Personal Work - AI VFX/);
  assert.match(works, /vfx-2026-cortis-redred,false,AI Works \/ 3D,AI Works \/ 3D,2026,,Personal Work - AI VFX/);
  assert.match(works, /vfx-2026-newjeans,false,AI Works \/ 3D,AI Works \/ 3D,2026,,Personal Work - AI VFX/);
  assert.match(workMedia, /vfx-2026-iyodrama,video,\/assets\/works\/vfx-2026-iyodrama\/01-main\.mp4,,1/);
  assert.match(workMedia, /vfx-2026-cortis-redred,video,\/assets\/works\/vfx-2026-cortis-redred\/01-main\.mp4,,1/);
  assert.match(workMedia, /vfx-2026-newjeans,video,\/assets\/works\/vfx-2026-newjeans\/01-main\.mp4,,1/);
  assert.match(works, /vfx-2026-bangbang,false,AI Works \/ 3D,AI Works \/ 3D,2026,,Personal Work - AI VFX/);
  assert.match(works, /vfx-2026-lesserafim,false,AI Works \/ 3D,AI Works \/ 3D,2026,,Personal Work - AI VFX/);
  assert.match(workMedia, /vfx-2026-bangbang,video,\/assets\/works\/vfx-2026-bangbang\/01-main\.mp4,,1/);
  assert.match(workMedia, /vfx-2026-lesserafim,video,\/assets\/works\/vfx-2026-lesserafim\/01-main\.mp4,,1/);
  assert.match(works, /ojat-styling-01,true,OJAT,Fashion,2023,,VISUAL DIRECTING for EDITORIAL/);
  assert.match(works, /ojat-lookbook-2021,true,OJAT,Fashion,2021,,'OJAT' 21' LOOKBOOK/);
  assert.match(works, /ojat-lookbook-2021-editorial,true,OJAT,Fashion,2021,,‘OJAT' 21' EDITORIAL/);
  assert.match(works, /ojat-lookbook-2021-development,true,OJAT,Fashion,2021,,‘OJAT' 21' DEVELOPMENT/);
  assert.match(works, /ojat-lookbook-2020,true,OJAT,Fashion,2020,,‘OJAT' 20’ LOOKBOOK/);
  assert.match(works, /ojat-lookbook-2020-editorial,true,OJAT,Fashion,2020,,‘OJAT' 20’ EDITORIAL/);
  assert.match(works, /ojat-lookbook-2020-development,true,OJAT,Fashion,2020,,‘OJAT' 20' DEVELOPMENT/);
  assert.match(works, /ojat-magazine-pap,true,OJAT,Fashion,2021,,VISAUL for 'PAP Magazine' - In the Name of Love/);
  assert.match(works, /ojat-magazine-babyyana,true,OJAT,Fashion,2021,,OJAT for BABY YANA @M\/V/);
  assert.match(works, /ojat-magazine-yunwhay,true,OJAT,Fashion,2021,,OJAT for YUNWHAY/);
  assert.match(works, /ojat-magazine-chorong,true,OJAT,Fashion,2021,,OJAT for Chorong\(Apink\)/);
  assert.match(works, /ojat-magazine-schön,true,OJAT,Fashion,2022,,OJAT for SCHÖN! MAGAZINE/);
  assert.match(works, /ojat-magazine-nain,true,OJAT,Fashion,2021,,OJAT for NAIN @BREAK MAGAZINE/);
  assert.match(works, /ojat-magazine-yena,true,OJAT,Fashion,2022,,OJAT for YENA @MAPS/);
  assert.match(works, /ojat-magazine-ugg,true,OJAT,Fashion,2022,,OJAT for UGG & AGE @shinsegae/);
  assert.match(works, /ojat-magazine-cakemag,true,OJAT,Fashion,2022,,OJAT for CAKE MAGAZINE/);

  assert.match(workMedia, /^work_id,type,url,caption,sort/m);
  assert.doesNotMatch(workMedia, /Visual Creative for/);
  for (const [index, file] of ojatLookbook2020Files.entries()) {
    assert.match(
      workMedia,
      new RegExp(`ojat-lookbook-2020,still,/assets/works/ojat-lookbook-2020/${file.replace(".", "\\.")},,${index + 1}`)
    );
  }
  for (const [index, file] of ojatLookbook2020EditorialFiles.entries()) {
    assert.match(
      workMedia,
      new RegExp(`ojat-lookbook-2020-editorial,still,/assets/works/ojat-lookbook-2020-editorial/${file.replace(".", "\\.")},,${index + 1}`)
    );
  }
  for (const [index, file] of ojatMagazineYunwhayFiles.entries()) {
    assert.match(
      workMedia,
      new RegExp(`ojat-magazine-yunwhay,still,/assets/works/ojat-magazine-yunwhay/${file.replace(".", "\\.")},,${index + 1}`)
    );
  }
  for (const [index, file] of ojatMagazinePapFiles.entries()) {
    assert.match(
      workMedia,
      new RegExp(`ojat-magazine-pap,still,/assets/works/ojat-magazine-pap/${file.replace(".", "\\.")},,${index + 1}`)
    );
  }
  for (const [index, file] of ojatMagazineBabyyanaFiles.entries()) {
    assert.match(
      workMedia,
      new RegExp(`ojat-magazine-babyyana,still,/assets/works/ojat-magazine-babyyana/${file.replace(".", "\\.")},,${index + 1}`)
    );
  }
  for (const [index, file] of ojatMagazineChorongFiles.entries()) {
    assert.match(
      workMedia,
      new RegExp(`ojat-magazine-chorong,still,/assets/works/ojat-magazine-chorong/${file.replace(".", "\\.")},,${index + 1}`)
    );
  }
  for (const [index, file] of ojatMagazineSchonFiles.entries()) {
    assert.match(
      workMedia,
      new RegExp(`ojat-magazine-schön,still,/assets/works/ojat-magazine-schon/${file.replace(".", "\\.")},,${index + 1}`)
    );
  }
  for (const [index, file] of ojatMagazineNainFiles.entries()) {
    assert.match(
      workMedia,
      new RegExp(`ojat-magazine-nain,still,/assets/works/ojat-magazine-nain/${file.replace(".", "\\.")},,${index + 1}`)
    );
  }
  for (const [index, file] of ojatMagazineYenaFiles.entries()) {
    assert.match(
      workMedia,
      new RegExp(`ojat-magazine-yena,still,/assets/works/ojat-magazine-yena/${file.replace(".", "\\.")},,${index + 1}`)
    );
  }
  for (const [index, file] of ojatMagazineUggFiles.entries()) {
    assert.match(
      workMedia,
      new RegExp(`ojat-magazine-ugg,still,/assets/works/ojat-magazine-ugg/${file.replace(".", "\\.")},,${index + 1}`)
    );
  }
  assert.match(workMedia, /poster-2026-kyuto31,still,\/assets\/works\/poster-2026-kyuto31\/01-main\.jpeg,,1/);
  assert.match(workMedia, /poster-2026-kyuto31,still,\/assets\/works\/poster-2026-kyuto31\/06-ice-cream\.jpeg,,6/);
  assert.match(workMedia, /poster-2025-kyuto30,still,\/assets\/works\/poster-2025-kyuto30\/01-main\.jpeg,,1/);
  assert.match(workMedia, /poster-2025-kyuto30,still,\/assets\/works\/poster-2025-kyuto30\/04-poster-page-4\.jpeg,,4/);
  assert.match(workMedia, /poster-2025-hanni,still,\/assets\/works\/poster-2025-hanni\/01-cucumber\.jpeg,,1/);
  assert.match(workMedia, /poster-2025-hanni,still,\/assets\/works\/poster-2025-hanni\/06-reference-sheet\.jpeg,,6/);
  assert.match(workMedia, /babymonster-choom,still,\/assets\/works\/babymonster-choom\/01-main\.jpg,,1/);
  assert.match(workMedia, /babymonster-choom,still,\/assets\/works\/babymonster-choom\/18-img-9884\.jpg,,18/);
  assert.match(workMedia, /babymonster-psycho,still,\/assets\/works\/babymonster-psycho\/01-main\.jpg,,1/);
  assert.match(workMedia, /babymonster-psycho,still,\/assets\/works\/babymonster-psycho\/23-img-9967\.jpg,,23/);
  assert.match(workMedia, /babymonster-psycho-pv,still,\/assets\/works\/babymonster-psycho-pv\/01-main\.jpg,,1/);
  assert.match(workMedia, /babymonster-psycho-pv,still,\/assets\/works\/babymonster-psycho-pv\/09-img-9911\.jpg,,9/);
  assert.match(workMedia, /babymonster-we-go-up,still,\/assets\/works\/babymonster-we-go-up\/01-main\.jpg,,1/);
  assert.match(workMedia, /babymonster-we-go-up,still,\/assets\/works\/babymonster-we-go-up\/15-img-0009\.jpg,,15/);
  assert.match(workMedia, /babymonster-hot-sauce,still,\/assets\/works\/babymonster-hot-sauce\/01-main\.jpg,,1/);
  assert.match(workMedia, /babymonster-hot-sauce,still,\/assets\/works\/babymonster-hot-sauce\/10-img-0143\.jpg,,10/);
  assert.match(workMedia, /babymonster-really-like-you,still,\/assets\/works\/babymonster-really-like-you\/01-main\.jpg,,1/);
  assert.match(workMedia, /babymonster-really-like-you,still,\/assets\/works\/babymonster-really-like-you\/13-img-0086\.jpg,,13/);
  assert.match(workMedia, /enhypen-romance-untold-daydream,still,\/assets\/works\/enhypen-romance-untold-daydream\/01-main\.webp,,1/);
  assert.match(workMedia, /enhypen-romance-untold-daydream,still,\/assets\/works\/enhypen-romance-untold-daydream\/36\.webp,,36/);
  assert.match(workMedia, /enhypen-romance-untold-album,still,\/assets\/works\/enhypen-romance-untold-album\/01-main\.webp,,1/);
  assert.match(workMedia, /enhypen-romance-untold-album,still,\/assets\/works\/enhypen-romance-untold-album\/63\.jpeg,,63/);
  assert.match(workMedia, /blackpink-go,still,\/assets\/works\/blackpink-go\/01-main\.jpg,,1/);
  assert.match(workMedia, /blackpink-go,still,\/assets\/works\/blackpink-go\/17-last\.jpg,,17/);
  assert.match(workMedia, /babymonster-ilikeit,still,\/assets\/works\/babymonster-ilikeit\/01-main\.jpg,,1/);
  assert.match(workMedia, /babymonster-ilikeit,still,\/assets\/works\/babymonster-ilikeit\/21-img-9764\.jpg,,21/);
  assert.match(workMedia, /babymonster-billionaire-pv,still,\/assets\/works\/babymonster-billionaire\/01-00m27s\.jpg,,1/);
  assert.match(workMedia, /babymonster-billionaire-pv,still,\/assets\/works\/babymonster-billionaire\/05-02m35s\.jpg,,5/);
  assert.match(workMedia, /enhypen-daydream,still,\/assets\/works\/enhypen-daydream\/01-main\.jpg,,1/);
  assert.match(workMedia, /enhypen-daydream,still,\/assets\/works\/enhypen-daydream\/19-01m17s\.jpg,,19/);
  assert.match(workMedia, /enhypen-brought-the-heat-back,still,\/assets\/works\/enhypen-brought-the-heat-back\/01-main\.jpg,,1/);
  assert.match(workMedia, /enhypen-brought-the-heat-back,still,\/assets\/works\/enhypen-brought-the-heat-back\/13-02m59s\.jpg,,13/);
  assert.match(workMedia, /enhypen-XO,still,\/assets\/works\/enhypen-XO\/01-main\.jpg,,1/);
  assert.match(workMedia, /enhypen-XO,still,\/assets\/works\/enhypen-XO\/19-04m19s\.jpg,,19/);
  assert.match(workMedia, /enhypen-concept-cinema,still,\/assets\/works\/enhypen-concept-cinema\/01-main\.jpg,,1/);
  assert.match(workMedia, /enhypen-concept-cinema,still,\/assets\/works\/enhypen-concept-cinema\/37-08m38s\.jpg,,37/);
  assert.match(workMedia, /enhypen-romance-untold-preview,still,\/assets\/works\/enhypen-romance-untold-preview\/01-main\.jpg,,1/);
  assert.match(workMedia, /enhypen-romance-untold-preview,still,\/assets\/works\/enhypen-romance-untold-preview\/08-04m05s\.jpg,,8/);
  assert.match(workMedia, /ojat-styling-01,still,\/assets\/works\/ojat-styling-01\/01-main\.jpeg,,1/);
  assert.match(workMedia, /ojat-styling-01,still,\/assets\/works\/ojat-styling-01\/06-img-0291\.jpeg,,6/);
  assert.match(workMedia, /ojat-lookbook-2021,still,\/assets\/works\/ojat-lookbook-2021\/01-main\.jpeg,,1/);
  assert.match(workMedia, /ojat-lookbook-2021,still,\/assets\/works\/ojat-lookbook-2021\/16-w-pose-16\.jpeg,,16/);
  assert.match(workMedia, /ojat-lookbook-2021,still,\/assets\/works\/ojat-lookbook-2021\/21-duo-pose\.jpeg,,21/);
  assert.match(workMedia, /ojat-lookbook-2021-editorial,still,\/assets\/works\/ojat-lookbook-2021-editorial\/01-main\.jpeg,,1/);
  assert.match(workMedia, /ojat-lookbook-2021-editorial,still,\/assets\/works\/ojat-lookbook-2021-editorial\/11-concepts-11\.jpeg,,11/);
  assert.match(workMedia, /ojat-lookbook-2021-development,still,\/assets\/works\/ojat-lookbook-2021-development\/01-research-1\.jpeg,,1/);
  assert.match(workMedia, /ojat-lookbook-2021-development,still,\/assets\/works\/ojat-lookbook-2021-development\/06-fittings\.jpeg,,6/);
  assert.match(workMedia, /ojat-lookbook-2020-development,still,\/assets\/works\/ojat-lookbook-2020-development\/01-main\.jpeg,,1/);
  assert.match(workMedia, /ojat-lookbook-2020-development,still,\/assets\/works\/ojat-lookbook-2020-development\/06-portfolio-4\.jpeg,,6/);
  assert.match(workMedia, /babymonster-choom-album,still,https:\/\/i\.pinimg\.com\/736x\/73\/c6\/a3\/73c6a3cdfb860a65c64680bdada10a14\.jpg/);
  assert.match(workMedia, /babymonster-we-go-up-album,still,https:\/\/i\.pinimg\.com\/736x\/bc\/67\/ab\/bc67ab391e677a71c533723b014e6fe3\.jpg/);
  assert.match(workMedia, /album-cover-lack,still,\/assets\/works\/album-cover-lack\/01-main\.png,,1/);
  assert.match(workMedia, /album-cover-crane,still,\/assets\/works\/album-cover-crane\/01-main\.jpg,,1/);
  assert.match(workMedia, /album-cover-laegyu,still,\/assets\/works\/album-cover-laegyu\/01-main\.png,,1/);

  assert.match(openWorks, /^\uFEFF?title,summary,slug/m);
  assert.match(openWorks, /SLEEPLESS,"맥북을 닫아도 잠자기 모드로 들어가지 않는 앱\n긴 바이브코딩 작업을 하거나 브금을 틀어놓을 때 좋습니다",\/sleepless/);
  assert.match(
    openWorks,
    /SLEEPLESS[\s\S]*SPLATIFY[\s\S]*ffMOCHI[\s\S]*JEBI AGENT[\s\S]*딸깍장표[\s\S]*딸깍클리닝[\s\S]*JEJU WAVE RADIO[\s\S]*INTERACTIVE VISUALS/
  );
  assert.match(openWorks, /SPLATIFY,사용자의 이미지\/영상을 가우시안 스플래팅 느낌으로 인코딩해주는 웹앱,\/splatify/);
  assert.match(openWorks, /ffMOCHI,다양한 비디오 파일을 간단하게 압축 인코딩하는 앱,\/ffmochi/);
  assert.match(openWorks, /JEBI AGENT,"코딩작업하다 보면 금새 차오르는 컨텍스트 때문에 곤란할 때,\n새 채팅으로 깔끔하게 옮겨주는 제비 에이전트",\/jebi-agent/);
  assert.match(openWorks, /JEJU WAVE RADIO/);
  assert.match(openWorks, /JEJU WAVE RADIO ,"실시간 제주 바닷가의 파도 \+ 날씨를 앰비언스 사운드 맵핑한 작업\n귀여운 8bit 영상도 함께 플레이",\/jeju-wave-radio/);
  assert.match(openWorks, /INTERACTIVE VISUALS,재미있는 인터랙티브 비주얼 프로젝트들,\/interactive-visuals/);
  assert.doesNotMatch(openWorks, /TOUCH DESIGNER/);
  assert.match(openWorks, /딸깍장표/);
  assert.match(openWorks, /딸깍장표,"영상의 모든 컷을 감지, 대표 컷을 추출해서 장표 문서로 만들어주는 에이전트",\/ttalkkak-jangpyo/);
  assert.match(openWorks, /딸깍클리닝,초상 이미지를 기준으로 클리닝 영역을 감지해서 마킹해서 문서화해주는 에이전트,\/ttalkkak-cleaning/);

  assert.match(openWorksPage, /^\uFEFF?title,summary/m);
  assert.match(openWorksPage, /Open Works,다양한 작업들의 아카이빙 및 실험실 공간입니다\./);

  assert.match(openWorkDetails, /^\uFEFF?slug,kicker,detail_summary,format,status,role,lede,detail,features,action_label,image_url,image_alt/m);
  assert.match(openWorkDetails, /sleepless,Mac utility/);
  assert.match(openWorkDetails, /jeju-wave-radio,Ambient web radio/);
  assert.match(openWorkDetails, /splatify,Gaussian-style encoder/);
  assert.match(openWorkDetails, /ffmochi,Video compression app/);
  assert.match(openWorkDetails, /jebi-agent,Codex handoff agent,[^\n]*,Agent Skill,/);
  assert.match(openWorkDetails, /긴 Codex 작업을 새 채팅으로 넘기는 제비 handoff Agent Skill입니다/);
  assert.match(openWorkDetails, /무거워진 채팅을 접고, 작업은 이어갑니다/);
  assert.match(openWorkDetails, /JEBI는 현재 저장소 상태를 짧은 handoff로 압축하고 clean successor chat을 시작합니다/);
  assert.match(openWorkDetails, /전체 history를 복사하지 않고 repo, branch, HEAD, worktree, 변경 파일, 완료\/남은 일, 테스트 상태, 주의사항만 넘깁니다/);
  assert.match(openWorkDetails, /다음 에이전트는 handoff와 live repo를 비교한 뒤 불일치를 보고하고 사용자 지시를 기다립니다/);
  assert.match(openWorkDetails, /handoff 생성\|clean successor chat\|repo 상태 검증/);
  assert.match(openWorkDetails, /interactive-visuals,Interactive archive/);
  assert.match(openWorkDetails, /SPLATIFY는 이미지와 영상을 가우시안 스타일의 포인트 비주얼로 변환하는 웹앱입니다/);
  assert.match(openWorkDetails, /JPG, PNG, MP4를 올려 브라우저에서 바로 프리뷰하고, 필요한 경우 MP4나 PNG로 출력하는 실험용 도구입니다/);
  assert.match(openWorkDetails, /이미지\/영상 업로드 기반 변환\|브라우저 WebGL 프리뷰\|MP4\/PNG 출력 흐름/);
  assert.doesNotMatch(openWorkDetails, /현재는 브라우저 프리뷰만 제공됩니다/);
  assert.doesNotMatch(openWorkDetails, /FastAPI 렌더 잡/);
  assert.match(openWorkDetails, /ffMOCHI는 macOS에서 영상 파일 용량을 가볍게 줄여주는 작은 앱입니다/);
  assert.match(openWorkDetails, /파일을 넣고 프리셋을 고르면 원본 옆에 압축된 MP4를 새로 만들어줍니다/);
  assert.match(openWorkDetails, /MP4\/MOV\/M4V 드래그 앤 드롭\|상황에 맞춘 압축 프리셋\|원본 보존과 새 MP4 출력/);
  assert.doesNotMatch(openWorkDetails, /ad-hoc 서명 DMG/);
  assert.doesNotMatch(openWorkDetails, /touch-designer,Interactive archive/);
  assert.match(openWorkDetails, /ttalkkak-jangpyo,Deck automation/);
  assert.match(openWorkDetails, /ttalkkak-cleaning,Image review agent/);
  assert.match(openWorkDetails, /ttalkkak-jangpyo,[^\n]*공사중/);
  assert.match(openWorkDetails, /ttalkkak-cleaning,[^\n]*공사중/);
  assert.doesNotMatch(openWorkDetails, /jeju-wave-radio,[^\n]*공사중/);
  assert.match(openWorkDetails, /jeju-wave-radio,[^\n]*ON AIR/);
  assert.match(openWorkDetails, /JEJU WAVE RADIO는 제주 바닷가의 파도와 날씨를 실시간 분위기로 엮어내는 웹 라디오입니다/);
  assert.match(openWorkDetails, /실시간 자연 데이터\|앰비언스 사운드 맵핑\|8bit 비주얼 플레이어/);
  assert.match(openWorkDetails, /interactive-visuals,[^\n]*공사중/);
  assert.match(openWorkDetails, /조금만 기다려주세요/);
  assert.match(openWorkDetails, /응원의 메시지 보내기/);
  assert.match(openWorkDetails, /닫아도 유지되는 작업 세션\|상태가 분명한 메뉴바 컨트롤/);
  assert.match(openWorkDetails, /sleepless,[^\n]*피드백(?: 및 문의)? 작성/);

  assert.match(openWorkLinks, /^\uFEFF?slug,label,url,sort/m);
  assert.match(openWorkLinks, /sleepless,Github 페이지 연결,https:\/\/github\.com\/kyutomatte\/sleepless\/,1/);
  assert.match(openWorkLinks, /sleepless,MAC OS용 다운로드,\/assets\/downloads\/sleepless\/Sleepless_0\.1\.2_aarch64\.dmg,2/);
  assert.match(openWorkLinks, /splatify,Web App\(beta\) 이용하기,\/splatify-webapp,1/);
  assert.match(openWorkLinks, /jeju-wave-radio,Web App 이용하기,\/jeju-wave-radio-webapp,1/);
  assert.match(openWorkLinks, /ffmochi,GitHub 페이지 연결,https:\/\/github\.com\/kyutomatte\/ffMOCHI,1/);
  assert.match(openWorkLinks, /ffmochi,MAC OS용 다운로드,\/assets\/downloads\/ffmochi\/ffMOCHI-local\.dmg,2/);
  assert.match(openWorkLinks, /jebi-agent,Github 페이지 연결,https:\/\/github\.com\/kyutomatte\/jebi_agent,1/);
  assert.doesNotMatch(openWorkLinks, /jebi-agent,README 읽기/);

  assert.match(openWorkExamples, /^\uFEFF?slug,kicker,title,media_url,media_type,caption,sort/m);
  assert.match(openWorkExamples, /jeju-wave-radio,Demo,JEJU WAVE RADIO demo,\/assets\/open-works\/jeju-wave-radio\/jeju-wave-radio-demo\.mp4,video,,1/);
  assert.match(openWorkExamples, /splatify,Example,Splatify demo,\/assets\/open-works\/splatify\/splatify-demo\.mov,video,,1/);
  assert.match(openWorkExamples, /jebi-agent,Usage example,제비 요청 인식,\/assets\/open-works\/jebi-agent\/jebi-usage-example\.png,image,[^\n]*제비로 이사갈게요[^\n]*,1/);
  assert.ok(statSync(new URL("../public/assets/open-works/jeju-wave-radio/jeju-wave-radio-demo.mp4", import.meta.url)).isFile());
  assert.ok(statSync(new URL("../public/assets/open-works/jebi-agent/jebi-usage-example.png", import.meta.url)).isFile());

  assert.match(openWorkManuals, /^\uFEFF?slug,section_title,step_title,body,sort/m);
  assert.match(openWorkManuals, /sleepless,SLEEPLESS Manual,설치하기,[^\n]*Apple Silicon[^\n]*DMG[^\n]*,1/);
  assert.match(openWorkManuals, /sleepless,SLEEPLESS Manual,처음 실행 허용하기,[^\n]*개인이 테스트 배포하는 빌드라 아직 Apple 공식 개발자 서명과 공증이 적용되어 있지 않습니다[^\n]*먼저 Done을 눌러 경고창을 닫고[^\n]*System Settings > Privacy & Security[^\n]*Open Anyway[^\n]*완료를 누른 뒤 시스템 설정 > 개인정보 보호 및 보안에서 그래도 열기[^\n]*macOS 버전에 따라 버튼 이름이 조금 다를 수 있습니다[^\n]*,2/);
  assert.match(openWorkManuals, /sleepless,SLEEPLESS Manual,전원 연결 확인하기,[^\n]*AC 전원[^\n]*,3/);
  assert.match(openWorkManuals, /sleepless,SLEEPLESS Manual,문제 시 복구하기,[^\n]*pmset -c disablesleep 0[^\n]*,6/);
  assert.match(openWorkManuals, /ffmochi,ffMOCHI Manual,설치하기,[^\n]*Applications[^\n]*,1/);
  assert.match(openWorkManuals, /ffmochi,ffMOCHI Manual,처음 실행 허용하기,[^\n]*개인이 테스트 배포하는 빌드라 아직 Apple 공식 개발자 서명과 공증이 적용되어 있지 않습니다[^\n]*먼저 Done을 눌러 경고창을 닫고[^\n]*System Settings > Privacy & Security[^\n]*Open Anyway[^\n]*완료를 누른 뒤 시스템 설정 > 개인정보 보호 및 보안에서 그래도 열기[^\n]*macOS 버전에 따라 버튼 이름이 조금 다를 수 있습니다[^\n]*,2/);
  assert.match(openWorkManuals, /ffmochi,ffMOCHI Manual,FFmpeg 준비하기,[^\n]*brew install ffmpeg[^\n]*,3/);
  assert.match(openWorkManuals, /ffmochi,ffMOCHI Manual,문제 시 확인하기,[^\n]*Default MP4[^\n]*_compressed\.mp4[^\n]*,6/);
  assert.match(openWorkManuals, /jebi-agent,JEBI AGENT Tutorial,왜 필요한가,[^\n]*Fork는 너무 많은 history를 복사하고[^\n]*새로 시작하면 맥락을 잃습니다[^\n]*,1/);
  assert.match(openWorkManuals, /jebi-agent,JEBI AGENT Tutorial,설치와 발동,[\s\S]*가장 쉬운 설치 방법은 GitHub 주소와 README를 에이전트에게 전달하는 것입니다[\s\S]*PROMPT: https:\/\/github\.com\/kyutomatte\/jebi_agent[\s\S]*,2/);
  assert.match(openWorkManuals, /jebi-agent,JEBI AGENT Tutorial,환경별 설치 방법,[\s\S]*환경\|가장 쉬운 방법\|계속 쓰는 방법\|발동 문구[\s\S]*ChatGPT \/ GPT[\s\S]*지원되는 Skills\/프로젝트 지침 환경이면 Skill 폴더 또는 SKILL\.md 핵심 규칙을 등록[\s\S]*일반 ChatGPT\/GPT에서는 Custom Instructions[\s\S]*Codex[\s\S]*프로젝트별로 항상 인식시키고 싶다면 AGENTS\.md[\s\S]*Claude 앱[\s\S]*Skill 업로드 UI가 있는 환경에서만[\s\S]*jebi-agent skill을 써줘[\s\S]*Claude Code[\s\S]*~\/\.claude\/skills\/jebi-agent[\s\S]*\/jebi-agent[\s\S]*Gemini CLI[\s\S]*\.toml 기반 custom command[\s\S]*\/commands reload[\s\S]*\/jebi 현재 작업을 새 채팅으로 옮겨줘[\s\S]*기타 LLM[\s\S]*,3/);
  assert.match(openWorkManuals, /jebi-agent,JEBI AGENT Tutorial,터미널 설치,[\s\S]*CMD: scripts\/install-skill\.sh codex[\s\S]*scripts\/install-skill\.sh claude[\s\S]*scripts\/install-skill\.sh all[\s\S]*Gemini와 Cursor는 best-effort adapter입니다\.[\s\S]*\n\n지침\, custom command\, 프로젝트 rule은 설치할 수 있지만[\s\S]*Codex Desktop thread API가 생기지는 않습니다[\s\S]*,4/);
  assert.match(openWorkManuals, /jebi-agent,JEBI AGENT Tutorial,호출 예시,[\s\S]*유형\|예시\|설명[\s\S]*실행어 호출 예시\|\$jebi[\s\S]*자연어 호출 예시\|제비로 옮겨주세요[\s\S]*자연어 호출 예시\|새 채팅으로 제비 보내줘[\s\S]*,5/);
  assert.match(openWorkManuals, /jebi-agent,JEBI AGENT Tutorial,자동으로 넘기는 정보,[\s\S]*현재 repository\, branch\, HEAD\, worktree 상태[\s\S]*\n\nhandoff에는 전체 diff가 아니라 변경 파일 요약[\s\S]*완료한 일과 남은 일[\s\S]*,6/);
  assert.match(openWorkManuals, /jebi-agent,JEBI AGENT Tutorial,작동 방식,[\s\S]*\.codex\/handoffs\/NNN-handoff\.md[\s\S]*latest\.md를 갱신합니다\.[\s\S]*\n\nstate\.json은 retry와 numbering을 위한 로컬 상태로 남깁니다\.[\s\S]*\n\nCodex Desktop에서는 fork가 아니라 thread\/start[\s\S]*,7/);
  assert.match(openWorkManuals, /jebi-agent,JEBI AGENT Tutorial,새 채팅 이름,[\s\S]*UI UX #02[\s\S]*\n\n거기서 다시 옮기면 UI UX #02 #02가 아니라 UI UX #03[\s\S]*project name으로 대체하지 않습니다[\s\S]*,8/);
  assert.match(openWorkManuals, /jebi-agent,JEBI AGENT Tutorial,새 채팅에서 먼저 하는 일,[\s\S]*handoff 파일을 읽고 실제 repo와 비교[\s\S]*\n\n브랜치[\s\S]*불일치가 있으면 먼저 보고합니다[\s\S]*수정하지 않고 사용자 지시를 기다립니다[\s\S]*,9/);
  assert.match(openWorkManuals, /jebi-agent,JEBI AGENT Tutorial,Dirty 상태 다루기,[\s\S]*Clean except JEBI handoff artifacts[\s\S]*\n\n실제 프로젝트 변경과 섞여 있다면 Dirty: project changes \+ JEBI handoff artifacts[\s\S]*,10/);
  assert.match(openWorkManuals, /jebi-agent,JEBI AGENT Tutorial,주의점,[\s\S]*fork가 아닙니다[\s\S]*\n\n전체 이전 채팅 history[\s\S]*AppleScript[\s\S]*undocumented UI API[\s\S]*,11/);
  assert.match(openWorkManuals, /jebi-agent,JEBI AGENT Tutorial,보안 규칙,[\s\S]*API keys\, tokens\, cookies\, authorization headers\, \.env values[\s\S]*\n\n의심되는 값은 REDACTED[\s\S]*,12/);
  assert.match(openWorkManuals, /jebi-agent,JEBI AGENT Tutorial,테스트와 삭제,[\s\S]*python3 -m unittest discover -s tests -v[\s\S]*\n\n삭제할 때는 rm -rf ~\/\.codex\/skills\/jebi-agent[\s\S]*,13/);

  assert.doesNotMatch(packageJson, /sync:data/);
  assert.match(packageJson, /"openworks:xlsx":\s*"python3 scripts\/sync-open-works-workbook\.py --from-csv"/);
  assert.match(packageJson, /"openworks:csv":\s*"python3 scripts\/sync-open-works-workbook\.py --to-csv"/);
  assert.match(packageJson, /"openworks:check":\s*"python3 scripts\/sync-open-works-workbook\.py --check"/);
  assert.match(packageJson, /"works:xlsx":\s*"python3 scripts\/sync-open-works-workbook\.py --dataset works --from-csv"/);
  assert.match(packageJson, /"works:csv":\s*"python3 scripts\/sync-open-works-workbook\.py --dataset works --to-csv"/);
  assert.match(packageJson, /"works:check":\s*"python3 scripts\/sync-open-works-workbook\.py --dataset works --check"/);
  assert.match(readme, /CSV files cannot store multiple sheets/);
  assert.match(readme, /Edit the `\.xlsx` files in Excel/);
  assert.doesNotMatch(readme, /Google Sheet Sync/);

  assert.match(openWorksWorkbookScript, /CSV files cannot contain multiple sheets/);
  assert.match(openWorksWorkbookScript, /"public\/data\/open-works\.xlsx"/);
  assert.match(openWorksWorkbookScript, /"public\/data\/works\.xlsx"/);
  assert.match(openWorksWorkbookScript, /"open-works"/);
  assert.match(openWorksWorkbookScript, /"open-work-details"/);
  assert.match(openWorksWorkbookScript, /image_alt,external_note/);
  assert.match(openWorksWorkbookScript, /"open-works-page"/);
  assert.match(openWorksWorkbookScript, /"open-work-links"/);
  assert.match(openWorksWorkbookScript, /"open-work-examples"/);
  assert.doesNotMatch(openWorksWorkbookScript, /"open-work-embeds"/);
  assert.match(openWorksWorkbookScript, /"open-work-manuals"/);
  assert.match(openWorksWorkbookScript, /"works"/);
  assert.match(openWorksWorkbookScript, /"work-media"/);
  assert.match(openWorksWorkbookScript, /missing header row; refusing to export an empty sheet/);
});

test("open works have shared landing pages and routes", async () => {
  const html = await readProjectFile("index.html");
  const js = await readProjectFile("src/main.js");
  const css = await readProjectFile("src/styles.css");

  assert.match(html, /data-route="open-work"/);
  assert.match(html, /data-open-work-page/);
  assert.match(html, /data-open-work-media/);
  assert.match(html, /data-open-work-image/);
  assert.match(html, /data-open-work-title/);
  assert.match(html, /data-open-work-external-links/);
  assert.match(html, /data-open-work-external-note/);
  assert.doesNotMatch(js, /function renderOpenWorkExternalNote/);
  assert.match(js, /externalNote\.replaceChildren/);
  assert.match(html, /data-open-work-features/);
  assert.doesNotMatch(html, /data-open-work-embed/);
  assert.match(html, /data-open-work-example/);
  assert.match(html, /data-open-work-example-title/);
  assert.match(html, /data-open-work-example-media/);
  assert.match(html, /data-open-work-manual/);
  assert.match(html, /data-open-work-manual-title/);
  assert.match(html, /data-open-work-manual-steps/);
  assert.match(html, /data-open-work-related/);
  assert.match(html, /href="%BASE_URL%home"[\s\S]*>Home</);
  assert.match(html, /href="%BASE_URL%open-works"[\s\S]*>Open works</);
  assert.match(html, /data-scroll-top[\s\S]*>Top</);
  assert.doesNotMatch(html, /open-work-nav[\s\S]*Contact/);
  assert.match(html, /data-route="open-works"/);
  assert.match(html, /data-open-works-index-list/);
  assert.match(html, /data-route="splatify-webapp"/);
  assert.match(html, /data-splatify-webapp-frame/);
  assert.match(html, /data-route="splatify-webapp-export"/);
  assert.match(html, /data-splatify-export-frame/);
  assert.match(html, /data-route="jeju-wave-radio-webapp"/);
  assert.match(html, /JEJU WAVE RADIO WEB APP/);
  assert.match(html, /data-route="feedback"/);
  assert.match(html, /data-feedback-form/);
  assert.match(html, /data-feedback-status/);
  assert.match(html, /<button class="feedback-submit" type="submit">SUBMIT<\/button>/);

  assert.match(js, /openWorkDetailsBySlug/);
  assert.match(js, /"touch-designer":\s*"interactive-visuals"/);
  assert.match(js, /getOpenWorkSlug/);
  assert.match(js, /getCanonicalOpenWorkSlug/);
  assert.match(js, /getOpenWorkDetails/);
  assert.match(js, /renderOpenWorkPage/);
  assert.match(js, /renderOpenWorksIndex/);
  assert.match(js, /openWorksPageRows/);
  assert.match(js, /getSafeOpenWorkExternalUrl/);
  assert.match(js, /\["https:",\s*"http:",\s*"mailto:"\]\.includes\(url\.protocol\)/);
  assert.match(js, /Open work not found/);
  assert.match(js, /목록에서 다시 선택해주세요/);
  assert.match(js, /fetchCsv\("\/data\/open-works-page\.csv"\)/);
  assert.match(js, /renderFeedbackPage/);
  assert.match(js, /handleFeedbackSubmit/);
  assert.match(js, /FEEDBACK_ENDPOINT/);
  assert.match(js, /VITE_FEEDBACK_ENDPOINT/);
  assert.match(js, /fetch\(FEEDBACK_ENDPOINT/);
  assert.match(js, /JSON\.stringify\(payload\)/);
  assert.match(js, /feedback-work-select/);
  assert.match(js, /fetchCsv\("\/data\/open-work-details\.csv"\)/);
  assert.match(js, /fetchCsv\("\/data\/open-work-links\.csv"\)/);
  assert.match(js, /fetchCsv\("\/data\/open-work-examples\.csv"\)/);
  assert.match(js, /fetchCsv\("\/data\/open-work-manuals\.csv"\)/);
  assert.match(js, /openWorkExternalLinksBySlug/);
  assert.match(js, /openWorkExamplesBySlug/);
  assert.match(js, /getOpenWorkExamples/);
  assert.match(js, /SPLATIFY_WEBAPP_URL/);
  assert.match(js, /syncSplatifyWebappFrames/);
  assert.match(js, /"jeju-wave-radio-webapp"/);
  assert.match(js, /externalNote/);
  assert.doesNotMatch(js, /openWorkEmbedsBySlug/);
  assert.match(js, /openWorkManualsBySlug/);
  assert.match(js, /getOpenWorkManuals/);
  assert.match(js, /renderManualStepBody/);
  assert.match(js, /renderJebiManualBody/);
  assert.match(js, /renderManualTable/);
  assert.match(js, /renderManualCallGrid/);
  assert.match(js, /renderManualRichBlocks/);
  assert.match(js, /open-work-manual-note/);
  assert.match(js, /open-work-manual-path/);
  assert.match(js, /open-work-manual-smallprint/);
  assert.match(js, /open-work-manual-table/);
  assert.match(js, /open-work-manual-call-grid/);
  assert.match(js, /open-work-manual-call-card/);
  assert.match(js, /open-work-manual-prompt/);
  assert.match(js, /open-work-manual-code/);
  assert.match(js, /detail_summary/);
  assert.match(js, /image_url/);
  assert.match(js, /has-open-work-media/);
  assert.match(js, /Open Works — KYUTO\.MATTE/);
  assert.match(js, /Feedback — KYUTO\.MATTE/);
  assert.doesNotMatch(js, /닫아도 유지되는 작업 세션/);
  assert.doesNotMatch(js, /JEJU WAVE RADIO는 날씨 데이터/);

  assert.match(css, /body\[data-page="open-work"\]/);
  assert.match(css, /body\[data-page="open-works"\]/);
  assert.match(css, /body\[data-page="jeju-wave-radio-webapp"\]/);
  assert.match(css, /body\[data-page="feedback"\]/);
  assert.match(css, /\.open-work-page/);
  assert.match(css, /\.open-work-hero/);
  assert.match(css, /\.open-work-summary\s*\{[^}]*text-wrap:\s*balance;/s);
  assert.match(css, /\.open-work-summary\s*\{[^}]*word-break:\s*keep-all;/s);
  assert.match(css, /\.open-work-feature p\s*\{[^}]*word-break:\s*keep-all;/s);
  assert.doesNotMatch(css, /\.open-work-feature p\s*\{[^}]*max-width:\s*28rem;/s);
  assert.match(css, /\.open-work-media/);
  assert.match(css, /\.open-work-external-links/);
  assert.match(css, /\.open-work-external-link/);
  assert.doesNotMatch(js, /getOpenWorkExternalLinkNote|open-work-external-link-note/);
  assert.doesNotMatch(css, /\.open-work-external-link\.has-note/);
  assert.doesNotMatch(css, /\.open-work-external-link-note/);
  assert.match(css, /\.open-work-external-link\s*\{[^}]*min-height:\s*3\.4rem;[^}]*padding:\s*0\.52rem\s+0\.9rem\s+0\.58rem;/s);
  assert.match(css, /\.open-work-external-actions\s*\{[^}]*display:\s*grid;[^}]*gap:\s*0\.58rem;/s);
  assert.doesNotMatch(css, /\.open-work-external-note::before/);
  assert.doesNotMatch(js, /text\.match\(/);
  assert.match(css, /\.open-work-feature-grid/);
  assert.match(css, /\.open-work-example/);
  assert.match(css, /\.open-work-example-media\s+video\s*\{[^}]*width:\s*100%;/s);
  assert.match(css, /\.splatify-webapp-page/);
  assert.match(css, /\.splatify-webapp-frame\s+iframe\s*\{[^}]*height:\s*max\(68rem,\s*calc\(100vh - 24rem\)\);/s);
  assert.doesNotMatch(css, /\.open-work-embed/);
  assert.match(css, /\.open-work-manual/);
  assert.match(css, /\.open-work-manual-note/);
  assert.match(css, /\.open-work-manual-path/);
  assert.match(css, /\.open-work-manual-smallprint/);
  assert.match(css, /\.open-work-manual-table/);
  assert.match(css, /\.open-work-manual-call-grid/);
  assert.match(css, /\.open-work-manual-call-card/);
  assert.match(css, /width:\s*min\(100%,\s*92rem\);/);
  assert.match(css, /\.open-work-manual-prompt\s*\{[^}]*white-space:\s*nowrap;/s);
  assert.match(css, /\.open-work-manual-prompt/);
  assert.match(css, /\.open-work-manual-code/);
  assert.match(css, /\.open-work-manual-heading h2\s*\{[^}]*font-size:\s*clamp\(2\.2rem,\s*2\.6vw,\s*3\.4rem\);/s);
  assert.match(css, /\.open-work-manual-heading h2\s*\{[^}]*white-space:\s*normal;/s);
  assert.match(css, /\.open-work-manual-heading h2\s*\{[^}]*overflow-wrap:\s*anywhere;/s);
  assert.match(css, /\.open-work-manual-step/);
  assert.match(css, /\.open-work-manual-step\s*\{[^}]*align-items:\s*baseline;/s);
  assert.match(css, /\.open-work-manual-step p\s*\{[^}]*max-width:\s*none;/s);
  assert.match(css, /\.open-work-related-link/);
  assert.doesNotMatch(css, /\.open-works-heading-link::after/);
  assert.match(css, /\.open-works-heading-link:hover\s*\{[^}]*color:\s*rgba\(45,\s*45,\s*45,\s*0\.68\);/s);
  assert.match(css, /\.open-works-index-page/);
  assert.match(css, /\.open-works-index-hero\s*\{[^}]*min-height:\s*clamp\(18rem,\s*28vh,\s*30rem\);/s);
  assert.match(css, /\.open-work-index-link p/);
  assert.match(css, /\.open-work-index-link small\s*\{[^}]*justify-self:\s*end;/s);
  assert.match(css, /\.open-work-index-link small\s*\{[^}]*text-align:\s*right;/s);
  assert.match(css, /\.open-work-index-link:hover p\s*\{[^}]*color:\s*rgba\(251,\s*250,\s*247,\s*0\.82\);/s);
  assert.match(css, /\.feedback-page/);
});

test("kyutomatte page exposes the detailed profile and work archive", async () => {
  const html = await readProjectFile("index.html");
  const js = await readProjectFile("src/main.js");

  assert.match(html, /id="kyutomatte"/);
  assert.match(html, /KYUTOMATTE/);
  assert.match(html, /서울을 기반으로 아티스트와 브랜드를 위한 비주얼 크리에이티브 작업을 합니다/);
  assert.match(html, /Seoul-based visual creative working across artist visuals/);
  assert.match(html, /VISUAL WORKS/);
  assert.match(html, /for BLACKPINK/);
  assert.match(html, /for BABYMONSTER/);
  assert.match(html, /for ENHYPEN/);
  assert.match(html, /AI WORKS/);
  assert.match(html, /Full AI\s+commercial video/);
  assert.match(html, /2GJfWMYCWY0/);
  assert.doesNotMatch(html, /aria-label="AI works"[\s\S]*2GJfWMYCWY0/);
  assert.match(js, /kyutomatte/);
});

test("cargo route preserves the earlier clone structure and visual tokens", async () => {
  const html = await readProjectFile("index.html");
  const css = await readProjectFile("src/styles.css");

  assert.match(html, /data-route="cargo"/);
  assert.match(html, /Cargo legacy clone/);
  assert.match(html, /marquee-strip/);
  assert.match(html, /CLICK/);
  assert.match(html, /ME/);
  assert.match(html, /site-border/);
  assert.match(css, /#ff2301/);
  assert.match(css, /1\.2rem/);
  assert.match(css, /11rem/);
  assert.match(css, /drop-shadow\(0 0 0\.58rem #ff0456\)/);
  assert.match(css, /CargoMonumentGroteskPlusVariable\.woff2/);
});

test("marquee uses Cargo rem scale and content-height strip", async () => {
  const css = await readProjectFile("src/styles.css");

  assert.match(css, /html\s*\{[^}]*font-size:\s*10px;/s);
  assert.match(css, /\.marquee-strip\s*\{[^}]*height:\s*auto;/s);
  assert.doesNotMatch(css, /\.marquee-strip\s*\{[^}]*height:\s*70vh;/s);
  assert.doesNotMatch(css, /animation-play-state:\s*paused/);
});

test("new portfolio stylesheet uses swapped two-column editorial feed layout", async () => {
  const css = await readProjectFile("src/styles.css");

  assert.match(css, /--editorial-paper:\s*#fbfaf7;/);
  assert.match(css, /--editorial-ink:\s*#2d2d2d;/);
  assert.match(css, /body\[data-page="home"\]\s*\{[^}]*background:\s*var\(--editorial-paper\);/s);
  assert.match(css, /\.home-shell\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*1px\s*minmax\(30rem,\s*49rem\);/s);
  assert.match(css, /\.home-shell::before\s*\{[^}]*grid-column:\s*2;/s);
  assert.match(css, /\.home-feed-panel\s*\{[^}]*grid-column:\s*1;/s);
  assert.match(css, /\.home-feed-panel\s*\{[^}]*border-right:\s*0;/s);
  assert.match(css, /\.home-info-panel\s*\{[^}]*grid-column:\s*3;/s);
  assert.match(css, /\.home-info-panel\s*\{[^}]*border-left:\s*0;/s);
  assert.match(css, /\.panel-bar\s*\{[^}]*min-height:\s*4\.9rem;/s);
  assert.match(css, /\.info-bar\s*\{[^}]*justify-content:\s*space-between;/s);
  assert.match(css, /\.top-link\s*\{[^}]*border:\s*1px solid var\(--editorial-rule\);/s);
  assert.match(css, /\.top-link\s*\{[^}]*border-radius:\s*999rem;/s);
  assert.match(css, /\.top-link\s*\{[^}]*font-size:\s*1\.48rem;/s);
  assert.match(css, /\.work-view-button\[aria-pressed="true"\],\s*\.category-filter-button\[aria-pressed="true"\]\s*\{[^}]*border-color:\s*var\(--editorial-ink\);/s);
  assert.match(css, /\.work-view-icon\s*\{/);
  assert.match(css, /\.work-view-icon-list::before\s*\{/);
  assert.match(css, /\.work-view-icon-grid\s*\{/);
  assert.match(css, /\.category-filter\s*\{/);
  assert.match(css, /\.category-filter-button\[aria-pressed="true"\]\s*\{/);
  assert.match(css, /\.summary-row\s*\{/);
  assert.match(css, /\.summary-list\s*\{[^}]*border-bottom:\s*1px solid var\(--editorial-rule\);/s);
  assert.match(css, /\.summary-row-year\s*\{[^}]*white-space:\s*nowrap;/s);
  assert.match(css, /\.summary-row-label\s*\{[^}]*white-space:\s*nowrap;/s);
  assert.match(css, /\.summary-detail-list\s*\{/);
  assert.match(css, /\.summary-detail-row\s*\{/);
  assert.match(css, /\.summary-detail-media\s*\{/);
  assert.match(css, /\.summary-detail-media\s+iframe,/);
  assert.match(css, /\.summary-work-group\[data-summary-expanded="true"\]\s+\.summary-group-body\s*\{/);
  assert.match(css, /\.overview-stills-grid\s*\{/);
  assert.match(css, /\.overview-still-button\s*\{/);
  assert.match(css, /\[data-view-panel\]\s*\{[^}]*max-height:\s*0;/s);
  assert.match(css, /\.new-home-page\[data-work-view="summary"\]\s+\[data-view-panel="summary"\]/);
  assert.match(css, /\.new-home-page\[data-work-view="overview"\]\s+\[data-view-panel="overview"\]/);
  assert.match(
    css,
    /\.new-home-page\[data-work-view="summary"\]\s+\[data-view-panel="summary"\],\s*\.new-home-page\[data-work-view="overview"\]\s+\[data-view-panel="overview"\]\s*\{[^}]*max-height:\s*none;[^}]*overflow:\s*visible;/s
  );
  assert.match(css, /\.summary-group-body\s*\{[^}]*transition:\s*max-height/s);
  assert.match(
    css,
    /\.summary-work-group\[data-summary-expanded="true"\]\s+\.summary-group-body\s*\{[^}]*max-height:\s*none;[^}]*overflow:\s*visible;/s
  );
  assert.match(css, /\.feed-work-group\s*\{[^}]*max-height:\s*none;[^}]*overflow:\s*visible;/s);
  assert.match(css, /\.feed-entry\s*\{[^}]*max-height:\s*none;[^}]*overflow:\s*visible;/s);
  assert.match(css, /\.gallery-lightbox\s*\{/);
  assert.match(css, /\.gallery-lightbox\.is-open\s*\{/);
  assert.match(css, /\.gallery-stage\s*\{/);
  assert.match(css, /\.open-work-link\s*\{[^}]*align-items:\s*center;/s);
  assert.match(css, /\.open-work-link\s+small\s*\{[^}]*white-space:\s*pre-line;/s);
  assert.match(css, /\.open-work-link:hover\s+small\s*\{[^}]*color:\s*rgba\(251,\s*250,\s*247,\s*0\.78\);/s);
  assert.doesNotMatch(css, /\[data-view-panel\]\s*\{[^}]*display:\s*none;/s);
  assert.match(css, /\.logo-mark\s*\{[^}]*width:\s*10\.8rem;/s);
  assert.match(css, /\.logo-mark\s*\{[^}]*height:\s*2\.7rem;/s);
  assert.match(css, /\.kyuto-logo\s*\{[^}]*object-fit:\s*cover;/s);
  assert.match(css, /\.info-section\s*\{[^}]*border-bottom:\s*1px solid var\(--editorial-rule\);/s);
  assert.match(css, /\.panel-bar\s*\{[^}]*border-bottom:\s*1px solid var\(--editorial-rule\);/s);
  assert.match(css, /\.info-lede\s*\{[^}]*font-weight:\s*620;/s);
  assert.match(css, /\.info-detail\s*\{[^}]*font-weight:\s*440;/s);
  assert.match(css, /\.contact-card\s*\{[^}]*border:\s*1px solid var\(--editorial-rule\);/s);
  assert.match(css, /\.contact-link-static\s*\{[^}]*cursor:\s*default;/s);
  assert.match(css, /\.contact-link:not\(\.contact-link-static\):hover\s*\{/);
  assert.match(css, /\.open-work-link\s*\{[^}]*border:\s*1px solid var\(--editorial-rule\);/s);
  assert.doesNotMatch(css, /\.new-home-page[\s\S]*linear-gradient/);
});

test("kyutomatte page keeps Cargo colors, typography, and flowing media layout", async () => {
  const css = await readProjectFile("src/styles.css");

  assert.match(css, /--cargo-red:\s*#ff2301;/);
  assert.match(css, /body\[data-page="kyutomatte"\]\s*\{[^}]*background:\s*#2fff00;/s);
  assert.doesNotMatch(css, /linear-gradient\(135deg/);
  assert.match(css, /\.marquee-strip\s*\{[^}]*color:\s*#fff;/s);
  assert.match(css, /\.bodycopy2\s*\{[^}]*font-family:\s*"Happy Times at the IKOB",\s*"Apple SD Gothic Neo"/s);
  assert.match(css, /\.bodycopy2\s+b\s*\{[^}]*font-weight:\s*700;/s);
  assert.match(css, /\.bodycopy2\s+p:first-child\s*\{[^}]*margin-bottom:\s*3rem;/s);
  assert.match(css, /\.visual-work-section\s+\.media-frame,\s*\.visual-work-section\s+\.media-card\s*\{[^}]*width:\s*min\(91\.8rem,\s*100%\);/s);
  assert.match(css, /\.media-grid\s*\{[^}]*display:\s*block;/s);
  assert.match(css, /\.ai-work-list\s*\{[^}]*display:\s*block;/s);
  assert.match(css, /\.ai-work-list\s+\.media-card:nth-child\(-n \+ 2\)\s*\{[^}]*width:\s*min\(37\.4rem,\s*100%\);/s);
  assert.match(css, /\.ai-work-list\s+\.media-card:nth-child\(3\)\s*\{[^}]*width:\s*min\(92\.2rem,\s*100%\);/s);
  assert.match(css, /\.ai-work-list\s+\.media-card:nth-child\(4\)\s*\{[^}]*width:\s*min\(52\.4rem,\s*100%\);/s);
  assert.match(css, /\.ai-work-list\s+\.media-card-wide:nth-child\(6\)\s*\{[^}]*margin-left:\s*calc\(50vw - 1\.3rem\);/s);
});

test("local assets needed for the first viewport are present", () => {
  const requiredAssets = [
    "public/assets/butterfly_resize02.mp4",
    "public/assets/checkerboard_64.png",
    "public/assets/favicon.ico",
    "public/assets/KYUTO-LOGO.png",
    "public/assets/works/blackpink-go/01-main.jpg",
    "public/assets/works/blackpink-go/17-last.jpg",
    "public/assets/works/babymonster-ilikeit/01-main.jpg",
    "public/assets/works/babymonster-ilikeit/21-img-9764.jpg",
    "public/assets/works/album-cover-lack/01-main.png",
    "public/assets/works/album-cover-crane/01-main.jpg",
    "public/assets/works/album-cover-laegyu/01-main.png",
    "public/assets/works/poster-2026-kyuto31/01-main.jpeg",
    "public/assets/works/poster-2026-kyuto31/02-kyutoturns31.jpeg",
    "public/assets/works/poster-2026-kyuto31/03-kyuto3.jpeg",
    "public/assets/works/poster-2026-kyuto31/04-cherry-horizontal.jpeg",
    "public/assets/works/poster-2026-kyuto31/05-tostitos.jpeg",
    "public/assets/works/poster-2026-kyuto31/06-ice-cream.jpeg",
    "public/assets/works/poster-2025-kyuto30/01-main.jpeg",
    "public/assets/works/poster-2025-kyuto30/02-poster-page-1.jpeg",
    "public/assets/works/poster-2025-kyuto30/03-poster-page-3.jpeg",
    "public/assets/works/poster-2025-kyuto30/04-poster-page-4.jpeg",
    "public/assets/works/poster-2025-hanni/01-cucumber.jpeg",
    "public/assets/works/poster-2025-hanni/02-celebration-lp.jpeg",
    "public/assets/works/poster-2025-hanni/03-dugon-lp.jpeg",
    "public/assets/works/poster-2025-hanni/04-fortune-cookie.jpeg",
    "public/assets/works/poster-2025-hanni/05-sticker-sheet.jpeg",
    "public/assets/works/poster-2025-hanni/06-reference-sheet.jpeg",
    "public/assets/works/ojat-lookbook-2020-development/01-main.jpeg",
    "public/assets/works/ojat-lookbook-2020-development/02-134.jpg",
    "public/assets/works/ojat-lookbook-2020-development/03-portfolio-1.jpeg",
    "public/assets/works/ojat-lookbook-2020-development/04-portfolio-2.jpeg",
    "public/assets/works/ojat-lookbook-2020-development/05-portfolio-3.jpeg",
    "public/assets/works/ojat-lookbook-2020-development/06-portfolio-4.jpeg",
    ...ojatLookbook2020Files.map((file) => `public/assets/works/ojat-lookbook-2020/${file}`),
    ...ojatLookbook2020EditorialFiles.map((file) => `public/assets/works/ojat-lookbook-2020-editorial/${file}`),
    ...ojatMagazineYunwhayFiles.map((file) => `public/assets/works/ojat-magazine-yunwhay/${file}`),
    ...ojatMagazinePapFiles.map((file) => `public/assets/works/ojat-magazine-pap/${file}`),
    ...ojatMagazineBabyyanaFiles.map((file) => `public/assets/works/ojat-magazine-babyyana/${file}`),
    ...ojatMagazineChorongFiles.map((file) => `public/assets/works/ojat-magazine-chorong/${file}`),
    ...ojatMagazineSchonFiles.map((file) => `public/assets/works/ojat-magazine-schon/${file}`),
    ...ojatMagazineNainFiles.map((file) => `public/assets/works/ojat-magazine-nain/${file}`),
    ...ojatMagazineYenaFiles.map((file) => `public/assets/works/ojat-magazine-yena/${file}`),
    ...ojatMagazineUggFiles.map((file) => `public/assets/works/ojat-magazine-ugg/${file}`),
    ...vfx2025XgFiles.map((file) => `public/assets/works/vfx-2025-xg/${file}`),
    ...vfx2025AesopFiles.map((file) => `public/assets/works/vfx-2025-aesop/${file}`),
    ...vfx2026LunarNewYearFiles.map((file) => `public/assets/works/vfx-2026-lunanewyear/${file}`),
    ...vfx2025KiiiKiiiFiles.map((file) => `public/assets/works/vfx-2025-kiiikiii/${file}`),
    ...vfx2025NikeFiles.map((file) => `public/assets/works/vfx-2025-nike/${file}`),
    ...vfx2025VivienneFiles.map((file) => `public/assets/works/vfx-2025-vivienne/${file}`),
    ...ohirBrandFilmFiles.map((file) => `public/assets/works/ohir-brand-film/${file}`),
    ...vfx2026ShowreelFiles.map((file) => `public/assets/works/vfx-2026-showreel/${file}`),
    ...vfx2026VideoOnlyFiles.map((file) => `public/assets/works/${file}`),
    "public/assets/open-works/splatify/splatify-demo.mov",
    "public/assets/downloads/sleepless/Sleepless_0.1.2_aarch64.dmg",
    "public/assets/downloads/ffmochi/ffMOCHI-local.dmg",
    "public/assets/CargoMonumentGroteskPlusVariable.woff2",
    "public/assets/CargoArizonaPlusVariable.woff2",
    "public/assets/Cargo-DiatypePlusVariable.woff2",
    "public/assets/HappyTimesAtTheIKOBNewGamePlusEdition-Regular.woff",
    "public/assets/HappyTimesAtTheIKOBNewGamePlusEdition-Bold.woff"
  ];

  for (const assetPath of requiredAssets) {
    const stats = statSync(new URL(`../${assetPath}`, import.meta.url));
    assert.ok(stats.size > 1000, `${assetPath} should be a real downloaded asset`);
  }

  for (const dataPath of [
    "public/data/works.csv",
    "public/data/works.xlsx",
    "public/data/work-media.csv",
    "public/data/open-works.csv",
    "public/data/open-works.xlsx",
    "public/data/open-works-page.csv",
    "public/data/open-work-links.csv",
    "public/data/open-work-examples.csv",
    "public/data/open-work-manuals.csv",
    "public/data/open-work-details.csv"
  ]) {
    const stats = statSync(new URL(`../${dataPath}`, import.meta.url));
    assert.ok(stats.size > 20, `${dataPath} should contain editable rows`);
  }
});
