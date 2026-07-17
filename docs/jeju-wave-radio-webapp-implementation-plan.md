# JEJU WAVE RADIO Static Embed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the playable JEJU WAVE RADIO browser app from the KYUTODAZE Pages repository at the existing `/jeju-wave-radio-webapp` route.

**Architecture:** Keep the app isolated as a static mini-site in `public/apps/jeju-wave-radio/` and load it through the existing full-screen web-app route. The outer route resolves the iframe URL with the site base-path helper; the inner app keeps its relative video URLs and calls Open-Meteo directly, falling back to its existing default values when live requests fail.

**Tech Stack:** Vite, vanilla ES modules, Node test runner, static MP4 assets, WebGL, Web Audio, Open-Meteo public APIs, GitHub Pages.

## Global Constraints

- Serve every Jeju app file from `public/apps/jeju-wave-radio/`; do not use `localhost` or a separately deployed app.
- Preserve the six source MP4 files and the relative `../assets/video/` lookup in `renderer.js`.
- Resolve the iframe URL with `toPublicAssetUrl()` for both the GitHub Pages base path and a custom-domain root.
- Require the visitor to press `START AUDIO`; declare `allow="autoplay"` on the iframe.
- Preserve the direct Open-Meteo requests and the app's live-partial/fallback status behavior.
- Do not stage or modify the pre-existing `.gitignore` and `.codex/handoffs/` JEBI artifacts.

---

## File Structure

- `public/apps/jeju-wave-radio/web/` — app HTML, CSS, ES modules, button image, and its existing Node tests.
- `public/apps/jeju-wave-radio/assets/video/` — six MP4s loaded through `../assets/video/<state>.mp4`.
- `index.html` — existing Jeju route; gains the app iframe.
- `src/main.js` — assigns/removes the app source during route changes.
- `tests/site.test.js` — asserts the local iframe contract and complete static asset set.
- `README.md` — documents the route, data source, assets, and focused test command.

### Task 1: Define the local-app contract with a failing test

**Files:**
- Modify: `tests/site.test.js`

**Interfaces:**
- Consumes: `index.html`, `src/main.js`, and the static paths created in Task 2.
- Produces: a regression test for the iframe selector, base-path URL, opt-in audio permission, app controls, renderer path, and six MP4s.

- [ ] **Step 1: Add this test after the existing open-works route test**

```js
test('Jeju Wave Radio is served as a local static web app', async () => {
  const html = await readProjectFile('index.html');
  const js = await readProjectFile('src/main.js');
  const appHtml = await readProjectFile('public/apps/jeju-wave-radio/web/index.html');
  const renderer = await readProjectFile('public/apps/jeju-wave-radio/web/src/renderer.js');
  const videos = ['sunny_day.mp4', 'sunny_night.mp4', 'cloudy_day.mp4', 'cloudy_night.mp4', 'rainy_day.mp4', 'rainy_night.mp4'];

  assert.match(html, /data-jeju-wave-radio-frame/);
  assert.match(html, /title="JEJU WAVE RADIO web app"/);
  assert.match(html, /data-jeju-wave-radio-frame[^>]*allow="autoplay"/);
  assert.match(js, /const JEJU_WAVE_RADIO_WEBAPP_PATH = "\/apps\/jeju-wave-radio\/web\/"/);
  assert.match(js, /toPublicAssetUrl\(JEJU_WAVE_RADIO_WEBAPP_PATH\)/);
  assert.match(js, /data-jeju-wave-radio-frame/);
  assert.match(renderer, /\.\.\/assets\/video\/\${state}\.mp4/);
  assert.match(appHtml, /id="start-audio"/);
  assert.match(appHtml, /id="refresh-live-data"/);
  videos.forEach((file) => {
    assert.ok(statSync(new URL(`../public/apps/jeju-wave-radio/assets/video/${file}`, import.meta.url)).isFile());
  });
});
```

- [ ] **Step 2: Run the test before implementation**

Run: `node --test --test-name-pattern='Jeju Wave Radio is served as a local static web app' tests/site.test.js`

Expected: FAIL because the local app entry and iframe do not exist.

- [ ] **Step 3: Commit the test-only checkpoint**

```bash
git add tests/site.test.js
git commit -m "test: define local Jeju web app contract"
```

### Task 2: Copy the portable app and visual assets

**Files:**
- Create: `public/apps/jeju-wave-radio/web/{index.html,styles.css,src/app.js,src/weather.js,src/renderer.js,src/synth.js}`
- Create: `public/apps/jeju-wave-radio/web/{assets/jeju-blue-night-button.png,tests/embed.test.mjs,tests/renderer.test.mjs,tests/weather.test.mjs,tests/synth.test.mjs}`
- Create: `public/apps/jeju-wave-radio/assets/video/{sunny_day,sunny_night,cloudy_day,cloudy_night,rainy_day,rainy_night}.mp4`

**Interfaces:**
- Consumes: `/Users/jongkyu/Documents/Plugdata/web/` and `/Users/jongkyu/Documents/Plugdata/assets/video/`.
- Produces: `web/index.html` loading `./src/app.js`; the copied renderer resolves the sibling video directory unchanged.

- [ ] **Step 1: Copy the app and six videos without changing their relative arrangement**

```bash
mkdir -p public/apps/jeju-wave-radio
cp -R /Users/jongkyu/Documents/Plugdata/web public/apps/jeju-wave-radio/web
mkdir -p public/apps/jeju-wave-radio/assets
cp -R /Users/jongkyu/Documents/Plugdata/assets/video public/apps/jeju-wave-radio/assets/video
```

- [ ] **Step 2: Inspect the copied runtime paths and API endpoints**

```bash
rg -n "\.\./assets/video/\${state}\.mp4|https://api\.open-meteo\.com|https://marine-api\.open-meteo\.com|https://air-quality-api\.open-meteo\.com" \
  public/apps/jeju-wave-radio/web/src/renderer.js \
  public/apps/jeju-wave-radio/web/src/weather.js
```

Expected: the relative video template and all three public Open-Meteo endpoints are printed.

- [ ] **Step 3: Run the copied app test suite**

Run: `node --test public/apps/jeju-wave-radio/web/tests/*.test.mjs`

Expected: PASS, covering weather fallback, all six video states, Web Audio start, and the explicit-audio embed contract.

- [ ] **Step 4: Commit the portable bundle**

```bash
git add public/apps/jeju-wave-radio
git commit -m "feat: add portable Jeju Wave Radio web app"
```

### Task 3: Replace the Jeju placeholder with a base-path-aware frame

**Files:**
- Modify: `index.html:204-223`
- Modify: `src/main.js:39-40,397-416`

**Interfaces:**
- Consumes: `toPublicAssetUrl(path)` already imported by `src/main.js` and Task 2's app directory.
- Produces: `data-jeju-wave-radio-frame`, populated only on the `jeju-wave-radio-webapp` route and cleared for all other routes.

- [ ] **Step 1: Replace the placeholder article with this app frame**

```html
<article class="splatify-webapp-shell">
  <section class="splatify-webapp-hero" aria-labelledby="jeju-wave-radio-webapp-title">
    <p class="open-work-kicker">Ambient web radio</p>
    <h1 id="jeju-wave-radio-webapp-title">JEJU WAVE RADIO WEB APP</h1>
  </section>
  <section class="splatify-webapp-frame" aria-label="JEJU WAVE RADIO web app">
    <iframe data-jeju-wave-radio-frame title="JEJU WAVE RADIO web app" allow="autoplay"></iframe>
  </section>
</article>
```

- [ ] **Step 2: Add the local path and extend the existing iframe synchronizer**

```js
const SPLATIFY_WEBAPP_URL = "https://kyutomatte.github.io/splatify-pre-release/";
const JEJU_WAVE_RADIO_WEBAPP_PATH = "/apps/jeju-wave-radio/web/";

function syncSplatifyWebappFrames(route) {
  const webappFrame = document.querySelector("[data-splatify-webapp-frame]");
  const exportFrame = document.querySelector("[data-splatify-export-frame]");
  const jejuWaveRadioFrame = document.querySelector("[data-jeju-wave-radio-frame]");

  if (webappFrame) {
    if (route === "splatify-webapp") webappFrame.src = SPLATIFY_WEBAPP_URL;
    else webappFrame.removeAttribute("src");
  }
  if (exportFrame) {
    if (route === "splatify-webapp-export") exportFrame.src = getSplatifyExportUrl();
    else exportFrame.removeAttribute("src");
  }
  if (jejuWaveRadioFrame) {
    if (route === "jeju-wave-radio-webapp") {
      jejuWaveRadioFrame.src = toPublicAssetUrl(JEJU_WAVE_RADIO_WEBAPP_PATH);
    } else {
      jejuWaveRadioFrame.removeAttribute("src");
    }
  }
}
```

- [ ] **Step 3: Run the contract test and complete site suite**

Run: `node --test --test-name-pattern='Jeju Wave Radio is served as a local static web app' tests/site.test.js && npm test`

Expected: PASS; the test verifies the local route, app controls, relative video layout, and six MP4s.

- [ ] **Step 4: Commit the route integration**

```bash
git add index.html src/main.js tests/site.test.js
git commit -m "feat: embed Jeju Wave Radio in Pages route"
```

### Task 4: Document and verify the deployable artifact

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: the route and static app delivered by Tasks 2 and 3.
- Produces: public maintenance instructions and artifact-level checks.

- [ ] **Step 1: Add this section after `## Checks`**

```markdown
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
```

- [ ] **Step 2: Build and assert that the output contains the app and direct route**

Run: `npm run build && test -f dist/apps/jeju-wave-radio/web/index.html && test -f dist/apps/jeju-wave-radio/assets/video/sunny_day.mp4 && test -f dist/jeju-wave-radio-webapp/index.html`

Expected: Vite completes, Pages route entries are created, and all three generated paths exist.

- [ ] **Step 3: Run the real-world verification checklist locally and after the Pages workflow succeeds**

```text
1. Open /jeju-wave-radio-webapp; confirm the KYUTO header, page title, and app frame.
2. Confirm the video monitor appears and no sound plays before START AUDIO.
3. Press START AUDIO once; confirm the app reports AUDIO RUNNING.
4. Press POLL JEJU DATA; confirm live/partial status or its explicit fallback status.
5. Navigate away and back; confirm the iframe reloads without duplicate sound.
6. Repeat steps 1-5 at https://kyutomatte.github.io/kyutodaze-pages/jeju-wave-radio-webapp.
```

- [ ] **Step 4: Commit documentation after checking staged scope**

```bash
git add README.md
git diff --cached --check
git diff --cached --name-only
git commit -m "docs: document Jeju web app deployment"
```

Expected: only `README.md` is staged; neither `.gitignore` nor `.codex/handoffs/` is included.
